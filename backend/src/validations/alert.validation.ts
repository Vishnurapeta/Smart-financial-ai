import { z } from 'zod';
import { StockAlertType } from '../models/stock-alert.model.js';

export const createStockAlertSchema = z.object({
  body: z.object({
    symbol: z
      .string()
      .min(1, 'Stock symbol is required')
      .max(20, 'Symbol must not exceed 20 characters')
      .transform((val) => val.trim().toUpperCase()),
    alertType: z.nativeEnum(StockAlertType, {
      errorMap: () => ({
        message:
          'Invalid alert type. Allowed: PRICE_ABOVE, PRICE_BELOW, PERCENT_CHANGE_UP, PERCENT_CHANGE_DOWN, VOLUME_ABOVE',
      }),
    }),
    threshold: z
      .number({ required_error: 'Threshold number is required' })
      .positive('Threshold must be a positive number'),
    cooldownMinutes: z.number().min(5, 'Minimum cooldown is 5 minutes to prevent spam').optional(),
    notes: z.string().max(250).optional(),
  }),
});

export const updateStockAlertSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Alert ID is required'),
  }),
  body: z.object({
    alertType: z.nativeEnum(StockAlertType).optional(),
    threshold: z.number().positive('Threshold must be a positive number').optional(),
    isActive: z.boolean().optional(),
    cooldownMinutes: z.number().min(5, 'Minimum cooldown is 5 minutes').optional(),
    notes: z.string().max(250).optional(),
  }),
});

export const alertIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Alert ID is required'),
  }),
});
