import {
  MarketDataProvider,
  MarketQuote,
  StockSearchResult,
  HistoricalDataResult,
  HistoricalBar,
} from '../market-data.types.js';
import {
  NotFoundError,
  TooManyRequestsError,
  BadGatewayError,
  BadRequestError,
} from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

export class FinnhubProvider implements MarketDataProvider {
  readonly providerName = 'finnhub';
  private readonly baseUrl = 'https://finnhub.io/api/v1';
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 8000) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new BadRequestError('Finnhub API key is required when MARKET_DATA_PROVIDER=finnhub');
    }
    this.apiKey = apiKey.trim();
    this.timeoutMs = timeoutMs;
  }

  private async fetchFinnhub<T>(
    endpoint: string,
    queryParams: Record<string, string> = {},
  ): Promise<T> {
    const params = new URLSearchParams({ ...queryParams, token: this.apiKey });
    const url = `${this.baseUrl}${endpoint}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 429) {
        throw new TooManyRequestsError('Finnhub API rate limit reached (60 calls/minute limit)');
      }

      if (res.status === 401 || res.status === 403) {
        throw new BadRequestError('Invalid or expired Finnhub API key');
      }

      if (!res.ok) {
        throw new BadGatewayError(`Finnhub returned HTTP status ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof TooManyRequestsError || err instanceof BadRequestError) throw err;
      logger.error({ err, endpoint }, 'Finnhub request failed');
      throw new BadGatewayError('Failed to fetch market data from Finnhub');
    }
  }

  async search(query: string): Promise<StockSearchResult[]> {
    if (!query) return [];

    interface FinnhubSearchResponse {
      result?: Array<{
        description?: string;
        displaySymbol?: string;
        symbol?: string;
        type?: string;
      }>;
    }

    try {
      const data = await this.fetchFinnhub<FinnhubSearchResponse>('/search', { q: query });
      return (data.result || []).map((item) => ({
        symbol: (item.symbol || item.displaySymbol || '').toUpperCase(),
        name: item.description || item.symbol || '',
        type: item.type || 'Common Stock',
        currency: 'USD',
      }));
    } catch {
      return [];
    }
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const cleanSymbol = symbol.trim().toUpperCase();

    interface FinnhubQuoteResponse {
      c?: number; // current price
      d?: number; // change
      dp?: number; // percent change
      h?: number; // high
      l?: number; // low
      o?: number; // open
      pc?: number; // previous close
      t?: number; // timestamp
    }

    const data = await this.fetchFinnhub<FinnhubQuoteResponse>('/quote', { symbol: cleanSymbol });

    if (!data.c || data.c === 0) {
      throw new NotFoundError(
        `Stock symbol '${cleanSymbol}' not found on Finnhub or has no quote data`,
      );
    }

    const currentPrice = Math.round(data.c * 100) / 100;
    const previousClose = data.pc ? Math.round(data.pc * 100) / 100 : currentPrice;
    const change = data.d
      ? Math.round(data.d * 100) / 100
      : Math.round((currentPrice - previousClose) * 100) / 100;
    const changePercent = data.dp ? Math.round(data.dp * 100) / 100 : 0;

    return {
      symbol: cleanSymbol,
      name: cleanSymbol,
      currentPrice,
      previousClose,
      change,
      changePercent,
      open: data.o ? Math.round(data.o * 100) / 100 : currentPrice,
      high: data.h ? Math.round(data.h * 100) / 100 : currentPrice,
      low: data.l ? Math.round(data.l * 100) / 100 : currentPrice,
      volume: 0, // Finnhub free quote endpoint doesn't include day volume
      currency: 'USD',
      timestamp: data.t ? new Date(data.t * 1000) : new Date(),
      provider: this.providerName,
    };
  }

  async getHistoricalOHLCV(symbol: string, range = '1mo'): Promise<HistoricalDataResult> {
    const cleanSymbol = symbol.trim().toUpperCase();

    // Map range to from/to timestamps
    const now = Math.floor(Date.now() / 1000);
    let from = now - 30 * 24 * 3600; // default 30 days
    if (range === '1y') from = now - 365 * 24 * 3600;
    else if (range === '6mo') from = now - 180 * 24 * 3600;
    else if (range === '5d') from = now - 5 * 24 * 3600;

    interface FinnhubCandleResponse {
      s: string; // 'ok' or 'no_data'
      c?: number[]; // closes
      h?: number[]; // highs
      l?: number[]; // lows
      o?: number[]; // opens
      t?: number[]; // timestamps
      v?: number[]; // volumes
    }

    const data = await this.fetchFinnhub<FinnhubCandleResponse>('/stock/candle', {
      symbol: cleanSymbol,
      resolution: 'D',
      from: from.toString(),
      to: now.toString(),
    });

    if (data.s !== 'ok' || !data.t || data.t.length === 0) {
      throw new NotFoundError(
        `Finnhub returned no historical candle bars for symbol '${cleanSymbol}'`,
      );
    }

    const bars: HistoricalBar[] = [];
    for (let i = 0; i < data.t.length; i++) {
      bars.push({
        timestamp: new Date(data.t[i] * 1000),
        open: data.o?.[i] ?? 0,
        high: data.h?.[i] ?? 0,
        low: data.l?.[i] ?? 0,
        close: data.c?.[i] ?? 0,
        volume: data.v?.[i] ?? 0,
      });
    }

    return {
      symbol: cleanSymbol,
      timeframe: `${range}_1d`,
      currency: 'USD',
      bars,
      provider: this.providerName,
    };
  }
}
