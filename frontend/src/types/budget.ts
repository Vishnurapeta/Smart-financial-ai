import { Category } from './transaction.ts';

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM';

export type BudgetStatus = 'ON_TRACK' | 'WARNING' | 'OVERSPENT';

export interface Budget {
  _id: string;
  userId: string;
  categoryId: string;
  category: Category | null;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isOverspent: boolean;
  overspentAmount: number;
  status: BudgetStatus;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  currency: string;
  notifyAt80: boolean;
  notifyAt100: boolean;
  alertSent80: boolean;
  alertSent100: boolean;
  rolloverRemaining: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBudgetSummary {
  month: string;
  label: string;
  totalBudgeted: number;
  totalSpentInBudgeted: number;
  totalUnbudgetedSpent: number;
  totalMonthlyExpense: number;
  totalRemaining: number;
  overallPercentageUsed: number;
  isOverallOverspent: boolean;
  totalBudgetsCount: number;
  overspentCount: number;
  warningCount: number;
  onTrackCount: number;
}

export interface BudgetHistoryPoint {
  monthKey: string;
  label: string;
  budgeted: number;
  spent: number;
  variance: number;
  percentageUsed: number;
  budgetsCount: number;
  overspentCount: number;
}

export interface MonthlyComparisonCategoryItem {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  month1Budget: number;
  month1Spent: number;
  month1Usage: number;
  month2Budget: number;
  month2Spent: number;
  month2Usage: number;
  spendDifference: number;
  spendChangePercent: number;
}

export interface MonthlyComparisonResult {
  month1: {
    monthKey: string;
    label: string;
    budgeted: number;
    spent: number;
    remaining: number;
    usagePercent: number;
  };
  month2: {
    monthKey: string;
    label: string;
    budgeted: number;
    spent: number;
    remaining: number;
    usagePercent: number;
  };
  budgetChange: number;
  budgetChangePercent: number;
  spendChange: number;
  spendChangePercent: number;
  categories: MonthlyComparisonCategoryItem[];
}

export interface CreateBudgetDTO {
  categoryId: string;
  name?: string;
  amount: number;
  month?: string;
  currency?: string;
  period?: BudgetPeriod;
  notifyAt80?: boolean;
  notifyAt100?: boolean;
  rolloverRemaining?: boolean;
}

export interface UpdateBudgetDTO {
  name?: string;
  amount?: number;
  currency?: string;
  notifyAt80?: boolean;
  notifyAt100?: boolean;
  rolloverRemaining?: boolean;
}
