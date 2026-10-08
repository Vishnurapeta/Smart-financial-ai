import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger, logStructuredEvent } from '../utils/logger.js';
import { RequestWithId } from './request-id.middleware.js';
import { env } from '../config/env.js';
import { ErrorCategory, ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { sanitizeForLog } from '../utils/redaction.util.js';

export function classifyError(err: unknown): { category: ErrorCategory; statusCode: number; code: string } {
  if (err instanceof ZodError) {
    return { category: ErrorCategory.VALIDATION_ERROR, statusCode: 400, code: 'VALIDATION_FAILED' };
  }

  if (err instanceof AppError) {
    switch (err.statusCode) {
      case 400:
        return { category: ErrorCategory.VALIDATION_ERROR, statusCode: 400, code: err.code };
      case 401:
        return { category: ErrorCategory.AUTHENTICATION_ERROR, statusCode: 401, code: err.code };
      case 403:
        return { category: ErrorCategory.AUTHORIZATION_ERROR, statusCode: 403, code: err.code };
      case 404:
        return { category: ErrorCategory.NOT_FOUND, statusCode: 404, code: err.code };
      case 409:
        return { category: ErrorCategory.VALIDATION_ERROR, statusCode: 409, code: err.code };
      case 429:
        return { category: ErrorCategory.RATE_LIMITED, statusCode: 429, code: err.code };
      case 502:
      case 504:
        return { category: ErrorCategory.EXTERNAL_SERVICE_ERROR, statusCode: err.statusCode, code: err.code };
      default:
        return { category: ErrorCategory.INTERNAL_ERROR, statusCode: err.statusCode || 500, code: err.code };
    }
  }

  const errorObj = err as Error;
  const name = errorObj?.name || '';
  const message = errorObj?.message || '';

  if (
    name.includes('Mongo') ||
    message.includes('Mongo') ||
    name.includes('Mongoose') ||
    message.includes('Mongoose') ||
    name === 'CastError'
  ) {
    return { category: ErrorCategory.DATABASE_ERROR, statusCode: 500, code: 'DATABASE_ERROR' };
  }

  if (name.includes('Redis') || message.includes('Redis')) {
    return { category: ErrorCategory.INTERNAL_ERROR, statusCode: 500, code: 'REDIS_ERROR' };
  }

  if (message.includes('FastAPI') || message.includes('ML microservice') || name.includes('ML')) {
    return { category: ErrorCategory.ML_ERROR, statusCode: 502, code: 'ML_ERROR' };
  }

  return { category: ErrorCategory.INTERNAL_ERROR, statusCode: 500, code: 'INTERNAL_SERVER_ERROR' };
}

export function errorHandlerMiddleware(
  err: Error,
  req: RequestWithId,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId || req.correlationId || (req.headers['x-request-id'] as string) || 'unknown';
  const { category, statusCode, code } = classifyError(err);
  const route = req.route?.path || req.baseUrl || req.path;
  const method = req.method;

  // 1. Record Observability Metrics (Isolated so telemetry failures never break response)
  try {
    metricsService.recordError(category, 'api');

    if (category === ErrorCategory.AUTHENTICATION_ERROR) {
      metricsService.recordAuthFailure(err.message || 'UNAUTHORIZED');
      logStructuredEvent({
        level: LogLevel.WARN,
        service: 'api',
        event: ObservabilityEvent.AUTH_FAILURE,
        requestId,
        method,
        route,
        statusCode: 401,
        metadata: {
          reason: sanitizeForLog(err.message),
          email: req.body?.email ? sanitizeForLog(String(req.body.email)) : undefined,
          ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
        },
      });
    } else if (category === ErrorCategory.AUTHORIZATION_ERROR) {
      metricsService.recordAuthorizationFailure(route);
      logStructuredEvent({
        level: LogLevel.WARN,
        service: 'api',
        event: ObservabilityEvent.AUTHORIZATION_FAILURE,
        requestId,
        method,
        route,
        statusCode: 403,
        metadata: {
          actorId: (req as any).user?.userId || (req as any).user?.id,
          role: (req as any).user?.role,
          reason: sanitizeForLog(err.message),
        },
      });
    } else if (category === ErrorCategory.DATABASE_ERROR) {
      logStructuredEvent({
        level: LogLevel.ERROR,
        service: 'api',
        event: ObservabilityEvent.DATABASE_ERROR,
        requestId,
        method,
        route,
        statusCode,
        metadata: {
          errorName: err.name,
          message: sanitizeForLog(err.message),
        },
      });
    }
  } catch (telemetryError: any) {
    logger.warn({ telemetryErrorMessage: telemetryError?.message, stack: telemetryError?.stack }, 'Failed to record error observability telemetry');
  }

  // 2. Specific Handling & Logging By Error Type
  if (err instanceof AppError) {
    // Expected operational app errors: do not log full stack trace
    logger.warn(
      {
        errName: err.name,
        code: err.code,
        category,
        statusCode: err.statusCode,
        requestId,
      },
      `AppError [${err.code}]: ${err.message}`,
    );

    res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
        requestId,
        traceId: requestId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    // Validation errors: clean field list, no stack trace
    logger.warn(
      {
        category: ErrorCategory.VALIDATION_ERROR,
        requestId,
        issuesCount: err.issues.length,
      },
      'Request validation failed',
    );

    res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'One or more request parameters failed validation.',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
        traceId: requestId,
      },
    });
    return;
  }

  // 3. Unhandled Server Exceptions
  // Stack traces may be logged internally, but NEVER returned to the client
  logger.error(
    {
      category,
      requestId,
      method,
      route,
      stack: err.stack,
    },
    `Unhandled Exception: ${err.message}`,
  );

  const isProduction = env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message: isProduction ? 'An unexpected internal error occurred.' : sanitizeForLog(err.message),
      details: null, // Strictly NEVER return stack traces
      requestId,
      traceId: requestId,
    },
  });
}
