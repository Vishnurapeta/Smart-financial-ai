import { Router, Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/observability/metrics.service.js';
import { alertManager } from '../services/observability/alert-manager.service.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

const router = Router();

/**
 * Optional protection middleware for internal operational metrics
 */
function metricsAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // If in production and a metrics secret token is specified in environment
  const secret = process.env.METRICS_SECRET_TOKEN;
  if (secret && env.NODE_ENV === 'production') {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      next(new UnauthorizedError('Unauthorized access to internal metrics endpoint'));
      return;
    }
  }
  next();
}

/**
 * GET /metrics
 * Expose standard Prometheus exposition text format
 */
router.get('/metrics', metricsAuthMiddleware, async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  const body = metricsService.getPrometheusMetrics();
  res.send(body);
});

/**
 * GET /metrics/json
 * Expose structured metrics snapshot for Admin Dashboard and diagnostic inspection
 */
router.get('/metrics/json', metricsAuthMiddleware, async (_req: Request, res: Response) => {
  const snapshot = metricsService.getSnapshot();
  res.json({
    success: true,
    data: snapshot,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /metrics/alerts
 * Expose active incidents, alerts, and system health status
 */
router.get('/metrics/alerts', metricsAuthMiddleware, async (_req: Request, res: Response) => {
  const activeAlerts = alertManager.getActiveAlerts();
  const recentIncidents = alertManager.getRecentIncidents();

  res.json({
    success: true,
    data: {
      activeAlerts,
      recentIncidents,
      activeAlertsCount: activeAlerts.length,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
