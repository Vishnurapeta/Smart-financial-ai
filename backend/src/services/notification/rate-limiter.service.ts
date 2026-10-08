import { cacheService } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterSeconds: number;
}

export class NotificationRateLimiter {
  private static instance: NotificationRateLimiter;

  private constructor() {}

  public static getInstance(): NotificationRateLimiter {
    if (!NotificationRateLimiter.instance) {
      NotificationRateLimiter.instance = new NotificationRateLimiter();
    }
    return NotificationRateLimiter.instance;
  }

  /**
   * Check if a user has exceeded their notification rate limit for the current minute window
   */
  public async checkRateLimit(
    userId: string,
    limit: number = env.NOTIFICATION_RATE_LIMIT_PER_MINUTE,
  ): Promise<RateLimitResult> {
    const currentMinute = Math.floor(Date.now() / 60000);
    const key = `ratelimit:notif:${userId}:${currentMinute}`;

    try {
      const currentCount = (await cacheService.get<number>(key)) || 0;

      if (currentCount >= limit) {
        const remainingSecondsInMinute = 60 - (Math.floor(Date.now() / 1000) % 60);
        logger.warn(
          { userId, currentCount, limit, retryAfterSeconds: remainingSecondsInMinute },
          '[NotificationRateLimiter] Rate limit exceeded for user notifications',
        );
        return {
          allowed: false,
          currentCount,
          limit,
          retryAfterSeconds: remainingSecondsInMinute,
        };
      }

      await cacheService.set(key, currentCount + 1, 65);

      return {
        allowed: true,
        currentCount: currentCount + 1,
        limit,
        retryAfterSeconds: 0,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn({ error: error.message, userId }, '[NotificationRateLimiter] Error in rate limiter, allowing delivery');
      return {
        allowed: true,
        currentCount: 1,
        limit,
        retryAfterSeconds: 0,
      };
    }
  }
}

export const notificationRateLimiter = NotificationRateLimiter.getInstance();
