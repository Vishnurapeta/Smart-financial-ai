import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { cacheService } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { channelDispatcher } from '../services/notification/channels/channel-dispatcher.service.js';
import {
  NotificationChannel,
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
} from '../models/notification.model.js';
import { DeliveryPayload } from '../services/notification/channels/channel.interface.js';

export const NOTIFICATION_QUEUE_NAME = 'notification-dispatch';
export const EMAIL_QUEUE_NAME = 'notification-email';
export const NOTIFICATION_SCHEDULER_QUEUE_NAME = 'notification-scheduler';

export interface NotificationJobData {
  notificationId: string;
  userId: string;
  userEmail?: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  actionUrl?: string;
  htmlBody?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface EmailJobData {
  notificationId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
}

export interface SchedulerJobData {
  task: 'evaluate-recurring' | 'evaluate-subscriptions' | 'generate-monthly-reports';
  timestamp: number;
}

let notificationQueue: Queue<NotificationJobData> | null = null;
let notificationWorker: Worker<NotificationJobData> | null = null;

let emailQueue: Queue<EmailJobData> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;

let schedulerQueue: Queue<SchedulerJobData> | null = null;

export function getNotificationQueues() {
  return { notificationQueue, emailQueue, schedulerQueue, notificationWorker, emailWorker };
}

export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  tls: env.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  retryStrategy: (times: number) => {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 1000, 3000);
  },
};

/**
 * Initialize all BullMQ queues and workers for enterprise notifications
 */
export function initNotificationQueues(): {
  notificationQueue: Queue<NotificationJobData> | null;
  emailQueue: Queue<EmailJobData> | null;
  schedulerQueue: Queue<SchedulerJobData> | null;
} {
  if (notificationQueue && notificationWorker) {
    return { notificationQueue, emailQueue, schedulerQueue };
  }

  if (!cacheService.isHealthy()) {
    logger.debug('[BullMQ] Redis is offline; deferring notification queue initialization to direct fallback');
    return { notificationQueue: null, emailQueue: null, schedulerQueue: null };
  }

  try {
    // 1. Main Notification Queue & Worker
    notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });

    notificationWorker = new Worker<NotificationJobData>(
      NOTIFICATION_QUEUE_NAME,
      async (job: Job<NotificationJobData>) => {
        logger.info(
          { jobId: job.id, notificationId: job.data.notificationId, userId: job.data.userId },
          '[BullMQ Notification Worker] Processing notification dispatch job',
        );

        const payload: DeliveryPayload = {
          notificationId: job.data.notificationId,
          userId: job.data.userId,
          userEmail: job.data.userEmail,
          title: job.data.title,
          message: job.data.message,
          type: job.data.type,
          severity: job.data.severity,
          priority: job.data.priority,
          actionUrl: job.data.actionUrl,
          htmlBody: job.data.htmlBody,
          metadata: job.data.metadata,
          createdAt: job.data.createdAt ? new Date(job.data.createdAt) : new Date(),
        };

        const results = await channelDispatcher.dispatch(job.data.channels, payload);
        return results;
      },
      {
        connection: redisConnection,
        concurrency: 5,
      },
    );

    notificationWorker.on('completed', (job) => {
      logger.debug({ jobId: job.id }, '[BullMQ Notification Worker] Job completed');
    });

    notificationWorker.on('failed', (job, err) => {
      logger.warn(
        { jobId: job?.id, error: err.message },
        '[BullMQ Notification Worker] Job failed after attempts',
      );
    });

    notificationWorker.on('error', (err) => {
      logger.debug({ error: err.message }, '[BullMQ Notification Worker] Worker connection error (Redis offline)');
    });

    notificationQueue.on('error', (err) => {
      logger.debug({ error: err.message }, '[BullMQ Notification Queue] Queue connection error (Redis offline)');
    });

    logger.info('[BullMQ] Notification queue and worker initialized successfully');
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn({ error: error.message }, '[BullMQ] Failed to initialize notification queue; using direct dispatch fallback');
    notificationQueue = null;
    notificationWorker = null;
  }

  return { notificationQueue, emailQueue, schedulerQueue };
}

/**
 * Enqueue notification for async multi-channel dispatch with optional delay (e.g. for quiet hours)
 * Falls back to direct synchronous execution if BullMQ or Redis is unavailable.
 */
export async function enqueueNotification(
  data: NotificationJobData,
  delayMs = 0,
): Promise<{ enqueued: boolean; jobId?: string }> {
  if (notificationQueue && cacheService.isHealthy()) {
    try {
      const job = await notificationQueue.add(
        'dispatch-notification',
        data,
        {
          delay: delayMs > 0 ? delayMs : undefined,
          priority: data.severity === NotificationSeverity.CRITICAL ? 1 : 2,
        },
      );
      return { enqueued: true, jobId: job.id };
    } catch (err: unknown) {
      const error = err as Error;
      logger.debug({ error: error.message }, '[BullMQ] Enqueue failed; executing direct dispatch fallback');
    }
  }

  // Resilient fallback: direct execution if BullMQ/Redis is offline
  const payload: DeliveryPayload = {
    notificationId: data.notificationId,
    userId: data.userId,
    userEmail: data.userEmail,
    title: data.title,
    message: data.message,
    type: data.type,
    severity: data.severity,
    priority: data.priority,
    actionUrl: data.actionUrl,
    htmlBody: data.htmlBody,
    metadata: data.metadata,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
  };

  await channelDispatcher.dispatch(data.channels, payload);
  return { enqueued: false };
}

/**
 * Gracefully close notification queues and workers
 */
export async function closeNotificationQueues(): Promise<void> {
  if (notificationWorker) {
    try {
      await notificationWorker.close();
    } catch {}
    notificationWorker = null;
  }
  if (notificationQueue) {
    try {
      await notificationQueue.close();
    } catch {}
    notificationQueue = null;
  }
  if (emailWorker) {
    try {
      await emailWorker.close();
    } catch {}
    emailWorker = null;
  }
  if (emailQueue) {
    try {
      await emailQueue.close();
    } catch {}
    emailQueue = null;
  }
}
