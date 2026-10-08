import { Types } from 'mongoose';
import {
  IDeliveryChannel,
  DeliveryPayload,
  ChannelDeliveryResult,
} from './channel.interface.js';
import {
  NotificationChannel,
  Notification,
  NotificationStatus,
} from '../../../models/notification.model.js';
import {
  NotificationDelivery,
  DeliveryStatus,
} from '../../../models/notification-delivery.model.js';
import { logger } from '../../../utils/logger.js';

export class InAppChannel implements IDeliveryChannel {
  public readonly channelName = NotificationChannel.IN_APP;

  public async send(payload: DeliveryPayload): Promise<ChannelDeliveryResult> {
    const now = new Date();
    try {
      if (Types.ObjectId.isValid(payload.notificationId)) {
        await Notification.updateOne(
          { _id: new Types.ObjectId(payload.notificationId) },
          { $set: { status: NotificationStatus.DELIVERED } },
        );
      }

      // Record delivery audit
      await NotificationDelivery.create({
        notificationId: new Types.ObjectId(payload.notificationId),
        userId: new Types.ObjectId(payload.userId),
        channel: NotificationChannel.IN_APP,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: now,
        attemptCount: 1,
      });

      logger.debug(
        { notificationId: payload.notificationId, userId: payload.userId },
        '[InAppChannel] In-app notification delivered successfully',
      );

      return {
        channel: NotificationChannel.IN_APP,
        success: true,
        deliveredAt: now,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(
        { error: error.message, notificationId: payload.notificationId },
        '[InAppChannel] In-app delivery failed',
      );

      try {
        await NotificationDelivery.create({
          notificationId: new Types.ObjectId(payload.notificationId),
          userId: new Types.ObjectId(payload.userId),
          channel: NotificationChannel.IN_APP,
          status: DeliveryStatus.FAILED,
          error: error.message,
          failedAt: now,
          attemptCount: 1,
        });
      } catch {
        // Ignore audit failure
      }

      return {
        channel: NotificationChannel.IN_APP,
        success: false,
        error: error.message,
      };
    }
  }
}

export const inAppChannel = new InAppChannel();
