/**
 * AI Assistant Tool Registry
 *
 * Each tool maps to a validated application service method.
 * Sourced strictly from authenticated request context (userId).
 * All numbers and statistics come from trusted real database records.
 */

import { Types } from 'mongoose';
import { Transaction, TransactionType } from '../../../models/transaction.model.js';
import { Budget } from '../../../models/budget.model.js';
import { FinancialGoal, GoalStatus } from '../../../models/financial-goal.model.js';
import { Asset } from '../../../models/asset.model.js';
import { Liability } from '../../../models/liability.model.js';
import { Holding } from '../../../models/holding.model.js';
import { Subscription, SubscriptionStatus } from '../../../models/subscription.model.js';
import { Category } from '../../../models/category.model.js';
import { FinancialAnomaly } from '../../../models/financial-anomaly.model.js';
import { FinancialForecast } from '../../../models/financial-forecast.model.js';
import { logger } from '../../../utils/logger.js';

export interface ToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
}

export type PeriodKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'last_30_days'
  | 'current_month'
  | 'last_month'
  | 'month_before'
  | 'this_year'
  | 'last_year'
  | 'all_time';

export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  food: ['dining', 'restaurant', 'grocer', 'food', 'eating'],
  entertainment: ['entertainment', 'leisure', 'movie', 'cinema', 'games'],
  movies: ['entertainment', 'leisure', 'movie', 'cinema'],
  movie: ['entertainment', 'leisure', 'movie', 'cinema'],
  groceries: ['grocer', 'supermarket', 'provisions'],
  rent: ['housing', 'rent'],
  bills: ['utilities', 'bill', 'electricity', 'water', 'internet'],
  transport: ['transport', 'fuel', 'cab', 'taxi', 'uber'],
  travel: ['travel', 'vacation', 'flight', 'hotel'],
  shopping: ['shopping', 'retail', 'clothes'],
  subscriptions: ['subscription', 'software', 'saas', 'netflix'],
};

/**
 * Creates UTC Date for a given IST (Asia/Kolkata +05:30) date component
 */
function createISTDate(
  year: number,
  month: number, // 1-12
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0,
): Date {
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) - 5.5 * 60 * 60 * 1000;
  return new Date(utcMillis);
}

/**
 * Computes date range boundaries in IST (+05:30)
 */
