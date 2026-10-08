import { Request, Response, NextFunction } from 'express';
import { GoalService } from '../services/goal.service.js';
import { GoalCategory, GoalStatus } from '../models/financial-goal.model.js';

export class GoalController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const goal = await GoalService.createGoal(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Financial goal created successfully',
        data: { goal },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { category, status, search } = req.query;

      const goals = await GoalService.getGoals(userId, {
        category: category as GoalCategory,
        status: status as GoalStatus,
        search: search as string,
      });

      res.status(200).json({
        success: true,
        data: { goals },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const summary = await GoalService.getGoalsSummary(userId);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const goal = await GoalService.getGoalById(userId, id);
      res.status(200).json({
        success: true,
        data: { goal },
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const goal = await GoalService.updateGoal(userId, id, req.body);
      res.status(200).json({
        success: true,
        message: 'Financial goal updated successfully',
        data: { goal },
      });
    } catch (err) {
      next(err);
    }
  }

  static async contribute(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { amount, notes } = req.body;
      const goal = await GoalService.contributeToGoal(userId, id, amount, notes);
      res.status(200).json({
        success: true,
        message: `Successfully contributed ${amount} to goal "${goal.title}"`,
        data: { goal },
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await GoalService.deleteGoal(userId, id);
      res.status(200).json({
        success: true,
        message: 'Financial goal deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
