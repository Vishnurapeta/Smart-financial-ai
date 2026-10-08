# SMARTFIN AI — Monorepo Architecture & Development Guide

**Enterprise Personal Finance, Investment & Stock Market Intelligence Platform**  
*Document Version: 1.0.0 | Status: Approved Monorepo Standard*

---

## 1. Monorepo Structure

The SMARTFIN AI codebase is structured as a modular, production-ready multi-service monorepo:

```
SmartFinAI/
├── backend/                  # Core Node.js / Express API Gateway & Background Workers
│   ├── src/
│   │   ├── config/           # Environment validation (Zod)
│   │   ├── controllers/      # Thin HTTP request handlers
│   │   ├── middleware/       # Error handling, request ID, structured logger
│   │   ├── routes/           # RESTful route definitions (/api/v1/*)
│   │   ├── utils/            # Error classes, Pino logger
│   │   ├── app.ts            # Express application setup
│   │   └── server.ts         # Server listen & graceful shutdown
│   ├── tests/                # Vitest & Supertest integration tests
│   ├── Dockerfile            # Multi-stage production container
│   ├── tsconfig.json         # TypeScript strict mode configuration
│   └── package.json
│
├── frontend/                 # React 18+ Single Page Application
│   ├── src/
│   │   ├── components/       # Header, ServiceStatus, atomic UI
│   │   ├── types/            # TypeScript interfaces & API contracts
│   │   ├── App.tsx           # Dashboard view with live health monitoring
│   │   ├── main.tsx          # React DOM entry
│   │   └── index.css         # Tailwind directives & typography
│   ├── index.html            # Web entry with Google Fonts
│   ├── Dockerfile            # Multi-stage Nginx production container
│   ├── tailwind.config.js    # Fintech color palette & dark theme
│   ├── tsconfig.json         # TypeScript compiler options
│   └── vite.config.ts        # Vite build tool
│
├── ml-service/               # Python 3.10/3.11 FastAPI Machine Learning Microservice
│   ├── app/
│   │   ├── core/             # Pydantic settings, JSON structured logger
│   │   └── main.py           # FastAPI application & /health route
│   ├── tests/                # Pytest test suite
│   ├── Dockerfile            # Python slim production container
│   ├── pyproject.toml        # Black & Pytest tool configurations
│   ├── .flake8               # Flake8 style guide
│   └── requirements.txt      # Python dependencies
│
├── docker/
│   └── docker-compose.yml    # Unified multi-service orchestration (Mongo, Redis, Backend, Frontend, ML)
│
├── docs/                     # Architectural & Engineering Specifications
│   ├── ARCHITECTURE.md       # High-level architecture, diagrams, tier isolation
│   ├── ROADMAP.md            # Phased implementation plan (M0 - M9)
│   ├── DATABASE.md           # Mongoose schemas, compound indexes, Redis keys
│   ├── API.md                # RESTful API contracts & Socket.IO protocols
│   ├── ML_ARCHITECTURE.md    # Machine learning pipelines & risk models
│   ├── SECURITY.md           # Threat defense, Argon2id, JWT rotation, AES-256-GCM
│   ├── ENV_CONFIG.md         # Environment variable catalog & validation
│   ├── TESTING_STRATEGY.md   # Testing pyramid & CI quality gates
│   └── MONOREPO.md           # This developer guide
│
├── scripts/                  # Cross-platform developer automation
│   ├── dev.ps1 / dev.sh      # Launch all or individual dev services
│   ├── lint.ps1              # Run ESLint, Prettier, Flake8 across all packages
│   ├── test.ps1 / test.sh    # Run automated test suites (Vitest + Pytest)
│   └── setup-venv.ps1 / .sh  # Create & install Python virtual environment
│
├── .editorconfig
├── .gitignore
├── .env.example
├── package.json              # Monorepo workspaces & convenience scripts
└── README.md
```

---

## 2. Health Check Contracts

### 2.1 Backend Health Endpoint
- **URL**: `GET /api/v1/health`
- **Response Format**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "SmartFinAI-Backend",
      "version": "1.0.0",
      "environment": "development",
      "timestamp": "2026-09-27T00:00:00.000Z",
      "uptimeSeconds": 142,
      "memory": {
        "rssMb": 45.2,
        "heapTotalMb": 28.5,
        "heapUsedMb": 19.3
      }
    },
    "error": null
  }
  ```

### 2.2 Machine Learning Service Health Endpoint
- **URL**: `GET /health`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "service": "SmartFinAI-ML-Service",
    "version": "1.0.0",
    "environment": "development",
    "uptimeSeconds": 142,
    "timestamp": "2026-09-27T00:00:00.000Z"
  }
  ```

---

## 3. Developer Commands & Workflows

### 3.1 Quick Start
```bash
# Copy environment configuration templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ml-service/.env.example ml-service/.env

# Setup Python virtual environment
powershell -File scripts/setup-venv.ps1

# Run development servers concurrently
npm run dev

# Or launch all services in dedicated windows:
powershell -File scripts/dev.ps1 -Service all
```

### 3.2 Linting & Formatting
```bash
# Run lint checks across backend & frontend
npm run lint

# Auto-fix linting & Prettier formatting
npm run lint:fix
```

### 3.3 Automated Testing
```bash
# Run backend Vitest integration suite
npm run test:backend

# Run both Vitest and Pytest suites
powershell -File scripts/test.ps1
```

---

## 4. Structured Logging & Error Handling Standard

1. **Correlation IDs**: All requests are assigned an `X-Correlation-ID` header.
2. **Standard Error Envelope**:
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "VALIDATION_FAILED",
       "message": "Descriptive message",
       "details": [],
       "traceId": "c3a10408-20bd-4fa6-8e5c-0bcbb02999e2"
     }
   }
   ```
3. **PII Redaction**: Passwords, tokens, and bank account numbers are redacted in logger streams.
