# SMARTFIN AI — API Specification & Integration Contract

**Enterprise Personal Finance & Investment Intelligence Platform**  
*Document Version: 1.0.0 | Status: Approved API Specification*

---

## 1. RESTful API Architecture & Design Principles

The SMARTFIN AI backend exposes a strictly typed, versioned RESTful API under the base path:
```
https://api.smartfin.ai/api/v1
```

### 1.1 Core API Rules
1. **Predictable JSON Envelopes**: All endpoints respond with a standardized envelope structure for both successes and errors.
2. **Stateless Authentication**: Protected endpoints require a Bearer JSON Web Token (JWT) in the `Authorization` header.
3. **Idempotency**: All mutation requests (`POST`, `PUT`, `PATCH`) on financial ledgers support the `X-Idempotency-Key` header (UUIDv4) to prevent duplicate processing.
4. **Distributed Tracing**: Every inbound request receives or forwards an `X-Correlation-ID` header, which is passed down through all logs, workers, and downstream microservice invocations.
5. **Strict Input Sanitization**: All incoming query parameters, headers, and request bodies are validated against runtime Zod schemas.

---

## 2. Standard API Envelopes & Error Model

### 2.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 142,
    "totalPages": 6,
    "timestamp": "2026-09-26T23:45:00.000Z"
  },
  "error": null
}
```

### 2.2 Standard Error Envelope
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more input fields failed validation.",
    "details": [
      {
        "field": "amount",
        "message": "Transaction amount must be a positive number greater than 0."
      }
    ],
    "traceId": "c3a10408-20bd-4fa6-8e5c-0bcbb02999e2"
  }
}
```

### 2.3 Global Standard Error Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Malformed JSON or unparseable payload |
| `400` | `VALIDATION_FAILED` | Input fields failed Zod schema rules |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired JWT |
| `401` | `MFA_REQUIRED` | Valid credentials provided, but TOTP token required |
| `403` | `FORBIDDEN` | Insufficient RBAC permissions to access resource |
| `404` | `NOT_FOUND` | Requested entity does not exist |
| `409` | `CONFLICT` | Resource already exists or duplicate transaction hash |
| `422` | `UNPROCESSABLE_ENTITY` | Business rule violation (e.g. transfer to same account) |
| `429` | `RATE_LIMIT_EXCEEDED` | Request threshold exceeded for IP or user |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected unhandled server exception |
| `503` | `SERVICE_UNAVAILABLE` | Downstream market provider or ML service unreachable |

---

## 3. API Module Catalog

### 3.1 Authentication & Identity (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new user account with email, password, profile |
| `POST` | `/auth/login` | Public | Authenticate with credentials; returns JWT + sets refresh cookie |
| `POST` | `/auth/refresh-token` | Public (Cookie) | Exchange single-use refresh token for new access token |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token and blacklist access token JTI |
| `POST` | `/auth/mfa/setup` | Authenticated | Generate TOTP QR code and setup secret |
| `POST` | `/auth/mfa/verify` | Authenticated | Confirm TOTP setup with initial 6-digit code |
| `POST` | `/auth/mfa/validate` | Public | Complete login flow when MFA is enabled |
| `POST` | `/auth/forgot-password`| Public | Initiate password reset email flow |
| `POST` | `/auth/reset-password` | Public | Reset password using valid cryptographic token |
| `GET` | `/auth/me` | Authenticated | Fetch current user session details & permissions |

---

### 3.2 User Management (`/api/v1/users`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/profile` | Authenticated | Retrieve authenticated user profile & preferences |
| `PATCH` | `/users/profile` | Authenticated | Update user name, default currency, and locale |
| `PATCH` | `/users/password` | Authenticated | Change user password (requires current password) |
| `PATCH` | `/users/preferences` | Authenticated | Update notification, theme, and UI settings |
| `DELETE`| `/users/account` | Authenticated | Request user account deletion & data scrub |

---

### 3.3 Financial Accounts (`/api/v1/accounts`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/accounts` | Authenticated | List all active financial accounts for user |
| `POST` | `/accounts` | Authenticated | Create a new manual or tracked account |
| `GET` | `/accounts/:id` | Authenticated | Get detailed account information and statistics |
| `PATCH` | `/accounts/:id` | Authenticated | Update account name, type, or credit limit |
| `DELETE`| `/accounts/:id` | Authenticated | Soft-delete/deactivate account |
| `GET` | `/accounts/summary/balances` | Authenticated | Aggregate balances by account category (cash, debts, investments) |

---

