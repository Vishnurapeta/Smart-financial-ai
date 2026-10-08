import { z } from 'zod';
import { Types } from 'mongoose';
import { TransactionType, PaymentMethod, TransactionSource } from '../models/transaction.model.js';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId reference',
});

export const createTransactionSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    type: z.nativeEnum(TransactionType),
    merchant: z.string().min(1, 'Merchant name is required').trim(),
    description: z.string().trim().optional().default(''),
    category: objectIdSchema,
    subcategory: z.string().trim().optional(),
    date: z.coerce.date(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.DEBIT_CARD),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter ISO code')
      .toUpperCase()
      .optional()
      .default('USD'),
    notes: z.string().trim().optional().default(''),
    tags: z.array(z.string().trim()).optional().default([]),
    source: z.nativeEnum(TransactionSource).optional().default(TransactionSource.MANUAL),
    recurring: z.boolean().optional(),
    isRecurring: z.boolean().optional().default(false),
    attachments: z.array(z.string()).optional().default([]),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
});

export const updateTransactionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    amount: z.coerce.number().positive('Amount must be greater than zero').optional(),
    type: z.nativeEnum(TransactionType).optional(),
    merchant: z.string().min(1, 'Merchant name cannot be empty').trim().optional(),
    description: z.string().trim().optional(),
    category: objectIdSchema.optional(),
    subcategory: z.string().trim().optional(),
    date: z.coerce.date().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    notes: z.string().trim().optional(),
    tags: z.array(z.string().trim()).optional(),
    source: z.nativeEnum(TransactionSource).optional(),
    recurring: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    attachments: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const queryTransactionsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    type: z.nativeEnum(TransactionType).optional(),
    category: z.string().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    recurring: z.union([z.string().transform((val) => val === 'true'), z.boolean()]).optional(),
    isRecurring: z.union([z.string().transform((val) => val === 'true'), z.boolean()]).optional(),
    sortBy: z.enum(['date', 'amount', 'merchant', 'createdAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const getTransactionByIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>['body'];
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>['body'];
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>['query'];
