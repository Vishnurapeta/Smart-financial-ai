import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User, RoleName } from '../src/models/user.model.js';
import { Watchlist } from '../src/models/watchlist.model.js';
import { StockAlert, StockAlertType } from '../src/models/stock-alert.model.js';
import { Notification, NotificationType } from '../src/models/notification.model.js';
import { MarketDataService } from '../src/services/market-data/market-data.service.js';
import { MarketDataProvider, MarketQuote } from '../src/services/market-data/market-data.types.js';
import { StockAlertService } from '../src/services/stock-alert.service.js';
import { cacheService } from '../src/config/redis.js';

class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = 'mock-test';

  quotes: Record<string, MarketQuote> = {
    AAPL: {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currency: 'USD',
      currentPrice: 230.5,
      previousClose: 225.0,
      change: 5.5,
      changePercent: 2.44,
      open: 226.0,
      high: 232.0,
      low: 225.5,
      volume: 45000000,
      week52High: 237.23,
      week52Low: 164.08,
      timestamp: new Date(),
      provider: 'mock-test',
    },
    TSLA: {
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      currency: 'USD',
      currentPrice: 195.0,
      previousClose: 205.0,
      change: -10.0,
      changePercent: -4.88,
      open: 202.0,
      high: 203.0,
      low: 194.5,
      volume: 65000000,
      week52High: 271.0,
      week52Low: 138.8,
      timestamp: new Date(),
      provider: 'mock-test',
    },
  };

  async search() {
    return [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
      { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
    ];
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const q = this.quotes[symbol.toUpperCase()];
    if (!q) {
      throw new Error(`Symbol '${symbol}' not found`);
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
          open: 220,
          high: 225,
          low: 219,
          close: 225,
          volume: 30000000,
        },
      ],
      count: 1,
    };
  }
}

