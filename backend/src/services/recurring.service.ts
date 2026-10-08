import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  IRecurringExpense,
  RecurringExpense,
  RecurringFrequency,
  RecurringType,
} from '../models/recurring-expense.model.js';
import {
  ISubscription,
  Subscription,
  SubscriptionBillingCycle,
  SubscriptionStatus,
  ConfidenceLevel,
} from '../models/subscription.model.js';
import { Transaction, TransactionType } from '../models/transaction.model.js';
import { User } from '../models/user.model.js';
import {
  Notification,
  NotificationPriority,
  NotificationType,
} from '../models/notification.model.js';
import { NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/security.util.js';
import { emitToUser } from '../config/socket.js';

export interface RawPatternData {
  merchant: string;
  normalizedMerchant: string;
  expectedAmount: number;
  currency: string;
  frequency: RecurringFrequency;
  recurringType: RecurringType;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  tier: 'CONFIRMED' | 'POSSIBLE' | 'INACTIVE';
  source?: 'AI_DETECTED' | 'MANUAL';
  intervalDays: number;
  transactionCount: number;
  lastTransactionDate: string;
  nextExpectedDate: string;
  isPossiblyInactive: boolean;
  inactivityEvidence?: string | null;
  isActive: boolean;
  matchedTransactionIds: string[];
}

export const DISCRETIONARY_MERCHANTS = new Set([
  'uber', 'ola', 'lyft', 'rapido', 'grab', 'swiggy', 'zomato', 'zepto',
  'blinkit', 'instamart', 'dunzo', 'amazon', 'flipkart', 'bigbasket',
  'starbucks', 'mcdonalds', 'mcdonald', 'dominos', 'kfc', 'burger king',
  'subway', 'pizza hut', 'cinema', 'movie', 'pvr', 'inox', 'bookmyshow',
]);

export const DISCRETIONARY_PASS_EXCEPTIONS = new Set([
  'pass', 'one', 'plus', 'membership', 'sub', 'pro', 'gold', 'prime',
]);

export const SUBSCRIPTION_KEYWORDS = new Set([
  'netflix', 'spotify', 'prime', 'amazon prime', 'youtube', 'disney',
  'hotstar', 'apple', 'icloud', 'google one', 'google storage', 'gym',
  'fitness', 'patreon', 'adobe', 'github', 'chatgpt', 'openai', 'dropbox',
  'medium', 'nytimes', 'playstation', 'xbox', 'zoom', 'hulu', 'canva',
  'notion', 'figma', 'audible', 'sub', 'membership', 'crunchyroll',
  'jiocinema', 'sonyliv', 'zee5', 'coursera', 'udemy', 'linkedin',
  'office 365', 'microsoft 365', 'copilot', 'cursor', 'perplexity',
]);

export const UTILITY_KEYWORDS = new Set([
  'electricity', 'power', 'bescom', 'water', 'broadband', 'wifi', 'fiber',
  'airtel', 'jio', 'vi', 'vodafone', 'tata sky', 'dish tv', 'gas',
  'indane', 'hp gas', 'utility', 'piped gas', 'municipal', 'electric',
  'dth', 'recharge', 'postpaid',
]);

export function isDiscretionaryMerchant(rawMerchant: string, normMerchant: string): boolean {
  const text = `${rawMerchant} ${normMerchant}`.toLowerCase();
  for (const exc of DISCRETIONARY_PASS_EXCEPTIONS) {
    if (text.includes(exc)) return false;
  }
  for (const dm of DISCRETIONARY_MERCHANTS) {
    if (text.includes(dm)) return true;
  }
  return false;
}

/**
 * Standardize and clean merchant strings to cluster variations together.
 * e.g., 'Netflix India', 'NETFLIX.COM', 'netflix' -> 'netflix'
 */
export function normalizeMerchant(name: string): string {
  if (!name) return 'unknown';
  let cleaned = name.toLowerCase().trim();
  // Strip domain extensions
  cleaned = cleaned.replace(/\.(com|in|org|net|co|io|ai|app)/gi, ' ');
  // Clean special characters
  cleaned = cleaned.replace(/[^a-z0-9\s]/gi, ' ');

  const NOISE_TOKENS = new Set([
    'pvt', 'ltd', 'inc', 'llc', 'corp', 'pos', 'upi', 'autopay', 'billdesk',
    'razorpay', 'paytm', 'ach', 'direct debit', 'sub', 'bill', 'payment',
    'card', 'online', 'tx', 'txn', 'ref', 'in', 'india', 'us', 'usa',
    'app', 'www', 'store', 'services',
  ]);

  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0 && !NOISE_TOKENS.has(t));
  if (tokens.length === 0) {
    return cleaned.trim() || 'unknown';
  }
  // If distinctive brand token (e.g. netflix, hotstar, spotify, bescom)
  if (
    tokens.length > 1 &&
    tokens[0].length >= 4 &&
    (SUBSCRIPTION_KEYWORDS.has(tokens[0]) || UTILITY_KEYWORDS.has(tokens[0]))
  ) {
    return tokens[0];
  }
  return tokens.join(' ');
}

export function getCycleDays(cycle?: string): number {
  switch (cycle) {
    case 'WEEKLY': return 7;
    case 'BIWEEKLY': return 14;
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 90;
    case 'SEMI_ANNUALLY': return 180;
    case 'ANNUALLY': return 365;
    default: return 30;
  }
}

export function computeMonthlyEquivalent(amount: number, cycle: string): number {
  switch (cycle) {
    case 'WEEKLY': return (amount * 52) / 12;
    case 'BIWEEKLY': return (amount * 26) / 12;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'SEMI_ANNUALLY': return amount / 6;
    case 'ANNUALLY': return amount / 12;
    default: return amount;
  }
}

export function computeAnnualCost(amount: number, cycle: string): number {
  switch (cycle) {
    case 'WEEKLY': return Math.round(amount * 52 * 100) / 100;
    case 'BIWEEKLY': return Math.round(amount * 26 * 100) / 100;
    case 'MONTHLY': return Math.round(amount * 12 * 100) / 100;
    case 'QUARTERLY': return Math.round(amount * 4 * 100) / 100;
    case 'SEMI_ANNUALLY': return Math.round(amount * 2 * 100) / 100;
    case 'ANNUALLY': return Math.round(amount * 100) / 100;
    default: return Math.round(amount * 12 * 100) / 100;
  }
}

