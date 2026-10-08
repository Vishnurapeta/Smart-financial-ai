import { api } from './api.ts';
import { MarketQuote, StockSearchResult, HistoricalDataResult } from '../types/stock.ts';

export class StockService {
  /**
   * Search for ticker symbols and companies
   */
  static async search(query: string): Promise<StockSearchResult[]> {
    if (!query || query.trim().length === 0) return [];

    const res = await api.request<{
      success: boolean;
      data: { results: StockSearchResult[]; provider: string };
    }>(`/stocks/search?q=${encodeURIComponent(query.trim())}`);

    return res.data.results;
  }

  /**
   * Get real-time stock quote and 52-week metrics
   */
  static async getQuote(symbol: string): Promise<MarketQuote> {
    const res = await api.request<{
      success: boolean;
      data: { quote: MarketQuote };
    }>(`/stocks/${encodeURIComponent(symbol.trim().toUpperCase())}/quote`);

    return res.data.quote;
  }

  /**
   * Get historical OHLCV chart bars
   */
  static async getHistory(
    symbol: string,
    range = '1mo',
    interval = '1d',
  ): Promise<HistoricalDataResult> {
    const res = await api.request<{
      success: boolean;
      data: { history: HistoricalDataResult };
    }>(
      `/stocks/${encodeURIComponent(symbol.trim().toUpperCase())}/history?range=${range}&interval=${interval}`,
    );

    return res.data.history;
  }
}
