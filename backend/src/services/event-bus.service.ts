import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import {
  NotificationType,
  NotificationSeverity,
  NotificationChannel,
} from '../models/notification.model.js';

export interface BudgetThresholdEvent {
  userId: string;
  budgetId: string;
  categoryId?: string;
  categoryName: string;
  spent: number;
  limit: number;
  percentage: number;
  period: string;
}

export interface BudgetExceededEvent {
  userId: string;
  budgetId: string;
  categoryId?: string;
  categoryName: string;
  spent: number;
  limit: number;
  overspentAmount: number;
  period: string;
}

export interface RecurringPaymentDueEvent {
  userId: string;
  expenseId: string;
  title: string;
  amount: number;
  dueDate: string | Date;
  daysUntilDue: number;
  categoryName?: string;
}

export interface SubscriptionRenewalEvent {
  userId: string;
  subscriptionId: string;
  name: string;
  amount: number;
  renewalDate: string | Date;
  daysUntilRenewal: number;
  cycle?: string;
}

export interface AnomalyDetectedEvent {
  userId: string;
  anomalyId: string;
  transactionId?: string;
  amount: number;
  description: string;
  severity: string;
  score: number;
  reason?: string;
}

export interface StockAlertEvent {
  userId: string;
  alertId?: string;
  symbol: string;
  alertType: string;
  threshold: number;
  currentPrice: number;
  percentChange?: number;
  notes?: string;
}

export interface PortfolioUpdateEvent {
  userId: string;
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  dailyPnl: number;
  dailyPnlPercent: number;
}

export interface MonthlyReportEvent {
  userId: string;
  reportId: string;
  month: number;
  year: number;
  summary: string;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
}

export interface DirectNotificationEvent {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  severity?: NotificationSeverity;
  channels?: NotificationChannel[];
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  bypassCooldown?: boolean;
}

export type DomainEvents = {
  'budget.threshold': BudgetThresholdEvent;
  'budget.exceeded': BudgetExceededEvent;
  'recurring.due': RecurringPaymentDueEvent;
  'subscription.renewal': SubscriptionRenewalEvent;
  'anomaly.detected': AnomalyDetectedEvent;
  'stock.alert': StockAlertEvent;
  'portfolio.update': PortfolioUpdateEvent;
  'report.generated': MonthlyReportEvent;
  'notification.trigger': DirectNotificationEvent;
};

class DomainEventBus extends EventEmitter {
  private static instance: DomainEventBus;

  private constructor() {
    super();
    // Allow ample listeners without warnings for multiple subscribers
    this.setMaxListeners(50);
  }

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  public emitEvent<K extends keyof DomainEvents>(event: K, data: DomainEvents[K]): boolean {
    logger.debug({ event, userId: (data as { userId?: string }).userId }, `[EventBus] Emitting domain event: ${event}`);
    return this.emit(event, data);
  }

  public subscribe<K extends keyof DomainEvents>(event: K, handler: (data: DomainEvents[K]) => Promise<void> | void): this {
    this.on(event, async (data: DomainEvents[K]) => {
      try {
        await handler(data);
      } catch (err: unknown) {
        const error = err as Error;
        logger.error(
          { event, error: error.message, stack: error.stack },
          `[EventBus] Uncaught error in handler for event: ${event}`,
        );
      }
    });
    return this;
  }
}

export const eventBus = DomainEventBus.getInstance();
