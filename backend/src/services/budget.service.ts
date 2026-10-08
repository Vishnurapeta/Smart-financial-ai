import { Types } from 'mongoose';
import { Budget, IBudget, BudgetPeriod } from '../models/budget.model.js';
import { Transaction, TransactionType } from '../models/transaction.model.js';
import { Category } from '../models/category.model.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { eventBus } from './event-bus.service.js';

export interface BudgetWithMetrics {
  _id: string;
  userId: string;
  categoryId: string;
  category: {
    _id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
    type: string;
  } | null;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isOverspent: boolean;
  overspentAmount: number;
  status: 'ON_TRACK' | 'WARNING' | 'OVERSPENT';
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  currency: string;
  notifyAt80: boolean;
  notifyAt100: boolean;
  alertSent80: boolean;
  alertSent100: boolean;
  rolloverRemaining: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlyBudgetSummary {
  month: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
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
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
  budgeted: number;
  spent: number;
  variance: number; // positive = saved, negative = overspent
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

export interface CreateBudgetInput {
  categoryId: string;
  name?: string;
  amount: number;
  period?: BudgetPeriod;
  month?: string; // YYYY-MM
  startDate?: Date;
  endDate?: Date;
  currency?: string;
  notifyAt80?: boolean;
  notifyAt100?: boolean;
  rolloverRemaining?: boolean;
}

export interface UpdateBudgetInput {
  name?: string;
  amount?: number;
  currency?: string;
  notifyAt80?: boolean;
  notifyAt100?: boolean;
  rolloverRemaining?: boolean;
}

const MONTH_NAMES = [
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

export interface PopulatedCategoryInfo {
  _id?: Types.ObjectId | string;
  name?: string;
  slug?: string;
  icon?: string;
  color?: string;
  type?: string;
}

export class BudgetService {
  /**
   * Helper to parse month string (YYYY-MM) or date into strict start & end dates
   */
  static getMonthBounds(monthStr?: string): {
    startDate: Date;
    endDate: Date;
    monthKey: string;
    label: string;
  } {
    let year: number;
    let monthIdx: number;

    if (monthStr && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
      const parts = monthStr.split('-');
      year = parseInt(parts[0], 10);
      monthIdx = parseInt(parts[1], 10) - 1;
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthIdx = now.getMonth();
    }

    const startDate = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[monthIdx]} ${year}`;

    return { startDate, endDate, monthKey, label };
  }

  /**
   * Helper to calculate metrics for a budget document given actual spent amount
   */
  static computeBudgetMetrics(
    budget: IBudget,
    spent: number,
    categoryDoc?: PopulatedCategoryInfo | null,
  ): BudgetWithMetrics {
    const roundedSpent = Math.round(spent * 100) / 100;
    const remaining = Math.max(0, Math.round((budget.amount - roundedSpent) * 100) / 100);
    const percentageUsed =
      budget.amount > 0 ? Math.round((roundedSpent / budget.amount) * 100 * 100) / 100 : 0;
    const isOverspent = roundedSpent > budget.amount;
    const overspentAmount = isOverspent
      ? Math.round((roundedSpent - budget.amount) * 100) / 100
      : 0;

    let status: 'ON_TRACK' | 'WARNING' | 'OVERSPENT' = 'ON_TRACK';
    if (isOverspent) {
      status = 'OVERSPENT';
    } else if (percentageUsed >= 80) {
      status = 'WARNING';
    }

    const categoryDetails = categoryDoc
      ? {
          _id: (categoryDoc._id as Types.ObjectId).toString(),
          name: categoryDoc.name as string,
          slug: categoryDoc.slug as string,
          icon: (categoryDoc.icon as string) || 'tag',
          color: (categoryDoc.color as string) || '#10B981',
          type: (categoryDoc.type as string) || 'EXPENSE',
        }
      : null;

    return {
      _id: budget._id.toString(),
      userId: budget.userId.toString(),
      categoryId: budget.categoryId.toString(),
      category: categoryDetails,
      name: budget.name,
      amount: Math.round(budget.amount * 100) / 100,
      spent: roundedSpent,
      remaining,
      percentageUsed,
      isOverspent,
      overspentAmount,
      status,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      currency: budget.currency,
      notifyAt80: budget.notifyAt80,
      notifyAt100: budget.notifyAt100,
      alertSent80: budget.alertSent80,
      alertSent100: budget.alertSent100,
      rolloverRemaining: budget.rolloverRemaining,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  /**
   * Evaluate thresholds and trigger notifications if thresholds breached
   */
  static async evaluateAlerts(
    budget: IBudget,
    spent: number,
    percentageUsed: number,
  ): Promise<void> {
    let modified = false;

    // 100% Exceeded Alert
    if (percentageUsed >= 100 && budget.notifyAt100 && !budget.alertSent100) {
      const overspent = Math.round((spent - budget.amount) * 100) / 100;
      eventBus.emitEvent('budget.exceeded', {
        userId: budget.userId.toString(),
        budgetId: budget._id.toString(),
        categoryId: budget.categoryId?.toString(),
        categoryName: budget.name,
        spent,
        limit: budget.amount,
        overspentAmount: overspent,
        period: budget.period,
      });
      budget.alertSent100 = true;
      budget.alertSent80 = true; // also mark 80% as covered
      modified = true;
    } else if (percentageUsed >= 80 && budget.notifyAt80 && !budget.alertSent80) {
      // 80% Warning Alert
      eventBus.emitEvent('budget.threshold', {
        userId: budget.userId.toString(),
        budgetId: budget._id.toString(),
        categoryId: budget.categoryId?.toString(),
        categoryName: budget.name,
        spent,
        limit: budget.amount,
        percentage: percentageUsed,
        period: budget.period,
      });
      budget.alertSent80 = true;
      modified = true;
    }

    if (modified) {
      await budget.save();
    }
  }

  /**
   * Create a new category budget for a monthly period
   */
  static async createBudget(userId: string, input: CreateBudgetInput): Promise<BudgetWithMetrics> {
    const userObjectId = new Types.ObjectId(userId);
    const categoryObjectId = new Types.ObjectId(input.categoryId);

    // Validate category exists
    const categoryDoc = await Category.findOne({
      _id: categoryObjectId,
      isDeleted: false,
    });
    if (!categoryDoc) {
      throw new NotFoundError('Referenced category was not found');
    }

    // Determine period boundaries
    const bounds = BudgetService.getMonthBounds(input.month);
    const startDate = input.startDate || bounds.startDate;
    const endDate = input.endDate || bounds.endDate;
    const period = input.period || BudgetPeriod.MONTHLY;

    // Check for existing active budget in this exact period for this category
    const existing = await Budget.findOne({
      userId: userObjectId,
      categoryId: categoryObjectId,
      startDate: { $gte: startDate },
      endDate: { $lte: endDate },
      isDeleted: false,
    });

    if (existing) {
      throw new ConflictError(
        `A budget for "${categoryDoc.name}" already exists for this period (${bounds.monthKey}). Please edit the existing budget instead.`,
      );
    }

    const budgetName = input.name?.trim() || `${categoryDoc.name} Budget`;

    // Query real database transactions to get initial spent
    const spentAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          category: categoryObjectId,
          type: TransactionType.EXPENSE,
          date: { $gte: startDate, $lte: endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);
    const initialSpent = spentAgg[0]?.totalSpent || 0;

    const budget = await Budget.create({
      userId: userObjectId,
      categoryId: categoryObjectId,
      name: budgetName,
      amount: input.amount,
      spent: initialSpent,
      period,
      startDate,
      endDate,
      currency: input.currency || 'USD',
      notifyAt80: input.notifyAt80 !== undefined ? input.notifyAt80 : true,
      notifyAt100: input.notifyAt100 !== undefined ? input.notifyAt100 : true,
      rolloverRemaining: input.rolloverRemaining || false,
      isDeleted: false,
    });

    const metrics = BudgetService.computeBudgetMetrics(budget, initialSpent, categoryDoc);
    await BudgetService.evaluateAlerts(budget, initialSpent, metrics.percentageUsed);

    return metrics;
  }

  /**
   * Get all budgets for a given month with real-time calculated transaction spending
   */
  static async getBudgets(
    userId: string,
    query: { month?: string; categoryId?: string; period?: BudgetPeriod },
  ): Promise<BudgetWithMetrics[]> {
    const userObjectId = new Types.ObjectId(userId);
    const bounds = BudgetService.getMonthBounds(query.month);

    const filter: Record<string, unknown> = {
      userId: userObjectId,
      isDeleted: false,
      startDate: { $lte: bounds.endDate },
      endDate: { $gte: bounds.startDate },
    };

    if (query.categoryId && Types.ObjectId.isValid(query.categoryId)) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.period) {
      filter.period = query.period;
    }

    const budgets = await Budget.find(filter)
      .populate('categoryId', 'name slug icon color type')
      .sort({ createdAt: -1 });

    if (budgets.length === 0) {
      return [];
    }

    // Parallel aggregate all expenses in this period grouped by category
    const categoryIds = budgets.map((b) => b.categoryId._id || b.categoryId);
    const spendingByCatAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          category: { $in: categoryIds },
          type: TransactionType.EXPENSE,
          date: { $gte: bounds.startDate, $lte: bounds.endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    const spendMap = new Map<string, number>();
    spendingByCatAgg.forEach((item) => {
      spendMap.set(item._id.toString(), item.totalSpent);
    });

    // Compute metrics and evaluate alert triggers for each budget
    const results: BudgetWithMetrics[] = [];
    for (const b of budgets) {
      const catObj = b.categoryId as unknown as PopulatedCategoryInfo;
      const catId = catObj?._id
        ? catObj._id.toString()
        : (b.categoryId as Types.ObjectId).toString();
      const actualSpent = spendMap.get(catId) || 0;

      // Sync document spent field if changed
      if (Math.abs(b.spent - actualSpent) > 0.001) {
        b.spent = actualSpent;
        await b.save();
      }

      const metrics = BudgetService.computeBudgetMetrics(b, actualSpent, catObj);
      await BudgetService.evaluateAlerts(b, actualSpent, metrics.percentageUsed);
      results.push(metrics);
    }

    return results;
  }

  /**
   * Get single budget with real-time calculated spending
   */
  static async getBudgetById(userId: string, budgetId: string): Promise<BudgetWithMetrics> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(budgetId);

    const budget = await Budget.findOne({
      _id: budgetObjectId,
      userId: userObjectId,
      isDeleted: false,
    }).populate('categoryId', 'name slug icon color type');

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    // Real database aggregate
    const spendingAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          category: budget.categoryId._id || budget.categoryId,
          type: TransactionType.EXPENSE,
          date: { $gte: budget.startDate, $lte: budget.endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    const actualSpent = spendingAgg[0]?.totalSpent || 0;
    if (Math.abs(budget.spent - actualSpent) > 0.001) {
      budget.spent = actualSpent;
      await budget.save();
    }

    const metrics = BudgetService.computeBudgetMetrics(
      budget,
      actualSpent,
      budget.categoryId as unknown as Record<string, unknown>,
    );
    await BudgetService.evaluateAlerts(budget, actualSpent, metrics.percentageUsed);

    return metrics;
  }

  /**
   * Update budget limit, name, currency, or notification preferences
   */
  static async updateBudget(
    userId: string,
    budgetId: string,
    input: UpdateBudgetInput,
  ): Promise<BudgetWithMetrics> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(budgetId);

    const budget = await Budget.findOne({
      _id: budgetObjectId,
      userId: userObjectId,
      isDeleted: false,
    }).populate('categoryId', 'name slug icon color type');

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    if (input.name !== undefined) budget.name = input.name.trim();
    if (input.amount !== undefined) {
      if (input.amount <= 0) throw new BadRequestError('Amount must be positive');
      budget.amount = input.amount;
      // Reset alerts if new amount increases limit beyond current usage
      if (budget.spent / budget.amount < 1.0) budget.alertSent100 = false;
      if (budget.spent / budget.amount < 0.8) budget.alertSent80 = false;
    }
    if (input.currency !== undefined) budget.currency = input.currency.toUpperCase();
    if (input.notifyAt80 !== undefined) budget.notifyAt80 = input.notifyAt80;
    if (input.notifyAt100 !== undefined) budget.notifyAt100 = input.notifyAt100;
    if (input.rolloverRemaining !== undefined) budget.rolloverRemaining = input.rolloverRemaining;

    await budget.save();

    // Re-query real transaction spent
    const spendingAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          category: budget.categoryId._id || budget.categoryId,
          type: TransactionType.EXPENSE,
          date: { $gte: budget.startDate, $lte: budget.endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    const actualSpent = spendingAgg[0]?.totalSpent || 0;
    const metrics = BudgetService.computeBudgetMetrics(
      budget,
      actualSpent,
      budget.categoryId as unknown as Record<string, unknown>,
    );
    await BudgetService.evaluateAlerts(budget, actualSpent, metrics.percentageUsed);

    return metrics;
  }

  /**
   * Soft-delete budget
   */
  static async deleteBudget(userId: string, budgetId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(budgetId);

    const budget = await Budget.findOne({
      _id: budgetObjectId,
      userId: userObjectId,
      isDeleted: false,
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    budget.isDeleted = true;
    budget.deletedAt = new Date();
    await budget.save();
  }

  /**
   * Consolidated monthly summary: total budgeted, total spent, unbudgeted spend, progress
   */
  static async getBudgetSummary(userId: string, monthStr?: string): Promise<MonthlyBudgetSummary> {
    const userObjectId = new Types.ObjectId(userId);
    const bounds = BudgetService.getMonthBounds(monthStr);

    // 1. Fetch active budgets for month
    const budgets = await Budget.find({
      userId: userObjectId,
      isDeleted: false,
      startDate: { $lte: bounds.endDate },
      endDate: { $gte: bounds.startDate },
    });

    const totalBudgeted = budgets.reduce((acc, b) => acc + b.amount, 0);

    // 2. Fetch all expenses in the month
    const allExpensesAgg = await Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: TransactionType.EXPENSE,
          date: { $gte: bounds.startDate, $lte: bounds.endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const spendMap = new Map<string, number>();
    let totalMonthlyExpense = 0;
    allExpensesAgg.forEach((item) => {
      const catKey = item._id ? item._id.toString() : 'uncategorized';
      spendMap.set(catKey, item.totalAmount);
      totalMonthlyExpense += item.totalAmount;
    });

    // 3. Compute budgeted vs unbudgeted
    let totalSpentInBudgeted = 0;
    let overspentCount = 0;
    let warningCount = 0;
    let onTrackCount = 0;

    budgets.forEach((b) => {
      const catId = b.categoryId.toString();
      const actualSpent = spendMap.get(catId) || 0;
      totalSpentInBudgeted += actualSpent;

      if (actualSpent > b.amount) {
        overspentCount++;
      } else if (b.amount > 0 && actualSpent / b.amount >= 0.8) {
        warningCount++;
      } else {
        onTrackCount++;
      }
    });

    const totalUnbudgetedSpent = Math.max(0, totalMonthlyExpense - totalSpentInBudgeted);
    const totalRemaining = Math.max(0, totalBudgeted - totalSpentInBudgeted);
    const overallPercentageUsed =
      totalBudgeted > 0 ? Math.round((totalSpentInBudgeted / totalBudgeted) * 100 * 100) / 100 : 0;

    return {
      month: bounds.monthKey,
      label: bounds.label,
      totalBudgeted: Math.round(totalBudgeted * 100) / 100,
      totalSpentInBudgeted: Math.round(totalSpentInBudgeted * 100) / 100,
      totalUnbudgetedSpent: Math.round(totalUnbudgetedSpent * 100) / 100,
      totalMonthlyExpense: Math.round(totalMonthlyExpense * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      overallPercentageUsed,
      isOverallOverspent: totalSpentInBudgeted > totalBudgeted,
      totalBudgetsCount: budgets.length,
      overspentCount,
      warningCount,
      onTrackCount,
    };
  }

  /**
   * Budget history across past N months
   */
  static async getBudgetHistory(userId: string, months = 6): Promise<BudgetHistoryPoint[]> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const history: BudgetHistoryPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[monthIdx]} ${year}`;
      const startDate = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));

      const budgets = await Budget.find({
        userId: userObjectId,
        isDeleted: false,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      });

      const budgeted = budgets.reduce((acc, b) => acc + b.amount, 0);
      const categoryIds = budgets.map((b) => b.categoryId);

      let spent = 0;
      let overspentCount = 0;

      if (categoryIds.length > 0) {
        const spendingAgg = await Transaction.aggregate([
          {
            $match: {
              userId: userObjectId,
              category: { $in: categoryIds },
              type: TransactionType.EXPENSE,
              date: { $gte: startDate, $lte: endDate },
              isDeleted: false,
            },
          },
          {
            $group: {
              _id: '$category',
              totalSpent: { $sum: '$amount' },
            },
          },
        ]);

        const spendMap = new Map<string, number>();
        spendingAgg.forEach((item) => spendMap.set(item._id.toString(), item.totalSpent));

        budgets.forEach((b) => {
          const catSpent = spendMap.get(b.categoryId.toString()) || 0;
          spent += catSpent;
          if (catSpent > b.amount) overspentCount++;
        });
      }

      const variance = Math.round((budgeted - spent) * 100) / 100;
      const percentageUsed = budgeted > 0 ? Math.round((spent / budgeted) * 100 * 100) / 100 : 0;

      history.push({
        monthKey,
        label,
        budgeted: Math.round(budgeted * 100) / 100,
        spent: Math.round(spent * 100) / 100,
        variance,
        percentageUsed,
        budgetsCount: budgets.length,
        overspentCount,
      });
    }

