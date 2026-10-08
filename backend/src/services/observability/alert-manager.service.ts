import { env } from '../../config/env.js';
import { ObservabilityEvent, LogLevel } from '../../constants/observability.constants.js';
import { logStructuredEvent } from '../../utils/logger.js';

export interface ObservabilityAlert {
  id: string;
  service: string;
  condition: string;
  severity: 'WARNING' | 'CRITICAL' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  status: 'ACTIVE' | 'RESOLVED';
  resolvedAt?: Date;
  incidentDurationMs?: number;
  metadata?: Record<string, unknown>;
}

class AlertManagerSingleton {
  private activeAlerts = new Map<string, ObservabilityAlert>();
  private alertHistory: ObservabilityAlert[] = [];
  private lastAlertTimestamp = new Map<string, number>();

  private readonly cooldownMs = env.ALERT_COOLDOWN_MS || 300000; // 5 min
  private readonly maxHistoryLength = 50;

  /**
   * Trigger an alert condition with deduplication and cooldown
   */
  public triggerAlert(
    service: string,
    condition: string,
    message: string,
    severity: 'WARNING' | 'CRITICAL' | 'WARN' | 'ERROR' | 'FATAL' = 'WARNING',
    metadata?: Record<string, unknown>,
  ): void {
    const alertKey = `${service}:${condition}`;
    const now = Date.now();
    const lastTime = this.lastAlertTimestamp.get(alertKey) || 0;

    const existingAlert = this.activeAlerts.get(alertKey);

    if (existingAlert) {
      existingAlert.lastTriggeredAt = new Date(now);
      // Suppress spam: only log if cooldown elapsed
      if (now - lastTime >= this.cooldownMs) {
        this.lastAlertTimestamp.set(alertKey, now);
        logStructuredEvent({
          service,
          event: ObservabilityEvent.SERVICE_DEGRADED,
          level: severity === 'CRITICAL' || severity === 'FATAL' || severity === 'ERROR' ? LogLevel.ERROR : LogLevel.WARN,
          metadata: {
            condition,
            severity,
            alertMessage: message,
            durationSinceStartMs: now - existingAlert.firstTriggeredAt.getTime(),
            ...metadata,
          },
        });
      }
      return;
    }

    // New Incident
    const newAlert: ObservabilityAlert = {
      id: `${alertKey}-${now}`,
      service,
      condition,
      severity,
      message,
      firstTriggeredAt: new Date(now),
      lastTriggeredAt: new Date(now),
      status: 'ACTIVE',
      metadata,
    };

    this.activeAlerts.set(alertKey, newAlert);
    this.lastAlertTimestamp.set(alertKey, now);

    logStructuredEvent({
      service,
      event: ObservabilityEvent.SERVICE_DEGRADED,
      level: severity === 'CRITICAL' || severity === 'FATAL' || severity === 'ERROR' ? LogLevel.ERROR : LogLevel.WARN,
      metadata: {
        condition,
        severity,
        alertMessage: message,
        ...metadata,
      },
    });
  }

  /**
   * Record incident alias
   */
  public recordIncident(
    condition: string,
    message: string,
    severity: 'WARNING' | 'CRITICAL' | 'WARN' | 'ERROR' | 'FATAL' = 'WARN',
    metadata?: Record<string, unknown>,
  ): void {
    this.triggerAlert('api', condition, message, severity, metadata);
  }

  /**
   * Check numerical threshold and alert if exceeded
   */
  public checkThreshold(
    condition: string,
    value: number,
    threshold: number,
    message: string,
    severity: 'WARNING' | 'CRITICAL' | 'WARN' | 'ERROR' | 'FATAL' = 'WARN',
  ): void {
    if (value >= threshold) {
      this.triggerAlert('api', condition, message, severity, { value, threshold });
    }
  }

  /**
   * Resolve an alert condition and emit recovery event
   */
  public resolveAlert(service: string, condition: string, recoveryDetails?: string): void {
    const alertKey = `${service}:${condition}`;
    const alert = this.activeAlerts.get(alertKey);

    if (!alert) {
      return;
    }

    const now = Date.now();
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date(now);
    alert.incidentDurationMs = now - alert.firstTriggeredAt.getTime();

    // Move to history
    this.activeAlerts.delete(alertKey);
    this.lastAlertTimestamp.delete(alertKey);

    if (this.alertHistory.length >= this.maxHistoryLength) {
      this.alertHistory.shift();
    }
    this.alertHistory.push(alert);

    logStructuredEvent({
      service,
      event: ObservabilityEvent.SERVICE_RECOVERED,
      level: LogLevel.INFO,
      metadata: {
        condition,
        incidentDurationMs: alert.incidentDurationMs,
        recoveryDetails: recoveryDetails || 'Service returned to operational state',
      },
    });
  }

  /**
   * Resolve alias
   */
  public resolve(condition: string, recoveryDetails?: string): void {
    this.resolveAlert('api', condition, recoveryDetails);
  }

  /**
   * Get active alerts list
   */
  public getActiveAlerts(): ObservabilityAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get recent incident history
   */
  public getRecentIncidents(): ObservabilityAlert[] {
    return [...this.alertHistory].reverse();
  }

  /**
   * Get active alerts and recent incidents for Admin Dashboard
   */
  public getAlertsStatus(): {
    activeAlerts: ObservabilityAlert[];
    recentIncidents: ObservabilityAlert[];
  } {
    return {
      activeAlerts: this.getActiveAlerts(),
      recentIncidents: this.getRecentIncidents().slice(0, 10),
    };
  }

  /**
   * Reset for testing
   */
  public reset(): void {
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.lastAlertTimestamp.clear();
  }
}

export const alertManager = new AlertManagerSingleton();
