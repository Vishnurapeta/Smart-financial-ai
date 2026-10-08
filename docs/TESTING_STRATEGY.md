# SmartFin AI — Complete Testing Strategy & Quality Assurance Architecture

**Enterprise Personal Finance & Investment Intelligence Platform**  
*Document Version: 2.0.0 | System Testing & Validation Phase*  
*Last Updated: September 27, 2026*  

---

## 1. System Architecture & Communication Dependency Map

SmartFin AI coordinates multi-tiered asynchronous, real-time, and analytical workflows across three primary communication channels:

### 1.1 Core Request-Response Pipeline
```
[ Frontend Client (React / TypeScript / Vite) ]
                      │
                      ▼ (HTTPS / REST JSON / JWT Bearer)
[ Node.js / Express API Gateway & Perimeter ]
  ├─ Helmet (CSP, HSTS, X-Frame-Options: DENY, nosniff)
  ├─ CORS (Strict Whitelist: dev, staging, prod)
  ├─ Express Rate Limiters (Auth, AI, Stock, Admin, Reports)
  └─ NoSQL Sanitizer (Recursive key stripping for $ and .)
                      │
                      ▼
            [ Application Services ]
  ├─ AuthService & Session Management
  ├─ TransactionService & Balance Ledger
  ├─ BudgetService & Threshold Tracking
  ├─ WealthService (Assets, Liabilities, Net Worth)
  ├─ PortfolioService & Holdings Reconciliation
  ├─ StockMarketService (Quotes, OHLC Validation, Caching)
  ├─ AnomalyDetectionService & ForecastService
  ├─ AIAssistantService (Prompt Guard, Tool Execution)
  └─ AdminService (RBAC, Telemetry, Audit Logs)
                      │
        ┌─────────────┼─────────────────────────┐
        ▼             ▼                         ▼
  [ MongoDB ]     [ Redis ]            [ External Market APIs ]
  (Primary Data)  (Cache & Sessions)   (Yahoo, Finnhub, Alpha Vantage)
        │
        └───────────────────────────────────────┐
                                                ▼
                                    [ FastAPI ML Microservice ]
                                    (Scikit-Learn, PyTorch, XGBoost)
                                    - Categorization & Anomaly Scorer
                                    - Time-Series Stock Prediction
                                    - Cash-Flow & Expense Forecaster
```

### 1.2 Asynchronous Job & Worker Pipeline
```
[ Node.js Application Layer ]
            │
            ▼ (Job Dispatch)
      [ BullMQ Engine ]
  ├─ report-generation-queue
  ├─ stock-alert-eval-queue
  └─ notification-dispatch-queue
            │
            ▼
      [ Redis Server ]
      (In-Memory Job Broker / Resilient In-Memory Fallback)
            │
            ▼ (Distributed Execution)
   [ Background Workers ]
  ├─ Report Worker (PDFKit Generator, Aggregator)
  ├─ Stock Alert Worker (Price Threshold Evaluator)
  └─ Notification Worker (Email Channel, In-App Dispatcher)
```

### 1.3 Real-Time WebSocket Channel
```
[ Node.js API Server ]
          │ (Internal Domain Event Bus)
          ▼
   [ Socket.IO Engine ]
  (Handshake JWT Authentication, Per-User Isolated Rooms: user_${userId})
          │
          ▼ (Real-Time Bi-Directional WebSocket)
[ Frontend Client Dashboard / Notifications Feed ]
```

---

## 2. Layered Testing Architecture

SmartFin AI mandates a layered testing strategy ensuring functional correctness, multi-tenant security, and zero data leakage:

```
          / \
         / E2E \         15%  (Full User, Admin & Security Journeys: 21 Steps)
        /-------\
       / Integr. \       35%  (Supertest + MongoMemoryServer + Redis + FastAPI TestClient)
      /-----------\
     /    Unit     \     50%  (Vitest + Pytest: Financial math, ML models, Validators)
    /---------------\
```

### 2.1 The 15 Testing Dimensions:
1. **Unit Tests:** Pure functions (TWR, Net Worth, decimal rounding, token helpers, regex escaping).
2. **Integration Tests:** Express routes down through middleware to database persistence and cache.
3. **API Contract Tests:** Request/response schemas, HTTP status codes, and standardized error envelopes.
4. **Database & Index Tests:** Schema validation, compound indexes (`userId`, `date`, `status`), and cascading soft deletes.
5. **Authentication Tests:** Registration, login, password reset, token rotation, and suspension revocation.
6. **Authorization & RBAC Tests:** Role hierarchy matrix (`USER`, `FINANCIAL_ANALYST`, `ADMIN`, `SUPER_ADMIN`).
7. **Security Tests:** IDOR, NoSQL injection, SSRF, path traversal, algorithm confusion, and ReDoS.
8. **ML Pipeline Tests:** Walk-forward validation, zero lookahead leakage, scaler training isolation.
9. **AI Tool Tests:** Grounded responses, strict `req.user.id` derivation, and prompt injection defense.
10. **WebSocket Tests:** Token authentication, user-specific room isolation, event authorization.
11. **Background Job Tests:** BullMQ queue creation, job lifecycle, retries, and exponential backoff.
12. **Notification Tests:** Multi-channel dispatch (Email, In-App, Socket), deduplication cooldown.
13. **Report Generation Tests:** Immutable snapshots, financial aggregation accuracy, PDF streaming.
14. **End-to-End Journeys:** Complete 21-step user financial lifecycle and 8-step admin operational journey.
15. **Performance & Degradation Tests:** Resilient in-memory fallback during Redis or FastAPI outages.

