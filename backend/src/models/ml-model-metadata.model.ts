import { Schema, model, Document } from 'mongoose';

export enum MLFramework {
  SCIKIT_LEARN = 'SCIKIT_LEARN',
  XGBOOST = 'XGBOOST',
  PYTORCH = 'PYTORCH',
  PROPHET = 'PROPHET',
  STATSMODELS = 'STATSMODELS',
}

export interface IMLModelMetadata extends Document {
  modelName: string;
  version: string;
  framework: MLFramework;
  artifactUri: string;
  artifactChecksum: string;
  features: string[];
  hyperparameters: Record<string, unknown>;
  metrics: Record<string, number>;
  trainingDatasetSize: number;
  trainedAt: Date;
  isActive: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const mlModelMetadataSchema = new Schema<IMLModelMetadata>(
  {
    modelName: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
      index: true,
    },
    version: {
      type: String,
      required: [true, 'Model semantic version is required'],
      trim: true,
    },
    framework: {
      type: String,
      enum: Object.values(MLFramework),
      required: true,
      index: true,
    },
    artifactUri: {
      type: String,
      required: [true, 'Artifact URI is required'],
    },
    artifactChecksum: {
      type: String,
      required: [true, 'Artifact SHA-256 checksum is required'],
    },
    features: {
      type: [String],
      default: [],
    },
    hyperparameters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    trainingDatasetSize: {
      type: Number,
      default: 0,
    },
    trainedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mlModelMetadataSchema.index({ modelName: 1, version: 1 }, { unique: true });

export const MLModelMetadata = model<IMLModelMetadata>('MLModelMetadata', mlModelMetadataSchema);
