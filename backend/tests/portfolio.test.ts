import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Portfolio } from '../src/models/portfolio.model.js';
import { Holding } from '../src/models/holding.model.js';
import { StockPrediction, PredictionHorizon, PredictionStatus } from '../src/models/stock-prediction.model.js';
import { MarketDataService } from '../src/services/market-data/market-data.service.js';
import { MarketDataProvider, MarketQuote } from '../src/services/market-data/market-data.types.js';
import { cacheService } from '../src/config/redis.js';

class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = 'mock-portfolio-provider';

  quotes: Record<string, MarketQuote> = {
    AAPL: {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currency: 'USD',
      currentPrice: 200.0,
      previousClose: 190.0,
      change: 10.0,
      changePercent: 5.26,
      open: 192.0,
      high: 202.0,
      low: 191.0,
      volume: 50000000,
      week52High: 237.0,
      week52Low: 160.0,
      timestamp: new Date(),
      provider: 'mock-portfolio-provider',
    },
    MSFT: {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      currency: 'USD',
      currentPrice: 400.0,
      previousClose: 410.0,
      change: -10.0,
      changePercent: -2.44,
      open: 408.0,
      high: 412.0,
      low: 398.0,
      volume: 30000000,
      week52High: 468.0,
      week52Low: 310.0,
      timestamp: new Date(),
      provider: 'mock-portfolio-provider',
    },
    NVDA: {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      currency: 'USD',
      currentPrice: 120.0,
      previousClose: 110.0,
      change: 10.0,
      changePercent: 9.09,
      open: 112.0,
      high: 122.0,
      low: 111.0,
      volume: 75000000,
      week52High: 140.0,
      week52Low: 40.0,
      timestamp: new Date(),
      provider: 'mock-portfolio-provider',
    },
  };

  async search() {
    return [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'EQUITY' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'EQUITY' },
    ];
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const q = this.quotes[symbol.toUpperCase()];
    if (!q) {
      throw new Error(`Symbol '${symbol}' not found in registry`);
    }
    return q;
  }

  async getHistory(symbol: string, range = '1mo', interval = '1d') {
    return {
      symbol,
      range,
      interval,
      bars: [
        {
          date: '2026-09-25',
          timestamp: 1787889600,
          open: 190,
          high: 200,
          low: 189,
          close: 200,
          volume: 40000000,
        },
      ],
      count: 1,
    };
  }
}

