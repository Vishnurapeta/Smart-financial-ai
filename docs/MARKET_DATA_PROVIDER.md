# SmartFin AI — Market Data Provider Architecture & Stock Integration

## 1. Overview & Architecture

SmartFin AI features an enterprise-grade stock market data subsystem designed with clean separation of concerns, high resiliency, and zero vendor lock-in.

The design strictly decouples market-data consumers from the upstream data feed through a pluggable abstraction layer:
- **`MarketDataProvider` (Interface)**: Defines the standardized contract for search, real-time quotes, and historical OHLCV data.
- **`MarketDataFactory`**: Dynamically instantiates the configured provider at runtime based on environment variables.
- **`MarketDataService`**: Manages Redis caching, provider fallback, rate-limit resilience, retry loops, and asynchronous persistence to the database (`StockPrice`).
- **`StockController` & Routes**: Exposes authenticated REST endpoints to the React client while ensuring third-party provider API keys are **never** exposed to the frontend.

```
                    ┌───────────────────────────┐
                    │    React Client (Vite)    │
                    │  (No API keys exposed)    │
                    └─────────────┬─────────────┘
                                  │ GET /api/v1/stocks/*
                                  ▼
                    ┌───────────────────────────┐
                    │   Stock Routes & Auth     │
                    │   Ownership / Rate Limit  │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │     MarketDataService     │
                    └──────┬─────────────┬──────┘
                           │             │
              Cache Hit?   │             │ Cache Miss
          ┌────────────────┘             └────────────────┐
          ▼                                               ▼
┌──────────────────┐                            ┌───────────────────┐
│   Redis Cache    │                            │ Provider Factory  │
│ (In-memory fall- │                            └─────────┬─────────┘
│  back if offline)│                                      │
└──────────────────┘                                      ▼
                                                ┌───────────────────┐
                                                │MarketDataProvider │
                                                │    Interface      │
                                                └────┬─────────┬────┘
                                                     │         │
                                  ┌──────────────────┘         └──────────────────┐
                                  ▼                                               ▼
                     ┌────────────────────────┐                     ┌────────────────────────┐
                     │  YahooFinanceProvider  │                     │    FinnhubProvider     │
                     │  (Default, zero-key)   │                     │ (Token-authenticated)  │
                     └────────────────────────┘                     └────────────────────────┘
```

---

## 2. Configuration & Environment Variables

All market data configuration resides in `backend/src/config/env.ts` and is documented in `backend/.env.example`.

| Variable | Type | Default | Description |
|---|---|---|---|
| `MARKET_DATA_PROVIDER` | string (`yahoo` \| `finnhub` \| `alphavantage` \| `twelvedata`) | `yahoo` | Selected market data feed provider |
| `MARKET_DATA_API_KEY` | string | `""` | Optional API token/key (required for `finnhub`, `alphavantage`, `twelvedata`) |
| `MARKET_DATA_TIMEOUT_MS` | number | `8000` | HTTP request timeout in milliseconds for market calls |
| `CACHE_STOCK_QUOTE_TTL_SEC` | number | `60` | Redis cache TTL for real-time stock quotes (1 min) |
| `CACHE_STOCK_HISTORY_TTL_SEC` | number | `300` | Redis cache TTL for historical OHLCV chart bars (5 min) |
| `CACHE_STOCK_SEARCH_TTL_SEC` | number | `1800` | Redis cache TTL for ticker search results (30 min) |

### Switching Providers
To switch providers, update the environment variable in your `.env` or deployment manifest:
```env
# Example 1: Yahoo Finance (default zero-key production provider)
MARKET_DATA_PROVIDER=yahoo

# Example 2: Finnhub (API token required)
MARKET_DATA_PROVIDER=finnhub
MARKET_DATA_API_KEY=your_finnhub_api_key_here
```

At runtime, `MarketDataService.getInstance().setProvider(newProvider)` can also be called dynamically during integration tests or live failovers.

---

## 3. Provider Abstraction Contract

The provider interface is defined in `backend/src/services/market-data/market-data.types.ts`:

```typescript
export interface MarketDataProvider {
  readonly providerName: string;

  /**
   * Search for stock tickers matching a text query
   */
  search(query: string): Promise<StockSearchResult[]>;

  /**
   * Fetch current quote including price, previous close, change, volume, 52W high/low
   */
  getQuote(symbol: string): Promise<MarketQuote>;

  /**
   * Fetch historical OHLCV candles
   */
  getHistory(symbol: string, range?: string, interval?: string): Promise<HistoricalDataResult>;
}
```

