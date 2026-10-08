import { Types } from 'mongoose';
import { Transaction, ITransaction, TransactionType } from '../models/transaction.model.js';
import { cacheService } from '../config/redis.js';

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
  largestTransactions: ITransaction[];
  recentTransactions: ITransaction[];
}

export class AnalyticsService {
  /**
   * Calculate full real-time financial intelligence metrics from database
   */
  static async getDashboardAnalytics(userId: string): Promise<DashboardAnalyticsResponse> {
    const cacheKey = `user:${userId}:analytics:dashboard`;
    const cached = await cacheService.get<DashboardAnalyticsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // Time boundary definitions
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const baseFilter = {
      userId: userObjectId,
      isDeleted: false,
    };

    // Parallel Database Aggregation Queries
    const [
      totalsAgg,
      currentMonthAgg,
      prevMonthAgg,
      ytdAgg,
      categorySpendingAgg,
      monthlyFlowAgg,
      dailySpendingAgg,
      topMerchantsAgg,
      largestTransactions,
      recentTransactions,
    ] = await Promise.all([
      // 1. All-time Income vs Expense Totals
      Transaction.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalIncome: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.INCOME] }, '$amount', 0],
              },
            },
            totalExpenses: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.EXPENSE] }, '$amount', 0],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 2. Current Month Totals
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: startOfCurrentMonth, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            income: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.INCOME] }, '$amount', 0],
              },
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.EXPENSE] }, '$amount', 0],
              },
            },
          },
        },
      ]),

      // 3. Previous Month Totals
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
          },
        },
        {
          $group: {
            _id: null,
            income: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.INCOME] }, '$amount', 0],
              },
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.EXPENSE] }, '$amount', 0],
              },
            },
          },
        },
      ]),

      // 4. Year to Date (YTD) Spending
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
            date: { $gte: startOfYear, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            ytdSpending: { $sum: '$amount' },
          },
        },
      ]),

      // 5. Category Breakdown (Expenses)
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
          },
        },
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDetails',
          },
        },
        { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
        { $sort: { totalAmount: -1 } },
      ]),

      // 6. Monthly Cash Flow (Income vs Expense - Last 6 Months)
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            date: { $gte: sixMonthsAgo, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            income: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.INCOME] }, '$amount', 0],
              },
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ['$type', TransactionType.EXPENSE] }, '$amount', 0],
              },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // 7. Daily Spending Trend (Last 30 Days)
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
            date: { $gte: thirtyDaysAgo, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' },
            },
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 8. Top Merchants by Spending
      Transaction.aggregate([
        {
          $match: {
            ...baseFilter,
            type: TransactionType.EXPENSE,
          },
        },
        {
          $group: {
            _id: '$merchant',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
      ]),

      // 9. Largest Transactions
      Transaction.find(baseFilter)
        .sort({ amount: -1 })
        .limit(5)
        .populate('category', 'name slug icon color type'),

      // 10. Recent Transactions
      Transaction.find(baseFilter)
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .populate('category', 'name slug icon color type'),
    ]);

    // 1. Process Core Totals
    const totalIncome = Math.round((totalsAgg[0]?.totalIncome || 0) * 100) / 100;
    const totalExpenses = Math.round((totalsAgg[0]?.totalExpenses || 0) * 100) / 100;
    const totalBalance = Math.round((totalIncome - totalExpenses) * 100) / 100;
    const savings = totalBalance;
    const savingsRate =
      totalIncome > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 10) / 10,
            ),
          )
        : 0;

    // 2. Month-over-Month Metrics
    const currIncome = Math.round((currentMonthAgg[0]?.income || 0) * 100) / 100;
    const currExpense = Math.round((currentMonthAgg[0]?.expense || 0) * 100) / 100;
    const currSavings = Math.round((currIncome - currExpense) * 100) / 100;

    const prevIncome = Math.round((prevMonthAgg[0]?.income || 0) * 100) / 100;
    const prevExpense = Math.round((prevMonthAgg[0]?.expense || 0) * 100) / 100;
    const prevSavings = Math.round((prevIncome - prevExpense) * 100) / 100;

    const incomeChangePercent =
      prevIncome > 0
        ? Math.round(((currIncome - prevIncome) / prevIncome) * 100 * 10) / 10
        : currIncome > 0
          ? 100
          : 0;

    const expenseChangePercent =
      prevExpense > 0
        ? Math.round(((currExpense - prevExpense) / prevExpense) * 100 * 10) / 10
        : currExpense > 0
          ? 100
          : 0;

    const savingsChangePercent =
      prevSavings !== 0
        ? Math.round(((currSavings - prevSavings) / Math.abs(prevSavings)) * 100 * 10) / 10
        : currSavings > 0
          ? 100
          : 0;

    // 3. Burn Rate Calculation
    // Monthly burn rate represents regular operational cash outflow (current month expense or average monthly expense)
    const monthlyBurnRate = currExpense > 0 ? currExpense : totalExpenses > 0 ? totalExpenses : 0;

    // 4. Year to Date Spending
    const yearToDateSpending = Math.round((ytdAgg[0]?.ytdSpending || 0) * 100) / 100;

    // 5. Category Breakdown with percentages
    const categorySpending: CategorySpendingItem[] = categorySpendingAgg.map((item) => {
      const amount = Math.round(item.totalAmount * 100) / 100;
      const percentage =
        totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100 * 10) / 10 : 0;

      return {
        categoryId: item._id ? item._id.toString() : 'uncategorized',
        name: item.categoryDetails?.name || 'Uncategorized',
        slug: item.categoryDetails?.slug || 'uncategorized',
        color: item.categoryDetails?.color || '#10B981',
        icon: item.categoryDetails?.icon || 'tag',
        amount,
        percentage,
        transactionCount: item.transactionCount,
      };
    });

    // 6. Monthly Cash Flow Points (Last 6 Months, continuous)
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const flowMap = new Map<string, { income: number; expense: number }>();
    monthlyFlowAgg.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      flowMap.set(key, {
        income: Math.round(item.income * 100) / 100,
        expense: Math.round(item.expense * 100) / 100,
      });
    });

    const incomeVsExpense: MonthlyFlowPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = flowMap.get(key) || { income: 0, expense: 0 };
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

      incomeVsExpense.push({
        monthKey: key,
        label,
        income: entry.income,
        expense: entry.expense,
        savings: Math.round((entry.income - entry.expense) * 100) / 100,
      });
    }

    // 7. Daily Spending Points (Last 30 Days)
    const dailySpending: DailySpendingPoint[] = dailySpendingAgg.map((item) => ({
      date: item._id,
      amount: Math.round(item.amount * 100) / 100,
      count: item.count,
    }));

    // 8. Top Merchants
    const topMerchants: TopMerchantItem[] = topMerchantsAgg.map((item) => {
      const amount = Math.round(item.totalAmount * 100) / 100;
      const percentage =
        totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100 * 10) / 10 : 0;
      return {
        merchant: item._id || 'Unknown Merchant',
        amount,
        count: item.count,
        percentage,
      };
    });

    const response: DashboardAnalyticsResponse = {
      kpis: {
        totalBalance,
        totalIncome,
        totalExpenses,
        savings,
        savingsRate,
        monthlyBurnRate,
        yearToDateSpending,
        monthOverMonth: {
          currentMonth: { income: currIncome, expense: currExpense, savings: currSavings },
          previousMonth: { income: prevIncome, expense: prevExpense, savings: prevSavings },
          incomeChangePercent,
          expenseChangePercent,
          savingsChangePercent,
        },
      },
      categorySpending,
      incomeVsExpense,
      dailySpending,
      topMerchants,
      largestTransactions,
      recentTransactions,
    };

    // Cache user dashboard analytics for 60 seconds (invalidated on transaction mutations)
    await cacheService.set(cacheKey, response, 60);

    return response;
  }
}
