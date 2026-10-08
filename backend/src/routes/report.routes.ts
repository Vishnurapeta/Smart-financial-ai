import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reportRateLimiter } from '../middleware/rate-limiter.middleware.js';
import {
  requestMonthlyReportSchema,
  getReportsQuerySchema,
  reportIdParamSchema,
} from '../validations/report.validation.js';

const router = Router();

// Strict authentication on all report endpoints
router.use(authenticate);

// Complete Financial Report Generator endpoints (arbitrary date range from & to)
router.get('/financial', ReportController.getFinancialReport);
router.get('/financial/pdf', reportRateLimiter, ReportController.downloadFinancialReportPdf);

// 1. Real-time monthly financial report calculation (query: year, month, refresh)
router.get('/monthly', ReportController.getMonthlyReport);
router.get('/monthly/:year/:month', ReportController.getMonthlyReport);

// 2. Annual 12-month comparison trends (query: year)
router.get('/trends', ReportController.getMonthlyTrends);

// 3. Download vector PDF for specific month/year
router.get('/monthly/:year/:month/pdf', reportRateLimiter, ReportController.downloadMonthlyPdf);

// 4. Send report email for specific month/year
router.post('/monthly/:year/:month/email', reportRateLimiter, ReportController.sendMonthlyEmail);

// 5. Request or trigger generation of Monthly Financial Report snapshot
router.post(
  '/monthly',
  reportRateLimiter,
  validate(requestMonthlyReportSchema),
  ReportController.requestMonthlyReport,
);

// 6. List user reports with pagination & filters
router.get('/', validate(getReportsQuerySchema), ReportController.getReports);

// 7. Get single report details (metadata & immutable snapshot)
router.get('/:id', validate(reportIdParamSchema), ReportController.getReportById);

// 8. Download PDF version of the report by ID
router.get(
  '/:id/pdf',
  reportRateLimiter,
  validate(reportIdParamSchema),
  ReportController.downloadReportPdf,
);

// 9. Send report via email by ID to authenticated user's verified address
router.post(
  '/:id/email',
  reportRateLimiter,
  validate(reportIdParamSchema),
  ReportController.sendReportEmail,
);

// 10. Delete report snapshot (soft-delete snapshot only)
router.delete('/:id', validate(reportIdParamSchema), ReportController.deleteReport);

export const reportRoutes = router;
