import { Schema, model, Document, Types } from 'mongoose';
import { NotificationChannel } from './notification.model.js';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface INotificationDelivery extends Document {
  _id: Types.ObjectId;
  notificationId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: NotificationChannel;
  status: DeliveryStatus;
  recipient?: string; // email address, socket session ID, etc.
  error?: string;
  attemptCount: number;
  metadata?: Record<string, unknown>;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.PENDING,
      index: true,
    },
    recipient: {
      type: String,
      trim: true,
    },
    error: {
      type: String,
      trim: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationDeliverySchema.index({ notificationId: 1, channel: 1 });
notificationDeliverySchema.index({ userId: 1, createdAt: -1 });

export const NotificationDelivery = model<INotificationDelivery>(
  'NotificationDelivery',
  notificationDeliverySchema,
);
