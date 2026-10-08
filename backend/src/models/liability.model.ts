import { Schema, model, Document, Types } from 'mongoose';

export enum LiabilityType {
  MORTGAGE = 'MORTGAGE',
  CREDIT_CARD = 'CREDIT_CARD',
  STUDENT_LOAN = 'STUDENT_LOAN',
  AUTO_LOAN = 'AUTO_LOAN',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  OTHER = 'OTHER',
}

export interface ILiability extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  type: LiabilityType;
  lender?: string;
  principalAmount: number;
  currentBalance: number;
  currency: string;
  interestRateApr: number;
  minimumPaymentMonthly: number;
  dueDayOfMonth?: number;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const liabilitySchema = new Schema<ILiability>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Liability name is required'],
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: Object.values(LiabilityType),
      required: [true, 'Liability type is required'],
      index: true,
    },
    lender: {
      type: String,
      trim: true,
    },
    principalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBalance: {
      type: Number,
      required: [true, 'Current balance is required'],
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
    interestRateApr: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumPaymentMonthly: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueDayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    notes: {
      type: String,
      default: '',
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

liabilitySchema.index({ userId: 1, type: 1, isDeleted: 1 });

export const Liability = model<ILiability>('Liability', liabilitySchema);
