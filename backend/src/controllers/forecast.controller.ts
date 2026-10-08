import { Request, Response, NextFunction } from 'express';
import { ForecastingService } from '../services/forecasting.service.js';

export class ForecastController {
  /**
   * GET /api/v1/forecasts/expenses
   * Generates out-of-sample forward expense forecast for the authenticated user.
   */
  static async getExpenseForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { horizon, frequency, category, preferredModel } = req.query as any;

      const result = await ForecastingService.getExpenseForecast(String(userId), {
        horizon: horizon ? parseInt(horizon, 10) : 3,
        frequency: frequency || 'monthly',
        category: category || undefined,
        preferredModel: preferredModel || undefined,
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
   * GET /api/v1/forecasts/cash-flow
   * Generates cash-flow & liquidity forecast for the authenticated user.
   */
  static async getCashFlowForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { horizon, frequency } = req.query as any;

      const result = await ForecastingService.getCashFlowForecast(String(userId), {
        horizon: horizon ? parseInt(horizon, 10) : 3,
        frequency: frequency || 'monthly',
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
   * GET /api/v1/forecasts/history
   * Retrieves audit trail of past generated forecasts for the authenticated user.
   */
  static async getForecastHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { type, limit } = req.query as any;

      const history = await ForecastingService.getForecastHistory(String(userId), {
        forecastType: type || undefined,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: {
          history,
          total: history.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
