export interface MarketQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  week52High?: number;
  week52Low?: number;
  currency: string;
  timestamp: string;
  provider: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
  currency?: string;
}

export interface HistoricalBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataResult {
  symbol: string;
  timeframe: string;
  currency: string;
  bars: HistoricalBar[];
  provider: string;
}
