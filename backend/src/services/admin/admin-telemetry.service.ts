export interface ApiRequestTelemetry {
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  correlationId?: string;
  timestamp: Date;
  ip?: string;
  error?: string;
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
  recentErrors: ApiRequestTelemetry[];
  topEndpoints: { endpoint: string; count: number }[];
  uptimeSeconds: number;
}

class AdminTelemetryServiceSingleton {
  private totalRequests = 0;
  private statusCodes = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  private latencySamples: number[] = [];
  private readonly maxSamples = 1000;
  private recentErrors: ApiRequestTelemetry[] = [];
  private readonly maxErrors = 50;
  private endpointHits: Map<string, number> = new Map();
  private startedAt = Date.now();

  /**
   * Record a completed HTTP request
   */
  public recordRequest(telemetry: ApiRequestTelemetry): void {
    this.totalRequests++;

    const code = telemetry.statusCode;
    if (code >= 200 && code < 300) {
      this.statusCodes['2xx']++;
    } else if (code >= 300 && code < 400) {
      this.statusCodes['3xx']++;
    } else if (code >= 400 && code < 500) {
      this.statusCodes['4xx']++;
    } else if (code >= 500) {
      this.statusCodes['5xx']++;
    }

    // Keep latency samples bounded
    if (this.latencySamples.length >= this.maxSamples) {
      this.latencySamples.shift();
    }
    this.latencySamples.push(telemetry.durationMs);

    // Track errors
    if (code >= 400) {
      if (this.recentErrors.length >= this.maxErrors) {
        this.recentErrors.shift();
      }
      this.recentErrors.push(telemetry);
    }

    // Track endpoint hits (normalize path by removing IDs for grouping)
    const normalizedPath = telemetry.url.split('?')[0].replace(/[0-9a-fA-F]{24}/g, ':id');
    const currentHits = this.endpointHits.get(normalizedPath) || 0;
    this.endpointHits.set(normalizedPath, currentHits + 1);
  }

  /**
   * Retrieve telemetry snapshot
   */
  public getSummary(): ApiTelemetrySummary {
    const latencies = [...this.latencySamples].sort((a, b) => a - b);
    const count = latencies.length;
    const avgLatencyMs = count > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / count) : 0;
    const maxLatencyMs = count > 0 ? latencies[count - 1] : 0;
    const p95Index = count > 0 ? Math.floor(count * 0.95) : 0;
    const p95LatencyMs = count > 0 ? latencies[p95Index] : 0;

    const topEndpoints = Array.from(this.endpointHits.entries())
      .map(([endpoint, hits]) => ({ endpoint, count: hits }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests: this.totalRequests,
      statusCodes: { ...this.statusCodes },
      avgLatencyMs,
      maxLatencyMs,
      p95LatencyMs,
      recentErrors: [...this.recentErrors].reverse(),
      topEndpoints,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  /**
   * Reset stats (e.g. for testing)
   */
  public reset(): void {
    this.totalRequests = 0;
    this.statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    this.latencySamples = [];
    this.recentErrors = [];
    this.endpointHits.clear();
    this.startedAt = Date.now();
  }
}

export const adminTelemetryService = new AdminTelemetryServiceSingleton();
