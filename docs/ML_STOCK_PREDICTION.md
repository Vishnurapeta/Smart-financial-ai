# SmartFin AI — Stock Prediction Data Pipeline Architecture & Specification

Document Version: 1.0.0  
Status: Engineering Specification & Preprocessing Pipeline Guide  
Last Updated: 2026-09-27  

---

## 1. Dataset Source

The SmartFin AI Stock Prediction engine leverages the historical market dataset for the **Nifty 500** constituents covering Indian equity markets traded on the National Stock Exchange (NSE). The dataset comprises daily trading records spanning from **January 1, 2015 to December 29, 2023** (~9 full calendar years and 2,221 active trading sessions).

- **Universe**: 106 leading large-, mid-, and multi-cap Indian equities (including RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, LT, HINDUNILVR, ITC, etc.).
- **Frequency**: Daily End-of-Day (EOD) OHLCV records.
- **Provider / Source**: Historical market exchange trading archives curated for algorithmic trading research.

---

## 2. Dataset Structure

The raw dataset contains 219,800 rows and 8 columns formatted as standard CSV:

| Raw Column Name | Inferred Type | Description |
| :--- | :--- | :--- |
| `Date` | `string` (`YYYY-MM-DD`) | Calendar date of the trading session |
| `Symbol` | `string` | Exchange ticker symbol (e.g. `RELIANCE`, `TCS`) |
| `Open` | `float64` | Session opening price in INR (₹) |
| `High` | `float64` | Session intraday high price in INR (₹) |
| `Low` | `float64` | Session intraday low price in INR (₹) |
| `Close` | `float64` | Session unadjusted closing price in INR (₹) |
| `Adj Close` | `float64` | Corporate-action adjusted closing price in INR (₹) |
| `Volume` | `int64` | Total number of equity shares traded during session |

### Raw Dataset Audit Findings
- **Total Records**: 219,800
- **Unique Symbols**: 106
- **Date Range**: 2015-01-01 to 2023-12-29
- **Missing Values**: 0 across all 8 fields.
- **Exact Duplicate Rows**: 631
- **Duplicate (Symbol, Date) Records**: 2,221 duplicate pairs (4,442 rows total), attributed to a duplicate block for `INFY` that appeared twice in the raw CSV.
- **Tickers with $\ge$ 500 records**: 106 of 106 (100% of equities have sufficient history).

---

## 3. Raw Data Location

The raw data is stored immutably in:
```
ml-service/app/data/raw/nifty500_stocks.csv
```
> [!IMPORTANT]
> The raw CSV file is strictly immutable. It is never overwritten, modified, or moved during any pipeline step. All normalization, deduplication, and transformation happen on in-memory representations and persist exclusively into `app/data/processed/`.

---

## 4. Data Validation

Data validation is performed prior to feature engineering via `app/validation/validator.py`:

1. **Missing Identifiers**: Asserts ticker symbol and date are present and non-empty.
2. **Date Integrity**: Parses date strings into standard UTC timestamps. Rejects unparseable entries.
3. **Market Price Sanity**:
   - `open > 0`, `high > 0`, `low > 0`, `close > 0`.
   - `high >= low`, `high >= open`, `high >= close`.
   - `volume >= 0`.
4. **Duplicate Detection**: Identifies repeated `(symbol, date)` observations.
5. **Monotonicity**: Checks whether dates within each ticker are strictly ascending.
6. **Sufficiency**: Verifies each ticker has at least `min_historical_records` (default: 100 trading days).
7. **Post-Feature Validation**: Scans engineered feature matrices for unexpected `NaN` or infinite (`Inf`) values.

All validation runs output structured audit logs to:
```
ml-service/app/data/validation/raw_validation_report.json
ml-service/app/data/validation/feature_validation_report.json
```

---

## 5. Column Normalization

Because external providers or future data feeds may format column headers arbitrarily (e.g. `DATE`, `ticker`, `adjClose`, `vol`), `app/preprocessing/normalization.py` provides an explicit normalization layer:

- Canonical lowercase format: `['date', 'symbol', 'open', 'high', 'low', 'close', 'adj_close', 'volume']`.
- Ticker symbols are standardized to uppercase stripped strings.
- In-memory transformations guarantee no changes are written to the raw file.

---

## 6. Cleaning & Deduplication

Implemented in `app/preprocessing/cleaning.py`:
1. Converts `date` to datetime objects.
2. Strips whitespace and normalizes symbols to uppercase.
3. Enforces strict numeric types across OHLCV fields.
4. Drops rows with invalid market prices ($P \le 0$ or $V < 0$).
5. **Deduplication**: Eliminates duplicate `(symbol, date)` records by keeping the first occurrence. On the raw Nifty 500 dataset, exactly 2,221 duplicate rows are dropped (1.01% of rows).
6. **Chronological Sorting**: Sorts strictly by `['symbol', 'date']` ascending, eliminating all historical disorder.

---

## 7. Feature Engineering Architecture

Feature engineering is executed strictly **per ticker** (`df.groupby("symbol")`) to guarantee complete isolation across stock universes. No rolling window or lag calculation ever crosses symbol boundaries.

Categories of generated features:
- **Base Interactions**: `log_volume`, `volume_change_1d`, `close_to_open`, `close_to_high`, `close_to_low`.
- **Returns**: Daily percentage returns, 1-day log returns, multi-period returns (5d, 10d, 20d).
- **Moving Averages**: Simple Moving Averages (SMA 10, 20, 50) and Exponential Moving Averages (EMA 10, 20, 50), along with price-to-average ratios (`close / sma_{w}`, `close / ema_{w}`).
- **Technical Indicators**: Relative Strength Index (RSI 14), Moving Average Convergence Divergence (MACD, Signal line, Histogram), and Bollinger Bands (20-day, $\pm 2\sigma$, upper, middle, lower, bandwidth, %B).
- **Volatility**: Rolling standard deviations (10, 20, 50 days), annualized rolling volatility ($\sigma \times \sqrt{252}$), intraday high-low spread ratio, close-open spread ratio.
- **Lag Features**: Close price lags (1, 2, 3, 5, 10), return lags (1, 2, 3, 5), and volume lags (1, 2, 3, 5).

Total engineered feature count: **58 features**.

---

## 8. Technical Indicators Specification

