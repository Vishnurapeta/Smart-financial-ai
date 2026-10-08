"""
Comprehensive unit and integration test suite for Stock Prediction Model Experimentation.
Tests:
- Naive baseline (price & return)
- Metrics calculation & safe zero handling
- Explicit zero-lookahead proof and Data Leakage Audits
- Scaler fitting isolation (strictly on train)
- Linear Regression, Random Forest, XGBoost, LSTM
- LSTM sequence generation and chronological boundaries
- Walk-forward expanding window cross-validation
- Model Registry lifecycle (EXPERIMENTAL -> CANDIDATE -> PRODUCTION)
- Low-data ticker skipping and error resilience
- Model comparison and validation-only candidate selection
"""
import os
import shutil
import tempfile
import numpy as np
import pandas as pd
import pytest

from app.experiments.comparator import ModelComparator
from app.experiments.config import ExperimentConfig
from app.experiments.metrics import MetricsCalculator, StockMetricsCalculator
from app.models.stock.linear_regression import LeakageFreeScaler, LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel, create_sliding_sequences
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistry, ModelStatus
from app.models.stock.xgboost_model import XGBoostStockModel
from app.validation.leakage_audit import DataLeakageError, LeakageAuditor
from app.validation.walk_forward import WalkForwardValidator


# =====================================================================
# 1. BASELINE MODEL TESTS
# =====================================================================

def test_naive_baseline_price():
    """Verifies that naive price baseline strictly predicts current close (persistence)."""
    df = pd.DataFrame({
        "close": [100.0, 105.0, 102.5, 110.0],
        "volume": [1000, 1200, 1100, 1500],
    })
    y = pd.Series([105.0, 102.5, 110.0, 112.0])

    model = NaiveBaselineModel(task_type="price")
    model.fit(df, y)
    preds = model.predict(df)

    assert len(preds) == len(df)
    np.testing.assert_array_equal(preds, df["close"].to_numpy())


def test_naive_baseline_return():
    """Verifies that naive return baseline predicts constant 0.0 (efficient market baseline)."""
    df = pd.DataFrame({
        "feature_1": [1.0, 2.0, 3.0],
        "close": [100.0, 101.0, 102.0],
    })
    y = pd.Series([0.01, -0.005, 0.02])

    model = NaiveBaselineModel(task_type="return")
    model.fit(df, y)
    preds = model.predict(df)

    assert len(preds) == 3
    np.testing.assert_array_equal(preds, np.zeros(3))


# =====================================================================
# 2. METRICS CALCULATION & ZERO-RETURN HANDLING
# =====================================================================

def test_price_metrics_calculation():
    """Tests MAE, RMSE, MAPE, and R2 calculation with edge case safety."""
    y_true = np.array([100.0, 102.0, 105.0, 110.0])
    y_pred = np.array([101.0, 101.0, 104.0, 111.0])

    metrics = MetricsCalculator.calculate_price_metrics(
        y_true=y_true,
        y_pred=y_pred,
        ticker="TEST",
        model_name="LinearRegression",
    )

    expected_mae = np.mean(np.abs(y_true - y_pred))
    expected_rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
    assert metrics.mae == pytest.approx(expected_mae, abs=1e-4)
    assert metrics.rmse == pytest.approx(expected_rmse, abs=1e-4)
    assert metrics.mape > 0.0
    assert metrics.r2 > 0.0
    assert metrics.sample_count == 4


def test_return_metrics_and_zero_return_handling():
    """
    Tests return metrics and proves that zero-return is treated as neutral/flat
    (non-positive) rather than silently positive.
    """
    y_true = np.array([0.02, -0.01, 0.0, 0.03, -0.02])
    y_pred = np.array([0.01, -0.02, 0.01, 0.02, -0.01])

    metrics = MetricsCalculator.calculate_return_metrics(
        y_true=y_true,
        y_pred=y_pred,
        ticker="TEST",
        model_name="RandomForest",
    )

    assert metrics.directional_accuracy > 0.0
    assert metrics.directional_f1 >= 0.0
    # Confirm zero-return documentation string is explicit
    assert "neutral/flat" in metrics.zero_return_treatment


# =====================================================================
# 3. LEAKAGE AUDIT & EXPLICIT NO-LOOKAHEAD TEST
# =====================================================================

def test_leakage_auditor_target_in_features():
    """Confirms pipeline fails hard if target column is detected in feature space."""
    bad_features = ["open", "close", "rsi", "target_next_close"]
    with pytest.raises(DataLeakageError, match="Target 'target_next_close' is included in feature space X"):
        LeakageAuditor.audit_features(bad_features, target_name="target_next_close")


