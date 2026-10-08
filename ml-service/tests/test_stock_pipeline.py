"""
Unit and integration tests for SmartFin AI stock prediction data pipeline.
Tests column normalization, cleaning, sorting, all technical features,
target generation, per-ticker isolation, leakage prevention, and splitting.
"""
import os
import shutil
import tempfile
import numpy as np
import pandas as pd
import pytest

from app.features.base import compute_base_features
from app.features.engineer import FeatureEngineer
from app.features.lags import compute_lags
from app.features.moving_averages import compute_moving_averages
from app.features.returns import compute_returns
from app.features.technical_indicators import (
    compute_bollinger_bands,
    compute_macd,
    compute_rsi,
)
from app.features.volatility import compute_volatility
from app.pipelines.config import PipelineConfig
from app.pipelines.stock_pipeline import StockDataPipeline
from app.preprocessing.cleaning import DataCleaner
from app.preprocessing.normalization import ColumnNormalizer
from app.preprocessing.scaling import LeakageFreeScaler
from app.targets.generator import TargetGenerator
from app.utils.time_series_split import TimeSeriesSplitter, WalkForwardValidator
from app.validation.validator import DataValidator


@pytest.fixture
def sample_raw_df():
    """Returns sample dataframe with raw uppercase column names and 2 tickers."""
    dates = pd.date_range("2023-01-01", periods=60, freq="B").strftime("%Y-%m-%d").tolist()
    data = []

    # Ticker A: Linear increasing price 100 -> 160
    for i, d in enumerate(dates):
        p = 100.0 + i
        data.append({
            "Date": d,
            "Symbol": "TICKER_A",
            "Open": p - 0.5,
            "High": p + 1.0,
            "Low": p - 1.0,
            "Close": p,
            "Adj Close": p,
            "Volume": 10000 + i * 100,
        })

    # Ticker B: Constant price 500
    for i, d in enumerate(dates):
        p = 500.0
        data.append({
            "Date": d,
            "Symbol": "TICKER_B",
            "Open": p,
            "High": p + 5.0,
            "Low": p - 5.0,
            "Close": p,
            "Adj Close": p,
            "Volume": 50000,
        })

    return pd.DataFrame(data)


# =========================================================================
# 1. Column Normalization
# =========================================================================

def test_column_normalization_standard(sample_raw_df):
    normalizer = ColumnNormalizer()
    normalized = normalizer.normalize(sample_raw_df)

    expected_cols = ["date", "symbol", "open", "high", "low", "close", "adj_close", "volume"]
    for col in expected_cols:
        assert col in normalized.columns
    assert normalized["symbol"].iloc[0] == "TICKER_A"


def test_column_normalization_missing_required():
    bad_df = pd.DataFrame({"Date": ["2023-01-01"], "Close": [100.0]})
    normalizer = ColumnNormalizer()
    with pytest.raises(ValueError, match="missing required canonical market columns"):
        normalizer.normalize(bad_df)


# =========================================================================
# 2. Cleaning, Deduplication & Chronological Sorting
# =========================================================================

def test_duplicate_detection_and_removal():
    dates = ["2023-01-01", "2023-01-01", "2023-01-02"]
    df = pd.DataFrame({
        "date": dates,
        "symbol": ["AAPL", "AAPL", "AAPL"],
        "open": [150.0, 150.0, 152.0],
        "high": [155.0, 155.0, 156.0],
        "low": [149.0, 149.0, 151.0],
        "close": [154.0, 154.0, 155.0],
        "volume": [1000, 1000, 2000],
    })
    cleaner = DataCleaner(min_historical_records=2)
    cleaned, stats = cleaner.clean(df)

    assert len(cleaned) == 2
    assert stats["duplicates_dropped"] == 1


def test_chronological_sorting():
    # Provide dates out of order
    dates = ["2023-01-05", "2023-01-01", "2023-01-03"]
    df = pd.DataFrame({
        "date": dates,
        "symbol": ["AAPL", "AAPL", "AAPL"],
        "open": [100.0, 100.0, 100.0],
        "high": [105.0, 105.0, 105.0],
        "low": [95.0, 95.0, 95.0],
        "close": [102.0, 102.0, 102.0],
        "volume": [1000, 1000, 1000],
    })
    cleaner = DataCleaner(min_historical_records=3)
    cleaned, _ = cleaner.clean(df)

    sorted_dates = cleaned["date"].tolist()
    assert sorted_dates == sorted(sorted_dates)


