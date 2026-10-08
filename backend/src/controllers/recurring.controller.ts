import { Request, Response, NextFunction } from 'express';
import { RecurringService } from '../services/recurring.service.js';
import { RecurringFrequency, RecurringType } from '../models/recurring-expense.model.js';
import { SubscriptionBillingCycle, SubscriptionStatus } from '../models/subscription.model.js';

export class RecurringController {
  /**
   * Run historical transaction pattern detection and sync
   */
  static async detect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await RecurringService.detectAndSyncRecurring(userId);
      res.status(200).json({
        success: true,
        message: `Successfully analyzed transactions: ${result.totalDetected} recurring patterns identified.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List recurring expenses with filtering & pagination
   */
  static async getRecurringExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { isActive, frequency, recurringType, search, page, limit } = req.query;

      const result = await RecurringService.getRecurringExpenses(userId, {
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        frequency: frequency as RecurringFrequency,
        recurringType: recurringType as RecurringType,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single recurring expense
   */
  static async getRecurringExpenseById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const item = await RecurringService.getRecurringExpenseById(userId, id);
      res.status(200).json({
        success: true,
        data: { item },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create recurring expense manually
   */
  static async createRecurringExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const item = await RecurringService.createRecurringExpense(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Recurring expense created successfully',
        data: { item },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update recurring expense
   */
  static async updateRecurringExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const item = await RecurringService.updateRecurringExpense(userId, id, req.body);
      res.status(200).json({
        success: true,
        message: 'Recurring expense updated successfully',
        data: { item },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete recurring expense
   */
  static async deleteRecurringExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await RecurringService.deleteRecurringExpense(userId, id);
      res.status(200).json({
        success: true,
        message: 'Recurring expense deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List subscriptions
   */
  static async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { status, billingCycle, isPossiblyInactive, search, page, limit } = req.query;

      const result = await RecurringService.getSubscriptions(userId, {
        status: status as SubscriptionStatus,
        billingCycle: billingCycle as SubscriptionBillingCycle,
        isPossiblyInactive:
          isPossiblyInactive !== undefined ? isPossiblyInactive === 'true' : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get subscription intelligence dashboard metrics
   */
  static async getSubscriptionDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const dashboard = await RecurringService.getSubscriptionDashboard(userId);
      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create subscription manually
   */
  static async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const item = await RecurringService.createSubscription(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: { item },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update subscription
   */
  static async updateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const item = await RecurringService.updateSubscription(userId, id, req.body);
      res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: { item },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete subscription
   */
  static async deleteSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await RecurringService.deleteSubscription(userId, id);
      res.status(200).json({
        success: true,
        message: 'Subscription deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get subscription payment history with authentic matching transactions
   */
  static async getSubscriptionHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const result = await RecurringService.getSubscriptionHistory(userId, id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get upcoming bill reminders
   */
  static async getUpcomingBills(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 14;
      const bills = await RecurringService.getUpcomingBills(userId, days);
      res.status(200).json({
        success: true,
        data: { bills },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger bill reminder notifications
   */
  static async triggerBillReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await RecurringService.triggerBillReminders(userId);
      res.status(200).json({
        success: true,
        message: `Triggered ${result.triggeredReminders} new bill reminder notification(s)`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
