import { Transaction } from './transaction.ts';

export interface CategorySpendingItem {
  categoryId: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface MonthlyFlowPoint {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
  income: number;
  expense: number;
  savings: number;
}

export interface DailySpendingPoint {
  date: string; // YYYY-MM-DD
  amount: number;
  count: number;
}

export interface TopMerchantItem {
  merchant: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthOverMonthMetrics {
  currentMonth: {
    income: number;
    expense: number;
    savings: number;
  };
  previousMonth: {
    income: number;
    expense: number;
    savings: number;
  };
  incomeChangePercent: number;
  expenseChangePercent: number;
  savingsChangePercent: number;
}

export interface DashboardKPIMetrics {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsRate: number; // Percentage 0 - 100
  monthlyBurnRate: number;
  yearToDateSpending: number;
  monthOverMonth: MonthOverMonthMetrics;
}

export interface DashboardAnalyticsResponse {
  kpis: DashboardKPIMetrics;
  categorySpending: CategorySpendingItem[];
  incomeVsExpense: MonthlyFlowPoint[];
  dailySpending: DailySpendingPoint[];
  topMerchants: TopMerchantItem[];
  largestTransactions: Transaction[];
  recentTransactions: Transaction[];
}
