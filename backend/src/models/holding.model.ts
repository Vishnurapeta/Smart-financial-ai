import { Schema, model, Document, Types } from 'mongoose';

export enum HoldingAssetType {
  EQUITY = 'EQUITY',
  ETF = 'ETF',
  MUTUAL_FUND = 'MUTUAL_FUND',
  CRYPTO = 'CRYPTO',
  BOND = 'BOND',
  OTHER = 'OTHER',
}

export interface IHoldingLot {
  lotId: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
  fees: number;
  status: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';
}

export interface IHolding extends Document {
  _id: Types.ObjectId;
  portfolioId: Types.ObjectId;
  userId: Types.ObjectId;
  symbol: string;
  assetType: HoldingAssetType;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  lots: IHoldingLot[];
  currency: string;
  sector?: string;
  notes?: string;
  lastPriceUpdatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const holdingLotSchema = new Schema<IHoldingLot>(
  {
    lotId: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    buyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    buyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    fees: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['OPEN', 'PARTIALLY_CLOSED', 'CLOSED'],
      default: 'OPEN',
    },
  },
  { _id: false },
);

const holdingSchema = new Schema<IHolding>(
  {
    portfolioId: {
      type: Schema.Types.ObjectId,
      ref: 'Portfolio',
      required: [true, 'Portfolio reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    symbol: {
      type: String,
      required: [true, 'Stock/Asset symbol is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: Object.values(HoldingAssetType),
      default: HoldingAssetType.EQUITY,
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    averageBuyPrice: {
      type: Number,
      required: [true, 'Average buy price is required'],
      min: [0, 'Average buy price cannot be negative'],
    },
    currentPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
    },
    unrealizedPnL: {
      type: Number,
      default: 0,
    },
    unrealizedPnLPercent: {
      type: Number,
      default: 0,
    },
    realizedPnL: {
      type: Number,
      default: 0,
    },
    lots: {
      type: [holdingLotSchema],
      default: [],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    sector: {
      type: String,
      default: 'General',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    lastPriceUpdatedAt: {
      type: Date,
      default: Date.now,
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

holdingSchema.pre('save', function () {
  this.totalCost = Math.round(this.quantity * this.averageBuyPrice * 100) / 100;
  this.currentValue = Math.round(this.quantity * this.currentPrice * 100) / 100;
  this.unrealizedPnL = Math.round((this.currentValue - this.totalCost) * 100) / 100;
  if (this.totalCost > 0) {
    this.unrealizedPnLPercent =
      Math.round(((this.currentValue - this.totalCost) / this.totalCost) * 10000) / 100;
  } else {
    this.unrealizedPnLPercent = 0;
  }
});

holdingSchema.index({ portfolioId: 1, symbol: 1, isDeleted: 1 });
holdingSchema.index({ portfolioId: 1, isDeleted: 1 });
holdingSchema.index({ userId: 1, symbol: 1 });

export const Holding = model<IHolding>('Holding', holdingSchema);
