import { Schema, model, Document, Types } from 'mongoose';

export enum BudgetPeriod {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  CUSTOM = 'CUSTOM',
}

export interface IBudget extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  amount: number;
  spent: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  currency: string;
  notifyAt80: boolean;
  notifyAt100: boolean;
  alertSent80: boolean;
  alertSent100: boolean;
  rolloverRemaining: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
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
      required: [true, 'Category reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Budget name is required'],
      trim: true,
      maxlength: 100,
    },
    amount: {
      type: Number,
      required: [true, 'Budget limit amount is required'],
      min: [0.01, 'Budget limit must be greater than 0'],
    },
    spent: {
      type: Number,
      default: 0,
      min: 0,
    },
    period: {
      type: String,
      enum: Object.values(BudgetPeriod),
      default: BudgetPeriod.MONTHLY,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    notifyAt80: {
      type: Boolean,
      default: true,
    },
    notifyAt100: {
      type: Boolean,
      default: true,
    },
    alertSent80: {
      type: Boolean,
      default: false,
    },
    alertSent100: {
      type: Boolean,
      default: false,
    },
    rolloverRemaining: {
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

budgetSchema.index({ userId: 1, categoryId: 1, startDate: 1 });
budgetSchema.index({ userId: 1, period: 1, isDeleted: 1 });

export const Budget = model<IBudget>('Budget', budgetSchema);
