import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { cacheService } from '../config/redis.js';
import { StockAlertService } from '../services/stock-alert.service.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { metricsService } from '../services/observability/metrics.service.js';

export const STOCK_ALERT_QUEUE_NAME = 'stock-alert-evaluation';

export interface StockAlertJobData {
  triggeredBy?: string;
  timestamp?: number;
  requestId?: string;
}

let stockAlertQueue: Queue<StockAlertJobData> | null = null;
let stockAlertWorker: Worker<StockAlertJobData> | null = null;

export function getStockAlertQueue(): Queue<StockAlertJobData> | null {
  return stockAlertQueue;
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
 * Initialize BullMQ Queue and Worker for stock alert evaluation
 */
export function initStockAlertQueue(): {
  queue: Queue<StockAlertJobData> | null;
  worker: Worker<StockAlertJobData> | null;
} {
  if (stockAlertQueue && stockAlertWorker) {
    return { queue: stockAlertQueue, worker: stockAlertWorker };
  }

  if (!cacheService.isHealthy()) {
    logger.debug('[BullMQ] Redis is offline; deferring stock alert queue initialization to direct fallback');
    return { queue: null, worker: null };
  }

  try {
    stockAlertQueue = new Queue<StockAlertJobData>(STOCK_ALERT_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    stockAlertWorker = new Worker<StockAlertJobData>(
      STOCK_ALERT_QUEUE_NAME,
      async (job: Job<StockAlertJobData>) => {
        const startedAt = Date.now();
        const queuedAt = job.timestamp || startedAt;
        const waitTimeMs = startedAt - queuedAt;
        const requestId = job.data?.requestId;

        logStructuredEvent({
          level: LogLevel.INFO,
          service: 'worker',
          event: ObservabilityEvent.JOB_STARTED,
          requestId,
          metadata: {
            queue: STOCK_ALERT_QUEUE_NAME,
            jobId: job.id,
            jobName: job.name,
            waitTimeMs,
            attempt: job.attemptsMade + 1,
          },
        });

        try {
          const alertService = StockAlertService.getInstance();
          const result = await alertService.evaluateAllAlerts();
          const completedAt = Date.now();
          const durationMs = completedAt - startedAt;

          metricsService.recordBackgroundJob(STOCK_ALERT_QUEUE_NAME, 'evaluate-alerts', 'completed', durationMs);

          logStructuredEvent({
            level: LogLevel.INFO,
            service: 'worker',
            event: ObservabilityEvent.JOB_COMPLETED,
            requestId,
            durationMs,
            metadata: {
              queue: STOCK_ALERT_QUEUE_NAME,
              jobId: job.id,
              jobName: job.name,
              waitTimeMs,
              totalDurationMs: completedAt - queuedAt,
              evaluated: result.totalEvaluated,
              triggered: result.totalTriggered,
            },
          });

          return result;
        } catch (err: unknown) {
          const durationMs = Date.now() - startedAt;
          metricsService.recordBackgroundJob(STOCK_ALERT_QUEUE_NAME, 'evaluate-alerts', 'failed', durationMs);

          logStructuredEvent({
            level: LogLevel.ERROR,
            service: 'worker',
            event: ObservabilityEvent.JOB_FAILED,
            requestId,
            durationMs,
            metadata: {
              queue: STOCK_ALERT_QUEUE_NAME,
              jobId: job.id,
              error: (err as Error).message,
              attempt: job.attemptsMade + 1,
            },
          });
          throw err;
        }
      },
      {
        connection: redisConnection,
        concurrency: 2,
      },
    );

    stockAlertWorker.on('completed', (job) => {
      logger.debug({ jobId: job.id }, 'Stock alert evaluation job completed successfully');
    });

    stockAlertWorker.on('failed', (job, err) => {
      logger.warn({ jobId: job?.id, err: err.message }, 'Stock alert evaluation job failed');
    });

    stockAlertWorker.on('error', (err) => {
      logger.debug({ err: err.message }, 'BullMQ worker error (Redis connection unavailable)');
    });

    stockAlertQueue.on('error', (err) => {
      logger.debug({ err: err.message }, 'BullMQ queue error (Redis connection unavailable)');
    });

    logger.info('BullMQ stock alert queue & worker initialized successfully');
  } catch (err) {
    logger.warn(
      { err },
      'Failed to initialize BullMQ stock alert queue. Background jobs will use direct fallback.',
    );
    stockAlertQueue = null;
    stockAlertWorker = null;
  }

  return { queue: stockAlertQueue, worker: stockAlertWorker };
}

/**
 * Dispatch an alert evaluation job to the BullMQ queue (or fallback directly if queue not active)
 */
export async function triggerAlertEvaluationJob(triggeredBy = 'manual-or-cron', requestId?: string): Promise<{
  queued: boolean;
  jobId?: string;
  directResult?: unknown;
}> {
  if (stockAlertQueue && cacheService.isHealthy()) {
    try {
      const job = await stockAlertQueue.add(
        'evaluate-alerts',
        { triggeredBy, timestamp: Date.now(), requestId },
        { priority: 1 },
      );

      logStructuredEvent({
        level: LogLevel.INFO,
        service: 'api',
        event: ObservabilityEvent.JOB_QUEUED,
        requestId,
        metadata: {
          queue: STOCK_ALERT_QUEUE_NAME,
          jobId: job.id,
          jobName: 'evaluate-alerts',
        },
      });

      return { queued: true, jobId: job.id };
    } catch (err) {
      logger.debug({ err }, 'BullMQ enqueue failed, executing direct alert evaluation');
    }
  }

  // Resilient fallback: direct execution if BullMQ/Redis offline
  const alertService = StockAlertService.getInstance();
  const directResult = await alertService.evaluateAllAlerts();
  return { queued: false, directResult };
}

/**
 * Gracefully close worker and queue connections
 */
export async function closeStockAlertQueue(): Promise<void> {
  if (stockAlertWorker) {
    try {
      await stockAlertWorker.close();
    } catch {
      // Ignore cleanup error
    }
    stockAlertWorker = null;
  }
  if (stockAlertQueue) {
    try {
      await stockAlertQueue.close();
    } catch {
      // Ignore cleanup error
    }
    stockAlertQueue = null;
  }
}
