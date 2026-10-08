import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { cacheService } from '../config/redis.js';
import { MarketDataService } from '../services/market-data/market-data.service.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { alertManager } from '../services/observability/alert-manager.service.js';
import { logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

interface DependencyStatus {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

interface CachedDependenciesHealth {
  status: HealthStatus;
  timestamp: string;
  cachedAt: number;
  dependencies: {
    backend: DependencyStatus;
    mongodb: DependencyStatus;
    redis: DependencyStatus;
    fastapi: DependencyStatus;
    marketData: DependencyStatus;
    emailProvider: DependencyStatus;
  };
}

let cachedHealth: CachedDependenciesHealth | null = null;
const CACHE_TTL_MS = 10000; // 10s health check cache to prevent load spikes

/**
 * Basic health overview (legacy / general check)
 */
export function getHealthHandler(_req: Request, res: Response): void {
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: env.APP_NAME,
      version: '1.0.0',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
    },
    error: null,
  });
}

/**
 * Liveness Check: Answers "Is the process running?"
 * Does NOT require external dependencies to be healthy.
 */
export function getLivenessHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness Check: Answers "Can this instance serve traffic?"
 * Verifies core dependencies (MongoDB, Redis).
 */
export async function getReadinessHandler(_req: Request, res: Response): Promise<void> {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisHealthy = cacheService.isHealthy();

  // If MongoDB is completely disconnected, instance cannot serve requests
  if (!mongoReady) {
    metricsService.recordHealthCheck('ready', 'UNAVAILABLE');
    res.status(503).json({
      status: 'UNAVAILABLE',
      ready: false,
      timestamp: new Date().toISOString(),
      reasons: ['MongoDB connection is unavailable'],
    });
    return;
  }

  // If Redis is in fallback memory mode, it's DEGRADED but can still serve traffic
  const overall = redisHealthy ? 'HEALTHY' : 'DEGRADED';
  metricsService.recordHealthCheck('ready', overall);

  res.status(200).json({
    status: overall,
    ready: true,
    timestamp: new Date().toISOString(),
    details: {
      mongodb: 'HEALTHY',
      redis: redisHealthy ? 'HEALTHY' : 'DEGRADED',
    },
  });
}

/**
 * Detailed Dependency Health Check with short timeouts and 10s caching.
 * Protects against upstream dependency lag causing health probes to hang.
 */
export async function getDependenciesHealthHandler(req: Request, res: Response): Promise<void> {
  const now = Date.now();

  // Return cached result if valid
  if (cachedHealth && now - cachedHealth.cachedAt < CACHE_TTL_MS) {
    res.status(cachedHealth.status === 'UNAVAILABLE' ? 503 : 200).json(cachedHealth);
    return;
  }

  const timeoutMs = env.HEALTH_CHECK_TIMEOUT_MS;

  // 1. Backend Process
  const backendHealth: DependencyStatus = {
    status: 'HEALTHY',
    latencyMs: 0,
  };

  // 2. MongoDB Check
  const mongoStart = Date.now();
  let mongoHealth: DependencyStatus = { status: 'UNAVAILABLE' };
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB ping timeout')), timeoutMs)),
      ]);
      mongoHealth = {
        status: 'HEALTHY',
        latencyMs: Date.now() - mongoStart,
      };
      alertManager.resolve('mongodb_unavailable');
    } else {
      mongoHealth = {
        status: 'UNAVAILABLE',
        message: 'MongoDB disconnected',
      };
      alertManager.recordIncident('mongodb_unavailable', 'MongoDB is disconnected', 'FATAL');
    }
  } catch (err: unknown) {
    mongoHealth = {
      status: 'UNAVAILABLE',
      latencyMs: Date.now() - mongoStart,
      message: (err as Error).message,
    };
    alertManager.recordIncident('mongodb_unavailable', `MongoDB ping failed: ${(err as Error).message}`, 'FATAL');
  }

  // 3. Redis Check
  const redisStart = Date.now();
  let redisHealth: DependencyStatus = { status: 'DEGRADED' };
  try {
    const isHealthy = cacheService.isHealthy();
    if (isHealthy) {
      redisHealth = {
        status: 'HEALTHY',
        latencyMs: Date.now() - redisStart,
      };
      alertManager.resolve('redis_unavailable');
    } else {
      redisHealth = {
        status: 'DEGRADED',
        latencyMs: Date.now() - redisStart,
        message: 'Running in-memory cache fallback',
      };
      alertManager.recordIncident('redis_unavailable', 'Redis offline, using fallback in-memory cache', 'WARN');
    }
  } catch (err: unknown) {
    redisHealth = {
      status: 'UNAVAILABLE',
      message: (err as Error).message,
    };
  }

  // 4. FastAPI ML Service Check
  const mlStart = Date.now();
  let mlHealth: DependencyStatus = { status: 'DEGRADED' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${env.ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      mlHealth = {
        status: 'HEALTHY',
        latencyMs: Date.now() - mlStart,
      };
      alertManager.resolve('ml_service_unavailable');
    } else {
      mlHealth = {
        status: 'DEGRADED',
        latencyMs: Date.now() - mlStart,
        message: `HTTP ${resp.status}`,
      };
      alertManager.recordIncident('ml_service_unavailable', `FastAPI returned HTTP ${resp.status}`, 'ERROR');
    }
  } catch (err: unknown) {
    mlHealth = {
      status: 'DEGRADED',
      latencyMs: Date.now() - mlStart,
      message: (err as Error).message,
    };
    alertManager.recordIncident('ml_service_unavailable', `FastAPI ML unreachable: ${(err as Error).message}`, 'ERROR');
  }

  // 5. Market Data Provider Check (lightweight, respects rate limits)
  const marketService = MarketDataService.getInstance();
  const marketHealth: DependencyStatus = {
    status: 'HEALTHY',
    message: `Active provider: ${marketService.getActiveProviderName()}`,
  };

  // 6. Email Provider Check (lightweight configuration verification)
  const emailHealth: DependencyStatus = {
    status: env.SMTP_ENABLED ? 'HEALTHY' : 'DEGRADED',
    message: env.SMTP_ENABLED ? 'SMTP configured' : 'Mock mailer active',
  };

  // Compute Overall Status
  let overallStatus: HealthStatus = 'HEALTHY';
  if (mongoHealth.status === 'UNAVAILABLE') {
    overallStatus = 'UNAVAILABLE';
  } else if (
    redisHealth.status !== 'HEALTHY' ||
    mlHealth.status !== 'HEALTHY' ||
    marketHealth.status !== 'HEALTHY' ||
    emailHealth.status !== 'HEALTHY'
  ) {
    overallStatus = 'DEGRADED';
  }

  cachedHealth = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    cachedAt: now,
    dependencies: {
      backend: backendHealth,
      mongodb: mongoHealth,
      redis: redisHealth,
      fastapi: mlHealth,
      marketData: marketHealth,
      emailProvider: emailHealth,
    },
  };

  logStructuredEvent({
    level: overallStatus === 'UNAVAILABLE' ? LogLevel.ERROR : LogLevel.INFO,
    service: 'api',
    event: ObservabilityEvent.HEALTH_CHECK,
    metadata: {
      overallStatus,
      mongodb: mongoHealth.status,
      redis: redisHealth.status,
      fastapi: mlHealth.status,
    },
  });

  metricsService.recordHealthCheck('dependencies', overallStatus);

  res.status(overallStatus === 'UNAVAILABLE' ? 503 : 200).json(cachedHealth);
}
