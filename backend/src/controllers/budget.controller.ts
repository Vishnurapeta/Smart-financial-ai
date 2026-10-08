import { Request, Response, NextFunction } from 'express';
import { BudgetService } from '../services/budget.service.js';
import { BudgetPeriod } from '../models/budget.model.js';

export class BudgetController {
  static async createBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const budget = await BudgetService.createBudget(req.user!.userId, req.body);
      res.status(201).json({
        success: true,
        data: { budget },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBudgets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { month, categoryId, period } = req.query as {
        month?: string;
        categoryId?: string;
        period?: BudgetPeriod;
      };
      const budgets = await BudgetService.getBudgets(req.user!.userId, {
        month,
        categoryId,
        period,
      });
      res.status(200).json({
        success: true,
        data: { budgets },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBudgetSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { month } = req.query as { month?: string };
      const summary = await BudgetService.getBudgetSummary(req.user!.userId, month);
      res.status(200).json({
        success: true,
        data: { summary },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBudgetHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;
      const history = await BudgetService.getBudgetHistory(req.user!.userId, months);
      res.status(200).json({
        success: true,
        data: { history },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlyComparison(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { month1, month2 } = req.query as { month1?: string; month2?: string };
      const comparison = await BudgetService.getMonthlyComparison(req.user!.userId, month1, month2);
      res.status(200).json({
        success: true,
        data: { comparison },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const budget = await BudgetService.getBudgetById(req.user!.userId, req.params.id);
      res.status(200).json({
        success: true,
        data: { budget },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const budget = await BudgetService.updateBudget(req.user!.userId, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: { budget },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await BudgetService.deleteBudget(req.user!.userId, req.params.id);
      res.status(200).json({
        success: true,
        message: 'Budget successfully deleted',
      });
    } catch (error) {
      next(error);
    }
  }
}
