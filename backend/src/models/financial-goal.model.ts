import { Schema, model, Document, Types } from 'mongoose';

export enum GoalCategory {
  EMERGENCY_FUND = 'EMERGENCY_FUND',
  RETIREMENT = 'RETIREMENT',
  HOME_PURCHASE = 'HOME_PURCHASE',
  TRAVEL = 'TRAVEL',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export enum GoalStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  ACHIEVED = 'ACHIEVED',
  ABANDONED = 'ABANDONED',
}

export interface IFinancialGoal extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: Date;
  category: GoalCategory;
  status: GoalStatus;
  autoContributeMonthly: number;
  linkedAssetId?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const financialGoalSchema = new Schema<IFinancialGoal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [1, 'Target amount must be at least 1'],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    targetDate: {
      type: Date,
      required: [true, 'Target completion date is required'],
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(GoalCategory),
      default: GoalCategory.OTHER,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(GoalStatus),
      default: GoalStatus.IN_PROGRESS,
      index: true,
    },
    autoContributeMonthly: {
      type: Number,
      default: 0,
      min: 0,
    },
    linkedAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
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

financialGoalSchema.index({ userId: 1, status: 1, targetDate: 1 });

export const FinancialGoal = model<IFinancialGoal>('FinancialGoal', financialGoalSchema);
