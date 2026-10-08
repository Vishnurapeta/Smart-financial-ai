import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { cacheService } from '../config/redis.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { FinancialReport, ReportStatus, EmailDeliveryStatus } from '../models/financial-report.model.js';
import {
  reportAggregatorService,
  MonthlyReportSnapshot,
} from '../services/report/report-aggregator.service.js';
import { reportPdfService } from '../services/report/report-pdf.service.js';
import { emitToUser } from '../config/socket.js';
import { eventBus } from '../services/event-bus.service.js';
import { emailChannel } from '../services/notification/channels/email.channel.js';
import {
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
} from '../models/notification.model.js';
import { notificationTemplateService } from '../services/notification/template.service.js';
import { Types } from 'mongoose';

export const REPORT_QUEUE_NAME = 'financial-report-processing';

export interface GenerateReportJobData {
  reportId: string;
  userId: string;
  year: number;
  month: number;
  sendEmail?: boolean;
}

export interface SendReportEmailJobData {
  reportId: string;
  userId: string;
}

export type ReportJobData = GenerateReportJobData | SendReportEmailJobData;

let reportQueue: Queue<ReportJobData> | null = null;
let reportWorker: Worker<ReportJobData> | null = null;

export function getReportQueue(): Queue<ReportJobData> | null {
  return reportQueue;
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
 * Core execution engine for monthly report generation (used by BullMQ worker & direct fallback)
 */
export async function executeMonthlyReportGeneration(
  data: GenerateReportJobData,
): Promise<{ success: boolean; reportId: string; status: ReportStatus }> {
  const { reportId, userId, year, month, sendEmail } = data;
  const startTime = Date.now();

  logger.info({ reportId, userId, year, month }, '[Report Worker] Starting monthly report generation');

  // Emit real-time status update: GENERATING
  emitToUser(userId, 'report:generating', { reportId, year, month });

  try {
    await FinancialReport.updateOne(
      { _id: new Types.ObjectId(reportId) },
      { $set: { status: ReportStatus.GENERATING } },
    );

    // 1. Build immutable data snapshot from domain services
    const snapshot = await reportAggregatorService.buildMonthlySnapshot(userId, year, month);

    // 2. Generate vector PDF document
    const pdfStart = Date.now();
    const { filePath, fileSizeBytes } = await reportPdfService.generatePdf(reportId, snapshot);
    const pdfGenDuration = Date.now() - pdfStart;
    const totalDuration = Date.now() - startTime;

    // 3. Update report document in MongoDB
    await FinancialReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          status: snapshot.metadata.status,
          dataSnapshot: snapshot,
          fileReference: filePath,
          pdfSize: fileSizeBytes,
          limitations: snapshot.metadata.limitations,
          pdfGenerationDurationMs: pdfGenDuration,
          generationDurationMs: totalDuration,
          generatedAt: new Date(),
        },
      },
      { new: true },
    );

    // 4. Emit Socket.IO real-time event: READY
    emitToUser(userId, 'report:ready', {
      reportId,
      status: snapshot.metadata.status,
      periodLabel: snapshot.metadata.periodLabel,
      totalIncome: snapshot.executiveSummary.totalIncome,
      totalExpenses: snapshot.executiveSummary.totalExpenses,
      savings: snapshot.executiveSummary.savings,
    });

    // 5. Emit Domain Event Bus event for decoupled Notification System
    eventBus.emitEvent('report.generated', {
      userId,
      reportId,
      month,
      year,
      summary: snapshot.executiveSummary.keyTakeaway,
      totalIncome: snapshot.executiveSummary.totalIncome,
      totalExpense: snapshot.executiveSummary.totalExpenses,
      netSavings: snapshot.executiveSummary.savings,
    });

    // 6. If email requested, trigger email delivery
    if (sendEmail) {
      await executeReportEmailDelivery({ reportId, userId });
    }

    metricsService.recordBackgroundJob(REPORT_QUEUE_NAME, 'generate-monthly-report', 'completed', totalDuration);

    logStructuredEvent({
      level: LogLevel.INFO,
      service: 'report_worker',
      event: ObservabilityEvent.REPORT_GENERATED,
      durationMs: totalDuration,
      metadata: {
        reportId,
        year,
        month,
        status: snapshot.metadata.status,
        pdfGenerationDurationMs: pdfGenDuration,
        pdfSizeBytes: fileSizeBytes,
      },
    });

    return {
      success: true,
      reportId,
      status: snapshot.metadata.status,
    };
  } catch (err: unknown) {
    const error = err as Error;
    const durationMs = Date.now() - startTime;
    metricsService.recordBackgroundJob(REPORT_QUEUE_NAME, 'generate-monthly-report', 'failed', durationMs);

    logStructuredEvent({
      level: LogLevel.ERROR,
      service: 'report_worker',
      event: ObservabilityEvent.REPORT_GENERATION_FAILED,
      durationMs,
      metadata: {
        reportId,
        year,
        month,
        error: error.message,
      },
    });

    await FinancialReport.updateOne(
      { _id: new Types.ObjectId(reportId) },
      {
        $set: {
          status: ReportStatus.FAILED,
          errorMessage: error.message,
        },
      },
    );

    emitToUser(userId, 'report:failed', {
      reportId,
      error: error.message,
    });

    throw err;
  }
}

/**
 * Deliver report summary email using NodeMailer integration
 */
