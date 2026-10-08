import { Response, NextFunction } from 'express';
import { RequestWithId } from './request-id.middleware.js';
import { logger } from '../utils/logger.js';
import { adminTelemetryService } from '../services/admin/admin-telemetry.service.js';

export function requestLoggerMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const { method, originalUrl, correlationId } = req;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    const logPayload = {
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      correlationId,
    };

    // Telemetry recorder for admin dashboard
    adminTelemetryService.recordRequest({
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      correlationId,
      timestamp: new Date(),
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    });

    if (statusCode >= 500) {
      logger.error(logPayload, `HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    } else if (statusCode >= 400) {
      logger.warn(logPayload, `HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    } else {
      logger.info(logPayload, `HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    }
  });

  next();
}