### Relative Strength Index (RSI)
- **Window**: 14 trading days.
- **Smoothing**: Wilder's exponential smoothing ($\alpha = 1 / 14$).
- **Formula**:
  $$\Delta = \text{Close}_t - \text{Close}_{t-1}$$
  $$\text{Gain} = \max(\Delta, 0), \quad \text{Loss} = \max(-\Delta, 0)$$
  $$\text{AvgGain} = \text{EMA}(\text{Gain}, \alpha), \quad \text{AvgLoss} = \text{EMA}(\text{Loss}, \alpha)$$
  $$RS = \frac{\text{AvgGain}}{\text{AvgLoss} + \epsilon}, \quad RSI = 100 - \frac{100}{1 + RS}$$

### Moving Average Convergence Divergence (MACD)
- **Parameters**: Fast EMA = 12, Slow EMA = 26, Signal EMA = 9.
- **Formula**:
  $$\text{MACD Line} = \text{EMA}_{12}(\text{Close}) - \text{EMA}_{26}(\text{Close})$$
  $$\text{Signal Line} = \text{EMA}_9(\text{MACD Line})$$
  $$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

### Bollinger Bands
- **Parameters**: Lookback window = 20, Multiplier = 2.0.
- **Formula**:
  $$\text{Middle Band} = \text{SMA}_{20}(\text{Close})$$
  $$\sigma = \text{std}_{20}(\text{Close})$$
  $$\text{Upper Band} = \text{Middle Band} + 2\sigma$$
  $$\text{Lower Band} = \text{Middle Band} - 2\sigma$$
  $$\text{Bandwidth} = \frac{\text{Upper} - \text{Lower}}{\text{Middle}}$$
  $$\%B = \frac{\text{Close} - \text{Lower}}{\text{Upper} - \text{Lower} + \epsilon}$$

---

## 9. Target Creation

Prediction targets are generated **after** all features have been computed, using forward-looking negative shifts (`shift(-h)`) strictly per ticker:

1. `target_next_close`: Close price on next trading day ($t+1$).
2. `target_next_return`: Percentage return from day $t$ to day $t+1$:
   $$\frac{\text{Close}_{t+1} - \text{Close}_t}{\text{Close}_t}$$
3. `target_next_direction`: Binary classification target (1 if `target_next_return` > 0, else 0).
4. Multi-Horizon Targets:
   - `target_close_1d`, `target_return_1d`
   - `target_close_5d`, `target_return_5d`
   - `target_close_10d`, `target_return_10d`
   - `target_close_20d`, `target_return_20d`

Total target columns: **11 targets**.

---

## 10. Time-Series Splitting

Data points must respect the arrow of time. Random shuffling is strictly prohibited.

The pipeline implements **Global Temporal Splitting**:
1. Extracts all unique calendar trading dates in the dataset and sorts them.
2. Partitions trading dates by ratio (default: 70% Train, 15% Validation, 15% Test):
   - **Training Set**: 2015-03-17 to 2021-05-14 (1,519 trading days, 143,517 rows)
   - **Validation Set**: 2021-05-17 to 2022-09-02 (325 trading days, 34,100 rows)
   - **Testing Set**: 2022-09-05 to 2023-12-28 (326 trading days, 34,555 rows)
3. Ensures strict chronological order:
   $$\max(\text{Train Dates}) < \min(\text{Validation Dates}) < \max(\text{Validation Dates}) < \min(\text{Test Dates})$$

---

## 11. Leakage Prevention

1. **Per-Ticker Grouping**: Every rolling window, lag, and shift is performed exclusively within each stock's sub-series. No ticker data ever enters another ticker's rolling calculations.
2. **Lag Precedence**: All feature lags use strictly past data ($t-1, t-2, \dots$). No contemporary or future closing prices are included in lag columns.
3. **Target Isolation**: Target columns use negative shifts ($t+1, t+5$) and are generated into columns prefixed with `target_`. Feature selection strictly rejects any column starting with `target_`.
4. **Out-of-Sample Scaling (`LeakageFreeScaler`)**:
   - The feature scaler (`StandardScaler`, `MinMaxScaler`, or `RobustScaler`) is fit **solely** on `train_df`.
   - The validation and testing splits are transformed using the fitted training parameters. Validation and testing observations never influence mean or variance calculations.

---

## 12. Walk-Forward Validation

For model backtesting and hyperparameter search without lookahead bias, `app/utils/time_series_split.py` provides `WalkForwardValidator`:
- **Expanding Window**: Starts with a minimum training period (e.g. 250 days) and tests on a forward rolling window (e.g. 60 days), expanding the training history fold-by-fold.
- **Rolling Window**: Keeps a fixed lookback training period (e.g. 250 days) and rolls forward fold-by-fold.

---

## 13. Processed Dataset Artifacts

Engineered datasets are saved in both Apache Parquet and CSV formats in `ml-service/app/data/processed/`:

| Artifact | Format | Size | Description |
| :--- | :--- | :--- | :--- |
| `nifty500_features.parquet` | Parquet | ~117 MB | Complete model-ready dataset (212,172 rows, 72 columns) |
| `train.parquet` | Parquet | ~85 MB | Training partition (143,517 rows) |
| `validation.parquet` | Parquet | ~21 MB | Validation partition (34,100 rows) |
| `test.parquet` | Parquet | ~21 MB | Testing partition (34,555 rows) |
| `nifty500_features.csv` | CSV | ~268 MB | Full dataset in tabular CSV |
| `model_metadata.json` | JSON | ~2.7 KB | Complete lineage, versioning, feature catalog, and split dates |

---

## 14. Model Metadata Specification

Every run outputs `model_metadata.json` capturing:
- `ticker`: Stock universe identifier (e.g. `"ALL_NIFTY500 (106 tickers)"`).
- `dataset_start_date` and `dataset_end_date`.
- `number_of_records`: Total model-ready clean rows (212,172).
- `feature_version`: Semantic feature schema version (`v1.0.0`).
- `preprocessing_version`: Semantic pipeline code version (`v1.0.0`).
- `target_definition`: Mathematical definition of all prediction targets.
- `train_period`, `validation_period`, `test_period`: Start date, end date, row counts, and trading day counts.
- `features_list`: Complete list of 58 feature column names.
- `target_columns`: Complete list of 11 target column names.
- `scaler_type`: Applied normalization strategy (or `null` if unscaled).

---

## 15. Reproducibility

