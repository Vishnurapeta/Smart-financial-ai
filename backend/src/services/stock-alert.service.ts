import { Types } from 'mongoose';
import { StockAlert, IStockAlert, StockAlertType } from '../models/stock-alert.model.js';
import { User } from '../models/user.model.js';
import { NotificationType, NotificationPriority } from '../models/notification.model.js';
import { NotificationService } from './notification.service.js';
import { MarketDataService } from './market-data/market-data.service.js';
import { MarketQuote } from './market-data/market-data.types.js';
import { cacheService } from '../config/redis.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CreateStockAlertDto {
  symbol: string;
  alertType: StockAlertType;
  threshold: number;
  cooldownMinutes?: number;
  notes?: string;
}

export interface UpdateStockAlertDto {
  alertType?: StockAlertType;
  threshold?: number;
  isActive?: boolean;
  cooldownMinutes?: number;
  notes?: string;
}

export interface AlertEvaluationResult {
  totalEvaluated: number;
  totalTriggered: number;
  triggeredAlertIds: string[];
}

export class StockAlertService {
  private static instance: StockAlertService;
  private marketDataService: MarketDataService;
  private notificationService: NotificationService;

  private constructor() {
    this.marketDataService = MarketDataService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): StockAlertService {
    if (!StockAlertService.instance) {
      StockAlertService.instance = new StockAlertService();
    }
    return StockAlertService.instance;
  }

  /**
   * Create a new configurable stock alert
   */
  async createAlert(userId: string, data: CreateStockAlertDto): Promise<IStockAlert> {
    const cleanSymbol = data.symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      throw new BadRequestError('Stock symbol is required');
    }

    if (data.threshold === undefined || isNaN(data.threshold) || data.threshold <= 0) {
      throw new BadRequestError('Threshold must be a positive number');
    }

    const cooldownMinutes = Math.max(5, data.cooldownMinutes ?? 60);

    // Verify symbol with market provider
    try {
      await this.marketDataService.getQuote(cleanSymbol);
    } catch (err) {
      logger.warn({ err, cleanSymbol }, 'Failed to verify stock symbol for alert creation');
      throw new BadRequestError(
        `Cannot configure alert: symbol '${cleanSymbol}' was not found in market registry`,
      );
    }

    // Check for duplicate active alert
    const existing = await StockAlert.findOne({
      userId: new Types.ObjectId(userId),
      symbol: cleanSymbol,
      alertType: data.alertType,
      threshold: data.threshold,
      isActive: true,
      isDeleted: false,
    });

    if (existing) {
      throw new ConflictError(
        `An active alert of type '${data.alertType}' at threshold ${data.threshold} already exists for ${cleanSymbol}`,
      );
    }

    const alert = await StockAlert.create({
      userId: new Types.ObjectId(userId),
      symbol: cleanSymbol,
      alertType: data.alertType,
      threshold: data.threshold,
      cooldownMinutes,
      notes: data.notes?.trim() || '',
      isActive: true,
      isTriggered: false,
      triggerCount: 0,
    });

