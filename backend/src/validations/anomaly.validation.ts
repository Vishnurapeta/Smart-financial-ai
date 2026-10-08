import { z } from 'zod';
import {
  AnomalyFeedbackType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
} from '../models/financial-anomaly.model.js';

export const detectAnomaliesSchema = z.object({
  body: z
    .object({
      lookbackDays: z.coerce.number().int().min(7).max(365).optional().default(90),
      minHistoryCount: z.coerce.number().int().min(3).max(50).optional().default(5),
    })
    .optional()
    .default({}),
});

export const getAnomaliesSchema = z.object({
  query: z.object({
    status: z.nativeEnum(AnomalyStatus).optional(),
    anomalyType: z.nativeEnum(AnomalyType).optional(),
    severity: z.nativeEnum(AnomalySeverity).optional(),
    category: z.string().trim().optional(),
    merchant: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const getAnomalyByIdSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Anomaly ID is required'),
  }),
});

export const updateAnomalyStatusSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Anomaly ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(AnomalyStatus),
  }),
});

export const recordAnomalyFeedbackSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, 'Anomaly ID is required'),
  }),
  body: z.object({
    feedback: z.nativeEnum(AnomalyFeedbackType),
    notes: z.string().trim().max(500).optional(),
  }),
});
