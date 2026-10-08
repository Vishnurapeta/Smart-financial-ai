# SMARTFIN AI — Environment Configuration & Secrets Management Plan

**Enterprise Personal Finance & Investment Intelligence Platform**  
*Document Version: 1.0.0 | Status: Approved Configuration Specification*

---

## 1. Secrets Management Philosophy

1. **Zero Hardcoded Secrets**: No credentials, encryption keys, tokens, or connection strings are ever committed to version control.
2. **Schema Validation on Boot**: Both the Node.js API and the Python FastAPI ML microservice validate and parse all required environment variables on startup (via **Zod** in Node.js and **Pydantic BaseSettings** in Python). If any required variable is missing or malformed, the process fails fast with an explanatory exit code.
3. **Multi-Environment Segregation**: Environments (`development`, `test`, `staging`, `production`) maintain strictly separated secrets and databases.

---

## 2. Environment Variables Catalog

### 2.1 Backend Server (`apps/server/.env`)

```ini
# ==============================================================================
# SMARTFIN AI — BACKEND SERVER ENVIRONMENT VARIABLES
# ==============================================================================

# Application Runtime
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1
APP_NAME=SmartFinAI-Server
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173

# Security & Cryptography
# Generate master key using: openssl rand -hex 32
DATA_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_characters_long_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters_long_here
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=your_secure_cookie_secret_string_here

# Persistence (MongoDB)
MONGODB_URI=mongodb://localhost:27017/smartfin_ai_dev
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=10

# In-Memory Cache & Message Broker (Redis)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=smartfin:

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120
AUTH_RATE_LIMIT_MAX=5

# Asynchronous Queues (BullMQ)
BULLMQ_CONCURRENCY=5
BULLMQ_MAX_RETRY_ATTEMPTS=3

# Python Machine Learning Microservice Connection
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_SECRET_TOKEN=internal_ml_service_shared_hmac_secret_token

# External Market Data Providers
# Finnhub API Key: https://finnhub.io
FINNHUB_API_KEY=your_finnhub_api_key_here
# Alpha Vantage API Key: https://www.alphavantage.co
ALPHA_VANTAGE_API_KEY=your_alphavantage_api_key_here

# Email & Notification Delivery (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM_ADDRESS=notifications@smartfin.ai
EMAIL_FROM_NAME="SMARTFIN AI"

# Object Storage (AWS S3 / MinIO for statements & exports)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=smartfin-ai-documents
```

---

### 2.2 Machine Learning Microservice (`apps/ml-service/.env`)

```ini
# ==============================================================================
# SMARTFIN AI — ML MICROSERVICE ENVIRONMENT VARIABLES
# ==============================================================================

# Application Runtime
PYTHON_ENV=development
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=INFO
APP_NAME=SmartFinAI-ML-Service

# Internal Service-to-Service Security
SERVICE_AUTH_TOKEN=internal_ml_service_shared_hmac_secret_token
ALLOWED_CALLER_IPS=127.0.0.1,172.17.0.1

# Model Artifact Locations
MODEL_ARTIFACTS_DIR=./app/artifacts
CACHE_DIR=./.cache

# Hardware & Concurrency
NUM_WORKERS=4
PYTORCH_DEVICE=cpu   # 'cpu' or 'cuda'

# External Quantitative APIs (Optional Fallback)
YAHOO_FINANCE_TIMEOUT=10
```

---

### 2.3 Frontend Application (`apps/client/.env`)

```ini
# ==============================================================================
# SMARTFIN AI — FRONTEND CLIENT ENVIRONMENT VARIABLES
# ==============================================================================

# Notice: All Vite variables MUST be prefixed with VITE_
# Frontend NEVER stores database credentials or secret third-party API keys!

VITE_APP_NAME="SMARTFIN AI"
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
VITE_DEFAULT_LOCALE=en-US
VITE_DEFAULT_CURRENCY=USD
VITE_ENABLE_ANALYTICS=false
```

---

## 3. Server Startup Environment Validation (Zod Schema)

The server initializes by executing a strict schema validation check in `apps/server/src/config/env.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string(),

  // Cryptography & Tokens
  DATA_ENCRYPTION_KEY: z.string().length(64, 'DATA_ENCRYPTION_KEY must be 64-char hex string (32 bytes)'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16),

  // Persistence
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid connection string'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(50),

  // Redis
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Downstream Services
  ML_SERVICE_URL: z.string().url(),
  ML_SERVICE_SECRET_TOKEN: z.string().min(16),

  // Market Providers
  FINNHUB_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadAndValidateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL: Environment variable validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}
```
