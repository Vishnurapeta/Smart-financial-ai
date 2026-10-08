import { z } from 'zod';
import { Types } from 'mongoose';
import { BudgetPeriod } from '../models/budget.model.js';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId reference',
});

const monthFormatRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const createBudgetSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    name: z.string().trim().min(1, 'Budget name cannot be empty').max(100).optional(),
    amount: z.coerce.number().positive('Budget amount must be greater than zero'),
    period: z.nativeEnum(BudgetPeriod).optional().default(BudgetPeriod.MONTHLY),
    month: z
      .string()
      .regex(monthFormatRegex, 'Month must be in YYYY-MM format (e.g. 2026-09)')
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter code')
      .toUpperCase()
      .optional()
      .default('USD'),
    notifyAt80: z.boolean().optional().default(true),
    notifyAt100: z.boolean().optional().default(true),
    rolloverRemaining: z.boolean().optional().default(false),
  }),
});

export const updateBudgetSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    amount: z.coerce.number().positive('Budget amount must be greater than zero').optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    notifyAt80: z.boolean().optional(),
    notifyAt100: z.boolean().optional(),
    rolloverRemaining: z.boolean().optional(),
  }),
});

export const getBudgetByIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getBudgetsQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(monthFormatRegex, 'Month must be YYYY-MM').optional(),
    categoryId: objectIdSchema.optional(),
    period: z.nativeEnum(BudgetPeriod).optional(),
  }),
});

export const getBudgetSummaryQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(monthFormatRegex, 'Month must be YYYY-MM').optional(),
  }),
});

export const getBudgetHistoryQuerySchema = z.object({
  query: z.object({
    months: z.coerce.number().int().min(1).max(24).optional().default(6),
  }),
});

export const getBudgetComparisonQuerySchema = z.object({
  query: z.object({
    month1: z.string().regex(monthFormatRegex, 'Month1 must be YYYY-MM').optional(),
    month2: z.string().regex(monthFormatRegex, 'Month2 must be YYYY-MM').optional(),
  }),
});
