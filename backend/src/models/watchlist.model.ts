import { Schema, model, Document, Types } from 'mongoose';

export interface IWatchlistSymbol {
  symbol: string;
  addedAt: Date;
  targetBuyPrice?: number;
  targetSellPrice?: number;
  notes?: string;
}

export interface IWatchlist extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description: string;
  isDefault: boolean;
  symbols: IWatchlistSymbol[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const watchlistSymbolSchema = new Schema<IWatchlistSymbol>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    targetBuyPrice: {
      type: Number,
      min: 0,
    },
    targetSellPrice: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const watchlistSchema = new Schema<IWatchlist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Watchlist name is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    symbols: {
      type: [watchlistSymbolSchema],
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

watchlistSchema.index({ userId: 1, isDeleted: 1 });
watchlistSchema.index({ 'symbols.symbol': 1 });

export const Watchlist = model<IWatchlist>('Watchlist', watchlistSchema);
