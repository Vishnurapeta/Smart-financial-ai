import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, StockPrice } from '../src/models/index.js';
import { marketDataService } from '../src/services/market-data/market-data.service.js';
import {
  MarketDataProvider,
  MarketQuote,
  StockSearchResult,
  HistoricalDataResult,
} from '../src/services/market-data/market-data.types.js';
import { cacheService } from '../src/config/redis.js';

// Mock Provider for testing provider replacement & rate limit simulation
class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = 'mock-provider';
  public shouldSimulateRateLimit = false;

  async search(query: string): Promise<StockSearchResult[]> {
    if (this.shouldSimulateRateLimit) {
      throw new Error('Rate limit exceeded');
    }
    return [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'EQUITY',
        exchange: 'NASDAQ',
        currency: 'USD',
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        type: 'EQUITY',
        exchange: 'NASDAQ',
        currency: 'USD',
      },
    ].filter((s) => s.symbol.includes(query.toUpperCase()) || s.name.toLowerCase().includes(query.toLowerCase()));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    if (this.shouldSimulateRateLimit) {
      throw new Error('Rate limit exceeded');
    }

    const clean = symbol.toUpperCase();
    return {
      symbol: clean,
      name: `${clean} Corporation`,
      currentPrice: 185.5,
      previousClose: 180.0,
      change: 5.5,
      changePercent: 3.06,
      open: 181.0,
      high: 186.2,
      low: 180.5,
      volume: 45000000,
      week52High: 199.62,
      week52Low: 140.2,
      currency: 'USD',
      timestamp: new Date(),
      provider: this.providerName,
    };
  }

  async getHistoricalOHLCV(symbol: string, range = '1mo', interval = '1d'): Promise<HistoricalDataResult> {
    const clean = symbol.toUpperCase();
    return {
      symbol: clean,
      timeframe: `${range}_${interval}`,
      currency: 'USD',
      bars: [
        {
          timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          open: 180.0,
          high: 182.5,
          low: 179.5,
          close: 181.5,
          volume: 42000000,
        },
        {
          timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          open: 181.5,
          high: 184.0,
          low: 181.0,
          close: 183.0,
          volume: 44000000,
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000),
          open: 183.0,
          high: 186.5,
          low: 182.5,
          close: 185.5,
          volume: 48000000,
        },
      ],
      provider: this.providerName,
    };
  }
}