    return history;
  }

  /**
   * Monthly comparison between two months (defaults to current vs previous month)
   */
  static async getMonthlyComparison(
    userId: string,
    month1Str?: string,
    month2Str?: string,
  ): Promise<MonthlyComparisonResult> {
    const m1Bounds = BudgetService.getMonthBounds(month1Str);

    let m2Bounds;
    if (month2Str) {
      m2Bounds = BudgetService.getMonthBounds(month2Str);
    } else {
      // Previous month of month1
      const parts = m1Bounds.monthKey.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-based
      const prevDate = new Date(Date.UTC(y, m - 1, 1));
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      m2Bounds = BudgetService.getMonthBounds(prevKey);
    }

    const [summary1, summary2, budgets1, budgets2] = await Promise.all([
      BudgetService.getBudgetSummary(userId, m1Bounds.monthKey),
      BudgetService.getBudgetSummary(userId, m2Bounds.monthKey),
      BudgetService.getBudgets(userId, { month: m1Bounds.monthKey }),
      BudgetService.getBudgets(userId, { month: m2Bounds.monthKey }),
    ]);

    // Categories map
    const catMap = new Map<
      string,
      {
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
      }
    >();

    budgets1.forEach((b) => {
      catMap.set(b.categoryId, {
        categoryId: b.categoryId,
        categoryName: b.category?.name || b.name,
        icon: b.category?.icon || 'tag',
        color: b.category?.color || '#10B981',
        month1Budget: b.amount,
        month1Spent: b.spent,
        month1Usage: b.percentageUsed,
        month2Budget: 0,
        month2Spent: 0,
        month2Usage: 0,
      });
    });

    budgets2.forEach((b) => {
      const existing = catMap.get(b.categoryId);
      if (existing) {
        existing.month2Budget = b.amount;
        existing.month2Spent = b.spent;
        existing.month2Usage = b.percentageUsed;
      } else {
        catMap.set(b.categoryId, {
          categoryId: b.categoryId,
          categoryName: b.category?.name || b.name,
          icon: b.category?.icon || 'tag',
          color: b.category?.color || '#10B981',
          month1Budget: 0,
          month1Spent: 0,
          month1Usage: 0,
          month2Budget: b.amount,
          month2Spent: b.spent,
          month2Usage: b.percentageUsed,
        });
      }
    });

    const categories: MonthlyComparisonCategoryItem[] = Array.from(catMap.values()).map((c) => {
      const spendDiff = Math.round((c.month1Spent - c.month2Spent) * 100) / 100;
      const spendChangePercent =
        c.month2Spent > 0
          ? Math.round(((c.month1Spent - c.month2Spent) / c.month2Spent) * 100 * 10) / 10
          : c.month1Spent > 0
            ? 100
            : 0;

      return {
        ...c,
        spendDifference: spendDiff,
        spendChangePercent,
      };
    });

    const budgetChange = Math.round((summary1.totalBudgeted - summary2.totalBudgeted) * 100) / 100;
    const budgetChangePercent =
      summary2.totalBudgeted > 0
        ? Math.round(
            ((summary1.totalBudgeted - summary2.totalBudgeted) / summary2.totalBudgeted) * 100 * 10,
          ) / 10
        : summary1.totalBudgeted > 0
          ? 100
          : 0;

    const spendChange =
      Math.round((summary1.totalSpentInBudgeted - summary2.totalSpentInBudgeted) * 100) / 100;
    const spendChangePercent =
      summary2.totalSpentInBudgeted > 0
        ? Math.round(
            ((summary1.totalSpentInBudgeted - summary2.totalSpentInBudgeted) /
              summary2.totalSpentInBudgeted) *
              100 *
              10,
          ) / 10
        : summary1.totalSpentInBudgeted > 0
          ? 100
          : 0;

    return {
      month1: {
        monthKey: m1Bounds.monthKey,
        label: m1Bounds.label,
        budgeted: summary1.totalBudgeted,
        spent: summary1.totalSpentInBudgeted,
        remaining: summary1.totalRemaining,
        usagePercent: summary1.overallPercentageUsed,
      },
      month2: {
        monthKey: m2Bounds.monthKey,
        label: m2Bounds.label,
        budgeted: summary2.totalBudgeted,
        spent: summary2.totalSpentInBudgeted,
        remaining: summary2.totalRemaining,
        usagePercent: summary2.overallPercentageUsed,
      },
      budgetChange,
      budgetChangePercent,
      spendChange,
      spendChangePercent,
      categories,
    };
  }
}
