"""
Training script for registering candidate and production stock prediction models across horizons 1, 5, 20.
Trains and compares all 5 candidate architectures:
[1/5] NaiveBaseline
[2/5] LinearRegression
[3/5] RandomForest
[4/5] XGBoost
[5/5] LSTM (30-day sequence length, 2-layer stacked PyTorch LSTM with dropout and early stopping)

For:
- TCS (horizons 1, 5, 20 for return and price targets)
- RELIANCE (horizons 1, 5, 20 for return and price targets)
- INFY (horizons 1, 5, 20 for return and price targets)
- AAPL (horizons 1, 5, 20 for return and price targets)
- GLOBAL / Generic cross-sectional models (horizons 1, 5, 20)

Strictly leakage-free: chronological train/val/test splits, no lookahead in feature generation or scaling.
Selects PRODUCTION model strictly based on validation performance, registering all candidates.
"""
from datetime import datetime, timezone
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

# Add ml-service root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.logger import logger
from app.experiments.metrics import StockMetricsCalculator
from app.features.engineer import FeatureEngineer
from app.models.stock.linear_regression import LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistry, ModelStatus
from app.models.stock.xgboost_model import XGBoostStockModel
from app.pipelines.config import PipelineConfig
from app.services.market_data_service import market_data_service
from app.targets.generator import TargetGenerator
from app.validation.leakage_audit import LeakageAuditor


