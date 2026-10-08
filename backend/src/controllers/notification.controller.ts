import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service.js';
import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
} from '../models/notification.model.js';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const type = req.query.type as NotificationType | undefined;
      const severity = req.query.severity as NotificationSeverity | undefined;
      const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
      const isDismissed =
        req.query.isDismissed !== undefined ? req.query.isDismissed === 'true' : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

      const result = await this.notificationService.getUserNotifications(userId, {
        type,
        severity,
        isRead,
        isDismissed,
        limit,
        page,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const unreadCount = await this.notificationService.getUnreadCount(userId);
      res.status(200).json({
        success: true,
        data: { unreadCount },
      });
    } catch (err) {
      next(err);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const notification = await this.notificationService.markAsRead(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const modifiedCount = await this.notificationService.markAllAsRead(userId);
      res.status(200).json({
        success: true,
        data: { message: 'All notifications marked as read', modifiedCount },
      });
    } catch (err) {
      next(err);
    }
  };

  dismissNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const notification = await this.notificationService.dismissNotification(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.notificationService.deleteNotification(userId, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  };

  getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const preferences = await this.notificationService.getPreferences(userId);

      res.status(200).json({
        success: true,
        data: {
          preferences,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updates = req.body;
      const preferences = await this.notificationService.updatePreferences(userId, updates);

      res.status(200).json({
        success: true,
        data: {
          message: 'Notification preferences updated successfully',
          preferences,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  sendTestNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { title, message, type, severity, channels, actionUrl } = req.body;

      const result = await this.notificationService.dispatchNotification({
        userId,
        title,
        message,
        type: type || NotificationType.SYSTEM,
        severity: severity || NotificationSeverity.INFO,
        channels: channels as NotificationChannel[] | undefined,
        actionUrl,
        bypassCooldown: true,
      });

      res.status(200).json({
        success: true,
        message: 'Test notification triggered',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