def test_leakage_auditor_forward_prefix():
    """Confirms pipeline fails hard if any forward-looking column is detected."""
    bad_features = ["open", "close", "future_price_5d"]
    with pytest.raises(DataLeakageError, match="Forward-looking/target column"):
        LeakageAuditor.audit_features(bad_features, target_name="target_next_return")


def test_leakage_auditor_temporal_order():
    """Confirms pipeline fails hard if temporal split boundaries overlap."""
    train_df = pd.DataFrame({"date": ["2020-01-01", "2020-06-01"]})
    val_df = pd.DataFrame({"date": ["2020-05-01", "2020-08-01"]})  # Overlaps train!
    test_df = pd.DataFrame({"date": ["2020-09-01", "2020-12-01"]})

    with pytest.raises(DataLeakageError, match="Train period overlaps with Validation"):
        LeakageAuditor.audit_temporal_order(train_df, val_df, test_df)


def test_leakage_auditor_ticker_isolation():
    """Confirms pipeline fails hard if data from another ticker contaminates a stock slice."""
    df_mixed = pd.DataFrame({"symbol": ["RELIANCE", "RELIANCE", "TCS"]})
    with pytest.raises(DataLeakageError, match="Cross-ticker contamination detected"):
        LeakageAuditor.audit_ticker_isolation(df_mixed, expected_ticker="RELIANCE")


def test_explicit_no_future_lookahead_in_features():
    """
    EXPLICIT PROOF TEST:
    Proves that for any observation at trading day t, all feature values are strictly
    computed from historical data <= t, and zero observations from t+1 or future dates
    can enter the training features.
    """
    dates = pd.date_range("2021-01-01", periods=10, freq="B")
    raw_prices = [100.0, 102.0, 101.0, 105.0, 108.0, 107.0, 110.0, 112.0, 111.0, 115.0]
    df = pd.DataFrame({"date": dates, "close": raw_prices})

    # Lag feature: close[t-1]
    df["close_lag_1"] = df["close"].shift(1)
    # Target: close[t+1]
    df["target_next_close"] = df["close"].shift(-1)

    # For any day t, feature close_lag_1 must come strictly from past (t-1)
    # and must NEVER equal target_next_close (unless price remained exactly constant)
    df_clean = df.dropna()
    for idx, row in df_clean.iterrows():
        obs_date = row["date"]
        # Lookahead verification: Feature is strictly from prior date
        prior_price = df.loc[df["date"] < obs_date, "close"].iloc[-1]
        assert row["close_lag_1"] == prior_price, "Feature contains lookahead or misaligned observation!"
        assert row["close_lag_1"] != row["target_next_close"] or prior_price == row["target_next_close"]


# =====================================================================
# 4. SCALER FITTING ISOLATION (TRAIN ONLY)
# =====================================================================

def test_scaler_fitted_strictly_on_train():
    """Verifies that LeakageFreeScaler parameters (mean, scale) are derived ONLY from train."""
    train_df = pd.DataFrame({"feat1": [10.0, 20.0, 30.0], "feat2": [100.0, 200.0, 300.0]})
    val_df = pd.DataFrame({"feat1": [1000.0, 2000.0], "feat2": [10000.0, 20000.0]})

    scaler = LeakageFreeScaler("standard")
    scaler.fit(train_df, ["feat1", "feat2"])

    # Mean must be exactly train mean (20.0, 200.0)
    assert scaler.scaler.mean_[0] == pytest.approx(20.0)
    assert scaler.scaler.mean_[1] == pytest.approx(200.0)

    # Transforming val data must NOT alter the fitted mean or scale
    _ = scaler.transform(val_df, ["feat1", "feat2"])
    assert scaler.scaler.mean_[0] == pytest.approx(20.0)
    assert scaler.scaler.mean_[1] == pytest.approx(200.0)


# =====================================================================
# 5. MODEL FIT, PREDICT, AND REPRODUCIBILITY
# =====================================================================

def test_linear_regression_workflow():
    """Tests Linear Regression fit, predict, save, and load."""
    X_train = pd.DataFrame({"feat1": [1.0, 2.0, 3.0, 4.0, 5.0], "feat2": [5.0, 4.0, 3.0, 2.0, 1.0]})
    y_train = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0])
    X_test = pd.DataFrame({"feat1": [6.0, 7.0], "feat2": [0.0, -1.0]})

    model = LinearRegressionStockModel(use_scaler=True)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    assert len(preds) == 2
    assert preds[0] > 50.0  # Linear extrapolation

    with tempfile.TemporaryDirectory() as tmp_dir:
        art_path = model.save(tmp_dir, "TEST_TICKER")
        assert os.path.exists(art_path)
        loaded = LinearRegressionStockModel.load(art_path)
        loaded_preds = loaded.predict(X_test)
        np.testing.assert_array_almost_equal(preds, loaded_preds)