### 3.4 Transactions & Ingestion (`/api/v1/transactions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/transactions` | Authenticated | Filtered, sorted, paginated transaction query |
| `POST` | `/transactions` | Authenticated | Create a single transaction (with atomic balance update) |
| `GET` | `/transactions/:id` | Authenticated | Fetch single transaction by ID |
| `PATCH` | `/transactions/:id` | Authenticated | Update transaction details, category, tags, or notes |
| `DELETE`| `/transactions/:id` | Authenticated | Delete transaction and revert balance change |
| `POST` | `/transactions/import` | Authenticated | Multipart CSV upload for bulk transaction ingestion |
| `POST` | `/transactions/:id/split` | Authenticated | Split a single transaction into multiple categories |
| `GET` | `/transactions/export` | Authenticated | Export transactions as CSV or PDF report |

*Query Parameters for `GET /transactions`:*
- `page` (default: 1), `limit` (default: 25, max: 100)
- `startDate`, `endDate` (ISO 8601)
- `accountId` (optional filter)
- `categoryId` (optional filter)
- `type` (`DEBIT` | `CREDIT` | `TRANSFER`)
- `minAmount`, `maxAmount`
- `search` (merchant or description text)
- `sortBy` (`transactionDate` | `amount`), `sortOrder` (`asc` | `desc`)

---

### 3.5 Categories & Budgets (`/api/v1/categories`, `/api/v1/budgets`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Authenticated | List standard system and user custom categories |
| `POST` | `/categories` | Authenticated | Create custom user category |
| `PATCH` | `/categories/:id` | Authenticated | Update custom category name, icon, or color |
| `DELETE`| `/categories/:id` | Authenticated | Remove custom category (reassigns transactions) |
| `GET` | `/budgets` | Authenticated | List active budgets with real-time spending progress |
| `POST` | `/budgets` | Authenticated | Set budget limit for category and period |
| `PATCH` | `/budgets/:id` | Authenticated | Update budget limit amount or alert thresholds |
| `DELETE`| `/budgets/:id` | Authenticated | Remove budget rule |
| `GET` | `/budgets/summary` | Authenticated | Overall monthly budget vs. actual spending gauge |

---

### 3.6 Subscriptions & Recurring Bills (`/api/v1/subscriptions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/subscriptions` | Authenticated | List identified recurring expenses and subscriptions |
| `POST` | `/subscriptions/detect` | Authenticated | Trigger asynchronous ML subscription detection job |
| `PATCH` | `/subscriptions/:id` | Authenticated | Update subscription cadence, amount, or alert settings |
| `DELETE`| `/subscriptions/:id` | Authenticated | Archive subscription tracking |

---

### 3.7 Financial Goals (`/api/v1/goals`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/goals` | Authenticated | List all active and completed financial goals |
| `POST` | `/goals` | Authenticated | Create new savings or investment target goal |
| `GET` | `/goals/:id` | Authenticated | Get goal details, milestone breakdown, and forecast |
| `PATCH` | `/goals/:id` | Authenticated | Update target amount, deadline, or linked accounts |
| `DELETE`| `/goals/:id` | Authenticated | Delete financial goal |

---

### 3.8 Financial Analytics & Net Worth (`/api/v1/analytics`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/analytics/net-worth` | Authenticated | Historical net worth progression timeline |
| `GET` | `/analytics/spending/by-category` | Authenticated | Aggregate spending grouped by category for timeframe |
| `GET` | `/analytics/cash-flow` | Authenticated | Monthly income vs. expense cash-flow trend |
| `GET` | `/analytics/financial-health` | Authenticated | Comprehensive financial wellness score (0-100) |

---

### 3.9 Stock Market & Watchlists (`/api/v1/stocks`, `/api/v1/watchlists`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/stocks/search?q={query}` | Authenticated | Search stock symbols and company names (cached 30m) |
| `GET` | `/stocks/:symbol/quote` | Authenticated | Real-time quote: price, prev close, change, volume, 52W high/low (cached 60s) |
| `GET` | `/stocks/:symbol/history?range={range}&interval={interval}` | Authenticated | Historical OHLCV candle bars (cached 5m) |
| `GET` | `/stocks/alerts` | Authenticated | List user active & triggered stock alert rules |
| `POST` | `/stocks/alerts` | Authenticated | Create configurable stock alert rule (`PRICE_ABOVE`, `PRICE_BELOW`, etc.) |
| `GET` | `/stocks/alerts/:id` | Authenticated | Get alert rule details |
| `PATCH`| `/stocks/alerts/:id` | Authenticated | Update alert threshold, cooldown, or active status |
| `DELETE`| `/stocks/alerts/:id` | Authenticated | Delete stock alert rule |
| `POST` | `/stocks/alerts/evaluate` | Authenticated | Trigger BullMQ background evaluation job immediately |
| `GET` | `/watchlists` | Authenticated | List user watchlists enriched with real-time quotes |
| `POST` | `/watchlists` | Authenticated | Create new watchlist |
| `GET` | `/watchlists/:id` | Authenticated | Get specific watchlist with real-time quotes |
| `POST` | `/watchlists/:id/symbols` | Authenticated | Add symbol to watchlist with optional target buy/sell |
| `DELETE`| `/watchlists/:id/symbols/:symbol` | Authenticated | Remove symbol from watchlist |
| `DELETE`| `/watchlists/:id` | Authenticated | Delete watchlist |