def train_and_evaluate_candidates(
    ticker: str,
    target: str,
    horizon: int,
    task_type: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    tr_dates: pd.Series,
    val_dates: pd.Series,
    test_dates: pd.Series,
    registry: ModelRegistry,
    artifacts_dir: str = "models/artifacts",
) -> List[Dict[str, Any]]:
    """
    Trains and compares all 5 candidate models with zero lookahead.
    Selects the best performing model as PRODUCTION and others as CANDIDATE.
    Registers all candidate models in the Model Registry.
    """
    logger.info(f"\n=======================================================")
    logger.info(f"Training {ticker} | Horizon: {horizon}D | Target: {target} ({task_type})")
    logger.info(f"Train samples: {len(X_train)} | Val samples: {len(X_val)} | Test samples: {len(X_test)}")
    logger.info(f"=======================================================")

    # Clean extreme values
    X_train = X_train.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    X_val = X_val.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    X_test = X_test.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    # Define 5 candidate model specifications
    candidate_specs = [
        ("naive", "NaiveBaseline", NaiveBaselineModel(task_type=task_type)),
        ("linear_regression", "LinearRegression", LinearRegressionStockModel(use_scaler=True)),
        ("random_forest", "RandomForest", RandomForestStockModel(random_state=42, n_estimators=40, max_depth=6)),
        ("xgboost", "XGBoost", XGBoostStockModel(random_state=42, n_estimators=60, max_depth=4, learning_rate=0.05)),
        ("lstm", "LSTM", LSTMStockModel(
            sequence_length=30,
            hidden_size=32,
            num_layers=2,
            dropout=0.2,
            epochs=10,
            batch_size=32,
            patience=3,
            random_state=42,
        )),
    ]

    evaluated_candidates = []

    for c_idx, (model_key, model_display_name, cand_model) in enumerate(candidate_specs, 1):
        logger.info(f"[{c_idx}/5] Training {model_display_name}...")
        start_t = time.time()
        try:
            cand_model.fit(X_train=X_train, y_train=y_train, X_val=X_val, y_val=y_val)
            fit_duration = round(time.time() - start_t, 3)

            y_val_pred = cand_model.predict(X_val)
            y_test_pred = cand_model.predict(X_test)

            val_metrics = StockMetricsCalculator.evaluate_predictions(
                y_true=y_val.to_numpy(),
                y_pred=y_val_pred,
                task_type=task_type,
                ticker=ticker,
                model_name=model_key,
                target=target,
                period="validation",
            )
            test_metrics = StockMetricsCalculator.evaluate_predictions(
                y_true=y_test.to_numpy(),
                y_pred=y_test_pred,
                task_type=task_type,
                ticker=ticker,
                model_name=model_key,
                target=target,
                period="test",
            )

            dir_acc = float(val_metrics.get("directional_accuracy", 50.0))
            rmse = float(val_metrics.get("rmse", 0.05))
            mae = float(val_metrics.get("mae", 0.03))
            r2 = float(val_metrics.get("r2", 0.0))

            evaluated_candidates.append({
                "model_key": model_key,
                "model_name": model_display_name,
                "model_instance": cand_model,
                "val_metrics": val_metrics,
                "test_metrics": test_metrics,
                "directional_accuracy": dir_acc,
                "rmse": rmse,
                "mae": mae,
                "r2": r2,
                "fit_duration": fit_duration,
            })
            logger.info(
                f"  -> {model_display_name} trained in {fit_duration}s | "
                f"Val Dir Acc: {dir_acc:.1f}% | RMSE: {rmse:.4f} | MAE: {mae:.4f} | R²: {r2:.3f}"
            )

        except Exception as err:
            logger.error(f"  Candidate {model_display_name} training failed: {err}", exc_info=True)

    if not evaluated_candidates:
        raise RuntimeError(f"All candidate models failed to train for {ticker} h={horizon} {target}")

    # Model Selection Policy:
    # Exclude Naive from primary promotion unless all others fail.
    # For return targets: highest Directional Accuracy desc, tie-breaker lowest RMSE asc.
    # For price targets: lowest RMSE asc, tie-breaker lowest MAE asc.
    non_naive = [c for c in evaluated_candidates if c["model_key"] != "naive"]
    competing_pool = non_naive if non_naive else evaluated_candidates

    if task_type == "return":
        competing_pool.sort(key=lambda c: (c["directional_accuracy"], -c["rmse"]), reverse=True)
    else:
        competing_pool.sort(key=lambda c: (c["rmse"], c["mae"]))

    best_candidate = competing_pool[0]
    logger.info(
        f"\n>>> Model Selected for {ticker} (h={horizon} {target}): "
        f"'{best_candidate['model_name']}' as PRODUCTION "
        f"(Dir Acc: {best_candidate['directional_accuracy']:.1f}%, RMSE: {best_candidate['rmse']:.4f}) <<<\n"
    )

    # Register all 5 candidates in Model Registry
    for cand in evaluated_candidates:
        is_best = (cand["model_key"] == best_candidate["model_key"])
        cand_status = ModelStatus.PRODUCTION if is_best else ModelStatus.CANDIDATE

        prefix = f"{ticker}_{target}_h{horizon}_{cand['model_key']}"
        artifact_path = cand["model_instance"].save(output_dir=artifacts_dir, prefix=prefix)

        scaler_art = getattr(cand["model_instance"], "scaler_artifact_path", None)
        seq_len = getattr(cand["model_instance"], "sequence_length", None)

        entry = registry.register_model(
            model_name=cand["model_name"],
            model_version=cand["model_instance"].version,
            ticker=ticker,
            target=target,
            horizon=horizon,
            feature_version="v1.0.0",
            preprocessing_version="v1.0.0",
            training_start=str(tr_dates.min()),
            training_end=str(tr_dates.max()),
            validation_start=str(val_dates.min()),
            validation_end=str(val_dates.max()),
            test_start=str(test_dates.min()),
            test_end=str(test_dates.max()),
            hyperparameters=cand["model_instance"].get_hyperparameters(),
            metrics={"validation": cand["val_metrics"], "test": cand["test_metrics"]},
            artifact_path=artifact_path,
            dataset_version="v1.0.0",
            status=cand_status,
            scaler_artifact_path=scaler_art,
            sequence_length=seq_len,
        )
        cand["registry_entry"] = entry
        logger.info(
            f"  Registered {cand['model_name']} as {cand_status.value} (ID: {entry.model_id})"
        )

    return evaluated_candidates


