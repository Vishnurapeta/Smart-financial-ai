# SmartFin AI — Financial Forecasting Subsystem (Expenses & Cash-Flow)

**Document Version:** 1.0.0  
**Status:** Production Ready  
**Component:** Personal Finance Time-Series Intelligence

---

## 1. Executive Summary & Objective

The **Financial Forecasting Subsystem** provides predictive visibility into future personal expenditures, cash inflows, and net liquidity without fabricating artificial figures or suffering from time-series look-ahead bias.

### Key Capabilities
1. **Expense Forecasting**: Out-of-sample forward projections of total monthly expenditures and individual category budgets ($h=1, 3, 6$ months).
2. **Cash-Flow Forecasting**: Multi-period synthesis of projected cash inflows, expected outflows, planned savings/investment contributions, and resulting net cash-flow position.
3. **Decomposition**: Separation of non-negotiable **fixed recurring obligations** (rent, EMIs, utilities, subscriptions) from **discretionary variable spending**.
4. **Data Sufficiency & Transparency**: Refusal to fabricate numbers when transaction history is sparse ($< 3$ months); models are clearly labeled as probabilistic estimates, not financial guarantees.
5. **Leakage Prevention**: Strictly backward-looking features, chronological holdout validation, and walk-forward verification.
6. **Strict Baseline Benchmark**: Moving Average baselines ($w=3, 6$) serve as the default production champions. Advanced machine learning models (Linear Regression, Random Forest, XGBoost) are only promoted to production if they demonstrate strictly superior out-of-sample holdout performance.

---

## 2. High-Level Architecture & Data Flow

```
[ Authenticated User / React Dashboard ]
                  │
                  ▼ (JWT Bearer Token)
[ Express API Gateway (Node.js) ]
   ├── Authentication & Ownership Guard (req.user.userId)
   ├── MongoDB Transaction & Recurring Queries
   ├── Data Sanitization (Transfer exclusion, deduplication)
   └── Time Aggregation (Monthly chronological series)
                  │
                  ▼ (Service-to-Service Secret Token)
[ FastAPI ML Forecasting Microservice (Python 3.10) ]
   ├── Data Sufficiency Validation (N >= 3 months)
   ├── Feature Pipeline (lag_1, lag_2, lag_3, rolling_mean_3, trend, quarter)
   ├── Candidate Models:
   │    ├── 3-Month Moving Average (Baseline Champion)
   │    ├── 6-Month Moving Average
   │    ├── Holt Linear Exponential Smoothing
   │    ├── Ridge / Linear Regression
   │    ├── Random Forest Regressor
   │    └── XGBoost Regressor
   ├── Chronological Holdout Evaluator (MAE, RMSE, MAPE, R²)
   ├── Multi-Period Forward Predictor (h=1, 3, 6 months)
   └── Cash-Flow Synthesis Engine (Income - Expenses - Contributions)
                  │
                  ▼
[ Express API Gateway ]
   ├── MongoDB Audit Persistence (FinancialForecast Model)
   └── JSON Response Envelope
                  │
                  ▼
[ React Forecasting Dashboard (/forecasting) ]
   ├── Metric Summary Cards (Expected Inflow, Outflow, Net Flow)
   ├── Recharts Trajectory (Solid Historical vs Dashed Forecast + Bounds)
   ├── Multi-Bar Liquidity Composition
   ├── Category Breakdown with Sufficiency Badges
   ├── Fixed vs. Variable Ratio Breakdown
   └── Regulatory Disclaimer
```

---

## 3. User Data Isolation & Security

User data isolation is enforced at every layer:
1. **Node.js Gateway Layer**: The endpoint extracts `userId` directly from verified JWT claims (`req.user.userId`). Any user-supplied `user_id` in request parameters or bodies is ignored.
2. **Database Query Layer**: All queries to MongoDB (`Transaction`, `RecurringExpense`, `FinancialGoal`, `FinancialForecast`) include `{ userId: userObjectId, isDeleted: false }`.
3. **Cross-Tenant Attack Prevention**: User B cannot query or trigger forecasts for User A. Integration tests in `backend/tests/forecasting.test.ts` verify that User B receives zero data / insufficient data when querying concurrently with User A.
4. **Service-to-Service Boundary**: Requests between Node.js and FastAPI include `Authorization: Bearer ${ML_SERVICE_SECRET_TOKEN}`.

---

## 4. Data Preprocessing & Cleaning Pipeline

The preprocessing pipeline cleans historical records before feature generation:
1. **Duplicate Elimination**: Detects duplicate transactions matching `(date, amount, merchant)` within the same calendar window.
2. **Transfer Exclusion**: Transactions categorized as `TransactionType.TRANSFER` are strictly excluded to avoid double-counting internal balance reallocations.
3. **Refund / Invalidation Handling**: Negative or zero amounts are filtered out.
4. **Monthly Time Bucketing**: Transactions are aggregated into calendar months (`YYYY-MM`).
5. **Recurring Normalization**: Active recurring items (`RecurringExpense`) are converted to monthly equivalents:
   - `DAILY`: $\times 30.416$
   - `WEEKLY`: $\times 4.333$
   - `BIWEEKLY`: $\times 2.166$
   - `MONTHLY`: $\times 1.0$
   - `QUARTERLY`: $/ 3.0$
   - `ANNUALLY`: $/ 12.0$

---

## 5. Feature Engineering & Leakage Prevention

To ensure zero look-ahead bias, feature row $t$ is computed using only data from $t-1, t-2, t-3$:

| Feature | Mathematical Definition | Purpose |
|---|---|---|
| `lag_1` | $y_{t-1}$ | Immediate prior month expense |
| `lag_2` | $y_{t-2}$ | Two-month prior expense |
| `lag_3` | $y_{t-3}$ | Quarterly baseline lag |
| `rolling_mean_3` | $\frac{1}{3} \sum_{i=1}^3 y_{t-i}$ | Short-term smoothed spending baseline |
| `rolling_std_3` | $\sqrt{\frac{1}{3} \sum_{i=1}^3 (y_{t-i} - \bar{y})^2}$ | Spending volatility / variance indicator |
| `trend_idx` | Integer index $t \in [0, N)$ | Secular growth or reduction trend |
| `month_of_year` | $m \in [1, 12]$ | Annual calendar seasonality |
| `quarter` | $q \in [1, 4]$ | Seasonal quarterly clustering |

---

## 6. Model Suite & Selection Strategy

### 6.1 Candidate Models
1. **3-Month Moving Average (Primary Baseline)**:
   $$\hat{y}_{t+h} = \frac{1}{3} \sum_{i=1}^3 y_{t+h-i}$$
2. **6-Month Moving Average**: Smooth medium-term baseline.
3. **Exponential Smoothing (Holt Linear Trend)**: Level and trend decomposition with recursive smoothing parameters $\alpha=0.4, \beta=0.2$.
4. **Linear Regression**: Multivariable regression on lag, trend, and calendar quarters.
5. **Random Forest Regressor**: 30 trees, max depth 4, random state 42.
6. **XGBoost Regressor**: 30 estimators, max depth 3, learning rate 0.08.

### 6.2 Selection Rule
- **The Baseline is the Default Champion**: In personal finance, series are often short and volatile.
- **Strict Out-of-Sample Proof**: An ML model is only chosen if its holdout validation MAE and RMSE are strictly lower than the Moving Average baseline.
- **Short History Protection**: For datasets with $< 6$ months, ML models are pruned to avoid overfitting, and moving average baselines are retained.

---

## 7. Cash-Flow & Liquidity Forecasting Engine

Cash-flow forecasting synthesizes income, expenses, and planned investments:
$$\text{Projected Net Cash Flow} = \text{Expected Income} - \text{Expected Expenses} - \text{Planned Contributions}$$

### Breakdown:
- **Expected Income**: Projected from historical income stability using moving average baseline.
- **Expected Expenses**: Modeled by the selected champion expense forecaster.
- **Fixed vs. Variable Split**: Fixed commitments floor $\min(\text{Recurring Total}, \text{Forecast})$. Variable discretionary outflow is the remainder.
- **Planned Contributions**: Sum of monthly auto-contributions for active `FinancialGoal` records.
- **Deficit Flag**: Triggered if $\text{Projected Net Cash Flow} < 0$.

---

## 8. API Specification

### 8.1 Express API Gateway (Node.js)

#### 1. Expense Forecast
- **Route**: `GET /api/v1/forecasts/expenses`
- **Auth**: Bearer JWT (Required)
- **Query Parameters**:
  - `horizon`: `1`, `3`, or `6` (Default: `3`)
  - `frequency`: `'monthly'`
  - `category`: Category name or `'all'`
  - `preferredModel`: Optional model preference override

#### 2. Cash-Flow Forecast
- **Route**: `GET /api/v1/forecasts/cash-flow`
- **Auth**: Bearer JWT (Required)
- **Query Parameters**:
  - `horizon`: `1`, `3`, or `6` (Default: `3`)
  - `frequency`: `'monthly'`

#### 3. Forecast History
- **Route**: `GET /api/v1/forecasts/history`
- **Auth**: Bearer JWT (Required)
- **Query Parameters**:
  - `type`: `'expense'` or `'cash_flow'`
  - `limit`: Integer (Default: 20)

### 8.2 FastAPI Microservice (Python)

- `POST /api/v1/forecasts/expenses`
- `POST /api/v1/forecasts/cash-flow`
- `GET /api/v1/forecasts/models`

---

## 9. Frontend Architecture (`/forecasting`)

Located at route `/forecasting` within the main application navigation:
- **`ForecastSummaryCards`**: Expected Inflow, Expected Outflow, Planned Savings, Projected Net Flow (with Surplus % or Deficit Risk badge).
- **`ExpenseForecastChart`**: Recharts composed chart showing solid historical line, dashed forecast line, and "Forecast Begins" boundary reference line.
- **`CashFlowForecastChart`**: Multi-bar chart contrasting Inflow, Outflow, Savings, and Net Cash Flow line.
- **`CategoryForecastBreakdown`**: Category progress cards with data sufficiency status (`eligible` vs `<3M History`).
- **`RecurringCommitmentsSection`**: Ratio breakdown of fixed commitments vs variable spending.
- **`ForecastModelInfoCard`**: Model specifications, selection rationale, and holdout cross-validation benchmarking table.
- **`DataSufficiencyBanner`**: Clear informative state when transaction history $< 3$ months.
- **`ForecastDisclaimer`**: Regulatory and transparency disclosure.

---

## 10. Audit & Model Drift Tracking

Every forecast generated is persisted in MongoDB collection `financialforecasts`:
- Stores user ID, forecast period, predicted values, model metadata, and holdout metrics.
- As actual transaction data arrives in future months, scheduled evaluation jobs compute the actual outcome error:
  $$\text{Error} = \text{Actual Outflow} - \text{Predicted Outflow}$$
- Provides a clean extension point for future model retraining triggers.
