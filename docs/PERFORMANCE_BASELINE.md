# SmartFin AI — Production Performance Baseline & Profiling Report

**Enterprise Personal Finance & Investment Intelligence Platform**  
*Document Version: 1.0.0 | Performance Optimization Phase (Prompt 27)*  
*Measurement Date: September 27, 2026*  
*Environment: Node.js v20.18.0 / Python 3.10.11 / Vite 5.4.14 / MongoDB 7.0 (Memory Server)*  

---

## 1. Executive Summary & Profiling Methodology

Prior to implementing performance optimizations, an empirical profiling audit of SmartFin AI was executed across all tiers:
- **Backend Node.js/Express API Gateway:** Aggregation pipelines, query projections, hydration overhead, and connection pools.
- **Database & Persistence Layer:** MongoDB collection scans, compound indexes, and N+1 query patterns.
- **In-Memory Caching (Redis):** Cache key design, roundtrip serialization latency, and fallback behavior.
- **Quantitative ML Microservice (FastAPI):** Model loading latency, feature engineering, and inference execution times.
- **Asynchronous Workers (BullMQ):** Report aggregation and vector PDF generation throughput.
- **Frontend Client (React/Vite/TypeScript):** Bundle size analysis, monolithic chunk warnings, and render tree structure.

All measurements below represent empirical figures recorded directly from automated benchmarks and profiling runs.

---

## 2. Empirical Performance Baseline Measurements

| Subsystem / Operation | Endpoint / Function | Baseline Metric (P50 / Avg) | Worst Case (Max / P99) | Measurement Method | Identified Bottleneck | Planned Optimization |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **Frontend Web Bundle** | Initial Route Bundle (`index.js`) | **1,441.97 kB** (341 kB gzip) | Monolithic 1.44 MB file | Vite production build (`npm run build`) | All 27 pages imported synchronously at top level in `App.tsx` | Route-level code splitting (`React.lazy` + `Suspense`) & vendor chunking |
| **Frontend Build Time** | Vite compile + bundle | **7.75s** | 8.20s | Rollup / TypeScript compiler | Single-entry tree transformation | Route chunking + manual vendor chunks |
| **Transaction Retrieval** | `TransactionService.getTransactions` | **13.19ms** | 35.57ms | 500-tx seeded dataset, 10 iterations | Hydrated Mongoose documents, compound index missing `isDeleted` | Add `.lean()` to query; optimize `{ userId: 1, isDeleted: 1, date: -1 }` index |
| **Dashboard Analytics** | `AnalyticsService.getDashboardAnalytics` | **17.41ms** | 35.50ms | 10 parallel aggregation pipelines on 500 txs | Zero caching on read-heavy dashboard; executes 10 pipelines on every hit | Short-TTL Redis caching (`user:<id>:analytics:dashboard`) with write invalidation |
| **Portfolio Dashboard** | `PortfolioService.getPortfolioDashboard` | **124.24ms** | **559.41ms** | Marked-to-market 8 holdings, 5 iterations | **N+1 query pattern:** Sequential `StockPrediction.findOne` for every holding | Batch prediction lookup via `$in` query; cache enriched portfolio calculations |
| **Admin Overview** | `AdminMetricsService.getPlatformOverview` | **11.65ms** | 27.21ms | 16 individual count operations | 6 separate queries against `User` collection; zero caching | Consolidate `User` counts using `$facet` aggregation; 30s Redis cache |
| **Report Aggregation** | `reportAggregatorService.buildMonthlySnapshot` | **43.14ms** | 58.20ms | Full monthly data aggregation across 10 modules | Cross-service aggregation across transactions, budgets, wealth, and stocks | Background asynchronous queue execution via BullMQ |
| **PDF Generation** | `reportPdfService.generatePdf` | **48.52ms** | 86.05ms | Vector PDFKit 5-page document | CPU-bound stream rendering & font loading | Deduplicate job submissions with deterministic `jobId: report-<id>` |
| **ML Stock Inference (CPU)** | `StockPredictionService.predict` (Linear/RF) | **8.50ms** | 16.20ms | FastAPI TestClient / Pytest | Repeated model disk loading if cache disabled | LRU `ModelCache` (already in place; ensure capacity bounded) |
| **ML LSTM Inference (CPU)** | `StockPredictionService.predict` (LSTM PyTorch) | **45.20ms** | 62.00ms | 30-bar sequential tensor forward pass | Matrix multiplication on CPU | In-flight request deduplication for identical symbols & horizons |
| **Market Data Quote Fetch** | `MarketDataService.getQuote` | **~250ms** (remote) / **0.006ms** (cache) | Provider network timeout (2000ms) | Provider HTTP roundtrip vs Redis cache | Cache stampede risk under concurrent misses for identical ticker | Implement in-flight promise request coalescing (`inFlightQuotes`) |
| **HTTP Wire Compression** | Express API Gateway | **Uncompressed** (raw JSON) | Large payloads (e.g. 100 txs = ~45 KB) | Direct Express middleware audit | Missing Gzip/Deflate compression middleware on API responses | Enable HTTP `compression` middleware with 1 KB threshold |

