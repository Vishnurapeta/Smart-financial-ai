# SmartFin AI - Production Administration System & Admin Dashboard

## 1. Executive Architecture & Least Privilege Philosophy

The SmartFin AI Administration System is engineered to deliver centralized platform visibility, operational control, and infrastructure monitoring while strictly adhering to the **Principle of Least Privilege**.

### 1.1 The Least-Privilege Constraint
Under traditional, insecure administrative architectures, granting an administrator role often exposes unfiltered access to end-user financial records, bank accounts, and transactions. In SmartFin AI, this vulnerability is mitigated by design:
- **Zero Transaction Line Item Snooping**: Administrators and compliance officers are strictly restricted from inspecting individual user transaction descriptions, amounts, merchant names, or bank account credentials.
- **Aggregate Activity Metrics Only**: User profiles accessible to administrators provide high-level operational counts (e.g., number of budgets defined, active alerts, portfolios configured) and authentication status without exposing sensitive financial records.
- **Strict Role-Based Access Control (RBAC)**: All administrative endpoints are guarded by JWT session authentication and role validation (`ADMIN` or `SUPER_ADMIN`). Attempts by unauthorized roles trigger `PRIVILEGED_ACCESS_DENIED` security events in the immutable audit log.

```
                    ADMIN USER
                         │
                         ▼
                  Admin Frontend (React / Tailwind)
                         │
                         ▼
                 Admin API Layer (/api/v1/admin)
                         │
                 RBAC Middleware (requireAdmin)
                         │
             Permission Authorization & Hierarchy
                         │
              ┌──────────┴──────────┐
              │                     │
        Admin Services        Audit Service (Immutable)
              │                     │
      ┌───────┼────────┐            │
      │       │        │            │
   Metrics  Users   System Health   │
      │       │        │            │
      └───────┼────────┘            │
              │                     │
    MongoDB / Redis / BullMQ / Telemetry
```

---

## 2. RBAC & Privilege Hierarchy

The platform defines distinct security roles in `backend/src/models/role.model.ts`:

| Role | Scope & Permissions |
|---|---|
| `USER` | Standard financial intelligence consumer (budgets, transactions, portfolios, AI assistant). |
| `PREMIUM_USER` | High-frequency stock predictions, priority notifications, and extended forecasting. |
| `FINANCIAL_ANALYST` | Advanced portfolio risk analysis and cross-market data modeling. |
| `COMPLIANCE_OFFICER` | Read-only audit log inspection and compliance verification. |
| `ADMIN` | Platform metrics, user status management, system diagnostics, and queue monitoring. |
| `SUPER_ADMIN` | Root administrative authority; can assign or revoke administrative roles. |

### 2.1 Role Elevation and Hierarchy Rules
1. **No Self-Demotion**: Administrators cannot demote or alter their own role, preventing accidental platform lockout.
2. **SUPER_ADMIN Exclusivity**: Only users possessing the `SUPER_ADMIN` role can elevate any user to `SUPER_ADMIN`.
3. **No Unilateral Alteration of SUPER_ADMIN**: Standard `ADMIN` users cannot modify or demote a `SUPER_ADMIN`.

---

## 3. Subsystem Health & Infrastructure Telemetry

### 3.1 Platform Overview Aggregator
- **Total & Active Users**: Real-time counts of registered users, users active within the last 30 days, suspended accounts, and locked accounts.
- **Domain Totals**: Aggregated counts of platform transactions, budgets, financial goals, portfolios, ML predictions, and generated PDF reports.
- **Security Incidents**: 24-hour window counts of failed login attempts (`AUTH_LOGIN_FAILED`) and unauthorized privileged access denials (`PRIVILEGED_ACCESS_DENIED`).

### 3.2 Infrastructure & Runtime Telemetry
- **Node.js Process**: V8 Heap utilization percentage, Heap Used, Heap Total, Resident Set Size (RSS), External Buffers, Node.js version, platform, architecture, and uptime.
- **MongoDB**: Replica/cluster connection state, ping round-trip latency (`admin().ping()`), and target database name.
- **Redis & Queues**: Connection state and distributed cache key health.
- **FastAPI ML Microservice**: Live health ping to `${ML_SERVICE_URL}/health`, verifying NLP categorization and prediction engines.

### 3.3 BullMQ Queue Monitoring
The system introspects 5 mission-critical BullMQ queues:
1. `stock-alert-evaluation`: Real-time stock price and percentage change threshold evaluations.
2. `notification-dispatch`: Multi-channel notification routing and prioritization.
3. `notification-email`: SMTP/mock transactional email delivery queue.
4. `notification-scheduler`: Automated recurring digest and subscription checks.
5. `financial-report-processing`: High-fidelity vector PDF generation and email distribution.

Each queue reports live job counts: `waiting`, `active`, `completed`, `failed`, `delayed`.

---

## 4. Subsystem Monitoring