def test_missing_and_invalid_data_handling():
    df = pd.DataFrame({
        "date": ["2023-01-01", "invalid-date", "2023-01-03", "2023-01-04"],
        "symbol": ["AAPL", "AAPL", "AAPL", "AAPL"],
        "open": [100.0, 100.0, -10.0, 100.0],  # -10 negative price
        "high": [105.0, 105.0, 105.0, 105.0],
        "low": [95.0, 95.0, 95.0, 95.0],
        "close": [102.0, 102.0, 102.0, 102.0],
        "volume": [1000, 1000, 1000, -50],  # -50 negative volume
    })
    cleaner = DataCleaner(min_historical_records=1)
    cleaned, stats = cleaner.clean(df)

    # Only first row is fully valid
    assert len(cleaned) == 1
    assert stats["invalid_dates_dropped"] == 1
    assert stats["invalid_market_values_dropped"] == 2


def test_base_features():
    df = pd.DataFrame({
        "open": [100.0, 105.0],
        "high": [110.0, 115.0],
        "low": [95.0, 100.0],
        "close": [105.0, 110.0],
        "volume": [1000, 2000],
    })
    base = compute_base_features(df)
    assert "log_volume" in base.columns
    assert "volume_change_1d" in base.columns
    assert "close_to_open" in base.columns
    assert "close_to_high" in base.columns
    assert "close_to_low" in base.columns


def test_data_validator_report():
    df = pd.DataFrame({
        "date": ["2023-01-01", "2023-01-02"],
        "symbol": ["AAPL", "AAPL"],
        "open": [100.0, 101.0],
        "high": [105.0, 106.0],
        "low": [95.0, 96.0],
        "close": [102.0, 103.0],
        "volume": [1000, 1100],
    })
    val = DataValidator(min_historical_records=2)
    rep = val.validate_raw(df)
    assert rep.is_valid
    assert rep.tickers_retained_count == 1
    assert rep.date_min == "2023-01-01"


# =========================================================================
# 3. Technical Features: Returns, SMA, EMA, RSI, MACD, Bollinger, Volatility, Lags
# =========================================================================

def test_returns_features():
    df = pd.DataFrame({
        "close": [100.0, 110.0, 121.0, 133.1],
    })
    rets = compute_returns(df, periods=[1, 2])

    assert np.isnan(rets["daily_return"].iloc[0])
    assert pytest.approx(rets["daily_return"].iloc[1], 1e-4) == 0.10
    assert pytest.approx(rets["return_2d"].iloc[2], 1e-4) == 0.21


def test_moving_averages_sma_and_ema():
    prices = [10.0, 20.0, 30.0, 40.0, 50.0]
    df = pd.DataFrame({"close": prices})
    ma = compute_moving_averages(df, sma_windows=[3], ema_windows=[3])

    # 3-period SMA at idx 2: (10 + 20 + 30) / 3 = 20.0
    assert pytest.approx(ma["sma_3"].iloc[2], 1e-4) == 20.0
    assert pytest.approx(ma["close_to_sma_3"].iloc[2], 1e-4) == 30.0 / 20.0
    assert "ema_3" in ma.columns
    assert "close_to_ema_3" in ma.columns


def test_rsi_bounds():
    # Monotonically increasing prices -> RSI should approach 100
    prices = [float(x) for x in range(1, 30)]
    s = pd.Series(prices)
    rsi = compute_rsi(s, window=14)

    assert rsi.dropna().min() >= 0.0
    assert rsi.dropna().max() <= 100.0
    # Last value of strictly upward price should be near 100
    assert rsi.iloc[-1] > 95.0


