import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  Notification,
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
} from '../src/models/notification.model.js';
import { NotificationPreference } from '../src/models/notification-preference.model.js';
import { NotificationDelivery, DeliveryStatus } from '../src/models/notification-delivery.model.js';
import { User } from '../src/models/user.model.js';
import { deduplicationService } from '../src/services/notification/deduplication.service.js';
import { cooldownService } from '../src/services/notification/cooldown.service.js';
import { notificationRateLimiter } from '../src/services/notification/rate-limiter.service.js';
import { quietHoursService } from '../src/services/notification/quiet-hours.service.js';
import { notificationTemplateService } from '../src/services/notification/template.service.js';
import { notificationService } from '../src/services/notification.service.js';
import { eventBus } from '../src/services/event-bus.service.js';
import { cacheService } from '../src/config/redis.js';

describe('Enterprise Notification and Alert System Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});
    await NotificationDelivery.deleteMany({});
    await User.deleteMany({});
    await cacheService.delPattern('dedup:*');
    await cacheService.delPattern('cooldown:*');
    await cacheService.delPattern('ratelimit:*');

    const user = await User.create({
      email: 'investor@smartfin.ai',
      passwordHash: 'hashed_pw_for_tests_12345',
      firstName: 'Alex',
      lastName: 'Vance',
      role: 'USER',
      preferences: {
        theme: 'dark',
        emailAlerts: true,
        pushAlerts: true,
        weeklyDigest: false,
        stockAlertsEnabled: true,
        minCooldownMinutes: 10,
      },
    });
    testUserId = user._id.toString();
  });

  describe('1. Deduplication Service', () => {
    it('should generate deterministic deduplication keys and suppress duplicates within TTL', async () => {
      const options = {
        userId: testUserId,
        type: NotificationType.BUDGET_THRESHOLD,
        entityType: 'budget',
        entityId: 'monthly-dining-2026',
        discriminator: '80',
        ttlSeconds: 60,
      };

      const firstCheck = await deduplicationService.checkAndRecord(options);
      expect(firstCheck.isDuplicate).toBe(false);
      expect(firstCheck.dedupKey).toContain(testUserId);
      expect(firstCheck.dedupKey).toContain('BUDGET_THRESHOLD');

      // Second check with exact same parameters must be marked as duplicate
      const secondCheck = await deduplicationService.checkAndRecord(options);
      expect(secondCheck.isDuplicate).toBe(true);

      // Invalidate should allow re-triggering
      await deduplicationService.invalidate(options);
      const thirdCheck = await deduplicationService.checkAndRecord(options);
      expect(thirdCheck.isDuplicate).toBe(false);
    });
  });

  describe('2. Cooldown Service', () => {
    it('should enforce cooldown intervals to avoid alert notification flooding', async () => {
      const identifier = 'stock:NVDA';

      const check1 = await cooldownService.checkAndSet(testUserId, identifier, 30);
      expect(check1.inCooldown).toBe(false);
      expect(check1.remainingSeconds).toBe(0);

      // Immediately checking again must return active cooldown
      const check2 = await cooldownService.checkAndSet(testUserId, identifier, 30);
      expect(check2.inCooldown).toBe(true);
      expect(check2.remainingSeconds).toBeGreaterThan(0);

      // Resetting cooldown allows sending again
      await cooldownService.reset(testUserId, identifier);
      const check3 = await cooldownService.checkAndSet(testUserId, identifier, 30);
      expect(check3.inCooldown).toBe(false);
    });
  });

  describe('3. Rate Limiter Service', () => {
    it('should throttle excessive notifications for a single user', async () => {
      const limit = 3;

      const r1 = await notificationRateLimiter.checkRateLimit(testUserId, limit);
      expect(r1.allowed).toBe(true);
      expect(r1.currentCount).toBe(1);

      const r2 = await notificationRateLimiter.checkRateLimit(testUserId, limit);
      expect(r2.allowed).toBe(true);
      expect(r2.currentCount).toBe(2);

      const r3 = await notificationRateLimiter.checkRateLimit(testUserId, limit);
      expect(r3.allowed).toBe(true);
      expect(r3.currentCount).toBe(3);

      // 4th request exceeds limit of 3 per window
      const r4 = await notificationRateLimiter.checkRateLimit(testUserId, limit);
      expect(r4.allowed).toBe(false);
      expect(r4.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('4. Quiet Hours Service', () => {
    it('should evaluate quiet hours and bypass for CRITICAL severity alerts', () => {
      const quietHours = {
        enabled: true,
        startTime: '00:00',
        endTime: '23:59', // All day in quiet hours
        timezone: 'UTC',
      };

      // Normal severity is subject to quiet hours delay
      const evalInfo = quietHoursService.evaluate(quietHours, NotificationSeverity.INFO);
      expect(evalInfo.inQuietHours).toBe(true);
      expect(evalInfo.delaySeconds).toBeGreaterThan(0);

      // CRITICAL alerts bypass quiet hours unconditionally
      const evalCritical = quietHoursService.evaluate(quietHours, NotificationSeverity.CRITICAL);
      expect(evalCritical.inQuietHours).toBe(false);
      expect(evalCritical.bypassed).toBe(true);
      expect(evalCritical.delaySeconds).toBe(0);
    });
  });

  describe('5. Template Service Formatting', () => {
    it('should generate standardized messages and rich HTML templates for all 8 notification types', () => {
      // 1. Budget Threshold
      const budgetThresh = notificationTemplateService.formatBudgetThreshold({
        categoryName: 'Groceries',
        spent: 420,
        limit: 500,
        percentage: 84.0,
        period: 'MONTHLY',
      });
      expect(budgetThresh.title).toContain('Groceries');
      expect(budgetThresh.title).toContain('84%');
      expect(budgetThresh.htmlBody).toContain('Budget Warning');

      // 2. Budget Exceeded
      const budgetEx = notificationTemplateService.formatBudgetExceeded({
        categoryName: 'Entertainment',
        spent: 350,
        limit: 250,
        overspentAmount: 100,
        period: 'MONTHLY',
      });
      expect(budgetEx.title).toContain('Budget Exceeded');
      expect(budgetEx.severity).toBe(NotificationSeverity.ALERT);

      // 3. Recurring Bill Due
      const recurring = notificationTemplateService.formatRecurringDue({
        title: 'Apartment Rent',
        amount: 1850,
        dueDate: new Date(Date.now() + 86400000 * 2),
        daysUntilDue: 2,
      });
      expect(recurring.title).toContain('Apartment Rent');
      expect(recurring.message).toContain('1850.00');

      // 4. Subscription Renewal
      const sub = notificationTemplateService.formatSubscriptionRenewal({
        name: 'Bloomberg Terminal',
        amount: 250,
        renewalDate: new Date(Date.now() + 86400000 * 3),
        daysUntilRenewal: 3,
        cycle: 'MONTHLY',
      });
      expect(sub.title).toContain('Bloomberg Terminal');

      // 5. Anomaly Detected
      const anomaly = notificationTemplateService.formatAnomalyDetected({
        amount: 4500,
        description: 'Wire Transfer to Overseas Merchant',
        severity: 'HIGH',
        score: 0.94,
        reason: 'Large deviation from mean transaction volume',
      });
      expect(anomaly.title).toContain('4500.00');
      expect(anomaly.severity).toBe(NotificationSeverity.CRITICAL);

      // 6. Stock Alert
      const stock = notificationTemplateService.formatStockAlert({
        symbol: 'TSLA',
        alertType: 'PRICE_ABOVE',
        threshold: 250,
        currentPrice: 255.4,
        percentChange: 3.2,
      });
      expect(stock.title).toContain('TSLA');
      expect(stock.htmlBody).toContain('TSLA Price Alert Triggered');

      // 7. Portfolio Update
      const portfolio = notificationTemplateService.formatPortfolioUpdate({
        portfolioName: 'Tech Growth',
        totalValue: 125000,
        dailyPnl: 2450.5,
        dailyPnlPercent: 2.0,
      });
      expect(portfolio.title).toContain('Tech Growth');

      // 8. Monthly Report
      const report = notificationTemplateService.formatMonthlyReport({
        month: 9,
        year: 2026,
        totalIncome: 12000,
        totalExpense: 6500,
        netSavings: 5500,
      });
      expect(report.title).toContain('September 2026');
      expect(report.message).toContain('Savings Rate: 45.8%');
    });
  });

  describe('6. Domain Event Bus Decoupled Subscriptions', () => {
    it('should emit and process domain events via DomainEventBus', async () => {
      let eventProcessed = false;

      eventBus.subscribe('portfolio.update', (data) => {
        if (data.portfolioName === 'Test Portfolio') {
          eventProcessed = true;
        }
      });

      eventBus.emitEvent('portfolio.update', {
        userId: testUserId,
        portfolioId: 'test-port-123',
        portfolioName: 'Test Portfolio',
        totalValue: 50000,
        dailyPnl: 1200,
        dailyPnlPercent: 2.4,
      });

      // Allow microtask tick
      await new Promise((r) => setTimeout(r, 50));
      expect(eventProcessed).toBe(true);
    });
  });

  describe('7. End-to-End Orchestrator & Channel Dispatch', () => {
    it('should dispatch multi-channel notification, create delivery audit trail, and track unread count', async () => {
      const result = await notificationService.dispatchNotification({
        userId: testUserId,
        title: 'Budget Alert: Dining Out reached 85%',
        message: 'You have spent $425 of your $500 monthly dining out budget.',
        type: NotificationType.BUDGET_THRESHOLD,
        severity: NotificationSeverity.WARNING,
        channels: [NotificationChannel.IN_APP, NotificationChannel.SOCKET, NotificationChannel.EMAIL],
        actionUrl: '/budgets',
        bypassCooldown: true,
      });

      expect(result.delivered).toBe(true);
      expect(result.notification).toBeDefined();

      const notifId = result.notification!._id;

      // Verify Notification persisted in MongoDB
      const doc = await Notification.findById(notifId);
      expect(doc).toBeDefined();
      expect(doc!.title).toBe('Budget Alert: Dining Out reached 85%');
      expect(doc!.status).toBe(NotificationStatus.DELIVERED);
      expect(doc!.isRead).toBe(false);

      // Verify NotificationDelivery audit records were created for each channel
      const deliveries = await NotificationDelivery.find({ notificationId: notifId });
      expect(deliveries.length).toBeGreaterThanOrEqual(2);
      const channelsPresent = deliveries.map((d) => d.channel);
      expect(channelsPresent).toContain(NotificationChannel.IN_APP);
      expect(channelsPresent).toContain(NotificationChannel.SOCKET);

      // Verify unread count
      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(1);

      // Mark as read
      const readDoc = await notificationService.markAsRead(testUserId, notifId.toString());
      expect(readDoc.isRead).toBe(true);
      expect(readDoc.status).toBe(NotificationStatus.READ);
      expect(await notificationService.getUnreadCount(testUserId)).toBe(0);

      // Dismiss notification
      const dismissedDoc = await notificationService.dismissNotification(testUserId, notifId.toString());
      expect(dismissedDoc.isDismissed).toBe(true);
      expect(dismissedDoc.status).toBe(NotificationStatus.DISMISSED);
    });

    it('should manage and update user notification preferences with quiet hours and channel configurations', async () => {
      const initialPrefs = await notificationService.getPreferences(testUserId);
      expect(initialPrefs.userId.toString()).toBe(testUserId);
      expect(initialPrefs.stockAlertsEnabled).toBe(true);

      const updatedPrefs = await notificationService.updatePreferences(testUserId, {
        stockAlertsEnabled: false,
        minCooldownMinutes: 20,
        quietHours: {
          enabled: true,
          startTime: '23:00',
          endTime: '07:00',
          timezone: 'America/New_York',
        },
      });

      expect(updatedPrefs.stockAlertsEnabled).toBe(false);
      expect(updatedPrefs.minCooldownMinutes).toBe(20);
      expect(updatedPrefs.quietHours.enabled).toBe(true);
      expect(updatedPrefs.quietHours.startTime).toBe('23:00');
      expect(updatedPrefs.quietHours.timezone).toBe('America/New_York');

      // Verify user model sync
      const user = await User.findById(testUserId);
      expect(user?.preferences.stockAlertsEnabled).toBe(false);
      expect(user?.preferences.minCooldownMinutes).toBe(20);
    });
  });
});
