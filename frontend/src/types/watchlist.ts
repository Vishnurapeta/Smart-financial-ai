import { MarketQuote } from './stock.ts';

export interface WatchlistSymbol {
  symbol: string;
  addedAt: string;
  notes?: string;
  targetBuyPrice?: number;
  targetSellPrice?: number;
  quote?: MarketQuote | null;
}

export interface Watchlist {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  symbols: WatchlistSymbol[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWatchlistPayload {
  name: string;
  description?: string;
  isDefault?: boolean;
  initialSymbols?: string[];
}

export interface AddWatchlistSymbolPayload {
  symbol: string;
  notes?: string;
  targetBuyPrice?: number;
  targetSellPrice?: number;
}
