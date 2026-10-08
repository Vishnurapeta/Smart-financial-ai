import { Schema, model, Types } from 'mongoose';

export enum PredictionHorizon {
  ONE_DAY = '1D',
  FIVE_DAYS = '5D',
  TEN_DAYS = '10D',
  THIRTY_DAYS = '30D',
  NINETY_DAYS = '90D',
}

export enum PredictionStatus {
  PENDING_EVALUATION = 'PENDING_EVALUATION',
  EVALUATED = 'EVALUATED',
  EXPIRED = 'EXPIRED',
}

export interface IPredictionEvaluationMetrics {
  mape?: number;
  mae?: number;
  rmse?: number;
  confidenceScore?: number;
  directionAccuracy?: number;
}

export interface IStockPrediction {
  _id?: Types.ObjectId;
  symbol: string;
  model: string;
  predictionHorizon: PredictionHorizon;
  predictionTimestamp: Date;
  predictedValue: number;
  predictedReturn: number;
  modelVersion: string;
  evaluationMetrics: IPredictionEvaluationMetrics;
  featureVersion: string;
  dataTimestamp: Date;
  actualValue?: number;
  actualReturn?: number;
  status: PredictionStatus;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const stockPredictionSchema = new Schema<IStockPrediction>(
  {
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    model: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
      index: true,
    },
    predictionHorizon: {
      type: String,
      enum: Object.values(PredictionHorizon),
      required: [true, 'Prediction horizon is required'],
      index: true,
    },
    predictionTimestamp: {
      type: Date,
      required: [true, 'Prediction timestamp is required'],
      default: Date.now,
      index: true,
    },
    predictedValue: {
      type: Number,
      required: [true, 'Predicted value is required'],
    },
    predictedReturn: {
      type: Number,
      required: [true, 'Predicted return is required'],
    },
    modelVersion: {
      type: String,
      required: [true, 'Model version is required'],
      trim: true,
    },
    evaluationMetrics: {
      mape: { type: Number },
      mae: { type: Number },
      rmse: { type: Number },
      confidenceScore: { type: Number, min: 0, max: 1 },
      directionAccuracy: { type: Number, min: 0, max: 1 },
    },
    featureVersion: {
      type: String,
      required: [true, 'Feature version is required'],
      trim: true,
    },
    dataTimestamp: {
      type: Date,
      required: [true, 'Data timestamp cutoff is required'],
    },
    actualValue: {
      type: Number,
    },
    actualReturn: {
      type: Number,
    },
    status: {
      type: String,
      enum: Object.values(PredictionStatus),
      default: PredictionStatus.PENDING_EVALUATION,
      index: true,
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

stockPredictionSchema.index({ symbol: 1, isDeleted: 1, predictionTimestamp: -1 });
stockPredictionSchema.index({ symbol: 1, predictionTimestamp: -1 });
stockPredictionSchema.index({ model: 1, modelVersion: 1 });
stockPredictionSchema.index({ status: 1, predictionTimestamp: 1 });

export const StockPrediction = model<IStockPrediction>('StockPrediction', stockPredictionSchema);
