import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file from backend directory if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('SmartFinAI-Backend'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/smartfin_ai_dev'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(false),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  ML_SERVICE_SECRET_TOKEN: z.string().default('dev_ml_service_shared_secret_token_12345'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default('smartfin_dev_jwt_access_secret_key_super_secure_32_chars!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('smartfin_dev_jwt_refresh_secret_key_super_secure_32_chars!'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('smartfin_dev_cookie_signing_secret_12345!'),

  // Market Data Provider Configuration
  MARKET_DATA_PROVIDER: z.enum(['yahoo', 'finnhub', 'alphavantage', 'twelvedata']).default('yahoo'),
  MARKET_DATA_API_KEY: z.string().optional().default(''),
  MARKET_DATA_TIMEOUT_MS: z.coerce.number().default(8000),
  MARKET_DATA_CACHE_TTL_QUOTE: z.coerce.number().default(60),
  MARKET_DATA_CACHE_TTL_HISTORY: z.coerce.number().default(900),
  MARKET_DATA_CACHE_TTL_SEARCH: z.coerce.number().default(3600),

  // Enterprise Notification System Configuration
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('"SmartFin AI" <notifications@smartfin.ai>'),
  SMTP_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(false),

  NOTIFICATION_COOLDOWN_SECONDS: z.coerce.number().default(300),
  NOTIFICATION_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(10),
  NOTIFICATION_QUIET_HOURS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),

  // Observability & Telemetry Configuration
  SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().default(1000),
  DB_SLOW_OPERATION_THRESHOLD_MS: z.coerce.number().default(200),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().default(2000),
  METRICS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),
  METRICS_ENDPOINT: z.string().default('/metrics'),
  ALERT_COOLDOWN_MS: z.coerce.number().default(300000), // 5 minutes
  EXTERNAL_API_TIMEOUT_MS: z.coerce.number().default(8000),
  EXTERNAL_API_MAX_RETRIES: z.coerce.number().default(3),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LOG_RETENTION_DAYS: z.coerce.number().default(30),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env: EnvConfig = parsedEnv.data;
