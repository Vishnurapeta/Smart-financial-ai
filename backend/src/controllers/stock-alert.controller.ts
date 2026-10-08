import { Request, Response, NextFunction } from 'express';
import { StockAlertService } from '../services/stock-alert.service.js';
import { triggerAlertEvaluationJob } from '../queues/stock-alert.queue.js';

export class StockAlertController {
  private alertService: StockAlertService;

  constructor() {
    this.alertService = StockAlertService.getInstance();
  }

  getAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const alerts = await this.alertService.getUserAlerts(userId);
      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (err) {
      next(err);
    }
  };

  getAlertById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const alert = await this.alertService.getAlertById(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: alert,
      });
    } catch (err) {
      next(err);
    }
  };

  createAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const alert = await this.alertService.createAlert(userId, req.body);
      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (err) {
      next(err);
    }
  };

  updateAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const alert = await this.alertService.updateAlert(userId, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: alert,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.alertService.deleteAlert(userId, req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Stock alert removed successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  evaluateAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await triggerAlertEvaluationJob(`api-request-user-${req.user!.userId}`);
      res.status(200).json({
        success: true,
        data: {
          message: 'Stock alerts evaluated successfully',
          ...result,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
