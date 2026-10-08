# SmartFin AI — Observability & Incident Runbook

This operational runbook provides step-by-step diagnostic and remediation procedures for production alerts and incidents across the SmartFin AI ecosystem.

---

## Runbook Index
1. [High API Latency & p99 Degradation](#procedure-1-high-api-latency--p99-degradation)
2. [5xx Server Error Spikes](#procedure-2-5xx-server-error-spikes)
3. [MongoDB Unavailability & Slow Query Storms](#procedure-3-mongodb-unavailability--slow-query-storms)
4. [Redis Outage & Cache Degraded Mode](#procedure-4-redis-outage--cache-degraded-mode)
5. [FastAPI ML Service Unreachability](#procedure-5-fastapi-ml-service-unreachability)
6. [ML Inference Failures & Missing Models](#procedure-6-ml-inference-failures--missing-models)
7. [External Stock Market API Outages & Rate Limiting](#procedure-7-external-stock-market-api-outages--rate-limiting)
8. [Notification Channel Dispatch Failures](#procedure-8-notification-channel-dispatch-failures)
9. [BullMQ Worker Backlog & Stalled Jobs](#procedure-9-bullmq-worker-backlog--stalled-jobs)
10. [Email Delivery Outage / SMTP Failure](#procedure-10-email-delivery-outage--smtp-failure)

---

## Procedure 1: High API Latency & p99 Degradation

### Symptoms
- `SLOW_REQUEST` events emitted frequently in logs (>500ms threshold).
- Prometheus metric `smartfin_http_request_duration_seconds{quantile="0.99"}` exceeds 1.0s.
- Active alert: `latency_spike` in `/metrics/alerts`.

### Probable Causes
- Unindexed MongoDB queries causing full collection scans.
- Synchronous blocking operations in Node.js event loop.
- Network latency or cascading timeouts from downstream services (FastAPI, Redis, Market API).

### Diagnostic Checks
1. Query metrics snapshot:
   ```bash
   curl -s http://localhost:5000/metrics/json | jq '.requests.durationQuantiles'
   ```
2. Search structured logs for slow request paths:
   ```bash
   # Filter logs for SLOW_REQUEST events
   grep '"event":"SLOW_REQUEST"' /var/log/smartfin/api.log | jq '{route: .route, durationMs: .durationMs, method: .method}'
   ```
3. Check MongoDB slow operations:
   ```bash
   grep '"event":"DB_SLOW_OPERATION"' /var/log/smartfin/api.log | jq .
   ```

### Safe Recovery Actions
1. **Identify the Bottleneck**: Inspect which routes dominate latency from step 2.
2. **If DB Slow Query**: Run `db.collection.explain("executionStats")` on the slow query in MongoDB shell and add the appropriate compound index.
3. **If Event Loop Blocked**: Scale out API gateway pods or restart the offending container worker.
4. **If Downstream Timeout**: Ensure external client timeouts (`EXTERNAL_API_TIMEOUT_MS`) are terminating calls cleanly.

### Verification
```bash
# Verify p99 latency drops below 250ms
curl -s http://localhost:5000/metrics | grep 'smartfin_http_request_duration_seconds{quantile="0.99"}'
```

---

## Procedure 2: 5xx Server Error Spikes

### Symptoms
- Spike in HTTP 500 responses (`ErrorCategory.INTERNAL_ERROR`).
- Active alert: `error_spike` in `/metrics/alerts`.
- Client requests returning error envelopes with `requestId`.

### Probable Causes
- Unhandled exceptions inside domain controllers or services.
- Database connection pool exhaustion.
- Mismatched environment variables or secret rotation issues.

### Diagnostic Checks
1. Trace errors by `requestId` from user bug reports:
   ```bash
   grep '"requestId":"<INCIDENT_REQUEST_ID>"' /var/log/smartfin/api.log | jq .
   ```
2. Inspect recent 5xx error distribution:
   ```bash
   grep '"level":"error"' /var/log/smartfin/api.log | jq '{errName: .errName, code: .code, route: .route}'
   ```

### Safe Recovery Actions
1. **Identify Error Category**: Categorize via `category` field (`INTERNAL_ERROR`, `DATABASE_ERROR`, `ML_ERROR`).
2. **Database Pool Saturation**: Increase `maxPoolSize` in Mongoose connection URI if pool waiting timed out.
3. **Hotfix Deployment**: If a code bug exists, deploy patch following git branch protection guidelines.
4. **Alert Resolution**: Call `alertManager.resolve('error_spike')` once error rate drops below 1%.

### Verification
```bash
# Verify 5xx count is stable
curl -s http://localhost:5000/metrics/json | jq '.errors'
```

---

## Procedure 3: MongoDB Unavailability & Slow Query Storms

### Symptoms
- `/health/ready` returns 503 `{"ready": false, "status": "DEGRADED"}`.
- Structured log event: `DATABASE_ERROR` with `MongoServerSelectionError` or `MongooseServerSelectionError`.
- API endpoints returning `DATABASE_ERROR` (500).

### Probable Causes
- MongoDB daemon crashed or network partition between API and Mongo cluster.
- Primary replica set election in progress.
- Disk space exhaustion on MongoDB host.

### Diagnostic Checks
1. Probe readiness endpoint:
   ```bash
   curl -i http://localhost:5000/health/ready
   ```
2. Verify MongoDB process & replica status:
   ```bash
   mongosh --eval "rs.status()"
   ```
3. Check host disk space:
   ```bash
   df -h /var/lib/mongodb
   ```

### Safe Recovery Actions
1. **Replica Failover**: If primary is unresponsive, step down or elect new secondary (`rs.stepDown()`).
2. **Restart Daemon**:
   ```bash
   sudo systemctl restart mongod
   ```
3. **Disk Clearance**: Delete old journal files or compress old audit log collections.
4. **Connection Pool Reset**: Restart Node.js backend to recreate clean connection pool once MongoDB recovers.

### Verification
```bash
curl -s http://localhost:5000/health/dependencies | jq '.details.mongodb'
# Expected output: "HEALTHY"
```

---

## Procedure 4: Redis Outage & Cache Degraded Mode

### Symptoms
- Structured logs emit: `REDIS_DISCONNECTED` and `REDIS_ERROR`.
- Alert manager reports: `redis_unavailable`.
- `/health/dependencies` reports `"redis": "DEGRADED"`.

### Expected Fallback Behavior
- The SmartFin backend automatically falls back to an **in-memory resilient cache** (`In-Memory Fallback Cache Enabled`).
- Session and cache requests continue functioning without user-facing 500 errors.
- BullMQ worker queues pause processing until Redis reconnects.

### Diagnostic Checks
1. Test Redis connectivity:
   ```bash
   redis-cli -u $REDIS_URL ping
   ```
2. Check memory limits:
   ```bash
   redis-cli info memory
   ```

### Safe Recovery Actions
1. **Restart Redis**:
   ```bash
   sudo systemctl restart redis-server
   # or docker restart smartfin-redis
   ```
2. **Memory Policy**: If OOM occurs, ensure `maxmemory-policy allkeys-lru` is configured in `redis.conf`.
3. **Automatic Reconnection**: Node.js and BullMQ automatically reconnect with exponential backoff.
4. **Log Verification**: Confirm `REDIS_CONNECTED` is logged upon successful reconnection.

### Verification
```bash
curl -s http://localhost:5000/health/dependencies | jq '.details.redis'
# Expected output: "HEALTHY"
```

---

## Procedure 5: FastAPI ML Service Unreachability

### Symptoms
- `/health/dependencies` reports `"fastapi": "DEGRADED"`.
- Requests to `/api/v1/ml/predictions/:ticker` return 503 `ML_INFERENCE_FAILURE`.
- Structured event: `EXTERNAL_API_FAILURE` targeting `http://localhost:8000`.

### Diagnostic Checks
1. Check FastAPI liveness directly:
   ```bash
   curl -i http://127.0.0.1:8000/health/live
   ```
2. Check Uvicorn / Gunicorn process:
   ```bash
   ps aux | grep uvicorn
   ```
3. Inspect Python process logs:
   ```bash
   tail -n 100 /var/log/smartfin/ml-service.log
   ```

### Safe Recovery Actions
1. **Restart Uvicorn Service**:
   ```bash
   sudo systemctl restart smartfin-ml
   ```
2. **Resource Exhaustion**: If OOM killer killed the process during heavy PyTorch / LSTM inference, increase memory limits or scale ML worker count.
3. **Verify Health**: Check `/health/ready` on FastAPI:
   ```bash
   curl -s http://127.0.0.1:8000/health/ready
   ```

### Verification
```bash
curl -s http://localhost:5000/health/dependencies | jq '.details.fastapi'
# Expected output: "HEALTHY"
```

---

## Procedure 6: ML Inference Failures & Missing Models

### Symptoms
- FastAPI returns 404 or 409 `MODEL_NOT_FOUND` or 500 `ML_INFERENCE_FAILURE`.
- Events logged: `ML_INFERENCE_FAILURE`.
- Note: Zero fabrication guarantee means NO synthetic predictions are delivered.

### Probable Causes
- Model artifact file missing from `ml-service/app/models/artifacts/`.
- Feature version mismatch between input data and model scaler.
- Upstream market data has NaN/Infinite values.

### Diagnostic Checks
1. Inspect model catalog:
   ```bash
   curl -s http://localhost:8000/api/v1/models/catalog | jq .
   ```
2. Check model artifact directory on filesystem:
   ```bash
   ls -la ml-service/app/models/artifacts/
   ```

### Safe Recovery Actions
1. **Re-run Pipeline**: Run training or export script for missing ticker model:
   ```bash
   cd ml-service && ./.venv/bin/python -m app.training.train_models --tickers AAPL,MSFT
   ```
2. **Promote Baseline**: If advanced model is corrupted, promote baseline model (`LinearRegression` or `RandomForest`) via `/api/v1/models/promote`.
3. **Verify Inference**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/predict/price -H "Content-Type: application/json" -d '{"symbol": "AAPL", "features": {...}}'
   ```

---

## Procedure 7: External Stock Market API Outages & Rate Limiting

### Symptoms
- Structured events: `EXTERNAL_API_FAILURE` for Alpha Vantage, Finnhub, or Yahoo Finance.
- User requests return HTTP 503 `MARKET_DATA_UNAVAILABLE`.
- Active alert: `market_api_failure`.

### Diagnostic Checks
1. Check external API response directly:
   ```bash
   curl -s "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=$ALPHA_VANTAGE_KEY" | head -n 20
   ```
2. Inspect rate limit counters in logs:
   ```bash
   grep '"EXTERNAL_API_FAILURE"' /var/log/smartfin/api.log | jq .
   ```

### Safe Recovery Actions
1. **Fallback Provider Switching**: SmartFin supports multi-provider failover. Switch `MARKET_DATA_PROVIDER` in `backend/.env` from `alpha_vantage` to `finnhub` or `yahoo`.
2. **Rate Limit Cooldown**: If using free tier (5 calls/min), enforce Redis caching TTL of 15 minutes on quote data.
3. **Strict Non-Fabrication**: Maintain honest error state `MARKET_DATA_UNAVAILABLE`. Do not guess prices.

### Verification
```bash
curl -s http://localhost:5000/health/dependencies | jq '.details.marketData'
# Expected output: "HEALTHY"
```

---

## Procedure 8: Notification Channel Dispatch Failures

### Symptoms
- Log event: `NOTIFICATION_FAILED` with `channel: "socket"` or `channel: "email"`.
- User complaints of missing budget threshold or anomaly alerts.

### Diagnostic Checks
1. Inspect notification failure logs:
   ```bash
   grep '"NOTIFICATION_FAILED"' /var/log/smartfin/api.log | jq '{channel: .metadata.channel, error: .metadata.error}'
   ```
2. Test Socket.IO gateway connection:
   ```bash
   curl -s http://localhost:5000/socket.io/?EIO=4&transport=polling
   ```

### Safe Recovery Actions
1. **In-App Store Check**: Verify database notification record was still created (`InAppChannel` is durable).
2. **Socket Gateway Reset**: Restart websocket cluster nodes if socket transport disconnected.
3. **Retry Dead Notifications**: Re-emit domain event via event bus CLI or admin script.

---

## Procedure 9: BullMQ Worker Backlog & Stalled Jobs

### Symptoms
- High queue depth reported in `/api/v1/admin/telemetry/overview`.
- `smartfin_bullmq_queue_depth` metric > 50.
- Report delivery or stock alert evaluations delayed by minutes.

### Diagnostic Checks
1. Inspect BullMQ queue depths:
   ```bash
   curl -s http://localhost:5000/metrics/json | jq '.queues'
   ```
2. Check worker concurrency and status:
   ```bash
   grep '"JOB_FAILED"' /var/log/smartfin/worker.log | jq .
   ```

### Safe Recovery Actions
1. **Scale Workers**: Spin up additional worker processes:
   ```bash
   npm run worker:stock-alert -- --concurrency=10
   ```
2. **Clear Dead-Letter Jobs**: Drain or clean failed jobs via BullMQ admin utility.
3. **Worker Timeout**: Ensure job timeouts prevent jobs from stalling indefinitely.

---

## Procedure 10: Email Delivery Outage / SMTP Failure

### Symptoms
- `NOTIFICATION_FAILED` with `channel: "email"`.
- Error: `ECONNREFUSED`, `ETIMEDOUT`, or `535 Authentication failed`.

### Diagnostic Checks
1. Test SMTP transport connectivity:
   ```bash
   nc -zv $SMTP_HOST $SMTP_PORT
   ```
2. Check email credentials in `backend/.env`.

### Safe Recovery Actions
1. **Fallback Mock Mode**: If SMTP is down in staging/testing, set `SMTP_ENABLED=false` to route emails safely to logger / mock transporter.
2. **Provider Failover**: Switch to SendGrid / AWS SES API if SMTP port is blocked by cloud hosting firewall.
3. **Verify Email**: Trigger test email via Admin Dashboard `/api/v1/admin/users/:id/verify-email`.

---

## Summary Escalation Matrix

| Priority | Condition | Immediate Action | Escalation Contact |
|---|---|---|---|
| **P1 - CRITICAL** | MongoDB Down / Data Unavailable | Run Procedure 3; Notify on-call | Lead DevOps & Database Admin |
| **P1 - CRITICAL** | 5xx Spike > 5% | Run Procedure 2; Check deployments | Backend Core Team |
| **P2 - HIGH** | FastAPI ML Service Down | Run Procedure 5; Verify PyTorch model | ML Engineering Lead |
| **P2 - HIGH** | Redis Connection Lost | Run Procedure 4 (cache fallback auto-engages) | Systems Engineering |
| **P3 - MEDIUM** | Market API Rate Limited | Run Procedure 7; Switch provider | Market Data Integrations |
| **P3 - MEDIUM** | BullMQ Backlog > 100 jobs | Run Procedure 9; Scale worker pool | DevOps / SRE |
| **P4 - LOW** | Minor Email Delivery Retries | Run Procedure 10; Check SMTP limits | Platform Operations |
