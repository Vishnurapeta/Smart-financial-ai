import { Schema, model, Document, Types } from 'mongoose';

export interface INetWorthSnapshot extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  currency: string;
  assetBreakdown: {
    cash: number;
    bankBalance: number;
    investments: number;
    otherAssets: number;
  };
  liabilityBreakdown: {
    loans: number;
    creditCardDebt: number;
    otherLiabilities: number;
  };
  source: 'MANUAL' | 'AUTO_SCHEDULE' | 'SYSTEM';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const netWorthSnapshotSchema = new Schema<INetWorthSnapshot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Snapshot date is required'],
      index: true,
    },
    totalAssets: {
      type: Number,
      required: true,
      min: 0,
    },
    totalLiabilities: {
      type: Number,
      required: true,
      min: 0,
    },
    netWorth: {
      type: Number,
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
    assetBreakdown: {
      cash: { type: Number, default: 0, min: 0 },
      bankBalance: { type: Number, default: 0, min: 0 },
      investments: { type: Number, default: 0, min: 0 },
      otherAssets: { type: Number, default: 0, min: 0 },
    },
    liabilityBreakdown: {
      loans: { type: Number, default: 0, min: 0 },
      creditCardDebt: { type: Number, default: 0, min: 0 },
      otherLiabilities: { type: Number, default: 0, min: 0 },
    },
    source: {
      type: String,
      enum: ['MANUAL', 'AUTO_SCHEDULE', 'SYSTEM'],
      default: 'SYSTEM',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

netWorthSnapshotSchema.index({ userId: 1, date: -1 });

export const NetWorthSnapshot = model<INetWorthSnapshot>(
  'NetWorthSnapshot',
  netWorthSnapshotSchema,
);