def test_macd_calculation():
    prices = pd.Series([100.0 + np.sin(x) * 10 for x in range(50)])
    macd_df = compute_macd(prices, fast=12, slow=26, signal=9)

    assert "macd" in macd_df.columns
    assert "macd_signal" in macd_df.columns
    assert "macd_hist" in macd_df.columns
    # Check relationship: hist = macd - signal
    diff = macd_df["macd"] - macd_df["macd_signal"]
    pd.testing.assert_series_equal(diff, macd_df["macd_hist"], check_names=False)


def test_bollinger_bands():
    prices = pd.Series([100.0] * 30)
    bb = compute_bollinger_bands(prices, window=10, num_std=2.0)

    # Constant price -> std = 0 -> upper = middle = lower = 100
    assert pytest.approx(bb["bb_middle_10"].iloc[15], 1e-4) == 100.0
    assert pytest.approx(bb["bb_upper_10"].iloc[15], 1e-4) == 100.0
    assert pytest.approx(bb["bb_lower_10"].iloc[15], 1e-4) == 100.0


def test_volatility_features():
    df = pd.DataFrame({
        "open": [100.0, 102.0, 104.0, 106.0, 108.0],
        "high": [105.0, 107.0, 109.0, 111.0, 113.0],
        "low": [98.0, 100.0, 102.0, 104.0, 106.0],
        "close": [102.0, 105.0, 103.0, 108.0, 110.0],
    })
    vol = compute_volatility(df, windows=[3])

    assert "rolling_std_3" in vol.columns
    assert "rolling_vol_3" in vol.columns
    assert "hl_spread_ratio" in vol.columns
    assert "co_spread_ratio" in vol.columns
    assert (vol["rolling_std_3"].dropna() >= 0).all()


def test_lags_and_no_lookahead():
    df = pd.DataFrame({
        "close": [10.0, 20.0, 30.0, 40.0],
        "volume": [100, 200, 300, 400],
        "daily_return": [np.nan, 1.0, 0.5, 0.333],
    })
    lags = compute_lags(df, close_lags=[1, 2], return_lags=[1], volume_lags=[1])

    # Index 1 close_lag_1 must be index 0 close (10.0)
    assert lags["close_lag_1"].iloc[1] == 10.0
    assert lags["close_lag_1"].iloc[2] == 20.0
    assert np.isnan(lags["close_lag_2"].iloc[1])
    assert lags["close_lag_2"].iloc[2] == 10.0


# =========================================================================
# 4. Target Generation
# =========================================================================

def test_target_generation_per_ticker():
    df = pd.DataFrame({
        "date": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-01", "2023-01-02", "2023-01-03"],
        "symbol": ["A", "A", "A", "B", "B", "B"],
        "close": [100.0, 110.0, 120.0, 200.0, 220.0, 240.0],
    })
    config = PipelineConfig(target_horizons=[1, 2])
    gen = TargetGenerator(config)
    res_df, targets = gen.generate(df)

    # Next-day close for A at idx 0 must be 110.0
    a_df = res_df[res_df["symbol"] == "A"].reset_index(drop=True)
    assert a_df["target_next_close"].iloc[0] == 110.0
    assert pytest.approx(a_df["target_next_return"].iloc[0], 1e-4) == 0.10
    # Last day of A (idx 2) must be NaN for next-day target, NOT leaking B's 200.0!
    assert np.isnan(a_df["target_next_close"].iloc[2])

    b_df = res_df[res_df["symbol"] == "B"].reset_index(drop=True)
    assert b_df["target_next_close"].iloc[0] == 220.0
    assert np.isnan(b_df["target_next_close"].iloc[2])


# =========================================================================
# 5. Per-Ticker Isolation & Data Leakage Prevention
# =========================================================================

def test_per_ticker_feature_isolation():
    """
    Critical requirement: Features from Ticker A must NEVER contaminate Ticker B.
    """
    df = pd.DataFrame({
        "date": ["2023-01-01", "2023-01-02", "2023-01-01", "2023-01-02"],
        "symbol": ["A", "A", "B", "B"],
        "open": [100.0, 101.0, 500.0, 501.0],
        "high": [105.0, 106.0, 505.0, 506.0],
        "low": [95.0, 96.0, 495.0, 496.0],
        "close": [100.0, 101.0, 500.0, 501.0],
        "volume": [1000, 1100, 5000, 5100],
    })
    config = PipelineConfig(close_lag_periods=[1], sma_windows=[2])
    engineer = FeatureEngineer(config)
    feat_df, _ = engineer.transform(df)

    b_first_row = feat_df[(feat_df["symbol"] == "B") & (feat_df["date"] == "2023-01-01")].iloc[0]
    # Ticker B on day 1 has no previous day. close_lag_1 MUST be NaN, NOT 101.0 from Ticker A!
    assert np.isnan(b_first_row["close_lag_1"])


