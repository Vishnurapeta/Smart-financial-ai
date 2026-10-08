import { Types } from 'mongoose';
import { Transaction, TransactionType } from '../../models/transaction.model.js';
import '../../models/category.model.js';
import { Budget } from '../../models/budget.model.js';
import { NetWorthSnapshot } from '../../models/net-worth-snapshot.model.js';
import { RecurringExpense } from '../../models/recurring-expense.model.js';
import { Subscription, SubscriptionStatus } from '../../models/subscription.model.js';
import { FinancialGoal } from '../../models/financial-goal.model.js';
import { Asset } from '../../models/asset.model.js';
import { Liability } from '../../models/liability.model.js';
import { Portfolio } from '../../models/portfolio.model.js';
import { Holding } from '../../models/holding.model.js';
import { Watchlist } from '../../models/watchlist.model.js';
import { StockPrediction } from '../../models/stock-prediction.model.js';
import { FinancialForecast, ForecastFrequency } from '../../models/financial-forecast.model.js';
import { FinancialAnomaly } from '../../models/financial-anomaly.model.js';
import { User } from '../../models/user.model.js';
import { MarketDataService } from '../market-data/market-data.service.js';
import { ReportStatus } from '../../models/financial-report.model.js';
import { BadRequestError } from '../../utils/errors.js';

export interface MonthlyReportSnapshot {
  metadata: {
    reportType: string;
    reportVersion: string;
    templateVersion: string;
    generatedAt: string;
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    periodDisplay: string;
    periodLabel: string;
    timezone: string;
    currency: string;
    status: ReportStatus;
    limitations: string[];
  };
  executiveSummary: {
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRate: number | null; // null if income is 0
    savingsRateFormatted: string;
    monthlyBurnRate: number;
    burnRateDefinition: string;
    netWorth: number;
    portfolioValue: number;
    transactionCount: number;
    averageTransaction: number;
    averageDailySpending: number;
    keyTakeaway: string;
    insights: string[];
  };
  incomeSection: {
    totalIncome: number;
    previousMonthIncome: number;
    incomeChangeAmount: number;
    incomeChangePercent: number;
    percentageChange: number;
    byCategory: Array<{
      categoryId: string;
      name: string;
      color?: string;
      icon?: string;
      amount: number;
      percentage: number;
      count?: number;
    }>;
    sources: Array<{
      categoryId?: string;
      source: string;
      amount: number;
      percentage: number;
    }>;
  };
  expenseSection: {
    totalExpenses: number;
    previousMonthExpenses: number;
    expenseChangeAmount: number;
    expenseChangePercent: number;
    percentageChange: number;
    fixedExpenses: number;
    variableExpenses: number;
    topCategories: Array<{
      categoryId: string;
      name: string;
      color: string;
      icon: string;
      amount: number;
      percentage: number;
      count?: number;
    }>;
    categories: Array<{
      categoryId: string;
      category: string;
      name: string;
      color: string;
      icon: string;
      amount: number;
      percentage: number;
      count?: number;
    }>;
  };
  savingsSection: {
    savings: number;
    previousSavings: number;
    savingsChange: number;
    savingsRate: number | null;
    savingsRateFormatted: string;
    savingsRateChange: number | null;
  };
  dailySpending: Array<{
    day: number;
    date: string;
    amount: number;
    count: number;
  }>;
  monthlyTrends: Array<{
    month: number;
    monthName: string;
    year: number;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number | null;
  }>;
  largestTransactions: Array<{
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    type: string;
  }>;
  topExpenses: Array<{
    id: string;
    date: string;
    description: string;
    category: string;
    categoryColor?: string;
    categoryIcon?: string;
    amount: number;
    merchant?: string;
    paymentMethod?: string;
  }>;
  largestExpense: {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    merchant?: string;
  } | null;
  largestIncome: {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    merchant?: string;
  } | null;
  transactionSummary: {
    transactionCount: number;
    expenseCount: number;
    incomeCount: number;
    averageTransaction: number;
    averageDailySpending: number;
    daysInMonth: number;
  };
  recurringCommitments: {
    activeRecurringCount: number;
    totalRecurringMonthly: number;
    activeSubscriptionCount: number;
    totalSubscriptionMonthly: number;
    totalMonthlyCommitments: number;
    upcomingBills: Array<{
      id: string;
      name: string;
      amount: number;
      frequency: string;
      nextExpectedDate: string;
      type: 'RECURRING' | 'SUBSCRIPTION';
    }>;
  };
  financialGoals: {
    totalGoalsCount: number;
    activeGoals: Array<{
      id: string;
      name: string;
      targetAmount: number;
      currentAmount: number;
      progressPercent: number;
      remainingAmount: number;
      targetDate?: string;
    }>;
  };
  goalsSection: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    remainingAmount: number;
    targetDate?: string;
  }>;
  netWorthSection: {
    totalAssets: number;
    totalLiabilities: number;
    currentNetWorth: number;
    previousNetWorth: number;
    netWorthChange: number;
    netWorthChangePercent: number;
    absoluteChange?: number;
    percentageChange?: number;
  };
  portfolioSection: {
    available?: boolean;
    hasPortfolio: boolean;
    totalInvested: number;
    currentMarketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    realizedPnL: number;
    holdingsCount: number;
    holdings: Array<{
      symbol: string;
      companyName: string;
      shares: number;
      avgPrice: number;
      currentPrice: number;
      marketValue: number;
      pnl: number;
      pnlPercent: number;
    }>;
  };
  watchlistSection: {
    available: boolean;
    symbolCount: number;
    symbols: Array<{
      symbol: string;
      price?: number;
      change?: number;
      changePercent?: number;
    }>;
  };
  stockModelForecasts: {
    available: boolean;
    disclaimer: string;
    forecasts: Array<{
      symbol: string;
      predictionHorizonDays: string | number;
      currentPrice: number;
      predictedPrice: number;
      predictedReturnPercent: number;
      modelName: string;
      modelVersion: string;
      featureVersion: string;
      historicalRmse: number;
      predictionDate: string;
    }>;
  };
  forecastSection: {
    available: boolean;
    disclaimer: string;
    expenseForecast?: {
      nextMonthEstimatedExpenses: number;
      confidenceScore: number;
      modelUsed: string;
    };
    cashFlowForecast?: {
      projectedIncome: number;
      projectedExpense: number;
      projectedNetFlow: number;
      period: string;
    };
  };
  anomalySection: {
    unusualSpendingCount: number;
    affectedCategories: string[];
    events: Array<{
      id: string;
      date: string;
      merchant: string;
      amount: number;
      severity: string;
      score: number;
      reason: string;
    }>;
  };
  insights: string[];
}

