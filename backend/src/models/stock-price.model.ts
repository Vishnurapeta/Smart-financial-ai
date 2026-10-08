import { Schema, model, Document } from 'mongoose';

export enum PriceTimeframe {
  INTRADAY_1M = 'INTRADAY_1M',
  INTRADAY_5M = 'INTRADAY_5M',
  INTRADAY_15M = 'INTRADAY_15M',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export interface IStockPrice extends Document {
  symbol: string;
  timestamp: Date;
  timeframe: PriceTimeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
  change?: number;
  changePercent?: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockPriceSchema = new Schema<IStockPrice>(
  {
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'Price timestamp is required'],
      index: true,
    },
    timeframe: {
      type: String,
      enum: Object.values(PriceTimeframe),
      default: PriceTimeframe.DAILY,
      index: true,
    },
    open: {
      type: Number,
      required: true,
    },
    high: {
      type: Number,
      required: true,
    },
    low: {
      type: Number,
      required: true,
    },
    close: {
      type: Number,
      required: true,
    },
    volume: {
      type: Number,
      required: true,
      default: 0,
    },
    adjustedClose: {
      type: Number,
    },
    change: {
      type: Number,
    },
    changePercent: {
      type: Number,
    },
    source: {
      type: String,
      default: 'FINNHUB',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// High efficiency compound index for time-series range queries
stockPriceSchema.index({ symbol: 1, timeframe: 1, timestamp: -1 }, { unique: true });

export const StockPrice = model<IStockPrice>('StockPrice', stockPriceSchema);
