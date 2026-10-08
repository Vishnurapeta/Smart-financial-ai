import { Types } from 'mongoose';
import {
  Notification,
  INotification,
  NotificationType,
  NotificationPriority,
  NotificationSeverity,
  NotificationChannel,
  NotificationStatus,
} from '../models/notification.model.js';
import {
  NotificationPreference,
  INotificationPreference,
  defaultChannelPreferences,
} from '../models/notification-preference.model.js';
import { User } from '../models/user.model.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { deduplicationService } from './notification/deduplication.service.js';
import { cooldownService } from './notification/cooldown.service.js';
import { notificationRateLimiter } from './notification/rate-limiter.service.js';
import { quietHoursService } from './notification/quiet-hours.service.js';
import { notificationTemplateService } from './notification/template.service.js';
import { enqueueNotification } from '../queues/notification.queue.js';
import { eventBus } from './event-bus.service.js';
import { emitToUser } from '../config/socket.js';

export interface CreateNotificationDto {
  userId: string | Types.ObjectId;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  channels?: NotificationChannel[];
  bypassCooldown?: boolean;
}

export interface DispatchNotificationOptions {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  htmlBody?: string;
  channels?: NotificationChannel[];
  bypassCooldown?: boolean;
  cooldownKey?: string;
  cooldownSeconds?: number;
  dedupDiscriminator?: string;
}

export interface DispatchResult {
  notification?: INotification;
  delivered: boolean;
  enqueued: boolean;
  skipped?: boolean;
  reason?: string;
  channels?: NotificationChannel[];
}

export class NotificationService {
  private static instance: NotificationService;
  private isEventBusInitialized = false;

