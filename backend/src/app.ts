import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { observabilityMiddleware } from './middleware/observability.middleware.js';
import { errorHandlerMiddleware } from './middleware/error.middleware.js';
import { globalApiRateLimiter } from './middleware/rate-limiter.middleware.js';
import { NotFoundError } from './utils/errors.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import categoryRoutes from './routes/category.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import mlRoutes from './routes/ml.routes.js';
import { recurringRoutes } from './routes/recurring.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { goalRoutes } from './routes/goal.routes.js';
import { assetRouter, liabilityRouter, netWorthRouter } from './routes/wealth.routes.js';
import { stockRoutes } from './routes/stock.routes.js';
import { watchlistRoutes } from './routes/watchlist.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { portfolioRoutes } from './routes/portfolio.routes.js';
import { forecastRoutes } from './routes/forecast.routes.js';
import { anomalyRoutes } from './routes/anomaly.routes.js';
import { assistantRoutes } from './routes/assistant.routes.js';
import { reportRoutes } from './routes/report.routes.js';

import { noSqlSanitizer } from './middleware/nosql-sanitize.middleware.js';

export function createApp(): Application {
  const app: Application = express();

  // Trust first proxy hop in production (reverse proxy / load balancer)
  app.set('trust proxy', 1);

  // Security Headers via Helmet with Content Security Policy & Strict Transport Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", env.CORS_ORIGIN, 'wss:', 'ws:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      frameguard: {
        action: 'deny',
      },
    }),
  );

  // Parse configured CORS origins
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, server-to-server curl, health checks)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy blocked access from origin: ${origin}`));
        }
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
      exposedHeaders: ['x-correlation-id', 'x-request-id'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Wire Compression for JSON/REST Payloads (Threshold: 1KB)
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Prevent MongoDB NoSQL Query Operator Injection ($gt, $ne, $where)
  app.use(noSqlSanitizer);

  // Tracing, Request Correlation & Structured Observability Middleware
  app.use(requestIdMiddleware);
  app.use(observabilityMiddleware);

  // Root-level Health Probes & Metrics (Standard for Docker / Kubernetes / Prometheus)
  app.use(healthRoutes);
  app.use(metricsRoutes);

  // Global Rate Limiting
  app.use(globalApiRateLimiter);

  // API Prefix Routes
  app.use(env.API_PREFIX, healthRoutes);
  app.use(env.API_PREFIX, metricsRoutes);
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/admin`, adminRoutes);
  app.use(`${env.API_PREFIX}/transactions`, transactionRoutes);
  app.use(`${env.API_PREFIX}/categories`, categoryRoutes);
  app.use(`${env.API_PREFIX}/analytics`, analyticsRoutes);
  app.use(`${env.API_PREFIX}/budgets`, budgetRoutes);
  app.use(`${env.API_PREFIX}/ml`, mlRoutes);
  app.use(`${env.API_PREFIX}/recurring`, recurringRoutes);
  app.use(`${env.API_PREFIX}/subscriptions`, subscriptionRoutes);
  app.use(`${env.API_PREFIX}/goals`, goalRoutes);
  app.use(`${env.API_PREFIX}/assets`, assetRouter);
  app.use(`${env.API_PREFIX}/liabilities`, liabilityRouter);
  app.use(`${env.API_PREFIX}/net-worth`, netWorthRouter);
  app.use(`${env.API_PREFIX}/stocks`, stockRoutes);
  app.use(`${env.API_PREFIX}/watchlists`, watchlistRoutes);
  app.use(`${env.API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${env.API_PREFIX}/portfolios`, portfolioRoutes);
  app.use(`${env.API_PREFIX}/investments/portfolios`, portfolioRoutes);
  app.use(`${env.API_PREFIX}/forecasts`, forecastRoutes);
  app.use(`${env.API_PREFIX}/anomalies`, anomalyRoutes);
  app.use(`${env.API_PREFIX}/assistant`, assistantRoutes);
  app.use(`${env.API_PREFIX}/reports`, reportRoutes);

  // 404 Catch-All
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('The requested endpoint was not found on this server'));
  });

  // Centralized Error Handling
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
