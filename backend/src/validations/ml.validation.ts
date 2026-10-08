import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId reference',
});

export const categorizeTransactionSchema = z.object({
  body: z.object({
    text: z
      .string({
        required_error: 'Transaction description is required',
        invalid_type_error: 'Transaction description must be a string',
      })
      .trim()
      .min(1, 'Transaction description cannot be empty')
      .max(500, 'Transaction description cannot exceed 500 characters'),
    dateContext: z.string().optional(),
  }),
});

export const categorizationFeedbackSchema = z.object({
  body: z.object({
    rawText: z.string().trim().min(1),
    parsedAmount: z.number().optional().nullable(),
    parsedCurrency: z.string().optional().nullable(),
    parsedMerchant: z.string().optional().nullable(),
    predictedCategorySlug: z.string().optional(),
    predictedCategory: z.string().optional(),
    predictedSubcategory: z.string().optional().nullable(),
    confidence: z.number().min(0).max(1),
    requiresConfirmation: z.boolean().optional().default(false),
    userAccepted: z.boolean().optional().default(true),
    correctedCategorySlug: z.string().optional(),
    correctedCategoryId: objectIdSchema.optional(),
    transactionId: objectIdSchema.optional(),
    source: z.string().optional().default('ml_pipeline'),
    modelVersion: z.string().optional().default('1.0.0'),
  }),
});