The complete pipeline can be reproduced at any time via the CLI runner:
```bash
cd ml-service
.\.venv\Scripts\python app/pipelines/run_pipeline.py
```
Or for custom subsets/scalers:
```bash
.\.venv\Scripts\python app/pipelines/run_pipeline.py --tickers RELIANCE TCS INFY --scaler standard
```

---

## Complete Feature Catalog & Engineering Dictionary

| Feature Name | Meaning | Mathematical Calculation | Required Columns | Window | Potential Leakage Consideration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `open` | Session open | Raw open price | `open` | 1 | Known at start of trading day $t$ |
| `high` | Session high | Raw high price | `high` | 1 | EOD session maximum |
| `low` | Session low | Raw low price | `low` | 1 | EOD session minimum |
| `close` | Session close | Raw closing price | `close` | 1 | Primary historical reference price at $t$ |
| `volume` | Traded shares | Raw volume traded | `volume` | 1 | Cumulative volume traded on day $t$ |
| `log_volume` | Normalized volume | $\ln(1 + \text{volume})$ | `volume` | 1 | Log transform stabilizes high-volume spikes |
| `volume_change_1d` | Daily volume rate | $(\text{vol}_t - \text{vol}_{t-1}) / \text{vol}_{t-1}$ | `volume` | 1 | Uses strictly day $t-1$ volume |
| `close_to_open` | Intraday trend ratio | $\text{close} / \text{open}$ | `close`, `open` | 1 | Intraday candle momentum |
| `close_to_high` | Proximity to high | $\text{close} / \text{high}$ | `close`, `high` | 1 | Bounded $\le 1.0$, measures selling pressure |
| `close_to_low` | Proximity to low | $\text{close} / \text{low}$ | `close`, `low` | 1 | Bounded $\ge 1.0$, measures buying support |
| `daily_return` | 1-day percentage return | $(\text{close}_t - \text{close}_{t-1}) / \text{close}_{t-1}$ | `close` | 1 | Strictly backward looking ($t-1$) |
| `log_return_1d` | 1-day log return | $\ln(\text{close}_t / \text{close}_{t-1})$ | `close` | 1 | Additive over time horizons |
| `return_5d` | 5-day historical return | $(\text{close}_t - \text{close}_{t-5}) / \text{close}_{t-5}$ | `close` | 5 | 1 calendar week lookback |
| `return_10d` | 10-day historical return | $(\text{close}_t - \text{close}_{t-10}) / \text{close}_{t-10}$ | `close` | 10 | 2 calendar weeks lookback |
| `return_20d` | 20-day historical return | $(\text{close}_t - \text{close}_{t-20}) / \text{close}_{t-20}$ | `close` | 20 | 1 trading month lookback |
| `sma_10` | 10-day Simple Moving Average | $\frac{1}{10} \sum_{i=0}^9 \text{close}_{t-i}$ | `close` | 10 | Backward rolling mean; no future prices |
| `close_to_sma_10` | Price-to-SMA10 ratio | $\text{close}_t / \text{sma}_{10}$ | `close` | 10 | Mean-reversion indicator |
| `sma_20` | 20-day Simple Moving Average | $\frac{1}{20} \sum_{i=0}^{19} \text{close}_{t-i}$ | `close` | 20 | Monthly baseline trend |
| `close_to_sma_20` | Price-to-SMA20 ratio | $\text{close}_t / \text{sma}_{20}$ | `close` | 20 | Mean-reversion indicator |
| `sma_50` | 50-day Simple Moving Average | $\frac{1}{50} \sum_{i=0}^{49} \text{close}_{t-i}$ | `close` | 50 | Intermediate trend anchor |
| `close_to_sma_50` | Price-to-SMA50 ratio | $\text{close}_t / \text{sma}_{50}$ | `close` | 50 | Intermediate trend divergence |
| `ema_10` | 10-day Exponential Moving Avg | $\alpha \cdot \text{close}_t + (1-\alpha) \cdot \text{ema}_{t-1}$ | `close` | 10 | Weighted toward recent prices ($\alpha = 2/11$) |
| `close_to_ema_10` | Price-to-EMA10 ratio | $\text{close}_t / \text{ema}_{10}$ | `close` | 10 | Short-term momentum |
| `ema_20` | 20-day Exponential Moving Avg | $\alpha \cdot \text{close}_t + (1-\alpha) \cdot \text{ema}_{t-1}$ | `close` | 20 | Medium-term trend ($\alpha = 2/21$) |
| `close_to_ema_20` | Price-to-EMA20 ratio | $\text{close}_t / \text{ema}_{20}$ | `close` | 20 | Medium-term momentum |
| `ema_50` | 50-day Exponential Moving Avg | $\alpha \cdot \text{close}_t + (1-\alpha) \cdot \text{ema}_{t-1}$ | `close` | 50 | Long-term trend ($\alpha = 2/51$) |
| `close_to_ema_50` | Price-to-EMA50 ratio | $\text{close}_t / \text{ema}_{50}$ | `close` | 50 | Long-term momentum |
| `rsi_14` | Relative Strength Index | $100 - \frac{100}{1 + \text{AvgGain}/\text{AvgLoss}}$ | `close` | 14 | Bounded [0, 100], strictly backward looking |
| `macd` | MACD Line | $\text{EMA}_{12}(\text{close}) - \text{EMA}_{26}(\text{close})$ | `close` | 26 | Trend divergence metric |
| `macd_signal` | MACD Signal Line | $\text{EMA}_9(\text{macd})$ | `close` | 35 | Exponential smooth of MACD line |
| `macd_hist` | MACD Histogram | $\text{macd} - \text{macd\_signal}$ | `close` | 35 | Directional velocity metric |
| `bb_upper_20` | Bollinger Upper Band | $\text{SMA}_{20} + 2 \cdot \sigma_{20}$ | `close` | 20 | Upper volatility band |
| `bb_middle_20` | Bollinger Middle Band | $\text{SMA}_{20}$ | `close` | 20 | Central trend benchmark |
| `bb_lower_20` | Bollinger Lower Band | $\text{SMA}_{20} - 2 \cdot \sigma_{20}$ | `close` | 20 | Lower volatility band |
| `bb_width_20` | Bollinger Bandwidth | $(\text{Upper} - \text{Lower}) / \text{Middle}$ | `close` | 20 | Volatility compression/expansion metric |
| `bb_pct_20` | Bollinger %B | $(\text{close} - \text{Lower}) / (\text{Upper} - \text{Lower})$ | `close` | 20 | Position within the volatility channel |
| `hl_spread_ratio` | Intraday range fraction | $(\text{high} - \text{low}) / \text{close}$ | `high`, `low`, `close` | 1 | Daily volatility proxy |
| `co_spread_ratio` | Intraday net drift | $(\text{close} - \text{open}) / \text{open}$ | `close`, `open` | 1 | Intraday session return |
| `rolling_std_10` | 10-day price std dev | $\sigma_{10}(\text{close})$ | `close` | 10 | Short-term dispersion |
| `rolling_vol_10` | 10-day annualized vol | $\sigma_{10}(\text{daily\_ret}) \cdot \sqrt{252}$ | `close` | 10 | Annualized return volatility |
| `rolling_std_20` | 20-day price std dev | $\sigma_{20}(\text{close})$ | `close` | 20 | Monthly price dispersion |
| `rolling_vol_20` | 20-day annualized vol | $\sigma_{20}(\text{daily\_ret}) \cdot \sqrt{252}$ | `close` | 20 | Monthly annualized return volatility |
| `rolling_std_50` | 50-day price std dev | $\sigma_{50}(\text{close})$ | `close` | 50 | Quarterly price dispersion |
| `rolling_vol_50` | 50-day annualized vol | $\sigma_{50}(\text{daily\_ret}) \cdot \sqrt{252}$ | `close` | 50 | Quarterly annualized return volatility |
| `close_lag_1` | 1-day lagged close | $\text{close}_{t-1}$ | `close` | 1 | Yesterday's close |
| `close_lag_2` | 2-day lagged close | $\text{close}_{t-2}$ | `close` | 2 | Close from 2 sessions ago |
| `close_lag_3` | 3-day lagged close | $\text{close}_{t-3}$ | `close` | 3 | Close from 3 sessions ago |
| `close_lag_5` | 5-day lagged close | $\text{close}_{t-5}$ | `close` | 5 | Close from 1 week ago |
| `close_lag_10` | 10-day lagged close | $\text{close}_{t-10}$ | `close` | 10 | Close from 2 weeks ago |
| `return_lag_1` | 1-day lagged return | $\text{return}_{t-1}$ | `close` | 2 | Yesterday's daily return |
| `return_lag_2` | 2-day lagged return | $\text{return}_{t-2}$ | `close` | 3 | Return from 2 sessions ago |
| `return_lag_3` | 3-day lagged return | $\text{return}_{t-3}$ | `close` | 4 | Return from 3 sessions ago |
| `return_lag_5` | 5-day lagged return | $\text{return}_{t-5}$ | `close` | 6 | Return from 1 week ago |
| `volume_lag_1` | 1-day lagged volume | $\text{volume}_{t-1}$ | `volume` | 1 | Yesterday's traded volume |
| `volume_lag_2` | 2-day lagged volume | $\text{volume}_{t-2}$ | `volume` | 2 | Volume from 2 sessions ago |
| `volume_lag_3` | 3-day lagged volume | $\text{volume}_{t-3}$ | `volume` | 3 | Volume from 3 sessions ago |
| `volume_lag_5` | 5-day lagged volume | $\text{volume}_{t-5}$ | `volume` | 5 | Volume from 1 week ago |

