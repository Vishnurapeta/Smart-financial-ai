import { ErrorCategory } from '../../constants/observability.constants.js';

export interface RouteMetrics {
  route: string;
  method: string;
  requests: number;
  errors: number;
  durations: number[];
}

export interface MetricsSnapshot {
  http: {
    totalRequests: number;
    successCount: number;
    clientErrorCount: number;
    serverErrorCount: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    routes: Array<{
      route: string;
      method: string;
      count: number;
      avgDurationMs: number;
      p95DurationMs: number;
    }>;
  };
  auth: {
    successes: number;
    failures: number;
    failuresByReason: Record<string, number>;
    authorizationFailures: number;
  };
  ml: {
    inferencesTotal: number;
    failures: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    byModel: Record<string, { count: number; failures: number; avgDurationMs: number }>;
  };
  externalApis: {
    requestsTotal: number;
    failures: number;
    avgLatencyMs: number;
    byProvider: Record<string, { count: number; failures: number; avgDurationMs: number }>;
  };
  jobs: {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number;
    byQueue: Record<string, { total: number; completed: number; failed: number }>;
  };
  notifications: {
    total: number;
    delivered: number;
    failed: number;
    byChannel: Record<string, { delivered: number; failed: number }>;
  };
  errors: {
    total: number;
    byCategory: Record<string, number>;
  };
  system: {
    uptimeSeconds: number;
    memoryMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

class MetricsServiceSingleton {
  private startTime = Date.now();

  // Low-cardinality counters: labelKey -> count
  private httpRequests = new Map<string, number>();
  private httpDurations: number[] = [];
  private routeDurations = new Map<string, number[]>();

  private authSuccessCount = 0;
  private authFailures = new Map<string, number>();
  private authzFailures = new Map<string, number>();

  private mlInferences = new Map<string, number>();
  private mlDurations = new Map<string, number[]>();

  private externalRequests = new Map<string, number>();
  private externalDurations = new Map<string, number[]>();

  private backgroundJobs = new Map<string, number>();
  private jobDurations = new Map<string, number[]>();

  private notificationDeliveries = new Map<string, number>();
  private systemErrors = new Map<string, number>();

  private readonly maxSamplesPerBucket = 500;

  /**
   * Normalize route paths to keep label cardinality low (replace ObjectId and UUID with :id)
   */
  public normalizeRoute(path: string): string {
    return path
      .split('?')[0]
      .replace(/[0-9a-fA-F]{24}/g, ':id')
      .replace(/[0-9a-fA-F-]{36}/g, ':id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Record completed HTTP request
   */
  public recordHttpRequest(method: string, rawRoute: string, status: number, durationMs: number): void {
    try {
      const route = this.normalizeRoute(rawRoute);
      const statusClass = `${Math.floor(status / 100)}xx`;
      const key = `service="api",route="${route}",method="${method}",status="${status}",statusClass="${statusClass}"`;

      this.httpRequests.set(key, (this.httpRequests.get(key) || 0) + 1);

      // Latency sample bounds
      if (this.httpDurations.length >= this.maxSamplesPerBucket * 2) {
        this.httpDurations.shift();
      }
      this.httpDurations.push(durationMs);

      // Route specific samples
      const routeKey = `${method} ${route}`;
      let routeList = this.routeDurations.get(routeKey);
      if (!routeList) {
        routeList = [];
        this.routeDurations.set(routeKey, routeList);
      }
      if (routeList.length >= this.maxSamplesPerBucket) {
        routeList.shift();
      }
      routeList.push(durationMs);
    } catch {
      // Metric recording must never throw
    }
  }

  /**
   * Record Authentication event
   */
  public recordAuth(success: boolean, reason?: string): void {
    try {
      if (success) {
        this.authSuccessCount++;
      } else {
        const safeReason = reason ? reason.toUpperCase().replace(/\s+/g, '_') : 'INVALID_CREDENTIALS';
        this.authFailures.set(safeReason, (this.authFailures.get(safeReason) || 0) + 1);
      }
    } catch {
      // Ignored
    }
  }

  public recordAuthFailure(reason?: string): void {
    this.recordAuth(false, reason);
  }

  public recordAuthSuccess(): void {
    this.recordAuth(true);
  }

  /**
   * Record Authorization rejection (403)
   */
  public recordAuthorizationFailure(route: string): void {
    try {
      const cleanRoute = this.normalizeRoute(route);
      this.authzFailures.set(cleanRoute, (this.authzFailures.get(cleanRoute) || 0) + 1);
    } catch {
      // Ignored
    }
  }

  /**
   * Record ML Inference execution
   */
  public recordMLInference(model: string, success: boolean, durationMs: number): void {
    try {
      const status = success ? 'success' : 'failure';
      const key = `model="${model}",status="${status}"`;
      this.mlInferences.set(key, (this.mlInferences.get(key) || 0) + 1);

      let durations = this.mlDurations.get(model);
      if (!durations) {
        durations = [];
        this.mlDurations.set(model, durations);
      }
      if (durations.length >= this.maxSamplesPerBucket) {
        durations.shift();
      }
      durations.push(durationMs);
    } catch {
      // Ignored
    }
  }

  public recordMlInference(model: string, success: boolean, durationMs: number): void {
    this.recordMLInference(model, success, durationMs);
  }

  /**
   * Record External API request (e.g. Market provider, SMTP)
   */
  public recordExternalApi(provider: string, status: number | string, durationMs: number): void {
    try {
      const isSuccess = typeof status === 'number' ? status >= 200 && status < 300 : status === 'SUCCESS';
      const key = `provider="${provider}",status="${isSuccess ? 'success' : 'failure'}"`;
      this.externalRequests.set(key, (this.externalRequests.get(key) || 0) + 1);

      let durations = this.externalDurations.get(provider);
      if (!durations) {
        durations = [];
        this.externalDurations.set(provider, durations);
      }
      if (durations.length >= this.maxSamplesPerBucket) {
        durations.shift();
      }
      durations.push(durationMs);
    } catch {
      // Ignored
    }
  }

  /**
   * Record Background Job execution (BullMQ)
   */
  public recordBackgroundJob(queue: string, jobType: string, status: 'completed' | 'failed', durationMs: number): void {
    try {
      const key = `queue="${queue}",job_type="${jobType}",status="${status}"`;
      this.backgroundJobs.set(key, (this.backgroundJobs.get(key) || 0) + 1);

      const queueKey = `${queue}:${jobType}`;
      let durations = this.jobDurations.get(queueKey);
      if (!durations) {
        durations = [];
        this.jobDurations.set(queueKey, durations);
      }
      if (durations.length >= this.maxSamplesPerBucket) {
        durations.shift();
      }
      durations.push(durationMs);
    } catch {
      // Ignored
    }
  }

  /**
   * Record Notification delivery outcome
   */
  public recordNotificationDelivery(channel: string, status: 'delivered' | 'failed' | 'suppressed'): void {
    try {
      const key = `channel="${channel}",status="${status}"`;
      this.notificationDeliveries.set(key, (this.notificationDeliveries.get(key) || 0) + 1);
    } catch {
      // Ignored
    }
  }

  public recordNotification(channel: string, status: 'delivered' | 'failed' | 'suppressed'): void {
    this.recordNotificationDelivery(channel, status);
  }

  /**
   * Record System Error by Category
   */
  public recordSystemError(category: ErrorCategory | string): void {
    try {
      this.systemErrors.set(category, (this.systemErrors.get(category) || 0) + 1);
    } catch {
      // Ignored
    }
  }

  public recordError(category: ErrorCategory | string, _service?: string): void {
    this.recordSystemError(category);
  }

  public recordHealthCheck(_check: string, _status: string): void {
    // Health check metric observation
  }

  private calculatePercentile(samples: number[], percentile: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
    return Math.round(sorted[index]);
  }

  private calculateAverage(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / samples.length);
  }

  /**
   * Export in Prometheus text exposition format
   */
  public getPrometheusMetrics(): string {
    const lines: string[] = [];

    // HTTP Requests Total
    lines.push('# HELP http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of this.httpRequests.entries()) {
      lines.push(`http_requests_total{${key}} ${count}`);
    }

    // HTTP Request Duration
    lines.push('# HELP http_request_duration_ms Summary of HTTP request latencies in milliseconds');
    lines.push('# TYPE http_request_duration_ms gauge');
    lines.push(`http_request_duration_ms{quantile="0.5"} ${this.calculatePercentile(this.httpDurations, 0.5)}`);
    lines.push(`http_request_duration_ms{quantile="0.95"} ${this.calculatePercentile(this.httpDurations, 0.95)}`);
    lines.push(`http_request_duration_ms{quantile="0.99"} ${this.calculatePercentile(this.httpDurations, 0.99)}`);

    // Auth Failures Total
    lines.push('# HELP auth_failures_total Total authentication failures by reason');
    lines.push('# TYPE auth_failures_total counter');
    for (const [reason, count] of this.authFailures.entries()) {
      lines.push(`auth_failures_total{service="api",reason="${reason}"} ${count}`);
    }

    // Auth Success Total
    lines.push('# HELP auth_successes_total Total successful user authentications');
    lines.push('# TYPE auth_successes_total counter');
    lines.push(`auth_successes_total{service="api"} ${this.authSuccessCount}`);

    // Authorization Failures
    lines.push('# HELP authorization_failures_total Total 403 authorization rejections');
    lines.push('# TYPE authorization_failures_total counter');
    for (const [route, count] of this.authzFailures.entries()) {
      lines.push(`authorization_failures_total{service="api",route="${route}"} ${count}`);
    }

    // ML Inferences Total
    lines.push('# HELP ml_inference_total Total ML inferences executed');
    lines.push('# TYPE ml_inference_total counter');
    for (const [key, count] of this.mlInferences.entries()) {
      lines.push(`ml_inference_total{service="api",${key}} ${count}`);
    }

    // External API Requests Total
    lines.push('# HELP external_api_requests_total Total external integration requests');
    lines.push('# TYPE external_api_requests_total counter');
    for (const [key, count] of this.externalRequests.entries()) {
      lines.push(`external_api_requests_total{${key}} ${count}`);
    }

    // Background Jobs Total
    lines.push('# HELP background_jobs_total Total BullMQ background jobs processed');
    lines.push('# TYPE background_jobs_total counter');
    for (const [key, count] of this.backgroundJobs.entries()) {
      lines.push(`background_jobs_total{${key}} ${count}`);
    }

    // Notifications Total
    lines.push('# HELP notification_delivery_total Total notifications dispatched by channel');
    lines.push('# TYPE notification_delivery_total counter');
    for (const [key, count] of this.notificationDeliveries.entries()) {
      lines.push(`notification_delivery_total{${key}} ${count}`);
    }

    // System Errors Total
    lines.push('# HELP system_errors_total Total system errors by classified category');
    lines.push('# TYPE system_errors_total counter');
    for (const [cat, count] of this.systemErrors.entries()) {
      lines.push(`system_errors_total{service="api",category="${cat}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Snapshot metrics for Admin Dashboard consumption
   */
  public getSnapshot(): MetricsSnapshot {
    let totalRequests = 0;
    let successCount = 0;
    let clientErrorCount = 0;
    let serverErrorCount = 0;

    for (const [key, count] of this.httpRequests.entries()) {
      totalRequests += count;
      if (key.includes('statusClass="2xx"') || key.includes('statusClass="3xx"')) {
        successCount += count;
      } else if (key.includes('statusClass="4xx"')) {
        clientErrorCount += count;
      } else if (key.includes('statusClass="5xx"')) {
        serverErrorCount += count;
      }
    }

    const routeStats: MetricsSnapshot['http']['routes'] = [];
    for (const [routeKey, durations] of this.routeDurations.entries()) {
      const [method, route] = routeKey.split(' ');
      routeStats.push({
        route,
        method,
        count: durations.length,
        avgDurationMs: this.calculateAverage(durations),
        p95DurationMs: this.calculatePercentile(durations, 0.95),
      });
    }

    const failuresByReason: Record<string, number> = {};
    let totalAuthFailures = 0;
    for (const [reason, count] of this.authFailures.entries()) {
      failuresByReason[reason] = count;
      totalAuthFailures += count;
    }

    let totalAuthzFailures = 0;
    for (const count of this.authzFailures.values()) {
      totalAuthzFailures += count;
    }

    // ML Snapshot
    let mlTotal = 0;
    let mlFailures = 0;
    const allMlDurations: number[] = [];
    const byModel: MetricsSnapshot['ml']['byModel'] = {};

    for (const [key, count] of this.mlInferences.entries()) {
      mlTotal += count;
      const modelMatch = key.match(/model="([^"]+)"/);
      const modelName = modelMatch ? modelMatch[1] : 'unknown';
      if (key.includes('status="failure"')) {
        mlFailures += count;
      }

      if (!byModel[modelName]) {
        const durations = this.mlDurations.get(modelName) || [];
        byModel[modelName] = {
          count,
          failures: key.includes('status="failure"') ? count : 0,
          avgDurationMs: this.calculateAverage(durations),
        };
      }
    }

    for (const durations of this.mlDurations.values()) {
      allMlDurations.push(...durations);
    }

    // External APIs Snapshot
    let extTotal = 0;
    let extFailures = 0;
    const allExtDurations: number[] = [];
    const byProvider: MetricsSnapshot['externalApis']['byProvider'] = {};

    for (const [key, count] of this.externalRequests.entries()) {
      extTotal += count;
      const providerMatch = key.match(/provider="([^"]+)"/);
      const provider = providerMatch ? providerMatch[1] : 'unknown';
      if (key.includes('status="failure"')) {
        extFailures += count;
      }
      if (!byProvider[provider]) {
        const durations = this.externalDurations.get(provider) || [];
        byProvider[provider] = {
          count,
          failures: key.includes('status="failure"') ? count : 0,
          avgDurationMs: this.calculateAverage(durations),
        };
      }
    }

    for (const durations of this.externalDurations.values()) {
      allExtDurations.push(...durations);
    }

    // Jobs Snapshot
    let jobTotal = 0;
    let jobCompleted = 0;
    let jobFailed = 0;
    const allJobDurations: number[] = [];
    const byQueue: MetricsSnapshot['jobs']['byQueue'] = {};

    for (const [key, count] of this.backgroundJobs.entries()) {
      jobTotal += count;
      const queueMatch = key.match(/queue="([^"]+)"/);
      const qName = queueMatch ? queueMatch[1] : 'unknown';
      if (!byQueue[qName]) {
        byQueue[qName] = { total: 0, completed: 0, failed: 0 };
      }
      byQueue[qName].total += count;
      if (key.includes('status="completed"')) {
        jobCompleted += count;
        byQueue[qName].completed += count;
      } else {
        jobFailed += count;
        byQueue[qName].failed += count;
      }
    }

    for (const durations of this.jobDurations.values()) {
      allJobDurations.push(...durations);
    }

    // Notifications Snapshot
    let notifTotal = 0;
    let notifDelivered = 0;
    let notifFailed = 0;
    const byChannel: MetricsSnapshot['notifications']['byChannel'] = {};

    for (const [key, count] of this.notificationDeliveries.entries()) {
      notifTotal += count;
      const channelMatch = key.match(/channel="([^"]+)"/);
      const ch = channelMatch ? channelMatch[1] : 'unknown';
      if (!byChannel[ch]) {
        byChannel[ch] = { delivered: 0, failed: 0 };
      }
      if (key.includes('status="delivered"')) {
        notifDelivered += count;
        byChannel[ch].delivered += count;
      } else if (key.includes('status="failed"')) {
        notifFailed += count;
        byChannel[ch].failed += count;
      }
    }

    // Errors Snapshot
    let errorTotal = 0;
    const byCategory: Record<string, number> = {};
    for (const [cat, count] of this.systemErrors.entries()) {
      errorTotal += count;
      byCategory[cat] = count;
    }

    const mem = process.memoryUsage();

    return {
      http: {
        totalRequests,
        successCount,
        clientErrorCount,
        serverErrorCount,
        avgLatencyMs: this.calculateAverage(this.httpDurations),
        p95LatencyMs: this.calculatePercentile(this.httpDurations, 0.95),
        p99LatencyMs: this.calculatePercentile(this.httpDurations, 0.99),
        routes: routeStats.sort((a, b) => b.count - a.count).slice(0, 10),
      },
      auth: {
        successes: this.authSuccessCount,
        failures: totalAuthFailures,
        failuresByReason,
        authorizationFailures: totalAuthzFailures,
      },
      ml: {
        inferencesTotal: mlTotal,
        failures: mlFailures,
        avgLatencyMs: this.calculateAverage(allMlDurations),
        p95LatencyMs: this.calculatePercentile(allMlDurations, 0.95),
        byModel,
      },
      externalApis: {
        requestsTotal: extTotal,
        failures: extFailures,
        avgLatencyMs: this.calculateAverage(allExtDurations),
        byProvider,
      },
      jobs: {
        total: jobTotal,
        completed: jobCompleted,
        failed: jobFailed,
        avgDurationMs: this.calculateAverage(allJobDurations),
        byQueue,
      },
      notifications: {
        total: notifTotal,
        delivered: notifDelivered,
        failed: notifFailed,
        byChannel,
      },
      errors: {
        total: errorTotal,
        byCategory,
      },
      system: {
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        memoryMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        },
      },
    };
  }

  /**
   * Reset stats (useful for tests)
   */
  public reset(): void {
    this.httpRequests.clear();
    this.httpDurations = [];
    this.routeDurations.clear();
    this.authSuccessCount = 0;
    this.authFailures.clear();
    this.authzFailures.clear();
    this.mlInferences.clear();
    this.mlDurations.clear();
    this.externalRequests.clear();
    this.externalDurations.clear();
    this.backgroundJobs.clear();
    this.jobDurations.clear();
    this.notificationDeliveries.clear();
    this.systemErrors.clear();
    this.startTime = Date.now();
  }
}

export const metricsService = new MetricsServiceSingleton();