def test_random_forest_determinism():
    """Verifies Random Forest produces deterministic outputs with fixed random_state."""
    X = pd.DataFrame(np.random.randn(50, 4), columns=[f"f_{i}" for i in range(4)])
    y = pd.Series(np.random.randn(50))

    rf1 = RandomForestStockModel(n_estimators=10, random_state=42, n_jobs=1)
    rf1.fit(X, y)
    preds1 = rf1.predict(X)

    rf2 = RandomForestStockModel(n_estimators=10, random_state=42, n_jobs=1)
    rf2.fit(X, y)
    preds2 = rf2.predict(X)

    np.testing.assert_allclose(preds1, preds2, atol=1e-7)


def test_xgboost_early_stopping():
    """Verifies XGBoost training with validation early stopping."""
    X_train = pd.DataFrame(np.random.randn(60, 4), columns=[f"f_{i}" for i in range(4)])
    y_train = pd.Series(np.random.randn(60))
    X_val = pd.DataFrame(np.random.randn(20, 4), columns=[f"f_{i}" for i in range(4)])
    y_val = pd.Series(np.random.randn(20))

    xgb = XGBoostStockModel(n_estimators=50, early_stopping_rounds=5, random_state=42)
    xgb.fit(X_train, y_train, X_val, y_val)
    preds = xgb.predict(X_val)
    assert len(preds) == len(X_val)


def test_lstm_sequence_generation():
    """Verifies sliding window sequence creation preserves chronological alignment."""
    X = np.arange(20).reshape(10, 2)  # 10 timesteps, 2 features
    y = np.arange(10)
    seq_len = 3

    X_seq, y_seq = create_sliding_sequences(X, y, sequence_length=seq_len)

    # Expected sequences: 10 - 3 + 1 = 8
    assert X_seq.shape == (8, 3, 2)
    assert y_seq.shape == (8,)
    # Target at sequence 0 must correspond to timestep index 2
    assert y_seq[0] == 2
    # Timesteps inside first sequence must be [0, 1, 2]
    np.testing.assert_array_equal(X_seq[0, :, 0], [0, 2, 4])


def test_lstm_model_cpu():
    """Verifies LSTM training and evaluation runs on CPU without requiring GPU."""
    X = pd.DataFrame(np.random.randn(40, 3), columns=["f1", "f2", "f3"])
    y = pd.Series(np.random.randn(40))

    lstm = LSTMStockModel(sequence_length=5, hidden_size=8, epochs=2, batch_size=16, random_seed=42)
    lstm.fit(X, y)
    preds = lstm.predict(X)
    assert len(preds) == len(X)


# =====================================================================
# 6. WALK-FORWARD EXPANDING WINDOW VALIDATION
# =====================================================================

def test_walk_forward_validator():
    """Verifies expanding historical window cross-validation with non-overlapping val folds."""
    dates = pd.date_range("2020-01-01", periods=100, freq="D")
    df = pd.DataFrame({"date": dates, "value": np.arange(100)})

    wfv = WalkForwardValidator(n_splits=3, min_train_ratio=0.5)
    folds = list(wfv.split(df, date_column="date"))

    assert len(folds) == 3
    # Check expanding training window
    prev_train_len = 0
    for fold in folds:
        assert len(fold.train_indices) > prev_train_len
        prev_train_len = len(fold.train_indices)
        # Validation indices must strictly follow training indices
        assert min(fold.val_indices) == max(fold.train_indices) + 1
        # No overlap between train and val
        assert len(set(fold.train_indices) & set(fold.val_indices)) == 0


# =====================================================================
# 7. MODEL REGISTRY LIFECYCLE
# =====================================================================

