import { Schema, model, Document, Types } from 'mongoose';

export enum RecurringFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUALLY = 'SEMI_ANNUALLY',
  ANNUALLY = 'ANNUALLY',
}

export enum RecurringType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  EMI = 'EMI',
  UTILITY = 'UTILITY',
  EXPENSE = 'EXPENSE',
}

export interface IRecurringExpense extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  merchant: string;
  normalizedMerchant?: string;
  description: string;
  expectedAmount: number;
  currency: string;
  frequency: RecurringFrequency;
  recurringType: RecurringType;
  confidence: number;
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: 'AI_DETECTED' | 'MANUAL';
  tier?: 'CONFIRMED' | 'POSSIBLE' | 'INACTIVE';
  intervalDays?: number;
  transactionCount?: number;
  matchedTransactionIds: Types.ObjectId[];
  estimatedAnnualCost?: number;
  startDate: Date;
  nextDueDate: Date;
  lastProcessedDate?: Date;
  lastTransactionDate?: Date;
  isActive: boolean;
  isPossiblyInactive: boolean;
  inactivityEvidence?: string;
  autoDetected: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recurringExpenseSchema = new Schema<IRecurringExpense>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    merchant: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
      index: true,
    },
    normalizedMerchant: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    expectedAmount: {
      type: Number,
      required: [true, 'Expected amount is required'],
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
    frequency: {
      type: String,
      enum: Object.values(RecurringFrequency),
      default: RecurringFrequency.MONTHLY,
      index: true,
    },
    recurringType: {
      type: String,
      enum: Object.values(RecurringType),
      default: RecurringType.EXPENSE,
      index: true,
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
    intervalDays: {
      type: Number,
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
    estimatedAnnualCost: {
      type: Number,
    },
    startDate: {
      type: Date,
      required: true,
    },
    nextDueDate: {
      type: Date,
      required: true,
      index: true,
    },
    lastProcessedDate: {
      type: Date,
    },
    lastTransactionDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
    autoDetected: {
      type: Boolean,
      default: false,
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

recurringExpenseSchema.index({ userId: 1, isActive: 1, nextDueDate: 1 });
recurringExpenseSchema.index({ userId: 1, recurringType: 1 });
recurringExpenseSchema.index({ userId: 1, normalizedMerchant: 1 });
recurringExpenseSchema.index({ userId: 1, isDeleted: 1 });

export const RecurringExpense = model<IRecurringExpense>(
  'RecurringExpense',
  recurringExpenseSchema,
);