  private constructor() {
    this.initEventSubscribers();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize subscriptions to Domain Event Bus events
   */
  private initEventSubscribers(): void {
    if (this.isEventBusInitialized) return;
    this.isEventBusInitialized = true;

    // 1. Budget Threshold Crossed (e.g. 80%)
    eventBus.subscribe('budget.threshold', async (data) => {
      const content = notificationTemplateService.formatBudgetThreshold(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.BUDGET_THRESHOLD,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'budget',
        entityId: data.budgetId,
        dedupDiscriminator: `${data.period}:${Math.floor(data.percentage / 10) * 10}`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 2. Budget Exceeded (100%+)
    eventBus.subscribe('budget.exceeded', async (data) => {
      const content = notificationTemplateService.formatBudgetExceeded(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.BUDGET_EXCEEDED,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'budget',
        entityId: data.budgetId,
        dedupDiscriminator: `${data.period}:exceeded`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 3. Recurring Payment Due
    eventBus.subscribe('recurring.due', async (data) => {
      const content = notificationTemplateService.formatRecurringDue(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.RECURRING_PAYMENT_DUE,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'recurring_expense',
        entityId: data.expenseId,
        dedupDiscriminator: `due:${new Date(data.dueDate).toISOString().split('T')[0]}`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 4. Subscription Renewal
    eventBus.subscribe('subscription.renewal', async (data) => {
      const content = notificationTemplateService.formatSubscriptionRenewal(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.SUBSCRIPTION_RENEWAL,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'subscription',
        entityId: data.subscriptionId,
        dedupDiscriminator: `renew:${new Date(data.renewalDate).toISOString().split('T')[0]}`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 5. Anomaly Detected
    eventBus.subscribe('anomaly.detected', async (data) => {
      const content = notificationTemplateService.formatAnomalyDetected(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.ANOMALY_DETECTED,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'anomaly',
        entityId: data.anomalyId,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 6. Stock Alert Triggered
    eventBus.subscribe('stock.alert', async (data) => {
      const content = notificationTemplateService.formatStockAlert(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.STOCK_ALERT,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'stock_alert',
        entityId: data.alertId || data.symbol,
        cooldownKey: `stock:${data.symbol}`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 7. Portfolio Update
    eventBus.subscribe('portfolio.update', async (data) => {
      const content = notificationTemplateService.formatPortfolioUpdate(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.PORTFOLIO_UPDATE,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'portfolio',
        entityId: data.portfolioId,
        dedupDiscriminator: new Date().toISOString().split('T')[0],
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 8. Monthly Report Generated
    eventBus.subscribe('report.generated', async (data) => {
      const content = notificationTemplateService.formatMonthlyReport(data);
      await this.dispatchNotification({
        userId: data.userId,
        title: content.title,
        message: content.message,
        type: NotificationType.MONTHLY_REPORT,
        severity: content.severity,
        priority: content.priority,
        actionUrl: content.actionUrl,
        htmlBody: content.htmlBody,
        entityType: 'financial_report',
        entityId: data.reportId,
        dedupDiscriminator: `${data.year}-${data.month}`,
        metadata: data as unknown as Record<string, unknown>,
      });
    });

    // 9. Direct / Custom Notification
    eventBus.subscribe('notification.trigger', async (data) => {
      await this.dispatchNotification({
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        severity: data.severity,
        channels: data.channels,
        actionUrl: data.actionUrl,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        bypassCooldown: data.bypassCooldown,
      });
    });

    logger.info('[NotificationService] Domain event bus subscribers wired successfully');
  }

  /**
   * Helper to map legacy Priority to Severity
   */
  private mapPriorityToSeverity(priority?: NotificationPriority): NotificationSeverity {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return NotificationSeverity.CRITICAL;
      case NotificationPriority.HIGH:
        return NotificationSeverity.ALERT;
      case NotificationPriority.LOW:
        return NotificationSeverity.INFO;
      case NotificationPriority.MEDIUM:
      default:
        return NotificationSeverity.WARNING;
    }
  }

  /**
   * Legacy method: Create notification with real-time Socket.IO and DB persistence
   */
  async createNotification(data: CreateNotificationDto): Promise<INotification> {
    const userIdStr = typeof data.userId === 'string' ? data.userId : data.userId.toString();
    const type = data.type || NotificationType.SYSTEM;
    const severity = data.severity || this.mapPriorityToSeverity(data.priority);
    const priority = data.priority || NotificationPriority.MEDIUM;

    const result = await this.dispatchNotification({
      userId: userIdStr,
      title: data.title,
      message: data.message,
      type,
      severity,
      priority,
      actionUrl: data.actionUrl,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      channels: data.channels,
      bypassCooldown: data.bypassCooldown ?? true,
    });

    if (result.notification) {
      return result.notification;
    }

    // Direct fallback creation if skipped
    return Notification.create({
      userId: new Types.ObjectId(userIdStr),
      title: data.title.trim(),
      message: data.message.trim(),
      type,
      severity,
      priority,
      actionUrl: data.actionUrl || '',
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata || {},
      status: NotificationStatus.DELIVERED,
      isRead: false,
    });
  }

  /**
   * Core Enterprise Notification Orchestrator Pipeline:
   * 1. Resolve User & Preferences
   * 2. Determine target channels
   * 3. Check Deduplication
   * 4. Check Cooldown
   * 5. Check Rate Limiter
   * 6. Check Quiet Hours
   * 7. Save Notification to DB
   * 8. Enqueue to BullMQ for Multi-Channel Dispatch (with fallback)
   */
  async dispatchNotification(options: DispatchNotificationOptions): Promise<DispatchResult> {
    const {
      userId,
      title,
      message,
      type = NotificationType.SYSTEM,
      severity = NotificationSeverity.INFO,
      priority = NotificationPriority.MEDIUM,
      actionUrl = '',
      entityType,
      entityId,
      metadata = {},
      htmlBody,
      bypassCooldown = false,
      cooldownKey,
      cooldownSeconds,
      dedupDiscriminator,
    } = options;

    try {
      // 1. Fetch user and preferences
      const [user, userPref] = await Promise.all([
        User.findById(userId).select('email preferences'),
        NotificationPreference.findOne({ userId: new Types.ObjectId(userId) }),
      ]);

      if (!user) {
        logger.warn({ userId }, '[NotificationService] User not found, aborting notification dispatch');
        return { delivered: false, enqueued: false, skipped: true, reason: 'User not found' };
      }

      // 2. Check if stock alert is disabled globally in user preferences
      if (type === NotificationType.STOCK_ALERT) {
        const isStockAlertsEnabled =
          userPref?.stockAlertsEnabled ?? user.preferences?.stockAlertsEnabled ?? true;
        if (!isStockAlertsEnabled) {
          logger.debug({ userId }, '[NotificationService] Stock alerts disabled by user preferences');
          return { delivered: false, enqueued: false, skipped: true, reason: 'Stock alerts disabled by user' };
        }
      }

      // 3. Resolve target channels based on preferences
      let targetChannels: NotificationChannel[] = options.channels || [];
      if (targetChannels.length === 0) {
        targetChannels = [NotificationChannel.IN_APP, NotificationChannel.SOCKET];

        const rawChannels = userPref?.channels as unknown;
        const typePrefs =
          rawChannels instanceof Map
            ? (rawChannels as Map<string, { inApp: boolean; email: boolean; socket: boolean }>).get(type)
            : (rawChannels as Record<string, { inApp: boolean; email: boolean; socket: boolean }>)?.[type] ||
              defaultChannelPreferences[type];

        const emailAllowed = userPref?.emailAlerts ?? user.preferences?.emailAlerts ?? true;

        if (typePrefs) {
          targetChannels = [];
          if (typePrefs.inApp) targetChannels.push(NotificationChannel.IN_APP);
          if (typePrefs.socket) targetChannels.push(NotificationChannel.SOCKET);
          if (typePrefs.email && emailAllowed) targetChannels.push(NotificationChannel.EMAIL);
        } else if (emailAllowed && (severity === NotificationSeverity.ALERT || severity === NotificationSeverity.CRITICAL)) {
          targetChannels.push(NotificationChannel.EMAIL);
        }
      }

      if (targetChannels.length === 0) {
        logger.debug({ userId, type }, '[NotificationService] No delivery channels enabled for this notification');
        return { delivered: false, enqueued: false, skipped: true, reason: 'No enabled channels' };
      }

      // 4. Deduplication Check
      const dedupCheck = await deduplicationService.checkAndRecord({
        userId,
        type,
        entityType,
        entityId,
        discriminator: dedupDiscriminator,
      });

      if (dedupCheck.isDuplicate) {
        return {
          delivered: false,
          enqueued: false,
          skipped: true,
          reason: 'Duplicate notification suppressed',
        };
      }

      // 5. Cooldown Check
      if (!bypassCooldown) {
        const effectiveCooldown =
          cooldownSeconds ||
          (userPref?.minCooldownMinutes ? userPref.minCooldownMinutes * 60 : undefined);

        const idForCooldown = cooldownKey || `${type}:${entityId || 'global'}`;
        const cooldownCheck = await cooldownService.checkAndSet(userId, idForCooldown, effectiveCooldown);

        if (cooldownCheck.inCooldown) {
          return {
            delivered: false,
            enqueued: false,
            skipped: true,
            reason: `Notification in cooldown (${cooldownCheck.remainingSeconds}s remaining)`,
          };
        }
      }

      // 6. Rate Limit Check
      const rateLimitCheck = await notificationRateLimiter.checkRateLimit(
        userId,
        userPref?.maxNotificationsPerHour ? Math.ceil(userPref.maxNotificationsPerHour / 6) : undefined,
      );

      if (!rateLimitCheck.allowed) {
        return {
          delivered: false,
          enqueued: false,
          skipped: true,
          reason: `Rate limit exceeded. Try again in ${rateLimitCheck.retryAfterSeconds}s`,
        };
      }

      // 7. Quiet Hours Check
      const quietHoursEval = quietHoursService.evaluate(userPref?.quietHours, severity);
      const delayMs = quietHoursEval.inQuietHours ? quietHoursEval.delaySeconds * 1000 : 0;

      // 8. Persist Notification Document in MongoDB
      const doc = await Notification.create({
        userId: new Types.ObjectId(userId),
        title: title.trim(),
        message: message.trim(),
        type,
        severity,
        priority,
        channels: targetChannels,
        status: NotificationStatus.PENDING,
        actionUrl: actionUrl.trim(),
        entityType,
        entityId,
        metadata,
        dedupKey: dedupCheck.dedupKey,
        isRead: false,
        isDismissed: false,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day retention
      });

      // 9. Enqueue to BullMQ Worker for Multi-Channel Delivery (or direct fallback)
      const enqueueResult = await enqueueNotification(
        {
          notificationId: doc._id.toString(),
          userId,
          userEmail: user.email,
          title: doc.title,
          message: doc.message,
          type,
          severity,
          priority,
          channels: targetChannels,
          actionUrl: doc.actionUrl,
          htmlBody,
          metadata,
          createdAt: doc.createdAt.toISOString(),
        },
        delayMs,
      );

      return {
        notification: doc,
        delivered: true,
        enqueued: enqueueResult.enqueued,
        channels: targetChannels,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error({ error: error.message, userId, title }, '[NotificationService] Error dispatching notification');
      throw error;
    }
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      type?: NotificationType;
      severity?: NotificationSeverity;
      isRead?: boolean;
      isDismissed?: boolean;
      limit?: number;
      page?: number;
    } = {},
  ): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (options.type) {
      query.type = options.type;
    }

    if (options.severity) {
      query.severity = options.severity;
    }

    if (typeof options.isRead === 'boolean') {
      query.isRead = options.isRead;
    }

    if (typeof options.isDismissed === 'boolean') {
      query.isDismissed = options.isDismissed;
    } else {
      // By default do not return dismissed notifications unless requested
      query.isDismissed = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({
        userId: new Types.ObjectId(userId),
        isRead: false,
        isDismissed: false,
        isDeleted: false,
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<INotification> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestError('Invalid notification ID format');
    }

    const doc = await Notification.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Notification not found');
    }

    if (!doc.isRead) {
      doc.isRead = true;
      doc.readAt = new Date();
      doc.status = NotificationStatus.READ;
      await doc.save();

      // Emit real-time unread count update to user
      const unreadCount = await this.getUnreadCount(userId);
      emitToUser(userId, 'notification:unread_count', { unreadCount });
    }

    return doc;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        userId: new Types.ObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          status: NotificationStatus.READ,
        },
      },
    );

    emitToUser(userId, 'notification:unread_count', { unreadCount: 0 });
    return result.modifiedCount;
  }

  /**
   * Dismiss single notification
   */
  async dismissNotification(userId: string, notificationId: string): Promise<INotification> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestError('Invalid notification ID format');
    }

    const doc = await Notification.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Notification not found');
    }

    doc.isDismissed = true;
    doc.dismissedAt = new Date();
    doc.status = NotificationStatus.DISMISSED;
    await doc.save();

    const unreadCount = await this.getUnreadCount(userId);
    emitToUser(userId, 'notification:unread_count', { unreadCount });

    return doc;
  }

  /**
   * Soft-delete single notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestError('Invalid notification ID format');
    }

    const doc = await Notification.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!doc) {
      throw new NotFoundError('Notification not found');
    }

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    await doc.save();

    const unreadCount = await this.getUnreadCount(userId);
    emitToUser(userId, 'notification:unread_count', { unreadCount });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
      isDismissed: false,
      isDeleted: false,
    });
  }

  /**
   * Get notification preferences for a user, provisioning defaults if not created yet
   */
  async getPreferences(userId: string): Promise<INotificationPreference> {
    let pref = await NotificationPreference.findOne({ userId: new Types.ObjectId(userId) });
    if (!pref) {
      const user = await User.findById(userId);
      pref = await NotificationPreference.create({
        userId: new Types.ObjectId(userId),
        stockAlertsEnabled: user?.preferences?.stockAlertsEnabled ?? true,
        emailAlerts: user?.preferences?.emailAlerts ?? true,
        pushAlerts: user?.preferences?.pushAlerts ?? true,
        minCooldownMinutes: user?.preferences?.minCooldownMinutes ?? 15,
      });
    }
    return pref;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<INotificationPreference>,
  ): Promise<INotificationPreference> {
    let pref = await NotificationPreference.findOne({ userId: new Types.ObjectId(userId) });
    if (!pref) {
      pref = new NotificationPreference({ userId: new Types.ObjectId(userId) });
    }

    // Apply allowed updates
    if (updates.emailAlerts !== undefined) pref.emailAlerts = updates.emailAlerts;
    if (updates.pushAlerts !== undefined) pref.pushAlerts = updates.pushAlerts;
    if (updates.stockAlertsEnabled !== undefined) pref.stockAlertsEnabled = updates.stockAlertsEnabled;
    if (updates.minCooldownMinutes !== undefined) pref.minCooldownMinutes = updates.minCooldownMinutes;
    if (updates.emailDailyDigest !== undefined) pref.emailDailyDigest = updates.emailDailyDigest;
    if (updates.emailWeeklyDigest !== undefined) pref.emailWeeklyDigest = updates.emailWeeklyDigest;
    if (updates.monthlyReportEmail !== undefined) pref.monthlyReportEmail = updates.monthlyReportEmail;
    if (updates.maxNotificationsPerHour !== undefined) pref.maxNotificationsPerHour = updates.maxNotificationsPerHour;

    if (updates.quietHours) {
      pref.quietHours = {
        ...pref.quietHours,
        ...updates.quietHours,
      };
    }

    if (updates.channels) {
      pref.channels = updates.channels;
    }

    await pref.save();

    // Sync legacy preferences on User model
    try {
      await User.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $set: {
            'preferences.emailAlerts': pref.emailAlerts,
            'preferences.pushAlerts': pref.pushAlerts,
            'preferences.stockAlertsEnabled': pref.stockAlertsEnabled,
            'preferences.minCooldownMinutes': pref.minCooldownMinutes,
          },
        },
      );
    } catch {
      // Ignore user update sync error
    }

    return pref;
  }
}

export const notificationService = NotificationService.getInstance();