export function buildDateRange(
  period: PeriodKey | string = 'current_month',
  customStart?: Date,
  customEnd?: Date,
): { startDate: Date; endDate: Date; periodLabel: string } {
  if (customStart && customEnd) {
    const sLabel = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(customStart);
    const eLabel = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(customEnd);
    return { startDate: customStart, endDate: customEnd, periodLabel: `${sLabel} – ${eLabel}` };
  }

  // Get current date in IST
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [yStr, mStr, dStr] = istFormatter.format(now).split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  let startDate: Date;
  let endDate: Date;
  let periodLabel: string;

  switch (period) {
    case 'today':
      startDate = createISTDate(y, m, d, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d, 23, 59, 59, 999);
      periodLabel = `Today (${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y})`;
      break;

    case 'yesterday':
      startDate = createISTDate(y, m, d - 1, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d - 1, 23, 59, 59, 999);
      periodLabel = `Yesterday (${String(d - 1).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y})`;
      break;

    case 'this_week': {
      // Find Monday of current week
      const currentDayOfWeek = new Date(Date.UTC(y, m - 1, d) - 5.5 * 3600000).getUTCDay(); // 0 is Sun, 1 is Mon
      const diffToMon = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
      startDate = createISTDate(y, m, d - diffToMon, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d, 23, 59, 59, 999);
      periodLabel = 'This Week';
      break;
    }

    case 'last_week': {
      const currentDayOfWeek = new Date(Date.UTC(y, m - 1, d) - 5.5 * 3600000).getUTCDay();
      const diffToMon = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
      startDate = createISTDate(y, m, d - diffToMon - 7, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d - diffToMon - 1, 23, 59, 59, 999);
      periodLabel = 'Last Week';
      break;
    }

    case 'last_7_days':
      startDate = createISTDate(y, m, d - 6, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d, 23, 59, 59, 999);
      periodLabel = 'Last 7 Days';
      break;

    case 'last_30_days':
      startDate = createISTDate(y, m, d - 29, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d, 23, 59, 59, 999);
      periodLabel = 'Last 30 Days';
      break;

    case 'current_month': {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      startDate = createISTDate(y, m, 1, 0, 0, 0, 0);
      endDate = createISTDate(y, m, lastDay, 23, 59, 59, 999);
      const mName = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long' }).format(new Date(Date.UTC(y, m - 1, 1)));
      periodLabel = `${mName} ${y}`;
      break;
    }

    case 'last_month': {
      let prevM = m - 1;
      let prevY = y;
      if (prevM === 0) {
        prevM = 12;
        prevY = y - 1;
      }
      const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
      startDate = createISTDate(prevY, prevM, 1, 0, 0, 0, 0);
      endDate = createISTDate(prevY, prevM, lastDay, 23, 59, 59, 999);
      const mName = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long' }).format(new Date(Date.UTC(prevY, prevM - 1, 1)));
      periodLabel = `${mName} ${prevY}`;
      break;
    }

    case 'month_before': {
      let prevM = m - 2;
      let prevY = y;
      if (prevM <= 0) {
        prevM += 12;
        prevY = y - 1;
      }
      const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
      startDate = createISTDate(prevY, prevM, 1, 0, 0, 0, 0);
      endDate = createISTDate(prevY, prevM, lastDay, 23, 59, 59, 999);
      const mName = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long' }).format(new Date(Date.UTC(prevY, prevM - 1, 1)));
      periodLabel = `${mName} ${prevY}`;
      break;
    }

    case 'this_year':
    case 'ytd':
      startDate = createISTDate(y, 1, 1, 0, 0, 0, 0);
      endDate = createISTDate(y, 12, 31, 23, 59, 59, 999);
      periodLabel = `Year ${y}`;
      break;

    case 'last_year':
      startDate = createISTDate(y - 1, 1, 1, 0, 0, 0, 0);
      endDate = createISTDate(y - 1, 12, 31, 23, 59, 59, 999);
      periodLabel = `Year ${y - 1}`;
      break;

    case 'all_time':
    default:
      startDate = createISTDate(2020, 1, 1, 0, 0, 0, 0);
      endDate = createISTDate(y, m, d, 23, 59, 59, 999);
      periodLabel = 'All Time';
      break;
  }

  return { startDate, endDate, periodLabel };
}

