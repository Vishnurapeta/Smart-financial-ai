import { Request, Response, NextFunction } from 'express';
import { marketDataService } from '../services/market-data/market-data.service.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { metricsService } from '../services/observability/metrics.service.js';
import { logStructuredEvent } from '../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../constants/observability.constants.js';

export class StockController {
  /**
   * GET /api/v1/stocks/search?q={query}
   */
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query.q as string;
      const results = await marketDataService.searchStocks(q);

      res.status(200).json({
        success: true,
        data: {
          results,
          provider: marketDataService.getActiveProviderName(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/stocks/:symbol/quote
   */
  static async getQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const quote = await marketDataService.getStockQuote(symbol);

      res.status(200).json({
        success: true,
        data: {
          quote,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/stocks/:symbol/history?range={range}&interval={interval}
   */
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { symbol } = req.params;
      const { range, interval } = req.query;

      const history = await marketDataService.getStockHistory(
        symbol,
        range as string,
        interval as string,
      );

      res.status(200).json({
        success: true,
        data: {
          history,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/stocks/predictions/proxy
   * Robust proxy endpoint forwarding inference requests to the FastAPI ML service
   * with correlation ID propagation, latency tracking, and strict non-fabrication guarantee.
   */
  static async proxyPrediction(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const requestId = (req as any).requestId || (req as any).correlationId || (req.headers['x-request-id'] as string);
    const targetPath = (req.query.path as string) || '/predictions/stock';
    const normalizedPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;

    // SSRF & Path Traversal Guard: Validate proxy destination against strict allowlist
    const ALLOWED_PROXY_PREFIXES = ['/predictions', '/models', '/training'];
    const isSafe =
      !normalizedPath.includes('..') &&
      !normalizedPath.includes('://') &&
      !normalizedPath.includes('\\') &&
      ALLOWED_PROXY_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));

    if (!isSafe) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid or unauthorized proxy target path',
        },
      });
      return;
    }

    const mlUrl = `${env.ML_SERVICE_URL}/api/v1${normalizedPath}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(mlUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(requestId ? { 'X-Request-ID': requestId, 'X-Correlation-ID': requestId } : {}),
          ...(env.ML_SERVICE_SECRET_TOKEN
            ? { Authorization: `Bearer ${env.ML_SERVICE_SECRET_TOKEN}` }
            : {}),
        },
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        metricsService.recordMlInference('stock_prediction', false, durationMs);
        logStructuredEvent({
          level: LogLevel.ERROR,
          service: 'ml_client',
          event: ObservabilityEvent.ML_INFERENCE_FAILURE,
          requestId,
          durationMs,
          metadata: {
            endpoint: targetPath,
            statusCode: response.status,
          },
        });

        let errDetail = 'Stock prediction ML service is temporarily unavailable';
        try {
          const errData = await response.json();
          errDetail = errData?.detail || errData?.message || errDetail;
        } catch {
          // ignore json parse error
        }

        res.status(response.status).json({
          success: false,
          error: {
            code: response.status === 404 ? 'NOT_FOUND' : response.status === 409 ? 'CONFLICT' : 'ML_INFERENCE_FAILURE',
            message: errDetail,
          },
          detail: errDetail,
        });
        return;
      }

      const data = await response.json();
      metricsService.recordMlInference('stock_prediction', true, durationMs);

      logStructuredEvent({
        level: LogLevel.INFO,
        service: 'ml_client',
        event: ObservabilityEvent.ML_INFERENCE,
        requestId,
        durationMs,
        metadata: {
          endpoint: targetPath,
          modelVersion: data?.model_version || data?.data?.model_version,
          featureVersion: data?.feature_version || data?.data?.feature_version,
        },
      });

      res.status(response.status).json(data);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      metricsService.recordMlInference('stock_prediction', false, durationMs);

      if (err instanceof AppError) {
        next(err);
        return;
      }

      logStructuredEvent({
        level: LogLevel.ERROR,
        service: 'ml_client',
        event: ObservabilityEvent.ML_INFERENCE_FAILURE,
        requestId,
        durationMs,
        metadata: {
          endpoint: targetPath,
          error: (err as Error).message,
        },
      });

      next(new AppError('Stock prediction ML service is temporarily unavailable', 503, 'ML_INFERENCE_FAILURE'));
    }
  }
}
