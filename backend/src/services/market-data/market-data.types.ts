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
  timestamp: Date;
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
  timestamp: Date;
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

export interface MarketDataProvider {
  readonly providerName: string;
  search(query: string): Promise<StockSearchResult[]>;
  getQuote(symbol: string): Promise<MarketQuote>;
  getHistoricalOHLCV(
    symbol: string,
    range?: string,
    interval?: string,
  ): Promise<HistoricalDataResult>;
}
