import { z } from 'zod';

export const searchStocksSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query cannot be empty').trim(),
  }),
});

export const getStockQuoteSchema = z.object({
  params: z.object({
    symbol: z
      .string()
      .min(1, 'Stock symbol is required')
      .max(20, 'Stock symbol is too long')
      .regex(/^[a-zA-Z0-9.\-^=]+$/, 'Invalid stock symbol format')
      .trim(),
  }),
});

export const getStockHistorySchema = z.object({
  params: z.object({
    symbol: z
      .string()
      .min(1, 'Stock symbol is required')
      .max(20, 'Stock symbol is too long')
      .regex(/^[a-zA-Z0-9.\-^=]+$/, 'Invalid stock symbol format')
      .trim(),
  }),
  query: z.object({
    range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y']).optional().default('1mo'),
    interval: z.enum(['1m', '5m', '15m', '1d', '1wk', '1mo']).optional().default('1d'),
  }),
});
