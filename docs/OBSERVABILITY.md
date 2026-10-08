# SmartFin AI — Production Observability System Specification

## 1. Architecture & Observability Philosophy

The SmartFin AI Observability System provides comprehensive, real-time, and resilient operational visibility across all subsystems:
- **Express.js API Gateway & Domain Core** (Node.js / TypeScript)
- **FastAPI ML & Forecasting Microservice** (Python 3.10 / PyTorch / Scikit-Learn)
- **BullMQ Distributed Queue & Background Workers** (Redis-backed asynchronous jobs)
- **Primary Data Layer** (MongoDB with Mongoose query instrumentation)
- **Distributed Cache & Ephemeral Storage** (Redis with resilient in-memory fallback)
- **External Third-Party Integrations** (Alpha Vantage / Finnhub / Yahoo Finance, SendGrid / Nodemailer SMTP)
- **Live WebSocket Event Gateway** (Socket.IO client notification channels)
- **Admin Dashboard Integration** (Real-time telemetry feeds for Prompt 23 administrative consoles)

```
                              +---------------------------------------+
                              |         Client Request Influx         |
                              +---------------------------------------+
                                                  |
                                                  v [X-Request-ID Header]
                               +-------------------------------------+
                               |     Express API Gateway Router      |
                               +-------------------------------------+
                                 |                 |               |
             +-------------------+                 |               +-------------------+
             v                                     v                                   v
+------------------------+             +------------------------+             +------------------------+
| Observability Middle-  |             |  Request ID & Tracing  |             |  Safe Error Handling   |
| ware (Latency, Events) |             |  Context Propagation   |             |  Envelope & Redaction  |
+------------------------+             +------------------------+             +------------------------+
             |                                     |                                   |
             +------------------+------------------+-----------------------------------+
                                |
       +------------------------+------------------------+
       |                        |                        |
       v                        v                        v
+---------------+      +-----------------+      +-----------------+
|  MongoDB ODM  |      |   Redis Cache   |      |  BullMQ Queues  |
| Slow Queries  |      | Disconnect/Err  |      | Duration/Depth  |
+---------------+      +-----------------+      +-----------------+
       |                        |                        |
       +------------------------+------------------------+
                                |
                                v
               +----------------------------------+
               |  FastAPI Machine Learning Core   |
               |  (Inference Latency, Versions)   |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |  Prometheus & Metrics Engine     |
               |  Alert Manager (Cooldown Dedup)  |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |  Prompt 23 Admin Dashboard UI    |
               |  (Consumes Telemetry & Alerts)   |
               +----------------------------------+
```

### Core Design Tenets
1. **Zero Data Fabrication**: Observability guarantees absolute truth. When upstream data (market bars, ML inference) fails or is unavailable, the system strictly raises `MARKET_DATA_UNAVAILABLE` or `ML_INFERENCE_FAILURE`. No mock or synthetic predictions are ever returned to users.
2. **Zero Privacy Leakage**: Absolute redaction of sensitive credentials, JWTs, card/banking details, passwords, and raw financial ledger lists.
3. **Telemetry Fault Isolation**: Failure in metrics recording or logging never impacts the end-user request lifecycle.
4. **End-to-End Tracing**: Request correlation IDs (`X-Request-ID`) travel seamlessly across all network boundaries, worker queues, and child processes.

---

## 2. Structured Application Logging

Logging is powered by **Pino** in Node.js and standard library JSON logging in Python FastAPI.
Logs are emitted strictly as single-line JSON objects to `stdout` / `stderr`, enabling automated ingestion by Datadog, Grafana Loki, AWS CloudWatch, or the ELK stack.

