import { Schema, model, Document, Types } from 'mongoose';

export enum StockAlertType {
  PRICE_ABOVE = 'PRICE_ABOVE',
  PRICE_BELOW = 'PRICE_BELOW',
  PERCENT_CHANGE_UP = 'PERCENT_CHANGE_UP',
  PERCENT_CHANGE_DOWN = 'PERCENT_CHANGE_DOWN',
  VOLUME_ABOVE = 'VOLUME_ABOVE',
}

export interface IStockAlert extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  symbol: string;
  alertType: StockAlertType;
  threshold: number;
  isActive: boolean;
  isTriggered: boolean;
  lastTriggeredAt?: Date;
  triggerCount: number;
  cooldownMinutes: number;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stockAlertSchema = new Schema<IStockAlert>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    symbol: {
      type: String,
      required: [true, 'Stock symbol is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    alertType: {
      type: String,
      enum: Object.values(StockAlertType),
      required: [true, 'Alert type is required'],
      index: true,
    },
    threshold: {
      type: Number,
      required: [true, 'Alert threshold value is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isTriggered: {
      type: Boolean,
      default: false,
    },
    lastTriggeredAt: {
      type: Date,
    },
    triggerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cooldownMinutes: {
      type: Number,
      default: 60,
      min: 5, // Prevent high-frequency notification spamming
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 250,
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

stockAlertSchema.index({ userId: 1, isActive: 1, isDeleted: 1 });
stockAlertSchema.index({ symbol: 1, isActive: 1, isDeleted: 1 });

export const StockAlert = model<IStockAlert>('StockAlert', stockAlertSchema);
