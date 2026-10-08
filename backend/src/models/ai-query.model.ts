import { Schema, model, Document, Types } from 'mongoose';

export enum AIQueryIntent {
  BUDGET_INQUIRY = 'BUDGET_INQUIRY',
  EXPENSE_ANALYSIS = 'EXPENSE_ANALYSIS',
  PORTFOLIO_REVIEW = 'PORTFOLIO_REVIEW',
  MARKET_LOOKUP = 'MARKET_LOOKUP',
  GENERAL_FINANCE = 'GENERAL_FINANCE',
}

export enum AIQueryFeedback {
  UNRATED = 'UNRATED',
  HELPFUL = 'HELPFUL',
  UNHELPFUL = 'UNHELPFUL',
  INACCURATE = 'INACCURATE',
}

export interface IAIQuery extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: string;
  prompt: string;
  intent: AIQueryIntent;
  entities: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  response: string;
  tokensUsed?: number;
  latencyMs?: number;
  feedback: AIQueryFeedback;
  feedbackNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiQuerySchema = new Schema<IAIQuery>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      index: true,
    },
    prompt: {
      type: String,
      required: [true, 'Prompt text is required'],
      trim: true,
    },
    intent: {
      type: String,
      enum: Object.values(AIQueryIntent),
      default: AIQueryIntent.GENERAL_FINANCE,
      index: true,
    },
    entities: {
      type: Schema.Types.Mixed,
      default: {},
    },
    contextSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },
    response: {
      type: String,
      required: [true, 'Response text is required'],
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    feedback: {
      type: String,
      enum: Object.values(AIQueryFeedback),
      default: AIQueryFeedback.UNRATED,
    },
    feedbackNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

aiQuerySchema.index({ userId: 1, sessionId: 1, createdAt: -1 });

export const AIQuery = model<IAIQuery>('AIQuery', aiQuerySchema);
