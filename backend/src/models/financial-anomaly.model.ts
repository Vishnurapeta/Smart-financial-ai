import { Schema, model, Document, Types } from 'mongoose';

export enum AnomalyType {
  AMOUNT_ANOMALY = 'AMOUNT_ANOMALY',
  CATEGORY_ANOMALY = 'CATEGORY_ANOMALY',
  MERCHANT_ANOMALY = 'MERCHANT_ANOMALY',
  FREQUENCY_ANOMALY = 'FREQUENCY_ANOMALY',
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum AnomalyStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  CONFIRMED_UNUSUAL = 'CONFIRMED_UNUSUAL',
  RESOLVED = 'RESOLVED',
}

export enum AnomalyFeedbackType {
  EXPECTED = 'EXPECTED',
  UNUSUAL = 'UNUSUAL',
  DISMISSED = 'DISMISSED',
}

export interface IContributingFeature {
  feature: string;
  value: number;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface ITransactionDetailsSnapshot {
  date: Date;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
}

export interface IUserFeedbackRecord {
  feedbackType: AnomalyFeedbackType;
  timestamp: Date;
  notes?: string;
}

export interface IFinancialAnomaly extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  transactionId: Types.ObjectId;
  anomalyType: AnomalyType;
  anomalyScore: number;
  severity: AnomalySeverity;
  reason: string;
  contributingFeatures: IContributingFeature[];
  detectorType: 'STATISTICAL' | 'ISOLATION_FOREST' | 'ENSEMBLE';
  detectorMetadata?: {
    detectorName?: string;
    version?: string;
    featureVersion?: string;
  };
  status: AnomalyStatus;
  userFeedback?: IUserFeedbackRecord;
  transactionDetails: ITransactionDetailsSnapshot;
  notified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const financialAnomalySchema = new Schema<IFinancialAnomaly>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'Transaction reference is required'],
      index: true,
    },
    anomalyType: {
      type: String,
      enum: Object.values(AnomalyType),
      required: [true, 'Anomaly type is required'],
      index: true,
    },
    anomalyScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
    },
    severity: {
      type: String,
      enum: Object.values(AnomalySeverity),
      required: true,
      default: AnomalySeverity.LOW,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    contributingFeatures: [
      {
        feature: { type: String, required: true },
        value: { type: Number, required: true },
        impact: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        description: { type: String, required: true },
      },
    ],
    detectorType: {
      type: String,
      enum: ['STATISTICAL', 'ISOLATION_FOREST', 'ENSEMBLE'],
      default: 'ENSEMBLE',
    },
    detectorMetadata: {
      detectorName: { type: String },
      version: { type: String },
      featureVersion: { type: String },
    },
    status: {
      type: String,
      enum: Object.values(AnomalyStatus),
      default: AnomalyStatus.NEW,
      index: true,
    },
    userFeedback: {
      feedbackType: {
        type: String,
        enum: Object.values(AnomalyFeedbackType),
      },
      timestamp: { type: Date },
      notes: { type: String, trim: true },
    },
    transactionDetails: {
      date: { type: Date, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      merchant: { type: String, required: true },
      category: { type: String, required: true },
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound unique index ensuring idempotency: user cannot have duplicate anomaly records for the same transaction
financialAnomalySchema.index({ userId: 1, transactionId: 1 }, { unique: true });
financialAnomalySchema.index({ userId: 1, status: 1, createdAt: -1 });
financialAnomalySchema.index({ userId: 1, severity: 1, createdAt: -1 });

export const FinancialAnomaly = model<IFinancialAnomaly>(
  'FinancialAnomaly',
  financialAnomalySchema,
);
