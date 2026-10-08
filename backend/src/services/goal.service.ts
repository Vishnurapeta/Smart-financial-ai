import { Types } from 'mongoose';
import {
  FinancialGoal,
  GoalCategory,
  GoalStatus,
  IFinancialGoal,
} from '../models/financial-goal.model.js';
import { NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/security.util.js';
import {
  Notification,
  NotificationPriority,
  NotificationType,
} from '../models/notification.model.js';

export interface GoalComputedMetrics {
  progressPercentage: number;
  remainingAmount: number;
  monthsRemaining: number;
  requiredMonthlyContribution: number;
  isOverdue: boolean;
  isAchieved: boolean;
}

export class GoalService {
  /**
   * Helper to calculate dynamic financial goal progress metrics
   */
  static computeGoalMetrics(goal: IFinancialGoal): GoalComputedMetrics {
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const target = goal.targetAmount;
    const current = goal.currentAmount;

    const remainingAmount = Math.max(0, Math.round((target - current) * 100) / 100);
    const progressPercentage =
      target > 0 ? Math.min(100, Math.round((current / target) * 10000) / 100) : 0;
    const isAchieved = current >= target || goal.status === GoalStatus.ACHIEVED;

    const diffMs = targetDate.getTime() - now.getTime();
    const monthsRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
    const isOverdue = diffMs < 0 && !isAchieved;

    let requiredMonthlyContribution = 0;
    if (!isAchieved && remainingAmount > 0) {
      if (monthsRemaining <= 1) {
        requiredMonthlyContribution = remainingAmount;
      } else {
        requiredMonthlyContribution = Math.round((remainingAmount / monthsRemaining) * 100) / 100;
      }
    }

    return {
      progressPercentage,
      remainingAmount,
      monthsRemaining,
      requiredMonthlyContribution,
      isOverdue,
      isAchieved,
    };
  }

  /**
   * Create new financial goal
   */
  static async createGoal(userId: string, data: Partial<IFinancialGoal>) {
    const userObjectId = new Types.ObjectId(userId);
    const currentAmount = data.currentAmount || 0;
    const targetAmount = data.targetAmount || 1;

    const status =
      currentAmount >= targetAmount ? GoalStatus.ACHIEVED : data.status || GoalStatus.IN_PROGRESS;

    const goal = await FinancialGoal.create({
      ...data,
      userId: userObjectId,
      currentAmount,
      status,
      isDeleted: false,
    });

    const metrics = this.computeGoalMetrics(goal);
    return { ...goal.toObject(), id: goal._id.toString(), ...metrics };
  }

  /**
   * List goals with dynamic metrics
   */
  static async getGoals(
    userId: string,
    filters: {
      category?: GoalCategory;
      status?: GoalStatus;
      search?: string;
    } = {},
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const query: Record<string, unknown> = {
      userId: userObjectId,
      isDeleted: false,
    };

    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.search && filters.search.trim()) {
      const safeSearch = escapeRegex(filters.search.trim());
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const goals = await FinancialGoal.find(query).sort({ targetDate: 1 });

    const items = goals.map((goal) => {
      const metrics = this.computeGoalMetrics(goal);
      return {
        ...goal.toObject(),
        ...metrics,
      };
    });

    return items;
  }

  /**
   * Get single goal
   */
  static async getGoalById(userId: string, id: string) {
    const goal = await FinancialGoal.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!goal) {
      throw new NotFoundError('Financial goal not found');
    }

    const metrics = this.computeGoalMetrics(goal);
    return { ...goal.toObject(), id: goal._id.toString(), ...metrics };
  }

  /**
   * Update goal
   */
  static async updateGoal(userId: string, id: string, data: Partial<IFinancialGoal>) {
    const goal = await FinancialGoal.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!goal) {
      throw new NotFoundError('Financial goal not found');
    }

    Object.assign(goal, data);

    // Auto-update status if achieved
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = GoalStatus.ACHIEVED;
    } else if (goal.status === GoalStatus.ACHIEVED && goal.currentAmount < goal.targetAmount) {
      goal.status = GoalStatus.IN_PROGRESS;
    }

    await goal.save();
    const metrics = this.computeGoalMetrics(goal);
    return { ...goal.toObject(), id: goal._id.toString(), ...metrics };
  }

  /**
   * Contribute funds to a goal
   */
  static async contributeToGoal(userId: string, id: string, amount: number, notes?: string) {
    const goal = await FinancialGoal.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!goal) {
      throw new NotFoundError('Financial goal not found');
    }

    goal.currentAmount = Math.round((goal.currentAmount + amount) * 100) / 100;

    const wasAchieved = goal.status === GoalStatus.ACHIEVED;
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = GoalStatus.ACHIEVED;
      if (!wasAchieved) {
        // Create milestone notification
        await Notification.create({
          userId: goal.userId,
          type: NotificationType.GOAL_MILESTONE,
          priority: NotificationPriority.HIGH,
          title: `Goal Achieved: ${goal.title}!`,
          message: `Congratulations! You reached your target of ${goal.currency} ${goal.targetAmount.toLocaleString()} for ${goal.title}.`,
          actionUrl: '/goals',
          metadata: { goalId: goal._id, targetAmount: goal.targetAmount },
        });
      }
    }

    await goal.save();
    const metrics = this.computeGoalMetrics(goal);
    return { ...goal.toObject(), id: goal._id.toString(), ...metrics, contributionNote: notes };
  }

  /**
   * Delete goal
   */
  static async deleteGoal(userId: string, id: string) {
    const goal = await FinancialGoal.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!goal) {
      throw new NotFoundError('Financial goal not found');
    }

    goal.isDeleted = true;
    goal.deletedAt = new Date();
    await goal.save();
  }

  /**
   * Aggregated goals summary and progress dashboard metrics
   */
  static async getGoalsSummary(userId: string) {
    const goals = await this.getGoals(userId);

    let totalTarget = 0;
    let totalCurrent = 0;
    let totalRequiredMonthly = 0;
    let achievedCount = 0;
    let inProgressCount = 0;
    let overdueCount = 0;

    const categoryBreakdown: Record<string, { count: number; target: number; current: number }> =
      {};

    for (const g of goals) {
      totalTarget += g.targetAmount;
      totalCurrent += g.currentAmount;
      totalRequiredMonthly += g.requiredMonthlyContribution;

      if (g.isAchieved) achievedCount++;
      else inProgressCount++;

      if (g.isOverdue) overdueCount++;

      const cat = g.category;
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, target: 0, current: 0 };
      }
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].target += g.targetAmount;
      categoryBreakdown[cat].current += g.currentAmount;
    }

    const overallProgress =
      totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 10000) / 100) : 0;

    return {
      totalGoals: goals.length,
      activeGoals: inProgressCount,
      achievedGoals: achievedCount,
      overdueGoals: overdueCount,
      totalTargetAmount: Math.round(totalTarget * 100) / 100,
      totalCurrentAmount: Math.round(totalCurrent * 100) / 100,
      totalRemainingAmount: Math.max(0, Math.round((totalTarget - totalCurrent) * 100) / 100),
      totalRequiredMonthlyContribution: Math.round(totalRequiredMonthly * 100) / 100,
      overallProgressPercentage: overallProgress,
      categoryBreakdown,
      goals,
      // Compatibility aliases for frontend consumers
      totalTarget: Math.round(totalTarget * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      totalRemaining: Math.max(0, Math.round((totalTarget - totalCurrent) * 100) / 100),
      totalRequiredMonthly: Math.round(totalRequiredMonthly * 100) / 100,
      overallProgress,
      achievedCount,
      inProgressCount,
      overdueCount,
    };
  }
}
