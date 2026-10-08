import { Request, Response, NextFunction } from 'express';
import { MLService } from '../services/ml.service.js';

export class MLController {
  /**
   * POST /api/v1/ml/categorize
   */
  static async categorize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, dateContext } = req.body;
      const result = await MLService.categorize(req.user!.userId, text, dateContext);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/feedback
   */
  static async recordFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await MLService.recordFeedback(req.user!.userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Feedback recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
