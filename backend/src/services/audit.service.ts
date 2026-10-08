import { Types } from 'mongoose';
import { AuditLog, AuditStatus, IAuditLogChanges, IAuditLog } from '../models/audit-log.model.js';
import { logger } from '../utils/logger.js';

export interface CreateAuditLogParams {
  userId?: string | Types.ObjectId;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: IAuditLogChanges;
  status?: AuditStatus;
  failureReason?: string;
}

export interface AuditLogFilter {
  page?: number;
  limit?: number;
  action?: string;
  actorRole?: string;
  status?: AuditStatus | string;
  resource?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export class AuditService {
  /**
   * Record an immutable audit log entry asynchronously
   */
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await AuditLog.create({
        userId: params.userId ? new Types.ObjectId(params.userId.toString()) : undefined,
        actorRole: params.actorRole || 'ANONYMOUS',
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'Unknown',
        changes: params.changes,
        status: params.status || AuditStatus.SUCCESS,
        failureReason: params.failureReason,
        timestamp: new Date(),
      });
    } catch (error) {
      // Audit log failures should be alerted but must not break the user flow
      logger.error({ error, params }, 'Failed to create audit log entry');
    }
  }

  /**
   * Query immutable audit trail with comprehensive filtering and pagination
   */
  static async listLogs(filter: AuditLogFilter): Promise<{
    logs: IAuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 50));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filter.action) {
      query.action = filter.action;
    }
    if (filter.actorRole) {
      query.actorRole = filter.actorRole;
    }
    if (filter.status && Object.values(AuditStatus).includes(filter.status as AuditStatus)) {
      query.status = filter.status;
    }
    if (filter.resource) {
      query.resource = filter.resource;
    }
    if (filter.userId && Types.ObjectId.isValid(filter.userId)) {
      query.userId = new Types.ObjectId(filter.userId);
    }

    if (filter.startDate || filter.endDate) {
      const dateQuery: Record<string, Date> = {};
      if (filter.startDate) {
        dateQuery.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        dateQuery.$lte = new Date(filter.endDate);
      }
      query.timestamp = dateQuery;
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { action: searchRegex },
        { resource: searchRegex },
        { ipAddress: searchRegex },
        { failureReason: searchRegex },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs: logs as unknown as IAuditLog[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Aggregate statistics about audit events
   */
  static async getAuditStats(): Promise<{
    totalLogs: number;
    successCount: number;
    failureCount: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const [total, successCount, failureCount, topActionsAgg] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ status: AuditStatus.SUCCESS }),
      AuditLog.countDocuments({ status: AuditStatus.FAILURE }),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    return {
      totalLogs: total,
      successCount,
      failureCount,
      topActions: topActionsAgg.map((item) => ({
        action: item._id,
        count: item.count,
      })),
    };
  }
}