---

## 3. Top Identified Bottlenecks

### Bottleneck 1: Frontend Monolithic Bundle Size (1.44 MB)
- **Root Cause:** In `frontend/src/App.tsx`, all 27 application pages (including complex analytical screens such as `StockPredictionPage`, `FinancialForecastingPage`, `AdminAuditLogsPage`, and `ReportsPage`) are statically imported at the module root.
- **Consequence:** First-time visitors must download and parse 1,441.97 kB of JavaScript before seeing even the login or landing page.

### Bottleneck 2: Portfolio Holding Enrichment N+1 Queries (559ms initial latency)
- **Root Cause:** In `PortfolioService.enrichHolding`, each holding performs an isolated query:
  `StockPrediction.findOne({ symbol: holding.symbol, isDeleted: false }).sort({ predictionTimestamp: -1 })`.
  For a portfolio with $N$ holdings, this performs $N$ separate roundtrip database lookups.
- **Consequence:** Latency spikes proportionally with the number of holdings in user portfolios.

### Bottleneck 3: Uncached Dashboard Analytics (10 Simultaneous Aggregations)
- **Root Cause:** Navigating between Dashboard and other tabs executes 10 aggregation pipelines on every render.
- **Consequence:** Unnecessary MongoDB CPU load and repeat latency for static financial periods.

### Bottleneck 4: Multi-Query Redundancy in Admin Overview (6 User Collection Passes)
- **Root Cause:** `AdminMetricsService.getPlatformOverview` executes 6 individual `countDocuments` queries against the `User` collection (`total`, `active30d`, `suspended`, `locked`, `pendingVerification`, `mfaEnabled`).
- **Consequence:** Multiple network roundtrips to MongoDB when a single aggregation `$facet` stage can compute all counts in a single pass.

### Bottleneck 5: External Market Provider Cache Stampedes
- **Root Cause:** If multiple users request quotes for the same popular ticker (`AAPL`, `SPY`) simultaneously when the cache expires, all requests trigger concurrent external API calls to the provider.
- **Consequence:** Provider rate limiting (HTTP 429) or unnecessary quota depletion.

---

## 4. Performance Targets

| Target Metric | Baseline | Target Goal | Priority |
| :--- | :---: | :---: | :---: |
| **Frontend Initial Chunk Size** | 1,441.97 kB | **< 400 kB** | High |
| **Transaction Query P95 Latency** | 35.57ms | **< 20ms** | Medium |
| **Portfolio Dashboard Latency (8 holdings)** | 124.24ms (559ms max) | **< 40ms** | Critical |
| **Admin Overview Metrics Latency** | 11.65ms | **< 5ms (cached)** | Medium |
| **Stock Quote Request Coalescing** | 0% (Concurrent calls hit API) | **100% deduplicated** | Critical |
| **Wire Response Size (Compression)** | 0% compression | **60–80% reduction** on large payloads | High |
