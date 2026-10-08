import { Types } from 'mongoose';
import {
  IDeliveryChannel,
  DeliveryPayload,
  ChannelDeliveryResult,
} from './channel.interface.js';
import { inAppChannel } from './in-app.channel.js';
import { socketChannel } from './socket.channel.js';
import { emailChannel } from './email.channel.js';
import {
  NotificationChannel,
  Notification,
  NotificationStatus,
} from '../../../models/notification.model.js';
import { logger, logStructuredEvent } from '../../../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../../../constants/observability.constants.js';
import { metricsService } from '../../observability/metrics.service.js';

export class ChannelDispatcherService {
  private static instance: ChannelDispatcherService;
  private channels = new Map<NotificationChannel, IDeliveryChannel>();

  private constructor() {
    this.registerChannel(inAppChannel);
    this.registerChannel(socketChannel);
    this.registerChannel(emailChannel);
  }

  public static getInstance(): ChannelDispatcherService {
    if (!ChannelDispatcherService.instance) {
      ChannelDispatcherService.instance = new ChannelDispatcherService();
    }
    return ChannelDispatcherService.instance;
  }

  public registerChannel(channel: IDeliveryChannel): void {
    this.channels.set(channel.channelName, channel);
  }

  /**
   * Dispatch payload to specified channels with complete failure isolation
   */
  public async dispatch(
    targetChannels: NotificationChannel[],
    payload: DeliveryPayload,
  ): Promise<ChannelDeliveryResult[]> {
    logger.info(
      { notificationId: payload.notificationId, userId: payload.userId, channels: targetChannels },
      '[ChannelDispatcher] Initiating multi-channel dispatch',
    );

    const dispatchPromises = targetChannels.map(async (channelName) => {
      const channel = this.channels.get(channelName);
      if (!channel) {
        logger.warn({ channelName }, '[ChannelDispatcher] Channel handler not found, skipping');
        return {
          channel: channelName,
          success: false,
          error: `Channel ${channelName} not supported`,
        };
      }

      try {
        const result = await channel.send(payload);
        metricsService.recordNotification(channelName, result.success ? 'delivered' : 'failed');
        logStructuredEvent({
          level: result.success ? LogLevel.INFO : LogLevel.WARN,
          service: 'notification',
          event: result.success ? ObservabilityEvent.NOTIFICATION_SENT : ObservabilityEvent.NOTIFICATION_FAILED,
          metadata: {
            channel: channelName,
            notificationId: payload.notificationId,
            userId: payload.userId,
            success: result.success,
            error: result.error,
          },
        });
        return result;
      } catch (err: unknown) {
        const error = err as Error;
        logger.error({ error: error.message, channelName }, '[ChannelDispatcher] Unexpected channel error');
        metricsService.recordNotification(channelName, 'failed');
        logStructuredEvent({
          level: LogLevel.ERROR,
          service: 'notification',
          event: ObservabilityEvent.NOTIFICATION_FAILED,
          metadata: {
            channel: channelName,
            notificationId: payload.notificationId,
            userId: payload.userId,
            error: error.message,
          },
        });
        return {
          channel: channelName,
          success: false,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(dispatchPromises);

    const anySuccess = results.some((r) => r.success);
    const allSuccess = results.every((r) => r.success);

    // Update main notification document status
    try {
      if (Types.ObjectId.isValid(payload.notificationId)) {
        const newStatus = anySuccess ? NotificationStatus.DELIVERED : NotificationStatus.FAILED;
        await Notification.updateOne(
          { _id: new Types.ObjectId(payload.notificationId) },
          { $set: { status: newStatus } },
        );
      }
    } catch (err: unknown) {
      logger.warn({ err }, '[ChannelDispatcher] Failed to update final notification status');
    }

    logger.info(
      {
        notificationId: payload.notificationId,
        allSuccess,
        results: results.map((r) => ({ channel: r.channel, success: r.success })),
      },
      '[ChannelDispatcher] Multi-channel dispatch complete',
    );

    return results;
  }
}

export const channelDispatcher = ChannelDispatcherService.getInstance();