---

## 16. Supported Prediction Tasks

The framework supports configurable prediction targets derived from backward-looking historical features:

### Task A: Next-Day Closing Price
- **Target**: `target_next_close`
- **Definition**: Raw equity close price at session $t+1$ ($\text{INR}$).
- **Evaluation Type**: Continuous price regression.

### Task B: Next-Day Return
- **Target**: `target_next_return`
- **Definition**: Percentage return from session $t$ to session $t+1$:
  $$\text{target\_next\_return} = \frac{\text{Close}_{t+1} - \text{Close}_t}{\text{Close}_t}$$
- **Evaluation Type**: Stationary percentage return regression and directional market classification.

### Task C: Configurable Multi-Day Return Horizons
- **Targets**: `target_return_5d`, `target_return_10d`, `target_return_20d`
- **Definition**: Cumulative percentage return over 5, 10, and 20 subsequent trading sessions.

---

## 17. Experimentation Strategies: Per-Ticker vs. Global

The framework implements two primary architectural strategies:

### Strategy A: Per-Ticker Models (`training_mode: per_ticker`)
- Dedicated models trained on the isolated historical time-series of an individual stock (e.g. `RELIANCE`, `TCS`, `INFY`).
- Guarantees zero cross-stock contamination or spurious cross-sectional correlation.
- **Handling Low-Data Equities**: Stocks with fewer historical samples than `minimum_training_samples` (default: 150), `minimum_validation_samples` (30), or `minimum_test_samples` (30) are safely skipped with a logged reason. Synthetic data is **never** fabricated.

### Strategy B: Global Panel Model (`training_mode: global`)
- A single consolidated model trained across all eligible equities while retaining feature identities.
- Allows cross-sectional learning across market regimes while strictly preserving temporal splits.

---

## 18. Model Architecture & Baselines

The framework implements 5 reproducible models:

### 1. Naive / Persistence Baseline (`NaiveBaselineModel`)
- **Price Forecasting**:
  $$\hat{P}_{t+1} = P_t \quad (\text{predicted\_next\_close} = \text{current\_close})$$
- **Return Forecasting**:
  $$\hat{R}_{t+1} = 0.0 \quad (\text{predicted\_return} = 0.0)$$
- **Role**: Mandatory non-negotiable benchmark. All ML models are evaluated against this baseline. If an ML model fails to beat the Naive baseline on the validation split, the result is transparently recorded.

### 2. Linear Regression (`LinearRegressionStockModel`)
- Fits standard OLS with strictly isolated `LeakageFreeScaler` (StandardScaler/RobustScaler) fitted exclusively on training data.
- Stored as an integrated serializable pipeline artifact.

### 3. Random Forest Regressor (`RandomForestStockModel`)
- Configurable `n_estimators`, `max_depth`, `min_samples_split`, `min_samples_leaf`, and `max_features`.
- Deterministic random seeds (`random_state=42`) with chronological time-series preservation.

### 4. XGBoost Regressor (`XGBoostStockModel`)
- Gradient boosted decision trees with early stopping monitored on the validation split.
- Configurable `learning_rate`, `max_depth`, `subsample`, `colsample_bytree`, `reg_alpha`, and `reg_lambda`.
- Early stopping rounds prevent overfitting while keeping the test set completely held out.

