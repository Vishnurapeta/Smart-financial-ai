import { Request, Response, NextFunction } from 'express';
import { AdminUserService, AdminUserFilter } from '../services/admin/admin-user.service.js';
import { AdminMetricsService } from '../services/admin/admin-metrics.service.js';
import { adminTelemetryService } from '../services/admin/admin-telemetry.service.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { alertManager } from '../services/observability/alert-manager.service.js';
import { AuditService } from '../services/audit.service.js';
import { RoleName } from '../models/role.model.js';
import { UnauthorizedError } from '../utils/errors.js';

export class AdminController {
  /**
   * Platform Overview Metrics
   */
  static async getOverviewMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminMetricsService.getPlatformOverview();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * System Health Report (MongoDB, Redis, FastAPI ML, Node process memory)
   */
  static async getSystemHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminMetricsService.getSystemHealth();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Queue Monitoring & Job Counts (BullMQ)
   */
  static async getQueueMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminMetricsService.getQueueMetrics();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Subsystem Feature Metrics (ML, AI Assistant, Stock Market API, Notification Deliveries)
   */
  static async getFeatureMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [ml, aiAssistant, stockApi, notifications] = await Promise.all([
        AdminMetricsService.getMLMetrics(),
        AdminMetricsService.getAIAssistantMetrics(),
        AdminMetricsService.getStockApiMetrics(),
        AdminMetricsService.getNotificationMetrics(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          ml,
          aiAssistant,
          stockApi,
          notifications,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * API Telemetry & Error Monitoring
   */
  static async getTelemetryMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = adminTelemetryService.getSummary();
      const observabilitySnapshot = metricsService.getSnapshot();
      const activeAlerts = alertManager.getActiveAlerts();

      res.status(200).json({
        success: true,
        data: {
          ...summary,
          observabilitySnapshot,
          activeAlerts,
          activeAlertsCount: activeAlerts.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Security Posture & Incidents Telemetry
   */
  static async getSecurityMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminMetricsService.getSecurityMetrics();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List users with least privilege projection and filters
   */
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: AdminUserFilter = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        search: req.query.search as string,
        role: req.query.role as string,
        status: req.query.status as AdminUserFilter['status'],
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await AdminUserService.listUsers(filter);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user details (account metadata & aggregate counts only - No Transaction Line Items)
   */
  static async getUserDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await AdminUserService.getUserDetails(id);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user account status (SUSPEND, REACTIVATE, LOCK, UNLOCK)
   */
  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { id } = req.params;
      const { action, reason } = req.body;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const updatedUser = await AdminUserService.updateUserStatus(
        id,
        action,
        reason,
        { userId: req.user.userId, role: req.user.role },
        ip,
        userAgent,
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: updatedUser._id.toString(),
            email: updatedUser.email,
            isSuspended: updatedUser.isSuspended,
            suspendedReason: updatedUser.suspendedReason,
            lockoutUntil: updatedUser.lockoutUntil,
          },
        },
        message: `Account status successfully updated with action: ${action}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role (least privilege & role hierarchy enforced)
   */
  static async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { id } = req.params;
      const { role } = req.body;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const updatedUser = await AdminUserService.updateUserRole(
        id,
        role as RoleName,
        { userId: req.user.userId, role: req.user.role },
        ip,
        userAgent,
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: updatedUser._id.toString(),
            email: updatedUser.email,
            role: updatedUser.role,
          },
        },
        message: `User role successfully updated to ${role}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Administrative email verification trigger
   */
  static async verifyUserEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { id } = req.params;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      await AdminUserService.verifyEmail(
        id,
        { userId: req.user.userId, role: req.user.role },
        ip,
        userAgent,
      );

      res.status(200).json({
        success: true,
        message: 'User email marked as verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger administrative password reset
   */
  static async triggerPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { id } = req.params;
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await AdminUserService.triggerPasswordReset(
        id,
        { userId: req.user.userId, role: req.user.role },
        ip,
        userAgent,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Password reset initiated. Reset token generated successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Query immutable audit trail
   */
  static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await AuditService.listLogs({
        page,
        limit,
        action: req.query.action as string,
        actorRole: req.query.actorRole as string,
        status: req.query.status as string,
        resource: req.query.resource as string,
        userId: req.query.userId as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Audit statistics & incident breakdown
   */
  static async getAuditStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AuditService.getAuditStats();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
