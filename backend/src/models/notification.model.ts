import { Schema, model, Document, Types } from 'mongoose';

export enum NotificationType {
  BUDGET_THRESHOLD = 'BUDGET_THRESHOLD',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  RECURRING_PAYMENT_DUE = 'RECURRING_PAYMENT_DUE',
  SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  STOCK_ALERT = 'STOCK_ALERT',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
  BILL_DUE = 'BILL_DUE',
  GOAL_MILESTONE = 'GOAL_MILESTONE',
  SYSTEM = 'SYSTEM',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ALERT = 'ALERT',
  CRITICAL = 'CRITICAL',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SOCKET = 'SOCKET',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
  DISMISSED = 'DISMISSED',
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: NotificationStatus;
  isRead: boolean;
  readAt?: Date;
  isDismissed: boolean;
  dismissedAt?: Date;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
  expiresAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.SYSTEM,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(NotificationSeverity),
      default: NotificationSeverity.INFO,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
      index: true,
    },
    channels: {
      type: [String],
      enum: Object.values(NotificationChannel),
      default: [NotificationChannel.IN_APP, NotificationChannel.SOCKET],
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    isDismissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    dismissedAt: {
      type: Date,
    },
    actionUrl: {
      type: String,
      trim: true,
      default: '',
    },
    entityType: {
      type: String,
      trim: true,
      index: true,
    },
    entityId: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    dedupKey: {
      type: String,
      trim: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
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

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isDismissed: 1, isDeleted: 1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, dedupKey: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