---

### 3.9.1 Notifications & Preferences (`/api/v1/notifications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Authenticated | Paginated informational notifications (`?type=STOCK_ALERT`) |
| `GET` | `/notifications/unread-count` | Authenticated | Get unread notification badge counter |
| `PATCH`| `/notifications/:id/read` | Authenticated | Mark notification as read |
| `PATCH`| `/notifications/read-all` | Authenticated | Mark all notifications as read |
| `GET` | `/notifications/preferences` | Authenticated | Get notification preferences (delivery channels, cooldown) |
| `PATCH`| `/notifications/preferences` | Authenticated | Update notification delivery preferences & anti-spam caps |

---

### 3.10 Investment Portfolios & Holdings (`/api/v1/portfolios`, `/api/v1/investments/portfolios`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/portfolios` | Authenticated | List all user portfolios with marked-to-market summaries (auto-provisions default) |
| `POST` | `/portfolios` | Authenticated | Create a new investment portfolio (name, currency, cash, benchmark) |
| `GET` | `/portfolios/:id` | Authenticated | Get specific portfolio summary with live marked-to-market valuations |
| `PATCH` | `/portfolios/:id` | Authenticated | Update portfolio details (name, description, cash balance, benchmark) |
| `DELETE` | `/portfolios/:id` | Authenticated | Soft-delete a portfolio and remove associated holdings |
| `GET` | `/portfolios/:id/dashboard` | Authenticated | Comprehensive dashboard: marked holdings, asset allocation, sector breakdown, best/worst performance & AI forecast integration |
| `POST` | `/portfolios/:id/holdings` | Authenticated | Add holding position or buy lot (recalculates weighted average buy price) |
| `PATCH` | `/portfolios/:id/holdings/:holdingId` | Authenticated | Edit holding (quantity, average buy price, sector, notes) |
| `DELETE` | `/portfolios/:id/holdings/:holdingId` | Authenticated | Remove holding position and associated lots |


---

### 3.11 Machine Learning Forecasts & Anomalies (`/api/v1/forecasts`, `/api/v1/anomalies`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/forecasts/expenses` | Authenticated | 30/60/90-day expense projection with confidence intervals |
| `GET` | `/forecasts/cashflow` | Authenticated | Projected daily cash balances and burn rate |
| `GET` | `/forecasts/stock/:symbol` | Authenticated | ML price trend & volatility forecast for stock |
| `GET` | `/anomalies` | Authenticated | List flagged anomalous transactions |
| `POST` | `/anomalies/:id/acknowledge`| Authenticated | Acknowledge anomaly and provide user feedback |

---

### 3.12 AI Financial Assistant FinBot (`/api/v1/assistant`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/assistant/chat` | Authenticated | Send natural language prompt and receive advice |
| `GET` | `/assistant/history` | Authenticated | Retrieve conversation history sessions |
| `DELETE`| `/assistant/history` | Authenticated | Clear user conversation history |

---

### 3.13 Admin & Compliance (`/api/v1/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | Admin Only | Paginated user management table |
| `PATCH` | `/admin/users/:id/status` | Admin Only | Lock, unlock, or suspend user account |
| `PATCH` | `/admin/users/:id/role` | SuperAdmin | Assign or revoke roles (e.g. FINANCIAL_ANALYST) |
| `GET` | `/admin/audit-logs` | Compliance/Admin| Immutable audit trail with multi-filter |
| `GET` | `/admin/system/health` | Admin Only | Server memory, database connections, Redis queues |

---

