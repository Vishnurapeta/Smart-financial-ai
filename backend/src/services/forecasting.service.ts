import { Types } from 'mongoose';
import { Transaction, TransactionType } from '../models/transaction.model.js';
import { RecurringExpense, RecurringFrequency } from '../models/recurring-expense.model.js';
import { FinancialGoal, GoalStatus } from '../models/financial-goal.model.js';
import { FinancialForecast, ForecastType, ForecastFrequency } from '../models/financial-forecast.model.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface MonthlyDataPointDTO {
  period: string; // YYYY-MM
  total_expense: number;
  total_income: number;
  category_expenses: Record<string, number>;
  transaction_count: number;
}

export interface RecurringCommitmentItemDTO {
  merchant: string;
  amount: number;
  frequency: string;
  category?: string;
}

export interface PlannedContributionItemDTO {
  title: string;
  amount: number;
  category?: string;
}

export class ForecastingService {
  /**
   * Prepares sanitized, chronologically ordered monthly financial series for a user.
   * Handles duplicate removal, excludes internal transfers, and validates positive amounts.
   */
  static async prepareHistoricalSeries(userId: string): Promise<MonthlyDataPointDTO[]> {
    const userObjectId = new Types.ObjectId(userId);

    const transactions = await Transaction.find({
      userId: userObjectId,
      isDeleted: false,
    })
      .sort({ date: 1 })
      .populate('category', 'name slug');

    const monthlyMap: Map<
      string,
      {
        totalExpense: number;
        totalIncome: number;
        categoryExpenses: Map<string, number>;
        txCount: number;
      }
    > = new Map();

    const seenTxHashes = new Set<string>();

    for (const tx of transactions) {
      // 1. Data cleaning: Validate amount and date
      if (!tx.date || isNaN(tx.date.getTime()) || tx.amount <= 0) {
        continue;
      }

      // 2. Prevent double counting: exclude internal transfers
      if (tx.type === TransactionType.TRANSFER) {
        continue;
      }

      // 3. Deduplication check: timestamp + amount + merchant
      const merchantClean = typeof tx.merchant === 'string' ? tx.merchant.toLowerCase().trim() : '';
      const dedupeKey = `${tx.date.toISOString().slice(0, 10)}_${tx.amount}_${merchantClean}`;
      if (seenTxHashes.has(dedupeKey)) {
        continue;
      }
      seenTxHashes.add(dedupeKey);

      // 4. Monthly period key
      const year = tx.date.getFullYear();
      const month = String(tx.date.getMonth() + 1).padStart(2, '0');
      const period = `${year}-${month}`;

      if (!monthlyMap.has(period)) {
        monthlyMap.set(period, {
          totalExpense: 0,
          totalIncome: 0,
          categoryExpenses: new Map(),
          txCount: 0,
        });
      }

      const bucket = monthlyMap.get(period)!;
      bucket.txCount += 1;

      const categoryName = (tx.category as any)?.name || 'General';

      if (tx.type === TransactionType.EXPENSE) {
        bucket.totalExpense += tx.amount;
        const currentCatAmt = bucket.categoryExpenses.get(categoryName) || 0;
        bucket.categoryExpenses.set(categoryName, currentCatAmt + tx.amount);
      } else if (tx.type === TransactionType.INCOME) {
        bucket.totalIncome += tx.amount;
      }
    }

    // Convert map to sorted DTO array
    const sortedPeriods = Array.from(monthlyMap.keys()).sort();
    return sortedPeriods.map((period) => {
      const b = monthlyMap.get(period)!;
      const catObj: Record<string, number> = {};
      b.categoryExpenses.forEach((amt, cat) => {
        catObj[cat] = Math.round(amt * 100) / 100;
      });

      return {
        period,
        total_expense: Math.round(b.totalExpense * 100) / 100,
        total_income: Math.round(b.totalIncome * 100) / 100,
        category_expenses: catObj,
        transaction_count: b.txCount,
      };
    });
  }

