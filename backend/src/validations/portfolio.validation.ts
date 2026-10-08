import { z } from 'zod';
import { HoldingAssetType } from '../models/holding.model.js';

export const createPortfolioSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Portfolio name is required').max(100, 'Name must not exceed 100 characters'),
    description: z.string().max(500).optional(),
    baseCurrency: z.string().length(3).optional(),
    cashBalance: z.number().min(0, 'Cash balance cannot be negative').optional(),
    isDefault: z.boolean().optional(),
    benchmarkSymbol: z.string().min(1).max(20).optional(),
  }),
});

export const updatePortfolioSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Portfolio ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    cashBalance: z.number().min(0).optional(),
    isDefault: z.boolean().optional(),
    benchmarkSymbol: z.string().min(1).max(20).optional(),
  }),
});

export const portfolioIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Portfolio ID is required'),
  }),
});

export const addHoldingSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Portfolio ID is required'),
  }),
  body: z.object({
    symbol: z
      .string()
      .min(1, 'Symbol is required')
      .max(20, 'Symbol must not exceed 20 characters')
      .transform((val) => val.trim().toUpperCase()),
    quantity: z.number({ required_error: 'Quantity is required' }).positive('Quantity must be greater than zero'),
    buyPrice: z.number({ required_error: 'Buy price is required' }).positive('Buy price must be greater than zero'),
    buyDate: z.string().or(z.date()).optional(),
    assetType: z.nativeEnum(HoldingAssetType).optional(),
    fees: z.number().min(0).optional(),
    sector: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const editHoldingSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Portfolio ID is required'),
    holdingId: z.string().min(1, 'Holding ID is required'),
  }),
  body: z.object({
    quantity: z.number().positive('Quantity must be greater than zero').optional(),
    averageBuyPrice: z.number().positive('Average buy price must be greater than zero').optional(),
    assetType: z.nativeEnum(HoldingAssetType).optional(),
    sector: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const holdingIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Portfolio ID is required'),
    holdingId: z.string().min(1, 'Holding ID is required'),
  }),
});
