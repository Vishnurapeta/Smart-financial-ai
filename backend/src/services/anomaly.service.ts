import { Types } from 'mongoose';
import {
  FinancialAnomaly,
  AnomalyStatus,
  AnomalySeverity,
  AnomalyFeedbackType,
  IFinancialAnomaly,
} from '../models/financial-anomaly.model.js';
import { Transaction, TransactionType } from '../models/transaction.model.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { eventBus } from './event-bus.service.js';

export interface AnomalyQueryFilters {
  status?: string;
  anomalyType?: string;
  severity?: string;
  category?: string;
  merchant?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AnomalyService {
  /**
   * Prepares sanitized transaction records for anomaly detection.
   * Excludes transfers and non-positive amounts, deduplicates records.
   */
  static async prepareUserTransactions(userId: string, lookbackDays: number = 90) {
    const userObjectId = new Types.ObjectId(userId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const transactions = await Transaction.find({
      userId: userObjectId,
      isDeleted: false,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .populate('category', 'name slug');

    const seenTx = new Set<string>();
    const cleanList = [];

    for (const tx of transactions) {
      if (!tx.date || isNaN(tx.date.getTime()) || tx.amount <= 0) {
        continue;
      }
      // Exclude transfers to avoid flagging standard balance movements
      if (tx.type === TransactionType.TRANSFER) {
        continue;
      }

      const dedupeKey = `${tx.date.toISOString().slice(0, 10)}_${tx.amount}_${(tx.merchant || '').toLowerCase().trim()}`;
      if (seenTx.has(dedupeKey)) {
        continue;
      }
      seenTx.add(dedupeKey);

      const categoryName = (tx.category as any)?.name || 'Uncategorized';

      cleanList.push({
        id: tx._id.toString(),
        date: tx.date.toISOString(),
        amount: tx.amount,
        currency: tx.currency || 'USD',
        merchant: tx.merchant || 'Unknown Merchant',
        category: categoryName,
        type: tx.type || 'EXPENSE',
        is_recurring: tx.isRecurring || false,
      });
    }

    return cleanList;
  }

  /**
   * Triggers financial anomaly detection via FastAPI microservice and persists results.
   */
  static async runDetection(
    userId: string,
    options: { lookbackDays?: number; minHistoryCount?: number } = {},
  ) {
    const lookbackDays = Math.min(Math.max(7, options.lookbackDays || 90), 365);
    const minHistoryCount = Math.max(3, options.minHistoryCount || 5);

    const transactions = await this.prepareUserTransactions(userId, lookbackDays);

    if (transactions.length < minHistoryCount) {
      return {
        status: 'insufficient_data',
        message: `Insufficient transaction history for personalized anomaly detection. At least ${minHistoryCount} transactions are required.`,
        userId,
        totalEvaluated: transactions.length,
        anomaliesDetected: 0,
        anomalies: [],
      };
    }

    const payload = {
      user_id: userId,
      transactions,
      lookback_days: lookbackDays,
      min_history_count: minHistoryCount,
    };

    let detectionData: any = null;

    try {
      const response = await fetch(`${env.ML_SERVICE_URL}/api/v1/anomalies/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.ML_SERVICE_SECRET_TOKEN
            ? { Authorization: `Bearer ${env.ML_SERVICE_SECRET_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ML anomaly detection returned ${response.status}: ${errText}`);
      }

      detectionData = await response.json();
    } catch (err: any) {
      logger.error('FastAPI anomaly detection service unreachable or returned error:', err);
      throw new AppError(
        'Anomaly detection microservice is temporarily unavailable. Please try again shortly.',
        503,
      );
    }

    if (detectionData.status === 'insufficient_data') {
      return {
        status: 'insufficient_data',
        message: detectionData.message,
        userId,
        totalEvaluated: detectionData.total_evaluated || 0,
        anomaliesDetected: 0,
        anomalies: [],
      };
    }

    const userObjectId = new Types.ObjectId(userId);
    const savedAnomalies: IFinancialAnomaly[] = [];
    let notificationCount = 0;

    for (const item of detectionData.anomalies || []) {
      const txObjectId = new Types.ObjectId(item.transaction_id);

      // Upsert into FinancialAnomaly collection (idempotent, avoids duplicate records)
      const existing = await FinancialAnomaly.findOne({
        userId: userObjectId,
        transactionId: txObjectId,
      });

      if (existing) {
        // Update model scores while preserving user's feedback/status
        existing.anomalyScore = item.anomaly_score;
        existing.severity = item.severity;
        existing.reason = item.reason;
        existing.contributingFeatures = item.contributing_features || [];
        existing.detectorType = item.detector_type || 'ENSEMBLE';
        existing.detectorMetadata = {
          detectorName: detectionData.detector_metadata?.detector_name,
          version: detectionData.detector_metadata?.version,
          featureVersion: detectionData.detector_metadata?.feature_version,
        };
        await existing.save();
        savedAnomalies.push(existing);
      } else {
        const created = await FinancialAnomaly.create({
          userId: userObjectId,
          transactionId: txObjectId,
          anomalyType: item.anomaly_type,
          anomalyScore: item.anomaly_score,
          severity: item.severity,
          reason: item.reason,
          contributingFeatures: item.contributing_features || [],
          detectorType: item.detector_type || 'ENSEMBLE',
          detectorMetadata: {
            detectorName: detectionData.detector_metadata?.detector_name,
            version: detectionData.detector_metadata?.version,
            featureVersion: detectionData.detector_metadata?.feature_version,
          },
          status: AnomalyStatus.NEW,
          transactionDetails: {
            date: new Date(item.date),
            amount: item.amount,
            currency: item.currency || 'USD',
            merchant: item.merchant,
            category: item.category,
          },
          notified: false,
        });

        // Emit deduplicated notification for high/medium severity anomalies (max 3 per batch)
        if (
          !created.notified &&
          (created.severity === AnomalySeverity.HIGH || created.severity === AnomalySeverity.MEDIUM) &&
          notificationCount < 3
        ) {
          try {
            eventBus.emitEvent('anomaly.detected', {
              userId: userObjectId.toString(),
              anomalyId: created._id.toString(),
              transactionId: item.transaction_id,
              amount: created.transactionDetails.amount,
              description: created.transactionDetails.merchant,
              severity: created.severity,
              score: created.anomalyScore,
              reason: created.reason,
            });
            created.notified = true;
            await created.save();
            notificationCount++;
          } catch (notifErr: any) {
            logger.warn(`Failed to dispatch anomaly notification: ${notifErr?.message || notifErr}`);
          }
        }

        savedAnomalies.push(created);
      }
    }

    return {
      status: 'success',
      message: detectionData.message,
      userId,
      totalEvaluated: detectionData.total_evaluated,
      anomaliesDetected: savedAnomalies.length,
      anomalies: savedAnomalies,
      detectorMetadata: detectionData.detector_metadata,
    };
  }

  /**
   * Retrieves anomalies for the authenticated user with filters and pagination.
   */
  static async getAnomalies(userId: string, filters: AnomalyQueryFilters) {
    const userObjectId = new Types.ObjectId(userId);
    const query: any = { userId: userObjectId };

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.anomalyType) {
      query.anomalyType = filters.anomalyType;
    }
    if (filters.severity) {
      query.severity = filters.severity;
    }
    if (filters.category) {
      query['transactionDetails.category'] = new RegExp(filters.category, 'i');
    }
    if (filters.merchant) {
      query['transactionDetails.merchant'] = new RegExp(filters.merchant, 'i');
    }
    if (filters.startDate || filters.endDate) {
      query['transactionDetails.date'] = {};
      if (filters.startDate) {
        query['transactionDetails.date'].$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query['transactionDetails.date'].$lte = new Date(filters.endDate);
      }
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, anomalies] = await Promise.all([
      FinancialAnomaly.countDocuments(query),
      FinancialAnomaly.find(query)
        .sort({ 'transactionDetails.date': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      anomalies,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single anomaly by ID, enforcing user isolation.
   */
  static async getAnomalyById(userId: string, anomalyId: string) {
    if (!Types.ObjectId.isValid(anomalyId)) {
      throw new AppError('Invalid anomaly identifier', 400);
    }

    const anomaly = await FinancialAnomaly.findOne({
      _id: new Types.ObjectId(anomalyId),
      userId: new Types.ObjectId(userId),
    });

    if (!anomaly) {
      throw new AppError('Anomaly not found', 404);
    }

    return anomaly;
  }

  /**
   * Updates an anomaly's review status.
   */
  static async updateStatus(userId: string, anomalyId: string, newStatus: AnomalyStatus) {
    if (!Types.ObjectId.isValid(anomalyId)) {
      throw new AppError('Invalid anomaly identifier', 400);
    }

    if (!Object.values(AnomalyStatus).includes(newStatus)) {
      throw new AppError(`Invalid anomaly status: ${newStatus}`, 400);
    }

    const anomaly = await FinancialAnomaly.findOne({
      _id: new Types.ObjectId(anomalyId),
      userId: new Types.ObjectId(userId),
    });

    if (!anomaly) {
      throw new AppError('Anomaly not found', 404);
    }

    anomaly.status = newStatus;
    await anomaly.save();
    return anomaly;
  }

  /**
   * Submits user feedback on an anomaly.
   */
  static async recordFeedback(
    userId: string,
    anomalyId: string,
    feedback: { feedbackType: AnomalyFeedbackType; notes?: string },
  ) {
    if (!Types.ObjectId.isValid(anomalyId)) {
      throw new AppError('Invalid anomaly identifier', 400);
    }

    if (!Object.values(AnomalyFeedbackType).includes(feedback.feedbackType)) {
      throw new AppError(`Invalid feedback type: ${feedback.feedbackType}`, 400);
    }

    const anomaly = await FinancialAnomaly.findOne({
      _id: new Types.ObjectId(anomalyId),
      userId: new Types.ObjectId(userId),
    });

    if (!anomaly) {
      throw new AppError('Anomaly not found', 404);
    }

    anomaly.userFeedback = {
      feedbackType: feedback.feedbackType,
      timestamp: new Date(),
      notes: feedback.notes,
    };

    // Transition status appropriately based on user feedback
    if (feedback.feedbackType === AnomalyFeedbackType.UNUSUAL) {
      anomaly.status = AnomalyStatus.CONFIRMED_UNUSUAL;
    } else if (feedback.feedbackType === AnomalyFeedbackType.DISMISSED) {
      anomaly.status = AnomalyStatus.DISMISSED;
    } else if (feedback.feedbackType === AnomalyFeedbackType.EXPECTED) {
      anomaly.status = AnomalyStatus.REVIEWED;
    }

    await anomaly.save();
    return anomaly;
  }

  /**
   * Aggregates summary counts of anomalies for the user.
   */
  static async getSummary(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const counts = await FinancialAnomaly.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ['$status', AnomalyStatus.NEW] }, 1, 0] } },
          reviewed: { $sum: { $cond: [{ $eq: ['$status', AnomalyStatus.REVIEWED] }, 1, 0] } },
          dismissed: { $sum: { $cond: [{ $eq: ['$status', AnomalyStatus.DISMISSED] }, 1, 0] } },
          confirmedUnusual: {
            $sum: { $cond: [{ $eq: ['$status', AnomalyStatus.CONFIRMED_UNUSUAL] }, 1, 0] },
          },
          resolved: { $sum: { $cond: [{ $eq: ['$status', AnomalyStatus.RESOLVED] }, 1, 0] } },
          highSeverity: {
            $sum: { $cond: [{ $eq: ['$severity', AnomalySeverity.HIGH] }, 1, 0] },
          },
          mediumSeverity: {
            $sum: { $cond: [{ $eq: ['$severity', AnomalySeverity.MEDIUM] }, 1, 0] },
          },
          lowSeverity: {
            $sum: { $cond: [{ $eq: ['$severity', AnomalySeverity.LOW] }, 1, 0] },
          },
        },
      },
    ]);

    if (!counts.length) {
      return {
        total: 0,
        new: 0,
        reviewed: 0,
        dismissed: 0,
        confirmedUnusual: 0,
        resolved: 0,
        severityCounts: {
          high: 0,
          medium: 0,
          low: 0,
        },
      };
    }

    const row = counts[0];
    return {
      total: row.total,
      new: row.new,
      reviewed: row.reviewed,
      dismissed: row.dismissed,
      confirmedUnusual: row.confirmedUnusual,
      resolved: row.resolved,
      severityCounts: {
        high: row.highSeverity,
        medium: row.mediumSeverity,
        low: row.lowSeverity,
      },
    };
  }
}