  /**
   * Prepares normalized monthly recurring commitments (rent, subscriptions, EMIs).
   */
  static async prepareRecurringCommitments(
    userId: string,
  ): Promise<{ totalMonthly: number; items: RecurringCommitmentItemDTO[] }> {
    const userObjectId = new Types.ObjectId(userId);
    const recurringList = await RecurringExpense.find({
      userId: userObjectId,
      isActive: true,
      isDeleted: false,
    });

    let totalMonthly = 0;
    const items: RecurringCommitmentItemDTO[] = [];

    for (const r of recurringList) {
      let monthlyMultiplier = 1.0;
      switch (r.frequency) {
        case RecurringFrequency.DAILY:
          monthlyMultiplier = 30.416;
          break;
        case RecurringFrequency.WEEKLY:
          monthlyMultiplier = 4.333;
          break;
        case RecurringFrequency.BIWEEKLY:
          monthlyMultiplier = 2.166;
          break;
        case RecurringFrequency.MONTHLY:
          monthlyMultiplier = 1.0;
          break;
        case RecurringFrequency.QUARTERLY:
          monthlyMultiplier = 1 / 3;
          break;
        case RecurringFrequency.ANNUALLY:
          monthlyMultiplier = 1 / 12;
          break;
        default:
          monthlyMultiplier = 1.0;
      }

      const monthlyAmount = Math.round(r.expectedAmount * monthlyMultiplier * 100) / 100;
      totalMonthly += monthlyAmount;

      items.push({
        merchant: r.merchant,
        amount: monthlyAmount,
        frequency: r.frequency,
      });
    }

    return {
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      items,
    };
  }

  /**
   * Prepares planned monthly contributions towards in-progress financial goals.
   */
  static async preparePlannedContributions(
    userId: string,
  ): Promise<{ totalMonthly: number; items: PlannedContributionItemDTO[] }> {
    const userObjectId = new Types.ObjectId(userId);
    const goals = await FinancialGoal.find({
      userId: userObjectId,
      status: GoalStatus.IN_PROGRESS,
      isDeleted: false,
    });

    let totalMonthly = 0;
    const items: PlannedContributionItemDTO[] = [];

    for (const g of goals) {
      if (g.autoContributeMonthly && g.autoContributeMonthly > 0) {
        totalMonthly += g.autoContributeMonthly;
        items.push({
          title: g.title,
          amount: g.autoContributeMonthly,
          category: g.category,
        });
      }
    }

    return {
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      items,
    };
  }

