export type RecurringFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY';

export type RecurringType = 'SUBSCRIPTION' | 'EMI' | 'UTILITY' | 'EXPENSE';

export type SubscriptionBillingCycle =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY';

export type SubscriptionStatus =
  | 'UPCOMING'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'PAID'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'POSSIBLY_INACTIVE'
  | 'POSSIBLE_RECURRING';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CategoryReference {
  _id: string;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
}

export interface MatchedTransaction {
  _id: string;
  merchant: string;
  amount: number;
  date: string;
  currency?: string;
  paymentMethod?: string;
  description?: string;
  type?: string;
}

export interface RecurringExpense {
  _id: string;
  userId: string;
  merchant: string;
  normalizedMerchant?: string;
  description: string;
  expectedAmount: number;
  currency: string;
  frequency: RecurringFrequency;
  recurringType: RecurringType;
  confidence: number;
  confidenceLevel?: ConfidenceLevel;
  intervalDays?: number;
  transactionCount?: number;
  startDate: string;
  nextDueDate: string;
  lastTransactionDate?: string;
  isActive: boolean;
  isPossiblyInactive: boolean;
  inactivityEvidence?: string;
  autoDetected: boolean;
  categoryId?: CategoryReference;
  subscriptionId?: string;
  estimatedAnnualCost?: number;
  matchedTransactionIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPriceHistory {
  amount: number;
  effectiveDate: string;
}

export interface Subscription {
  _id: string;
  userId: string;
  recurringExpenseId?: string;
  name: string;
  merchant: string;
  normalizedMerchant?: string;
  planTier?: string;
  billingCycle: SubscriptionBillingCycle;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  source?: 'AI_DETECTED' | 'MANUAL';
  tier?: 'CONFIRMED' | 'POSSIBLE' | 'INACTIVE';
  transactionCount?: number;
  renewalDate: string;
  lastTransactionDate?: string;
  isPossiblyInactive: boolean;
  inactivityEvidence?: string;
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  cancellationUrl?: string;
  priceHistory: SubscriptionPriceHistory[];
  priceChangeAlert: boolean;
  categoryId?: CategoryReference;
  matchedTransactionIds?: string[] | MatchedTransaction[];
  averageIntervalDays?: number;
  estimatedAnnualCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingRenewalItem {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  renewalDate: string;
  daysRemaining: number;
  urgency?: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
}

export interface InactiveSubscriptionItem {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  renewalDate: string;
  lastTransactionDate?: string;
  inactivityEvidence: string;
}

export interface SubscriptionDashboardData {
  subscriptionCount: number;
  activeSubscriptions: number;
  possiblyInactiveSubscriptions: number;
  possibleRecurringCount?: number;
  monthlySubscriptionCost: number;
  annualizedSubscriptionCost: number;
  billingCycleDistribution: Record<string, number>;
  upcomingRenewals: UpcomingRenewalItem[];
  possiblyInactiveList: InactiveSubscriptionItem[];
  confirmedSubscriptions?: Subscription[];
  possibleRecurringExpenses?: Subscription[];
  allSubscriptions: Subscription[];
  defaultCurrency?: string;
}

export interface BillReminder {
  id: string;
  merchant: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysRemaining: number;
  type: string;
  urgency: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING';
}

export interface CreateSubscriptionDTO {
  name: string;
  merchant: string;
  planTier?: string;
  billingCycle: SubscriptionBillingCycle;
  amount: number;
  currency?: string;
  status?: SubscriptionStatus;
  renewalDate: string;
  categoryId?: string;
  cancellationUrl?: string;
}

export interface UpdateSubscriptionDTO extends Partial<CreateSubscriptionDTO> {
  isPossiblyInactive?: boolean;
}