### 3.14 ML Stock Prediction & Model Registry (`/api/v1/predictions`, `/api/v1/models`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/predictions/stock` | Authenticated | Generate real-time stock prediction from registered ML model (`XGBoost`, `RandomForest`, `LinearRegression`, `LSTM`, `Naive`). Supports `target_next_close` and `target_next_return`. |
| `GET` | `/predictions/stock/:symbol/history` | Authenticated | Paginated inference audit history filtered by symbol, horizon, model, and date range. |
| `GET` | `/models/stock` | Authenticated | List registered stock models with public metadata cards (no file paths exposed). Filter by symbol, status, target. |
| `GET` | `/models/stock/:symbol/metrics` | Authenticated | Historical validation & test evaluation metrics (MAE, RMSE, R², Directional Accuracy) across models for a ticker. |
| `POST` | `/models/stock/:modelId/promote` | Admin / ML Lead | Promote or demote model lifecycle status (`PRODUCTION`, `CANDIDATE`, `RETIRED`). Automatically flushes cache. |
| `GET` | `/models/stock/cache/stats` | Admin Only | Model cache statistics (size, capacity, cached model IDs). |
| `POST` | `/models/stock/cache/clear` | Admin Only | Manually flush in-memory model cache. |

---

### 3.15 Personal Financial Forecasting (`/api/v1/forecasts`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/forecasts/expenses` | Authenticated | Generates out-of-sample forward expense forecast for the authenticated user ($h=1, 3, 6$ months). Supports optional category filter and preferred model. |
| `GET` | `/forecasts/cash-flow` | Authenticated | Projects multi-period cash flow by synthesizing expected income, predicted expenses, planned savings goals, and fixed recurring obligations. |
| `GET` | `/forecasts/history` | Authenticated | Retrieves user's audit trail of past generated forecasts with model metadata, validation metrics, and timestamps. |
| `POST` | `/forecasts/expenses` (FastAPI) | Service Auth | Microservice core endpoint: feature engineering, holdout cross-validation, and multi-period forward expense prediction. |
| `POST` | `/forecasts/cash-flow` (FastAPI) | Service Auth | Microservice core endpoint: cash-flow liquidity synthesis and deficit detection. |
| `GET` | `/forecasts/models` (FastAPI) | Service Auth | List supported forecasting architectures (Moving Average, Linear Regression, Random Forest, XGBoost) and default champion. |

---

### 3.16 Financial Anomaly Detection (`/api/v1/anomalies`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/anomalies/detect` | Authenticated | Triggers anomaly detection for the authenticated user. Evaluates transactions using robust Modified Z-score and Isolation Forest, upserts records idempotently, and dispatches deduplicated notifications. |
| `GET` | `/anomalies` | Authenticated | Retrieves paginated list of anomalies. Supports filters: `status`, `anomalyType`, `severity`, `category`, `merchant`, `startDate`, `endDate`, `page`, `limit`. |
| `GET` | `/anomalies/summary` | Authenticated | Aggregates summary statistics by status (`new`, `reviewed`, `confirmedUnusual`, `dismissed`, `resolved`) and severity (`high`, `medium`, `low`). |
| `GET` | `/anomalies/:id` | Authenticated | Retrieves a single anomaly with contributing feature signals and transaction details. Strictly IDOR protected. |
| `PATCH` | `/anomalies/:id/status` | Authenticated | Updates anomaly review status (`NEW`, `REVIEWED`, `DISMISSED`, `CONFIRMED_UNUSUAL`, `RESOLVED`). |
| `POST` | `/anomalies/:id/feedback` | Authenticated | Records user feedback (`EXPECTED`, `UNUSUAL`, `DISMISSED`) with optional notes and transitions status. |
---

### 3.17 Financial Reporting (`/api/v1/reports`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/reports/monthly` | Authenticated | Requests or regenerates a Monthly Financial Report. Enqueues generation job in BullMQ or returns cached report if identical period already exists. Rate limited. |
| `GET` | `/reports` | Authenticated | Retrieves paginated list of user's financial reports. Supports filters: `year`, `month`, `status`, `reportType`, `page`, `limit`. |
| `GET` | `/reports/:id` | Authenticated | Retrieves a single financial report with immutable data snapshot and metadata. Strict IDOR protection. |
| `GET` | `/reports/:id/pdf` | Authenticated | Securely streams multi-page vector PDF generated via PDFKit with attachment headers. Owner verification required. |
| `POST` | `/reports/:id/email` | Authenticated | Triggers asynchronous delivery of report summary and link to authenticated user's verified email. |
| `DELETE` | `/reports/:id` | Authenticated | Soft-deletes financial report record for the authenticated owner. |

---

## 4. Socket.IO Real-Time Event Protocol

