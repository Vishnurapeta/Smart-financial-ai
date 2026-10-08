import {
  NotificationChannel,
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
} from '../../../models/notification.model.js';

export interface DeliveryPayload {
  notificationId: string;
  userId: string;
  userEmail?: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  actionUrl?: string;
  htmlBody?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface ChannelDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  recipient?: string;
  deliveredAt?: Date;
}

export interface IDeliveryChannel {
  readonly channelName: NotificationChannel;
  send(payload: DeliveryPayload): Promise<ChannelDeliveryResult>;
}