# =========================================================================
# 6. Chronological Time-Series Splitting & Leakage-Free Scaler
# =========================================================================

def test_chronological_time_series_splitting():
    dates = pd.date_range("2023-01-01", periods=100, freq="D")
    df = pd.DataFrame({
        "date": dates,
        "symbol": ["AAPL"] * 100,
        "close": range(100),
    })

    splitter = TimeSeriesSplitter(train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)
    train_df, val_df, test_df, date_ranges = splitter.split_global_temporal(df)

    assert len(train_df) == 70
    assert len(val_df) == 15
    assert len(test_df) == 15

    # Strict temporal precedence: max(train) < min(val) < max(val) < min(test)
    assert train_df["date"].max() < val_df["date"].min()
    assert val_df["date"].max() < test_df["date"].min()


def test_leakage_free_scaler():
    train_df = pd.DataFrame({"feat1": [10.0, 20.0, 30.0], "symbol": ["A", "A", "A"]})
    val_df = pd.DataFrame({"feat1": [100.0, 200.0], "symbol": ["A", "A"]})

    scaler = LeakageFreeScaler("standard")
    train_scaled = scaler.fit_transform(train_df, ["feat1"])
    val_scaled = scaler.transform(val_df, ["feat1"])

    # Mean of train_df is 20.0, std is sqrt(200/3) ≈ 8.165
    # Value 20 in train_scaled must be exactly 0
    assert pytest.approx(train_scaled["feat1"].iloc[1], 1e-4) == 0.0
    # Value 100 in val_scaled is transformed with training mean 20.0
    assert val_scaled["feat1"].iloc[0] > 5.0


def test_walk_forward_validator():
    dates = pd.date_range("2020-01-01", periods=500, freq="B")
    df = pd.DataFrame({
        "date": dates,
        "symbol": ["AAPL"] * 500,
        "close": range(500),
    })
    validator = WalkForwardValidator(n_splits=3, test_size_days=50, min_train_days=200)

    folds = list(validator.split(df))
    assert len(folds) == 3

    for train_f, test_f, meta in folds:
        assert train_f["date"].max() < test_f["date"].min()
        assert len(test_f["date"].unique()) == 50


# =========================================================================
# 7. End-to-End Pipeline Execution on Temporary Subset
# =========================================================================

def test_pipeline_end_to_end(sample_raw_df):
    temp_dir = tempfile.mkdtemp()
    try:
        raw_csv_path = os.path.join(temp_dir, "raw_stocks.csv")
        sample_raw_df.to_csv(raw_csv_path, index=False)

        config = PipelineConfig(
            dataset_path=raw_csv_path,
            processed_data_dir=os.path.join(temp_dir, "processed"),
            validation_report_dir=os.path.join(temp_dir, "validation"),
            min_historical_records=30,
            sma_windows=[5],
            ema_windows=[5],
            volatility_windows=[5],
            close_lag_periods=[1, 2],
            return_lag_periods=[1],
            volume_lag_periods=[1],
            target_horizons=[1, 5],
            save_parquet=True,
            save_csv=True,
        )

        pipeline = StockDataPipeline(config)
        summary = pipeline.run()

        assert summary["ticker_count"] == 2
        assert summary["feature_count"] > 10
        assert summary["target_count"] >= 2
        assert summary["missing_values_total"] == 0

        # Check saved files
        assert os.path.exists(os.path.join(temp_dir, "processed", "nifty500_features.parquet"))
        assert os.path.exists(os.path.join(temp_dir, "processed", "model_metadata.json"))
        assert os.path.exists(os.path.join(temp_dir, "validation", "raw_validation_report.json"))
    finally:
        shutil.rmtree(temp_dir)