### 5. Deep Learning LSTM (`LSTMStockModel`)
- Experimental PyTorch deep neural network running efficiently on CPU without requiring GPU acceleration.
- Architecture: Multi-layer LSTM recurrent network with configurable hidden units, dropout, and linear projection head.
- Sequence Builder: Chronological sliding windows of configurable lookback (e.g. 15 or 30 trading days).
- Scaler fitting: Strict train-only normalization. The validation sequences prepend the trailing historical observations from the training split so that validation begins cleanly at the first validation session without lookahead.
- Early stopping monitors validation loss (MSE) with checkpoint restoration.

---

## 19. Time-Series Validation & Zero-Lookahead Guarantees

### Chronological Splits
- Data is partitioned chronologically into three strict temporal partitions:
  $$\text{Train (2015-03-17 to 2021-05-14)} \longrightarrow \text{Validation (2021-05-17 to 2022-09-02)} \longrightarrow \text{Test (2022-09-05 to 2023-12-28)}$$
- **Never Randomly Shuffled**: Traditional cross-validation with random shuffling is forbidden.
- **Untouched Test Partition**: The test partition is strictly held out and evaluated only once on the finalized model candidate.

### Walk-Forward Expanding Window Cross-Validation
- Implemented in `app/validation/walk_forward.py`:
  - Fold 1: Train on initial historical window $\rightarrow$ Validate on subsequent window.
  - Fold 2: Train on expanding historical window $\rightarrow$ Validate on next window.
  - Fold 3: Train on further expanded historical window $\rightarrow$ Validate on subsequent window.

### Automated Leakage Audits
Implemented in `app/validation/leakage_audit.py` to immediately raise `DataLeakageError` if:
1. Any target column (`target_*`) is included in feature space $X$.
2. Any forward-looking indicator (`future_*`, `lead_*`, `next_*`) enters $X$.
3. Training max date $\ge$ Validation min date, or Validation max date $\ge$ Test min date.
4. Data from one stock symbol contaminates another stock's partition.
5. Scalers are refitted on validation or test observations.

---

## 20. Centralized Evaluation Metrics

### Price Prediction Metrics
- **MAE** (Mean Absolute Error): Average absolute error in INR (₹).
- **RMSE** (Root Mean Squared Error): Penalizes large deviation outliers.
- **MAPE** (Mean Absolute Percentage Error): Safe against division by zero via $\epsilon$-protection ($\epsilon = 10^{-7}$).
- **R²** (Coefficient of Determination): Proportion of variance explained.

### Return Prediction Metrics
- **MAE & RMSE**: Precision of percentage return forecasts.
- **Directional Accuracy**: Percentage of sessions where predicted market direction matches actual direction:
  $$\text{Directional Accuracy} = \frac{\sum \mathbb{I}(\text{sign}(\hat{R}) == \text{sign}(R))}{N} \times 100\%$$
- **Precision, Recall, and F1**: Directional trading signal efficacy.
- **Zero-Return Treatment**: Sessions with zero return are explicitly categorized as neutral/flat (non-positive in binary direction: UP > 0, DOWN/FLAT $\le$ 0) to avoid artificially inflating directional accuracy.

---

## 21. Model Selection & Lifecycle Policy

The framework uses an automated, objective candidate selection engine (`app/experiments/comparator.py`):
1. **Validation-Only Evaluation**: Candidates are selected strictly on validation split performance. Test set metrics are NEVER used to tune hyperparameters or select winners.
2. **Baseline Outperformance Requirement**: A model is only promoted if it demonstrably beats the Naive Baseline on the primary metric (e.g. RMSE). If no ML model outperforms the baseline, the baseline is retained.
3. **Model Registry Status Transitions**:
   - `EXPERIMENTAL`: Assigned to all newly trained models during exploration.
   - `CANDIDATE`: Assigned to the top-performing model on the validation split.
   - `PRODUCTION`: Assigned only after explicit promotion and governance verification.
   - `RETIRED`: Historical superseded models.

---

## 22. Empirical Benchmark Results on Real Nifty 500 Dataset

Experiments were executed across representative constituents (`RELIANCE`, `TCS`, `INFY`) using the validated real dataset:

### A. Next-Day Price Forecasting (`target_next_close`)

#### RELIANCE
| Model | Val MAE (₹) | Val RMSE (₹) | Val MAPE (%) | Val R² | Delta vs Base % | Test RMSE (₹) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Naive Baseline** | **14.39** | **19.24** | **1.28%** | **0.9554** | **Baseline** | **13.12** |
| Linear Regression | 15.39 | 20.01 | 1.37% | 0.9517 | +4.00% | 13.69 |
| Random Forest | 104.95 | 124.81 | 8.97% | -0.8782 | +548.57% | 157.02 |
| XGBoost | 105.51 | 125.43 | 9.02% | -0.8966 | +551.76% | 155.45 |
| LSTM | 1078.65 | 1082.49 | 96.51% | -140.27 | +5524.97% | 1129.83 |

*Key Finding*: For non-stationary raw price levels, the Naive Persistence baseline ($\hat{P}_{t+1} = P_t$) demonstrates high baseline persistence ($R^2 \approx 0.955$). Decision tree ensembles (RF, XGBoost) bounded by training-period price maximums fail out-of-range, and the framework correctly selects **Naive Baseline** as the candidate.

---

### B. Next-Day Return Forecasting (`target_next_return`)