export function computeSubscriptionStatus(
  sub: {
    status?: string;
    tier?: string;
    isPossiblyInactive?: boolean;
    confidenceLevel?: string;
    renewalDate: Date | string;
    lastTransactionDate?: Date | string;
    billingCycle?: string;
    intervalDays?: number;
  },
  now: Date = new Date(),
): SubscriptionStatus {
  if (sub.status === SubscriptionStatus.CANCELLED) return SubscriptionStatus.CANCELLED;
  if (sub.status === SubscriptionStatus.PAUSED) return SubscriptionStatus.PAUSED;
  if (sub.tier === 'POSSIBLE' || sub.confidenceLevel === 'LOW' || sub.status === SubscriptionStatus.POSSIBLE_RECURRING) {
    return SubscriptionStatus.POSSIBLE_RECURRING;
  }

  const cycleDays = sub.intervalDays || getCycleDays(sub.billingCycle);
  const renewalTime = new Date(sub.renewalDate).getTime();
  const nowTime = now.getTime();
  const diffDays = Math.ceil((renewalTime - nowTime) / (1000 * 60 * 60 * 24));

  if (sub.lastTransactionDate) {
    const daysSincePayment = Math.floor(
      (nowTime - new Date(sub.lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    // If paid within the last 3 days and next renewal date is in the future
    if (daysSincePayment <= 3 && diffDays > 0) {
      return SubscriptionStatus.PAID;
    }
    // Inactivity rule: elapsed time without charge exceeds 1.5x standard interval
    if (daysSincePayment > cycleDays * 1.5) {
      return SubscriptionStatus.POSSIBLY_INACTIVE;
    }
  }

  if (diffDays < 0) {
    const daysPastDue = Math.abs(diffDays);
    if (daysPastDue > cycleDays * 1.5) {
      return SubscriptionStatus.POSSIBLY_INACTIVE;
    }
    return SubscriptionStatus.OVERDUE;
  }
  if (diffDays === 0) {
    return SubscriptionStatus.DUE_TODAY;
  }
  if (diffDays <= 3) {
    return SubscriptionStatus.DUE_SOON;
  }
  return SubscriptionStatus.UPCOMING;
}

export class RecurringService {
  /**
   * Scan historical transactions and identify recurring patterns and subscriptions.
   * Reconciles existing records, purging any stale/unsupported records.
   */
  static async detectAndSyncRecurring(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // Fetch user profile for default currency
    const user = await User.findById(userObjectId).lean();
    const defaultCurrency = user?.defaultCurrency || 'USD';

    // 1. Fetch user's active expense transactions
    const transactions = (await Transaction.find({
      userId: userObjectId,
      type: TransactionType.EXPENSE,
      isDeleted: false,
    })
      .sort({ date: 1 })
      .lean()) as unknown as Array<{
      _id: Types.ObjectId;
      merchant: string;
      description?: string;
      amount: number;
      currency?: string;
      date: Date;
      type: string;
      category?: Types.ObjectId;
    }>;

    // 2. Call ML Service or execute in-process heuristic detector
    let patterns: RawPatternData[] = [];
    if (transactions.length > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const mlPayload = {
          transactions: transactions.map((t) => ({
            id: t._id.toString(),
            merchant: t.merchant,
            description: t.description,
            amount: t.amount,
            currency: (t.currency || defaultCurrency).toUpperCase(),
            date: t.date.toISOString(),
            type: t.type,
          })),
          reference_date: new Date().toISOString(),
        };

        const response = await fetch(`${env.ML_SERVICE_URL}/api/v1/ml/recurring-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mlPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const body = (await response.json()) as { patterns: RawPatternData[] };
          patterns = (body.patterns || []).map((p) => ({
            ...p,
            tier: p.tier || (p.confidenceLevel === 'LOW' ? 'POSSIBLE' : 'CONFIRMED'),
            source: 'AI_DETECTED' as const,
            confidenceLevel:
              p.confidenceLevel ||
              (p.confidence >= 0.85 ? 'HIGH' : p.confidence >= 0.7 ? 'MEDIUM' : 'LOW'),
          }));
        } else {
          throw new Error(`ML service returned status ${response.status}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.warn(`ML recurring detection unavailable (${msg}). Using Node fallback engine.`);
        patterns = this.inProcessRecurringDetection(transactions, defaultCurrency);
      }
    }

    // 3. RECONCILIATION: Purge stale AI-detected records not supported by current ledger
    const activePatternKeys = new Set(
      patterns.map((p) => `${p.normalizedMerchant}___${p.currency.toUpperCase()}`),
    );

    // Soft-delete obsolete AI-detected subscriptions
    const existingAiSubs = await Subscription.find({
      userId: userObjectId,
      isDeleted: false,
      source: 'AI_DETECTED',
    });

    for (const oldSub of existingAiSubs) {
      const subKey = `${oldSub.normalizedMerchant || normalizeMerchant(oldSub.merchant)}___${(oldSub.currency || defaultCurrency).toUpperCase()}`;
      if (!activePatternKeys.has(subKey)) {
        oldSub.isDeleted = true;
        oldSub.deletedAt = new Date();
        oldSub.status = SubscriptionStatus.CANCELLED;
        await oldSub.save();
      }
    }

    // Soft-delete obsolete AI-detected recurring expenses
    const existingAiRecs = await RecurringExpense.find({
      userId: userObjectId,
      isDeleted: false,
      $or: [{ autoDetected: true }, { source: 'AI_DETECTED' }],
    });

    for (const oldRec of existingAiRecs) {
      const recKey = `${oldRec.normalizedMerchant || normalizeMerchant(oldRec.merchant)}___${(oldRec.currency || defaultCurrency).toUpperCase()}`;
      if (!activePatternKeys.has(recKey)) {
        oldRec.isDeleted = true;
        oldRec.deletedAt = new Date();
        oldRec.isActive = false;
        await oldRec.save();
      }
    }

    // 4. Persist and sync detected patterns
    let recurringCreated = 0;
    let recurringUpdated = 0;
    let subscriptionsCreated = 0;

    const now = new Date();

    for (const pattern of patterns) {
      const normKey = pattern.normalizedMerchant || normalizeMerchant(pattern.merchant);
      const currency = (pattern.currency || defaultCurrency).toUpperCase();
      const annualCost = computeAnnualCost(pattern.expectedAmount, pattern.frequency);
      const matchedObjectIds = pattern.matchedTransactionIds.map((id) => new Types.ObjectId(id));

      // Match existing recurring expense
      let existingRec = await RecurringExpense.findOne({
        userId: userObjectId,
        isDeleted: false,
        normalizedMerchant: normKey,
        currency,
      });

      if (!existingRec) {
        existingRec = await RecurringExpense.create({
          userId: userObjectId,
          merchant: pattern.merchant,
          normalizedMerchant: normKey,
          description: `Auto-detected ${(pattern.recurringType || 'recurring').toLowerCase()} (${pattern.confidenceLevel} confidence)`,
          expectedAmount: pattern.expectedAmount,
          currency,
          frequency: pattern.frequency,
          recurringType: pattern.recurringType,
          confidence: pattern.confidence,
          confidenceLevel: pattern.confidenceLevel,
          source: 'AI_DETECTED',
          tier: pattern.tier,
          intervalDays: pattern.intervalDays,
          transactionCount: pattern.transactionCount,
          matchedTransactionIds: matchedObjectIds,
          estimatedAnnualCost: annualCost,
          startDate: new Date(pattern.lastTransactionDate),
          nextDueDate: new Date(pattern.nextExpectedDate),
          lastTransactionDate: new Date(pattern.lastTransactionDate),
          isActive: pattern.isActive && pattern.tier === 'CONFIRMED',
          isPossiblyInactive: pattern.isPossiblyInactive,
          inactivityEvidence: pattern.inactivityEvidence || undefined,
          autoDetected: true,
          isDeleted: false,
        });
        recurringCreated++;
      } else {
        existingRec.expectedAmount = pattern.expectedAmount;
        existingRec.normalizedMerchant = normKey;
        existingRec.currency = currency;
        existingRec.frequency = pattern.frequency;
        existingRec.recurringType = pattern.recurringType;
        existingRec.confidence = pattern.confidence;
        existingRec.confidenceLevel = pattern.confidenceLevel;
        existingRec.source = 'AI_DETECTED';
        existingRec.tier = pattern.tier;
        existingRec.intervalDays = pattern.intervalDays;
        existingRec.transactionCount = pattern.transactionCount;
        existingRec.matchedTransactionIds = matchedObjectIds;
        existingRec.estimatedAnnualCost = annualCost;
        existingRec.nextDueDate = new Date(pattern.nextExpectedDate);
        existingRec.lastTransactionDate = new Date(pattern.lastTransactionDate);
        existingRec.isPossiblyInactive = pattern.isPossiblyInactive;
        existingRec.inactivityEvidence = pattern.inactivityEvidence || undefined;
        existingRec.isActive = pattern.isActive && pattern.tier === 'CONFIRMED';
        await existingRec.save();
        recurringUpdated++;
      }

      // If classified as a SUBSCRIPTION or recognized potential recurring expense, sync to Subscription model
      if (
        pattern.recurringType === RecurringType.SUBSCRIPTION ||
        pattern.tier === 'CONFIRMED' ||
        pattern.tier === 'POSSIBLE'
      ) {
        let existingSub = await Subscription.findOne({
          userId: userObjectId,
          isDeleted: false,
          normalizedMerchant: normKey,
          currency,
        });

        const billingCycle: SubscriptionBillingCycle =
          pattern.frequency === RecurringFrequency.ANNUALLY
            ? SubscriptionBillingCycle.ANNUALLY
            : pattern.frequency === RecurringFrequency.SEMI_ANNUALLY
              ? SubscriptionBillingCycle.SEMI_ANNUALLY
              : pattern.frequency === RecurringFrequency.QUARTERLY
                ? SubscriptionBillingCycle.QUARTERLY
                : pattern.frequency === RecurringFrequency.BIWEEKLY
                  ? SubscriptionBillingCycle.BIWEEKLY
                  : pattern.frequency === RecurringFrequency.WEEKLY
                    ? SubscriptionBillingCycle.WEEKLY
                    : SubscriptionBillingCycle.MONTHLY;

        const subStatus = computeSubscriptionStatus(
          {
            renewalDate: new Date(pattern.nextExpectedDate),
            lastTransactionDate: new Date(pattern.lastTransactionDate),
            billingCycle,
            intervalDays: pattern.intervalDays,
            confidenceLevel: pattern.confidenceLevel,
            tier: pattern.tier,
            isPossiblyInactive: pattern.isPossiblyInactive,
          },
          now,
        );

        if (!existingSub) {
          existingSub = await Subscription.create({
            userId: userObjectId,
            recurringExpenseId: existingRec._id,
            name: pattern.merchant,
            merchant: pattern.merchant,
            normalizedMerchant: normKey,
            billingCycle,
            amount: pattern.expectedAmount,
            currency,
            status: subStatus,
            renewalDate: new Date(pattern.nextExpectedDate),
            lastTransactionDate: new Date(pattern.lastTransactionDate),
            isPossiblyInactive: pattern.isPossiblyInactive,
            inactivityEvidence: pattern.inactivityEvidence || undefined,
            confidence: pattern.confidence,
            confidenceLevel: pattern.confidenceLevel,
            source: 'AI_DETECTED',
            tier: pattern.tier,
            transactionCount: pattern.transactionCount,
            matchedTransactionIds: matchedObjectIds,
            averageIntervalDays: pattern.intervalDays,
            estimatedAnnualCost: annualCost,
            priceHistory: [
              {
                amount: pattern.expectedAmount,
                effectiveDate: new Date(pattern.lastTransactionDate),
              },
            ],
            priceChangeAlert: false,
            isDeleted: false,
          });
          existingRec.subscriptionId = existingSub._id;
          await existingRec.save();
          subscriptionsCreated++;
        } else {
          if (existingSub.amount !== pattern.expectedAmount) {
            existingSub.priceHistory.push({
              amount: pattern.expectedAmount,
              effectiveDate: new Date(pattern.lastTransactionDate),
            });
            existingSub.priceChangeAlert = true;
          }
          existingSub.name = existingSub.name || pattern.merchant;
          existingSub.merchant = existingSub.merchant || pattern.merchant;
          existingSub.normalizedMerchant = normKey;
          existingSub.amount = pattern.expectedAmount;
          existingSub.currency = currency;
          existingSub.billingCycle = billingCycle;
          existingSub.status = subStatus;
          existingSub.renewalDate = new Date(pattern.nextExpectedDate);
          existingSub.lastTransactionDate = new Date(pattern.lastTransactionDate);
          existingSub.isPossiblyInactive = pattern.isPossiblyInactive;
          existingSub.inactivityEvidence = pattern.inactivityEvidence || undefined;
          existingSub.confidence = pattern.confidence;
          existingSub.confidenceLevel = pattern.confidenceLevel;
          existingSub.source = existingSub.source || 'AI_DETECTED';
          existingSub.tier = pattern.tier;
          existingSub.transactionCount = pattern.transactionCount;
          existingSub.matchedTransactionIds = matchedObjectIds;
          existingSub.averageIntervalDays = pattern.intervalDays;
          existingSub.estimatedAnnualCost = annualCost;
          await existingSub.save();
        }
      }
    }

    emitToUser(userId, 'subscription:changed', { action: 'scan', count: patterns.length });
    emitToUser(userId, 'recurring:changed', { action: 'scan', count: patterns.length });

    const confirmedCount = patterns.filter((p) => p.tier === 'CONFIRMED').length;
    const possibleCount = patterns.filter((p) => p.tier === 'POSSIBLE').length;

    return {
      totalDetected: patterns.length,
      confirmedCount,
      possibleCount,
      recurringCreated,
      recurringUpdated,
      subscriptionsCreated,
      patterns,
    };
  }

  /**
   * Resilient in-process pattern detector for historical transactions
   */
  static inProcessRecurringDetection(
    transactions: Array<{
      _id: Types.ObjectId;
      merchant: string;
      amount: number;
      date: Date;
      type: string;
      currency?: string;
      category?: Types.ObjectId;
      description?: string;
    }>,
    defaultCurrency: string = 'USD',
  ): RawPatternData[] {
    const clusters = new Map<string, typeof transactions>();

    for (const tx of transactions) {
      if (tx.type !== 'EXPENSE') continue;
      const rawMerchant = tx.merchant || tx.description || 'unknown';
      const normKey = normalizeMerchant(rawMerchant);

      // Exclude variable discretionary spending (e.g. Uber taxi rides, Zomato meal delivery)
      if (isDiscretionaryMerchant(rawMerchant, normKey)) {
        continue;
      }

      const currency = (tx.currency || defaultCurrency).toUpperCase();
      const clusterKey = `${normKey}___${currency}`;

      if (!clusters.has(clusterKey)) clusters.set(clusterKey, []);
      clusters.get(clusterKey)!.push(tx);
    }

    const results: RawPatternData[] = [];
    const now = new Date();

    for (const [clusterKey, txList] of clusters.entries()) {
      const [normKey, currency] = clusterKey.split('___');

      txList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Deduplicate same-day billing transactions (e.g. duplicate charges on same day)
      const dayGroups = new Map<string, typeof txList>();
      for (const t of txList) {
        const dayStr = new Date(t.date).toISOString().slice(0, 10);
        if (!dayGroups.has(dayStr)) dayGroups.set(dayStr, []);
        dayGroups.get(dayStr)!.push(t);
      }

      const billingEvents: Array<{ dt: Date; amt: number; tx: (typeof txList)[0] }> = [];
      for (const dayStr of Array.from(dayGroups.keys()).sort()) {
        const group = dayGroups.get(dayStr)!;
        const repr = group[group.length - 1];
        billingEvents.push({
          dt: new Date(repr.date),
          amt: repr.amount,
          tx: repr,
        });
      }

      // Case 1: Exactly 1 distinct billing date (e.g. Hotstar ₹600 single transaction)
      if (billingEvents.length === 1) {
        const ev = billingEvents[0];
        const rawM = (ev.tx.merchant || normKey).toLowerCase();
        const desc = (ev.tx.description || '').toLowerCase();

        const isSubCandidate =
          SUBSCRIPTION_KEYWORDS.has(normKey) ||
          Array.from(SUBSCRIPTION_KEYWORDS).some((k) => rawM.includes(k) || desc.includes(k));

        const isUtilCandidate =
          UTILITY_KEYWORDS.has(normKey) ||
          Array.from(UTILITY_KEYWORDS).some((k) => rawM.includes(k) || desc.includes(k));

        if (isSubCandidate || isUtilCandidate) {
          const sampleMerchant = ev.tx.merchant || normKey.toUpperCase();
          const recType = isSubCandidate ? RecurringType.SUBSCRIPTION : RecurringType.UTILITY;
          const nextExpected = new Date(ev.dt.getTime() + 30 * 86400000);

          results.push({
            merchant: sampleMerchant,
            normalizedMerchant: normKey,
            expectedAmount: Math.round(ev.amt * 100) / 100,
            currency,
            frequency: RecurringFrequency.MONTHLY,
            recurringType: recType,
            confidence: 0.40,
            confidenceLevel: 'LOW',
            tier: 'POSSIBLE',
            source: 'AI_DETECTED',
            intervalDays: 30,
            transactionCount: txList.length,
            lastTransactionDate: ev.dt.toISOString(),
            nextExpectedDate: nextExpected.toISOString(),
            isPossiblyInactive: false,
            inactivityEvidence: `1 transaction detected (${ev.dt.toISOString().slice(0, 10)}). Awaiting more billing cycles to confirm frequency.`,
            isActive: true,
            matchedTransactionIds: txList.map((t) => t._id.toString()),
          });
        }
        continue;
      }

      // Case 2: >= 2 distinct billing dates
      const amountsAll = billingEvents.map((b) => b.amt);
      const meanAll = amountsAll.reduce((a, b) => a + b, 0) / amountsAll.length;
      const cvAll =
        meanAll > 0
          ? Math.sqrt(
              amountsAll.reduce((sum, a) => sum + Math.pow(a - meanAll, 2), 0) / amountsAll.length,
            ) / meanAll
          : 0;

      if (cvAll > 0.15) {
        const sortedAmts = [...amountsAll].sort((a, b) => a - b);
        const medianAmt = sortedAmts[Math.floor(sortedAmts.length / 2)];
        const modalEvents = billingEvents.filter(
          (b) => Math.abs(b.amt - medianAmt) / (medianAmt || 1.0) <= 0.25,
        );
        if (modalEvents.length >= 2) {
          billingEvents.length = 0;
          billingEvents.push(...modalEvents);
        }
      }

      const dates = billingEvents.map((b) => b.dt);
      const amounts = billingEvents.map((b) => b.amt);

      const intervals: number[] = [];
      for (let i = 0; i < dates.length - 1; i++) {
        const diffDays = Math.round(
          (dates[i + 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays > 0) intervals.push(diffDays);
      }

      if (intervals.length === 0) continue;

      intervals.sort((a, b) => a - b);
      const medianInt = intervals[Math.floor(intervals.length / 2)];

      let freq: RecurringFrequency | null = null;
      let intervalDays = 30;

      if (medianInt >= 5 && medianInt <= 9) {
        freq = RecurringFrequency.WEEKLY;
        intervalDays = 7;
      } else if (medianInt >= 11 && medianInt <= 18) {
        freq = RecurringFrequency.BIWEEKLY;
        intervalDays = 14;
      } else if (medianInt >= 25 && medianInt <= 35) {
        freq = RecurringFrequency.MONTHLY;
        intervalDays = 30;
      } else if (medianInt >= 75 && medianInt <= 105) {
        freq = RecurringFrequency.QUARTERLY;
        intervalDays = 90;
      } else if (medianInt >= 160 && medianInt <= 200) {
        freq = RecurringFrequency.SEMI_ANNUALLY;
        intervalDays = 180;
      } else if (medianInt >= 340 && medianInt <= 390) {
        freq = RecurringFrequency.ANNUALLY;
        intervalDays = 365;
      } else {
        // If known subscription merchant, tolerate slight interval variance
        const rawM = (billingEvents[billingEvents.length - 1].tx.merchant || normKey).toLowerCase();
        if (Array.from(SUBSCRIPTION_KEYWORDS).some((k) => rawM.includes(k) || normKey.includes(k))) {
          freq = RecurringFrequency.MONTHLY;
          intervalDays = 30;
        }
      }

      if (!freq) continue;

      const meanAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance =
        amounts.reduce((sum, a) => sum + Math.pow(a - meanAmt, 2), 0) / amounts.length;
      const cv = meanAmt > 0 ? Math.sqrt(variance) / meanAmt : 0;

      const sampleMerchant =
        billingEvents[billingEvents.length - 1].tx.merchant || normKey.toUpperCase();
      const lower = sampleMerchant.toLowerCase();

      let recType = RecurringType.EXPENSE;
      if (
        lower.includes('loan') ||
        lower.includes('emi') ||
        lower.includes('finance') ||
        lower.includes('mortgage')
      ) {
        recType = RecurringType.EMI;
      } else if (
        Array.from(SUBSCRIPTION_KEYWORDS).some((k) => lower.includes(k) || normKey.includes(k)) ||
        cv <= 0.15
      ) {
        recType = RecurringType.SUBSCRIPTION;
      } else if (
        Array.from(UTILITY_KEYWORDS).some((k) => lower.includes(k) || normKey.includes(k))
      ) {
        recType = RecurringType.UTILITY;
      }

      if (recType !== RecurringType.UTILITY && cv > 0.25) continue;
      if (recType === RecurringType.UTILITY && cv > 0.35) continue;

      // Confidence level scoring
      let confidenceLevel: ConfidenceLevel = 'LOW';
      if (billingEvents.length >= 3 && cv <= 0.15) {
        confidenceLevel = 'HIGH';
      } else if (billingEvents.length >= 2 && cv <= 0.15) {
        confidenceLevel = 'MEDIUM';
      }

      const scoreNum = Math.min(0.99, Math.max(0.60, 0.95 - cv));

      // LATEST VALID PAYMENT ANCHOR
      const lastDate = dates[dates.length - 1];
      const daysSinceLast = Math.round(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isPossiblyInactive = daysSinceLast > intervalDays * 1.5;

      const nextExpected = new Date(lastDate.getTime() + intervalDays * 86400000);

      const inactivityEvidence = isPossiblyInactive
        ? `Last transaction detected on ${lastDate.toISOString().split('T')[0]} (${daysSinceLast} days ago). Expected regular ${freq.toLowerCase()} interval is ~${intervalDays} days. No transaction detected for ${(daysSinceLast / intervalDays).toFixed(1)}x the billing cycle.`
        : null;

      results.push({
        merchant: sampleMerchant,
        normalizedMerchant: normKey,
        expectedAmount: Math.round(amounts[amounts.length - 1] * 100) / 100,
        currency,
        frequency: freq,
        recurringType: recType,
        confidence: scoreNum,
        confidenceLevel,
        tier: isPossiblyInactive ? 'INACTIVE' : 'CONFIRMED',
        source: 'AI_DETECTED',
        intervalDays,
        transactionCount: txList.length,
        lastTransactionDate: lastDate.toISOString(),
        nextExpectedDate: nextExpected.toISOString(),
        isPossiblyInactive,
        inactivityEvidence,
        isActive: !isPossiblyInactive,
        matchedTransactionIds: txList.map((t) => t._id.toString()),
      });
    }

    return results;
  }

  /**
   * Real-time lifecycle hook: Synchronize recurring patterns when a transaction is created, updated, or deleted
   */
  static async syncOnTransactionChange(
    userId: string,
    transaction: any,
    action: 'create' | 'update' | 'delete',
  ) {
    const userObjectId = new Types.ObjectId(userId);

    if (action === 'delete' || action === 'update') {
      // Re-run detection to recalculate recurring cycles from current state of the ledger
      await this.detectAndSyncRecurring(userId);
      emitToUser(userId, 'subscription:changed', { action, transactionId: transaction._id });
      emitToUser(userId, 'recurring:changed', { action, transactionId: transaction._id });
      return;
    }

    // action === 'create'
    if (transaction.type !== TransactionType.EXPENSE) {
      return;
    }

    const rawMerchant = transaction.merchant || transaction.description || '';
    const normMerchant = normalizeMerchant(rawMerchant);
    const txDate = new Date(transaction.date);
    const txIdStr = transaction._id.toString();
    const currency = (transaction.currency || 'USD').toUpperCase();

    // Check if matches an existing Subscription
    const existingSub = await Subscription.findOne({
      userId: userObjectId,
      isDeleted: false,
      normalizedMerchant: normMerchant,
      currency,
    });

    if (existingSub) {
      // Attach transaction ID to matchedTransactionIds
      const alreadyMatched = existingSub.matchedTransactionIds?.some(
        (id) => id.toString() === txIdStr,
      );
      if (!alreadyMatched) {
        existingSub.matchedTransactionIds = existingSub.matchedTransactionIds || [];
        existingSub.matchedTransactionIds.push(new Types.ObjectId(txIdStr));
      }

      // If new transaction date >= lastTransactionDate, advance cycle anchored to this latest date!
      const lastDate = existingSub.lastTransactionDate
        ? new Date(existingSub.lastTransactionDate)
        : new Date(0);

      if (txDate.getTime() >= lastDate.getTime()) {
        existingSub.lastTransactionDate = txDate;
        const intervalDays = existingSub.averageIntervalDays || getCycleDays(existingSub.billingCycle);
        existingSub.renewalDate = new Date(txDate.getTime() + intervalDays * 86400000);
        existingSub.status = SubscriptionStatus.PAID;
        existingSub.isPossiblyInactive = false;
        existingSub.inactivityEvidence = undefined;

        if (existingSub.amount !== transaction.amount) {
          existingSub.priceHistory.push({
            amount: transaction.amount,
            effectiveDate: txDate,
          });
          existingSub.priceChangeAlert = true;
          existingSub.amount = transaction.amount;
        }
        await existingSub.save();
      }

      // Also update linked RecurringExpense
      if (existingSub.recurringExpenseId) {
        const recExp = await RecurringExpense.findById(existingSub.recurringExpenseId);
        if (recExp && !recExp.isDeleted) {
          recExp.lastTransactionDate = txDate;
          const intervalDays = recExp.intervalDays || getCycleDays(recExp.frequency);
          recExp.nextDueDate = new Date(txDate.getTime() + intervalDays * 86400000);
          recExp.isActive = true;
          recExp.isPossiblyInactive = false;
          recExp.inactivityEvidence = undefined;
          recExp.expectedAmount = transaction.amount;
          if (!recExp.matchedTransactionIds?.some((id) => id.toString() === txIdStr)) {
            recExp.matchedTransactionIds = recExp.matchedTransactionIds || [];
            recExp.matchedTransactionIds.push(new Types.ObjectId(txIdStr));
          }
          await recExp.save();
        }
      }
    }

    // Always re-evaluate patterns so single transactions (like Hotstar) or additional billing events update intelligence
    await this.detectAndSyncRecurring(userId);

    emitToUser(userId, 'subscription:changed', { action: 'create', transactionId: transaction._id });
    emitToUser(userId, 'recurring:changed', { action: 'create', transactionId: transaction._id });
  }

  /**
   * Get subscription intelligence metrics for dashboard
   */
  static async getSubscriptionDashboard(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await User.findById(userObjectId).lean();
    const defaultCurrency = user?.defaultCurrency || 'USD';

    const subscriptions = await Subscription.find({
      userId: userObjectId,
      isDeleted: false,
    })
      .populate('categoryId', 'name slug color icon')
      .populate('matchedTransactionIds', 'merchant amount date currency paymentMethod description')
      .sort({ renewalDate: 1 })
      .lean();

    const now = new Date();

    const formattedSubscriptions = subscriptions.map((s) => {
      const dynamicStatus = computeSubscriptionStatus(s, now);
      const annualCost = s.estimatedAnnualCost || computeAnnualCost(s.amount, s.billingCycle);
      return {
        ...s,
        status: dynamicStatus,
        estimatedAnnualCost: annualCost,
        currency: s.currency || defaultCurrency,
      };
    });

    // 1. Confirmed Active Subscriptions (Strictly Tier: CONFIRMED)
    const confirmedActiveList = formattedSubscriptions.filter(
      (s) =>
        s.tier === 'CONFIRMED' &&
        s.status !== SubscriptionStatus.CANCELLED &&
        s.status !== SubscriptionStatus.POSSIBLY_INACTIVE &&
        !s.isPossiblyInactive,
    );

    // 2. Possible Recurring Expenses (Tier: POSSIBLE)
    const possibleRecurringList = formattedSubscriptions.filter(
      (s) => s.tier === 'POSSIBLE' || s.status === SubscriptionStatus.POSSIBLE_RECURRING,
    );

    // 3. Possibly Inactive Subscriptions
    const possiblyInactiveList = formattedSubscriptions.filter(
      (s) =>
        s.tier === 'INACTIVE' ||
        s.isPossiblyInactive ||
        s.status === SubscriptionStatus.POSSIBLY_INACTIVE,
    );

    // Compute monthly normalized recurring cost ONLY from Confirmed Active Subscriptions
    let monthlyCost = 0;
    const cycleDistribution: Record<string, number> = {
      WEEKLY: 0,
      BIWEEKLY: 0,
      MONTHLY: 0,
      QUARTERLY: 0,
      SEMI_ANNUALLY: 0,
      ANNUALLY: 0,
    };

    for (const sub of confirmedActiveList) {
      cycleDistribution[sub.billingCycle] = (cycleDistribution[sub.billingCycle] || 0) + 1;
      monthlyCost += computeMonthlyEquivalent(sub.amount, sub.billingCycle);
    }

    // Upcoming renewals list: ONLY confirmed subscriptions have upcoming payments!
    const upcomingRenewals = confirmedActiveList.slice(0, 10).map((s) => {
      const diffDays = Math.ceil(
        (new Date(s.renewalDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const urgency =
        diffDays < 0
          ? 'OVERDUE'
          : diffDays === 0
            ? 'DUE_TODAY'
            : diffDays <= 3
              ? 'DUE_SOON'
              : 'UPCOMING';

      return {
        id: s._id.toString(),
        name: s.name,
        merchant: s.merchant,
        amount: s.amount,
        currency: s.currency,
        billingCycle: s.billingCycle,
        renewalDate: s.renewalDate,
        daysRemaining: diffDays,
        urgency,
      };
    });

    return {
      subscriptionCount: confirmedActiveList.length,
      activeSubscriptions: confirmedActiveList.length,
      possiblyInactiveSubscriptions: possiblyInactiveList.length,
      possibleRecurringCount: possibleRecurringList.length,
      monthlySubscriptionCost: Math.round(monthlyCost * 100) / 100,
      annualizedSubscriptionCost: Math.round(monthlyCost * 12 * 100) / 100,
      billingCycleDistribution: cycleDistribution,
      upcomingRenewals,
      possiblyInactiveList: possiblyInactiveList.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        merchant: s.merchant,
        amount: s.amount,
        currency: s.currency,
        billingCycle: s.billingCycle,
        renewalDate: s.renewalDate,
        lastTransactionDate: s.lastTransactionDate,
        inactivityEvidence:
          s.inactivityEvidence ||
          `No transaction detected for over 1.5x regular billing cycle. Check if service is still active.`,
      })),
      confirmedSubscriptions: confirmedActiveList,
      possibleRecurringExpenses: possibleRecurringList,
      allSubscriptions: formattedSubscriptions,
      defaultCurrency,
    };
  }

  /**
   * Get authentic payment history for a specific subscription
   */
  static async getSubscriptionHistory(userId: string, subscriptionId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const sub = await Subscription.findOne({
      _id: new Types.ObjectId(subscriptionId),
      userId: userObjectId,
      isDeleted: false,
    })
      .populate('categoryId', 'name slug color icon')
      .lean();

    if (!sub) {
      throw new NotFoundError('Subscription record not found');
    }

    let transactions: any[] = [];
    if (sub.matchedTransactionIds && sub.matchedTransactionIds.length > 0) {
      transactions = await Transaction.find({
        _id: { $in: sub.matchedTransactionIds },
        userId: userObjectId,
        isDeleted: false,
      })
        .populate('category', 'name slug color icon')
        .sort({ date: -1 })
        .lean();
    }

    if (transactions.length === 0) {
      const norm = sub.normalizedMerchant || normalizeMerchant(sub.merchant);
      const regex = new RegExp(escapeRegex(norm), 'i');
      transactions = await Transaction.find({
        userId: userObjectId,
        type: TransactionType.EXPENSE,
        isDeleted: false,
        $or: [
          { merchant: { $regex: regex } },
          { description: { $regex: regex } },
        ],
      })
        .populate('category', 'name slug color icon')
        .sort({ date: -1 })
        .lean();
    }

    return {
      subscription: sub,
      transactions,
    };
  }

  /**
   * Get paginated recurring expenses
   */
  static async getRecurringExpenses(
    userId: string,
    filters: {
      isActive?: boolean;
      frequency?: RecurringFrequency;
      recurringType?: RecurringType;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters.frequency) {
      query.frequency = filters.frequency;
    }
    if (filters.recurringType) {
      query.recurringType = filters.recurringType;
    }
    if (filters.search) {
      const escaped = escapeRegex(filters.search.trim());
      query.$or = [
        { merchant: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      RecurringExpense.find(query)
        .populate('categoryId', 'name slug color icon')
        .sort({ nextDueDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecurringExpense.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single recurring expense by ID
   */
  static async getRecurringExpenseById(userId: string, id: string): Promise<IRecurringExpense> {
    const item = await RecurringExpense.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).populate('categoryId', 'name slug color icon');

    if (!item) {
      throw new NotFoundError('Recurring expense record not found');
    }
    return item;
  }

  /**
   * Create recurring expense manually
   */
  static async createRecurringExpense(userId: string, data: Partial<IRecurringExpense>) {
    const norm = normalizeMerchant(data.merchant || '');
    return RecurringExpense.create({
      ...data,
      userId: new Types.ObjectId(userId),
      normalizedMerchant: norm,
      confidence: 1.0,
      confidenceLevel: 'HIGH',
      source: 'MANUAL',
      tier: 'CONFIRMED',
      autoDetected: false,
      isDeleted: false,
    });
  }

  /**
   * Update recurring expense
   */
  static async updateRecurringExpense(
    userId: string,
    id: string,
    data: Partial<IRecurringExpense>,
  ): Promise<IRecurringExpense> {
    const item = await this.getRecurringExpenseById(userId, id);
    if (data.merchant) {
      data.normalizedMerchant = normalizeMerchant(data.merchant);
    }
    Object.assign(item, data);
    return item.save();
  }

  /**
   * Soft-delete recurring expense
   */
  static async deleteRecurringExpense(userId: string, id: string): Promise<void> {
    const item = await this.getRecurringExpenseById(userId, id);
    item.isDeleted = true;
    item.deletedAt = new Date();
    item.isActive = false;
    await item.save();
  }

  /**
   * Get subscriptions with filters and pagination
   */
  static async getSubscriptions(
    userId: string,
    filters: {
      status?: SubscriptionStatus;
      billingCycle?: SubscriptionBillingCycle;
      isPossiblyInactive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (filters.status) query.status = filters.status;
    if (filters.billingCycle) query.billingCycle = filters.billingCycle;
    if (filters.isPossiblyInactive !== undefined) {
      query.isPossiblyInactive = filters.isPossiblyInactive;
    }
    if (filters.search) {
      const escaped = escapeRegex(filters.search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { merchant: { $regex: escaped, $options: 'i' } },
      ];
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Subscription.find(query)
        .populate('categoryId', 'name slug color icon')
        .sort({ renewalDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(query),
    ]);

    const now = new Date();
    const formattedItems = items.map((s) => ({
      ...s,
      status: computeSubscriptionStatus(s, now),
      estimatedAnnualCost: s.estimatedAnnualCost || computeAnnualCost(s.amount, s.billingCycle),
    }));

    return {
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Create subscription manually
   */
  static async createSubscription(userId: string, data: Partial<ISubscription>) {
    const norm = normalizeMerchant(data.merchant || data.name || '');
    const annualCost = computeAnnualCost(data.amount || 0, data.billingCycle || 'MONTHLY');
    return Subscription.create({
      ...data,
      userId: new Types.ObjectId(userId),
      normalizedMerchant: norm,
      confidence: 1.0,
      confidenceLevel: 'HIGH',
      source: 'MANUAL',
      tier: 'CONFIRMED',
      estimatedAnnualCost: annualCost,
      priceHistory: [{ amount: data.amount || 0, effectiveDate: new Date() }],
      priceChangeAlert: false,
      isDeleted: false,
    });
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    userId: string,
    id: string,
    data: Partial<ISubscription>,
  ): Promise<ISubscription> {
    const item = await Subscription.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!item) {
      throw new NotFoundError('Subscription record not found');
    }

    if (data.amount && data.amount !== item.amount) {
      item.priceHistory.push({
        amount: data.amount,
        effectiveDate: new Date(),
      });
      item.priceChangeAlert = true;
    }

    if (data.merchant) {
      data.normalizedMerchant = normalizeMerchant(data.merchant);
    }

    if (data.amount || data.billingCycle) {
      item.estimatedAnnualCost = computeAnnualCost(
        data.amount || item.amount,
        data.billingCycle || item.billingCycle,
      );
    }

    Object.assign(item, data);
    return item.save();
  }

  /**
   * Delete subscription
   */
  static async deleteSubscription(userId: string, id: string): Promise<void> {
    const item = await Subscription.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!item) {
      throw new NotFoundError('Subscription record not found');
    }

    item.isDeleted = true;
    item.deletedAt = new Date();
    await item.save();
  }

  /**
   * Query upcoming bills due within specified window.
   * STRICT: Only returns CONFIRMED active subscriptions and commitments. Never unconfirmed single transactions.
   */
  static async getUpcomingBills(userId: string, daysAhead: number = 30) {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const futureLimit = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const [recurringExpenses, subscriptions] = await Promise.all([
      RecurringExpense.find({
        userId: userObjectId,
        isActive: true,
        isDeleted: false,
        tier: 'CONFIRMED',
        nextDueDate: { $lte: futureLimit },
      })
        .sort({ nextDueDate: 1 })
        .lean(),
      Subscription.find({
        userId: userObjectId,
        isDeleted: false,
        tier: 'CONFIRMED',
        status: {
          $in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.UPCOMING,
            SubscriptionStatus.DUE_SOON,
            SubscriptionStatus.DUE_TODAY,
            SubscriptionStatus.OVERDUE,
            SubscriptionStatus.PAID,
          ],
        },
        renewalDate: { $lte: futureLimit },
      })
        .sort({ renewalDate: 1 })
        .lean(),
    ]);

    const bills: Array<{
      id: string;
      merchant: string;
      name: string;
      amount: number;
      currency: string;
      dueDate: Date;
      daysRemaining: number;
      type: string;
      urgency: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
    }> = [];

    for (const rec of recurringExpenses) {
      const due = new Date(rec.nextDueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const urgency =
        diffDays < 0
          ? 'OVERDUE'
          : diffDays === 0
            ? 'DUE_TODAY'
            : diffDays <= 3
              ? 'DUE_SOON'
              : 'UPCOMING';

      bills.push({
        id: rec._id.toString(),
        merchant: rec.merchant,
        name: rec.merchant,
        amount: rec.expectedAmount,
        currency: rec.currency,
        dueDate: due,
        daysRemaining: diffDays,
        type: rec.recurringType,
        urgency,
      });
    }

    const seenRecurringIds = new Set(
      recurringExpenses
        .map((r) => r.subscriptionId?.toString())
        .filter((id): id is string => Boolean(id)),
    );

    for (const sub of subscriptions) {
      if (seenRecurringIds.has(sub._id.toString())) {
        continue;
      }
      const due = new Date(sub.renewalDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const urgency =
        diffDays < 0
          ? 'OVERDUE'
          : diffDays === 0
            ? 'DUE_TODAY'
            : diffDays <= 3
              ? 'DUE_SOON'
              : 'UPCOMING';

      bills.push({
        id: sub._id.toString(),
        merchant: sub.merchant,
        name: sub.name,
        amount: sub.amount,
        currency: sub.currency,
        dueDate: due,
        daysRemaining: diffDays,
        type: 'SUBSCRIPTION',
        urgency,
      });
    }

    bills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return bills;
  }

  /**
   * Trigger real notification reminders for bills due within 3 days or overdue.
   * Deduplicates per billing cycle due date to avoid spam.
   */
  static async triggerBillReminders(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const bills = await this.getUpcomingBills(userId, 3);
    let createdCount = 0;

    for (const bill of bills) {
      const dueDateIso = new Date(bill.dueDate).toISOString().slice(0, 10);

      // Avoid duplicate unread reminder notification for the same bill within 24 hours OR for the same cycle date
      const existingNotification = await Notification.findOne({
        userId: userObjectId,
        type: { $in: [NotificationType.BILL_DUE, NotificationType.SUBSCRIPTION_RENEWAL] },
        'metadata.billId': bill.id,
        $or: [
          { isRead: false, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { 'metadata.dueDateIso': dueDateIso },
        ],
      });

      if (!existingNotification) {
        let messageText = '';
        const dueDateFormatted = new Date(bill.dueDate).toLocaleDateString();

        if (bill.urgency === 'OVERDUE') {
          messageText = `${bill.merchant} subscription payment of ${bill.currency} ${bill.amount} was expected on ${dueDateFormatted} but no matching transaction was detected.`;
        } else if (bill.urgency === 'DUE_TODAY' || bill.daysRemaining === 0) {
          messageText = `${bill.merchant} subscription payment of ${bill.currency} ${bill.amount} is due today.`;
        } else if (bill.daysRemaining === 1) {
          messageText = `${bill.merchant} subscription payment of ${bill.currency} ${bill.amount} is expected tomorrow.`;
        } else {
          messageText = `${bill.merchant} subscription payment of ${bill.currency} ${bill.amount} is expected in ${bill.daysRemaining} days on ${dueDateFormatted}.`;
        }

        const notifType =
          bill.type === 'SUBSCRIPTION'
            ? NotificationType.SUBSCRIPTION_RENEWAL
            : NotificationType.BILL_DUE;

        const notif = await Notification.create({
          userId: userObjectId,
          type: notifType,
          priority:
            bill.urgency === 'OVERDUE' || bill.daysRemaining <= 1
              ? NotificationPriority.CRITICAL
              : NotificationPriority.HIGH,
          title: `Upcoming Payment: ${bill.merchant} (${bill.currency} ${bill.amount})`,
          message: messageText,
          actionUrl: '/subscriptions',
          metadata: {
            billId: bill.id,
            merchant: bill.merchant,
            amount: bill.amount,
            dueDate: bill.dueDate,
            dueDateIso,
            urgency: bill.urgency,
          },
        });

        emitToUser(userId, 'notification:new', notif);
        createdCount++;
      }
    }

    return { triggeredReminders: createdCount, totalUpcomingBills: bills.length };
  }
}
