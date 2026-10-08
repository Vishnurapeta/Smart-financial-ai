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
  GatewayTimeoutError,
} from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';

export class YahooFinanceProvider implements MarketDataProvider {
  readonly providerName = 'yahoo';
  private readonly baseUrl = 'https://query1.finance.yahoo.com';
  private readonly searchUrl = 'https://query2.finance.yahoo.com';
  private readonly timeoutMs: number;

  constructor(timeoutMs = 8000) {
    this.timeoutMs = timeoutMs;
  }

  private async fetchWithRetry<T>(url: string, retries = 2): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SmartFinAI/1.0',
            Accept: 'application/json',
          },
        });

        clearTimeout(timer);

        if (res.status === 429) {
          throw new TooManyRequestsError(
            'Yahoo Finance rate limit reached. Please try again shortly.',
          );
        }

        if (res.status === 404) {
          throw new NotFoundError('Stock symbol or data not found');
        }

        if (!res.ok) {
          if (res.status >= 500 && attempt < retries) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
            continue;
          }
          throw new BadGatewayError(`Yahoo Finance API responded with status ${res.status}`);
        }

        return (await res.json()) as T;
      } catch (err: unknown) {
        clearTimeout(timer);

        if (err instanceof NotFoundError || err instanceof TooManyRequestsError) {
          throw err;
        }

        const isAbort = (err as { name?: string }).name === 'AbortError';
        if (isAbort) {
          if (attempt < retries) continue;
          throw new GatewayTimeoutError(`Market data request timed out after ${this.timeoutMs}ms`);
        }

        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
          continue;
        }

        logger.error({ err, url }, 'Failed to fetch from Yahoo Finance provider');
        throw new BadGatewayError('Failed to retrieve live market data from upstream provider');
      }
    }

    throw new BadGatewayError('Market provider request failed after retries');
  }

  /**
   * Search for ticker symbols and company names
   */
  async search(query: string): Promise<StockSearchResult[]> {
    if (!query || query.trim().length === 0) return [];

    const url = `${this.searchUrl}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=true`;

    interface YahooSearchResponse {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        quoteType?: string;
        exchange?: string;
        currency?: string;
      }>;
    }

    try {
      const data = await this.fetchWithRetry<YahooSearchResponse>(url);
      const quotes = data.quotes || [];

      return quotes
        .filter(
          (q) =>
            q.symbol &&
            (q.quoteType === 'EQUITY' ||
              q.quoteType === 'ETF' ||
              q.quoteType === 'MUTUALFUND' ||
              !q.quoteType),
        )
        .map((q) => ({
          symbol: q.symbol!.toUpperCase(),
          name: q.longname || q.shortname || q.symbol!,
          type: q.quoteType || 'EQUITY',
          exchange: q.exchange || 'UNKNOWN',
          currency: q.currency || 'USD',
        }));
    } catch (err) {
      logger.warn({ err, query }, 'Market search failed on Yahoo provider');
      return [];
    }
  }

  /**
   * Fetch current stock quote including 52-week high/low, previous close, change
   */
  async getQuote(symbol: string): Promise<MarketQuote> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d&range=1d`;

    interface YahooChartResponse {
      chart?: {
        result?: Array<{
          meta?: {
            currency?: string;
            symbol?: string;
            shortName?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
            regularMarketTime?: number;
          };
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
        error?: {
          code?: string;
          description?: string;
        };
      };
    }

    const data = await this.fetchWithRetry<YahooChartResponse>(url);
    const result = data.chart?.result?.[0];

    if (!result || !result.meta || typeof result.meta.regularMarketPrice !== 'number') {
      throw new NotFoundError(
        `Stock symbol '${cleanSymbol}' was not found or lacks market quote data`,
      );
    }

    const meta = result.meta;
    const currentPrice = Math.round((meta.regularMarketPrice ?? 0) * 100) / 100;
    const previousClose =
      typeof meta.previousClose === 'number'
        ? Math.round(meta.previousClose * 100) / 100
        : typeof meta.chartPreviousClose === 'number'
          ? Math.round(meta.chartPreviousClose * 100) / 100
          : currentPrice;

    const change = Math.round((currentPrice - previousClose) * 100) / 100;
    const changePercent =
      previousClose > 0
        ? Math.round(((currentPrice - previousClose) / previousClose) * 10000) / 100
        : 0;

    const quotes = result.indicators?.quote?.[0];
    const open = quotes?.open?.find((v) => typeof v === 'number') ?? currentPrice;
    const high =
      meta.regularMarketDayHigh ?? quotes?.high?.find((v) => typeof v === 'number') ?? currentPrice;
    const low =
      meta.regularMarketDayLow ?? quotes?.low?.find((v) => typeof v === 'number') ?? currentPrice;
    const volume =
      meta.regularMarketVolume ?? quotes?.volume?.find((v) => typeof v === 'number') ?? 0;

    return {
      symbol: cleanSymbol,
      name: meta.shortName || cleanSymbol,
      currentPrice,
      previousClose,
      change,
      changePercent,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      volume,
      week52High: meta.fiftyTwoWeekHigh ? Math.round(meta.fiftyTwoWeekHigh * 100) / 100 : undefined,
      week52Low: meta.fiftyTwoWeekLow ? Math.round(meta.fiftyTwoWeekLow * 100) / 100 : undefined,
      currency: meta.currency || 'USD',
      timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date(),
      provider: this.providerName,
    };
  }

  /**
   * Fetch historical OHLCV data for charting and ML model forecasting
   */
  async getHistoricalOHLCV(
    symbol: string,
    range = '1mo',
    interval = '1d',
  ): Promise<HistoricalDataResult> {
    const cleanSymbol = symbol.trim().toUpperCase();

    // Map common timeframe requests to valid Yahoo range & interval
    const validRange = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'].includes(range)
      ? range
      : '1mo';
    const validInterval = ['1m', '5m', '15m', '1d', '1wk', '1mo'].includes(interval)
      ? interval
      : '1d';

    const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=${validInterval}&range=${validRange}`;

    interface YahooHistoricalResponse {
      chart?: {
        result?: Array<{
          meta?: {
            currency?: string;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    }

    const data = await this.fetchWithRetry<YahooHistoricalResponse>(url);
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new NotFoundError(`No historical market data available for symbol '${cleanSymbol}'`);
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];
    const volumes = quotes.volume || [];

    const bars: HistoricalBar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const close = closes[i];
      if (typeof close !== 'number' || isNaN(close)) continue;

      const open = typeof opens[i] === 'number' ? opens[i]! : close;
      const high = typeof highs[i] === 'number' ? highs[i]! : close;
      const low = typeof lows[i] === 'number' ? lows[i]! : close;
      const volume = typeof volumes[i] === 'number' ? volumes[i]! : 0;

      bars.push({
        timestamp: new Date(ts * 1000),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
      });
    }

    return {
      symbol: cleanSymbol,
      timeframe: `${validRange}_${validInterval}`,
      currency: result.meta?.currency || 'USD',
      bars,
      provider: this.providerName,
    };
  }
}
