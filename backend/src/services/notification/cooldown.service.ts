import { cacheService } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export interface CooldownCheckResult {
  inCooldown: boolean;
  remainingSeconds: number;
}

export class CooldownService {
  private static instance: CooldownService;

  private constructor() {}

  public static getInstance(): CooldownService {
    if (!CooldownService.instance) {
      CooldownService.instance = new CooldownService();
    }
    return CooldownService.instance;
  }

  private generateKey(userId: string, identifier: string): string {
    return `cooldown:${userId}:${identifier}`;
  }

  /**
   * Check if an action or alert is within its cooldown period.
   * If not in cooldown, registers the new cooldown period.
   * @param userId User ID
   * @param identifier Unique identifier for the cooldown (e.g., symbol "AAPL", "budget:general", etc.)
   * @param cooldownSeconds Cooldown duration in seconds
   */
  public async checkAndSet(
    userId: string,
    identifier: string,
    cooldownSeconds: number = env.NOTIFICATION_COOLDOWN_SECONDS,
  ): Promise<CooldownCheckResult> {
    const key = this.generateKey(userId, identifier);

    try {
      const storedExpiry = await cacheService.get<number>(key);
      const now = Date.now();

      if (storedExpiry && storedExpiry > now) {
        const remainingSeconds = Math.ceil((storedExpiry - now) / 1000);
        logger.debug(
          { userId, identifier, remainingSeconds },
          '[CooldownService] Notification suppressed by active cooldown',
        );
        return { inCooldown: true, remainingSeconds };
      }

      // Record new cooldown target expiry timestamp
      const targetExpiry = now + cooldownSeconds * 1000;
      await cacheService.set(key, targetExpiry, cooldownSeconds);

      return { inCooldown: false, remainingSeconds: 0 };
    } catch (err: unknown) {
      const error = err as Error;
      logger.warn({ error: error.message, key }, '[CooldownService] Error checking cooldown, proceeding');
      return { inCooldown: false, remainingSeconds: 0 };
    }
  }

  /**
   * Reset or clear cooldown for a given identifier
   */
  public async reset(userId: string, identifier: string): Promise<void> {
    const key = this.generateKey(userId, identifier);
    await cacheService.del(key);
  }
}

export const cooldownService = CooldownService.getInstance();
