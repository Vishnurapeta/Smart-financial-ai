import { Schema, model, Document, Types } from 'mongoose';

export enum ForecastType {
  EXPENSE = 'expense',
  CASH_FLOW = 'cash_flow',
}

export enum ForecastFrequency {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

export interface IForecastPeriodRecord {
  period: string;
  predictedExpense?: number;
  expectedIncome?: number;
  expectedExpenses?: number;
  fixedRecurringExpenses?: number;
  variableExpenses?: number;
  plannedContributions?: number;
  projectedNetCashFlow?: number;
  isDeficit?: boolean;
  lowerBound?: number;
  upperBound?: number;
  timestamp: string;
}

export interface IModelMetadataRecord {
  name: string;
  version: string;
  featureVersion: string;
  modelType: string;
  trainingPeriod: string;
  selectionReason: string;
}

export interface IForecastMetricsRecord {
  mae: number;
  rmse: number;
  mape?: number;
  r2?: number;
}

export interface IFinancialForecast extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  forecastType: ForecastType;
  frequency: ForecastFrequency;
  horizon: number;
  category?: string;
  status: 'success' | 'insufficient_data';
  actualHistoryMonths: number;
  minHistoryRequired: number;
  forecast: IForecastPeriodRecord[];
  modelMetadata?: IModelMetadataRecord;
  metrics?: IForecastMetricsRecord;
  recurringCommitmentsMonthly?: number;
  plannedContributionsMonthly?: number;
  generatedAt: Date;
  actualOutcome?: {
    actualValue?: number;
    evaluatedAt?: Date;
    error?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const financialForecastSchema = new Schema<IFinancialForecast>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    forecastType: {
      type: String,
      enum: Object.values(ForecastType),
      required: [true, 'Forecast type is required'],
      index: true,
    },
    frequency: {
      type: String,
      enum: Object.values(ForecastFrequency),
      default: ForecastFrequency.MONTHLY,
    },
    horizon: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 12,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['success', 'insufficient_data'],
      default: 'success',
    },
    actualHistoryMonths: {
      type: Number,
      default: 0,
    },
    minHistoryRequired: {
      type: Number,
      default: 3,
    },
    forecast: {
      type: [
        {
          period: { type: String, required: true },
          predictedExpense: { type: Number },
          expectedIncome: { type: Number },
          expectedExpenses: { type: Number },
          fixedRecurringExpenses: { type: Number },
          variableExpenses: { type: Number },
          plannedContributions: { type: Number },
          projectedNetCashFlow: { type: Number },
          isDeficit: { type: Boolean, default: false },
          lowerBound: { type: Number },
          upperBound: { type: Number },
          timestamp: { type: String, required: true },
        },
      ],
      default: [],
    },
    modelMetadata: {
      name: { type: String },
      version: { type: String },
      featureVersion: { type: String },
      modelType: { type: String },
      trainingPeriod: { type: String },
      selectionReason: { type: String },
    },
    metrics: {
      mae: { type: Number },
      rmse: { type: Number },
      mape: { type: Number },
      r2: { type: Number },
    },
    recurringCommitmentsMonthly: {
      type: Number,
      default: 0,
    },
    plannedContributionsMonthly: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    actualOutcome: {
      actualValue: { type: Number },
      evaluatedAt: { type: Date },
      error: { type: Number },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound indexes for fast audit and history querying
financialForecastSchema.index({ userId: 1, forecastType: 1, generatedAt: -1 });
financialForecastSchema.index({ userId: 1, generatedAt: -1 });

export const FinancialForecast = model<IFinancialForecast>(
  'FinancialForecast',
  financialForecastSchema,
);