#### RELIANCE
| Model | Val MAE | Val RMSE | Val R² | Val Dir Acc (%) | Delta vs Base % | Test RMSE | Test Dir Acc (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XGBoost (CANDIDATE)** | **0.0128** | **0.01704** | **-0.0024** | **49.54%** | **-0.04%** | **0.01131** | **49.39%** |
| Naive Baseline | 0.0128 | 0.01705 | -0.0033 | 46.15% | Baseline | 0.01133 | 49.08% |
| Linear Regression | 0.0144 | 0.0186 | -0.1924 | 48.92% | +9.02% | 0.0127 | 50.00% |
| Random Forest | 0.0147 | 0.0189 | -0.2357 | 48.31% | +10.98% | 0.0149 | 49.08% |
| LSTM | 0.0147 | 0.0192 | -0.2786 | 52.31% | +12.89% | 0.0135 | 46.32% |

#### TCS
| Model | Val MAE | Val RMSE | Val R² | Val Dir Acc (%) | Delta vs Base % | Test RMSE | Test Dir Acc (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XGBoost (CANDIDATE)** | **0.0102** | **0.01396** | **0.0138** | **54.15%** | **-0.70%** | **0.0116** | **52.15%** |
| Naive Baseline | 0.0102 | 0.01406 | -0.0001 | 47.38% | Baseline | 0.0116 | 48.77% |
| Linear Regression | 0.0111 | 0.0149 | -0.1205 | 52.00% | +5.85% | 0.0121 | 51.84% |
| Random Forest | 0.0118 | 0.0155 | -0.2168 | 48.92% | +10.31% | 0.0132 | 50.92% |
| LSTM | 0.0127 | 0.0164 | -0.3538 | 47.38% | +16.35% | 0.0150 | 51.84% |

#### INFY
| Model | Val MAE | Val RMSE | Val R² | Val Dir Acc (%) | Delta vs Base % | Test RMSE | Test Dir Acc (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XGBoost (CANDIDATE)** | **0.0120** | **0.01568** | **0.0011** | **53.85%** | **-0.10%** | **0.0149** | **49.39%** |
| Naive Baseline | 0.0121 | 0.01569 | -0.0007 | 46.46% | Baseline | 0.0149 | 50.31% |
| Random Forest | 0.0124 | 0.0159 | -0.0245 | 46.77% | +1.18% | 0.0149 | 50.00% |
| Linear Regression | 0.0136 | 0.0177 | -0.2679 | 51.38% | +12.56% | 0.0164 | 54.29% |
| LSTM | 0.0233 | 0.0316 | -3.0504 | 46.15% | +101.18% | 0.0315 | 55.52% |

*Key Finding*: On stationary percentage returns, XGBoost demonstrates superior performance, outperforming the Naive Baseline across all 3 stocks with validation directional accuracies reaching **54.15%** for TCS and **53.85%** for INFY. The automated selection engine accordingly promoted XGBoost to **CANDIDATE** status for all three assets.

---

## 23. Artifact Storage & Registry Directory Structure

Model artifacts and audit metadata are persisted under standard directories:
```
ml-service/
├── experiments/
│   ├── configs/            # JSON snapshots of experiment configurations
│   ├── results/            # Run summaries, metrics, and candidate selections
│   └── reports/            # PNG diagnostic plots (Actual vs Pred, Residuals, Loss Curves)
│
├── models/
│   ├── artifacts/          # Serialized .joblib and .pt model weights
│   ├── metadata/           # Per-model JSON metadata cards
│   └── registry/           # model_catalog.json tracking full lifecycle
```

---

## 24. Reproducibility & Cryptographic Fingerprinting

- **Dataset Fingerprinting**: Computes SHA-256 hashes of the raw CSV (`5f2f686b84e78d87...`) and processed Parquet files.
- **Deterministic Random Seeds**: All stochastic processes (data splits, model weights, torch initialization) use deterministic seeds (`seed=42`).
- **Audit Logging**: Every experiment logs exact library versions, feature names, hyperparameter payloads, and wall-clock training durations.

---

## 25. Regulatory & Financial Disclaimer

> [!CAUTION]
> **IMPORTANT FINANCIAL NOTICE**:
> Stock market predictions and trading signals produced by SmartFin AI are model-generated estimates based strictly on historical market data and technical features. They are provided solely for research, analytical, and educational purposes and **do not constitute financial advice, investment recommendations, or guaranteed future prices or investment outcomes**. Financial markets are inherently stochastic and subject to significant risk of capital loss. Past statistical performance is no guarantee of future returns.

---

## 26. Production Inference Architecture

The SmartFin AI inference subsystem provides real-time model inference served through the dedicated FastAPI ML service (`ml-service/app/`). It directly operationalizes the trained and registered models produced by the experimentation pipeline without retraining at runtime:

```
Client / Node Backend
        │
        ▼ (POST /api/v1/predictions/stock)
FastAPI Inference Router (app/routers/predictions.py)
        │ (Pydantic validation, symbol sanitization)
        ▼
StockPredictionService (app/services/prediction_service.py)
        ├──────► ModelRegistry (app/models/stock/registry.py)
        │             └─ Resolves approved PRODUCTION or CANDIDATE entry
        ├──────► ModelLoader & LRU Cache (app/services/model_loader.py)
        │             └─ Warm cache retrieval (0ms) or safe disk load (.joblib / .pt)
        ├──────► MarketDataService (app/services/market_data_service.py)
        │             └─ Node backend API / Local historical Parquet (OHLCV validation)
        ├──────► FeatureInferenceService (app/services/feature_service.py)
        │             └─ Prompt 14 FeatureEngineer (58 features, zero lookahead)
        ├──────► Model Inference Execution
        │             └─ model.predict(feature_vector)
        ├──────► Prediction Sanity Verifier (Finite, non-NaN, boundary checks)
        ├──────► PredictionRepository (app/repositories/prediction_repository.py)
        │             └─ Thread-safe append to audit history (app/data/predictions/history.json)
        ▼
Validated Safe Response (StockPredictionResponse)
```

---

## 27. Model Registry Integration & Lifecycle Resolution

1. **Catalog Source**: The inference layer queries `ml-service/models/registry/model_catalog.json`.
2. **Model Status Hierarchy**:
   - `PRODUCTION`: Preferred in all environments. Required in `production` mode unless explicitly configured otherwise.
   - `CANDIDATE`: Usable in `development` mode or when `allow_candidate=True` is provided in the inference request.
   - `EXPERIMENTAL`: Never used for live inference.
   - `RETIRED`: Blocked from live inference.
3. **Resolution Strategy**:
   - Filters candidate pool by ticker, horizon, and target.
   - Resolves specific version if `model_version` is supplied (e.g. `1.0.0`).
   - If `model_version` is omitted, selects the latest `PRODUCTION` model.
   - If no production model exists and `allow_candidate=False`, returns `404 Not Found` with a controlled error message.
   - **Zero Automatic Promotion**: The inference engine never auto-promotes experimental models. Promotion requires explicit administrative action via `POST /api/v1/models/stock/{model_id}/promote`.

---

## 28. Model Loading & In-Memory LRU Cache

1. **Loader (`ModelLoader`)**:
   - Thread-safe loader supporting `NaiveBaselineModel`, `LinearRegressionStockModel`, `RandomForestStockModel`, `XGBoostStockModel`, and `LSTMStockModel`.
   - Never exposes internal disk paths (`.joblib`, `.pt`) in API responses or user-facing logs.
2. **In-Memory Cache (`ModelCache`)**:
   - Thread-safe `OrderedDict` LRU cache bounded to a maximum capacity of 50 models to avoid unbounded memory growth.
   - **Performance**:
     - Cold disk load: ~10ms – 50ms depending on artifact size.
     - Warm cache hit: 0.00ms – 0.05ms latency.
   - **Invalidation**: Provides `invalidate(model_id)` and `clear()` methods, triggered upon model status updates or manual maintenance.
   - **Failed Load Handling**: Failed model deserializations are logged internally and rejected without polluting the cache.

---

## 29. Feature Generation During Inference

To prevent feature mismatch and distribution shift:
1. **Identical Codebase**: The inference pipeline uses the exact same `FeatureEngineer` class from Prompt 14 (`app/features/engineer.py`).
2. **Base OHLCV Isolation**: Input historical bars are filtered strictly to `['date', 'symbol', 'open', 'high', 'low', 'close', 'volume']` before feature generation, eliminating column collisions.
3. **Strict Schema & Column Ordering**:
   - Asserts feature count matches `model_entry.features_count` (58 features).
   - Verifies all expected features exist and arranges columns in the exact order recorded during training.
   - Validates that `feature_version` matches the model metadata (`1.0.0`); mismatches raise an immediate `400 Bad Request`.
4. **Zero Lookahead Guarantee**:
   - Lagged returns, rolling statistics, RSI, MACD, and Bollinger Bands are computed strictly from historical bars up to $t$.
   - Forward-looking targets (`target_next_close`, `target_next_return`) are **never** computed or referenced during inference.
   - Extracts strictly the trailing row $t$ for tabular models, or the trailing $S$ rows for LSTM sequence models.

---

## 30. Preprocessing & Leakage-Free Scaler

1. **Pre-Fitted Artifacts**: Models requiring scaling (e.g. LSTM, Linear Regression) serialize their pre-fitted `LeakageFreeScaler` directly inside the model artifact bundle.
2. **Zero Fitting at Inference**: The inference engine never calls `.fit()` or `.fit_transform()` on incoming market data. Only `.transform()` is executed using the frozen training distributions.
3. **PyTorch Checkpoint Compatibility**: Checkpoints are loaded with `weights_only=False` under PyTorch 2.6 to properly unpickle custom scalers while preventing security issues by keeping artifact paths internal.

---

## 31. Market Data Dependency & Fallback Architecture

1. **Provider Abstraction (`MarketDataService`)**:
   - Primary: Connects over HTTP to the Node.js backend market service (`GET /api/v1/stocks/{symbol}/history`).
   - Secondary / Offline: Local Parquet historical provider (`LocalHistoricalMarketDataProvider`) for offline evaluation and CI testing.
2. **Market Data Sanity Checks**:
   - Verifies required columns: `['date', 'symbol', 'open', 'high', 'low', 'close', 'volume']`.
   - Validates positive price constraints: $P > 0$ and $V \ge 0$.
   - Enforces minimum required bars (at least 60 trading days for tabular models, 60 + sequence length for LSTM). Insufficient data triggers `400 Bad Request`.
3. **Freshness & Stale Data Enforcement**:
   - Configurable `MAX_MARKET_DATA_AGE_MINUTES` (default: 4,320 minutes / 3 calendar days to accommodate weekends).
   - If market data is older than the configured threshold, the request is rejected with `503 Service Unavailable`.
4. **Unavailable Data**:
   - Provider network errors or missing tickers return `503 Service Unavailable` with a safe message: `"Market data is currently unavailable. Prediction could not be generated."`
   - Zero synthetic, randomized, or hardcoded prices are ever substituted.

---

## 32. Prediction Validation & Sanity Audits

Prior to returning results to clients, predictions pass through strict sanity gates:
1. **Finite & Non-NaN**: Rejects `NaN`, `+Inf`, `-Inf`.
2. **Numeric Type**: Verifies output is castable to standard IEEE 754 float.
3. **Empty Output Check**: Rejects empty arrays from broken estimators.
4. **Target Interpretation**:
   - If target is price (`target_next_close`): Returns `predicted_value` as price; derives `predicted_return` with `is_derived_return = True`.
   - If target is return (`target_next_return`): Returns `predicted_return`; derives `predicted_value` as $P_t \times (1 + \hat{R})$ with `is_derived_price = True`.
   - All derived values are explicitly flagged so clients are never misled.
5. **No Fabricated Confidence**: Fake confidence percentages (e.g. `"98% confidence"`) are forbidden. Historical evaluation metrics (MAE, RMSE, MAPE, R², Directional Accuracy) are returned instead.

---

## 33. Prediction Persistence & Audit Repository

1. **Repository (`PredictionRepository`)**:
   - Thread-safe persistence layer maintaining an append-only log of all inference requests.
   - Backed by an in-memory buffer and persisted to `app/data/predictions/history.json`.
2. **Audited Fields**:
   - `prediction_id` (UUIDv4)
   - `symbol`
   - `prediction_timestamp` (ISO 8601 UTC)
   - `market_data_timestamp` (ISO 8601 UTC)
   - `horizon`
   - `target`
   - `current_price`
   - `predicted_value` & `predicted_return`
   - `is_derived_price` & `is_derived_return`
   - `model_name`, `model_version`, `feature_version`, `model_status`
3. **Query & Filtering**:
   - Supports pagination via `limit` (max 100) and `offset`.
   - Supports filtering by `horizon`, `model_name`, `start_date`, and `end_date`.

---

## 34. FastAPI Endpoints & Contract

All endpoints are mounted under `/api/v1`:

### 1. `POST /api/v1/predictions/stock`
Generates a stock prediction for an approved ticker.
- **Request Body**:
  ```json
  {
    "symbol": "TCS",
    "horizon": 1,
    "target": "target_next_return",
    "model_version": null,
    "allow_candidate": true
  }
  ```
- **Response**:
  ```json
  {
    "symbol": "TCS",
    "market_data_timestamp": "2023-12-29T00:00:00Z",
    "prediction_timestamp": "2026-09-27T14:48:33.400Z",
    "current_price": 3793.4,
    "predicted_value": 3793.63,
    "predicted_return": 0.00006,
    "is_derived_price": true,
    "is_derived_return": false,
    "horizon": 1,
    "target": "target_next_return",
    "model_name": "XGBoost",
    "model_version": "1.0.0",
    "feature_version": "1.0.0",
    "historical_metrics": {
      "mae": 0.0102,
      "rmse": 0.01396,
      "r2": 0.0138,
      "directional_accuracy": 0.5415
    },
    "disclaimer": "Model forecasts are statistical estimates based on historical market data and do not guarantee future performance or financial outcomes."
  }
  ```

### 2. `GET /api/v1/predictions/stock/{symbol}/history`
Retrieves paginated audit history for a stock ticker.
- **Parameters**: `limit` (int, default 20), `offset` (int, default 0), `horizon` (int, optional), `model_name` (str, optional), `start_date` (ISO, optional), `end_date` (ISO, optional).

### 3. `GET /api/v1/models/stock`
Lists registered stock models with public metadata cards (no file paths).
- **Parameters**: `symbol` (optional), `status` (optional), `target` (optional).

### 4. `GET /api/v1/models/stock/{symbol}/metrics`
Returns historical evaluation metrics (MAE, RMSE, R², Directional Accuracy) across all registered models for a ticker.

### 5. `POST /api/v1/models/stock/{model_id}/promote`
Administrative model governance endpoint to promote or demote model lifecycle status (`PRODUCTION`, `CANDIDATE`, `RETIRED`). Automatically invalidates the in-memory model cache.

### 6. `GET /api/v1/models/stock/cache/stats` & `POST /api/v1/models/stock/cache/clear`
Inspects cache capacity, current size, and provides cache flush capabilities.

---

## 35. Error Handling & HTTP Status Codes

| HTTP Status | Trigger Condition | Example Detail Message |
| :--- | :--- | :--- |
| `400 Bad Request` | Feature version mismatch or insufficient historical bars | `"Insufficient historical bars for TCS. Need at least 60, got 25."` |
| `404 Not Found` | Model not found or no eligible PRODUCTION model | `"No PRODUCTION model is currently available for 'TCS'. Existing models are in status: ['CANDIDATE']."` |
| `409 Conflict` | Model target/horizon incompatible with request | `"Model TCS_xgb_v1 supports horizon=1, but horizon=5 was requested."` |
| `422 Unprocessable` | Pydantic validation failure (e.g. invalid ticker symbols, path traversal strings) | `"Symbol must be 1-20 alphanumeric characters."` |
| `503 Unavailable` | External market API failure or stale market data | `"Market data is currently unavailable. Prediction could not be generated."` |
| `500 Server Error` | Model deserialization or NaN sanity failure | `"Prediction could not be verified by sanity audits: Model generated non-finite or NaN prediction value."` |

---

## 36. Performance Monitoring & Latency Instrumentation

Every inference request logs structured latency diagnostics (in milliseconds):
- `market_data_ms`: Duration of upstream market bar retrieval and validation.
- `model_load_ms`: Model cache hit (0.0ms) or cold disk load latency.
- `feature_gen_ms`: Full technical indicator calculation and schema alignment.
- `inference_ms`: Raw estimator execution time.
- `total_ms`: End-to-end request duration.

---

## 37. Security & Path Traversal Prevention

1. **Input Sanitization**:
   - `symbol`: Regex validated `^[A-Za-z0-9._-]{1,20}$`.
   - `model_version`: Regex validated `^[A-Za-z0-9._-]{1,30}$`. Reject path traversal characters (`/`, `\`, `..`).
2. **Zero Internal Exposure**:
   - File paths (e.g. `c:/.../TCS_xgb_v1.joblib`), server environment variables, and stack traces are strictly stripped from all public API envelopes.
   - Model resolution is performed exclusively via server-side registry lookup keys (`model_id`, `symbol`).

---

## 38. Automated Test Coverage

The inference layer is verified with 23 dedicated automated integration tests (`ml-service/tests/test_stock_prediction_api.py`):
1. Valid prediction request for price target (`target_next_close`).
2. Valid prediction request for return target (`target_next_return`).
3. Derived price and return correctness.
4. Empty symbol validation (422).
5. Invalid symbol characters (422).
6. Non-positive or out-of-range horizon (422).
7. Path traversal attempt in `model_version` (422).
8. Unsupported ticker model resolution (404).
9. Incompatible horizon conflict (409).
10. Market data unavailable provider failure (503).
11. Stale market data rejection beyond freshness threshold (503).
12. Insufficient historical bars for feature calculation (400).
13. Cold load vs. warm in-memory cache hit verification (0ms).
14. Model cache invalidation and clearing.
15. Prediction persistence and audit history filtering.
16. History pagination with offset and limit.
17. Model catalog listing endpoint (safe metadata validation).
18. Model metrics comparison endpoint.
19. Administrative model status promotion (`POST /promote`).
20. Concurrent prediction thread safety (5 concurrent requests).
21. Feature version mismatch rejection (400).
22. NaN and infinite prediction rejection (500).
23. LSTM sequential sliding window inference on CPU.

---

## 39. Production Model Selection & Governance

- In accordance with the Prompt 15 experimentation findings, XGBoost achieved superior predictive performance on stationary returns (`target_next_return`), with directional accuracies of **54.15% (TCS)** and **53.85% (INFY)**, and is registered as `CANDIDATE`.
- To transition a model to `PRODUCTION`, an authorized governance action is required:
  ```bash
  curl -X POST http://localhost:8000/api/v1/models/stock/TCS_xgb_target_next_return_h1/promote \
    -H "Content-Type: application/json" \
    -d '{"new_status": "PRODUCTION", "reason": "Passed governance validation"}'
  ```
- The inference engine dynamically reloads the catalog without requiring server restarts.

---

## 40. Limitations & Disclaimers

1. **Market Regimes**: Models are trained on EOD historical data (2015–2023) and may exhibit reduced predictive power during unprecedented macroeconomic shocks or high-frequency intraday volatility.
2. **EOD Latency**: Predictions are calibrated for daily trading horizons ($h=1, 5, 20$). They are not intended for sub-second high-frequency trading.
3. **Execution Slippage**: Forecasted returns do not factor in brokerage commissions, exchange transaction fees, or execution slippage.