export class ToolRegistry {
  /**
   * 1. Get Spending Summary (Income, Expenses, Net Cash Flow, Counts)
   */
  static async getSpendingSummary(userId: string, params: { period?: PeriodKey | string; startDate?: Date; endDate?: Date }): Promise<ToolResult> {
    const toolName = 'getSpendingSummary';
    try {
      const userOid = new Types.ObjectId(userId);
      const { startDate, endDate, periodLabel } = buildDateRange(params.period, params.startDate, params.endDate);

      const transactions = await Transaction.find({
        userId: userOid,
        isDeleted: false,
        date: { $gte: startDate, $lte: endDate },
      }).populate('category', 'name').sort({ amount: -1 });

      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      let largestExpense: { amount: number; merchant: string; category: string; date: string } | null = null;

      for (const t of transactions) {
        if (t.type === TransactionType.INCOME) {
          totalIncome += t.amount;
          incomeCount++;
        } else if (t.type === TransactionType.EXPENSE) {
          totalExpense += t.amount;
          expenseCount++;
          if (!largestExpense || t.amount > largestExpense.amount) {
            largestExpense = {
              amount: t.amount,
              merchant: t.merchant || t.description || 'General',
              category: (t.category as any)?.name || 'General',
              date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(t.date)),
            };
          }
        }
      }

      totalIncome = Math.round(totalIncome * 100) / 100;
      totalExpense = Math.round(totalExpense * 100) / 100;
      const netCashFlow = Math.round((totalIncome - totalExpense) * 100) / 100;
      const savingsRate = totalIncome > 0 ? `${((netCashFlow / totalIncome) * 100).toFixed(2)}%` : 'Not Available';
      const avgExpense = expenseCount > 0 ? Math.round((totalExpense / expenseCount) * 100) / 100 : 0;

      return {
        toolName,
        success: true,
        data: {
          period: periodLabel,
          totalExpense,
          totalIncome,
          netCashFlow,
          savingsRate,
          transactionCount: transactions.length,
          expenseCount,
          incomeCount,
          averageExpense: avgExpense,
          largestExpense,
          hasData: transactions.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 2. Get Category Specific Spending (e.g. food, entertainment, rent, shopping)
   */
  static async getCategoryExpense(userId: string, params: { category: string; period?: PeriodKey | string }): Promise<ToolResult> {
    const toolName = 'getCategoryExpense';
    try {
      const userOid = new Types.ObjectId(userId);
      const { startDate, endDate, periodLabel } = buildDateRange(params.period || 'current_month');
      const catQuery = (params.category || '').toLowerCase().trim();

      // Find all categories matching term or aliases
      const allCategories = await Category.find({ isDeleted: false }).lean();
      const matchedCatIds: Types.ObjectId[] = [];
      let matchedDisplayName = params.category;

      for (const c of allCategories) {
        const cNameLower = c.name.toLowerCase();
        const cSlugLower = c.slug.toLowerCase();

        const isMatch =
          cNameLower.includes(catQuery) ||
          cSlugLower.includes(catQuery) ||
          (catQuery === 'food' && (cNameLower.includes('dining') || cNameLower.includes('restaurant') || cNameLower.includes('grocer'))) ||
          (catQuery === 'entertainment' && (cNameLower.includes('entertainment') || cNameLower.includes('leisure') || cNameLower.includes('movie'))) ||
          (catQuery === 'movies' && (cNameLower.includes('entertainment') || cNameLower.includes('leisure'))) ||
          (catQuery === 'movie' && (cNameLower.includes('entertainment') || cNameLower.includes('leisure'))) ||
          (catQuery === 'rent' && (cNameLower.includes('housing') || cNameLower.includes('rent'))) ||
          (catQuery === 'bills' && (cNameLower.includes('utilities') || cNameLower.includes('bill'))) ||
          (catQuery === 'transport' && (cNameLower.includes('transport') || cNameLower.includes('fuel'))) ||
          (catQuery === 'travel' && (cNameLower.includes('travel') || cNameLower.includes('vacation')));

        if (isMatch) {
          matchedCatIds.push(c._id);
          matchedDisplayName = c.name;
        }
      }

      if (matchedCatIds.length === 0) {
        // Fallback: match by description/merchant regex if category record not mapped
        const txDirect = await Transaction.find({
          userId: userOid,
          isDeleted: false,
          type: TransactionType.EXPENSE,
          date: { $gte: startDate, $lte: endDate },
          $or: [
            { merchant: { $regex: catQuery, $options: 'i' } },
            { description: { $regex: catQuery, $options: 'i' } },
          ],
        }).sort({ date: -1 });

        const totalSpent = txDirect.reduce((sum, t) => sum + t.amount, 0);
        return {
          toolName,
          success: true,
          data: {
            categoryName: params.category,
            period: periodLabel,
            totalSpent: Math.round(totalSpent * 100) / 100,
            transactionCount: txDirect.length,
            averageSpent: txDirect.length > 0 ? Math.round((totalSpent / txDirect.length) * 100) / 100 : 0,
            hasData: txDirect.length > 0,
            transactions: txDirect.slice(0, 10).map((t) => ({
              date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(t.date)),
              merchant: t.merchant || t.description || 'General',
              amount: t.amount,
            })),
          },
        };
      }

      // Query transactions by matched category ObjectIds
      const txs = await Transaction.find({
        userId: userOid,
        isDeleted: false,
        type: TransactionType.EXPENSE,
        category: { $in: matchedCatIds },
        date: { $gte: startDate, $lte: endDate },
      }).populate('category', 'name').sort({ date: -1 });

      const totalSpent = txs.reduce((sum, t) => sum + t.amount, 0);
      const avgSpent = txs.length > 0 ? Math.round((totalSpent / txs.length) * 100) / 100 : 0;
      const largestTx = txs.reduce((max, t) => (t.amount > (max?.amount || 0) ? t : max), txs[0] || null);

      return {
        toolName,
        success: true,
        data: {
          categoryName: matchedDisplayName,
          queryTerm: params.category,
          period: periodLabel,
          totalSpent: Math.round(totalSpent * 100) / 100,
          transactionCount: txs.length,
          averageSpent: avgSpent,
          largestTransaction: largestTx
            ? {
                amount: largestTx.amount,
                merchant: largestTx.merchant || largestTx.description || 'General',
                date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(largestTx.date)),
              }
            : null,
          hasData: txs.length > 0,
          transactions: txs.slice(0, 10).map((t) => ({
            date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(t.date)),
            merchant: t.merchant || t.description || 'General',
            amount: t.amount,
            category: (t.category as any)?.name || matchedDisplayName,
          })),
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 3. Get Spending Breakdown by Category across all categories
   */
  static async getCategoryBreakdown(userId: string, params: { period?: PeriodKey | string }): Promise<ToolResult> {
    const toolName = 'getCategoryBreakdown';
    try {
      const userOid = new Types.ObjectId(userId);
      const { startDate, endDate, periodLabel } = buildDateRange(params.period || 'current_month');

      const transactions = await Transaction.find({
        userId: userOid,
        isDeleted: false,
        type: TransactionType.EXPENSE,
        date: { $gte: startDate, $lte: endDate },
      }).populate('category', 'name');

      const catMap = new Map<string, { name: string; amount: number; count: number }>();
      let totalExpense = 0;

      for (const t of transactions) {
        const catName = (t.category as any)?.name || 'General';
        totalExpense += t.amount;
        const existing = catMap.get(catName) || { name: catName, amount: 0, count: 0 };
        existing.amount += t.amount;
        existing.count += 1;
        catMap.set(catName, existing);
      }

      totalExpense = Math.round(totalExpense * 100) / 100;
      const categories = Array.from(catMap.values())
        .map((c) => ({
          name: c.name,
          amount: Math.round(c.amount * 100) / 100,
          transactionCount: c.count,
          percentage: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        toolName,
        success: true,
        data: {
          period: periodLabel,
          totalExpense,
          categories,
          hasData: categories.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 4. Get Largest Expenses
   */
  static async getLargestExpenses(userId: string, params: { period?: PeriodKey | string; limit?: number }): Promise<ToolResult> {
    const toolName = 'getLargestExpenses';
    try {
      const userOid = new Types.ObjectId(userId);
      const { startDate, endDate, periodLabel } = buildDateRange(params.period || 'current_month');
      const limit = params.limit || 5;

      const transactions = await Transaction.find({
        userId: userOid,
        isDeleted: false,
        type: TransactionType.EXPENSE,
        date: { $gte: startDate, $lte: endDate },
      })
        .populate('category', 'name')
        .sort({ amount: -1 })
        .limit(limit);

      return {
        toolName,
        success: true,
        data: {
          period: periodLabel,
          transactions: transactions.map((t) => ({
            amount: t.amount,
            merchant: t.merchant || t.description || 'General',
            category: (t.category as any)?.name || 'General',
            date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(t.date)),
            description: t.description || '',
          })),
          hasData: transactions.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 4b. Get Transactions List (All, search, filtered, date-ranged)
   */
  static async getTransactionsList(
    userId: string,
    params: {
      limit?: number;
      period?: PeriodKey | string;
      category?: string;
      search?: string;
      minAmount?: number;
      maxAmount?: number;
      type?: 'income' | 'expense' | 'all';
    },
  ): Promise<ToolResult> {
    const toolName = 'getTransactionsList';
    try {
      const userOid = new Types.ObjectId(userId);
      const filter: Record<string, unknown> = { userId: userOid, isDeleted: false };

      // Period filter
      let periodLabel: string | undefined;
      if (params.period && params.period !== 'all_time') {
        const { startDate, endDate, periodLabel: label } = buildDateRange(params.period);
        filter.date = { $gte: startDate, $lte: endDate };
        periodLabel = label;
      }

      // Type filter
      if (params.type === 'income') filter.type = TransactionType.INCOME;
      else if (params.type === 'expense') filter.type = TransactionType.EXPENSE;

      // Amount filter
      if (params.minAmount !== undefined || params.maxAmount !== undefined) {
        const amountFilter: Record<string, number> = {};
        if (params.minAmount !== undefined) amountFilter.$gte = params.minAmount;
        if (params.maxAmount !== undefined) amountFilter.$lte = params.maxAmount;
        filter.amount = amountFilter;
      }

      // Search keyword filter (e.g. Netflix, Uber)
      if (params.search && params.search.trim()) {
        const term = params.search.trim();
        filter.$or = [
          { merchant: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { subcategory: { $regex: term, $options: 'i' } },
        ];
      }

      // Category filter
      let categoryMatchedName: string | undefined;
      if (params.category && params.category.trim()) {
        const catQuery = params.category.trim();
        const matchedCatIds: Types.ObjectId[] = [];
        const userCats = await Category.find({
          $or: [{ userId: userOid }, { isSystem: true }],
          isDeleted: false,
        }).lean();

        for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
          if (
            key.toLowerCase() === catQuery.toLowerCase() ||
            synonyms.some((s) => s.toLowerCase() === catQuery.toLowerCase())
          ) {
            for (const syn of synonyms) {
              const found = userCats.filter((c) => c.name.toLowerCase().includes(syn.toLowerCase()));
              for (const f of found) {
                if (!matchedCatIds.some((id) => id.equals(f._id))) matchedCatIds.push(f._id);
                if (!categoryMatchedName) categoryMatchedName = f.name;
              }
            }
            break;
          }
        }

        if (matchedCatIds.length > 0) {
          filter.category = { $in: matchedCatIds };
        } else {
          const found = userCats.filter((c) => c.name.toLowerCase().includes(catQuery.toLowerCase()));
          if (found.length > 0) {
            filter.category = { $in: found.map((f) => f._id) };
            categoryMatchedName = found[0].name;
          } else {
            filter.$or = [
              { merchant: { $regex: catQuery, $options: 'i' } },
              { description: { $regex: catQuery, $options: 'i' } },
            ];
          }
        }
      }

      let query = Transaction.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .populate('category', 'name icon');

      if (params.limit && params.limit > 0) {
        query = query.limit(params.limit);
      } else {
        query = query.limit(200);
      }

      const transactions = await query;

      const formattedTxs = transactions.map((tx) => {
        const catName = (tx.category as any)?.name || 'General';
        const rawPayment = tx.paymentMethod || 'OTHER';
        const paymentFormatted =
          rawPayment === 'DEBIT_CARD'
            ? 'Debit Card'
            : rawPayment === 'CREDIT_CARD'
            ? 'Credit Card'
            : rawPayment === 'BANK_TRANSFER'
            ? 'Bank Transfer'
            : rawPayment === 'CASH'
            ? 'Cash'
            : rawPayment === 'CRYPTO'
            ? 'Crypto'
            : 'Debit Card';

        const typeFormatted =
          tx.type === TransactionType.INCOME
            ? 'Income'
            : tx.type === TransactionType.EXPENSE
            ? 'Expense'
            : 'Transfer';

        const dateFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date(tx.date));

        return {
          id: tx._id.toString(),
          merchant: tx.merchant || tx.description || 'Transaction',
          amount: tx.amount,
          currency: tx.currency || 'INR',
          category: catName,
          subcategory: tx.subcategory,
          date: dateFormatted,
          type: typeFormatted,
          paymentMethod: paymentFormatted,
          description: tx.description,
        };
      });

      return {
        toolName,
        success: true,
        data: {
          count: formattedTxs.length,
          transactions: formattedTxs,
          period: periodLabel,
          category: categoryMatchedName || params.category,
          search: params.search,
          minAmount: params.minAmount,
          maxAmount: params.maxAmount,
          hasData: formattedTxs.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 5. Get Recent Transactions
   */
  static async getRecentTransactions(userId: string, params: { limit?: number; type?: 'income' | 'expense' | 'all' }): Promise<ToolResult> {
    const toolName = 'getRecentTransactions';
    try {
      const userOid = new Types.ObjectId(userId);
      const limit = Math.min(params.limit || 10, 30);
      const filter: Record<string, unknown> = { userId: userOid, isDeleted: false };
      if (params.type === 'income') filter.type = TransactionType.INCOME;
      else if (params.type === 'expense') filter.type = TransactionType.EXPENSE;

      const transactions = await Transaction.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .limit(limit)
        .populate('category', 'name');

      return {
        toolName,
        success: true,
        data: {
          count: transactions.length,
          transactions: transactions.map((tx) => ({
            id: tx._id.toString(),
            date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(tx.date)),
            amount: tx.amount,
            type: tx.type,
            merchant: tx.merchant || tx.description || 'General',
            category: (tx.category as any)?.name || 'General',
            paymentMethod: tx.paymentMethod || 'OTHER',
          })),
          hasData: transactions.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 6. Get Budget Status & Utilization
   */
  static async getBudgetStatus(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getBudgetStatus';
    try {
      const userOid = new Types.ObjectId(userId);
      const budgets = await Budget.find({ userId: userOid, isDeleted: false })
        .populate('categoryId', 'name')
        .lean();

      const enriched = await Promise.all(
        budgets.map(async (b) => {
          // Calculate spent within budget date window
          const agg = await Transaction.aggregate([
            {
              $match: {
                userId: userOid,
                isDeleted: false,
                type: TransactionType.EXPENSE,
                category: b.categoryId?._id || b.categoryId,
                date: { $gte: b.startDate, $lte: b.endDate },
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]);

          const spent = agg[0]?.total !== undefined ? agg[0].total : (b.spent || 0);
          const limit = b.amount;
          const remaining = Math.round((limit - spent) * 100) / 100;
          const utilizationPct = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;
          const status = spent > limit ? 'OVERSPENT' : utilizationPct >= 80 ? 'WARNING' : 'ON_TRACK';

          return {
            name: b.name,
            category: (b.categoryId as any)?.name || 'General',
            budgetLimit: limit,
            spent: Math.round(spent * 100) / 100,
            remaining,
            utilization: utilizationPct,
            status,
            period: b.period,
          };
        }),
      );

      const overspent = enriched.filter((b) => b.status === 'OVERSPENT');
      const warning = enriched.filter((b) => b.status === 'WARNING');
      const onTrack = enriched.filter((b) => b.status === 'ON_TRACK');

      return {
        toolName,
        success: true,
        data: {
          totalBudgets: enriched.length,
          overspentCount: overspent.length,
          warningCount: warning.length,
          onTrackCount: onTrack.length,
          totalBudgeted: enriched.reduce((s, b) => s + b.budgetLimit, 0),
          totalSpent: enriched.reduce((s, b) => s + b.spent, 0),
          budgets: enriched,
          hasData: enriched.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 7. Get Savings and Savings Rate
   */
  static async getSavingsRate(userId: string, params: { period?: PeriodKey | string }): Promise<ToolResult> {
    const toolName = 'getSavingsRate';
    try {
      const summaryRes = await ToolRegistry.getSpendingSummary(userId, params);
      if (!summaryRes.success) return summaryRes;

      const s = summaryRes.data as any;
      return {
        toolName,
        success: true,
        data: {
          period: s.period,
          income: s.totalIncome,
          expenses: s.totalExpense,
          netSavings: s.netCashFlow,
          savingsRate: s.savingsRate,
          hasData: s.hasData,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 8. Get Net Worth (Assets - Liabilities)
   */
  static async getNetWorth(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getNetWorth';
    try {
      const userOid = new Types.ObjectId(userId);
      const [assets, liabilities] = await Promise.all([
        Asset.find({ userId: userOid, isDeleted: false }).lean(),
        Liability.find({ userId: userOid, isDeleted: false }).lean(),
      ]);

      const totalAssets = assets.reduce((s, a) => s + (a.currentValue || 0), 0);
      const totalLiabilities = liabilities.reduce((s, l) => s + (l.currentBalance || 0), 0);
      const netWorth = totalAssets - totalLiabilities;
      const debtRatio = totalAssets > 0 ? Math.round((totalLiabilities / totalAssets) * 1000) / 10 : 0;

      return {
        toolName,
        success: true,
        data: {
          totalAssets: Math.round(totalAssets * 100) / 100,
          totalLiabilities: Math.round(totalLiabilities * 100) / 100,
          netWorth: Math.round(netWorth * 100) / 100,
          debtToAssetRatio: `${debtRatio}%`,
          assetsCount: assets.length,
          liabilitiesCount: liabilities.length,
          assetBreakdown: assets.map((a) => ({ name: a.name, type: a.type, value: a.currentValue })),
          liabilityBreakdown: liabilities.map((l) => ({ name: l.name, type: l.type, balance: l.currentBalance })),
          hasData: assets.length > 0 || liabilities.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 9. Get Investment Portfolio Holdings and Performance
   */
  static async getPortfolioSummary(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getPortfolioSummary';
    try {
      const userOid = new Types.ObjectId(userId);
      const holdings = await Holding.find({ userId: userOid, isDeleted: false }).lean();

      let totalInvested = 0;
      let currentMarketValue = 0;

      const items = holdings.map((h) => {
        const invested = h.totalCost || h.quantity * h.averageBuyPrice;
        const currentVal = h.currentValue || (h.currentPrice || 0) * h.quantity;
        const pnl = currentVal - invested;
        const returnPct = invested > 0 ? Math.round((pnl / invested) * 10000) / 100 : 0;

        totalInvested += invested;
        currentMarketValue += currentVal;

        return {
          symbol: h.symbol,
          quantity: h.quantity,
          buyPrice: h.averageBuyPrice,
          currentPrice: h.currentPrice,
          investedAmount: Math.round(invested * 100) / 100,
          currentValue: Math.round(currentVal * 100) / 100,
          unrealizedPnL: Math.round(pnl * 100) / 100,
          returnPercent: returnPct,
        };
      });

      const totalPnL = Math.round((currentMarketValue - totalInvested) * 100) / 100;
      const overallReturnPct = totalInvested > 0 ? Math.round((totalPnL / totalInvested) * 10000) / 100 : 0;

      return {
        toolName,
        success: true,
        data: {
          totalInvested: Math.round(totalInvested * 100) / 100,
          currentMarketValue: Math.round(currentMarketValue * 100) / 100,
          totalPnL,
          returnPercent: overallReturnPct,
          holdingsCount: holdings.length,
          holdings: items,
          hasData: holdings.length > 0,
          label: 'Current Portfolio Snapshot',
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 10. Get Financial Goals
   */
  static async getGoalProgress(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getGoalProgress';
    try {
      const userOid = new Types.ObjectId(userId);
      const goals = await FinancialGoal.find({ userId: userOid, isDeleted: false }).lean();

      const items = goals.map((g) => {
        const target = g.targetAmount;
        const current = g.currentAmount || 0;
        const remaining = Math.max(0, target - current);
        const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;
        const targetDate = g.targetDate
          ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(g.targetDate))
          : '-';

        return {
          title: g.title,
          category: g.category,
          targetAmount: target,
          currentAmount: current,
          remainingAmount: remaining,
          progress: progressPct,
          targetDate,
          status: g.status,
        };
      });

      return {
        toolName,
        success: true,
        data: {
          totalGoals: goals.length,
          achievedGoals: goals.filter((g) => g.status === GoalStatus.ACHIEVED).length,
          goals: items,
          hasData: goals.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 11. Get Subscriptions & Recurring Outflows
   */
  static async getSubscriptions(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getSubscriptions';
    try {
      const userOid = new Types.ObjectId(userId);
      const subs = await Subscription.find({ userId: userOid, isDeleted: false }).lean();

      let totalMonthlyCost = 0;
      const items = subs.map((s) => {
        let monthly = s.amount;
        if (s.billingCycle === 'QUARTERLY') monthly = s.amount / 3;
        else if (s.billingCycle === 'ANNUALLY') monthly = s.amount / 12;

        if (s.status === SubscriptionStatus.ACTIVE) {
          totalMonthlyCost += monthly;
        }

        const renewalDate = s.renewalDate
          ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s.renewalDate))
          : '-';

        return {
          name: s.name,
          merchant: s.merchant,
          amount: s.amount,
          billingCycle: s.billingCycle,
          renewalDate,
          status: s.status,
          monthlyEquivalent: Math.round(monthly * 100) / 100,
        };
      });

      totalMonthlyCost = Math.round(totalMonthlyCost * 100) / 100;
      const annualCost = Math.round(totalMonthlyCost * 12 * 100) / 100;

      return {
        toolName,
        success: true,
        data: {
          totalSubscriptions: subs.length,
          activeSubscriptions: subs.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
          monthlyCost: totalMonthlyCost,
          annualCost,
          subscriptions: items,
          hasData: subs.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 12. Get Anomalies
   */
  static async getAnomalySummary(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getAnomalySummary';
    try {
      const userOid = new Types.ObjectId(userId);
      const anomalies = await FinancialAnomaly.find({ userId: userOid }).sort({ createdAt: -1 }).limit(10).lean();

      return {
        toolName,
        success: true,
        data: {
          totalAnomalies: anomalies.length,
          anomalies: anomalies.map((a) => {
            const snap = a.transactionDetails;
            return {
              date: a.createdAt
                ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(a.createdAt))
                : '-',
              merchant: snap?.merchant || 'Flagged Activity',
              amount: snap?.amount || 0,
              category: snap?.category || 'General',
              severity: a.severity || 'MEDIUM',
              reason: a.reason || 'Unusual deviation from normal spending baseline',
            };
          }),
          hasData: anomalies.length > 0,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 13. Get Financial Forecast
   */
  static async getLatestForecast(userId: string, _params: { type?: 'expense' | 'cashflow' }): Promise<ToolResult> {
    const toolName = 'getLatestForecast';
    try {
      const userOid = new Types.ObjectId(userId);
      const forecastDoc = await FinancialForecast.findOne({ userId: userOid }).sort({ generatedAt: -1 }).lean();

      if (!forecastDoc || !forecastDoc.forecast || forecastDoc.forecast.length === 0) {
        return {
          toolName,
          success: true,
          data: {
            hasData: false,
            message: 'No machine learning forecasts currently available. You can generate a forecast in the Financial Forecasting section.',
          },
        };
      }

      const p = forecastDoc.forecast[0];
      return {
        toolName,
        success: true,
        data: {
          hasData: true,
          modelName: forecastDoc.modelMetadata?.name || 'Seasonal Cash Flow Model',
          predictedExpense: p.predictedExpense ?? p.expectedExpenses,
          projectedCashFlow: p.projectedNetCashFlow,
          period: p.period,
          lowerBound: p.lowerBound,
          upperBound: p.upperBound,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /**
   * 14. Get Complete Financial Summary
   */
  static async getFinancialSummary(userId: string, _params: Record<string, unknown>): Promise<ToolResult> {
    const toolName = 'getFinancialSummary';
    try {
      const [spendingRes, budgetRes, netWorthRes, portfolioRes, subRes] = await Promise.all([
        ToolRegistry.getSpendingSummary(userId, { period: 'current_month' }),
        ToolRegistry.getBudgetStatus(userId, {}),
        ToolRegistry.getNetWorth(userId, {}),
        ToolRegistry.getPortfolioSummary(userId, {}),
        ToolRegistry.getSubscriptions(userId, {}),
      ]);

      const spending = spendingRes.success ? (spendingRes.data as any) : null;
      const budget = budgetRes.success ? (budgetRes.data as any) : null;
      const netWorth = netWorthRes.success ? (netWorthRes.data as any) : null;
      const portfolio = portfolioRes.success ? (portfolioRes.data as any) : null;
      const subs = subRes.success ? (subRes.data as any) : null;

      return {
        toolName,
        success: true,
        data: {
          spending,
          budget,
          netWorth,
          portfolio,
          subscriptions: subs,
        },
      };
    } catch (err) {
      logger.error({ err, toolName }, 'Tool failed');
      return { toolName, success: false, data: null, error: String(err) };
    }
  }

  /** Dispatch tool call */
  static async dispatch(toolName: string, userId: string, params: Record<string, unknown>): Promise<ToolResult> {
    const toolMap: Record<string, (u: string, p: Record<string, unknown>) => Promise<ToolResult>> = {
      getSpendingSummary: (u, p) => ToolRegistry.getSpendingSummary(u, p),
      getCategoryExpense: (u, p) => ToolRegistry.getCategoryExpense(u, p as { category: string; period?: PeriodKey | string }),
      getCategoryBreakdown: (u, p) => ToolRegistry.getCategoryBreakdown(u, p as { period?: PeriodKey | string }),
      getLargestExpenses: (u, p) => ToolRegistry.getLargestExpenses(u, p as { period?: PeriodKey | string; limit?: number }),
      getTransactionsList: (u, p) => ToolRegistry.getTransactionsList(u, p as any),
      getRecentTransactions: (u, p) => ToolRegistry.getRecentTransactions(u, p as { limit?: number; type?: 'income' | 'expense' | 'all' }),
      getBudgetStatus: (u, p) => ToolRegistry.getBudgetStatus(u, p),
      getSavingsRate: (u, p) => ToolRegistry.getSavingsRate(u, p as { period?: PeriodKey | string }),
      getNetWorth: (u, p) => ToolRegistry.getNetWorth(u, p),
      getPortfolioSummary: (u, p) => ToolRegistry.getPortfolioSummary(u, p),
      getGoalProgress: (u, p) => ToolRegistry.getGoalProgress(u, p),
      getSubscriptions: (u, p) => ToolRegistry.getSubscriptions(u, p),
      getAnomalySummary: (u, p) => ToolRegistry.getAnomalySummary(u, p),
      getLatestForecast: (u, p) => ToolRegistry.getLatestForecast(u, p as { type?: 'expense' | 'cashflow' }),
      getFinancialSummary: (u, p) => ToolRegistry.getFinancialSummary(u, p),
    };

    const tool = toolMap[toolName];
    if (!tool) {
      return { toolName, success: false, data: null, error: `Unknown tool: ${toolName}` };
    }
    return tool(userId, params);
  }
}
