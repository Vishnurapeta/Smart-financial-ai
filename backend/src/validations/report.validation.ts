import { z } from 'zod';
import { ReportStatus, ReportType } from '../models/financial-report.model.js';

export const requestMonthlyReportSchema = z.object({
  body: z.object({
    year: z.coerce.number().int().min(2000, 'Year must be 2000 or later').max(2100, 'Year cannot exceed 2100'),
    month: z.coerce.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    forceRegenerate: z.boolean().optional().default(false),
    sendEmail: z.boolean().optional().default(false),
  }),
});

export const getReportsQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    status: z.nativeEnum(ReportStatus).optional(),
    reportType: z.nativeEnum(ReportType).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const reportIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid report ID format'),
  }),
});