### Standard Normalized Data Models

#### `MarketQuote`
```typescript
export interface MarketQuote {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  timestamp: Date;
  provider: string;
}
```

#### `HistoricalBar` (OHLCV)
```typescript
export interface HistoricalBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

---

## 4. Implemented Providers

### A. `YahooFinanceProvider` (Default)
- **Status**: Production default, fully operational.
- **Key Requirement**: None (zero API key friction for development, testing, and production).
- **Features**:
  - Live quote parsing with real-time price, day high/low, open, previous close, volume, 52-week high, and 52-week low.
  - Ticker auto-complete search with exchange and asset type tagging.
  - Granular historical OHLCV chart bars supporting ranges (`1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `5y`, `max`) and intervals (`1m`, `5m`, `15m`, `1d`, `1wk`, `1mo`).
- **Resilience**:
  - Configurable timeouts (`AbortController` signal).
  - Exponential backoff retry loop (up to 2 retries with jitter).
  - Explicit rate limit (HTTP 429) detection and mapping.

### B. `FinnhubProvider`
- **Status**: Implemented for authenticated commercial tier.
- **Key Requirement**: Valid `MARKET_DATA_API_KEY` (`X-Finnhub-Token` header).
- **Features**: Real-time quote endpoint (`/api/v1/quote`), search endpoint (`/api/v1/search`), and stock candles (`/api/v1/stock/candle`). Exposes provider limitations cleanly when candle metrics or 52-week statistics are unavailable on free tiers.

### C. No Fake Data Policy & Clean Limitation Exposure
SmartFin AI enforces a **strict real-data policy**:
- Synthetic or randomized stock prices are never generated.
- If a ticker is invalid or unlisted on an exchange, the service responds with `NotFoundError` (`404 Stock symbol not found`).
- If upstream provider encounters an unrecoverable failure or rate limit, the service cleanly raises `BadGatewayError` (`502`) or `GatewayTimeoutError` (`504`) with actionable messages, rather than inventing misleading financial data.

---

## 5. Backend REST API Endpoints

All endpoints require JWT Bearer Authentication (`Authorization: Bearer <accessToken>`).

### 1. Stock Search
- **Method**: `GET /api/v1/stocks/search`
- **Query Params**: `q` (string, 1-50 chars)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NMS",
      "type": "EQUITY"
    }
  ]
}
```

### 2. Stock Quote
- **Method**: `GET /api/v1/stocks/:symbol/quote`
- **Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "currency": "USD",
    "price": 224.23,
    "previousClose": 222.77,
    "change": 1.46,
    "changePercent": 0.655,
    "dayOpen": 223.10,
    "dayHigh": 225.40,
    "dayLow": 222.50,
    "volume": 48210300,
    "fiftyTwoWeekHigh": 237.23,
    "fiftyTwoWeekLow": 164.08,
    "timestamp": "2026-09-27T11:00:00.000Z",
    "provider": "yahoo"
  }
}
```

