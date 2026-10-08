import { z } from 'zod';

export const createWatchlistSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Watchlist name is required')
      .max(100, 'Name must not exceed 100 characters'),
    description: z.string().max(250).optional(),
    isDefault: z.boolean().optional(),
    initialSymbols: z.array(z.string().min(1).max(20)).optional(),
  }),
});

export const addWatchlistSymbolSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Watchlist ID is required'),
  }),
  body: z.object({
    symbol: z
      .string()
      .min(1, 'Symbol is required')
      .max(20, 'Symbol must not exceed 20 characters')
      .transform((val) => val.trim().toUpperCase()),
    notes: z.string().max(250).optional(),
    targetBuyPrice: z.number().positive().optional(),
    targetSellPrice: z.number().positive().optional(),
  }),
});

export const removeWatchlistSymbolSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Watchlist ID is required'),
    symbol: z
      .string()
      .min(1, 'Symbol is required')
      .transform((val) => val.trim().toUpperCase()),
  }),
});
