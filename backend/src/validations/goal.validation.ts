import { z } from 'zod';
import { GoalCategory, GoalStatus } from '../models/financial-goal.model.js';

export const createGoalSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(120).optional(),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(500).optional().default(''),
      targetAmount: z.number().positive('Target amount must be greater than 0'),
      currentAmount: z.number().min(0, 'Current amount cannot be negative').optional().default(0),
      currency: z.string().length(3).optional().default('USD'),
      targetDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid target date format',
      }),
      category: z.nativeEnum(GoalCategory).default(GoalCategory.OTHER),
      status: z.nativeEnum(GoalStatus).default(GoalStatus.IN_PROGRESS),
      autoContributeMonthly: z.number().min(0).optional().default(0),
      linkedAssetId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid linked asset ID')
        .optional(),
    })
    .transform((data) => ({
      ...data,
      title: data.title || data.name || '',
    }))
    .refine((data) => data.title.length > 0, {
      message: 'Goal title or name is required',
      path: ['title'],
    }),
});

export const updateGoalSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid goal ID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(120).optional(),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(500).optional(),
      targetAmount: z.number().positive().optional(),
      currentAmount: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      targetDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid target date format' })
        .optional(),
      category: z.nativeEnum(GoalCategory).optional(),
      status: z.nativeEnum(GoalStatus).optional(),
      autoContributeMonthly: z.number().min(0).optional(),
      linkedAssetId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .optional()
        .nullable(),
    })
    .transform((data) => ({
      ...data,
      title: data.title || data.name || undefined,
    })),
});

export const contributeGoalSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid goal ID'),
  }),
  body: z.object({
    amount: z.number().positive('Contribution amount must be greater than 0'),
    notes: z.string().max(200).optional(),
  }),
});

export const queryGoalsSchema = z.object({
  query: z.object({
    category: z.nativeEnum(GoalCategory).optional(),
    status: z.nativeEnum(GoalStatus).optional(),
    search: z.string().optional(),
  }),
});