### 3. Historical OHLCV Data
- **Method**: `GET /api/v1/stocks/:symbol/history`
- **Query Params**:
  - `range` (`1d` | `5d` | `1mo` | `3mo` | `6mo` | `1y` | `5y` | `max`, default: `1mo`)
  - `interval` (`1m` | `5m` | `15m` | `30m` | `60m` | `1d` | `1wk` | `1mo`, default: `1d`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "range": "1mo",
    "interval": "1d",
    "bars": [
      {
        "date": "2026-08-28",
        "timestamp": 1787889600,
        "open": 220.10,
        "high": 223.50,
        "low": 219.80,
        "close": 222.15,
        "volume": 52140000
      }
    ],
    "count": 22
  }
}
```

---

## 6. Caching & Resilience Strategy

### Two-Tier Hybrid Redis Cache
- **Primary Tier**: Redis cluster or standalone instance connected via `ioredis`. Keys are prefixed:
  - `stock:quote:{symbol}` (TTL: 60s)
  - `stock:history:{symbol}:{range}:{interval}` (TTL: 300s)
  - `stock:search:{query}` (TTL: 1800s)
- **Fallback Tier (`CacheManager`)**: If Redis is offline or undergoing maintenance, `CacheManager` gracefully falls back to an in-memory `Map` with automatic item expiration. Market requests never fail due to Redis unavailability.

### Persistence to MongoDB
Quotes fetched through `MarketDataService` are asynchronously persisted to the `StockPrice` MongoDB collection using `updateOne` with `upsert: true`. This builds up an internal audit trail of historical prices without adding latency to client responses.

---

## 7. Frontend Stock Intelligence Dashboard (`StocksPage`)

The frontend application includes a dedicated `/stocks` page:
- **Hero Ticker Header**: Live price, real-time dollar and percentage change with color badges, currency, and market status.
- **Quick-Access Ticker Pills**: Pre-populated with popular tickers (`AAPL`, `MSFT`, `NVDA`, `GOOGL`, `AMZN`, `TSLA`, `SPY`, `META`) for 1-click market inspection.
- **Search Auto-Suggest**: Interactive search input with debounced API lookup, exchange tags, and auto-dismiss dropdown.
- **6 Key Financial KPI Cards**:
  1. *Previous Close*
  2. *Day Open*
  3. *Day Range (Low - High)*
  4. *Volume (Formatted Millions / Billions)*
  5. *52-Week High*
  6. *52-Week Low*
- **Interactive Multi-Timeframe Charting**:
  - Timeframe selector buttons: `1D`, `5D`, `1M`, `3M`, `6M`, `1Y`, `5Y`.
  - Recharts `AreaChart` with gradient fill showing closing price trends.
  - Recharts `BarChart` synchronized with trading volume.
  - Rich custom tooltip showing Date, Close, Open, High, Low, and Volume.
- **Recent OHLCV Table**: Tabular view of the latest trading sessions with color-coded day direction badges.
- **Error & Loading States**: Skeletons during data loading, actionable error banners, and clean limitation alerts.

---

## 8. Watchlist Subsystem

The Watchlist subsystem allows users to organize and monitor tickers with live market feeds:
- **Default Watchlists**: Auto-provisions a benchmark watchlist upon first access.
- **Symbol Enrichment**: Every symbol in a watchlist is dynamically enriched with real-time price, previous close, daily dollar change, daily percentage change, volume, and 52-week statistics.
- **Target Prices**: Supports optional `targetBuyPrice` and `targetSellPrice` markers for visual target monitoring.
- **Endpoints**:
  - `GET /api/v1/watchlists`: List all user watchlists with enriched symbols.
  - `POST /api/v1/watchlists`: Create custom watchlist.
  - `POST /api/v1/watchlists/:id/symbols`: Add symbol to watchlist.
  - `DELETE /api/v1/watchlists/:id/symbols/:symbol`: Remove symbol.

---

## 9. Configurable Stock Alerts & BullMQ Background Evaluation

SmartFin AI features an asynchronous, distributed alert evaluation engine:

### A. Alert Trigger Conditions
1. `PRICE_ABOVE`: Current price crosses above user target ceiling.
2. `PRICE_BELOW`: Current price drops below user floor support.
3. `PERCENT_CHANGE_UP`: Daily momentum surge exceeds percentage threshold (+X%).
4. `PERCENT_CHANGE_DOWN`: Daily drawdown drop exceeds percentage threshold (-X%).
5. `VOLUME_ABOVE`: Trading volume surpasses threshold share count.

### B. BullMQ / Redis Background Worker Architecture
- **Queue**: `stock-alert-evaluation` running on BullMQ.
- **Worker**: Concurrently evaluates active alerts in batches, grouping alerts by symbol to minimize external API calls.
- **Resilient Fallback**: If Redis is offline or undergoing maintenance, evaluation seamlessly executes via synchronous in-memory worker fallback without dropping alerts.

### C. Anti-Spam Cooldown & Deduplication
To guarantee users are **never spammed**:
1. **Per-Alert Cooldown (`cooldownMinutes`)**: Users configure custom cooldown windows (15m, 30m, 1h, 4h, 24h). Default: 60 minutes; minimum: 5 minutes.
2. **Two-Tier Deduplication**:
   - Redis key `alert:cooldown:{alertId}` sets an automatic TTL cache lock upon trigger.
   - Persistent `lastTriggeredAt` timestamp check prevents notifications within the cooldown window even across worker restarts.
3. **User Preferences**: Users can toggle stock alerts globally (`preferences.stockAlertsEnabled: false`) or set minimum global cooldown caps.

### D. Informational Notifications
Triggered alerts generate informational notification records in MongoDB:
- Title: Clear description (e.g. `Price Alert: AAPL Above $230.00`)
- Message: Comprehensive status (e.g. `AAPL is trading at $230.50, surpassing your target threshold of $230.00. Day change: +$5.50 (+2.44%). Volume: 45.00M.`)
- Metadata: `{ alertId, symbol, alertType, threshold, currentPrice, changePercent, volume }`
- Direct action link: `/stocks?symbol={symbol}`

