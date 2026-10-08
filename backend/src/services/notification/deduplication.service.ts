import { cacheService } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { NotificationType } from '../../models/notification.model.js';

export interface DeduplicationOptions {
  userId: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  discriminator?: string;
  ttlSeconds?: number;
}

export class DeduplicationService {
  private static instance: DeduplicationService;

  private constructor() {}

  public static getInstance(): DeduplicationService {
    if (!DeduplicationService.instance) {
      DeduplicationService.instance = new DeduplicationService();
    }
    return DeduplicationService.instance;
  }

  /**
   * Builds a deterministic deduplication key for a notification
   */
  public generateKey(options: DeduplicationOptions): string {
    const { userId, type, entityType = 'general', entityId = 'none', discriminator = '' } = options;
    const parts = ['dedup', userId, type, entityType, entityId];
    if (discriminator) {
      parts.push(discriminator);
    }
    return parts.join(':');
  }

  /**
   * Default TTL in seconds based on notification type
   */
  private getDefaultTtl(type: NotificationType): number {
    switch (type) {
      case NotificationType.BUDGET_THRESHOLD:
      case NotificationType.BUDGET_EXCEEDED:
        return 86400; // 24 hours per budget period/day
      case NotificationType.RECURRING_PAYMENT_DUE:
      case NotificationType.SUBSCRIPTION_RENEWAL:
        return 86400; // 24 hours per bill due reminder
      case NotificationType.MONTHLY_REPORT:
        return 86400 * 25; // 25 days
      case NotificationType.STOCK_ALERT:
        return 3600; // 1 hour default
      case NotificationType.ANOMALY_DETECTED:
        return 86400 * 7; // 7 days per anomaly
      default:
        return 3600; // 1 hour default
    }
  }

  /**
   * Check if notification is a duplicate within TTL window.
   * If not duplicate, records the key atomically in cache.
   */
  public async checkAndRecord(
    options: DeduplicationOptions,
  ): Promise<{ isDuplicate: boolean; dedupKey: string }> {
    const dedupKey = this.generateKey(options);
    const ttlSeconds = options.ttlSeconds || this.getDefaultTtl(options.type);

    try {
      const existing = await cacheService.get<string>(dedupKey);
      if (existing) {
        logger.debug({ dedupKey, type: options.type }, '[DeduplicationService] Notification suppressed as duplicate');
        return { isDuplicate: true, dedupKey };
      }

      // Record deduplication key
      await cacheService.set(dedupKey, new Date().toISOString(), ttlSeconds);
      return { isDuplicate: false, dedupKey };
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn({ error: error.message, dedupKey }, '[DeduplicationService] Error checking deduplication, allowing message');
      return { isDuplicate: false, dedupKey };
    }
  }

  /**
   * Explicitly invalidate a deduplication key (e.g., when an alert resets)
   */
  public async invalidate(options: DeduplicationOptions): Promise<void> {
    const dedupKey = this.generateKey(options);
    await cacheService.del(dedupKey);
  }
}

export const deduplicationService = DeduplicationService.getInstance();
