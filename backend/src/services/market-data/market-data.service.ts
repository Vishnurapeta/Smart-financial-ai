import {
  MarketDataProvider,
  MarketQuote,
  StockSearchResult,
  HistoricalDataResult,
} from './market-data.types.js';
import { createMarketDataProvider } from './provider.factory.js';
import { cacheService } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger, logStructuredEvent } from '../../utils/logger.js';
import { ObservabilityEvent, LogLevel } from '../../constants/observability.constants.js';
import { StockPrice, PriceTimeframe } from '../../models/stock-price.model.js';
import { BadRequestError, AppError } from '../../utils/errors.js';

export class MarketDataService {
  private static instance: MarketDataService;
  private provider: MarketDataProvider;
  private inFlightQuotes = new Map<string, Promise<MarketQuote>>();

  constructor(provider?: MarketDataProvider) {
    this.provider = provider || createMarketDataProvider();
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * Swap out market provider dynamically
   */
  public setProvider(provider: MarketDataProvider): void {
    this.provider = provider;
    logger.info(`MarketDataService provider switched to: ${provider.providerName}`);
  }

  public getActiveProviderName(): string {
    return this.provider.providerName;
  }

  /**
   * Search for stock tickers
   */
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim().toLowerCase();
    const cacheKey = `stock:search:${cleanQuery}`;

    // 1. Check cache
    const cached = await cacheService.get<StockSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch from active provider
    try {
      const results = await this.provider.search(cleanQuery);
      if (results && results.length > 0) {
        await cacheService.set(cacheKey, results, env.MARKET_DATA_CACHE_TTL_SEARCH);
      }
      return results;
    } catch (err: unknown) {
      logStructuredEvent({
        level: LogLevel.ERROR,
        service: 'market_data',
        event: ObservabilityEvent.EXTERNAL_API_FAILURE,
        metadata: {
          provider: this.provider.providerName,
          operation: 'search',
          query: cleanQuery,
          error: (err as Error).message,
        },
      });
      throw new AppError(
        'Market search service is temporarily unavailable. Please try again later.',
        503,
        'MARKET_DATA_UNAVAILABLE',
      );
    }
  }

  /**
   * Fetch current real quote for a symbol
   */
  async getQuote(symbol: string): Promise<MarketQuote> {
    return this.getStockQuote(symbol);
  }

  /**
   * Fetch current real quote for a symbol with zero synthetic data fabrication
   */
  async getStockQuote(symbol: string): Promise<MarketQuote> {
    if (!symbol || symbol.trim().length === 0) {
      throw new BadRequestError('Stock symbol is required');
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `stock:quote:${cleanSymbol}`;

    // 1. Check cache
    const cached = await cacheService.get<MarketQuote>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Coalesce concurrent in-flight requests for the same symbol (Cache stampede prevention)
    const pendingPromise = this.inFlightQuotes.get(cleanSymbol);
    if (pendingPromise) {
      return pendingPromise;
    }

    // 3. Fetch from active provider with promise deduplication
    const quotePromise = (async () => {
      try {
        const quote = await this.provider.getQuote(cleanSymbol);

        // Cache result
        await cacheService.set(cacheKey, quote, env.MARKET_DATA_CACHE_TTL_QUOTE);

        // Asynchronously persist latest price to database (without blocking response)
        StockPrice.create({
          symbol: quote.symbol,
          timestamp: quote.timestamp,
          timeframe: PriceTimeframe.DAILY,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.currentPrice,
          volume: quote.volume,
          change: quote.change,
          changePercent: quote.changePercent,
          source: quote.provider,
        }).catch((err) => {
          logger.debug({ err, symbol: quote.symbol }, 'Failed to persist stock price snapshot to db');
        });

        return quote;
      } catch (err: unknown) {
        if (err instanceof AppError && err.statusCode < 500) {
          throw err; // Retain 404 NotFound
        }

        logStructuredEvent({
          level: LogLevel.ERROR,
          service: 'market_data',
          event: ObservabilityEvent.EXTERNAL_API_FAILURE,
          metadata: {
            provider: this.provider.providerName,
            operation: 'getQuote',
            symbol: cleanSymbol,
            error: (err as Error).message,
          },
        });

        // Strict requirement: Never fabricate market data
        throw new AppError(
          `Market quote data is currently unavailable for '${cleanSymbol}'. Please try again shortly.`,
          503,
          'MARKET_DATA_UNAVAILABLE',
        );
      } finally {
        this.inFlightQuotes.delete(cleanSymbol);
      }
    })();

    this.inFlightQuotes.set(cleanSymbol, quotePromise);
    return quotePromise;
  }

  /**
   * Fetch historical OHLCV data for charting & analytics
   */
  async getHistory(symbol: string, range = '1mo', interval = '1d'): Promise<HistoricalDataResult> {
    return this.getStockHistory(symbol, range, interval);
  }

  /**
   * Fetch historical OHLCV data for charting & analytics with zero synthetic data fabrication
   */
  async getStockHistory(
    symbol: string,
    range = '1mo',
    interval = '1d',
  ): Promise<HistoricalDataResult> {
    if (!symbol || symbol.trim().length === 0) {
      throw new BadRequestError('Stock symbol is required');
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `stock:history:${cleanSymbol}:${range}:${interval}`;

    // 1. Check cache
    const cached = await cacheService.get<HistoricalDataResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch from active provider
    try {
      const history = await this.provider.getHistoricalOHLCV(cleanSymbol, range, interval);

      // 3. Cache result
      await cacheService.set(cacheKey, history, env.MARKET_DATA_CACHE_TTL_HISTORY);

      return history;
    } catch (err: unknown) {
      if (err instanceof AppError && err.statusCode < 500) {
        throw err;
      }

      logStructuredEvent({
        level: LogLevel.ERROR,
        service: 'market_data',
        event: ObservabilityEvent.EXTERNAL_API_FAILURE,
        metadata: {
          provider: this.provider.providerName,
          operation: 'getHistoricalOHLCV',
          symbol: cleanSymbol,
          error: (err as Error).message,
        },
      });

      // Strict requirement: Never fabricate market data
      throw new AppError(
        `Market historical data is currently unavailable for '${cleanSymbol}'. Please try again shortly.`,
        503,
        'MARKET_DATA_UNAVAILABLE',
      );
    }
  }
}

export const marketDataService = new MarketDataService();