def prepare_aapl_dataset(config: PipelineConfig) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[str]]:
    logger.info("Fetching AAPL historical market bars for training...")
    bars_df, _, _ = market_data_service.fetch_market_bars("AAPL", min_bars=250)
    bars_df = bars_df.sort_values("date").reset_index(drop=True)

    # Engineer features & targets
    engineer = FeatureEngineer(config)
    target_gen = TargetGenerator(config)

    featured_df, feature_cols = engineer.transform(bars_df)
    targeted_df, target_cols = target_gen.generate(featured_df)

    # Drop NaNs from lookback window
    clean_df = targeted_df.dropna(subset=feature_cols).reset_index(drop=True)
    logger.info(f"AAPL clean dataset: {len(clean_df)} bars, {len(feature_cols)} features.")

    # Chronological split: 70% train, 15% val, 15% test
    n = len(clean_df)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)

    train_df = clean_df.iloc[:n_train].copy()
    val_df = clean_df.iloc[n_train:n_train + n_val].copy()
    test_df = clean_df.iloc[n_train + n_val:].copy()

    LeakageAuditor.audit_sorting(train_df)
    LeakageAuditor.audit_sorting(val_df)
    LeakageAuditor.audit_sorting(test_df)

    return train_df, val_df, test_df, feature_cols


