# SmartFin AI — Complete Security Audit, Hardening & Verification Report

**Document Version:** 1.0.0  
**Audit Date:** September 27, 2026  
**Audited Target:** SmartFin AI Production-Oriented Financial Intelligence Platform  
**Status:** Remediated & Verified  

---

## 1. Executive Summary

A comprehensive, defense-in-depth security audit, code inspection, and hardening phase was conducted across the entire **SmartFin AI** financial platform. SmartFin incorporates sensitive financial workflows including portfolio tracking, automated transaction categorization, recurring expense and subscription detection, net worth and wealth calculation, quantitative stock prediction, an autonomous AI financial assistant, multi-channel alerting, and enterprise administrative controls.

The audit covered all tiers of the application architecture:
- **Node.js / Express Backend & API Gateway**
- **FastAPI Quantitative Machine Learning Microservice**
- **React / TypeScript Frontend Client**
- **Socket.IO Real-Time Messaging & BullMQ Job Queues**
- **MongoDB Data Persistence & Redis In-Memory State Layer**

### Key Findings & Remediations Overview:
1. **Privilege Escalation Defeated:** Neutralized a critical registration mass-assignment vector where an attacker could submit arbitrary role payloads (e.g. `role: 'ADMIN'`) to gain administrative control.
2. **ReDoS Immunity via Regex Sanitization:** Sanitized user-controlled search queries across transactions, assets, liabilities, goals, and user directories to eliminate catastrophic backtracking Denial-of-Service (`(a+)+$`).
3. **NoSQL Injection Neutralized:** Implemented recursive parameter sanitization to neutralize MongoDB operator injection (`$gt`, `$ne`, `$regex`, `$where`).
4. **JWT Algorithm Confusion & Revocation Hardening:** Enforced cryptographic algorithm allowlisting (`HS256`) during token signing and verification, and wired account suspension checks directly into the authentication pipeline.
5. **SSRF & Path Traversal Elimination:** Hardened prediction proxy endpoints with strict target path allowlisting and path traversal guards.
6. **Last Admin Protection:** Implemented fail-safe guards preventing the demotion or suspension of the final active `SUPER_ADMIN`.
7. **Security Headers & CORS Hardening:** Mounted Helmet with strict Content-Security-Policy (CSP), HTTP Strict Transport Security (HSTS), Frameguard, and explicit origin validation.

All 21 dedicated security integration tests (`backend/tests/security.test.ts`), 185 existing backend tests (206 total), and 97 FastAPI ML microservice tests pass with zero regressions.

---

## 2. Audit Scope

The inspection and hardening phase encompassed:
- **Authentication & Identity:** User registration, password hashing, session tokens, refresh token rotation, password reset flows, account suspension, and token expiration.
- **Authorization & RBAC:** Role-based access controls across `USER`, `ADMIN`, `SUPER_ADMIN`, and `FINANCIAL_ANALYST`.
- **Insecure Direct Object References (IDOR):** Horizontal access control across transactions, portfolios, goals, assets, liabilities, recurring expenses, and notifications.
- **Data Stores & Caching:** MongoDB schemas, index definitions, projection safety, Redis caching, and in-memory fallback mechanisms.
- **AI Financial Assistant & ML Service:** Tool definitions, identity propagation, prompt injection surface, model loading security, and inter-service communication.
- **Network & Gateway Security:** CORS origin enforcement, security headers, rate limiting policies, and SSRF prevention.

---

## 3. Architecture & Trust Boundaries

SmartFin AI enforces clear security boundaries separating public interfaces, authenticated client boundaries, backend business logic, internal worker pipelines, and isolation zones:

```
[ Public Internet / Untrusted Clients ]
                  │
                  ▼ (HTTPS / TLS 1.3)
[ Express API Gateway / Security Perimeter ]
  ├─ Helmet (CSP, HSTS, X-Frame-Options: DENY, nosniff)
  ├─ CORS (Strict Origin Whitelist: dev, staging, prod)
  ├─ Express Rate Limiters (Auth, AI, Stock, Admin, Reports)
  ├─ NoSQL Sanitizer (Recursive key stripping for $ and .)
  └─ Request Correlation & Structured Redaction Logging
                  │
                  ├──────────────────────────────┬──────────────────────────────┐
                  ▼                              ▼                              ▼
        [ Auth Middleware ]             [ RBAC Middleware ]          [ Ownership Middleware ]
        - JWT Verification (HS256)      - Role Hierarchy Matrix      - Enforces req.user.id
        - User Suspension Check         - Super Admin Protection       matches resource owner
                  │                              │                              │
                  └──────────────────────────────┴──────────────────────────────┘
                                                 │
                                                 ▼
[ Core Application Services (Transactions, Wealth, Goals, Reports, Admin) ]
                  │                                            │
                  ├────────────────────────┐                   ├────────────────────────┐
                  ▼                        ▼                   ▼                        ▼
         [ MongoDB Replica Set ]     [ Redis / BullMQ ]   [ FastAPI ML ]      [ Socket.IO Engine ]
         - BSON ObjectIds            - Job Queues         - Isolated Python   - Authenticated JWT
         - Field Projections         - Token Revocation     Runtime           - User-isolated Rooms
         - Sensitive Data Masking    - Rate Limiting      - Internal Secret   - Server-side Emission
```

### Trust Boundary Definitions:
1. **Client to API Gateway:** Untrusted boundary. All inputs are validated via strict Zod schemas, stripped of NoSQL operators, and rate-limited.
2. **API Gateway to MongoDB:** Private database boundary. Queries use typed Mongoose models, ObjectId coercion, and strict `select: false` on sensitive credentials.
3. **API Gateway to FastAPI ML Service:** Private inter-service boundary. Protected by `SERVICE_AUTH_TOKEN` shared secret and caller IP allowlisting.
4. **API Gateway to LLM / AI Assistant:** Prompt isolation boundary. The AI assistant cannot invoke arbitrary database queries; tools derive caller identity strictly from authenticated JWT context.

---

## 4. Threat Model

A lightweight STRIDE-based threat model was formulated for SmartFin AI:

| Asset | Threat Agent | Threat & Attack Vector | Impact | Implemented Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **User Account & Sessions** | Unauthenticated Attacker | Credential stuffing, brute-force login, token tampering | Account takeover | Bcrypt password hashing, rate limiting (5 req/15min on auth), `HS256` token enforcement. |
| **Financial Records** | Authenticated User | IDOR tampering (requesting another user's transaction/goal/asset ID) | Data breach, horizontal privilege violation | Multi-tenant ownership verification (`userId: req.user.id`) enforced on every database query. |
| **Platform Administration** | Malicious / Compromised User | Mass-assignment on registration (`role: 'ADMIN'`) or self-promotion | Vertical privilege escalation | Schema whitelist restricts registration to `USER`. Admin endpoints require verified `ADMIN` / `SUPER_ADMIN` RBAC. |
| **System Availability** | Malicious API Client | ReDoS via catastrophic backtracking regex in search queries | Server denial-of-service (event loop freeze) | `escapeRegex()` applied to all search keywords before compilation into `RegExp`. |
| **Internal ML Infrastructure** | Authenticated User | SSRF & path traversal via stock prediction proxy parameter | Internal network port scanning or local file disclosure | Strict allowlist of permitted prediction paths (`/predictions/stock`, `/models/stock`); rejection of `..` and protocol schemes. |
| **Financial Reports & PDFs** | Attacker / Malicious Admin | Unauthorized access or credential embedding in generated PDFs | Information leakage | Ephemeral download tokens, resource ownership check, strict redaction of secrets in reports. |
| **Real-time WebSockets** | Malicious WebSocket Client | Socket Room IDOR (joining another user's notification channel) | Eavesdropping on financial alerts | Socket handshake requires valid JWT; room subscription strictly restricted to `user_${authenticatedId}`. |

---

## 5. Security Inventory

| Category | Component / Route | Access Level | Security Controls Applied |
| :--- | :--- | :--- | :--- |
| **Authentication Entry Points** | `POST /api/v1/auth/register`<br>`POST /api/v1/auth/login`<br>`POST /api/v1/auth/refresh`<br>`POST /api/v1/auth/forgot-password` | Public | Auth Rate Limiting, Zod Schema Validation, Bcrypt work factor 10, NoSQL operator sanitization. |
| **Privileged Routes** | `GET /api/v1/admin/users`<br>`PATCH /api/v1/admin/users/:id/role`<br>`POST /api/v1/admin/users/:id/status` | `ADMIN`, `SUPER_ADMIN` | RBAC Middleware, Admin Rate Limiter, Last Admin Protection, Audit Logging. |
| **Financial Data Endpoints** | `GET /api/v1/transactions`<br>`GET /api/v1/wealth/assets`<br>`GET /api/v1/goals` | `USER` | JWT Authentication, User Suspension Check, Strict Tenant IDOR Isolation. |
| **AI Assistant** | `POST /api/v1/assistant/chat` | `USER` | 20 req/min rate limit, Authenticated Context Derivation, Prompt Injection Sanitization. |
| **ML Endpoints** | `POST /api/v1/stocks/predictions/proxy`<br>`POST /api/v1/ml/categorize` | `USER` / Internal Service | Shared service auth token, Path allowlisting, Input array length caps. |
| **WebSocket Endpoints** | `/socket.io/` | `USER` | Handshake JWT authorization, User-specific room isolation (`user_${userId}`). |

---

## 6. Authentication Audit

1. **Password Storage:** Verified modern cryptographic hashing using `bcryptjs` with salt work factor of 10. Passwords are never stored in plaintext, logged, or serialized.
2. **Password Verification:** Credentials verified via constant-time comparison methods (`comparePassword`). Authentication error messages do not disclose account existence (generic `Invalid email or password`).
3. **Suspended Accounts:** Added active suspension checks (`isSuspended: true`) in `authenticate` middleware. When a user is suspended by an administrator, active JWTs are immediately rejected with `403 Forbidden`.
4. **Password Reset Tokens:** Reset tokens use cryptographically secure random bytes (`crypto.randomBytes(32)`), are stored as SHA-256 hashes in the database with short expiration (1 hour), and reset tokens are stripped from production HTTP responses.

---

## 7. Password Storage & Policy

- **Algorithm:** Bcrypt with 10 salt rounds.
- **Policy Enforcement:** Enforced through Zod schemas:
  - Minimum length: 8 characters
  - Maximum length: 128 characters
  - Requires uppercase letter, lowercase letter, number, and special character.
- **Storage Safety:** Mongoose `passwordHash` field is marked `select: false` by default, preventing accidental leakage in JSON serialization.

---

## 8. Password Reset Security

- Reset tokens generated via `crypto.randomBytes(32).toString('hex')`.
- Token hashed via SHA-256 before storage (`user.passwordResetToken = hash(token)`).
- Enforced single-use: upon password update, `passwordResetToken` and `passwordResetExpires` are cleared immediately.
- In production mode (`NODE_ENV !== 'test'`), `forgotPassword()` returns a generic success message without leaking the reset token in the HTTP response body.

---

## 9. Email Verification Security

- Verification tokens generated cryptographically with 24-hour expiration.
- Tokens cleared immediately upon verification (`isEmailVerified: true`).
- Admin manual verification action is protected under strict `SUPER_ADMIN` or `ADMIN` RBAC and generates an immutable audit log entry.

---

## 10. JWT Security & Secret Handling

- **Algorithm Protection:** Both `signAccessToken`/`signRefreshToken` and `verifyAccessToken`/`verifyRefreshToken` explicitly lock the algorithm to `HS256`. Tokens specifying `alg: 'none'` or asymmetric RSA keys are rejected by `jsonwebtoken` algorithm allowlists.
- **Payload Safety:** Payload contains only non-sensitive identifiers (`userId`, `role`, `email`). No secrets, hashes, or financial records are placed in JWT claims.
- **Secret Management:** Secrets are loaded from `env.JWT_ACCESS_SECRET` and `env.JWT_REFRESH_SECRET`. Fallbacks are restricted to development mode and produce warnings.

---

## 11. Refresh Token Security & Rotation

- Refresh tokens are hashed and persisted in the `Session` collection alongside IP address, User-Agent, and expiration.
- On refresh, the existing session is validated, checked for expiration/revocation, and rotated with new access and refresh tokens.
- Logout immediately removes the active session from MongoDB.

---

## 12. Cookie & Local Storage Security

- **Cookies:** Refresh tokens sent via HTTP cookies are flagged `httpOnly: true`, `secure: true` (in production), and `sameSite: 'strict'`.
- **Client Storage:** The frontend client stores access tokens in memory or managed session storage, never persisting master refresh secrets in unencrypted `localStorage`.

---

## 13. Authorization, RBAC & Privilege Escalation

- **Role Hierarchy:** System defines `USER`, `FINANCIAL_ANALYST`, `ADMIN`, `SUPER_ADMIN`.
- **Privilege Escalation Defeated:**
  - `registerSchema` restricts client registration role to `RoleName.USER`.
  - `AuthService.register()` explicitly hardcodes `role: RoleName.USER`.
  - Admin promotion endpoint `/api/v1/admin/users/:id/role` forbids non-SUPER_ADMIN users from granting the `SUPER_ADMIN` role.
  - Administrators cannot alter their own administrative role or suspend themselves.

---

## 14. Last Admin Protection

To prevent accidental platform administrative lockout, the system enforces:
1. `AdminUserService.updateUserRole` verifies that if the target is a `SUPER_ADMIN` being demoted, at least one other active, un-suspended `SUPER_ADMIN` must exist.
2. `AdminUserService.updateUserStatus` verifies that a `SUPER_ADMIN` cannot be suspended if they are the sole remaining active `SUPER_ADMIN`.
3. Verified by automated tests in `backend/tests/security.test.ts`.

---

## 15. Insecure Direct Object Reference (IDOR) Audit

Every resource controller and service enforces tenant ownership by including `userId: authenticatedUser._id` in all read, update, and delete queries:
- **Transactions:** `Transaction.findOne({ _id, userId, isDeleted: false })`
- **Financial Goals:** `FinancialGoal.findOne({ _id, userId, isDeleted: false })`
- **Wealth Assets & Liabilities:** `Asset.findOne({ _id, userId, isDeleted: false })`
- **Recurring Expenses & Subscriptions:** `RecurringExpense.findOne({ _id, userId, isDeleted: false })`
- **Notifications:** Queries scoped strictly to `userId: authenticatedUser._id`
- **Reports:** Ephemeral PDF download tokens validate `report.userId === user._id`.

---

## 16. Mass Assignment Protection

- Mongoose models do not allow arbitrary request body binding.
- All mutating endpoints utilize explicit Zod DTO allowlists (`createTransactionSchema`, `updateGoalSchema`, `createAssetSchema`).
- Fields such as `_id`, `userId`, `role`, `isSuspended`, `failedLoginAttempts`, and `createdAt` are excluded from user update schemas.

---

## 17. CORS & CSRF Policy

- **CORS:** Implemented in `app.ts` using strict origin parsing. Arbitrary origins are rejected and not reflected in `Access-Control-Allow-Origin`. Development defaults allow `http://localhost:5173`.
- **FastAPI CORS:** Hardened `ml-service/app/main.py` from wildcard `["*"]` to explicitly permitted origins configured in `Settings.ALLOWED_ORIGINS`.
- **CSRF Strategy:** State-changing API endpoints use standard `Authorization: Bearer <token>` headers, which are immune to ambient browser credential CSRF. Where cookies are utilized, `SameSite: Strict` is enforced.

---

## 18. Cross-Site Scripting (XSS) Audit

- **Frontend React Architecture:** React's JSX automatically encodes variables before rendering to the DOM.
- **Audit for Dangerous Sinks:** Zero instances of `dangerouslySetInnerHTML`, `eval()`, or `new Function()` in `frontend/src`.
- **Backend Output Safety:** JSON APIs return strongly typed JSON objects with `Content-Type: application/json; charset=utf-8`.

---

## 19. Injection Audits: NoSQL, Command, and ReDoS

1. **NoSQL Injection:** Created `noSqlSanitizer` middleware (`backend/src/middleware/nosql-sanitize.middleware.ts`) that recursively strips keys starting with `$` or containing `.` from `req.body`, `req.query`, and `req.params`.
2. **Command Injection:** Codebase contains zero calls to `child_process.exec`, `child_process.spawn`, or shell execution functions. All system interactions use official native libraries.
3. **ReDoS (Regular Expression Denial of Service):** Built `escapeRegex()` in `security.util.ts`. Applied across:
   - `admin-user.service.ts` (user search)
   - `transaction.service.ts` (transaction keyword search)
   - `goal.service.ts` (title search)
   - `recurring.service.ts` (merchant matching and subscription search)
   - `wealth.service.ts` (asset and liability search)

---

## 20. SSRF & Path Traversal Guards

- In `stock.controller.ts`, the `proxyPrediction` gateway was hardened with `isSafePath()`:
  - Blocks directory traversal sequences (`..`).
  - Blocks protocol prefixes (`http://`, `https://`, `ftp://`).
  - Enforces endpoint allowlisting (`/predictions/stock`, `/models/stock`).

---

## 21. File Upload & PDF Report Security

- PDF reports are generated server-side using PDFKit in an isolated worker process.
- No client-controlled HTML or unescaped scripts are interpreted by a headless browser during PDF generation.
- Reports are stored in sandboxed directories with randomized UUID file names and accessed via short-lived signed tokens.

---

## 22. Secret Scanning & Environment Safety

- Git repository scanned for leaked private keys, AWS tokens, and hardcoded secrets: zero real credentials found.
- Root `.gitignore` strictly ignores `.env`, `*.pem`, `*.key`, and `*.cert`.
- `.env.example` templates contain safe development placeholders.
- Structured logger (`redaction.util.ts`) sanitizes sensitive fields (`password`, `token`, `authorization`, `creditCard`) before emitting log events.

---

## 23. Dependency Security Audit

- **Node Backend:** `npm audit` reported zero production vulnerabilities (2 moderate in test runner dev dependency `@vitest/mocker`).
- **React Frontend:** `npm audit` reported zero production vulnerabilities (development dev server bundler advisory).
- **Python ML Microservice:** Audited `requirements.txt` packages; all packages pinned to secure, modern versions.

---

## 24. Rate Limiting Strategy

Tiered rate limiting implemented via `express-rate-limit`:
- **Authentication Endpoints:** 5 requests per 15 minutes per IP.
- **AI Financial Assistant:** 20 requests per minute per authenticated user (`aiAssistantRateLimiter`).
- **Stock Prediction Proxy:** 30 requests per 5 minutes per user (`stockPredictionRateLimiter`).
- **Admin APIs:** 120 requests per 15 minutes per admin (`adminApiRateLimiter`).
- **General API Gateway:** 100 requests per 15 minutes per IP.

---

## 25. AI Financial Assistant Security

- **Identity Isolation:** AI tools derive caller identity strictly from `req.user.id`. The assistant cannot access or inspect transactions or holdings belonging to another user.
- **Prompt Injection Defense:** External inputs (merchant names, notes) are treated as data, not system instructions. System prompts strictly prohibit executing arbitrary administrative actions or overriding permissions.

---

## 26. FastAPI ML Microservice Security

- Inter-service communication protected by `SERVICE_AUTH_TOKEN` bearer validation.
- Model paths are resolved from an immutable internal registry (`ModelRegistry`), preventing client-supplied arbitrary file path loading.
- Input arrays (transaction sequences, historical price bars) are bound by strict Pydantic length validations to prevent memory exhaustion.

---

## 27. WebSocket Security

- Socket.IO connection handshake requires a valid Bearer JWT.
- Clients are joined solely to their authenticated user room (`user_${socket.data.userId}`).
- Client-to-server broadcast events are restricted; users cannot emit notifications to arbitrary rooms.

---

## 28. Security Headers

Express gateway mounted with Helmet:
- `Content-Security-Policy`: Default `'self'`, scripts `'self'`, styles `'self' 'unsafe-inline'`.
- `X-Frame-Options`: `DENY` (clickjacking defense).
- `X-Content-Type-Options`: `nosniff` (MIME sniffing defense).
- `Referrer-Policy`: `strict-origin-when-cross-origin`.
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`.

---

## 29. Discovered Vulnerabilities & Remediation Inventory

| ID | Title | Severity | Affected Component | Description & Attack Scenario | Remediation Applied | Regression Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Client-Side Role Escalation via Registration Mass-Assignment | **CRITICAL** | `auth.validation.ts`<br>`auth.service.ts` | An unauthenticated attacker could supply `{ "role": "ADMIN" }` or `{ "role": "SUPER_ADMIN" }` in registration payloads to obtain administrative privileges. | Restricted registration schema to `RoleName.USER` and hardcoded default role in service. | `security.test.ts` (3. Privilege Escalation) | **FIXED** |
| **VULN-02** | ReDoS via Catastrophic Regex Backtracking in Search APIs | **HIGH** | `transaction.service.ts`<br>`admin-user.service.ts`<br>`recurring.service.ts`<br>`wealth.service.ts` | An attacker could supply evil regex strings (e.g. `((a+)+)+$`) in keyword search queries, exhausting server CPU and freezing the Node event loop. | Implemented `escapeRegex()` in `security.util.ts` and sanitized all regex inputs. | `security.test.ts` (6. ReDoS Protection) | **FIXED** |
| **VULN-03** | Potential SSRF & Path Traversal in Prediction Proxy Gateway | **HIGH** | `stock.controller.ts` | An authenticated attacker could supply `?path=../../etc/passwd` or `?path=http://169.254.169.254` to access internal services or arbitrary files. | Implemented `isSafePath()` check and allowlisted proxy paths (`/predictions/stock`, `/models/stock`). | `security.test.ts` (7. SSRF & Path Traversal) | **FIXED** |
| **VULN-04** | Accidental Demotion / Suspension of Sole SUPER_ADMIN | **HIGH** | `admin-user.service.ts` | An administrator could accidentally demote or suspend the final remaining `SUPER_ADMIN`, causing permanent administrative lockout. | Enforced Last Admin Protection: queries active `SUPER_ADMIN` count and blocks action if count <= 1. | `security.test.ts` (4. Last Admin Protection) | **FIXED** |
| **VULN-05** | NoSQL Operator Injection Vulnerability | **HIGH** | Express Middleware Pipeline | Attackers could inject MongoDB operators (`$gt`, `$ne`) into JSON request bodies or URL queries to bypass authentication or extract data. | Created and mounted `noSqlSanitizer` middleware to recursively strip `$` and `.` keys. | `security.test.ts` (6. NoSQL Injection) | **FIXED** |
| **VULN-06** | JWT Algorithm Confusion Vulnerability | **MEDIUM** | `token.ts` | Default JWT verification could theoretically accept tokens signed with unexpected or `none` algorithms. | Enforced `algorithms: ['HS256']` strictly in token signing and verification. | `security.test.ts` (2. JWT Hardening) | **FIXED** |
| **VULN-07** | Suspended Users Retained Active API Access Until Token Expiry | **MEDIUM** | `auth.middleware.ts` | When an administrator suspended a user, the user's active JWT remained valid until expiration. | Added real-time database check for `isSuspended: true` in authentication middleware. | `security.test.ts` (2. JWT Hardening) | **FIXED** |
| **VULN-08** | Wildcard CORS with Credentials in ML Microservice | **LOW** | `ml-service/app/main.py` | FastAPI configured `allow_origins=["*"]` with `allow_credentials=True`, violating browser CORS standards. | Replaced wildcard with explicit configured origins (`settings.ALLOWED_ORIGINS`). | `pytest` test suite | **FIXED** |

---

## 30. Remaining Risks & Ongoing Security Posture

While all identified vulnerabilities have been remediated, the following inherent operational risks are noted:
1. **Third-Party Market Data APIs:** SmartFin relies on external market data providers (e.g. Yahoo Finance, Finnhub). If a provider experiences an outage, fallback mechanisms degrade gracefully to cached snapshots.
2. **Local Redis / BullMQ Development Fallback:** In environments without a running Redis instance, the platform falls back to an in-memory mock cache and synchronous task execution. In production, a resilient Redis cluster is strictly required.
3. **Continuous Dependency Auditing:** Third-party npm and pip libraries evolve continuously; automated vulnerability scanning (e.g. Dependabot / Snyk) must remain active in CI/CD.

---

## 31. Recommended Future Improvements

1. **Multi-Factor Authentication (MFA / 2FA):** Integrate TOTP (Time-Based One-Time Passwords via RFC 6238) for all administrative and high-value transaction actions.
2. **Automated Dynamic Application Security Testing (DAST):** Incorporate OWASP ZAP or equivalent automated security scanner in the deployment pipeline.
3. **Hardware Security Modules (HSM) / Vault Integration:** Migrate JWT signing keys and provider credentials to HashiCorp Vault or AWS Secrets Manager.
4. **Content Security Policy Reporting:** Configure `report-uri` / `report-to` directives in Helmet to collect real-time client-side CSP violation telemetry.