/**
 * Returns exact start and end timestamps for a given year & month in Asia/Kolkata (UTC+5:30)
 */
export function getMonthBoundsIST(year: number, month: number) {
  // Asia/Kolkata is UTC+05:30 (5 hours 30 mins)
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - offsetMs);
  const nextMonthStart = new Date(
    Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0, 0) - offsetMs,
  );
  const endDate = new Date(nextMonthStart.getTime() - 1);
  const lastDay = new Date(year, month, 0).getDate();
  const periodDisplay = `01/${String(month).padStart(2, '0')}/${year} to ${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  return { startDate, nextMonthStart, endDate, lastDay, periodDisplay };
}

export interface CompleteFinancialReportData {
  metadata: {
    reportId: string;
    appName: string;
    userName: string;
    userEmail: string;
    currency: string;
    timezone: string;
    fromDateStr: string;
    toDateStr: string;
    periodDisplay: string;
    generatedAt: string;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number | null;
    savingsRateDisplay: string;
    transactionCount: number;
    largestExpense: number;
    largestIncome: number;
    averageTransaction: number;
    averageExpense: number;
    averageIncome: number;
  };
  transactions: Array<{
    id: string;
    date: string;
    dateRaw: Date;
    description: string;
    merchant: string;
    category: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    amount: number;
    paymentMethod: string;
  }>;
  incomeAnalysis: {
    totalIncome: number;
    count: number;
    averageIncome: number;
    largestIncome: number;
    byCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
      count: number;
    }>;
  };
  expenseAnalysis: {
    totalExpenses: number;
    count: number;
    averageExpense: number;
    largestExpense: number;
    byCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
      count: number;
    }>;
  };
  categoryBreakdown: Array<{
    category: string;
    type: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  budgets: {
    available: boolean;
    records: Array<{
      name: string;
      category: string;
      limit: number;
      spent: number;
      remaining: number;
      utilizationPercent: number;
      status: 'Within Budget' | 'Exceeded';
    }>;
  };
  portfolio: {
    available: boolean;
    isSnapshot: boolean;
    snapshotLabel: string;
    totalInvested: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    holdings: Array<{
      symbol: string;
      companyName: string;
      quantity: number;
      avgBuyPrice: number;
      currentPrice: number;
      investedAmount: number;
      marketValue: number;
      pnl: number;
      pnlPercent: number;
    }>;
  };
  netWorth: {
    available: boolean;
    isSnapshot: boolean;
    snapshotLabel: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    assetBreakdown: {
      cash: number;
      bankBalance: number;
      investments: number;
      otherAssets: number;
    };
    liabilityBreakdown: {
      loans: number;
      creditCardDebt: number;
      otherLiabilities: number;
    };
    trendPoints: Array<{ date: string; netWorth: number }>;
  };
  goals: {
    available: boolean;
    records: Array<{
      title: string;
      targetAmount: number;
      currentAmount: number;
      remainingAmount: number;
      progressPercent: number;
      targetDate: string;
      status: string;
    }>;
  };
  subscriptions: {
    available: boolean;
    totalMonthlyCost: number;
    estimatedAnnualCost: number;
    records: Array<{
      name: string;
      amount: number;
      billingCycle: string;
      nextBillingDate: string;
      category: string;
      status: string;
    }>;
  };
  forecasting: {
    available: boolean;
    label: string;
    projectedExpenses?: number;
    projectedCashFlow?: number;
    confidenceScore?: number;
    modelUsed?: string;
    notes?: string;
  };
  anomalies: {
    available: boolean;
    records: Array<{
      date: string;
      merchant: string;
      amount: number;
      category: string;
      severity: string;
      reason: string;
    }>;
  };
  dailySpendingTrend: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
}

/**
 * Parses and validates an arbitrary date range string in Asia/Kolkata timezone (+05:30)
 */
export function parseDateRangeIST(fromStr: string, toStr: string): {
  startDate: Date;
  endDate: Date;
  fromDateStr: string;
  toDateStr: string;
  periodDisplay: string;
} {
  if (!fromStr || !toStr) {
    throw new BadRequestError('From date and To date are required.');
  }

  const cleanFrom = fromStr.trim().split('T')[0];
  const cleanTo = toStr.trim().split('T')[0];

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(cleanFrom) || !dateRegex.test(cleanTo)) {
    throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD for from and to parameters.');
  }

  const [fY, fM, fD] = cleanFrom.split('-').map(Number);
  const [tY, tM, tD] = cleanTo.split('-').map(Number);

  // UTC start: from Y-M-D 00:00:00 IST -> Date.UTC - 5.5 hours
  const startUtcMs = Date.UTC(fY, fM - 1, fD, 0, 0, 0, 0) - 5.5 * 3600 * 1000;
  // UTC end: to Y-M-D 23:59:59.999 IST -> Date.UTC - 5.5 hours
  const endUtcMs = Date.UTC(tY, tM - 1, tD, 23, 59, 59, 999) - 5.5 * 3600 * 1000;

  if (startUtcMs > endUtcMs) {
    throw new BadRequestError('From date cannot be later than To date.');
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const fromFmt = `${String(fD).padStart(2, '0')} ${months[fM - 1]} ${fY}`;
  const toFmt = `${String(tD).padStart(2, '0')} ${months[tM - 1]} ${tY}`;
  const periodDisplay = `${fromFmt} – ${toFmt}`;

  return {
    startDate: new Date(startUtcMs),
    endDate: new Date(endUtcMs),
    fromDateStr: cleanFrom,
    toDateStr: cleanTo,
    periodDisplay,
  };
}

export class ReportAggregatorService {
  private static instance: ReportAggregatorService;

  private constructor() { }

  public static getInstance(): ReportAggregatorService {
    if (!ReportAggregatorService.instance) {
      ReportAggregatorService.instance = new ReportAggregatorService();
    }
    return ReportAggregatorService.instance;
  }

  /**
   * Aggregate all data sources into an immutable, validated report snapshot
   */
  public async buildMonthlySnapshot(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthlyReportSnapshot> {
    const userObjectId = new Types.ObjectId(userId);
    const limitations: string[] = [];

    // 1. Resolve User and Settings
    const user = await User.findById(userId).select('defaultCurrency locale timezone');
    const currency = user?.defaultCurrency || 'INR';
    const timezone = (user as any)?.timezone || 'Asia/Kolkata';

    // 2. Define Period Boundaries using consistent Asia/Kolkata timezone
    const { startDate: periodStart, nextMonthStart, endDate: periodEnd, lastDay, periodDisplay } =
      getMonthBoundsIST(year, month);

    // Previous month boundaries
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const { startDate: prevStart, nextMonthStart: prevNextMonthStart } =
      getMonthBoundsIST(prevYear, prevMonth);

    // Year boundaries for 12-month trends
    const { startDate: yearStart } = getMonthBoundsIST(year, 1);
    const { nextMonthStart: nextYearStart } = getMonthBoundsIST(year, 12);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const periodLabel = `${monthNames[month - 1]} ${year}`;

    const baseFilter = {
      userId: userObjectId,
      isDeleted: false,
    };

    // 3. Parallel Aggregation of Financial Data Sources
    const [
      currentMonthTxs,
      prevMonthTxs,
      topCategoriesAgg,
      topIncomeCategoriesAgg,
      dailySpendingAgg,
      monthlyTrendsAgg,
      largestTxs,
      largestExpensesDocs,
      largestIncomesDocs,
      recurringExpenses,
      subscriptions,
      goals,
      assets,
      liabilities,
      portfolio,
      watchlist,
      anomalies,
      forecastDoc,
    ] = await Promise.all([
      // A. Current Month Inflow & Outflow
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: periodStart, $lt: nextMonthStart },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // B. Previous Month Inflow & Outflow
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: prevStart, $lt: prevNextMonthStart },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // C. Expenses by Category
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
            date: { $gte: periodStart, $lt: nextMonthStart },
          },
        },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      ]),

      // D. Income by Category
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.INCOME,
            date: { $gte: periodStart, $lt: nextMonthStart },
          },
        },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      ]),

      // E. Daily Spending Trend for selected month
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
            date: { $gte: periodStart, $lt: nextMonthStart },
          },
        },
        {
          $group: {
            _id: { $dayOfMonth: { date: '$date', timezone: 'Asia/Kolkata' } },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // F. Monthly Comparison Trends across the selected year
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: yearStart, $lt: nextYearStart },
          },
        },
        {
          $group: {
            _id: {
              month: { $month: { date: '$date', timezone: 'Asia/Kolkata' } },
              type: '$type',
            },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // G. Largest Transactions (all types)
      Transaction.find({
        ...baseFilter,
        date: { $gte: periodStart, $lt: nextMonthStart },
      })
        .sort({ amount: -1 })
        .limit(5)
        .populate('category', 'name color icon')
        .lean(),

      // H. Top Expenses (largest outflows)
      Transaction.find({
        ...baseFilter,
        type: TransactionType.EXPENSE,
        date: { $gte: periodStart, $lt: nextMonthStart },
      })
        .sort({ amount: -1 })
        .limit(10)
        .populate('category', 'name color icon')
        .lean(),

      // I. Top Incomes (largest inflows)
      Transaction.find({
        ...baseFilter,
        type: TransactionType.INCOME,
        date: { $gte: periodStart, $lt: nextMonthStart },
      })
        .sort({ amount: -1 })
        .limit(5)
        .populate('category', 'name color icon')
        .lean(),

      // J. Recurring Expenses
      RecurringExpense.find({
        ...baseFilter,
        isActive: true,
      }).lean(),

      // K. Subscriptions
      Subscription.find({
        ...baseFilter,
        status: SubscriptionStatus.ACTIVE,
      }).lean(),

      // L. Financial Goals
      FinancialGoal.find({
        ...baseFilter,
      }).lean(),

      // M. Assets & Liabilities (Net Worth)
      Asset.find({ ...baseFilter }).lean(),
      Liability.find({ ...baseFilter }).lean(),

      // N. Portfolio & Holdings
      Portfolio.findOne({ ...baseFilter }).lean(),

      // O. Watchlist
      Watchlist.findOne({ ...baseFilter, isDefault: true }).lean(),

      // P. Anomalies in this Month
      FinancialAnomaly.find({
        ...baseFilter,
        createdAt: { $gte: periodStart, $lte: periodEnd },
      }).lean(),

      // Q. Forecast
      FinancialForecast.findOne({
        userId: userObjectId,
        frequency: ForecastFrequency.MONTHLY,
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // 4. Calculate Income & Expense Metrics
    let currentIncome = 0;
    let currentExpense = 0;
    let currentMonthTxCount = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    for (const item of currentMonthTxs) {
      currentMonthTxCount += item.count || 0;
      if (item._id === TransactionType.INCOME) {
        currentIncome = Math.round(item.total * 100) / 100;
        incomeCount = item.count || 0;
      }
      if (item._id === TransactionType.EXPENSE) {
        currentExpense = Math.round(item.total * 100) / 100;
        expenseCount = item.count || 0;
      }
    }

    let prevIncome = 0;
    let prevExpense = 0;
    for (const item of prevMonthTxs) {
      if (item._id === TransactionType.INCOME) prevIncome = Math.round(item.total * 100) / 100;
      if (item._id === TransactionType.EXPENSE) prevExpense = Math.round(item.total * 100) / 100;
    }

    const incomeChangeAmount = Math.round((currentIncome - prevIncome) * 100) / 100;
    const incomeChangePercent =
      prevIncome > 0
        ? Math.round(((currentIncome - prevIncome) / prevIncome) * 100 * 10) / 10
        : currentIncome > 0
          ? 100
          : 0;

    const expenseChangeAmount = Math.round((currentExpense - prevExpense) * 100) / 100;
    const expenseChangePercent =
      prevExpense > 0
        ? Math.round(((currentExpense - prevExpense) / prevExpense) * 100 * 10) / 10
        : currentExpense > 0
          ? 100
          : 0;

    // 5. Calculate Savings & Savings Rate (Strictly No Divide-by-Zero)
    const savings = Math.round((currentIncome - currentExpense) * 100) / 100;
    const previousSavings = Math.round((prevIncome - prevExpense) * 100) / 100;
    const savingsChange = Math.round((savings - previousSavings) * 100) / 100;

    const savingsRate =
      currentIncome > 0
        ? Math.round((savings / currentIncome) * 100 * 10) / 10
        : null;

    const prevSavingsRate =
      prevIncome > 0
        ? Math.round((previousSavings / prevIncome) * 100 * 10) / 10
        : null;

    const savingsRateChange =
      savingsRate !== null && prevSavingsRate !== null
        ? Math.round((savingsRate - prevSavingsRate) * 10) / 10
        : null;

    const savingsRateFormatted =
      savingsRate !== null ? `${savingsRate.toFixed(1)}%` : 'Not available';

    // 6. Burn Rate & Transaction Averages
    const monthlyBurnRate = currentExpense > 0 ? currentExpense : 0;
    const burnRateDefinition =
      'Monthly operational cash outflow representing total recurring & discretionary spending during the period.';

    const averageTransaction =
      currentMonthTxCount > 0
        ? Math.round(((currentExpense + currentIncome) / currentMonthTxCount) * 100) / 100
        : 0;

    const averageDailySpending =
      lastDay > 0
        ? Math.round((currentExpense / lastDay) * 100) / 100
        : 0;

    // 7. Spending Categories Breakdown
    const topCategories = topCategoriesAgg.map((cat: any) => {
      const amount = Math.round(cat.totalAmount * 100) / 100;
      const percentage =
        currentExpense > 0 ? Math.round((amount / currentExpense) * 100 * 10) / 10 : 0;
      return {
        categoryId: cat._id?.toString() || 'uncategorized',
        category: cat.cat?.name || 'Uncategorized',
        name: cat.cat?.name || 'Uncategorized',
        color: cat.cat?.color || '#10b981',
        icon: cat.cat?.icon || 'tag',
        amount,
        percentage,
        count: cat.count || 0,
      };
    });

    // Income Categories Breakdown
    const byCategoryIncome = topIncomeCategoriesAgg.map((cat: any) => {
      const amount = Math.round(cat.totalAmount * 100) / 100;
      const percentage =
        currentIncome > 0 ? Math.round((amount / currentIncome) * 100 * 10) / 10 : 0;
      return {
        categoryId: cat._id?.toString() || 'income-other',
        name: cat.cat?.name || 'General Income',
        color: cat.cat?.color || '#10b981',
        icon: cat.cat?.icon || 'dollar-sign',
        amount,
        percentage,
        count: cat.count || 0,
      };
    });

    // 8. Daily Spending Array (1 to lastDay)
    const dailyMap = new Map<number, { amount: number; count: number }>();
    for (const d of dailySpendingAgg) {
      if (typeof d._id === 'number') {
        dailyMap.set(d._id, { amount: Math.round(d.totalAmount * 100) / 100, count: d.count });
      }
    }

    const dailySpending: Array<{ day: number; date: string; amount: number; count: number }> = [];
    for (let day = 1; day <= lastDay; day++) {
      const entry = dailyMap.get(day) || { amount: 0, count: 0 };
      dailySpending.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        amount: entry.amount,
        count: entry.count,
      });
    }

    // 9. Monthly Comparison Trends (1 to 12)
    const monthFlowMap = new Map<number, { income: number; expense: number }>();
    for (const item of monthlyTrendsAgg) {
      const m = item._id?.month;
      const t = item._id?.type;
      if (typeof m === 'number') {
        if (!monthFlowMap.has(m)) {
          monthFlowMap.set(m, { income: 0, expense: 0 });
        }
        const obj = monthFlowMap.get(m)!;
        if (t === TransactionType.INCOME) obj.income += item.totalAmount;
        if (t === TransactionType.EXPENSE) obj.expense += item.totalAmount;
      }
    }

    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = monthShortNames.map((name, idx) => {
      const m = idx + 1;
      const flow = monthFlowMap.get(m) || { income: 0, expense: 0 };
      const inc = Math.round(flow.income * 100) / 100;
      const exp = Math.round(flow.expense * 100) / 100;
      const sav = Math.round((inc - exp) * 100) / 100;
      const rate = inc > 0 ? Math.round((sav / inc) * 100 * 10) / 10 : null;
      return {
        month: m,
        monthName: name,
        year,
        income: inc,
        expenses: exp,
        savings: sav,
        savingsRate: rate,
      };
    });

    // 10. Top Expenses & Largest Transactions
    const formattedLargestTxs = largestTxs.map((tx: any) => ({
      id: tx._id.toString(),
      date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
      description: tx.description || tx.merchant || 'Transaction',
      category: (tx.category as any)?.name || 'General',
      amount: tx.amount,
      type: tx.type,
    }));

    const topExpenses = largestExpensesDocs.map((tx: any) => ({
      id: tx._id.toString(),
      date: tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
      description: tx.description || tx.merchant || 'Expense',
      merchant: tx.merchant || '',
      category: (tx.category as any)?.name || 'General',
      categoryColor: (tx.category as any)?.color || '#10b981',
      categoryIcon: (tx.category as any)?.icon || 'tag',
      amount: Math.round(tx.amount * 100) / 100,
      paymentMethod: tx.paymentMethod || 'DEBIT_CARD',
    }));

    const largestExpense = topExpenses.length > 0 ? topExpenses[0] : null;

    const largestIncome = largestIncomesDocs.length > 0 ? {
      id: largestIncomesDocs[0]._id.toString(),
      date: largestIncomesDocs[0].date ? new Date(largestIncomesDocs[0].date).toISOString().split('T')[0] : '',
      description: largestIncomesDocs[0].description || largestIncomesDocs[0].merchant || 'Income',
      merchant: largestIncomesDocs[0].merchant || '',
      category: (largestIncomesDocs[0].category as any)?.name || 'General Income',
      amount: Math.round(largestIncomesDocs[0].amount * 100) / 100,
    } : null;

    // 11. Recurring Expenses & Subscriptions Commitments
    let totalRecurringMonthly = 0;
    const upcomingBills: Array<MonthlyReportSnapshot['recurringCommitments']['upcomingBills'][0]> = [];

    for (const rec of recurringExpenses) {
      totalRecurringMonthly += rec.expectedAmount;
      upcomingBills.push({
        id: rec._id.toString(),
        name: rec.merchant,
        amount: rec.expectedAmount,
        frequency: rec.frequency,
        nextExpectedDate: (rec as any).nextDueDate
          ? new Date((rec as any).nextDueDate).toISOString().split('T')[0]
          : '',
        type: 'RECURRING',
      });
    }

    let totalSubscriptionMonthly = 0;
    for (const sub of subscriptions) {
      const monthlyAmount =
        sub.billingCycle === 'ANNUALLY'
          ? Math.round((sub.amount / 12) * 100) / 100
          : sub.amount;
      totalSubscriptionMonthly += monthlyAmount;
      upcomingBills.push({
        id: sub._id.toString(),
        name: sub.name,
        amount: sub.amount,
        frequency: sub.billingCycle,
        nextExpectedDate: sub.renewalDate
          ? new Date(sub.renewalDate).toISOString().split('T')[0]
          : '',
        type: 'SUBSCRIPTION',
      });
    }

    // 12. Financial Goals Progress
    const activeGoals = goals.map((g: any) => {
      const targetAmount = g.targetAmount || 1;
      const currentAmount = g.currentAmount || 0;
      const progressPercent = Math.min(100, Math.round((currentAmount / targetAmount) * 100 * 10) / 10);
      const remainingAmount = Math.max(0, targetAmount - currentAmount);

      return {
        id: g._id.toString(),
        name: g.title || g.name || 'Financial Goal',
        targetAmount,
        currentAmount,
        progressPercent,
        remainingAmount,
        targetDate: g.targetDate ? new Date(g.targetDate).toISOString().split('T')[0] : undefined,
      };
    });

    // 13. Net Worth Calculation
    const totalAssets = assets.reduce((sum, a: any) => sum + (a.currentValue || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, l: any) => sum + (l.currentBalance || 0), 0);
    const currentNetWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;
    const previousNetWorth = Math.round((currentNetWorth - savings) * 100) / 100;
    const netWorthChange = Math.round((currentNetWorth - previousNetWorth) * 100) / 100;
    const netWorthChangePercent =
      previousNetWorth !== 0
        ? Math.round((netWorthChange / Math.abs(previousNetWorth)) * 100 * 10) / 10
        : 0;

    // 14. Portfolio and Holdings
    let holdingsList: MonthlyReportSnapshot['portfolioSection']['holdings'] = [];
    let portfolioTotalInvested = 0;
    let portfolioMarketValue = 0;
    let unrealizedPnL = 0;
    let unrealizedPnLPercent = 0;

    if (portfolio) {
      const holdings = await Holding.find({
        portfolioId: portfolio._id,
        isDeleted: false,
      }).lean();

      holdingsList = holdings.map((h: any) => {
        const invested = h.totalCost || (h.quantity * h.averageBuyPrice);
        const marketVal = h.currentValue || invested;
        const pnl = h.unrealizedPnL || (marketVal - invested);
        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

        portfolioTotalInvested += invested;
        portfolioMarketValue += marketVal;

        return {
          symbol: h.symbol,
          companyName: h.symbol,
          shares: h.quantity,
          avgPrice: h.averageBuyPrice,
          currentPrice: h.currentPrice || h.averageBuyPrice,
          marketValue: Math.round(marketVal * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPct * 10) / 10,
        };
      });

      unrealizedPnL = Math.round((portfolioMarketValue - portfolioTotalInvested) * 100) / 100;
      unrealizedPnLPercent =
        portfolioTotalInvested > 0
          ? Math.round((unrealizedPnL / portfolioTotalInvested) * 100 * 10) / 10
          : 0;
    }

    // 15. Watchlist & Quotes
    let watchlistData: MonthlyReportSnapshot['watchlistSection'] = {
      available: false,
      symbolCount: 0,
      symbols: [],
    };

    if (watchlist && watchlist.symbols && watchlist.symbols.length > 0) {
      try {
        const marketData = MarketDataService.getInstance();
        const quotesPromises = watchlist.symbols.map(async (item: any) => {
          const s = typeof item === 'string' ? item : item.symbol;
          try {
            const q = await marketData.getQuote(s);
            return {
              symbol: s,
              price: q.currentPrice,
              change: q.change,
              changePercent: q.changePercent,
            };
          } catch {
            return { symbol: s };
          }
        });

        const quotes = await Promise.all(quotesPromises);
        watchlistData = {
          available: true,
          symbolCount: quotes.length,
          symbols: quotes,
        };
      } catch {
        watchlistData = {
          available: false,
          symbolCount: watchlist.symbols.length,
          symbols: watchlist.symbols.map((item: any) => ({ symbol: typeof item === 'string' ? item : item.symbol })),
        };
      }
    }

    // 16. Stock Model Predictions
    let stockPredictions: MonthlyReportSnapshot['stockModelForecasts'] = {
      available: false,
      disclaimer:
        'Model forecasts are statistical estimates based on historical market prices and do not constitute investment advice or guarantee future performance.',
      forecasts: [],
    };

    try {
      const watchlistSymbols = (watchlist?.symbols || []).map((item: any) =>
        typeof item === 'string' ? item : item.symbol,
      );
      const userSymbols: string[] = [
        ...new Set([
          ...holdingsList.map((h) => h.symbol),
          ...watchlistSymbols,
        ]),
      ];

      if (userSymbols.length > 0) {
        const predictions = await StockPrediction.find({
          symbol: { $in: userSymbols },
        })
          .sort({ predictionTimestamp: -1 })
          .limit(5)
          .lean();

        if (predictions.length > 0) {
          stockPredictions.available = true;
          stockPredictions.forecasts = predictions.map((p: any) => {
            const ret = p.predictedReturn ?? 0;
            const predVal = p.predictedValue ?? 0;
            const curr =
              p.actualValue ||
              (ret !== -1 ? Math.round((predVal / (1 + ret)) * 100) / 100 : predVal);

            return {
              symbol: p.symbol,
              predictionHorizonDays: p.predictionHorizon || '30D',
              currentPrice: curr,
              predictedPrice: predVal,
              predictedReturnPercent: Math.round(ret * 100 * 10) / 10,
              modelName: p.model || 'XGBoost',
              modelVersion: p.modelVersion || 'v1.4',
              featureVersion: p.featureVersion || 'v1.0',
              historicalRmse: p.evaluationMetrics?.rmse || 0.05,
              predictionDate: p.predictionTimestamp
                ? new Date(p.predictionTimestamp).toISOString()
                : new Date().toISOString(),
            };
          });
        }
      }
    } catch {
      // Graceful degradation without false limitations
    }

    // 17. Expense & Cash-Flow Forecast Integration
    let forecastSection: MonthlyReportSnapshot['forecastSection'] = {
      available: false,
      disclaimer: 'Forecasts are machine learning estimates based on historical cash flow trends.',
    };

    if (forecastDoc) {
      forecastSection.available = true;
      const period =
        forecastDoc.forecast && forecastDoc.forecast.length > 0 ? forecastDoc.forecast[0] : null;
      forecastSection.expenseForecast = {
        nextMonthEstimatedExpenses:
          period?.predictedExpense ?? period?.expectedExpenses ?? currentExpense,
        confidenceScore: forecastDoc.metrics?.rmse
          ? Math.max(0.6, Math.round((1 - forecastDoc.metrics.rmse / (currentExpense || 1)) * 100) / 100)
          : 0.85,
        modelUsed: forecastDoc.modelMetadata?.name || 'SARIMAX-ENSEMBLE',
      };
      forecastSection.cashFlowForecast = {
        projectedIncome: period?.expectedIncome ?? currentIncome,
        projectedExpense: period?.expectedExpenses ?? period?.predictedExpense ?? currentExpense,
        projectedNetFlow: period?.projectedNetCashFlow ?? (currentIncome - currentExpense),
        period: `${monthNames[month % 12]} ${month === 12 ? year + 1 : year}`,
      };
    }

    // 18. Anomalies Integration
    const anomalyEvents = anomalies.map((a: any) => ({
      id: a._id.toString(),
      date: a.transactionDetails?.date
        ? new Date(a.transactionDetails.date).toISOString().split('T')[0]
        : '',
      merchant: a.transactionDetails?.merchant || 'Unknown Merchant',
      amount: a.transactionDetails?.amount || 0,
      severity: a.severity,
      score: a.anomalyScore || 0,
      reason: a.reason || 'Unusual spending deviation',
    }));

    const affectedCategories = [
      ...new Set(anomalies.map((a: any) => a.transactionDetails?.category).filter(Boolean)),
    ];

    // 19. Executive Summary & Deterministic Insights Generation
    const insights: string[] = [];
    if (topCategories.length > 0) {
      insights.push(
        `${topCategories[0].name} represented your largest expense at ${topCategories[0].percentage}% of total outflows (${currency} ${topCategories[0].amount.toFixed(2)}).`,
      );
    }
    if (prevExpense > 0) {
      const dir = expenseChangePercent >= 0 ? 'increased' : 'decreased';
      insights.push(
        `Total monthly expenses ${dir} by ${Math.abs(expenseChangePercent)}% compared with the previous month.`,
      );
    }
    if (totalSubscriptionMonthly > 0) {
      insights.push(
        `Active recurring subscriptions totaled ${currency} ${totalSubscriptionMonthly.toFixed(2)} per month across ${subscriptions.length} services.`,
      );
    }
    if (portfolioMarketValue > 0) {
      const pnlDir = unrealizedPnL >= 0 ? 'gain' : 'loss';
      insights.push(
        `Your investment portfolio closed at ${currency} ${portfolioMarketValue.toFixed(2)} with an unrealized ${pnlDir} of ${unrealizedPnLPercent}%.`,
      );
    }
    if (activeGoals.length > 0) {
      const topGoal = activeGoals[0];
      insights.push(
        `Financial goal "${topGoal.name}" reached ${topGoal.progressPercent}% completion (${currency} ${topGoal.currentAmount.toFixed(2)} of ${currency} ${topGoal.targetAmount.toFixed(2)}).`,
      );
    }

    const keyTakeaway =
      currentMonthTxCount === 0
        ? `No financial transactions were recorded for ${periodLabel}. Add transactions or link your accounts to track inflows and outflows.`
        : savings >= 0
          ? `In ${periodLabel}, you generated a positive net savings of ${currency} ${savings.toFixed(2)} with a savings rate of ${savingsRateFormatted}.`
          : `In ${periodLabel}, total expenses exceeded income by ${currency} ${Math.abs(savings).toFixed(2)}. Review discretionary categories to rebalance cash flow.`;

    // 20. Exact Deterministic Report Status
    let finalStatus: ReportStatus;
    if (currentMonthTxCount === 0) {
      finalStatus = ReportStatus.NO_DATA;
    } else if (limitations.length > 0) {
      finalStatus = ReportStatus.READY_WITH_LIMITATIONS;
    } else {
      finalStatus = ReportStatus.READY;
    }

    return {
      metadata: {
        reportType: 'MONTHLY_FINANCIAL_REPORT',
        reportVersion: '1.0',
        templateVersion: '2026.09',
        generatedAt: new Date().toISOString(),
        year,
        month,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        periodDisplay,
        periodLabel,
        timezone,
        currency,
        status: finalStatus,
        limitations,
      },
      executiveSummary: {
        totalIncome: currentIncome,
        totalExpenses: currentExpense,
        savings,
        savingsRate,
        savingsRateFormatted,
        monthlyBurnRate,
        burnRateDefinition,
        netWorth: currentNetWorth,
        portfolioValue: portfolioMarketValue,
        transactionCount: currentMonthTxCount,
        averageTransaction,
        averageDailySpending,
        keyTakeaway,
        insights,
      },
      incomeSection: {
        totalIncome: currentIncome,
        previousMonthIncome: prevIncome,
        incomeChangeAmount,
        incomeChangePercent,
        percentageChange: incomeChangePercent,
        byCategory: byCategoryIncome,
        sources: byCategoryIncome.map((c) => ({
          categoryId: c.categoryId,
          source: c.name,
          amount: c.amount,
          percentage: c.percentage,
        })),
      },
      expenseSection: {
        totalExpenses: currentExpense,
        previousMonthExpenses: prevExpense,
        expenseChangeAmount,
        expenseChangePercent,
        percentageChange: expenseChangePercent,
        fixedExpenses: totalRecurringMonthly + totalSubscriptionMonthly,
        variableExpenses: Math.max(0, currentExpense - (totalRecurringMonthly + totalSubscriptionMonthly)),
        topCategories,
        categories: topCategories,
      },
      savingsSection: {
        savings,
        previousSavings,
        savingsChange,
        savingsRate,
        savingsRateFormatted,
        savingsRateChange,
      },
      dailySpending,
      monthlyTrends,
      largestTransactions: formattedLargestTxs,
      topExpenses,
      largestExpense,
      largestIncome,
      transactionSummary: {
        transactionCount: currentMonthTxCount,
        expenseCount,
        incomeCount,
        averageTransaction,
        averageDailySpending,
        daysInMonth: lastDay,
      },
      recurringCommitments: {
        activeRecurringCount: recurringExpenses.length,
        totalRecurringMonthly: Math.round(totalRecurringMonthly * 100) / 100,
        activeSubscriptionCount: subscriptions.length,
        totalSubscriptionMonthly: Math.round(totalSubscriptionMonthly * 100) / 100,
        totalMonthlyCommitments: Math.round((totalRecurringMonthly + totalSubscriptionMonthly) * 100) / 100,
        upcomingBills,
      },
      financialGoals: {
        totalGoalsCount: goals.length,
        activeGoals,
      },
      goalsSection: activeGoals,
      netWorthSection: {
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
        currentNetWorth,
        previousNetWorth,
        netWorthChange,
        netWorthChangePercent,
        absoluteChange: netWorthChange,
        percentageChange: netWorthChangePercent,
      },
      portfolioSection: {
        available: !!portfolio,
        hasPortfolio: !!portfolio,
        totalInvested: Math.round(portfolioTotalInvested * 100) / 100,
        currentMarketValue: Math.round(portfolioMarketValue * 100) / 100,
        unrealizedPnL,
        unrealizedPnLPercent,
        realizedPnL: 0,
        holdingsCount: holdingsList.length,
        holdings: holdingsList,
      },
      watchlistSection: watchlistData,
      stockModelForecasts: stockPredictions,
      forecastSection,
      anomalySection: {
        unusualSpendingCount: anomalies.length,
        affectedCategories,
        events: anomalyEvents,
      },
      insights,
    };
  }

  /**
   * Builds a Complete Financial Report covering all application modules for an arbitrary date range
   */
  public async buildCompleteFinancialReport(
    userId: string,
    fromStr: string,
    toStr: string,
  ): Promise<CompleteFinancialReportData> {
    const userObjectId = new Types.ObjectId(userId);
    const { startDate, endDate, fromDateStr, toDateStr, periodDisplay } = parseDateRangeIST(fromStr, toStr);

    // 1. Fetch User Profile
    const user = await User.findById(userId);
    const nameParts = [user?.firstName, user?.lastName].filter((part): part is string => Boolean(part));
    const userName = nameParts.length > 0
      ? nameParts.map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
      : user?.email || 'Valued User';
    const userEmail = user?.email || '';
    const currency = user?.defaultCurrency || 'INR';
    const timezone = (user as any)?.timezone || 'Asia/Kolkata';
    const generatedAt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()) + ' IST';

    // 2. Fetch All Transactions in Date Range (Multi-page capable, zero artificial limits)
    const transactionsDocs = await Transaction.find({
      userId: userObjectId,
      isDeleted: false,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('category')
      .sort({ date: -1 });

    let totalIncome = 0;
    let totalExpenses = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let largestIncome = 0;
    let largestExpense = 0;

    const incomeCategoryMap = new Map<string, { amount: number; count: number }>();
    const expenseCategoryMap = new Map<string, { amount: number; count: number }>();
    const allCategoryMap = new Map<string, { type: string; amount: number; count: number }>();
    const dailySpendMap = new Map<string, { amount: number; count: number }>();

    const transactions = transactionsDocs.map((doc) => {
      const catObj = doc.category as any;
      const catName = catObj?.name || 'Uncategorized';
      const amt = doc.amount;
      const type = doc.type as 'INCOME' | 'EXPENSE' | 'TRANSFER';
      const dateStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(doc.date));

      if (type === 'INCOME') {
        totalIncome += amt;
        incomeCount++;
        if (amt > largestIncome) largestIncome = amt;
        const curInc = incomeCategoryMap.get(catName) || { amount: 0, count: 0 };
        incomeCategoryMap.set(catName, { amount: curInc.amount + amt, count: curInc.count + 1 });
      } else if (type === 'EXPENSE') {
        totalExpenses += amt;
        expenseCount++;
        if (amt > largestExpense) largestExpense = amt;
        const curExp = expenseCategoryMap.get(catName) || { amount: 0, count: 0 };
        expenseCategoryMap.set(catName, { amount: curExp.amount + amt, count: curExp.count + 1 });

        const curDaily = dailySpendMap.get(dateStr) || { amount: 0, count: 0 };
        dailySpendMap.set(dateStr, { amount: curDaily.amount + amt, count: curDaily.count + 1 });
      }

      const curAll = allCategoryMap.get(catName) || { type, amount: 0, count: 0 };
      allCategoryMap.set(catName, { type, amount: curAll.amount + amt, count: curAll.count + 1 });

      return {
        id: doc._id.toString(),
        date: dateStr,
        dateRaw: doc.date,
        description: doc.description || doc.merchant || 'Transaction',
        merchant: doc.merchant || '-',
        category: catName,
        type,
        amount: amt,
        paymentMethod: doc.paymentMethod || 'DEBIT_CARD',
      };
    });

    totalIncome = Math.round(totalIncome * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
    const savingsRate = totalIncome > 0 ? Math.round(((netSavings / totalIncome) * 100) * 100) / 100 : null;
    const savingsRateDisplay = savingsRate !== null ? `${savingsRate}%` : 'Not available';
    const transactionCount = transactions.length;
    const averageTransaction = transactionCount > 0 ? Math.round(((totalIncome + totalExpenses) / transactionCount) * 100) / 100 : 0;
    const averageIncome = incomeCount > 0 ? Math.round((totalIncome / incomeCount) * 100) / 100 : 0;
    const averageExpense = expenseCount > 0 ? Math.round((totalExpenses / expenseCount) * 100) / 100 : 0;

    // 3. Category Breakdowns
    const incomeByCategory = Array.from(incomeCategoryMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
        percentage: totalIncome > 0 ? Math.round((data.amount / totalIncome) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const expenseByCategory = Array.from(expenseCategoryMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
        percentage: totalExpenses > 0 ? Math.round((data.amount / totalExpenses) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const categoryBreakdown = Array.from(allCategoryMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        type: data.type,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
        percentage:
          (data.type === 'INCOME' ? totalIncome : totalExpenses) > 0
            ? Math.round((data.amount / (data.type === 'INCOME' ? totalIncome : totalExpenses)) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 4. Parallel Query for All Additional Financial Modules
    const [
      budgetDocs,
      holdingDocs,
      assetDocs,
      liabilityDocs,
      nwSnapshots,
      goalDocs,
      subDocs,
      forecastDoc,
      anomalyDocs,
    ] = await Promise.all([
      Budget.find({ userId: userObjectId, isDeleted: false }).populate('categoryId'),
      Holding.find({ userId: userObjectId, isDeleted: false }),
      Asset.find({ userId: userObjectId, isDeleted: false }),
      Liability.find({ userId: userObjectId, isDeleted: false }),
      NetWorthSnapshot.find({ userId: userObjectId, date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 }),
      FinancialGoal.find({ userId: userObjectId, isDeleted: false }),
      Subscription.find({ userId: userObjectId, isDeleted: false }),
      FinancialForecast.findOne({ userId: userObjectId }).sort({ createdAt: -1 }),
      FinancialAnomaly.find({ userId: userObjectId, detectedAt: { $gte: startDate, $lte: endDate } }).sort({ detectedAt: -1 }),
    ]);

    // Budgets Section
    const budgetRecords = budgetDocs.map((b) => {
      const catName = (b.categoryId as any)?.name || 'General';
      const limit = b.amount;
      const spent = b.spent;
      const remaining = Math.round((limit - spent) * 100) / 100;
      const utilizationPercent = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;
      const status: 'Within Budget' | 'Exceeded' = spent > limit ? 'Exceeded' : 'Within Budget';
      return {
        name: b.name,
        category: catName,
        limit,
        spent,
        remaining,
        utilizationPercent,
        status,
      };
    });

    // Portfolio Section (Current Portfolio Snapshot)
    let portInvested = 0;
    let portValue = 0;
    const holdings = holdingDocs.map((h) => {
      const invested = h.totalCost || h.quantity * h.averageBuyPrice;
      const currentVal = h.currentValue || h.quantity * h.currentPrice;
      portInvested += invested;
      portValue += currentVal;
      return {
        symbol: h.symbol,
        companyName: h.symbol,
        quantity: h.quantity,
        avgBuyPrice: h.averageBuyPrice,
        currentPrice: h.currentPrice,
        investedAmount: Math.round(invested * 100) / 100,
        marketValue: Math.round(currentVal * 100) / 100,
        pnl: Math.round((currentVal - invested) * 100) / 100,
        pnlPercent: invested > 0 ? Math.round(((currentVal - invested) / invested) * 1000) / 10 : 0,
      };
    });
    const unrealizedPnL = Math.round((portValue - portInvested) * 100) / 100;
    const unrealizedPnLPercent = portInvested > 0 ? Math.round((unrealizedPnL / portInvested) * 1000) / 10 : 0;

    // Net Worth Section
    const totalAssets = Math.round(assetDocs.reduce((acc, a) => acc + (a.currentValue || 0), 0) * 100) / 100;
    const totalLiabilities = Math.round(liabilityDocs.reduce((acc, l) => acc + (l.currentBalance || 0), 0) * 100) / 100;
    const netWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    const cash = assetDocs.filter((a) => a.type === 'CASH' || a.type === 'BANK_ACCOUNT').reduce((s, a) => s + a.currentValue, 0);
    const investments = assetDocs.filter((a) => a.type === 'INVESTMENT' || a.type === 'CRYPTO').reduce((s, a) => s + a.currentValue, 0);
    const otherAssets = totalAssets - (cash + investments);

    const loans = liabilityDocs.filter((l) => l.type === 'PERSONAL_LOAN' || l.type === 'STUDENT_LOAN' || l.type === 'MORTGAGE').reduce((s, l) => s + l.currentBalance, 0);
    const creditCardDebt = liabilityDocs.filter((l) => l.type === 'CREDIT_CARD').reduce((s, l) => s + l.currentBalance, 0);
    const otherLiabilities = totalLiabilities - (loans + creditCardDebt);

    const trendPoints = nwSnapshots.map((s) => ({
      date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(s.date)),
      netWorth: s.netWorth,
    }));

    // Financial Goals Section
    const goalRecords = goalDocs.map((g) => ({
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      remainingAmount: Math.max(0, g.targetAmount - g.currentAmount),
      progressPercent: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 1000) / 10) : 0,
      targetDate: g.targetDate
        ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(g.targetDate))
        : '-',
      status: g.status,
    }));

    // Subscriptions Section
    let totalMonthlySubCost = 0;
    const subRecords = subDocs.map((s) => {
      let monthly = s.amount;
      if (s.billingCycle === 'QUARTERLY') monthly = s.amount / 3;
      if (s.billingCycle === 'ANNUALLY') monthly = s.amount / 12;
      totalMonthlySubCost += monthly;
      return {
        name: s.name,
        amount: s.amount,
        billingCycle: s.billingCycle,
        nextBillingDate: s.renewalDate
          ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s.renewalDate))
          : '-',
        category: 'Subscription',
        status: s.status,
      };
    });

    // Forecasting Section
    const firstPeriod = forecastDoc?.forecast?.[0];
    const forecastingData = {
      available: !!forecastDoc && !!firstPeriod,
      label: 'Forecast (Machine Learning Estimates Only)',
      projectedExpenses: firstPeriod?.predictedExpense ?? firstPeriod?.expectedExpenses,
      projectedCashFlow: firstPeriod?.projectedNetCashFlow,
      confidenceScore: forecastDoc?.metrics?.r2 ?? (forecastDoc?.metrics?.mae !== undefined ? Math.max(0, 1 - (forecastDoc.metrics.mae / 10000)) : undefined),
      modelUsed: forecastDoc?.modelMetadata?.name || 'Seasonal Cash Flow Model',
      notes: 'Predictions are machine learning statistical estimates and do not guarantee future performance.',
    };

    // Anomalies Section
    const anomalyRecords = anomalyDocs.map((a) => {
      const snap = a.transactionDetails;
      return {
        date: a.createdAt
          ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(a.createdAt))
          : '-',
        merchant: snap?.merchant || 'Flagged Activity',
        amount: snap?.amount || 0,
        category: snap?.category || 'General',
        severity: String(a.severity || 'MEDIUM'),
        reason: a.reason || 'Unusual deviation from normal baseline',
      };
    });

    // Daily Spending Trend
    const dailySpendingTrend = Array.from(dailySpendMap.entries()).map(([date, d]) => ({
      date,
      amount: Math.round(d.amount * 100) / 100,
      count: d.count,
    }));

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      metadata: {
        reportId,
        appName: 'SMARTFIN AI',
        userName,
        userEmail,
        currency,
        timezone,
        fromDateStr,
        toDateStr,
        periodDisplay,
        generatedAt,
      },
      summary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        savingsRateDisplay,
        transactionCount,
        largestExpense,
        largestIncome,
        averageTransaction,
        averageExpense,
        averageIncome,
      },
      transactions,
      incomeAnalysis: {
        totalIncome,
        count: incomeCount,
        averageIncome,
        largestIncome,
        byCategory: incomeByCategory,
      },
      expenseAnalysis: {
        totalExpenses,
        count: expenseCount,
        averageExpense,
        largestExpense,
        byCategory: expenseByCategory,
      },
      categoryBreakdown,
      budgets: {
        available: budgetRecords.length > 0,
        records: budgetRecords,
      },
      portfolio: {
        available: holdings.length > 0,
        isSnapshot: true,
        snapshotLabel: 'Current Portfolio Snapshot',
        totalInvested: Math.round(portInvested * 100) / 100,
        currentValue: Math.round(portValue * 100) / 100,
        unrealizedPnL,
        unrealizedPnLPercent,
        holdings,
      },
      netWorth: {
        available: assetDocs.length > 0 || liabilityDocs.length > 0,
        isSnapshot: true,
        snapshotLabel: 'Current Net Worth Snapshot',
        totalAssets,
        totalLiabilities,
        netWorth,
        assetBreakdown: {
          cash: Math.round(cash * 100) / 100,
          bankBalance: Math.round(cash * 100) / 100,
          investments: Math.round(investments * 100) / 100,
          otherAssets: Math.round(otherAssets * 100) / 100,
        },
        liabilityBreakdown: {
          loans: Math.round(loans * 100) / 100,
          creditCardDebt: Math.round(creditCardDebt * 100) / 100,
          otherLiabilities: Math.round(otherLiabilities * 100) / 100,
        },
        trendPoints,
      },
      goals: {
        available: goalRecords.length > 0,
        records: goalRecords,
      },
      subscriptions: {
        available: subRecords.length > 0,
        totalMonthlyCost: Math.round(totalMonthlySubCost * 100) / 100,
        estimatedAnnualCost: Math.round(totalMonthlySubCost * 12 * 100) / 100,
        records: subRecords,
      },
      forecasting: forecastingData,
      anomalies: {
        available: anomalyRecords.length > 0,
        records: anomalyRecords,
      },
      dailySpendingTrend,
    };
  }
}

export const reportAggregatorService = ReportAggregatorService.getInstance();
