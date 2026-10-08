export type ReportStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'READY'
  | 'READY_WITH_LIMITATIONS'
  | 'NO_DATA'
  | 'FAILED';

export type ReportType =
  | 'MONTHLY_FINANCIAL_REPORT'
  | 'WEEKLY_SUMMARY'
  | 'QUARTERLY_REPORT'
  | 'ANNUAL_FINANCIAL_REPORT'
  | 'INVESTMENT_REPORT'
  | 'CUSTOM_RANGE';

export type EmailDeliveryStatus = 'NOT_REQUESTED' | 'QUEUED' | 'SENT' | 'FAILED';

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
    periodDisplay?: string;
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
    savingsRate: number | null;
    savingsRateFormatted: string;
    monthlyBurnRate: number;
    burnRateDefinition: string;
    netWorth: number;
    portfolioValue: number;
    transactionCount?: number;
    averageTransaction?: number;
    averageDailySpending?: number;
    keyTakeaway: string;
    insights?: string[];
  };
  incomeSection: {
    totalIncome: number;
    previousMonthIncome: number;
    percentageChange: number;
    incomeChangeAmount: number;
    incomeChangePercent: number;
    sources?: Array<{ categoryId?: string; source: string; amount: number; percentage: number }>;
    byCategory?: Array<{
      categoryId: string;
      name: string;
      color?: string;
      icon?: string;
      amount: number;
      percentage: number;
      count?: number;
    }>;
  };
  expenseSection: {
    totalExpenses: number;
    previousMonthExpenses: number;
    percentageChange: number;
    expenseChangeAmount: number;
    expenseChangePercent: number;
    fixedExpenses: number;
    variableExpenses: number;
    categories: Array<{
      categoryId?: string;
      category: string;
      amount: number;
      percentage: number;
      monthOverMonthChange?: number;
      color?: string;
      icon?: string;
    }>;
    topCategories?: Array<{
      categoryId: string;
      category?: string;
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
  dailySpending?: Array<{
    day: number;
    date: string;
    amount: number;
    count: number;
  }>;
  monthlyTrends?: Array<{
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
    description?: string;
    merchant?: string;
    category: string;
    amount: number;
    type: string;
  }>;
  topExpenses?: Array<{
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
  largestExpense?: {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    merchant?: string;
  } | null;
  largestIncome?: {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    merchant?: string;
  } | null;
  transactionSummary?: {
    transactionCount: number;
    expenseCount: number;
    incomeCount: number;
    averageTransaction: number;
    averageDailySpending: number;
    daysInMonth: number;
  };
  recurringCommitments: {
    activeRecurringCount: number;
    activeSubscriptionCount: number;
    totalMonthlyRecurring: number;
    totalMonthlySubscriptions: number;
    totalRecurringMonthly?: number;
    totalSubscriptionMonthly?: number;
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
  goalsSection: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    remainingAmount: number;
    targetDate?: string;
  }>;
  financialGoals?: {
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
  netWorthSection: {
    currentNetWorth: number;
    previousNetWorth: number;
    netWorthChange?: number;
    netWorthChangePercent?: number;
    absoluteChange: number;
    percentageChange: number;
    totalAssets: number;
    totalLiabilities: number;
  };
  portfolioSection: {
    available?: boolean;
    hasPortfolio?: boolean;
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
      score: number;
      severity: string;
    }>;
  };
  insights?: string[];
}

export interface FinancialReport {
  _id: string;
  userId: string;
  reportType: ReportType;
  title: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  currency: string;
  status: ReportStatus;
  dataSnapshot?: MonthlyReportSnapshot;
  fileReference?: string;
  pdfSize?: number;
  limitations?: string[];
  reportVersion: string;
  templateVersion: string;
  emailDeliveryStatus: EmailDeliveryStatus;
  emailSentAt?: string;
  generatedAt?: string;
  generationDurationMs?: number;
  pdfGenerationDurationMs?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetReportsResponse {
  success: boolean;
  data: FinancialReport[];
  pagination: ReportPagination;
}

export interface SingleReportResponse {
  success: boolean;
  data: FinancialReport;
}

export interface RequestMonthlyReportRequest {
  year: number;
  month: number;
  forceRegenerate?: boolean;
  sendEmail?: boolean;
}

export interface RequestMonthlyReportResponse {
  success: boolean;
  message: string;
  data: {
    reportId: string;
    status: ReportStatus;
    year: number;
    month: number;
    title: string;
    isCached: boolean;
    report: FinancialReport;
  };
}

export interface GetMonthlyReportResponse {
  success: boolean;
  data: {
    reportId: string;
    year: number;
    month: number;
    title: string;
    status: ReportStatus;
    currency: string;
    timezone: string;
    snapshot: MonthlyReportSnapshot;
    report: FinancialReport;
  };
}

export interface GetMonthlyTrendsResponse {
  success: boolean;
  data: {
    year: number;
    trends: Array<{
      month: number;
      monthName: string;
      year: number;
      income: number;
      expenses: number;
      savings: number;
      savingsRate: number | null;
    }>;
  };
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
    dateRaw: string | Date;
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

export interface GetCompleteFinancialReportResponse {
  success: boolean;
  data: CompleteFinancialReportData;
}