### 4.1 Connection & Handshake
- **URL**: `wss://api.smartfin.ai/socket.io/`
- **Auth**: Pass `{ auth: { token: "<JWT_ACCESS_TOKEN>" } }` in the connection handshake.
- **Namespaces**:
  - `/market`: Real-time stock quotes and market movers.
  - `/alerts`: In-app push notifications and budget warnings.
  - Default namespace: User-isolated room `user:${userId}` for asynchronous background task events.

### 4.2 Events Specification
| Namespace | Direction | Event Name | Payload | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/market` | Client -> Server | `subscribe:symbol` | `{ "symbol": "AAPL" }` | Join room for symbol updates |
| `/market` | Client -> Server | `unsubscribe:symbol`| `{ "symbol": "AAPL" }` | Leave room |
| `/market` | Server -> Client | `quote:update` | `{ "symbol": "AAPL", "price": 182.45, "change": 1.25, "timestamp": "..." }` | Pushed quote update |
| `/alerts` | Server -> Client | `alert:budget` | `{ "budgetId": "...", "category": "Dining", "percent": 85 }` | 80%/100% threshold alert |
| `/alerts` | Server -> Client | `alert:price` | `{ "symbol": "TSLA", "target": 250, "currentPrice": 251.2 }` | Target price alert |
| `/alerts` | Server -> Client | `alert:anomaly` | `{ "transactionId": "...", "merchant": "Unusual Store", "amount": 950 }` | Unacknowledged anomaly |
| Default | Server -> Client | `report:generating` | `{ "reportId": "...", "year": 2026, "month": 9 }` | Real-time report generation in progress |
| Default | Server -> Client | `report:ready` | `{ "reportId": "...", "status": "READY", "periodLabel": "September 2026" }` | Real-time report completion notice |
| Default | Server -> Client | `report:failed` | `{ "reportId": "...", "errorMessage": "..." }` | Real-time report failure notification |

---

## 5. Administration & Infrastructure Monitoring Endpoints

All endpoints below require authentication with the `ADMIN` or `SUPER_ADMIN` role. Personal financial transaction items, merchant details, and bank balances are strictly sealed under the Principle of Least Privilege.

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/metrics/overview` | `ADMIN` / `SUPER_ADMIN` | Platform metrics: total/active/suspended users, domain aggregates, security counts. |
| `GET` | `/admin/metrics/features` | `ADMIN` / `SUPER_ADMIN` | Subsystem telemetry: ML accuracy, active models, AI query tokens, and stock provider. |
| `GET` | `/admin/metrics/telemetry`| `ADMIN` / `SUPER_ADMIN` | API telemetry: HTTP status distribution (2xx/3xx/4xx/5xx), p95 latency, error logs. |
| `GET` | `/admin/metrics/security` | `ADMIN` / `SUPER_ADMIN` | Security posture: MFA adoption rate, locked accounts count, incident stream. |
| `GET` | `/admin/system/health`    | `ADMIN` / `SUPER_ADMIN` | Infrastructure health: Node.js runtime memory, MongoDB ping, Redis status, ML ping. |
| `GET` | `/admin/queues`           | `ADMIN` / `SUPER_ADMIN` | BullMQ queue monitoring: job depths (waiting, active, completed, failed, delayed). |
| `GET` | `/admin/users`            | `ADMIN` / `SUPER_ADMIN` | Paginated search of user accounts. Least-privilege projection (zero transaction lines). |
| `GET` | `/admin/users/:id`        | `ADMIN` / `SUPER_ADMIN` | User account summary and metadata counts. |
| `PATCH` | `/admin/users/:id/status`| `ADMIN` / `SUPER_ADMIN` | Account actions: `SUSPEND`, `REACTIVATE`, `LOCK`, `UNLOCK`. Logs immutable audit record. |
| `PATCH` | `/admin/users/:id/role`  | `ADMIN` / `SUPER_ADMIN` | Updates user role (RBAC hierarchy enforced; only `SUPER_ADMIN` can assign `SUPER_ADMIN`). |
| `POST` | `/admin/users/:id/verify-email` | `ADMIN` / `SUPER_ADMIN` | Manually verifies user email. |
| `POST` | `/admin/users/:id/reset-password` | `ADMIN` / `SUPER_ADMIN` | Issues 1-hour secure password reset token. |
| `GET` | `/admin/audit-logs`       | `ADMIN` / `SUPER_ADMIN` | Paginated immutable audit trail with action, actor, status, and date range filtering. |
| `GET` | `/admin/audit-logs/stats` | `ADMIN` / `SUPER_ADMIN` | Aggregate audit stats: success rate, failure counts, and top actions. |