  /**
   * Generates or fetches an expense forecast.
   */
  static async getExpenseForecast(
    userId: string,
    options: {
      horizon?: number;
      frequency?: string;
      category?: string;
      preferredModel?: string;
    } = {},
  ): Promise<any> {
    const horizon = Math.min(Math.max(1, options.horizon || 3), 12);
    const frequency = options.frequency || 'monthly';
    const category = options.category && options.category !== 'all' ? options.category : null;

    // 1. Prepare user isolated data
    const historicalSeries = await this.prepareHistoricalSeries(userId);
    const recurringCommitments = await this.prepareRecurringCommitments(userId);

    // 2. Build payload for FastAPI microservice
    const payload = {
      user_id: userId,
      frequency,
      horizon,
      category,
      historical_series: historicalSeries,
      recurring_commitments: {
        total_monthly: recurringCommitments.totalMonthly,
        items: recurringCommitments.items,
      },
      preferred_model: options.preferredModel || null,
    };

    let result: any = null;

    // 3. Call FastAPI microservice
    try {
      const response = await fetch(`${env.ML_SERVICE_URL}/api/v1/forecasts/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.ML_SERVICE_SECRET_TOKEN
            ? { Authorization: `Bearer ${env.ML_SERVICE_SECRET_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        result = await response.json();
      } else {
        const errorText = await response.text();
        logger.warn(`FastAPI forecasting error [${response.status}]: ${errorText}`);
      }
    } catch (err) {
      logger.warn(`FastAPI forecasting unreachable: ${(err as Error).message}. Engaging Node fallback.`);
    }

    // 4. In-process heuristic/baseline fallback if ML microservice was unreachable
    if (!result) {
      result = this.generateFallbackExpenseForecast(
        userId,
        historicalSeries,
        recurringCommitments.totalMonthly,
        horizon,
        category,
      );
    }

    // 5. Persist forecast record for audit and tracking if successful
    if (result && result.status === 'success' && result.forecast?.length > 0) {
      try {
        await FinancialForecast.create({
          userId: new Types.ObjectId(userId),
          forecastType: ForecastType.EXPENSE,
          frequency: ForecastFrequency.MONTHLY,
          horizon,
          category: category || undefined,
          status: 'success',
          actualHistoryMonths: historicalSeries.length,
          minHistoryRequired: 3,
          forecast: result.forecast.map((f: any) => ({
            period: f.period,
            predictedExpense: f.predicted_expense,
            fixedRecurringExpenses: f.fixed_recurring_expenses,
            variableExpenses: f.variable_expenses,
            lowerBound: f.lower_bound,
            upperBound: f.upper_bound,
            timestamp: f.timestamp || new Date().toISOString(),
          })),
          modelMetadata: result.model
            ? {
                name: result.model.name,
                version: result.model.version,
                featureVersion: result.model.feature_version,
                modelType: result.model.model_type,
                trainingPeriod: result.model.training_period,
                selectionReason: result.model.selection_reason,
              }
            : undefined,
          metrics: result.metrics,
          recurringCommitmentsMonthly: recurringCommitments.totalMonthly,
          generatedAt: new Date(),
        });
      } catch (saveErr) {
        logger.error({ err: saveErr }, 'Failed to persist financial forecast');
      }
    }

    return result;
  }

  /**
   * Generates or fetches a cash-flow forecast.
   */
  static async getCashFlowForecast(
    userId: string,
    options: {
      horizon?: number;
      frequency?: string;
    } = {},
  ): Promise<any> {
    const horizon = Math.min(Math.max(1, options.horizon || 3), 12);
    const frequency = options.frequency || 'monthly';

    const historicalSeries = await this.prepareHistoricalSeries(userId);
    const recurringCommitments = await this.prepareRecurringCommitments(userId);
    const plannedContributions = await this.preparePlannedContributions(userId);

    const payload = {
      user_id: userId,
      frequency,
      horizon,
      historical_series: historicalSeries,
      recurring_commitments: {
        total_monthly: recurringCommitments.totalMonthly,
        items: recurringCommitments.items,
      },
      planned_contributions: {
        total_monthly: plannedContributions.totalMonthly,
        items: plannedContributions.items,
      },
    };

    let result: any = null;

    try {
      const response = await fetch(`${env.ML_SERVICE_URL}/api/v1/forecasts/cash-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.ML_SERVICE_SECRET_TOKEN
            ? { Authorization: `Bearer ${env.ML_SERVICE_SECRET_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        result = await response.json();
      } else {
        const errorText = await response.text();
        logger.warn(`FastAPI cash-flow error [${response.status}]: ${errorText}`);
      }
    } catch (err) {
      logger.warn(`FastAPI forecasting unreachable: ${(err as Error).message}. Engaging Node fallback.`);
    }

    if (!result) {
      result = this.generateFallbackCashFlowForecast(
        userId,
        historicalSeries,
        recurringCommitments.totalMonthly,
        plannedContributions.totalMonthly,
        horizon,
      );
    }

    if (result && result.status === 'success' && result.forecast?.length > 0) {
      try {
        await FinancialForecast.create({
          userId: new Types.ObjectId(userId),
          forecastType: ForecastType.CASH_FLOW,
          frequency: ForecastFrequency.MONTHLY,
          horizon,
          status: 'success',
          actualHistoryMonths: historicalSeries.length,
          minHistoryRequired: 3,
          forecast: result.forecast.map((f: any) => ({
            period: f.period,
            expectedIncome: f.expected_income,
            expectedExpenses: f.expected_expenses,
            fixedRecurringExpenses: f.fixed_recurring_expenses,
            variableExpenses: f.variable_expenses,
            plannedContributions: f.planned_contributions,
            projectedNetCashFlow: f.projected_net_cash_flow,
            isDeficit: f.is_deficit,
            timestamp: f.timestamp || new Date().toISOString(),
          })),
          modelMetadata: result.model
            ? {
                name: result.model.name,
                version: result.model.version,
                featureVersion: result.model.feature_version,
                modelType: result.model.model_type,
                trainingPeriod: result.model.training_period,
                selectionReason: result.model.selection_reason,
              }
            : undefined,
          metrics: result.metrics,
          recurringCommitmentsMonthly: recurringCommitments.totalMonthly,
          plannedContributionsMonthly: plannedContributions.totalMonthly,
          generatedAt: new Date(),
        });
      } catch (saveErr) {
        logger.error({ err: saveErr }, 'Failed to persist cash-flow forecast');
      }
    }

    return result;
  }

  /**
   * Retrieves past persisted forecasts for audit and accuracy tracking.
   */
  static async getForecastHistory(
    userId: string,
    options: { forecastType?: string; limit?: number } = {},
  ): Promise<any[]> {
    const filter: Record<string, any> = {
      userId: new Types.ObjectId(userId),
    };
    if (options.forecastType) {
      filter.forecastType = options.forecastType;
    }

    const limit = Math.min(Math.max(1, options.limit || 20), 100);

    return FinancialForecast.find(filter)
      .sort({ generatedAt: -1 })
      .limit(limit);
  }

  // --- Resilient In-Process Baseline Fallbacks ---

  private static generateFallbackExpenseForecast(
    userId: string,
    series: MonthlyDataPointDTO[],
    recurringMonthly: number,
    horizon: number,
    category: string | null,
  ): any {
    if (series.length < 3) {
      return {
        status: 'insufficient_data',
        message: `At least 3 months of transaction history are required to generate an expense forecast. Found ${series.length} months.`,
        min_history_required: 3,
        actual_history_months: series.length,
        user_id: userId,
        forecast_type: 'expense',
        frequency: 'monthly',
        category,
        historical_series: series,
        forecast: [],
        category_forecasts: [],
        disclaimer: 'Forecasts are model-generated estimates and not guaranteed outcomes.',
      };
    }

    const values = series.map((s) =>
      category ? s.category_expenses[category] || 0 : s.total_expense,
    );
    const last3 = values.slice(-3);
    const avg3 = last3.reduce((a, b) => a + b, 0) / 3;

    const lastPeriod = series[series.length - 1].period;
    const futurePeriods = this.computeNextPeriods(lastPeriod, horizon);

    const forecast = futurePeriods.map((p) => {
      const pred = Math.round(avg3 * 100) / 100;
      const fixed = Math.min(recurringMonthly, pred);
      return {
        period: p,
        predicted_expense: pred,
        fixed_recurring_expenses: Math.round(fixed * 100) / 100,
        variable_expenses: Math.round((pred - fixed) * 100) / 100,
        lower_bound: Math.round(pred * 0.85 * 100) / 100,
        upper_bound: Math.round(pred * 1.15 * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    });

    return {
      status: 'success',
      actual_history_months: series.length,
      user_id: userId,
      forecast_type: 'expense',
      frequency: 'monthly',
      category,
      historical_series: series,
      forecast,
      category_forecasts: [],
      model: {
        name: '3-Month Moving Average (Node Heuristic Fallback)',
        version: '1.0.0',
        feature_version: '1.0.0',
        model_type: 'baseline',
        training_period: `${series[0].period} to ${lastPeriod}`,
        selection_reason: 'Fallback baseline moving average',
      },
      metrics: {
        mae: 0.0,
        rmse: 0.0,
        mape: 0.0,
      },
      disclaimer: 'Forecasts are model-generated estimates and not guaranteed outcomes.',
    };
  }

  private static generateFallbackCashFlowForecast(
    userId: string,
    series: MonthlyDataPointDTO[],
    recurringMonthly: number,
    contributionsMonthly: number,
    horizon: number,
  ): any {
    if (series.length < 3) {
      return {
        status: 'insufficient_data',
        message: `At least 3 months of transaction history are required to generate a cash-flow forecast. Found ${series.length} months.`,
        min_history_required: 3,
        actual_history_months: series.length,
        user_id: userId,
        forecast_type: 'cash_flow',
        frequency: 'monthly',
        historical_series: series,
        forecast: [],
        disclaimer: 'Forecasts are model-generated estimates and not guaranteed outcomes.',
      };
    }

    const expValues = series.map((s) => s.total_expense).slice(-3);
    const incValues = series.map((s) => s.total_income).slice(-3);
    const avgExp = expValues.reduce((a, b) => a + b, 0) / 3;
    const avgInc = incValues.reduce((a, b) => a + b, 0) / 3;

    const lastPeriod = series[series.length - 1].period;
    const futurePeriods = this.computeNextPeriods(lastPeriod, horizon);

    const forecast = futurePeriods.map((p) => {
      const expectedInc = Math.round(avgInc * 100) / 100;
      const expectedExp = Math.round(avgExp * 100) / 100;
      const fixed = Math.min(recurringMonthly, expectedExp);
      const variable = Math.round((expectedExp - fixed) * 100) / 100;
      const planned = Math.round(contributionsMonthly * 100) / 100;
      const net = Math.round((expectedInc - expectedExp - planned) * 100) / 100;

      return {
        period: p,
        expected_income: expectedInc,
        expected_expenses: expectedExp,
        fixed_recurring_expenses: Math.round(fixed * 100) / 100,
        variable_expenses: variable,
        planned_contributions: planned,
        projected_net_cash_flow: net,
        is_deficit: net < 0,
        timestamp: new Date().toISOString(),
      };
    });

    return {
      status: 'success',
      actual_history_months: series.length,
      user_id: userId,
      forecast_type: 'cash_flow',
      frequency: 'monthly',
      historical_series: series,
      forecast,
      recurring_commitments_monthly: recurringMonthly,
      planned_contributions_monthly: contributionsMonthly,
      model: {
        name: 'Hybrid Cash-Flow (Node Heuristic Fallback)',
        version: '1.0.0',
        feature_version: '1.0.0',
        model_type: 'hybrid',
        training_period: `${series[0].period} to ${lastPeriod}`,
        selection_reason: 'Fallback baseline moving average',
      },
      disclaimer: 'Forecasts are model-generated estimates and not guaranteed outcomes.',
    };
  }

  private static computeNextPeriods(lastPeriod: string, count: number): string[] {
    const parts = lastPeriod.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);

    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      result.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return result;
  }
}
