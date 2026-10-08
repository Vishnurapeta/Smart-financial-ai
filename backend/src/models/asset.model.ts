import { Schema, model, Document, Types } from 'mongoose';

export enum AssetType {
  CASH = 'CASH',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  INVESTMENT = 'INVESTMENT',
  REAL_ESTATE = 'REAL_ESTATE',
  CRYPTO = 'CRYPTO',
  VEHICLE = 'VEHICLE',
  PRECIOUS_METALS = 'PRECIOUS_METALS',
  OTHER = 'OTHER',
}

export interface IAsset extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  type: AssetType;
  institutionName?: string;
  accountNumberMasked?: string;
  currentValue: number;
  currency: string;
  appreciationRateAnnual?: number;
  isLiquid: boolean;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: Object.values(AssetType),
      required: [true, 'Asset type is required'],
      index: true,
    },
    institutionName: {
      type: String,
      trim: true,
    },
    accountNumberMasked: {
      type: String,
      trim: true,
    },
    currentValue: {
      type: Number,
      required: [true, 'Current value is required'],
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
    appreciationRateAnnual: {
      type: Number,
      default: 0,
    },
    isLiquid: {
      type: Boolean,
      default: true,
      index: true,
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

assetSchema.index({ userId: 1, type: 1, isDeleted: 1 });

export const Asset = model<IAsset>('Asset', assetSchema);