describe('Stock Market Integration & Provider Abstraction Tests', () => {
  let userToken: string;
  let userId: string;
  const mockProvider = new MockMarketDataProvider();

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfin_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'stock_test@smartfin.ai' });
    await StockPrice.deleteMany({ symbol: { $in: ['AAPL', 'MSFT', 'NVDA'] } });
    await cacheService.delPattern('stock:*');
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Setup test user
    await User.deleteMany({ email: 'stock_test@smartfin.ai' });
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'stock_test@smartfin.ai',
        password: 'Password123!',
        firstName: 'Stock',
        lastName: 'Trader',
      });

    userToken = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user.id;

    // Use mock provider by default for deterministic testing
    marketDataService.setProvider(mockProvider);
    mockProvider.shouldSimulateRateLimit = false;

    // Invalidate cache
    await cacheService.delPattern('stock:*');
  });

  describe('1. Provider Abstraction & Swappability', () => {
    it('should report the active provider and allow switching providers', async () => {
      expect(marketDataService.getActiveProviderName()).toBe('mock-provider');

      // Create another mock provider
      const secondProvider: MarketDataProvider = {
        providerName: 'custom-institutional-feed',
        search: async () => [],
        getQuote: async (sym) => ({
          symbol: sym,
          name: 'Institutional Feed',
          currentPrice: 200,
          previousClose: 195,
          change: 5,
          changePercent: 2.56,
          open: 196,
          high: 201,
          low: 195,
          volume: 1000000,
          currency: 'USD',
          timestamp: new Date(),
          provider: 'custom-institutional-feed',
        }),
        getHistoricalOHLCV: async () => ({
          symbol: 'XYZ',
          timeframe: '1mo_1d',
          currency: 'USD',
          bars: [],
          provider: 'custom-institutional-feed',
        }),
      };

      marketDataService.setProvider(secondProvider);
      expect(marketDataService.getActiveProviderName()).toBe('custom-institutional-feed');

      const quote = await marketDataService.getStockQuote('TEST');
      expect(quote.provider).toBe('custom-institutional-feed');
      expect(quote.currentPrice).toBe(200);

      // Revert back to mockProvider
      marketDataService.setProvider(mockProvider);
    });
  });

  describe('2. Stock Search Endpoint', () => {
    it('should search for stocks by query string', async () => {
      const res = await request(app)
        .get('/api/v1/stocks/search?q=apple')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.results)).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThan(0);
      expect(res.body.data.results[0].symbol).toBe('AAPL');
    });

    it('should reject search with empty query', async () => {
      const res = await request(app)
        .get('/api/v1/stocks/search?q=')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Stock Quote Endpoint with All Requested Fields', () => {
    it('should return complete quote: current price, previous close, daily change, percentage, volume, 52-week high & low', async () => {
      const res = await request(app)
        .get('/api/v1/stocks/AAPL/quote')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const quote = res.body.data.quote;

      // Verification of all user-requested fields:
      expect(quote.symbol).toBe('AAPL');
      expect(quote.currentPrice).toBe(185.5);
      expect(quote.previousClose).toBe(180.0);
      expect(quote.change).toBe(5.5);
      expect(quote.changePercent).toBe(3.06);
      expect(quote.volume).toBe(45000000);
      expect(quote.week52High).toBe(199.62);
      expect(quote.week52Low).toBe(140.2);
      expect(quote.open).toBe(181.0);
      expect(quote.high).toBe(186.2);
      expect(quote.low).toBe(180.5);
      expect(quote.currency).toBe('USD');
      expect(quote.provider).toBe('mock-provider');
    });

    it('should cache quote response on subsequent requests', async () => {
      // First call -> populates cache
      const res1 = await request(app)
        .get('/api/v1/stocks/AAPL/quote')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res1.status).toBe(200);

      // Verify item exists in cacheService
      const cached = await cacheService.get<MarketQuote>('stock:quote:AAPL');
      expect(cached).not.toBeNull();
      expect(cached?.symbol).toBe('AAPL');
      expect(cached?.currentPrice).toBe(185.5);

      // Change provider behavior; since it's cached, it should still return cached quote
      mockProvider.shouldSimulateRateLimit = true;

      const res2 = await request(app)
        .get('/api/v1/stocks/AAPL/quote')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.quote.currentPrice).toBe(185.5);
    });
  });

  describe('4. Historical OHLCV Data Endpoint', () => {
    it('should return historical OHLCV data array with timestamps, open, high, low, close, volume', async () => {
      const res = await request(app)
        .get('/api/v1/stocks/AAPL/history?range=1mo&interval=1d')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const history = res.body.data.history;

      expect(history.symbol).toBe('AAPL');
      expect(history.timeframe).toBe('1mo_1d');
      expect(Array.isArray(history.bars)).toBe(true);
      expect(history.bars.length).toBe(3);

      const firstBar = history.bars[0];
      expect(firstBar).toHaveProperty('timestamp');
      expect(firstBar).toHaveProperty('open');
      expect(firstBar).toHaveProperty('high');
      expect(firstBar).toHaveProperty('low');
      expect(firstBar).toHaveProperty('close');
      expect(firstBar).toHaveProperty('volume');
      expect(firstBar.close).toBe(181.5);
    });

    it('should cache historical data points', async () => {
      await request(app)
        .get('/api/v1/stocks/MSFT/history?range=1mo&interval=1d')
        .set('Authorization', `Bearer ${userToken}`);

      const cached = await cacheService.get<HistoricalDataResult>('stock:history:MSFT:1mo:1d');
      expect(cached).not.toBeNull();
      expect(cached?.symbol).toBe('MSFT');
      expect(cached?.bars.length).toBe(3);
    });
  });

  describe('5. Security, Authorization & Error Handling', () => {
    it('should block unauthenticated access to market endpoints', async () => {
      const res = await request(app).get('/api/v1/stocks/AAPL/quote');
      expect(res.status).toBe(401);
    });

    it('should reject invalid symbol format', async () => {
      const res = await request(app)
        .get('/api/v1/stocks/INVALID$$SYMBOL!/quote')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
    });
  });
});