describe('Investment Portfolio & Holding Architecture Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof createApp>;
  let mockProvider: MockMarketDataProvider;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    mockProvider = new MockMarketDataProvider();
    MarketDataService.getInstance().setProvider(mockProvider);

    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Portfolio.deleteMany({});
    await Holding.deleteMany({});
    await StockPrediction.deleteMany({});
    await User.deleteMany({});
    await cacheService.delPattern('stock:*');

    // Register user
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'wealth.builder@smartfin.ai',
      password: 'SecurePassword123!',
      firstName: 'Portfolio',
      lastName: 'Manager',
    });

    userToken = res.body.data.tokens.accessToken;
    userId = res.body.data.user.id;
  });

  describe('1. Portfolio Creation & Management', () => {
    it('should auto-provision a default portfolio if user has none', async () => {
      const res = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);

      const defaultPort = res.body.data[0];
      expect(defaultPort.name).toBe('Main Investment Portfolio');
      expect(defaultPort.isDefault).toBe(true);
      expect(defaultPort.baseCurrency).toBe('USD');
      expect(defaultPort.holdingsCount).toBe(0);
    });

    it('should create a custom portfolio and set cash balance', async () => {
      const res = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Tech & Dividend Growth',
          description: 'Long-term compounding portfolio',
          baseCurrency: 'USD',
          cashBalance: 5000,
          isDefault: true,
          benchmarkSymbol: 'QQQ',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Tech & Dividend Growth');
      expect(res.body.data.cashBalance).toBe(5000);
      expect(res.body.data.benchmarkSymbol).toBe('QQQ');
      expect(res.body.data.isDefault).toBe(true);
    });

    it('should update and delete a portfolio', async () => {
      const createRes = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Retirement Fund', cashBalance: 1000 });

      const portfolioId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ cashBalance: 2500, description: 'Updated note' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.cashBalance).toBe(2500);

      const deleteRes = await request(app)
        .delete(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('2. Adding Holdings, Lots & Weighted Average Price Calculations', () => {
    it('should add holding and compute accurate investedValue, currentMarketValue, and P&L using live quotes', async () => {
      const portRes = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);
      const portfolioId = portRes.body.data[0].id;

      // Buy 10 AAPL @ $150 (mock price is $200)
      const addRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: 10,
          buyPrice: 150.0,
          fees: 5.0,
          sector: 'Consumer Electronics',
          notes: 'Initial lot purchase',
        });

      expect(addRes.status).toBe(201);
      const holding = addRes.body.data;
      expect(holding.symbol).toBe('AAPL');
      expect(holding.quantity).toBe(10);
      expect(holding.averageBuyPrice).toBe(150.0);
      expect(holding.currentPrice).toBe(200.0);

      // Calculations:
      // investedValue = 10 * 150 = 1500
      // currentMarketValue = 10 * 200 = 2000
      // unrealizedPnL = 2000 - 1500 = +500
      // returnPercentage = (500 / 1500) * 100 = +33.33%
      expect(holding.investedValue).toBe(1500.0);
      expect(holding.currentMarketValue).toBe(2000.0);
      expect(holding.unrealizedPnL).toBe(500.0);
      expect(holding.returnPercentage).toBe(33.33);
      expect(holding.lotsCount).toBe(1);
    });

    it('should accurately calculate weighted average buy price when adding a second lot to existing holding', async () => {
      const portRes = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);
      const portfolioId = portRes.body.data[0].id;

      // Lot 1: 10 AAPL @ $150 (Cost: $1500)
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: 10,
          buyPrice: 150.0,
        });

      // Lot 2: 10 AAPL @ $170 (Cost: $1700)
      // Total Qty: 20
      // Total Cost: $3200
      // Weighted Avg Buy Price: 3200 / 20 = $160.00
      const lot2Res = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: 10,
          buyPrice: 170.0,
        });

      expect(lot2Res.status).toBe(201);
      const holding = lot2Res.body.data;
      expect(holding.quantity).toBe(20);
      expect(holding.averageBuyPrice).toBe(160.0);
      expect(holding.investedValue).toBe(3200.0);
      // Current market value: 20 * 200 = 4000
      expect(holding.currentMarketValue).toBe(4000.0);
      // Unrealized P&L: 4000 - 3200 = +800
      expect(holding.unrealizedPnL).toBe(800.0);
      // Return %: (800 / 3200) * 100 = 25.0%
      expect(holding.returnPercentage).toBe(25.0);
      expect(holding.lotsCount).toBe(2);
    });

    it('should reject invalid holding data or unrecognized stock symbol', async () => {
      const portRes = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);
      const portfolioId = portRes.body.data[0].id;

      // Negative quantity
      const negQty = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: -5,
          buyPrice: 150,
        });
      expect(negQty.status).toBe(400);

      // Unrecognized symbol
      const unrec = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'FAKE_TICKER_99',
          quantity: 10,
          buyPrice: 100,
        });
      expect(unrec.status).toBe(400);
    });

    it('should edit holding and soft-delete holding', async () => {
      const portRes = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);
      const portfolioId = portRes.body.data[0].id;

      const addRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'MSFT',
          quantity: 5,
          buyPrice: 380,
        });

      const holdingId = addRes.body.data.id;

      const editRes = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}/holdings/${holdingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quantity: 8,
          averageBuyPrice: 390,
          notes: 'Updated position sizing',
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.quantity).toBe(8);
      expect(editRes.body.data.averageBuyPrice).toBe(390);

      const delRes = await request(app)
        .delete(`/api/v1/portfolios/${portfolioId}/holdings/${holdingId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(delRes.status).toBe(200);
    });
  });

  describe('3. Portfolio Dashboard Analytics, Allocation & Sector Breakdown', () => {
    it('should compute complete dashboard analytics with asset allocation and sector breakdown', async () => {
      const createRes = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Growth Tech Fund',
          cashBalance: 2000,
        });
      const portfolioId = createRes.body.data.id;

      // Position 1: 10 AAPL @ $150 (Current Price $200) -> Market Value $2000, Invested $1500 (P&L: +$500, +33.33%)
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: 10,
          buyPrice: 150,
          sector: 'Technology',
        });

      // Position 2: 5 MSFT @ $420 (Current Price $400) -> Market Value $2000, Invested $2100 (P&L: -$100, -4.76%)
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'MSFT',
          quantity: 5,
          buyPrice: 420,
          sector: 'Software',
        });

      // Position 3: 25 NVDA @ $80 (Current Price $120) -> Market Value $3000, Invested $2000 (P&L: +$1000, +50.0%)
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'NVDA',
          quantity: 25,
          buyPrice: 80,
          sector: 'Semiconductors',
        });

      // Fetch Dashboard
      const dashRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/dashboard`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(dashRes.status).toBe(200);
      const dashboard = dashRes.body.data;

      // Summary checks:
      // Total Invested = 1500 + 2100 + 2000 = $5600
      // Current Market Value = 2000 + 2000 + 3000 = $7000
      // Total Unrealized P&L = 7000 - 5600 = +$1400
      // Return % = (1400 / 5600) * 100 = 25.0%
      // Total Net Value with Cash ($2000) = $9000
      expect(dashboard.summary.totalInvested).toBe(5600);
      expect(dashboard.summary.currentValue).toBe(7000);
      expect(dashboard.summary.totalUnrealizedPnL).toBe(1400);
      expect(dashboard.summary.returnPercentage).toBe(25.0);
      expect(dashboard.summary.totalNetValue).toBe(9000);
      expect(dashboard.summary.holdingsCount).toBe(3);

      // Asset Allocation:
      // NVDA: 3000 / 7000 = 42.86%
      // AAPL: 2000 / 7000 = 28.57%
      // MSFT: 2000 / 7000 = 28.57%
      expect(dashboard.allocation.length).toBe(3);
      expect(dashboard.allocation[0].symbol).toBe('NVDA');
      expect(dashboard.allocation[0].percentage).toBe(42.86);

      // Sector Allocation:
      expect(dashboard.sectorAllocation.length).toBe(3);
      const semiSector = dashboard.sectorAllocation.find((s: { sector: string }) => s.sector === 'Semiconductors');
      expect(semiSector).toBeDefined();
      expect(semiSector.value).toBe(3000);

      // Performance highlights:
      // Best Performer = NVDA (+50.0%)
      // Worst Performer = MSFT (-4.76%)
      expect(dashboard.performance.bestPerformer.symbol).toBe('NVDA');
      expect(dashboard.performance.bestPerformer.returnPercentage).toBe(50.0);
      expect(dashboard.performance.worstPerformer.symbol).toBe('MSFT');
      expect(dashboard.performance.worstPerformer.returnPercentage).toBe(-4.76);
    });

    it('should attach future stock prediction forecast to holding when prediction record is present', async () => {
      const portRes = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${userToken}`);
      const portfolioId = portRes.body.data[0].id;

      // Seed a stock prediction for AAPL
      await StockPrediction.create({
        symbol: 'AAPL',
        model: 'LSTM-Transformer-v2',
        predictionHorizon: PredictionHorizon.THIRTY_DAYS,
        predictionTimestamp: new Date(),
        predictedValue: 220.0,
        predictedReturn: 10.0,
        modelVersion: '2.1.0',
        featureVersion: 'f1',
        dataTimestamp: new Date(),
        evaluationMetrics: {
          confidenceScore: 0.88,
          directionAccuracy: 0.82,
        },
        status: PredictionStatus.PENDING_EVALUATION,
      });

      // Add AAPL holding
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          quantity: 10,
          buyPrice: 180,
        });

      const dashRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/dashboard`)
        .set('Authorization', `Bearer ${userToken}`);

      const aaplHolding = dashRes.body.data.holdings.find((h: { symbol: string }) => h.symbol === 'AAPL');
      expect(aaplHolding).toBeDefined();
      expect(aaplHolding.predictionForecast).toBeDefined();
      expect(aaplHolding.predictionForecast.predictedReturn).toBe(10.0);
      expect(aaplHolding.predictionForecast.model).toBe('LSTM-Transformer-v2');
      expect(aaplHolding.predictionForecast.confidenceScore).toBe(0.88);
    });
  });
});
