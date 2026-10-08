import { Schema, model, Document, Types } from 'mongoose';

export enum SubscriptionBillingCycle {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUALLY = 'SEMI_ANNUALLY',
  ANNUALLY = 'ANNUALLY',
}

export enum SubscriptionStatus {
  UPCOMING = 'UPCOMING',
  DUE_SOON = 'DUE_SOON',
  DUE_TODAY = 'DUE_TODAY',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  POSSIBLY_INACTIVE = 'POSSIBLY_INACTIVE',
  POSSIBLE_RECURRING = 'POSSIBLE_RECURRING',
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ISubscriptionPriceHistory {
  amount: number;
  effectiveDate: Date;
}

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  recurringExpenseId?: Types.ObjectId;
  name: string;
  merchant: string;
  normalizedMerchant?: string;
  categoryId?: Types.ObjectId;
  planTier?: string;
  billingCycle: SubscriptionBillingCycle;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  renewalDate: Date;
  lastTransactionDate?: Date;
  isPossiblyInactive: boolean;
  inactivityEvidence?: string;
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  source: 'AI_DETECTED' | 'MANUAL';
  tier: 'CONFIRMED' | 'POSSIBLE' | 'INACTIVE';
  transactionCount?: number;
  matchedTransactionIds: Types.ObjectId[];
  averageIntervalDays?: number;
  estimatedAnnualCost?: number;
  cancellationUrl?: string;
  priceHistory: ISubscriptionPriceHistory[];
  priceChangeAlert: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    recurringExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'RecurringExpense',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Subscription name is required'],
      trim: true,
      maxlength: 100,
    },
    merchant: {
      type: String,
      required: [true, 'Merchant is required'],
      trim: true,
      index: true,
    },
    normalizedMerchant: {
      type: String,
      trim: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    planTier: {
      type: String,
      trim: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(SubscriptionBillingCycle),
      default: SubscriptionBillingCycle.MONTHLY,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Subscription amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.ACTIVE,
      index: true,
    },
    renewalDate: {
      type: Date,
      required: [true, 'Renewal date is required'],
      index: true,
    },
    lastTransactionDate: {
      type: Date,
    },
    isPossiblyInactive: {
      type: Boolean,
      default: false,
      index: true,
    },
    inactivityEvidence: {
      type: String,
      trim: true,
    },
    confidence: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 1.0,
    },
    confidenceLevel: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
      index: true,
    },
    source: {
      type: String,
      enum: ['AI_DETECTED', 'MANUAL'],
      default: 'AI_DETECTED',
      index: true,
    },
    tier: {
      type: String,
      enum: ['CONFIRMED', 'POSSIBLE', 'INACTIVE'],
      default: 'CONFIRMED',
      index: true,
    },
    transactionCount: {
      type: Number,
      default: 1,
    },
    matchedTransactionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    averageIntervalDays: {
      type: Number,
    },
    estimatedAnnualCost: {
      type: Number,
    },
    cancellationUrl: {
      type: String,
      trim: true,
    },
    priceHistory: [
      {
        amount: { type: Number, required: true },
        effectiveDate: { type: Date, required: true },
      },
    ],
    priceChangeAlert: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

subscriptionSchema.index({ userId: 1, status: 1, renewalDate: 1 });
subscriptionSchema.index({ userId: 1, isPossiblyInactive: 1 });
subscriptionSchema.index({ userId: 1, normalizedMerchant: 1 });
subscriptionSchema.index({ userId: 1, isDeleted: 1 });

export const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
