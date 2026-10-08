import { Request, Response, NextFunction } from 'express';
import { financialReportService } from '../services/report/report.service.js';
import { logger } from '../utils/logger.js';

export class ReportController {
  /**
   * GET /api/v1/reports/monthly
   * GET /api/v1/reports/monthly/:year/:month
   * Get dynamic, real-time monthly financial report calculated directly from transactions
   */
  static async getMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const now = new Date();

      const yearParam = req.params.year || (req.query.year as string);
      const monthParam = req.params.month || (req.query.month as string);
      const refresh = req.query.refresh === 'true';

      const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
      const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

      const { report, snapshot } = await financialReportService.getMonthlyReport(
        String(userId),
        year,
        month,
        refresh,
      );

      res.status(200).json({
        success: true,
        data: {
          reportId: report._id,
          year: report.year,
          month: report.month,
          title: report.title,
          status: report.status,
          currency: report.currency,
          timezone: report.timezone,
          snapshot,
          report,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/trends
   * Continuous 12-month comparison of inflows, outflows, and net savings for the selected year
   */
  static async getMonthlyTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const yearQuery = req.query.year as string;
      const year = yearQuery ? parseInt(yearQuery, 10) : new Date().getFullYear();

      const trends = await financialReportService.getMonthlyTrends(String(userId), year);

      res.status(200).json({
        success: true,
        data: {
          year,
          trends,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/reports/monthly
   * Enqueue or return cached monthly financial report for authenticated user
   */
  static async requestMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { year, month, forceRegenerate, sendEmail } = req.body;

      const result = await financialReportService.requestMonthlyReport(
        String(userId),
        Number(year),
        Number(month),
        { forceRegenerate, sendEmail },
      );

      res.status(result.isCached ? 200 : 202).json({
        success: true,
        message: result.isCached
          ? 'Retrieved existing monthly report'
          : 'Monthly financial report generation initiated',
        data: {
          reportId: result.report._id,
          status: result.report.status,
          year: result.report.year,
          month: result.report.month,
          title: result.report.title,
          isCached: result.isCached,
          report: result.report,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports
   * List reports for authenticated user with pagination and filters
   */
  static async getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { year, month, status, reportType, page, limit } = req.query as any;

      const result = await financialReportService.getUserReports(String(userId), {
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        status: status ? String(status) : undefined,
        reportType: reportType ? String(reportType) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.reports,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/:id
   * Get single report by ID (with strict user isolation)
   */
  static async getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;

      const report = await financialReportService.getReportById(String(userId), id);

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/:id/pdf
   * Securely stream PDF report file for authenticated user
   */
  static async downloadReportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;

      const { stream, filename, sizeBytes } = await financialReportService.getReportPdfStream(
        String(userId),
        id,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', sizeBytes);

      stream.on('error', (err) => {
        logger.error({ err, reportId: id, userId }, 'Error streaming PDF report');
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to stream PDF report' });
        }
      });

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/monthly/:year/:month/pdf
   * Securely stream PDF report file for specific year & month
   */
  static async downloadMonthlyPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { year, month } = req.params;

      const { stream, filename, sizeBytes } = await financialReportService.getReportPdfStreamByMonth(
        String(userId),
        parseInt(year, 10),
        parseInt(month, 10),
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', sizeBytes);

      stream.on('error', (err) => {
        logger.error({ err, year, month, userId }, 'Error streaming monthly PDF report');
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to stream monthly PDF report' });
        }
      });

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/reports/:id/email
   * Send report via email to authenticated user's verified address
   */
  static async sendReportEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;

      await financialReportService.sendReportEmail(String(userId), id);

      res.status(200).json({
        success: true,
        message: 'Report email delivery queued successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/reports/monthly/:year/:month/email
   * Send specific monthly report via email to authenticated user
   */
  static async sendMonthlyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { year, month } = req.params;

      await financialReportService.sendReportEmailByMonth(
        String(userId),
        parseInt(year, 10),
        parseInt(month, 10),
      );

      res.status(200).json({
        success: true,
        message: 'Monthly report email delivery queued successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/reports/:id
   * Soft-delete a report snapshot
   */
  static async deleteReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const { id } = req.params;

      await financialReportService.deleteReport(String(userId), id);

      res.status(200).json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/financial
   * Get complete financial report covering all modules for arbitrary date range
   */
  static async getFinancialReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const from = (req.query.from as string) || (req.query.startDate as string);
      const to = (req.query.to as string) || (req.query.endDate as string);

      if (!from || !to) {
        res.status(400).json({
          success: false,
          message: 'Both "from" and "to" date parameters (YYYY-MM-DD) are required.',
        });
        return;
      }

      const reportData = await financialReportService.getCompleteFinancialReport(
        String(userId),
        from,
        to,
      );

      res.status(200).json({
        success: true,
        data: reportData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/reports/financial/pdf
   * Generate and download complete financial report PDF for arbitrary date range
   */
  static async downloadFinancialReportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id || (req.user as any)?._id;
      const from = (req.query.from as string) || (req.query.startDate as string);
      const to = (req.query.to as string) || (req.query.endDate as string);

      if (!from || !to) {
        res.status(400).json({
          success: false,
          message: 'Both "from" and "to" date parameters (YYYY-MM-DD) are required.',
        });
        return;
      }

      const { buffer, filename, fileSizeBytes } = await financialReportService.getCompleteFinancialReportPdf(
        String(userId),
        from,
        to,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileSizeBytes);

      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
