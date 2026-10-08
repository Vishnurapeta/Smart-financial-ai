import { z } from 'zod';
import { RecurringFrequency, RecurringType } from '../models/recurring-expense.model.js';
import { SubscriptionBillingCycle, SubscriptionStatus } from '../models/subscription.model.js';

export const createRecurringExpenseSchema = z.object({
  body: z.object({
    merchant: z.string().min(1, 'Merchant name is required').max(100),
    description: z.string().max(300).optional().default(''),
    expectedAmount: z.number().positive('Expected amount must be greater than 0'),
    currency: z.string().length(3).optional().default('USD'),
    frequency: z.nativeEnum(RecurringFrequency).default(RecurringFrequency.MONTHLY),
    recurringType: z.nativeEnum(RecurringType).default(RecurringType.EXPENSE),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID')
      .optional(),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }),
    nextDueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid next due date format',
    }),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateRecurringExpenseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recurring expense ID'),
  }),
  body: z.object({
    merchant: z.string().min(1).max(100).optional(),
    description: z.string().max(300).optional(),
    expectedAmount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    frequency: z.nativeEnum(RecurringFrequency).optional(),
    recurringType: z.nativeEnum(RecurringType).optional(),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .nullable(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date format' })
      .optional(),
    nextDueDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid next due date format' })
      .optional(),
    isActive: z.boolean().optional(),
    isPossiblyInactive: z.boolean().optional(),
  }),
});

export const createSubscriptionSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Subscription name is required').max(100),
    merchant: z.string().min(1, 'Merchant is required').max(100),
    planTier: z.string().max(50).optional(),
    billingCycle: z.nativeEnum(SubscriptionBillingCycle).default(SubscriptionBillingCycle.MONTHLY),
    amount: z.number().positive('Subscription amount must be greater than 0'),
    currency: z.string().length(3).optional().default('USD'),
    status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.ACTIVE),
    renewalDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid renewal date format',
    }),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID')
      .optional(),
    cancellationUrl: z.string().url().optional().or(z.literal('')),
  }),
});

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid subscription ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    merchant: z.string().min(1).max(100).optional(),
    planTier: z.string().max(50).optional(),
    billingCycle: z.nativeEnum(SubscriptionBillingCycle).optional(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    renewalDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid renewal date format' })
      .optional(),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .nullable(),
    cancellationUrl: z.string().url().optional().or(z.literal('')),
    isPossiblyInactive: z.boolean().optional(),
  }),
});

export const recurringQuerySchema = z.object({
  query: z.object({
    isActive: z.enum(['true', 'false']).optional(),
    frequency: z.nativeEnum(RecurringFrequency).optional(),
    recurringType: z.nativeEnum(RecurringType).optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

export const subscriptionQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(SubscriptionStatus).optional(),
    billingCycle: z.nativeEnum(SubscriptionBillingCycle).optional(),
    isPossiblyInactive: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});