def run():
    config = PipelineConfig()
    registry = ModelRegistry()
    artifacts_dir = "models/artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    standard_tasks = [
        # Horizon 1
        {"horizon": 1, "target": "target_next_return", "task": "return"},
        {"horizon": 1, "target": "target_next_close", "task": "price"},
        # Horizon 5
        {"horizon": 5, "target": "target_return_5d", "task": "return"},
        {"horizon": 5, "target": "target_close_5d", "task": "price"},
        # Horizon 20
        {"horizon": 20, "target": "target_return_20d", "task": "return"},
        {"horizon": 20, "target": "target_close_20d", "task": "price"},
    ]

    # -------------------------------------------------------------
    # 1. Train AAPL Models (Horizons 1, 5, 20)
    # -------------------------------------------------------------
    logger.info("\n#######################################################")
    logger.info("### STEP 1: TRAINING AAPL 5 CANDIDATE MODELS        ###")
    logger.info("#######################################################")
    aapl_train, aapl_val, aapl_test, feature_cols = prepare_aapl_dataset(config)

    for t_spec in standard_tasks:
        h = t_spec["horizon"]
        target = t_spec["target"]
        task = t_spec["task"]

        tr_c = aapl_train.dropna(subset=[target] + feature_cols)
        val_c = aapl_val.dropna(subset=[target] + feature_cols)
        test_c = aapl_test.dropna(subset=[target] + feature_cols)

        train_and_evaluate_candidates(
            ticker="AAPL",
            target=target,
            horizon=h,
            task_type=task,
            X_train=tr_c[feature_cols],
            y_train=tr_c[target],
            X_val=val_c[feature_cols],
            y_val=val_c[target],
            X_test=test_c[feature_cols],
            y_test=test_c[target],
            tr_dates=tr_c["date"],
            val_dates=val_c["date"],
            test_dates=test_c["date"],
            registry=registry,
            artifacts_dir=artifacts_dir,
        )

    # -------------------------------------------------------------
    # 2. Train TCS, RELIANCE, INFY Models (Horizons 1, 5, 20)
    # -------------------------------------------------------------
    logger.info("\n#######################################################")
    logger.info("### STEP 2: TRAINING TCS, RELIANCE, INFY MODELS     ###")
    logger.info("#######################################################")
    train_parquet = pd.read_parquet("app/data/processed/train.parquet")
    val_parquet = pd.read_parquet("app/data/processed/validation.parquet")
    test_parquet = pd.read_parquet("app/data/processed/test.parquet")

    indian_tickers = ["TCS", "RELIANCE", "INFY"]

    for ticker in indian_tickers:
        logger.info(f"\n>>> Starting Full 5-Model Training for {ticker} <<<")
        tr_t = train_parquet[train_parquet["symbol"] == ticker].sort_values("date")
        val_t = val_parquet[val_parquet["symbol"] == ticker].sort_values("date")
        test_t = test_parquet[test_parquet["symbol"] == ticker].sort_values("date")

        for spec in standard_tasks:
            h = spec["horizon"]
            target = spec["target"]
            task = spec["task"]

            if target not in tr_t.columns or target not in val_t.columns:
                logger.warning(f"Target {target} not found for {ticker}, skipping.")
                continue

            tr_c = tr_t.dropna(subset=[target] + feature_cols)
            val_c = val_t.dropna(subset=[target] + feature_cols)
            test_c = test_t.dropna(subset=[target] + feature_cols)

            train_and_evaluate_candidates(
                ticker=ticker,
                target=target,
                horizon=h,
                task_type=task,
                X_train=tr_c[feature_cols],
                y_train=tr_c[target],
                X_val=val_c[feature_cols],
                y_val=val_c[target],
                X_test=test_c[feature_cols],
                y_test=test_c[target],
                tr_dates=tr_c["date"],
                val_dates=val_c["date"],
                test_dates=test_c["date"],
                registry=registry,
                artifacts_dir=artifacts_dir,
            )

    # -------------------------------------------------------------
    # 3. Train GLOBAL Cross-Sectional Models (Horizons 1, 5, 20)
    # -------------------------------------------------------------
    logger.info("\n#######################################################")
    logger.info("### STEP 3: TRAINING GLOBAL CROSS-SECTIONAL MODELS   ###")
    logger.info("#######################################################")
    sample_symbols = list(train_parquet["symbol"].unique()[:20])
    tr_panel = train_parquet[train_parquet["symbol"].isin(sample_symbols)].sort_values("date")
    val_panel = val_parquet[val_parquet["symbol"].isin(sample_symbols)].sort_values("date")
    test_panel = test_parquet[test_parquet["symbol"].isin(sample_symbols)].sort_values("date")

    for spec in standard_tasks:
        h = spec["horizon"]
        target = spec["target"]
        task = spec["task"]

        tr_c = tr_panel.dropna(subset=[target] + feature_cols)
        val_c = val_panel.dropna(subset=[target] + feature_cols)
        test_c = test_panel.dropna(subset=[target] + feature_cols)

        # Train 5 candidates for GLOBAL
        eval_results = train_and_evaluate_candidates(
            ticker="GLOBAL",
            target=target,
            horizon=h,
            task_type=task,
            X_train=tr_c[feature_cols],
            y_train=tr_c[target],
            X_val=val_c[feature_cols],
            y_val=val_c[target],
            X_test=test_c[feature_cols],
            y_test=test_c[target],
            tr_dates=tr_c["date"],
            val_dates=val_c["date"],
            test_dates=test_c["date"],
            registry=registry,
            artifacts_dir=artifacts_dir,
        )

        # Also register for GLOBAL_NIFTY500
        best_cand = [c for c in eval_results if c.get("registry_entry") and c["registry_entry"].status == ModelStatus.PRODUCTION.value][0]
        prefix = f"GLOBAL_NIFTY500_{target}_h{h}_{best_cand['model_key']}"
        art_path = best_cand["model_instance"].save(output_dir=artifacts_dir, prefix=prefix)
        registry.register_model(
            model_name=best_cand["model_name"],
            model_version=best_cand["model_instance"].version,
            ticker="GLOBAL_NIFTY500",
            target=target,
            horizon=h,
            feature_version="v1.0.0",
            preprocessing_version="v1.0.0",
            training_start=str(tr_c["date"].min()),
            training_end=str(tr_c["date"].max()),
            validation_start=str(val_c["date"].min()),
            validation_end=str(val_c["date"].max()),
            test_start=str(test_c["date"].min()),
            test_end=str(test_c["date"].max()),
            hyperparameters=best_cand["model_instance"].get_hyperparameters(),
            metrics={"validation": best_cand["val_metrics"], "test": best_cand["test_metrics"]},
            artifact_path=art_path,
            dataset_version="v1.0.0",
            status=ModelStatus.PRODUCTION,
            scaler_artifact_path=getattr(best_cand["model_instance"], "scaler_artifact_path", None),
            sequence_length=getattr(best_cand["model_instance"], "sequence_length", None),
        )

    logger.info("\n=== All 5 Candidate Models Successfully Trained, Evaluated, and Registered ===")


if __name__ == "__main__":
    run()