export async function executeReportEmailDelivery(
  data: SendReportEmailJobData,
): Promise<{ success: boolean }> {
  const { reportId, userId } = data;
  try {
    const report = await FinancialReport.findOne({
      _id: new Types.ObjectId(reportId),
      userId: new Types.ObjectId(userId),
    });

    if (!report || !report.dataSnapshot) {
      return { success: false };
    }

    const snapshot = report.dataSnapshot as unknown as MonthlyReportSnapshot;
    const formatted = notificationTemplateService.formatMonthlyReport({
      month: report.month,
      year: report.year,
      totalIncome: snapshot.executiveSummary?.totalIncome || 0,
      totalExpense: snapshot.executiveSummary?.totalExpenses || 0,
      netSavings: snapshot.executiveSummary?.savings || 0,
      summary: snapshot.executiveSummary?.keyTakeaway,
    });

    const result = await emailChannel.send({
      notificationId: report._id.toString(),
      userId,
      title: formatted.title,
      message: formatted.message,
      type: NotificationType.MONTHLY_REPORT,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.MEDIUM,
      actionUrl: `/reports/${reportId}`,
      htmlBody: formatted.htmlBody,
      metadata: { reportId },
    });

    const deliveryStatus = result.success ? EmailDeliveryStatus.SENT : EmailDeliveryStatus.FAILED;
    await FinancialReport.updateOne(
      { _id: new Types.ObjectId(reportId) },
      {
        $set: {
          emailDeliveryStatus: deliveryStatus,
          emailSentAt: result.success ? new Date() : undefined,
        },
      },
    );

    return { success: result.success };
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ error: error.message, reportId }, '[Report Worker] Error delivering report email');
    await FinancialReport.updateOne(
      { _id: new Types.ObjectId(reportId) },
      { $set: { emailDeliveryStatus: EmailDeliveryStatus.FAILED } },
    );
    return { success: false };
  }
}

/**
 * Initialize BullMQ Financial Report queue and worker
 */
export function initReportQueue(): {
  queue: Queue<ReportJobData> | null;
  worker: Worker<ReportJobData> | null;
} {
  if (reportQueue && reportWorker) {
    return { queue: reportQueue, worker: reportWorker };
  }

  if (!cacheService.isHealthy()) {
    logger.debug('[BullMQ] Redis is offline; deferring financial report queue initialization to direct fallback');
    return { queue: null, worker: null };
  }

  try {
    reportQueue = new Queue<ReportJobData>(REPORT_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    reportWorker = new Worker<ReportJobData>(
      REPORT_QUEUE_NAME,
      async (job: Job<ReportJobData>) => {
        logger.info({ jobId: job.id, name: job.name }, '[Report Worker] Processing BullMQ report job');

        if (job.name === 'generate-monthly-report') {
          return await executeMonthlyReportGeneration(job.data as GenerateReportJobData);
        } else if (job.name === 'send-report-email') {
          return await executeReportEmailDelivery(job.data as SendReportEmailJobData);
        }
        return { success: false, reason: 'Unknown job name' };
      },
      {
        connection: redisConnection,
        concurrency: 2,
      },
    );

    reportWorker.on('completed', (job) => {
      logger.debug({ jobId: job.id }, '[Report Worker] Job completed');
    });

    reportWorker.on('failed', (job, err) => {
      logger.warn({ jobId: job?.id, error: err.message }, '[Report Worker] Job failed');
    });

    reportWorker.on('error', (err) => {
      logger.debug({ error: err.message }, '[Report Worker] Redis connection offline; falling back to direct execution');
    });

    reportQueue.on('error', (err) => {
      logger.debug({ error: err.message }, '[Report Queue] Redis queue connection offline');
    });

    logger.info('[BullMQ] Financial report queue and worker initialized successfully');
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn({ error: error.message }, '[BullMQ] Failed to initialize report queue; utilizing direct execution fallback');
    reportQueue = null;
    reportWorker = null;
  }

  return { queue: reportQueue, worker: reportWorker };
}

/**
 * Enqueue report generation job (or fallback directly if queue/Redis is unavailable)
 */
export async function enqueueReportGeneration(
  data: GenerateReportJobData,
): Promise<{ queued: boolean; jobId?: string }> {
  // Emit queued event
  emitToUser(data.userId, 'report:queued', { reportId: data.reportId });

  if (reportQueue && cacheService.isHealthy()) {
    try {
      const job = await reportQueue.add('generate-monthly-report', data, {
        jobId: `monthly-report-${data.reportId}`,
      });
      return { queued: true, jobId: job.id };
    } catch (err: unknown) {
      const error = err as Error;
      logger.debug({ error: error.message }, '[Report Queue] BullMQ enqueue failed; executing direct generation fallback');
    }
  }

  // Resilient fallback: execute directly asynchronously without blocking HTTP caller
  executeMonthlyReportGeneration(data).catch((err) => {
    logger.error({ err }, '[Report Queue] Background fallback report generation failed');
  });

  return { queued: false };
}

/**
 * Enqueue report email job
 */
export async function enqueueReportEmail(
  data: SendReportEmailJobData,
): Promise<{ queued: boolean }> {
  if (reportQueue && cacheService.isHealthy()) {
    try {
      await reportQueue.add('send-report-email', data, {
        jobId: `send-report-email-${data.reportId}`,
      });
      return { queued: true };
    } catch {
      // Fallback to direct execution
    }
  }

  executeReportEmailDelivery(data).catch(() => {});
  return { queued: false };
}

/**
 * Close worker and queue gracefully
 */
export async function closeReportQueue(): Promise<void> {
  if (reportWorker) {
    try {
      await reportWorker.close();
    } catch {}
    reportWorker = null;
  }
  if (reportQueue) {
    try {
      await reportQueue.close();
    } catch {}
    reportQueue = null;
  }
}
