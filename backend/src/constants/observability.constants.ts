/**
 * Standardized Event Names for Production Observability
 * Consistent structured log events across all microservices
 */
export enum ObservabilityEvent {
  // HTTP & Request Lifecycle
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_ERROR = 'HTTP_ERROR',
  SLOW_REQUEST = 'SLOW_REQUEST',

  // Authentication & Security
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  AUTH_LOCKOUT = 'AUTH_LOCKOUT',
  AUTH_SUSPENDED = 'AUTH_SUSPENDED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',

  // Database Operations
  DATABASE_CONNECTED = 'DATABASE_CONNECTED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DB_SLOW_OPERATION = 'DB_SLOW_OPERATION',
  DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE',

  // Redis Distributed Cache & State
  REDIS_CONNECTED = 'REDIS_CONNECTED',
  REDIS_DISCONNECTED = 'REDIS_DISCONNECTED',
  REDIS_ERROR = 'REDIS_ERROR',

  // External APIs & Integration Providers
  EXTERNAL_API_REQUEST = 'EXTERNAL_API_REQUEST',
  EXTERNAL_API_FAILURE = 'EXTERNAL_API_FAILURE',
  EXTERNAL_API_RETRY = 'EXTERNAL_API_RETRY',

  // Machine Learning & Quantitative Analytics
  ML_INFERENCE = 'ML_INFERENCE',
  ML_INFERENCE_FAILURE = 'ML_INFERENCE_FAILURE',

  // Background Workers & BullMQ Jobs
  JOB_QUEUED = 'JOB_QUEUED',
  JOB_STARTED = 'JOB_STARTED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  JOB_FAILED = 'JOB_FAILED',
  JOB_RETRIED = 'JOB_RETRIED',

  // Enterprise Notifications
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  NOTIFICATION_SUPPRESSED = 'NOTIFICATION_SUPPRESSED',

  // Financial Reports
  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_GENERATION_FAILED = 'REPORT_GENERATION_FAILED',

  // Audit & Compliance
  AUDIT_EVENT = 'AUDIT_EVENT',

  // Health & Service Availability
  HEALTH_CHECK = 'HEALTH_CHECK',
  SERVICE_DEGRADED = 'SERVICE_DEGRADED',
  SERVICE_RECOVERED = 'SERVICE_RECOVERED',
}

/**
 * Standard Log Levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Consistent Error Categories
 */
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

/**
 * Sensitive fields that must always be redacted in logs, errors, and traces
 */
export const SENSITIVE_FIELDS: readonly string[] = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'mfaSecret',
  'authorization',
  'cookie',
  'bankAccount',
  'accountNumber',
  'accountNumberMasked',
  'cardNumber',
  'creditCard',
  'cvv',
  'cvc',
  'pin',
  'ssn',
  'emailVerificationToken',
  'passwordResetToken',
  'privateKey',
  'smtpPass',
  'cookieSecret',
  'jwtAccessSecret',
  'jwtRefreshSecret',
] as const;
