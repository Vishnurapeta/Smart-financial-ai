import { RoleName } from './auth.ts';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING_VERIFICATION';

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  status: AccountStatus;
  isEmailVerified: boolean;
  isMfaEnabled: boolean;
  isSuspended: boolean;
  suspendedReason?: string;
  failedLoginAttempts: number;
  lockoutUntil?: string;
  lastLoginAt?: string;
  defaultCurrency: string;
  locale: string;
  createdAt: string;
}

export interface AdminUserDetails extends AdminUserListItem {
  summaryStats: {
    budgetCount: number;
    portfolioCount: number;
    activeAlertsCount: number;
    reportsGeneratedCount: number;
  };
}

export interface PlatformOverviewMetrics {
  users: {
    total: number;
    active30d: number;
    suspended: number;
    locked: number;
    pendingVerification: number;
    mfaEnabled: number;
  };
  domainTotals: {
    transactionsCount: number;
    budgetsCount: number;
    goalsCount: number;
    portfoliosCount: number;
    stockPredictionsCount: number;
    reportsGeneratedCount: number;
    notificationsDispatchedCount: number;
    anomaliesDetectedCount: number;
  };
  security: {
    lockedAccounts: number;
    suspendedAccounts: number;
    failedLogins24h: number;
    accessDenied24h: number;
  };
  timestamp: string;
}

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimeSeconds: number;
  node: {
    version: string;
    platform: string;
    memory: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
      externalMb: number;
    };
  };
  databases: {
    mongodb: {
      status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
      pingMs: number;
      databaseName: string;
    };
    redis: {
      status: 'CONNECTED' | 'FALLBACK_IN_MEMORY' | 'DISCONNECTED';
      host: string;
      port: number;
    };
  };
  services: {
    fastApiMl: {
      status: 'UP' | 'DOWN' | 'UNREACHABLE';
      url: string;
      pingMs?: number;
    };
  };
  timestamp: string;
}

export interface QueueJobCounts {
  name: string;
  isAvailable: boolean;
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE';
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
}

export interface FeatureMetrics {
  ml: {
    categorization: {
      totalFeedback: number;
      accepted: number;
      corrected: number;
      accuracyPercent: number;
    };
    activeModels: Array<{
      name: string;
      version: string;
      framework: string;
      accuracyScore?: number;
      datasetSize: number;
    }>;
    stockPredictions: {
      total: number;
      evaluated: number;
      pending: number;
      byHorizon: Record<string, number>;
    };
  };
  aiAssistant: {
    totalQueries: number;
    totalTokensUsed: number;
    averageLatencyMs: number;
    feedbackBreakdown: {
      helpful: number;
      unhelpful: number;
      unrated: number;
    };
    intentBreakdown: Record<string, number>;
  };
  stockApi: {
    activeProvider: string;
    cachedStockPriceCount: number;
    recentQuotesCount: number;
    totalPredictions: number;
  };
  notifications: {
    totalDeliveries: number;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
    deliveryRatePercent: number;
    failureRatePercent: number;
    recentFailures: Array<{
      channel: string;
      recipient?: string;
      error?: string;
      failedAt?: string;
    }>;
  };
}

export interface ApiTelemetrySummary {
  totalRequests: number;
  statusCodes: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  avgLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  recentErrors: Array<{
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    correlationId?: string;
    timestamp: string;
    ip?: string;
    error?: string;
  }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  uptimeSeconds: number;
}

export interface SecurityMetricsReport {
  mfaAdoptionPercent: number;
  emailVerificationPercent: number;
  lockedAccountsCount: number;
  suspendedAccountsCount: number;
  recentSecurityIncidents: Array<{
    action: string;
    actorRole: string;
    ipAddress: string;
    failureReason?: string;
    timestamp: string;
  }>;
}

export interface AuditLogItem {
  _id: string;
  userId?: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  status: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  timestamp: string;
}

export interface AuditStats {
  totalLogs: number;
  successCount: number;
  failureCount: number;
  topActions: Array<{ action: string; count: number }>;
}
