import { Schema, model, Document, Types } from 'mongoose';

export interface ICategorizationFeedback extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  rawText: string;
  parsedAmount?: number;
  parsedCurrency?: string;
  parsedMerchant?: string;
  predictedCategorySlug: string;
  predictedSubcategory?: string;
  confidence: number;
  requiresConfirmation: boolean;
  userAccepted: boolean;
  correctedCategorySlug?: string;
  correctedCategoryId?: Types.ObjectId;
  transactionId?: Types.ObjectId;
  source: string;
  modelVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorizationFeedbackSchema = new Schema<ICategorizationFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    rawText: {
      type: String,
      required: [true, 'Raw text input is required'],
      trim: true,
      maxlength: 500,
    },
    parsedAmount: {
      type: Number,
    },
    parsedCurrency: {
      type: String,
      default: 'USD',
    },
    parsedMerchant: {
      type: String,
      trim: true,
    },
    predictedCategorySlug: {
      type: String,
      required: true,
      trim: true,
    },
    predictedSubcategory: {
      type: String,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    requiresConfirmation: {
      type: Boolean,
      default: false,
    },
    userAccepted: {
      type: Boolean,
      default: true,
    },
    correctedCategorySlug: {
      type: String,
      trim: true,
    },
    correctedCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    source: {
      type: String,
      default: 'ml_pipeline',
    },
    modelVersion: {
      type: String,
      default: '1.0.0',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

categorizationFeedbackSchema.index({ userId: 1, createdAt: -1 });

export const CategorizationFeedback = model<ICategorizationFeedback>(
  'CategorizationFeedback',
  categorizationFeedbackSchema,
);