### 4.1 ML & AI Telemetry
- **Transaction Categorization**: Total user feedbacks recorded, accuracy rate (`userAccepted` percentage), and correction distribution.
- **Model Metadata**: Active model registry with framework (`SCIKIT_LEARN`, `XGBOOST`, `PYTORCH`, `PROPHET`), version, dataset size, and accuracy metrics.
- **AI Assistant**: Total queries processed, total tokens consumed, average query latency (ms), intent distribution (`BUDGET_INQUIRY`, `EXPENSE_ANALYSIS`, `PORTFOLIO_REVIEW`, `MARKET_LOOKUP`, `GENERAL_FINANCE`), and user feedback ratings (`HELPFUL`, `UNHELPFUL`, `UNRATED`).

### 4.2 Stock API & Market Data Monitoring
- **Active Market Provider**: Current active provider (`MockMarketDataProvider`, `Finnhub`, or `AlphaVantage`).
- **Cached Price Quotes**: Total cached quote records in MongoDB.
- **Stock Predictions**: Total predictions generated, breakdown by evaluation status (`EVALUATED` vs `PENDING_EVALUATION`), and horizon distribution (`1D`, `5D`, `10D`, `30D`, `90D`).

### 4.3 Notification Channel Deliveries
- **Channel Delivery Volume**: Breakdown across `IN_APP`, `WEBSOCKET`, `EMAIL`, and `PUSH`.
- **Delivery Rate & Failure Rate**: Real-time percentages calculated from `NotificationDelivery`.
- **Failure Log Stream**: Inspects recent failed attempts, recipient addresses, and provider error messages.

### 4.4 API Telemetry & Error Monitor
- **HTTP Status Distribution**: Rolling counters for `2xx` (success), `3xx` (redirect), `4xx` (client errors), and `5xx` (server faults).
- **Latency Percentiles**: Average response time, 95th percentile (p95), and maximum latency.
- **Recent Error Stream**: Captures timestamp, HTTP method, URL, status code, duration, and correlation ID for rapid incident triage.

---

## 5. User Account Management

Administrators can execute privileged user account operations from `/admin/users`:

| Action | API Endpoint | Description |
|---|---|---|
| **List Users** | `GET /api/v1/admin/users` | Paginated search by name/email with role and status filtering. Least-privilege projection applied. |
| **User Details** | `GET /api/v1/admin/users/:id` | Non-sensitive account metadata and activity summary counts. Personal transactions sealed. |
| **Update Status** | `PATCH /api/v1/admin/users/:id/status` | Actions: `SUSPEND`, `REACTIVATE`, `LOCK`, `UNLOCK`. Rejects self-suspension. Writes immutable audit log. |
| **Assign Role** | `PATCH /api/v1/admin/users/:id/role` | Elevates or demotes user role according to RBAC hierarchy rules. Writes immutable audit log. |
| **Verify Email** | `POST /api/v1/admin/users/:id/verify-email` | Manually marks user email as verified. |
| **Reset Password** | `POST /api/v1/admin/users/:id/reset-password` | Generates a 1-hour secure password reset token. |

---

## 6. Immutable Audit Trail

Every privileged administrative operation, authentication failure, and security violation is recorded permanently in the `AuditLog` collection.

### 6.1 Audit Log Schema
```typescript
interface IAuditLog {
  userId?: ObjectId;        // Actor ID
  actorRole: string;        // 'ADMIN', 'SUPER_ADMIN', 'USER', 'ANONYMOUS'
  action: string;           // E.g. 'ADMIN_USER_STATUS_SUSPEND', 'PRIVILEGED_ACCESS_DENIED'
  resource: string;         // 'User', 'SystemSettings', '/api/v1/admin/...'
  resourceId?: string;      // Target entity ID
  ipAddress: string;        // Client IP
  userAgent: string;        // Browser / Agent
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  status: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  timestamp: Date;
}
```

### 6.2 Audit Queries & Statistics
- `GET /api/v1/admin/audit-logs`: Filter by action, actorRole, status (`SUCCESS` / `FAILURE`), resource, date range, or keyword search.
- `GET /api/v1/admin/audit-logs/stats`: Returns total event counts, success vs. failure breakdown, and top recorded actions.

---

## 7. Automated Test Suite

The administration system is covered by comprehensive integration tests in `backend/tests/admin-dashboard.test.ts`:

- **23/23 Admin Tests Passed**:
  - `401 Unauthorized` on missing token.
  - `403 Forbidden` on non-admin user + `PRIVILEGED_ACCESS_DENIED` audit log verification.
  - Successful access by `ADMIN` and `SUPER_ADMIN`.
  - Platform overview metrics accuracy.
  - System health, Node.js memory, and MongoDB ping verification.
  - Queue depth structure across all 5 queues.
  - Feature metrics for ML, AI Assistant, and Stock APIs.
  - User search, pagination, and least-privilege projection (zero leaked passwords or transaction items).
  - Account suspension, login denial for suspended user, and reactivation.
  - Account 24-hour lockout and unlocking.
  - Self-suspension and self-demotion prevention.
  - Role hierarchy validation (`ADMIN` cannot assign `SUPER_ADMIN`).
  - Manual email verification and administrative password reset token generation.
  - Audit trail query filtering and summary statistics.
- **Entire Monorepo Backend**: 17/17 test suites passed, 167/167 tests passed.
- **Frontend Build**: `tsc && vite build` bundled cleanly with zero errors.
