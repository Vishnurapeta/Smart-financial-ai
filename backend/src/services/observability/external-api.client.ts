import { env } from '../../config/env.js';
import { logger, logStructuredEvent } from '../../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../../constants/observability.constants.js';
import { metricsService } from './metrics.service.js';
import { sanitizeForLog } from '../../utils/redaction.util.js';

export interface ExternalApiRequestOptions {
  serviceName: string;
  operation: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
  requestId?: string;
  retryOnStatuses?: number[];
  retryDelayMs?: number;
}

export interface ExternalApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  durationMs: number;
  retries: number;
  headers: Headers;
}

export class ExternalApiClientError extends Error {
  public readonly serviceName: string;
  public readonly operation: string;
  public readonly statusCode?: number;
  public readonly durationMs: number;
  public readonly retries: number;
  public readonly isTimeout: boolean;
  public readonly isRateLimited: boolean;

  constructor(
    message: string,
    options: {
      serviceName: string;
      operation: string;
      statusCode?: number;
      durationMs: number;
      retries: number;
      isTimeout?: boolean;
      isRateLimited?: boolean;
    },
  ) {
    super(message);
    this.name = 'ExternalApiClientError';
    this.serviceName = options.serviceName;
    this.operation = options.operation;
    this.statusCode = options.statusCode;
    this.durationMs = options.durationMs;
    this.retries = options.retries;
    this.isTimeout = options.isTimeout || false;
    this.isRateLimited = options.isRateLimited || false;
  }
}

/**
 * Strips sensitive query parameters from URLs before logging (e.g. token, key, secret, apiKey)
 */
