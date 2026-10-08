# Production Automated Financial Reporting System

## 1. Overview & Architecture

The SmartFin Financial Reporting System is an enterprise-grade reporting and analytical engine that generates professional periodic financial reports. The primary report is the **Monthly Financial Report**, which consolidates historical cash flows, balance sheets, recurring commitments, investment portfolios, predictive machine learning models, and anomaly insights into an immutable data snapshot and multi-page vector PDF.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Financial Domain Services                       │
│  Transactions • Wealth/Net Worth • Budgets • Goals • Portfolio • ML    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Report Aggregator Service                           │
│     buildMonthlySnapshot(userId, year, month) [Single Source of Truth] │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Immutable Report Snapshot                         │
│       Saved to MongoDB with Report Versioning & Strict Ownership       │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────────┐   ┌──────────────────────────────┐
│       Vector PDF Generator          │   │  Notification / Email System │
│   Pure Node.js PDFKit (5 Pages)     │   │ Prompt 21 Template Engine    │
└───────────────────┬─────────────────┘   └──────────────┬───────────────┘
                    │                                    │
                    ▼                                    ▼
          In-App Download Stream                 Multi-Channel Delivery
```

---

## 2. Report Lifecycle & Status State Machine

```
              ┌─────────┐
              │ PENDING │
              └────┬────┘
                   │  BullMQ Queue Worker Pick-up
                   ▼
             ┌────────────┐
             │ GENERATING │
             └─────┬──────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌─────────┐   ┌──────────────────────────┐
    │  READY  │   │  READY_WITH_LIMITATIONS  │
    └─────────┘   └──────────────────────────┘
         ▲                   ▲
         │ (if any failures) │
         └─────────┬─────────┘
                   │
                   ▼
              ┌─────────┐
              │ FAILED  │
              └─────────┘