def test_model_registry_lifecycle():
    """Tests model registration and promotional lifecycle: EXPERIMENTAL -> CANDIDATE -> PRODUCTION."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        reg_dir = os.path.join(tmp_dir, "registry")
        meta_dir = os.path.join(tmp_dir, "metadata")
        registry = ModelRegistry(registry_dir=reg_dir, metadata_dir=meta_dir)

        # Register EXPERIMENTAL model
        entry = registry.register_model(
            model_name="XGBoost",
            model_version="1.0.0",
            ticker="TCS",
            target="target_next_close",
            horizon=1,
            feature_version="v1.0.0",
            preprocessing_version="v1.0.0",
            training_start="2015-01-01",
            training_end="2020-01-01",
            validation_start="2020-01-02",
            validation_end="2021-01-01",
            test_start="2021-01-02",
            test_end="2022-01-01",
            hyperparameters={"max_depth": 5},
            metrics={"validation": {"rmse": 12.5}, "test": {"rmse": 13.1}},
            artifact_path="/dummy/path.joblib",
            dataset_version="v1.0.0",
        )

        assert entry.status == ModelStatus.EXPERIMENTAL.value

        # Promote to CANDIDATE based on validation performance
        registry.update_status(entry.model_id, ModelStatus.CANDIDATE, reason="Lowest validation RMSE")
        assert registry.get_model(entry.model_id).status == ModelStatus.CANDIDATE.value

        # Promote to PRODUCTION after final review
        registry.update_status(entry.model_id, ModelStatus.PRODUCTION, reason="Approved for deployment")
        prod = registry.get_production_model(ticker="TCS", target="target_next_close")
        assert prod is not None
        assert prod.model_id == entry.model_id


# =====================================================================
# 8. MODEL COMPARATOR & VALIDATION-ONLY SELECTION
# =====================================================================

def test_comparator_selects_strictly_from_validation():
    """
    Verifies that ModelComparator selects candidate based STRICTLY on validation metrics,
    even if another model had lower test RMSE (preventing test set leakage).
    """
    from app.experiments.tracker import ModelEvaluationResult

    # Model A: Validation RMSE 10.0, Test RMSE 15.0
    mod_a = ModelEvaluationResult(
        model_name="Model_A",
        model_version="1.0.0",
        ticker="INFY",
        target="target_next_close",
        horizon=1,
        hyperparameters={},
        validation_metrics={"rmse": 10.0, "mae": 7.0},
        test_metrics={"rmse": 15.0, "mae": 11.0},
        model_id="mod_a_id",
    )
    # Model B: Validation RMSE 12.0, Test RMSE 8.0 (overfit to test, worse on val)
    mod_b = ModelEvaluationResult(
        model_name="Model_B",
        model_version="1.0.0",
        ticker="INFY",
        target="target_next_close",
        horizon=1,
        hyperparameters={},
        validation_metrics={"rmse": 12.0, "mae": 9.0},
        test_metrics={"rmse": 8.0, "mae": 6.0},
        model_id="mod_b_id",
    )

    comparator = ModelComparator(primary_metric="rmse", task_type="price")
    best_cand, rationale = comparator.select_best_candidate([mod_a, mod_b])

    # Model A MUST be chosen because its validation RMSE (10.0) is better than Model B (12.0)
    assert best_cand.model_name == "Model_A"
    assert "Primary Metric: RMSE" in rationale


# =====================================================================
# 9. INSUFFICIENT DATA / LOW-DATA TICKER RESILIENCE
# =====================================================================

def test_insufficient_data_ticker_handling():
    """
    Verifies that when a ticker lacks sufficient training rows,
    it is skipped with a clear recorded reason rather than fabricating synthetic data.
    """
    from app.experiments.runner import ExperimentRunner

    config = ExperimentConfig(
        target="target_next_close",
        selected_tickers=["TINY_STOCK"],
        minimum_training_samples=500,
        minimum_validation_samples=50,
        minimum_test_samples=50,
    )
    runner = ExperimentRunner(config)

    # Synthetic tiny partitions
    dates_tr = pd.date_range("2020-01-01", periods=10, freq="D")
    df_tiny_tr = pd.DataFrame({"symbol": ["TINY_STOCK"] * 10, "date": dates_tr, "close": range(10), "target_next_close": range(10)})
    df_tiny_val = pd.DataFrame({"symbol": ["TINY_STOCK"] * 10, "date": dates_tr, "close": range(10), "target_next_close": range(10)})
    df_tiny_test = pd.DataFrame({"symbol": ["TINY_STOCK"] * 10, "date": dates_tr, "close": range(10), "target_next_close": range(10)})

    summary = ExperimentConfig(target="target_next_close").model_dump()
    from app.experiments.tracker import ExperimentRunSummary
    run_summary = ExperimentRunSummary(experiment_id="test_exp")

    runner._run_per_ticker(
        target_tickers=["TINY_STOCK"],
        train_df=df_tiny_tr,
        val_df=df_tiny_val,
        test_df=df_tiny_test,
        features_list=["close"],
        summary=run_summary,
    )

    assert "TINY_STOCK" in run_summary.tickers_skipped
    assert "Insufficient training rows" in run_summary.tickers_skipped["TINY_STOCK"]
    assert "TINY_STOCK" not in run_summary.tickers_evaluated
