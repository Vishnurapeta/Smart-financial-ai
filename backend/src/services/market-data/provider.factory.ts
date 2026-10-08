import { MarketDataProvider } from './market-data.types.js';
import { YahooFinanceProvider } from './providers/yahoo.provider.js';
import { FinnhubProvider } from './providers/finnhub.provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export function createMarketDataProvider(): MarketDataProvider {
  const providerType = (env.MARKET_DATA_PROVIDER || 'yahoo').toLowerCase();
  const apiKey = env.MARKET_DATA_API_KEY;
  const timeoutMs = env.MARKET_DATA_TIMEOUT_MS;

  switch (providerType) {
    case 'finnhub':
      if (!apiKey) {
        logger.warn(
          'MARKET_DATA_PROVIDER is set to "finnhub" but MARKET_DATA_API_KEY is missing. Falling back to Yahoo Finance.',
        );
        return new YahooFinanceProvider(timeoutMs);
      }
      return new FinnhubProvider(apiKey, timeoutMs);

    case 'yahoo':
    default:
      return new YahooFinanceProvider(timeoutMs);
  }
}