---

## 3. Dedicated Test Environments & Data Isolation

### 3.1 Strict Isolation Rules
- **Zero Production Contamination:** Automated test suites strictly connect to dedicated test databases (`mongodb://localhost:27017/smartfin_test_*` or `MongoMemoryServer`).
- **Zero Real Email Dispatch:** Email transports in testing utilize mock mailer transports (`mock mailer transport`); real user financial statements are never emailed during tests.
- **Per-Suite Teardown:** Every test file utilizes `beforeEach` database clearing (`deleteMany({})`) ensuring zero cross-test state leakage.
- **Deterministic Fixtures:** Test data relies on generated object IDs and deterministic values without hardcoding production credentials.

---

## 4. Test Matrix & Privileged Access Control

| Endpoint Category | Public | USER | FINANCIAL_ANALYST | ADMIN | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/auth/register`, `/login` | **YES** | **YES** | **YES** | **YES** | **YES** |
| `/api/v1/transactions` (Own Data) | NO | **YES** | **YES** | **YES** | **YES** |
| `/api/v1/transactions` (Other User) | NO | **BLOCKED (403/404)** | **BLOCKED (403/404)** | **BLOCKED (403/404)** | **BLOCKED (403/404)** |
| `/api/v1/portfolios`, `/goals` | NO | **YES** | **YES** | **YES** | **YES** |
| `/api/v1/admin/metrics/*` | NO | **BLOCKED (403)** | **BLOCKED (403)** | **YES** | **YES** |
| `/api/v1/admin/users/:id/role` | NO | **BLOCKED (403)** | **BLOCKED (403)** | **YES (Non-Super)** | **YES** |
| `/api/v1/admin/audit-logs` | NO | **BLOCKED (403)** | **BLOCKED (403)** | **YES** | **YES** |

---

## 5. End-to-End Testing Suites

SmartFin AI validates the complete platform via three full-scale journeys in `backend/tests/e2e-journeys.test.ts`:

1. **User End-to-End Lifecycle Journey (21 Sequential Milestones):**
   - Registration $\rightarrow$ Login $\rightarrow$ Income $\rightarrow$ Expense $\rightarrow$ ML Categorization $\rightarrow$ Budget $\rightarrow$ Recurring Expense $\rightarrow$ Goal $\rightarrow$ Portfolio & Holding $\rightarrow$ Watchlist & Symbol $\rightarrow$ Stock History $\rightarrow$ Stock ML Prediction $\rightarrow$ Model Metrics Catalog $\rightarrow$ Expense Forecast $\rightarrow$ Cash-Flow Forecast $\rightarrow$ Anomaly Summary $\rightarrow$ AI Assistant Interaction $\rightarrow$ Notifications $\rightarrow$ Monthly Report Generation $\rightarrow$ PDF Streaming $\rightarrow$ Logout.
2. **Admin Operational Journey (8 Milestones):**
   - Admin Login $\rightarrow$ Overview Metrics $\rightarrow$ System Health & Database Diagnostics $\rightarrow$ Telemetry $\rightarrow$ User Suspension & Reactivation $\rightarrow$ Manual Email Verification $\rightarrow$ Audit Log Inspection $\rightarrow$ Admin Logout.
3. **Security Boundary & Multi-Tenant Attack Scenarios:**
   - User A vs. User B IDOR attempts, NoSQL operator injection neutralization, prediction proxy SSRF defense, and forged JWT algorithm rejection.

---

## 6. How to Run Test Suites

### 6.1 Backend Test Suites (Node.js / Express / Vitest)
```bash
# Run all 20 test suites (209 tests)
cd backend
npx vitest run

# Run only the end-to-end integration journeys
npx vitest run tests/e2e-journeys.test.ts

# Run only the security & hardening suite
npx vitest run tests/security.test.ts

# Run with test coverage report
npm test -- --coverage
```

### 6.2 Quantitative Machine Learning Microservice (FastAPI / Pytest)
```bash
# Run all 97 ML & Analytics tests
cd ml-service
.\.venv\Scripts\python.exe -m pytest

# Run specific stock prediction pipeline tests
.\.venv\Scripts\python.exe -m pytest tests/test_stock_pipeline.py

# Run specific financial anomaly detection tests
.\.venv\Scripts\python.exe -m pytest tests/test_financial_anomalies.py
```

### 6.3 Frontend Client Build & Type Verification
```bash
cd frontend
npm run build
```

---

## 7. Continuous Integration (CI/CD) Recommendations

For GitHub Actions or GitLab CI, enforce the following pipeline gates:
1. **Lint & Format:** ESLint (`npm run lint`), Python Flake8/Black (`flake8`, `black --check`).
2. **Type Check:** TypeScript strict compilation (`tsc --noEmit`).
3. **Unit & Integration Testing:** Run Vitest backend suites and Pytest ML suites in parallel.
4. **Security & Regression Verification:** Execute `tests/security.test.ts` and `tests/e2e-journeys.test.ts`.
5. **Artifact Build:** Vite frontend production build check (`npm run build`).