### Top-Level JSON Fields
Every log record contains the following standardized envelope:
| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `level` | `string` / `number` | Lowercase log level name and Pino numeric level code (10, 20, 30, 40, 50, 60) |
| `service` | `string` | Component name: `api`, `ml-service`, `worker-stock-alert`, `worker-report`, `redis`, `database` |
| `event` | `string` | Standardized uppercase domain event enum (e.g. `HTTP_REQUEST`, `AUTH_FAILURE`) |
| `requestId` | `string` | Correlation UUID v4 propagated across service boundaries |
| `userId` | `string` (opt) | Subject identifier of authenticated user (or `anonymous`) |
| `method` | `string` (opt) | HTTP Verb (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) |
| `route` | `string` (opt) | Normalized route pattern (`/api/v1/users/:id`) |
| `statusCode` | `number` (opt) | HTTP response status code |
| `durationMs` | `number` (opt) | Execution time in milliseconds (rounded to integer or 2 decimal places) |
| `metadata` | `object` (opt) | Redacted event-specific attributes |
| `msg` | `string` | Human-readable event description formatted as `[EVENT_NAME]` |

---

## 3. Standardized Event Names

Every significant platform action triggers a structured log event:

```typescript
export enum ObservabilityEvent {
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_ERROR = 'HTTP_ERROR',
  SLOW_REQUEST = 'SLOW_REQUEST',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DB_SLOW_OPERATION = 'DB_SLOW_OPERATION',
  REDIS_CONNECTED = 'REDIS_CONNECTED',
  REDIS_DISCONNECTED = 'REDIS_DISCONNECTED',
  REDIS_ERROR = 'REDIS_ERROR',
  EXTERNAL_API_REQUEST = 'EXTERNAL_API_REQUEST',
  EXTERNAL_API_FAILURE = 'EXTERNAL_API_FAILURE',
  ML_INFERENCE = 'ML_INFERENCE',
  ML_INFERENCE_FAILURE = 'ML_INFERENCE_FAILURE',
  JOB_QUEUED = 'JOB_QUEUED',
  JOB_STARTED = 'JOB_STARTED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  JOB_FAILED = 'JOB_FAILED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  SERVICE_DEGRADED = 'SERVICE_DEGRADED',
  SERVICE_RECOVERED = 'SERVICE_RECOVERED',
}
```

---

## 4. Correlation & Tracing (`X-Request-ID`)

Tracing guarantees auditability and debugging across microservices and asynchronous workers.

1. **Extraction & Generation**: The Express `requestIdMiddleware` checks incoming requests for `X-Request-ID` or `X-Correlation-ID`. If matching `/^[a-zA-Z0-9_-]{8,64}$/`, it is adopted; otherwise a cryptographically secure UUID v4 is generated.
2. **Response Echo**: `X-Request-ID` and `X-Correlation-ID` are attached to all outbound HTTP response headers.
3. **Microservice Propagation**: Calls from Node.js to FastAPI (`ExternalApiClient`) pass `X-Request-ID: <id>` in headers. FastAPI logs and echoes this header.
4. **BullMQ Worker Propagation**: Job payloads include `{ ...data, requestId: req.requestId }`. BullMQ workers attach this ID to job execution logs.
5. **Log Injection Defense**: All request IDs pass through `sanitizeForLog()`, stripping `\r`, `\n`, control characters, and limiting length to 64 characters.

---

## 5. Metrics Engine & Prometheus Integration

The internal metrics service tracks request volumes, latencies, error distributions, and subsystem performance.

### Endpoints
- `GET /metrics`: Standard Prometheus text exposition format (compatible with Prometheus, Grafana Agent, VictoriaMetrics).
- `GET /metrics/json`: Real-time JSON telemetry snapshot (consumed by Admin Dashboard).
- `GET /metrics/alerts`: Active system alerts and historical incident records.

