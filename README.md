# SMARTFIN AI
### Enterprise Personal Finance, Investment & Stock Market Intelligence Platform

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict_Mode-blue.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688.svg)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green.svg)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-darkred.svg)](#)

---

## 1. Overview & Vision

**SMARTFIN AI** is a production-quality, modular, secure full-stack fintech platform designed to unify **personal financial health** and **advanced investment market intelligence** into an integrated SaaS ecosystem.

Unlike simple CRUD expense trackers, SMARTFIN AI delivers:
- **Zero-Trust Tiered Architecture**: Browser clients never directly access databases or external financial APIs.
- **Asynchronous Task Architecture**: Background job scheduling via BullMQ and Redis for transaction deduplication, subscription detection, and recurring portfolio valuation.
- **Decoupled AI/ML Microservice**: Standalone Python 3.11 FastAPI microservice delivering transaction auto-categorization (TF-IDF + XGBoost), spending anomaly detection (Isolation Forest), cash-flow forecasting (Prophet / Monte Carlo), and stock trend prediction (LSTM / XGBoost).
- **Financial-Grade Security**: Argon2id password hashing, rotating JWT access/refresh token pairs, TOTP multi-factor authentication (MFA), role-based access control (RBAC), and AES-256-GCM field-level encryption for sensitive financial accounts.

---

## 2. Platform Architecture

```
                    +------------------------------------+
                    |   React 18+ SPA (TypeScript, Vite) |
                    |   Tailwind CSS + ECharts / Recharts|
                    +-----------------+------------------+
                                      | HTTPS / WSS
                                      v
                    +------------------------------------+
                    |    Node.js / Express.js REST API   |
                    |    TypeScript (Strict Mode)        |
                    |    Zod Validation + RBAC + Auth    |
                    +--------+------------------+--------+
                             |                  |
              +--------------+                  +---------------+
              |                                                 |
              v                                                 v
    +-------------------+                             +-------------------+
    |    MongoDB 7.0    |                             |     Redis 7.0     |
    |  Primary Ledger   |                             |  Cache, Sessions  |
    |  Portfolios, PnL  |                             |  BullMQ Queues    |
    +-------------------+                             +---------+---------+
                                                                |
                                                                v
                                                      +-------------------+
                                                      |  BullMQ Workers   |
                                                      |  Background Jobs  |
                                                      +---------+---------+
                                                                | Internal REST
                                                                v
                                                      +-------------------+
                                                      | Python ML Service |
                                                      | FastAPI + PyTorch |
                                                      | XGBoost + Prophet |
                                                      +-------------------+
```

---

## 3. Core Objectives Matrix

| # | Objective | Architectural Module | Status |
| :-: | :--- | :--- | :--- |
| **1** | Personal finance management | `apps/server/src/services/account.service.ts` | Blueprint Approved |
| **2** | AI transaction categorization | `apps/ml-service/app/pipelines/categorizer.py` | Blueprint Approved |
| **3** | Budget management | `apps/server/src/services/budget.service.ts` | Blueprint Approved |
| **4** | Financial analytics | `apps/server/src/services/analytics.service.ts` | Blueprint Approved |
| **5** | Recurring & subscription detection | `apps/ml-service/app/pipelines/subscriptions.py` | Blueprint Approved |
| **6** | Financial goals tracking | `apps/server/src/services/goal.service.ts` | Blueprint Approved |
| **7** | Net worth tracking | `apps/server/src/services/networth.service.ts` | Blueprint Approved |
| **8** | Investment portfolio management | `apps/server/src/services/portfolio.service.ts` | Blueprint Approved |
| **9** | Stock market integration | `apps/server/src/services/market.service.ts` | Blueprint Approved |
| **10** | Stock watchlist | `apps/server/src/services/watchlist.service.ts` | Blueprint Approved |
| **11** | Stock alerts | `apps/server/src/queues/alert.worker.ts` | Blueprint Approved |
| **12** | Historical market data | `apps/server/src/services/market.service.ts` | Blueprint Approved |
| **13** | ML stock forecasting | `apps/ml-service/app/pipelines/stock_forecast.py` | Blueprint Approved |
| **14** | Expense forecasting | `apps/ml-service/app/pipelines/forecaster.py` | Blueprint Approved |
| **15** | Cash-flow forecasting | `apps/ml-service/app/pipelines/cashflow_sim.py` | Blueprint Approved |
| **16** | Spending anomaly detection | `apps/ml-service/app/pipelines/anomaly.py` | Blueprint Approved |
| **17** | AI financial assistant (FinBot) | `apps/ml-service/app/pipelines/assistant.py` | Blueprint Approved |
| **18** | Notifications | `apps/server/src/services/notification.service.ts` | Blueprint Approved |
| **19** | Background jobs | `apps/server/src/queues/bullmq.config.ts` | Blueprint Approved |
| **20** | Admin dashboard | `apps/server/src/controllers/admin.controller.ts` | Blueprint Approved |
| **21** | Audit logging | `apps/server/src/middleware/audit.middleware.ts` | Blueprint Approved |
| **22** | Security & encryption | `docs/SECURITY.md` | Blueprint Approved |
| **23** | Automated testing | `docs/TESTING_STRATEGY.md` | Blueprint Approved |
| **24** | Docker containerization | `docker/docker-compose.yml` | Blueprint Approved |
| **25** | CI/CD pipelines | `.github/workflows/ci.yml` | Blueprint Approved |
| **26** | Cloud deployment readiness | `docs/ARCHITECTURE.md` | Blueprint Approved |
| **27** | Monitoring & observability | `docs/ARCHITECTURE.md` | Blueprint Approved |

---

## 4. Architectural Documentation

Comprehensive engineering documentation is maintained in the [`/docs`](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/) directory:

- [**System Architecture (`/docs/ARCHITECTURE.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/ARCHITECTURE.md) — System boundaries, component topology, sequence diagrams, and cross-cutting concerns.
- [**Implementation Roadmap (`/docs/ROADMAP.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/ROADMAP.md) — Phased milestone schedule (M0 through M9) and definitions of done.
- [**Database Specifications (`/docs/DATABASE.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/DATABASE.md) — Mongoose schemas, compound indexes, relational integrity, and Redis key architecture.
- [**API Integration Contract (`/docs/API.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/API.md) — RESTful catalog, query filters, standard envelopes, and Socket.IO real-time events.
- [**Machine Learning Architecture (`/docs/ML_ARCHITECTURE.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/ML_ARCHITECTURE.md) — Mathematical formulations, pipelines, MLOps, and quantitative risk metrics.
- [**Security & Threat Defense (`/docs/SECURITY.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/SECURITY.md) — STRIDE analysis, Argon2id, JWT rotation, AES-256-GCM encryption, and RBAC matrix.
- [**Environment Configuration (`/docs/ENV_CONFIG.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/ENV_CONFIG.md) — Secret variables catalog and startup Zod validation rules.
- [**Automated Testing Strategy (`/docs/TESTING_STRATEGY.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/TESTING_STRATEGY.md) — Testing pyramid, coverage thresholds, and CI automation.
- [**Monorepo Developer Guide (`/docs/MONOREPO.md`)**](file:///c:/Users/sj050/OneDrive/Documents/SmartFinAI/docs/MONOREPO.md) — Service topology, health endpoints, scripts, and container definitions.

---

## 5. Repository Directory Layout

```
SmartFinAI/
├── .editorconfig
├── .gitignore
├── .env.example
├── package.json
├── README.md
├── backend/                  # Node.js / Express API Gateway & Background Workers
├── frontend/                 # React 18+ Single Page Application (TypeScript, Vite, Tailwind CSS)
├── ml-service/               # Python 3.10/3.11 FastAPI Machine Learning Microservice
├── docker/                   # Docker Compose & service configurations
│   └── docker-compose.yml
├── docs/                     # Architectural specifications & blueprints
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── ML_ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── ENV_CONFIG.md
│   ├── TESTING_STRATEGY.md
│   └── MONOREPO.md
└── scripts/                  # Development & automated testing runners
    ├── dev.ps1 / dev.sh
    ├── lint.ps1
    ├── test.ps1 / test.sh
    └── setup-venv.ps1 / setup-venv.sh
```

---

## 6. Development Quickstart (Milestone 0 Foundation)

### Prerequisites
- Node.js >= 20.x
- Python >= 3.10
- Git

### Initializing Environment Files
```bash
# Copy template configs
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ml-service/.env.example ml-service/.env
```

---

## 7. Current Project Phase
- **Current Milestone**: **Milestone 0 (Architecture & Project Foundation)** — Completed.
- **Next Milestone**: **Milestone 1 (Server Core, Data Persistence & Authentication Engine)** — Pending approval.