describe('Stock Watchlist, Alerts & Notification Architecture Tests', () => {
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
    await Watchlist.deleteMany({});
    await StockAlert.deleteMany({});
    await Notification.deleteMany({});
    await User.deleteMany({});
    await cacheService.delPattern('alert:*');
    await cacheService.delPattern('stock:*');

    // Register test user
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'investor@smartfin.ai',
      password: 'SecurePassword123!',
      firstName: 'Investor',
      lastName: 'User',
    });

    userToken = res.body.data.tokens.accessToken;
    userId = res.body.data.user.id;
  });

  describe('1. Watchlist Operations', () => {
    it('should auto-provision a default watchlist populated with quotes', async () => {
      const res = await request(app)
        .get('/api/v1/watchlists')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const defaultWl = res.body.data[0];
      expect(defaultWl.name).toBe('My Watchlist');
      expect(defaultWl.isDefault).toBe(true);
      expect(Array.isArray(defaultWl.symbols)).toBe(true);
    });

    it('should add a symbol and enrich it with current price and daily change', async () => {
      // First get or create watchlist
      const listRes = await request(app)
        .get('/api/v1/watchlists')
        .set('Authorization', `Bearer ${userToken}`);

      const watchlistId = listRes.body.data[0].id;

      const addRes = await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/symbols`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'TSLA',
          notes: 'Watching EV leader for reversal',
          targetBuyPrice: 180,
        });

      expect(addRes.status).toBe(200);
      expect(addRes.body.success).toBe(true);

      const added = addRes.body.data.symbols.find((s: { symbol: string }) => s.symbol === 'TSLA');
      expect(added).toBeDefined();
      expect(added.quote).toBeDefined();
      expect(added.quote.currentPrice).toBe(195.0);
      expect(added.quote.change).toBe(-10.0);
      expect(added.quote.changePercent).toBe(-4.88);
    });

    it('should reject duplicate symbol in the same watchlist', async () => {
      const listRes = await request(app)
        .get('/api/v1/watchlists')
        .set('Authorization', `Bearer ${userToken}`);

      const watchlistId = listRes.body.data[0].id;

      await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/symbols`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ symbol: 'TSLA' });

      // Duplicate attempt
      const dupRes = await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/symbols`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ symbol: 'TSLA' });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);
    });

    it('should remove a symbol from watchlist', async () => {
      const listRes = await request(app)
        .get('/api/v1/watchlists')
        .set('Authorization', `Bearer ${userToken}`);

      const watchlistId = listRes.body.data[0].id;

      await request(app)
        .post(`/api/v1/watchlists/${watchlistId}/symbols`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ symbol: 'TSLA' });

      const delRes = await request(app)
        .delete(`/api/v1/watchlists/${watchlistId}/symbols/TSLA`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(delRes.status).toBe(200);
      const remaining = delRes.body.data.symbols.find((s: { symbol: string }) => s.symbol === 'TSLA');
      expect(remaining).toBeUndefined();
    });

    it('should create and delete a custom watchlist', async () => {
      const createRes = await request(app)
        .post('/api/v1/watchlists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Tech Growth',
          description: 'High-beta tech growth watchlist',
          initialSymbols: ['AAPL'],
        });

      expect(createRes.status).toBe(201);
      const customId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/watchlists/${customId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('2. Configurable Stock Alerts & Background Evaluation', () => {
    it('should create price, percentage, and volume alerts with validation', async () => {
      const priceAlertRes = await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          alertType: StockAlertType.PRICE_ABOVE,
          threshold: 230.0,
          cooldownMinutes: 30,
          notes: 'Sell target 1',
        });

      expect(priceAlertRes.status).toBe(201);
      expect(priceAlertRes.body.data.symbol).toBe('AAPL');
      expect(priceAlertRes.body.data.alertType).toBe('PRICE_ABOVE');
      expect(priceAlertRes.body.data.threshold).toBe(230.0);

      // Percentage movement alert
      const percentAlertRes = await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'TSLA',
          alertType: StockAlertType.PERCENT_CHANGE_DOWN,
          threshold: 4.0,
          cooldownMinutes: 60,
        });

      expect(percentAlertRes.status).toBe(201);
      expect(percentAlertRes.body.data.alertType).toBe('PERCENT_CHANGE_DOWN');
    });

    it('should reject invalid threshold values', async () => {
      const res = await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          alertType: StockAlertType.PRICE_ABOVE,
          threshold: -50,
        });

      expect(res.status).toBe(400);
    });

    it('should evaluate alerts, dispatch informational notifications, and enforce cooldown deduplication', async () => {
      // Create alert for AAPL above $230 (mock price is 230.5 -> condition MET)
      await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          alertType: StockAlertType.PRICE_ABOVE,
          threshold: 230.0,
          cooldownMinutes: 60,
        });

      // 1st Evaluation
      const alertService = StockAlertService.getInstance();
      const eval1 = await alertService.evaluateAllAlerts();

      expect(eval1.totalEvaluated).toBe(1);
      expect(eval1.totalTriggered).toBe(1);

      // Verify Informational Notification created
      const notifs = await Notification.find({ userId, type: NotificationType.STOCK_ALERT });
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toContain('AAPL Above $230.00');
      expect(notifs[0].message).toContain('AAPL is trading at $230.50');
      expect(notifs[0].actionUrl).toBe('/stocks?symbol=AAPL');

      // 2nd Evaluation immediately: MUST BE DEDUPLICATED (cooldown active, no spam!)
      const eval2 = await alertService.evaluateAllAlerts();
      expect(eval2.totalTriggered).toBe(0);

      // Notification count remains exactly 1
      const notifsAfter = await Notification.find({ userId, type: NotificationType.STOCK_ALERT });
      expect(notifsAfter.length).toBe(1);
    });

    it('should respect user notification preferences when stockAlertsEnabled is false', async () => {
      // Disable stock alerts in user preferences
      await User.findByIdAndUpdate(userId, {
        $set: { 'preferences.stockAlertsEnabled': false },
      });

      // Create alert for TSLA drop
      await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'TSLA',
          alertType: StockAlertType.PRICE_BELOW,
          threshold: 200.0,
        });

      const alertService = StockAlertService.getInstance();
      const evalResult = await alertService.evaluateAllAlerts();

      expect(evalResult.totalTriggered).toBe(0);
      const notifs = await Notification.find({ userId, type: NotificationType.STOCK_ALERT });
      expect(notifs.length).toBe(0);
    });

    it('should update and delete stock alerts', async () => {
      const createRes = await request(app)
        .post('/api/v1/stocks/alerts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          symbol: 'AAPL',
          alertType: StockAlertType.PRICE_ABOVE,
          threshold: 240.0,
        });

      const alertId = createRes.body.data._id;

      const updateRes = await request(app)
        .patch(`/api/v1/stocks/alerts/${alertId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          threshold: 245.0,
          isActive: false,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.threshold).toBe(245.0);
      expect(updateRes.body.data.isActive).toBe(false);

      const delRes = await request(app)
        .delete(`/api/v1/stocks/alerts/${alertId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(delRes.status).toBe(200);
    });
  });

  describe('3. Notifications & Preferences API Endpoints', () => {
    it('should list notifications, unread count, and mark as read', async () => {
      // Create sample notification
      await Notification.create({
        userId,
        title: 'Price Alert: AAPL Above $230.00',
        message: 'Informational message content',
        type: NotificationType.STOCK_ALERT,
        isRead: false,
      });

      const unreadRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(unreadRes.status).toBe(200);
      expect(unreadRes.body.data.unreadCount).toBe(1);

      const listRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.notifications.length).toBe(1);

      const notifId = listRes.body.data.notifications[0]._id;

      const markRes = await request(app)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.data.isRead).toBe(true);
    });

    it('should get and update notification preferences', async () => {
      const getPrefRes = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`);

      expect(getPrefRes.status).toBe(200);
      expect(getPrefRes.body.data.preferences.stockAlertsEnabled).toBe(true);

      const updatePrefRes = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          stockAlertsEnabled: false,
          minCooldownMinutes: 15,
        });

      expect(updatePrefRes.status).toBe(200);
      expect(updatePrefRes.body.data.preferences.stockAlertsEnabled).toBe(false);
      expect(updatePrefRes.body.data.preferences.minCooldownMinutes).toBe(15);
    });
  });
});
