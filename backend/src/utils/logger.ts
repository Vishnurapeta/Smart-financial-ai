import pino from 'pino';
import { env } from '../config/env.js';
import { ObservabilityEvent, LogLevel, SENSITIVE_FIELDS } from '../constants/observability.constants.js';
import { redactSensitiveFields, sanitizeForLog } from './redaction.util.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'api',
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: SENSITIVE_FIELDS.map((field) => `*.*.${field}`).concat(
      SENSITIVE_FIELDS.map((field) => `*.${field}`),
      SENSITIVE_FIELDS.map((field) => `${field}`),
      [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
      ],
    ),
    censor: '[REDACTED]',
  },
  transport:
    env.LOG_FORMAT === 'pretty' && env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export interface StructuredLogPayload {
  event: ObservabilityEvent | string;
  level?: LogLevel;
  requestId?: string;
  durationMs?: number;
  statusCode?: number;
  method?: string;
  route?: string;
  service?: string;
  error?: unknown;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Emit a structured, standardized JSON log event across the application.
 * Accepts either:
 * 1) A single options object: `logStructuredEvent({ event: ..., level: ..., service: ..., ... })`
 * 2) Multi-arg: `logStructuredEvent(event, payload, level)`
 */
export function logStructuredEvent(
  optionsOrEvent: ObservabilityEvent | string | StructuredLogPayload,
  maybePayload?: Omit<StructuredLogPayload, 'event'>,
  maybeLevel?: LogLevel,
): void {
  try {
    let event: string;
    let payload: Record<string, unknown>;
    let level: LogLevel;

    if (typeof optionsOrEvent === 'object' && optionsOrEvent !== null) {
      const { event: ev, level: lvl = LogLevel.INFO, ...rest } = optionsOrEvent as StructuredLogPayload;
      event = (ev as string) || 'UNKNOWN_EVENT';
      level = lvl;
      payload = rest;
    } else {
      event = optionsOrEvent as string;
      payload = (maybePayload as Record<string, unknown>) || {};
      level = maybeLevel || LogLevel.INFO;
    }

    const safeData = redactSensitiveFields({
      timestamp: new Date().toISOString(),
      service: payload.service || 'api',
      event,
      level: (level || LogLevel.INFO).toLowerCase(),
      requestId: payload.requestId ? sanitizeForLog(String(payload.requestId)) : undefined,
      ...payload,
    }) as Record<string, unknown>;

    switch (level) {
      case LogLevel.DEBUG:
        logger.debug(safeData, `[${event}]`);
        break;
      case LogLevel.WARN:
        logger.warn(safeData, `[${event}]`);
        break;
      case LogLevel.ERROR:
        logger.error(safeData, `[${event}]`);
        break;
      case LogLevel.FATAL:
        logger.fatal(safeData, `[${event}]`);
        break;
      case LogLevel.INFO:
      default:
        logger.info(safeData, `[${event}]`);
        break;
    }
  } catch (err) {
    // Observability isolation: logging errors must NEVER crash user application requests
    logger.error({ err }, 'Failed to format structured log event');
  }
}