function sanitizeUrlForLogging(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    const sensitiveParams = ['token', 'key', 'apikey', 'api_key', 'secret', 'password', 'auth'];
    for (const p of sensitiveParams) {
      if (parsed.searchParams.has(p)) {
        parsed.searchParams.set(p, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return sanitizeForLog(urlString);
  }
}

export class ExternalApiClient {
  private static instance: ExternalApiClient;

  public static getInstance(): ExternalApiClient {
    if (!ExternalApiClient.instance) {
      ExternalApiClient.instance = new ExternalApiClient();
    }
    return ExternalApiClient.instance;
  }

  /**
   * Execute an HTTP request to an external service with timing, retries, correlation IDs, and metrics.
   */
  async execute<T = unknown>(options: ExternalApiRequestOptions): Promise<ExternalApiResponse<T>> {
    const {
      serviceName,
      operation,
      url,
      method = 'GET',
      headers = {},
      body,
      timeoutMs = env.EXTERNAL_API_TIMEOUT_MS,
      maxRetries = env.EXTERNAL_API_MAX_RETRIES,
      requestId,
      retryOnStatuses = [500, 502, 503, 504, 408],
      retryDelayMs = 400,
    } = options;

    const sanitizedUrl = sanitizeUrlForLogging(url);
    const overallStartTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;
    let lastStatus = 0;

    // Attach correlation headers if available
    const requestHeaders: Record<string, string> = { ...headers };
    if (requestId) {
      requestHeaders['X-Request-ID'] = requestId;
      requestHeaders['X-Correlation-ID'] = requestId;
    }

    if (body && !requestHeaders['Content-Type'] && typeof body === 'object') {
      requestHeaders['Content-Type'] = 'application/json';
    }

    while (attempt <= maxRetries) {
      const attemptStartTime = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timer);

        const durationMs = Date.now() - attemptStartTime;
        lastStatus = response.status;

        // Check if rate limited
        if (response.status === 429) {
          logStructuredEvent({
            level: LogLevel.WARN,
            service: 'external_api',
            event: ObservabilityEvent.EXTERNAL_API_FAILURE,
            requestId,
            metadata: {
              targetService: serviceName,
              operation,
              url: sanitizedUrl,
              statusCode: 429,
              durationMs,
              reason: 'RATE_LIMITED',
              attempt,
            },
          });

          metricsService.recordExternalApi(serviceName, '4xx', durationMs);
          throw new ExternalApiClientError(`External service ${serviceName} rate limit exceeded (429)`, {
            serviceName,
            operation,
            statusCode: 429,
            durationMs: Date.now() - overallStartTime,
            retries: attempt,
            isRateLimited: true,
          });
        }

        // If retryable status and attempts remain
        if (!response.ok && retryOnStatuses.includes(response.status) && attempt < maxRetries) {
          attempt++;
          const backoff = retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
          logger.warn(
            { serviceName, operation, status: response.status, attempt, backoffMs: Math.round(backoff) },
            `External request failed with ${response.status}. Retrying...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // If unsuccessful final response
        if (!response.ok) {
          const statusClass = response.status >= 500 ? '5xx' : '4xx';
          metricsService.recordExternalApi(serviceName, statusClass, durationMs);

          logStructuredEvent({
            level: LogLevel.ERROR,
            service: 'external_api',
            event: ObservabilityEvent.EXTERNAL_API_FAILURE,
            requestId,
            metadata: {
              targetService: serviceName,
              operation,
              url: sanitizedUrl,
              statusCode: response.status,
              durationMs,
              attempt,
            },
          });

          throw new ExternalApiClientError(
            `External service ${serviceName} responded with HTTP ${response.status}`,
            {
              serviceName,
              operation,
              statusCode: response.status,
              durationMs: Date.now() - overallStartTime,
              retries: attempt,
            },
          );
        }

        // Successful response
        let data: T;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = (await response.json()) as T;
        } else {
          data = (await response.text()) as unknown as T;
        }

        const totalDurationMs = Date.now() - overallStartTime;
        metricsService.recordExternalApi(serviceName, '2xx', totalDurationMs);

        logStructuredEvent({
          level: LogLevel.INFO,
          service: 'external_api',
          event: ObservabilityEvent.EXTERNAL_API_REQUEST,
          requestId,
          metadata: {
            targetService: serviceName,
            operation,
            url: sanitizedUrl,
            statusCode: response.status,
            durationMs: totalDurationMs,
            retries: attempt,
          },
        });

        return {
          status: response.status,
          ok: true,
          data,
          durationMs: totalDurationMs,
          retries: attempt,
          headers: response.headers,
        };
      } catch (err: unknown) {
        clearTimeout(timer);
        const durationMs = Date.now() - attemptStartTime;

        if (err instanceof ExternalApiClientError) {
          throw err;
        }

        const error = err as Error;
        const isTimeout = error.name === 'AbortError' || error.message.includes('abort');
        lastError = error;

        if (attempt < maxRetries && (isTimeout || error.message.includes('fetch failed') || error.message.includes('ECONNRESET'))) {
          attempt++;
          const backoff = retryDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
          logger.warn(
            { serviceName, operation, error: error.message, isTimeout, attempt, backoffMs: Math.round(backoff) },
            `External request to ${serviceName} errored. Retrying...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        metricsService.recordExternalApi(serviceName, '5xx', durationMs);

        logStructuredEvent({
          level: LogLevel.ERROR,
          service: 'external_api',
          event: ObservabilityEvent.EXTERNAL_API_FAILURE,
          requestId,
          metadata: {
            targetService: serviceName,
            operation,
            url: sanitizedUrl,
            error: error.message,
            durationMs: Date.now() - overallStartTime,
            isTimeout,
            retries: attempt,
          },
        });

        throw new ExternalApiClientError(
          isTimeout
            ? `External service ${serviceName} timed out after ${timeoutMs}ms`
            : `External request to ${serviceName} failed: ${error.message}`,
          {
            serviceName,
            operation,
            statusCode: lastStatus || 504,
            durationMs: Date.now() - overallStartTime,
            retries: attempt,
            isTimeout,
          },
        );
      }
    }

    throw new ExternalApiClientError(
      `External request to ${serviceName} failed after ${attempt} retries: ${lastError?.message || 'Unknown error'}`,
      {
        serviceName,
        operation,
        statusCode: lastStatus || 500,
        durationMs: Date.now() - overallStartTime,
        retries: attempt,
      },
    );
  }
}

export const externalApiClient = ExternalApiClient.getInstance();
