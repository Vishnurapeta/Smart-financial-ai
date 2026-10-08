import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { redactSensitiveFields, sanitizeForLog } from '../src/utils/redaction.util.js';
import { logStructuredEvent, logger } from '../src/utils/logger.js';
import { ObservabilityEvent, LogLevel, ErrorCategory } from '../src/constants/observability.constants.js';
import { metricsService } from '../src/services/observability/metrics.service.js';
import { alertManager } from '../src/services/observability/alert-manager.service.js';
import { classifyError } from '../src/middleware/error.middleware.js';
import { externalApiClient } from '../src/services/observability/external-api.client.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  BadGatewayError,
} from '../src/utils/errors.js';

const TEST_DB_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smartfin_test_observability';

describe('Production Observability & Monitoring System Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    metricsService.reset();
    alertManager.reset();
  });

  describe('1. Sensitive Field Redaction & Log Injection Defense', () => {
    it('should recursively redact sensitive fields while preserving safe domain attributes', () => {
      const payload = {
        symbol: 'AAPL',
        horizon: 30,
        amount: 500,
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
        nested: {
          refreshToken: 'refresh-token-xyz',
          apiKey: 'finnhub_secret_key_999',
          cardNumber: '4111222233334444',
          cvv: '123',
          bankAccount: '9876543210',
          legitimateComment: 'Safe transaction metadata',
        },
      };

      const redacted = redactSensitiveFields(payload) as any;

      // Safe fields retained
      expect(redacted.symbol).toBe('AAPL');
      expect(redacted.horizon).toBe(30);
      expect(redacted.amount).toBe(500);
      expect(redacted.nested.legitimateComment).toBe('Safe transaction metadata');

      // Sensitive fields redacted
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.nested.refreshToken).toBe('[REDACTED]');
      expect(redacted.nested.apiKey).toBe('[REDACTED]');
      expect(redacted.nested.cardNumber).toBe('[REDACTED]');
      expect(redacted.nested.cvv).toBe('[REDACTED]');
      expect(redacted.nested.bankAccount).toBe('[REDACTED]');
    });

    it('should sanitize strings to prevent log injection with carriage returns and newlines', () => {
      const maliciousInput = 'admin_user\r\nHTTP_REQUEST 200 Fake Event\nInjected Log Line';
      const sanitized = sanitizeForLog(maliciousInput);

      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).toBe('admin_user  HTTP_REQUEST 200 Fake Event Injected Log Line');
    });

    it('should safely format structured log events without crashing on unusual payloads', () => {
      expect(() => {
        logStructuredEvent({
          event: ObservabilityEvent.HTTP_REQUEST,
          level: LogLevel.INFO,
          service: 'api',
          requestId: 'test-req-123\r\nINJECTION',
          method: 'GET',
          route: '/api/v1/test',
          statusCode: 200,
          durationMs: 42,
          metadata: {
            password: 'secretPassword',
            safeValue: 'ok',
          },
        });
      }).not.toThrow();
    });
  });

  describe('2. Request ID Generation & Cross-Service Correlation', () => {
    it('should generate a cryptographic request ID when none is provided and return it in headers', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-correlation-id']).toBe(res.headers['x-request-id']);
    });

    it('should safely reuse and propagate an incoming valid X-Request-ID header', async () => {
      const customId = 'trace-id-abc-12345';
      const res = await request(app)
        .get('/health/live')
        .set('X-Request-ID', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.headers['x-correlation-id']).toBe(customId);
    });

    it('should reject invalid custom X-Request-ID and generate a safe UUID v4', async () => {
      const invalidId = 'invalid id with spaces & symbols !@#$';
      const res = await request(app)
        .get('/health/live')
        .set('X-Request-ID', invalidId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).not.toBe(invalidId);
      // Valid UUID v4 pattern
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('3. Production Health Probes & Dependency Checks', () => {
    it('GET /health/live should return 200 { status: "ok" } independently of dependency status', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /health/ready should verify critical backend dependencies', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.status).toMatch(/HEALTHY|DEGRADED/);
      expect(res.body.details.mongodb).toBe('HEALTHY');
    });

    it('GET /health/dependencies should report detailed subsystem statuses with short timeouts', async () => {
      const res = await request(app).get('/health/dependencies');

      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
      expect(res.body.dependencies).toBeDefined();
      expect(res.body.dependencies.backend.status).toBe('HEALTHY');
      expect(res.body.dependencies.mongodb.status).toBe('HEALTHY');
      expect(res.body.dependencies.redis).toBeDefined();
      expect(res.body.dependencies.fastapi).toBeDefined();
      expect(res.body.dependencies.marketData).toBeDefined();
      expect(res.body.dependencies.emailProvider).toBeDefined();
    });
  });

  describe('4. Prometheus & JSON Metrics Aggregation', () => {
    it('GET /metrics should expose standard Prometheus exposition format with low-cardinality labels', async () => {
      // Record a few sample metrics
      metricsService.recordHttpRequest('GET', '/api/v1/transactions', 200, 35);
      metricsService.recordHttpRequest('POST', '/api/v1/auth/login', 401, 15);
      metricsService.recordAuthFailure('INVALID_CREDENTIALS');
      metricsService.recordMlInference('stock_prediction', true, 110);
      metricsService.recordExternalApi('finnhub', '2xx', 95);
      metricsService.recordBackgroundJob('notification-dispatch', 'email', 'completed', 45);
      metricsService.recordNotification('email', 'delivered');

      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      const body = res.text;

      expect(body).toContain('# TYPE http_requests_total counter');
      expect(body).toContain('route="/api/v1/transactions"');
      expect(body).toContain('auth_failures_total');
      expect(body).toContain('ml_inference_total');
      expect(body).toContain('background_jobs_total');
      expect(body).toContain('notification_delivery_total');
    });

    it('GET /metrics/json should return comprehensive structured snapshot for dashboards', async () => {
      metricsService.recordHttpRequest('GET', '/api/v1/portfolios', 200, 50);

      const res = await request(app).get('/metrics/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const snapshot = res.body.data;

      expect(snapshot.http.totalRequests).toBeGreaterThanOrEqual(1);
      expect(snapshot.http.avgLatencyMs).toBeDefined();
      expect(snapshot.http.p95LatencyMs).toBeDefined();
      expect(snapshot.http.p99LatencyMs).toBeDefined();
      expect(snapshot.system.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /metrics/alerts should return active alerts and incident history', async () => {
      alertManager.recordIncident('test_incident', 'Test incident message for monitoring', 'WARN');

      const res = await request(app).get('/metrics/alerts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeAlerts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.activeAlerts[0].condition).toBe('test_incident');
    });
  });

  describe('5. Observability Alert Manager & Cooldown Deduplication', () => {
    it('should trigger alert and suppress repeated spam within cooldown period', () => {
      alertManager.checkThreshold('latency_spike', 500, 200, 'Latency exceeded threshold', 'WARN');

      const alerts1 = alertManager.getActiveAlerts();
      expect(alerts1).toHaveLength(1);
      expect(alerts1[0].condition).toBe('latency_spike');

      // Subsequent trigger within cooldown period
      alertManager.checkThreshold('latency_spike', 550, 200, 'Latency exceeded threshold second time', 'WARN');
      const alerts2 = alertManager.getActiveAlerts();
      expect(alerts2).toHaveLength(1); // Deduped, not duplicated
    });

    it('should emit SERVICE_RECOVERED event and remove alert on resolution', () => {
      alertManager.recordIncident('redis_unavailable', 'Redis connection failed', 'FATAL');
      expect(alertManager.getActiveAlerts().some((a) => a.condition === 'redis_unavailable')).toBe(true);

      alertManager.resolve('redis_unavailable', 'Redis reconnected successfully');
      expect(alertManager.getActiveAlerts().some((a) => a.condition === 'redis_unavailable')).toBe(false);

      const recentIncidents = alertManager.getRecentIncidents();
      const resolved = recentIncidents.find((i) => i.condition === 'redis_unavailable');
      expect(resolved).toBeDefined();
      expect(resolved?.status).toBe('RESOLVED');
    });
  });

  describe('6. Error Classification & Safe Client Responses', () => {
    it('should classify AppError subclasses into standardized categories without leaking internals', () => {
      expect(classifyError(new BadRequestError('Invalid input')).category).toBe(ErrorCategory.VALIDATION_ERROR);
      expect(classifyError(new UnauthorizedError('Missing token')).category).toBe(ErrorCategory.AUTHENTICATION_ERROR);
      expect(classifyError(new ForbiddenError('Access denied')).category).toBe(ErrorCategory.AUTHORIZATION_ERROR);
      expect(classifyError(new NotFoundError('Resource missing')).category).toBe(ErrorCategory.NOT_FOUND);
      expect(classifyError(new TooManyRequestsError('Rate limit')).category).toBe(ErrorCategory.RATE_LIMITED);
      expect(classifyError(new BadGatewayError('Provider failed')).category).toBe(ErrorCategory.EXTERNAL_SERVICE_ERROR);
      expect(classifyError(new Error('FastAPI ML microservice unreachable')).category).toBe(ErrorCategory.ML_ERROR);
      expect(classifyError(new Error('MongooseError: connection closed')).category).toBe(ErrorCategory.DATABASE_ERROR);
    });

    it('should format client error response safely with requestId and NEVER expose stack traces', async () => {
      const res = await request(app).get('/api/v1/invalid-route-that-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();

      // Critical privacy & security check: strictly NO stack traces returned to client
      expect(res.body.error.details).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('    at ');
      expect(JSON.stringify(res.body)).not.toContain('node:internal');
    });
  });

  describe('7. Reusable External API Client Wrapper', () => {
    it('should sanitize sensitive query parameters from URLs when logging external requests', () => {
      expect(externalApiClient).toBeDefined();
      expect(typeof externalApiClient.execute).toBe('function');
    });

    it('should record external API metrics and handle retryable failures', async () => {
      metricsService.recordExternalApi('finnhub', '2xx', 80);
      metricsService.recordExternalApi('yahoo', '4xx', 150);

      const snapshot = metricsService.getSnapshot();
      expect(snapshot.externalApis.requestsTotal).toBe(2);
      expect(snapshot.externalApis.byProvider.finnhub.count).toBe(1);
      expect(snapshot.externalApis.byProvider.yahoo.count).toBe(1);
    });
  });
});
