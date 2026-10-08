import { Types } from 'mongoose';
import {
  IDeliveryChannel,
  DeliveryPayload,
  ChannelDeliveryResult,
} from './channel.interface.js';
import { NotificationChannel } from '../../../models/notification.model.js';
import {
  NotificationDelivery,
  DeliveryStatus,
} from '../../../models/notification-delivery.model.js';
import { emitToUser } from '../../../config/socket.js';
import { Notification } from '../../../models/notification.model.js';
import { logger } from '../../../utils/logger.js';

export class SocketChannel implements IDeliveryChannel {
  public readonly channelName = NotificationChannel.SOCKET;

  public async send(payload: DeliveryPayload): Promise<ChannelDeliveryResult> {
    const now = new Date();
    try {
      // 1. Emit the notification payload to the user room
      const emitted = emitToUser(payload.userId, 'notification:received', {
        id: payload.notificationId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        severity: payload.severity,
        priority: payload.priority,
        actionUrl: payload.actionUrl,
        metadata: payload.metadata,
        createdAt: payload.createdAt || now,
        isRead: false,
      });

      // 2. Fetch and emit updated unread count
      try {
        const unreadCount = await Notification.countDocuments({
          userId: new Types.ObjectId(payload.userId),
          isRead: false,
          isDeleted: false,
        });
        emitToUser(payload.userId, 'notification:unread_count', { unreadCount });
      } catch (err: unknown) {
        logger.debug({ err }, '[SocketChannel] Failed to compute unread count for socket update');
      }

      // 3. Record delivery audit
      await NotificationDelivery.create({
        notificationId: new Types.ObjectId(payload.notificationId),
        userId: new Types.ObjectId(payload.userId),
        channel: NotificationChannel.SOCKET,
        status: DeliveryStatus.DELIVERED,
        recipient: `user:${payload.userId}`,
        deliveredAt: now,
        attemptCount: 1,
      });

      logger.debug(
        { notificationId: payload.notificationId, userId: payload.userId, emitted },
        '[SocketChannel] WebSocket notification delivered to user room',
      );

      return {
        channel: NotificationChannel.SOCKET,
        success: true,
        recipient: `user:${payload.userId}`,
        deliveredAt: now,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn(
        { error: error.message, notificationId: payload.notificationId },
        '[SocketChannel] Socket delivery error',
      );

      try {
        await NotificationDelivery.create({
          notificationId: new Types.ObjectId(payload.notificationId),
          userId: new Types.ObjectId(payload.userId),
          channel: NotificationChannel.SOCKET,
          status: DeliveryStatus.FAILED,
          error: error.message,
          failedAt: now,
          attemptCount: 1,
        });
      } catch {
        // Ignore audit logging error
      }

      return {
        channel: NotificationChannel.SOCKET,
        success: false,
        error: error.message,
      };
    }
  }
}

export const socketChannel = new SocketChannel();
