import { Request, Response, NextFunction } from 'express';
import { AnomalyService } from '../services/anomaly.service.js';

export class AnomalyController {
  /**
   * POST /api/v1/anomalies/detect
   * Runs anomaly detection for the authenticated user and persists newly flagged anomalies.
   */
  static async detectAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { lookbackDays, minHistoryCount } = req.body || {};

      const result = await AnomalyService.runDetection(String(userId), {
        lookbackDays: lookbackDays ? Number(lookbackDays) : 90,
        minHistoryCount: minHistoryCount ? Number(minHistoryCount) : 5,
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
   * GET /api/v1/anomalies
   * Retrieves list of anomalies for the authenticated user with filters and pagination.
   */
  static async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const {
        status,
        anomalyType,
        severity,
        category,
        merchant,
        startDate,
        endDate,
        page,
        limit,
      } = req.query as any;

      const result = await AnomalyService.getAnomalies(String(userId), {
        status,
        anomalyType,
        severity,
        category,
        merchant,
        startDate,
        endDate,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.anomalies,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/anomalies/summary
   * Returns aggregated anomaly statistics (counts by status and severity).
   */
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const summary = await AnomalyService.getSummary(String(userId));

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/anomalies/:id
   * Retrieves a single anomaly by ID, enforcing user isolation.
   */
  static async getAnomalyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;

      const anomaly = await AnomalyService.getAnomalyById(String(userId), id);

      res.status(200).json({
        success: true,
        data: anomaly,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/anomalies/:id/status
   * Updates an anomaly's status (e.g. REVIEWED, DISMISSED).
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;
      const { status } = req.body;

      const anomaly = await AnomalyService.updateStatus(String(userId), id, status);

      res.status(200).json({
        success: true,
        message: `Anomaly status updated to ${status}`,
        data: anomaly,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/anomalies/:id/feedback
   * Submits user feedback (EXPECTED, UNUSUAL, DISMISSED) for the anomaly.
   */
  static async recordFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;
      const { feedback, notes } = req.body;

      const anomaly = await AnomalyService.recordFeedback(String(userId), id, {
        feedbackType: feedback,
        notes,
      });

      res.status(200).json({
        success: true,
        message: 'Feedback recorded successfully.',
        data: anomaly,
      });
    } catch (err) {
      next(err);
    }
  }
}