```

1. **PENDING**: The report record is created and enqueued into BullMQ (`financial-report-processing`).
2. **GENERATING**: The worker picks up the job, emits `report:generating` to the authenticated user via Socket.IO, aggregates domain data, and generates the vector PDF.
3. **READY**: All data sources and documents were generated successfully.
4. **READY_WITH_LIMITATIONS**: Generated successfully, but external services (such as live stock market quotes, forward predictive ML services, or forecasting) were temporarily unavailable. Missing data is labeled with controlled fallback messages rather than crashing the report.
5. **FAILED**: An unrecoverable database or filesystem error occurred. Error message is recorded on the report document and emitted via `report:failed`.

---

## 3. Single Source of Truth & Data Integration

The reporting service does not independently implement duplicate financial math. All data is gathered directly from authoritative application services:

| Domain Metric | Source of Truth | Aggregation Method |
|---|---|---|
| **Income & Outflow** | `Transaction` Model | Aggregated by `TransactionType.INCOME` and `TransactionType.EXPENSE` within UTC period boundaries |
| **Category Breakdown** | `Category` & `Transaction` | MongoDB `$group` on `$category`, sorted by volume with percentage of total expense |
| **Recurring Commitments** | `RecurringExpense` | Filtered for `isActive: true` with `nextDueDate` projection |
| **Subscriptions** | `Subscription` | Filtered for `status: ACTIVE` with annual-to-monthly pro-rating |
| **Financial Goals** | `FinancialGoal` | Percentage completion `(current / target) * 100`, remaining balances, target dates |
| **Net Worth** | `Asset` & `Liability` | Sum of active assets minus liabilities, delta compared with previous net worth |
| **Portfolio & Holdings** | `Portfolio` & `Holding` | Cost basis (`totalCost`), market value (`currentValue`), unrealized P&L and % returns |
| **Live Stock Quotes** | `MarketDataService` | Real-time quote polling with timeout and resilient catch fallback |
| **Stock Predictions** | `StockPrediction` | Machine learning model outputs, prediction horizon, RMSE metrics |
| **Expense & Cash-Flow** | `FinancialForecast` | Forecast period projections, SARIMAX model confidence scores |
| **Anomalies** | `FinancialAnomaly` | Spending deviation counts, affected categories, and transaction details |

---

## 4. Deterministic Financial Calculations

### 4.1 Savings & Savings Rate
$$\text{Savings} = \text{Total Income} - \text{Total Expenses}$$

$$\text{Savings Rate} = \begin{cases} \left(\frac{\text{Savings}}{\text{Total Income}}\right) \times 100 & \text{if } \text{Total Income} > 0 \\ \text{null } (\text{"Not available"}) & \text{if } \text{Total Income} \le 0 \end{cases}$$

- **Negative Savings**: When expenses exceed income, negative savings are preserved (e.g. $-\$5,000.00$) and negative savings rates are formatted accurately (e.g. $-6.7\%$).
- **Zero Income**: Never results in division by zero (`NaN` or `Infinity`); explicitly formatted as `"Not available"`.

### 4.2 Monthly Burn Rate
Calculated in strict alignment with the SmartFin Dashboard KPI definition:
$$\text{Burn Rate} = \max(0, \text{Total Expenses})$$
Documented as: *"Monthly operational cash outflow representing total recurring & discretionary spending during the period."*

---

## 5. Stock Prediction Safety & Compliance

1. **Mandatory Labeling**: Every prediction metric is explicitly tagged as **"Model estimate"** or **"Model forecast"**.
2. **Reproducibility Metadata**: Every forecast displays:
   - Model name (e.g., `XGBoost`, `Ensemble`)
   - Model version (e.g., `v1.4`)
   - Feature version (e.g., `v1.0`)
   - Historical evaluation metric (e.g., `RMSE: 0.05`)
   - Prediction horizon (e.g., `30D`)
3. **Strict Non-Advisory Guardrails**: The report engine never outputs advice or imperative commands (no *"Buy"*, *"Sell"*, or *"Guaranteed to rise"*).
4. **Mandatory Disclaimer**:
   > *"Model forecasts are statistical estimates based on historical market prices and do not constitute investment advice or guarantee future performance."*

---

## 6. Vector PDF Generation Engine

PDF generation is powered by `pdfkit` running natively inside Node.js without requiring headless Chromium browsers:

- **Vector Graphics & Fintech Layouts**: Multi-page report with consistent margins, headers, page numbers, and corporate branding.
- **Dynamic Content Flow**: Scorecard grids, category tables with percentage progress bars, portfolio holding summaries, and disclaimers.
- **Page Overflow Management**: Automatic page breaks with consistent header and footer branding across all pages.
- **Safety**: Pure streaming avoids in-memory buffering bottlenecks for large reports.

---

## 7. BullMQ Background Processing & High Availability

- **Queue Name**: `financial-report-processing`
- **Worker Concurrency**: 2 concurrent report generation jobs per worker process.
- **Redis Offline Fallback**: If Redis is temporarily unreachable, `FinancialReportService` executes the calculation and PDF generation synchronously in-process without losing user requests.
- **Real-Time Notification**: Socket.IO events (`report:generating`, `report:ready`, `report:failed`) are emitted to the `user:${userId}` room.
- **Multi-Channel Email**: When `sendEmail: true` is requested, the Prompt 21 `EmailChannel` dispatches a formatted HTML summary to the user's verified email address.

---

## 8. Security & Access Control

1. **Authentication**: All report routes require valid JWT bearer tokens.
2. **IDOR & User Isolation**: All database lookups strictly query `{ _id: reportId, userId: authenticatedUserId, isDeleted: false }`. Requests for other users' reports return `404 Not Found`.
3. **No Untrusted Email Parameters**: Report delivery emails are exclusively routed to the authenticated user's verified profile email.
4. **Rate Limiting**: `reportRateLimiter` restricts users to 30 generation/export requests per 15-minute window in production.
5. **PDF File Security**: Internal filesystem paths are never leaked to the public API; downloads use authenticated streaming endpoints.
