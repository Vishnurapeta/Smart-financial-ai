/**
 * Conversation Model
 * Stores chat history for the AI Financial Assistant.
 * Each conversation has a list of messages (user + assistant turns).
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  /** Tool calls made during this turn (assistant role only) */
  toolCalls?: Array<{
    toolName: string;
    params: Record<string, unknown>;
    success: boolean;
    dataSnapshot?: unknown;
  }>;
  /** Detected intent for user messages */
  intent?: string;
  /** Whether this assistant response was grounded by tool data */
  isGrounded?: boolean;
}

export interface IConversation extends Document {
  userId: Types.ObjectId;
  title: string;
  messages: IConversationMessage[];
  lastActivityAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    timestamp: { type: Date, default: Date.now },
    toolCalls: [
      {
        toolName: String,
        params: Schema.Types.Mixed,
        success: Boolean,
        dataSnapshot: Schema.Types.Mixed,
      },
    ],
    intent: String,
    isGrounded: { type: Boolean, default: false },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New Conversation', maxlength: 200 },
    messages: { type: [ConversationMessageSchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'ai_conversations',
  },
);

// Index for efficient user conversation listing
ConversationSchema.index({ userId: 1, lastActivityAt: -1, isDeleted: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
