import Redis from 'ioredis';
import { env } from './env.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { alertManager } from '../services/observability/alert-manager.service.js';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

class CacheManager {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private hasLoggedOfflineNotice = false;
  private memoryCache = new Map<string, MemoryCacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private connectionWaiters: Array<(isHealthy: boolean) => void> = [];
  private onConnectCallbacks: Array<() => void> = [];
  private initialCheckDone = false;

  constructor() {
    this.initRedis();
    // In-memory cache cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanMemoryCache(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private initRedis(): void {
    try {
      this.redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        tls: env.REDIS_TLS ? {} : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying to avoid spinning the event loop
          }
          return Math.min(times * 1000, 3000);
        },
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
      });

      this.redis.on('ready', () => {
        this.isRedisConnected = true;
        this.hasLoggedOfflineNotice = false;
        this.resolveConnectionWaiters(true);

        logger.info(`Redis connected successfully at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
        logStructuredEvent({
          level: LogLevel.INFO,
          service: 'redis',
          event: ObservabilityEvent.REDIS_CONNECTED,
          metadata: { host: env.REDIS_HOST, port: env.REDIS_PORT },
        });
        alertManager.resolve('redis_unavailable');

        // Notify registered subscribers
        for (const cb of this.onConnectCallbacks) {
          try {
            cb();
          } catch (err) {
            logger.debug({ err }, 'Error in Redis onConnect callback');
          }
        }
      });

      this.redis.on('error', (err) => {
        if (this.isRedisConnected) {
          // Connection was established and just dropped
          this.isRedisConnected = false;
          logger.warn({ err: err.message }, 'Redis connection error, falling back to memory cache');
          logStructuredEvent({
            level: LogLevel.WARN,
            service: 'redis',
            event: ObservabilityEvent.REDIS_ERROR,
            metadata: { error: err.message },
          });
          alertManager.recordIncident('redis_unavailable', `Redis error: ${err.message}`, 'WARN');
        } else if (!this.hasLoggedOfflineNotice) {
          // First offline notice during initial startup
          this.hasLoggedOfflineNotice = true;
          this.isRedisConnected = false;
          this.resolveConnectionWaiters(false);
          logger.info(
            `Redis not available at ${env.REDIS_HOST}:${env.REDIS_PORT}; operating in resilient in-memory fallback mode`,
          );
          alertManager.recordIncident(
            'redis_unavailable',
            'Redis connection not available, fallback in-memory cache active',
            'WARN',
          );
        }
        this.isRedisConnected = false;
      });

      this.redis.on('close', () => {
        if (this.isRedisConnected) {
          this.isRedisConnected = false;
          logStructuredEvent({
            level: LogLevel.WARN,
            service: 'redis',
            event: ObservabilityEvent.REDIS_DISCONNECTED,
            metadata: { message: 'Redis connection closed' },
          });
        }
      });

      // Attempt initial connection asynchronously without blocking server start
      this.redis.connect().catch((_err) => {
        if (!this.hasLoggedOfflineNotice) {
          this.hasLoggedOfflineNotice = true;
          this.isRedisConnected = false;
          this.resolveConnectionWaiters(false);
          logger.info(
            `Redis not available at ${env.REDIS_HOST}:${env.REDIS_PORT}; operating in resilient in-memory fallback mode`,
          );
          alertManager.recordIncident(
            'redis_unavailable',
            'Redis connection not available, fallback in-memory cache active',
            'WARN',
          );
        }
        this.isRedisConnected = false;
        this.resolveConnectionWaiters(false);
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Redis client, using in-memory cache');
      this.redis = null;
      this.isRedisConnected = false;
      this.resolveConnectionWaiters(false);
    }
  }

  private resolveConnectionWaiters(isHealthy: boolean): void {
    this.initialCheckDone = true;
    while (this.connectionWaiters.length > 0) {
      const waiter = this.connectionWaiters.shift();
      if (waiter) waiter(isHealthy);
    }
  }

  /**
   * Wait for initial Redis connection check to complete, or timeout
   */
  async waitForReady(timeoutMs = 1500): Promise<boolean> {
    if (this.initialCheckDone) {
      return this.isRedisConnected;
    }
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.isRedisConnected);
      }, timeoutMs);

      this.connectionWaiters.push((healthy) => {
        clearTimeout(timer);
        resolve(healthy);
      });
    });
  }

  /**
   * Register a callback to execute when Redis connects
   */
  onConnect(callback: () => void): void {
    this.onConnectCallbacks.push(callback);
    if (this.isRedisConnected) {
      try {
        callback();
      } catch (err) {
        logger.debug({ err }, 'Error in onConnect callback');
      }
    }
  }

  private cleanMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get cached item by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          return JSON.parse(data) as T;
        }
        return null;
      } catch (err) {
        logger.debug({ err, key }, 'Redis GET failed, checking memory cache fallback');
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set cached item with TTL in seconds
   */
  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isRedisConnected && this.redis) {
      try {
        if (ttlSeconds > 0) {
          await this.redis.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redis.set(key, serialized);
        }
        return;
      } catch (err) {
        logger.debug({ err, key }, 'Redis SET failed, storing in memory cache fallback');
      }
    }

    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
    this.memoryCache.set(key, { value: serialized, expiresAt });
  }

  /**
   * Delete cached item by key
   */
  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        logger.debug({ err, key }, 'Redis DEL failed');
      }
    }
  }

  /**
   * Delete keys by pattern (e.g. "stock:*")
   */
  async delPattern(pattern: string): Promise<void> {
    // In-memory pattern removal
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    if (this.isRedisConnected && this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (err) {
        logger.debug({ err, pattern }, 'Redis DEL pattern failed');
      }
    }
  }

  getClient(): Redis | null {
    return this.isRedisConnected ? this.redis : null;
  }

  /**
   * Status check
   */
  isHealthy(): boolean {
    return this.isRedisConnected;
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.isRedisConnected = false;
    }
  }
}

export const cacheService = new CacheManager();
