import { z } from 'zod';
import { ForecastFrequency, ForecastType } from '../models/financial-forecast.model.js';

export const getExpenseForecastSchema = z.object({
  query: z.object({
    horizon: z.coerce.number().int().min(1).max(12).optional().default(3),
    frequency: z.nativeEnum(ForecastFrequency).optional().default(ForecastFrequency.MONTHLY),
    category: z.string().trim().optional(),
    preferredModel: z.string().trim().optional(),
  }),
});

export const getCashFlowForecastSchema = z.object({
  query: z.object({
    horizon: z.coerce.number().int().min(1).max(12).optional().default(3),
    frequency: z.nativeEnum(ForecastFrequency).optional().default(ForecastFrequency.MONTHLY),
  }),
});

export const getForecastHistorySchema = z.object({
  query: z.object({
    type: z.nativeEnum(ForecastType).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});
