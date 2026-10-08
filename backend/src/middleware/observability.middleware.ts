import { Response, NextFunction } from 'express';
import { RequestWithId } from './request-id.middleware.js';
import { env } from '../config/env.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { alertManager } from '../services/observability/alert-manager.service.js';
import { adminTelemetryService } from '../services/admin/admin-telemetry.service.js';

/**
 * Normalizes an Express request path by replacing Mongo ObjectIDs and UUIDs
 * with :id to maintain low metric and log cardinality.
 */
export function normalizeRoute(req: RequestWithId): string {
  if (req.route && req.baseUrl) {
    return `${req.baseUrl}${req.route.path}`;
  }
  if (req.route && req.route.path) {
    return req.route.path;
  }
  const cleanPath = req.baseUrl || req.path || req.originalUrl.split('?')[0];
  return cleanPath
    .replace(/[0-9a-fA-F]{24}/g, ':id')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':uuid')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

export function observabilityMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const requestId = req.requestId || req.correlationId || (req.headers['x-request-id'] as string);

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const route = normalizeRoute(req);
    const slowThreshold = env.SLOW_REQUEST_THRESHOLD_MS;

    // 1. Slow Request Detection (Informational, NOT classified as error)
    if (durationMs >= slowThreshold) {
      logStructuredEvent({
        level: LogLevel.WARN,
        service: 'api',
        event: ObservabilityEvent.SLOW_REQUEST,
        requestId,
        method,
        route,
        statusCode,
        durationMs,
        metadata: {
          thresholdMs: slowThreshold,
          originalUrl: req.originalUrl,
        },
      });

      // Check alert condition for persistent slow requests
      alertManager.checkThreshold(
        'high_latency',
        durationMs,
        slowThreshold * 2,
        `Endpoint ${method} ${route} took ${durationMs}ms (threshold: ${slowThreshold}ms)`,
        'WARN',
      );
    }

    // 2. Structured Request/Response Log
    const logLevel =
      statusCode >= 500
        ? LogLevel.ERROR
        : statusCode >= 400
        ? LogLevel.WARN
        : LogLevel.INFO;

    logStructuredEvent({
      level: logLevel,
      service: 'api',
      event: statusCode >= 500 ? ObservabilityEvent.HTTP_ERROR : ObservabilityEvent.HTTP_REQUEST,
      requestId,
      method,
      route,
      statusCode,
      durationMs,
      metadata: {
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
        contentLength: res.get('content-length') ? Number(res.get('content-length')) : undefined,
      },
    });

    // 3. Centralized Metrics Aggregation (Prometheus compatible)
    metricsService.recordHttpRequest(method, route, statusCode, durationMs);

    // 4. Admin Telemetry Service for Admin Dashboard backwards-compatibility
    adminTelemetryService.recordRequest({
      method,
      url: req.originalUrl,
      statusCode,
      durationMs,
      correlationId: requestId,
      timestamp: new Date(),
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    });

    // 5. Alert Trigger on 5xx Error Spikes
    if (statusCode >= 500) {
      alertManager.recordIncident(
        'api_5xx_error',
        `HTTP 500 on ${method} ${route} [req: ${requestId}]`,
        'ERROR',
        { statusCode, route, method, requestId },
      );
    }
  });

  next();
}