### Exposed Prometheus Metrics
```prometheus
# HELP smartfin_http_requests_total Total number of HTTP requests processed
# TYPE smartfin_http_requests_total counter
smartfin_http_requests_total{method="GET",route="/api/v1/transactions",status="200"} 4521

# HELP smartfin_http_request_duration_seconds HTTP request latency percentiles
# TYPE smartfin_http_request_duration_seconds gauge
smartfin_http_request_duration_seconds{quantile="0.5"} 0.045
smartfin_http_request_duration_seconds{quantile="0.95"} 0.180
smartfin_http_request_duration_seconds{quantile="0.99"} 0.420

# HELP smartfin_auth_events_total Authentication events by outcome
# TYPE smartfin_auth_events_total counter
smartfin_auth_events_total{status="SUCCESS"} 1240
smartfin_auth_events_total{status="FAILURE"} 12

# HELP smartfin_ml_inferences_total Machine learning predictions by model
# TYPE smartfin_ml_inferences_total counter
smartfin_ml_inferences_total{model="RandomForest",status="SUCCESS"} 840
smartfin_ml_inferences_total{model="XGBoost",status="SUCCESS"} 320

# HELP smartfin_bullmq_jobs_total BullMQ job lifecycle counters
# TYPE smartfin_bullmq_jobs_total counter
smartfin_bullmq_jobs_total{queue="stock-alerts",status="COMPLETED"} 512
smartfin_bullmq_jobs_total{queue="reports",status="COMPLETED"} 84
```

### Route Normalization
To prevent high-cardinality metric explosion, URIs with dynamic parameters are normalized:
- `/api/v1/users/64f8a123e4b0...` $\rightarrow$ `/api/v1/users/:id`
- `/api/v1/stocks/AAPL/predictions` $\rightarrow$ `/api/v1/stocks/:ticker/predictions`
- `/api/v1/reports/64f8a.../download` $\rightarrow$ `/api/v1/reports/:id/download`

---

## 6. Production Health Probes & Dependency Checks

SmartFin provides multi-tier health endpoints for container orchestrators (Kubernetes, AWS ECS) and load balancers:

| Endpoint | HTTP Status | Purpose | Timeout | Cache Duration |
|---|---|---|---|---|
| `GET /health/live` | 200 | Liveness probe: Container is running and responding to event loop | 0ms | None |
| `GET /health/ready` | 200 / 503 | Readiness probe: MongoDB is connected and ready to accept traffic | 2,000ms | 10 seconds |
| `GET /health/dependencies` | 200 (or 503 if DB down) | Deep health probe: MongoDB, Redis, FastAPI, Market APIs, Mailer | 2,000ms per check | 10 seconds |
| `GET /health` | 200 / 503 | Legacy/Standard health check | 2,000ms | 10 seconds |

### Caching & Timeout Isolation
Every dependency check runs with an isolated 2-second abort timeout (`AbortSignal.timeout(2000)`). Results are cached in-memory for 10 seconds (`HEALTH_CACHE_TTL_MS`) to prevent health probe storms from overloading backend services.

---

## 7. Error Classification & Safe Client Responses

SmartFin classifies application errors into 10 deterministic categories:

```typescript
export enum ErrorCategory {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  ML_ERROR = 'ML_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

### Safe Error Envelope
Client responses NEVER include raw stack traces, SQL/Mongoose query structures, internal paths, or secrets.
```json
{
  "success": false,
  "error": {
    "category": "VALIDATION_ERROR",
    "code": "BAD_REQUEST",
    "message": "Invalid transaction payload: amount must be positive",
    "requestId": "58e13f41-3829-450a-bc02-998811223344",
    "timestamp": "2026-09-27T14:15:30.123Z"
  }
}
```

---

## 8. Privacy & Data Redaction

Strict data redaction is applied recursively across all logs, request metadata, and error details.

### Blacklisted Fields
The following fields (case-insensitive substring match) are replaced with `[REDACTED]`:
- `password`, `pass`, `pwd`
- `token`, `authorization`, `auth`, `bearer`
- `apiKey`, `secret`, `privateKey`, `certificate`
- `creditCard`, `cardNumber`, `pan`, `cvv`, `cvc`, `pin`
- `bankAccount`, `accountNumber`, `routingNumber`, `iban`
- `refreshToken`, `accessToken`, `jwt`

### Zero Financial Leakage
Full financial transaction histories, user prompt conversations with the AI Assistant, and sensitive account balances are never dumped into logs. Only aggregated metadata (`transactionCount`, `totalVolume`, `ticker`) is emitted.

---

## 9. Machine Learning Pipeline Monitoring

The Python FastAPI microservice logs model inference events with strict traceability:
- **`model_name`**: Architecture (`RandomForest`, `XGBoost`, `LSTM`, `LinearRegression`).
- **`model_version`**: Artifact tag (e.g. `rf_v20260901_01`).
- **`feature_version`**: Feature set version (e.g. `v1.2.0`).
- **`inference_latency_ms`**: Elapsed calculation duration.
- **`prediction_target`**: `price` or `return`.

### Non-Fabrication Guarantee
If the ML service experiences missing features, missing weights, or invalid inputs:
1. `ML_INFERENCE_FAILURE` event is recorded.
2. Returns HTTP 500 / 503 with code `ML_INFERENCE_FAILURE`.
3. Fallback heuristic predictions are strictly prohibited.

---

## 10. External API & Market Data Client

The `ExternalApiClient` provides a robust, observable wrapper for outbound HTTP requests:
- **Exponential Backoff**: Configurable retries (default 3) with backoff multiplier.
- **Timeout Protection**: 5-second hard timeout per attempt.
- **URL Credential Stripping**: Query parameters like `?apikey=...` or `?token=...` are redacted before logging.
- **Failures Emitted**: Emits `EXTERNAL_API_FAILURE` on exhaustion.
- **Market Data Policy**: If market APIs fail or rate limit, the controller returns `MARKET_DATA_UNAVAILABLE`. Synthetic stock prices are NEVER generated.

---

## 11. Asynchronous Queue & BullMQ Telemetry

BullMQ workers monitor queue health and job lifecycle:
- **Queue Wait Latency**: `Date.now() - job.timestamp` (tracks job backlog delay).
- **Execution Duration**: Elapsed execution time recorded on completion.
- **Job Events**:
  - `JOB_QUEUED`: Emitted when scheduled.
  - `JOB_STARTED`: Worker initiates processing.
  - `JOB_COMPLETED`: Successfully finalized.
  - `JOB_FAILED`: Exception thrown after all BullMQ retries.
- **Queue Depth Tracking**: `stock-alerts` and `reports` depth exposed to `/metrics/json`.

---

## 12. Alert Manager & Cooldown Deduplication

The `AlertManager` service suppresses alert storms:
- **Cooldown Interval**: Default 5 minutes (`ALERT_COOLDOWN_MS = 300000`).
- **Deduplication Key**: Derived from `condition` and `severity`.
- **Alert State**: Tracks active alerts in-memory.
- **Automatic Recovery**: Calling `alertManager.resolve(condition, details)` removes the active alert and emits `SERVICE_RECOVERED` with the incident's total outage duration.

---

## 13. Integration with Prompt 23 Admin Dashboard

The Admin Dashboard (built in Prompt 23) consumes this observability system through:
1. `GET /api/v1/admin/health`: Enriched system health including Node.js memory, event loop latency, MongoDB, Redis, FastAPI, Market APIs, and BullMQ queue statuses.
2. `GET /api/v1/admin/telemetry/overview`: Latency percentiles (p50, p95, p99), error rates, request throughput, and active alert counts.
3. `GET /metrics/alerts`: Incident log for operational review.
4. `GET /api/v1/admin/audit-logs`: Audit trail for role changes, password resets, and user status modifications.

---

## 14. Log Retention & Archival

| Environment | Retention Period | Storage Location | Archival Strategy |
|---|---|---|---|
| Development | 7 Days | Local disk / Docker volume | Truncate on restart |
| Staging | 14 Days | Centralized Loki / CloudWatch | Compress to S3 Standard-IA |
| Production | 90 Days | High-durability object storage | Cold Glacier after 90 days (1-year compliance) |

---

## 15. Operational Checklist & Runbook Reference

For incident mitigation and disaster recovery procedures, refer to:
- [Observability Operational Runbook](./OBSERVABILITY_RUNBOOK.md)
