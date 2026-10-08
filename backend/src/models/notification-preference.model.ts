import { Schema, model, Document, Types } from 'mongoose';
import { NotificationType } from './notification.model.js';

export interface IChannelPreference {
  inApp: boolean;
  email: boolean;
  socket: boolean;
}

export interface IQuietHours {
  enabled: boolean;
  startTime: string; // "22:00"
  endTime: string;   // "08:00"
  timezone: string;  // e.g. "America/New_York", "UTC"
}

export interface INotificationPreference extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channels: Record<string, IChannelPreference>;
  quietHours: IQuietHours;
  emailAlerts: boolean;
  pushAlerts: boolean;
  stockAlertsEnabled: boolean;
  minCooldownMinutes: number;
  emailDailyDigest: boolean;
  emailWeeklyDigest: boolean;
  monthlyReportEmail: boolean;
  maxNotificationsPerHour: number;
  createdAt: Date;
  updatedAt: Date;
}

const channelPreferenceSchema = new Schema<IChannelPreference>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    socket: { type: Boolean, default: true },
  },
  { _id: false },
);

const quietHoursSchema = new Schema<IQuietHours>(
  {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '08:00' },
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false },
);

// Build default channels map for all notification types
export const defaultChannelPreferences: Record<string, IChannelPreference> = {
  [NotificationType.BUDGET_THRESHOLD]: { inApp: true, email: false, socket: true },
  [NotificationType.BUDGET_EXCEEDED]: { inApp: true, email: true, socket: true },
  [NotificationType.RECURRING_PAYMENT_DUE]: { inApp: true, email: true, socket: true },
  [NotificationType.SUBSCRIPTION_RENEWAL]: { inApp: true, email: true, socket: true },
  [NotificationType.ANOMALY_DETECTED]: { inApp: true, email: true, socket: true },
  [NotificationType.STOCK_ALERT]: { inApp: true, email: true, socket: true },
  [NotificationType.PORTFOLIO_UPDATE]: { inApp: true, email: false, socket: true },
  [NotificationType.MONTHLY_REPORT]: { inApp: true, email: true, socket: false },
  [NotificationType.BILL_DUE]: { inApp: true, email: true, socket: true },
  [NotificationType.GOAL_MILESTONE]: { inApp: true, email: false, socket: true },
  [NotificationType.SYSTEM]: { inApp: true, email: true, socket: true },
};

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    channels: {
      type: Map,
      of: channelPreferenceSchema,
      default: () => new Map(Object.entries(defaultChannelPreferences)),
    },
    quietHours: {
      type: quietHoursSchema,
      default: () => ({
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      }),
    },
    emailAlerts: {
      type: Boolean,
      default: true,
    },
    pushAlerts: {
      type: Boolean,
      default: true,
    },
    stockAlertsEnabled: {
      type: Boolean,
      default: true,
    },
    minCooldownMinutes: {
      type: Number,
      default: 15,
      min: 1,
    },
    emailDailyDigest: {
      type: Boolean,
      default: false,
    },
    emailWeeklyDigest: {
      type: Boolean,
      default: false,
    },
    monthlyReportEmail: {
      type: Boolean,
      default: true,
    },
    maxNotificationsPerHour: {
      type: Number,
      default: 30,
      min: 1,
      max: 200,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const NotificationPreference = model<INotificationPreference>(
  'NotificationPreference',
  notificationPreferenceSchema,
);