    return alert;
  }

  /**
   * List all alerts for a user
   */
  async getUserAlerts(userId: string): Promise<IStockAlert[]> {
    return StockAlert.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Get alert by ID
   */
  async getAlertById(userId: string, alertId: string): Promise<IStockAlert> {
    if (!Types.ObjectId.isValid(alertId)) {
      throw new BadRequestError('Invalid alert ID format');
    }

    const alert = await StockAlert.findOne({
      _id: new Types.ObjectId(alertId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!alert) {
      throw new NotFoundError('Stock alert not found');
    }

    return alert;
  }

  /**
   * Update an existing alert
   */
  async updateAlert(
    userId: string,
    alertId: string,
    data: UpdateStockAlertDto,
  ): Promise<IStockAlert> {
    if (!Types.ObjectId.isValid(alertId)) {
      throw new BadRequestError('Invalid alert ID format');
    }

    const alert = await StockAlert.findOne({
      _id: new Types.ObjectId(alertId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!alert) {
      throw new NotFoundError('Stock alert not found');
    }

    if (data.threshold !== undefined) {
      if (isNaN(data.threshold) || data.threshold <= 0) {
        throw new BadRequestError('Threshold must be a positive number');
      }
      alert.threshold = data.threshold;
    }

    if (data.alertType) {
      alert.alertType = data.alertType;
    }

    if (data.isActive !== undefined) {
      alert.isActive = data.isActive;
    }

    if (data.cooldownMinutes !== undefined) {
      alert.cooldownMinutes = Math.max(5, data.cooldownMinutes);
    }

    if (data.notes !== undefined) {
      alert.notes = data.notes.trim();
    }

    await alert.save();
    return alert;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    if (!Types.ObjectId.isValid(alertId)) {
      throw new BadRequestError('Invalid alert ID format');
    }

    const alert = await StockAlert.findOne({
      _id: new Types.ObjectId(alertId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!alert) {
      throw new NotFoundError('Stock alert not found');
    }

    alert.isDeleted = true;
    alert.deletedAt = new Date();
    alert.isActive = false;
    await alert.save();
  }

  /**
   * Check if an alert condition is satisfied
   */
  private checkCondition(alert: IStockAlert, quote: MarketQuote): boolean {
    const price = quote.currentPrice ?? (quote as unknown as { price: number }).price;
    switch (alert.alertType) {
      case StockAlertType.PRICE_ABOVE:
        return price >= alert.threshold;
      case StockAlertType.PRICE_BELOW:
        return price <= alert.threshold;
      case StockAlertType.PERCENT_CHANGE_UP:
        return quote.changePercent >= alert.threshold;
      case StockAlertType.PERCENT_CHANGE_DOWN:
        return quote.changePercent <= -Math.abs(alert.threshold);
      case StockAlertType.VOLUME_ABOVE:
        return quote.volume >= alert.threshold;
      default:
        return false;
    }
  }

  /**
   * Build informative, professional notification copy
   */
  private formatAlertNotification(
    alert: IStockAlert,
    quote: MarketQuote,
  ): { title: string; message: string } {
    const price = quote.currentPrice ?? (quote as unknown as { price: number }).price;
    const formattedPrice = `$${price.toFixed(2)}`;
    const formattedChange = `${quote.change >= 0 ? '+' : ''}$${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`;
    const formattedVolume = `${(quote.volume / 1_000_000).toFixed(2)}M`;

    switch (alert.alertType) {
      case StockAlertType.PRICE_ABOVE:
        return {
          title: `Price Alert: ${alert.symbol} Above $${alert.threshold.toFixed(2)}`,
          message: `${alert.symbol} is trading at ${formattedPrice}, surpassing your target threshold of $${alert.threshold.toFixed(2)}. Day change: ${formattedChange}. Volume: ${formattedVolume}.`,
        };
      case StockAlertType.PRICE_BELOW:
        return {
          title: `Price Alert: ${alert.symbol} Below $${alert.threshold.toFixed(2)}`,
          message: `${alert.symbol} has dropped to ${formattedPrice}, falling below your floor threshold of $${alert.threshold.toFixed(2)}. Day change: ${formattedChange}. Volume: ${formattedVolume}.`,
        };
      case StockAlertType.PERCENT_CHANGE_UP:
        return {
          title: `Momentum Alert: ${alert.symbol} Up +${alert.threshold}%`,
          message: `${alert.symbol} gained ${formattedChange} today, surpassing your +${alert.threshold}% movement threshold. Current price: ${formattedPrice}.`,
        };
      case StockAlertType.PERCENT_CHANGE_DOWN:
        return {
          title: `Volatility Alert: ${alert.symbol} Down -${Math.abs(alert.threshold)}%`,
          message: `${alert.symbol} declined ${formattedChange} today, exceeding your -${Math.abs(alert.threshold)}% drawdown threshold. Current price: ${formattedPrice}.`,
        };
      case StockAlertType.VOLUME_ABOVE:
        return {
          title: `Volume Alert: ${alert.symbol} High Volume Spurt`,
          message: `${alert.symbol} daily volume reached ${formattedVolume} shares, exceeding your threshold of ${(alert.threshold / 1_000_000).toFixed(1)}M. Price: ${formattedPrice} (${formattedChange}).`,
        };
      default:
        return {
          title: `Market Alert: ${alert.symbol}`,
          message: `${alert.symbol} triggered alert rule. Current price: ${formattedPrice}.`,
        };
    }
  }

  /**
   * Evaluate all active alerts against latest market quotes.
   * Enforces cooldown deduplication via Redis + MongoDB timestamps to never spam users.
   */
  async evaluateAllAlerts(): Promise<AlertEvaluationResult> {
    const activeAlerts = await StockAlert.find({
      isActive: true,
      isDeleted: false,
    });

    if (activeAlerts.length === 0) {
      return { totalEvaluated: 0, totalTriggered: 0, triggeredAlertIds: [] };
    }

    // Group alerts by symbol to batch market queries
    const symbolMap = new Map<string, IStockAlert[]>();
    for (const alert of activeAlerts) {
      const list = symbolMap.get(alert.symbol) || [];
      list.push(alert);
      symbolMap.set(alert.symbol, list);
    }

    let totalTriggered = 0;
    const triggeredAlertIds: string[] = [];

    for (const [symbol, alerts] of symbolMap.entries()) {
      let quote: MarketQuote | null = null;
      try {
        quote = await this.marketDataService.getQuote(symbol);
      } catch (err) {
        logger.warn(
          { err, symbol },
          'Could not obtain quote during alert evaluation, skipping symbol',
        );
        continue;
      }

      if (!quote) continue;

      for (const alert of alerts) {
        try {
          // 1. Cooldown & Deduplication Check: In-memory/Redis cache lock
          const cooldownKey = `alert:cooldown:${alert._id.toString()}`;
          const isCoolingDown = await cacheService.get<string>(cooldownKey);
          if (isCoolingDown) {
            continue; // Deduplicated, in active cooldown period
          }

          // Also check persistent timestamp cooldown
          if (alert.lastTriggeredAt) {
            const cooldownMs = alert.cooldownMinutes * 60 * 1000;
            const elapsed = Date.now() - alert.lastTriggeredAt.getTime();
            if (elapsed < cooldownMs) {
              continue;
            }
          }

          // 2. Check if user has stock alerts enabled in preferences
          const user = await User.findById(alert.userId);
          if (user?.preferences?.stockAlertsEnabled === false) {
            continue;
          }

          // 3. Evaluate threshold condition
          const isMet = this.checkCondition(alert, quote);
          if (!isMet) {
            continue;
          }

          // 4. Condition met! Dispatch informational notification
          const { title, message } = this.formatAlertNotification(alert, quote);

          await this.notificationService.createNotification({
            userId: alert.userId,
            title,
            message,
            type: NotificationType.STOCK_ALERT,
            priority: NotificationPriority.MEDIUM,
            actionUrl: `/stocks?symbol=${alert.symbol}`,
            metadata: {
              alertId: alert._id.toString(),
              symbol: alert.symbol,
              alertType: alert.alertType,
              threshold: alert.threshold,
              currentPrice: quote.currentPrice ?? (quote as unknown as { price: number }).price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume,
            },
          });

          // 5. Set Redis cooldown deduplication key
          await cacheService.set(cooldownKey, 'triggered', alert.cooldownMinutes * 60);

          // 6. Persist trigger metrics in MongoDB
          alert.lastTriggeredAt = new Date();
          alert.triggerCount += 1;
          alert.isTriggered = true;
          await alert.save();

          totalTriggered++;
          triggeredAlertIds.push(alert._id.toString());
          logger.info(
            { alertId: alert._id.toString(), symbol: alert.symbol, alertType: alert.alertType },
            'Stock alert condition satisfied, notification dispatched',
          );
        } catch (alertErr) {
          logger.error(
            { alertErr, alertId: alert._id.toString() },
            'Error processing individual stock alert',
          );
        }
      }
    }

    return {
      totalEvaluated: activeAlerts.length,
      totalTriggered,
      triggeredAlertIds,
    };
  }
}
