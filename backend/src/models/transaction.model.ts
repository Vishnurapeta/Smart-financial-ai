import { Schema, model, Document, Types } from 'mongoose';

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
  OTHER = 'OTHER',
}

export enum TransactionSource {
  MANUAL = 'MANUAL',
  CSV_IMPORT = 'CSV_IMPORT',
  PLAID_SYNC = 'PLAID_SYNC',
  API = 'API',
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: TransactionType;
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  category: Types.ObjectId;
  subcategory?: string;
  date: Date;
  paymentMethod: PaymentMethod;
  isRecurring: boolean;
  recurringExpenseId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  source: TransactionSource;
  assetId?: Types.ObjectId;
  destinationAssetId?: Types.ObjectId;
  deduplicationHash?: string;
  notes?: string;
  attachments: string[];
  metadata?: Record<string, unknown>;
  tags: string[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
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
    merchant: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
      index: true,
    },
    subcategory: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.DEBIT_CARD,
    },
    isRecurring: {
      type: Boolean,
      default: false,
      index: true,
    },
    recurringExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'RecurringExpense',
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(TransactionSource),
      default: TransactionSource.MANUAL,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      index: true,
    },
    destinationAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
    },
    deduplicationHash: {
      type: String,
      sparse: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: {
      type: [String],
      default: [],
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

// Compound indexes optimized for active transaction filtering and chronological sorting
transactionSchema.index({ userId: 1, isDeleted: 1, date: -1 });
transactionSchema.index({ userId: 1, isDeleted: 1, category: 1, date: -1 });
transactionSchema.index({ userId: 1, isDeleted: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, isDeleted: 1, merchant: 1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
