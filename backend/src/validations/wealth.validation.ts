import { z } from 'zod';
import { AssetType } from '../models/asset.model.js';
import { LiabilityType } from '../models/liability.model.js';

export const createAssetSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'Asset name is required').max(100),
      type: z.nativeEnum(AssetType),
      currentValue: z.number().min(0, 'Current value cannot be negative').optional(),
      value: z.number().min(0, 'Value cannot be negative').optional(),
      currency: z.string().length(3).optional().default('USD'),
      institutionName: z.string().max(100).optional(),
      institution: z.string().max(100).optional(),
      accountNumberMasked: z.string().max(30).optional(),
      accountNumber: z.string().max(30).optional(),
      appreciationRateAnnual: z.number().optional().default(0),
      isLiquid: z.boolean().optional().default(true),
      notes: z.string().max(500).optional().default(''),
    })
    .transform((data) => ({
      ...data,
      currentValue: data.currentValue ?? data.value ?? 0,
      institutionName: data.institutionName ?? data.institution,
      accountNumberMasked: data.accountNumberMasked ?? data.accountNumber,
    })),
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid asset ID'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      type: z.nativeEnum(AssetType).optional(),
      currentValue: z.number().min(0).optional(),
      value: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      institutionName: z.string().max(100).optional(),
      institution: z.string().max(100).optional(),
      accountNumberMasked: z.string().max(30).optional(),
      accountNumber: z.string().max(30).optional(),
      appreciationRateAnnual: z.number().optional(),
      isLiquid: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    })
    .transform((data) => ({
      ...data,
      currentValue: data.currentValue ?? data.value,
      institutionName: data.institutionName ?? data.institution,
      accountNumberMasked: data.accountNumberMasked ?? data.accountNumber,
    })),
});

export const createLiabilitySchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'Liability name is required').max(100),
      type: z.nativeEnum(LiabilityType),
      currentBalance: z.number().min(0, 'Current balance cannot be negative').optional(),
      remainingAmount: z.number().min(0).optional(),
      amount: z.number().min(0).optional(),
      principalAmount: z.number().min(0).optional().default(0),
      totalAmount: z.number().min(0).optional(),
      currency: z.string().length(3).optional().default('USD'),
      lender: z.string().max(100).optional(),
      interestRateApr: z.number().min(0).optional().default(0),
      interestRate: z.number().min(0).optional(),
      minimumPaymentMonthly: z.number().min(0).optional().default(0),
      monthlyPayment: z.number().min(0).optional(),
      minimumPayment: z.number().min(0).optional(),
      dueDayOfMonth: z.number().int().min(1).max(31).optional(),
      notes: z.string().max(500).optional().default(''),
    })
    .transform((data) => ({
      ...data,
      currentBalance: data.currentBalance ?? data.remainingAmount ?? data.amount ?? 0,
      principalAmount:
        data.principalAmount ||
        data.totalAmount ||
        (data.currentBalance ?? data.remainingAmount ?? 0),
      interestRateApr: data.interestRateApr || data.interestRate || 0,
      minimumPaymentMonthly:
        data.minimumPaymentMonthly || data.monthlyPayment || data.minimumPayment || 0,
    })),
});

export const updateLiabilitySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid liability ID'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      type: z.nativeEnum(LiabilityType).optional(),
      currentBalance: z.number().min(0).optional(),
      remainingAmount: z.number().min(0).optional(),
      amount: z.number().min(0).optional(),
      principalAmount: z.number().min(0).optional(),
      totalAmount: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      lender: z.string().max(100).optional(),
      interestRateApr: z.number().min(0).optional(),
      interestRate: z.number().min(0).optional(),
      minimumPaymentMonthly: z.number().min(0).optional(),
      monthlyPayment: z.number().min(0).optional(),
      minimumPayment: z.number().min(0).optional(),
      dueDayOfMonth: z.number().int().min(1).max(31).optional(),
      notes: z.string().max(500).optional(),
    })
    .transform((data) => ({
      ...data,
      currentBalance: data.currentBalance ?? data.remainingAmount ?? data.amount,
      principalAmount: data.principalAmount ?? data.totalAmount,
      interestRateApr: data.interestRateApr ?? data.interestRate,
      minimumPaymentMonthly:
        data.minimumPaymentMonthly ?? data.monthlyPayment ?? data.minimumPayment,
    })),
});

export const createSnapshotSchema = z.object({
  body: z
    .object({
      date: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid snapshot date format' })
        .optional(),
      snapshotDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid snapshot date format' })
        .optional(),
      notes: z.string().max(300).optional().default(''),
      source: z.enum(['MANUAL', 'AUTO_SCHEDULE', 'SYSTEM']).optional().default('MANUAL'),
    })
    .transform((data) => ({
      ...data,
      date: data.date ?? data.snapshotDate,
    })),
});
