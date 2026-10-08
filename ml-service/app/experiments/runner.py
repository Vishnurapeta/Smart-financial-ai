"""
Stock prediction model experimentation runner.
Coordinates multi-ticker and global model training, chronological validation,
strict leakage auditing, metric evaluation, artifact persistence, and registry tracking.
"""
from datetime import datetime, timezone
import json
import os
import time
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.core.logger import logger
from app.experiments.comparator import ModelComparator
from app.experiments.config import ExperimentConfig
from app.experiments.fingerprint import DatasetFingerprinter
from app.experiments.metrics import StockMetricsCalculator
from app.experiments.tracker import (
    ExperimentRunSummary,
    ExperimentTracker,
    ModelEvaluationResult,
)
from app.experiments.visualizer import VisualReporter
from app.models.stock.base import BaseStockModel
from app.models.stock.linear_regression import LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistry, ModelStatus
from app.models.stock.xgboost_model import XGBoostStockModel
from app.validation.leakage_audit import DataLeakageError, LeakageAuditor


class ExperimentRunner:
    """Executes reproducible stock forecasting experiments across models and tickers."""

    def __init__(self, config: ExperimentConfig):
        self.config = config
        self.tracker = ExperimentTracker(
            results_dir=config.results_dir, configs_dir=config.configs_dir
        )
        self.registry = ModelRegistry(
            registry_dir=config.registry_dir, metadata_dir=config.metadata_dir
        )
        self.visualizer = VisualReporter(reports_dir=config.reports_dir)
        self.comparator = ModelComparator(task_type=config.task_type)
        self.fingerprinter = DatasetFingerprinter()

    def _instantiate_model(self, model_key: str) -> BaseStockModel:
        """Instantiates model according to configuration."""
        key = model_key.lower()
        if key in ["naive", "baseline", "naive_baseline"]:
            return NaiveBaselineModel(task_type=self.config.task_type)
        elif key in ["linear_regression", "lr"]:
            return LinearRegressionStockModel(**self.config.linear_regression_params)
        elif key in ["random_forest", "rf"]:
            return RandomForestStockModel(
                random_state=self.config.random_seed,
                **self.config.random_forest_params,
            )
        elif key in ["xgboost", "xgb"]:
            return XGBoostStockModel(
                random_state=self.config.random_seed,
                **self.config.xgboost_params,
            )
        elif key in ["lstm", "deep_learning"]:
            return LSTMStockModel(
                random_seed=self.config.random_seed,
                **self.config.lstm_params,
            )
        else:
            raise ValueError(f"Unsupported model key '{model_key}'.")

    def run(self) -> ExperimentRunSummary:
        """
        Executes the complete experimentation workflow.
        Returns the finalized ExperimentRunSummary.
        """
        logger.info(
            f"Starting Experiment {self.config.experiment_id} | Mode: {self.config.training_mode} | Target: {self.config.target}"
        )

        # 1. Dataset Fingerprint
        raw_csv_path = "app/data/raw/nifty500_stocks.csv"
        processed_parquet_path = self.config.dataset_path
        dataset_meta = self.fingerprinter.generate_fingerprint(
            raw_csv_path=raw_csv_path,
            processed_parquet_path=processed_parquet_path,
        )

        # 2. Load Processed Parquet Partitions
        base_dir = os.path.dirname(self.config.dataset_path)
        train_path = os.path.join(base_dir, "train.parquet")
        val_path = os.path.join(base_dir, "validation.parquet")
        test_path = os.path.join(base_dir, "test.parquet")

        if not (os.path.exists(train_path) and os.path.exists(val_path) and os.path.exists(test_path)):
            raise FileNotFoundError(
                f"Missing split parquet files at {base_dir}. Run prompt 14 pipeline first."
            )

        logger.info(f"Loading partitions from {base_dir}...")
        train_df = pd.read_parquet(train_path)
        val_df = pd.read_parquet(val_path)
        test_df = pd.read_parquet(test_path)

        # 3. Leakage Audit on Temporal Ordering
        LeakageAuditor.audit_temporal_order(train_df, val_df, test_df, date_col="date")
        logger.info("Temporal ordering verified: Train < Validation < Test. No temporal overlap.")

        # 4. Feature and Target Discovery
        meta_json_path = self.config.metadata_path
        features_list: List[str] = []
        if os.path.exists(meta_json_path):
            with open(meta_json_path, "r", encoding="utf-8") as f:
                meta_data = json.load(f)
                features_list = meta_data.get("features_list", [])

        if not features_list:
            # Fallback: extract numeric non-target, non-metadata columns
            forbidden = set(LeakageAuditor.METADATA_COLUMNS)
            features_list = [
                c for c in train_df.columns
                if not c.startswith(LeakageAuditor.FORBIDDEN_PREFIXES)
                and c not in forbidden
                and pd.api.types.is_numeric_dtype(train_df[c])
            ]

        # Audit feature names to ensure target is NEVER inside feature matrix X
        LeakageAuditor.audit_features(features_list, self.config.target)
        logger.info(f"Feature set verified: {len(features_list)} features. Zero target leakage detected.")

        # Initialize Summary Record
        summary = ExperimentRunSummary(
            experiment_id=self.config.experiment_id,
            training_mode=self.config.training_mode,
            target=self.config.target,
            task_type=self.config.task_type,
            random_seed=self.config.random_seed,
            dataset_version=dataset_meta.get("version", "v1.0.0"),
            dataset_sha256=dataset_meta.get("raw_checksum_sha256", ""),
            feature_count=len(features_list),
            feature_names=features_list,
            models_executed=self.config.models_to_run,
            training_period={
                "start": str(train_df["date"].min()),
                "end": str(train_df["date"].max()),
                "total_rows": len(train_df),
            },
            validation_period={
                "start": str(val_df["date"].min()),
                "end": str(val_df["date"].max()),
                "total_rows": len(val_df),
            },
            test_period={
                "start": str(test_df["date"].min()),
                "end": str(test_df["date"].max()),
                "total_rows": len(test_df),
            },
        )

        # Save configuration snapshot
        self.tracker.save_config(self.config.experiment_id, self.config.model_dump())

        # Determine Tickers
        all_train_tickers = set(train_df["symbol"].unique())
        all_val_tickers = set(val_df["symbol"].unique())
        all_test_tickers = set(test_df["symbol"].unique())
        common_tickers = sorted(all_train_tickers & all_val_tickers & all_test_tickers)

        if self.config.selected_tickers:
            target_tickers = [t for t in self.config.selected_tickers if t in common_tickers]
            skipped_missing = [t for t in self.config.selected_tickers if t not in common_tickers]
            for sm in skipped_missing:
                summary.tickers_skipped[sm] = "Ticker not found in all three partition splits."
        else:
            target_tickers = common_tickers

        logger.info(f"Identified {len(target_tickers)} eligible tickers for experiment evaluation.")

        # Execute training based on mode
        if self.config.training_mode == "per_ticker":
            self._run_per_ticker(
                target_tickers=target_tickers,
                train_df=train_df,
                val_df=val_df,
                test_df=test_df,
                features_list=features_list,
                summary=summary,
            )
        else:
            self._run_global(
                target_tickers=target_tickers,
                train_df=train_df,
                val_df=val_df,
                test_df=test_df,
                features_list=features_list,
                summary=summary,
            )

        # Save completed experiment summary
        self.tracker.save_results(summary)
        logger.info(f"Experiment {self.config.experiment_id} completed successfully.")
        return summary

    def _run_per_ticker(
        self,
        target_tickers: List[str],
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
        test_df: pd.DataFrame,
        features_list: List[str],
        summary: ExperimentRunSummary,
    ) -> None:
        """Executes per-ticker models with strict per-ticker isolation."""
        target_col = self.config.target

        for ticker in target_tickers:
            logger.info(f"--- Processing Ticker: {ticker} ---")

            # Slice and sort per ticker
            tr_sub = train_df[train_df["symbol"] == ticker].sort_values("date").copy()
            val_sub = val_df[val_df["symbol"] == ticker].sort_values("date").copy()
            test_sub = test_df[test_df["symbol"] == ticker].sort_values("date").copy()

            # Audit ticker isolation & sorting
            LeakageAuditor.audit_ticker_isolation(tr_sub, ticker)
            LeakageAuditor.audit_ticker_isolation(val_sub, ticker)
            LeakageAuditor.audit_ticker_isolation(test_sub, ticker)
            LeakageAuditor.audit_sorting(tr_sub)
            LeakageAuditor.audit_sorting(val_sub)
            LeakageAuditor.audit_sorting(test_sub)

            # Sample count checks
            if len(tr_sub) < self.config.minimum_training_samples:
                reason = f"Insufficient training rows ({len(tr_sub)} < {self.config.minimum_training_samples})"
                logger.warning(f"Skipping {ticker}: {reason}")
                summary.tickers_skipped[ticker] = reason
                continue
            if len(val_sub) < self.config.minimum_validation_samples:
                reason = f"Insufficient validation rows ({len(val_sub)} < {self.config.minimum_validation_samples})"
                logger.warning(f"Skipping {ticker}: {reason}")
                summary.tickers_skipped[ticker] = reason
                continue
            if len(test_sub) < self.config.minimum_test_samples:
                reason = f"Insufficient test rows ({len(test_sub)} < {self.config.minimum_test_samples})"
                logger.warning(f"Skipping {ticker}: {reason}")
                summary.tickers_skipped[ticker] = reason
                continue

            # Drop missing values in target or features
            tr_clean = tr_sub.dropna(subset=[target_col] + features_list)
            val_clean = val_sub.dropna(subset=[target_col] + features_list)
            test_clean = test_sub.dropna(subset=[target_col] + features_list)

            X_train = tr_clean[features_list].copy()
            y_train = tr_clean[target_col].copy()
            X_val = val_clean[features_list].copy()
            y_val = val_clean[target_col].copy()
            X_test = test_clean[features_list].copy()
            y_test = test_clean[target_col].copy()

            summary.tickers_evaluated.append(ticker)
            ticker_eval_results: List[ModelEvaluationResult] = []

            for model_key in self.config.models_to_run:
                logger.info(f"Training {model_key} on {ticker}...")
                start_time = time.time()
                try:
                    model = self._instantiate_model(model_key)
                    # Train model (early stopping uses validation split if supported)
                    model.fit(X_train=X_train, y_train=y_train, X_val=X_val, y_val=y_val)
                    duration = round(time.time() - start_time, 3)

                    # Predictions
                    y_val_pred = model.predict(X_val)
                    y_test_pred = model.predict(X_test)

                    # Compute Metrics
                    val_metrics = StockMetricsCalculator.evaluate_predictions(
                        y_true=y_val.to_numpy(),
                        y_pred=y_val_pred,
                        task_type=self.config.task_type,
                        ticker=ticker,
                        model_name=model_key,
                        target=self.config.target,
                        period="validation",
                    )
                    test_metrics = StockMetricsCalculator.evaluate_predictions(
                        y_true=y_test.to_numpy(),
                        y_pred=y_test_pred,
                        task_type=self.config.task_type,
                        ticker=ticker,
                        model_name=model_key,
                        target=self.config.target,
                        period="test",
                    )

                    # Save Model Artifact
                    prefix = f"{ticker}_{self.config.target}_{model_key}"
                    artifact_path = model.save(
                        output_dir=self.config.artifacts_dir, prefix=prefix
                    )

                    # Register in Model Registry as EXPERIMENTAL
                    reg_entry = self.registry.register_model(
                        model_name=model.name,
                        model_version=model.version,
                        ticker=ticker,
                        target=self.config.target,
                        horizon=1,
                        feature_version="v1.0.0",
                        preprocessing_version="v1.0.0",
                        training_start=str(tr_clean["date"].min()),
                        training_end=str(tr_clean["date"].max()),
                        validation_start=str(val_clean["date"].min()),
                        validation_end=str(val_clean["date"].max()),
                        test_start=str(test_clean["date"].min()),
                        test_end=str(test_clean["date"].max()),
                        hyperparameters=model.get_hyperparameters(),
                        metrics={
                            "validation": val_metrics,
                            "test": test_metrics,
                        },
                        artifact_path=artifact_path,
                        dataset_version=summary.dataset_version,
                        status=ModelStatus.EXPERIMENTAL,
                    )

                    # Generate Visual Diagnostic Charts
                    try:
                        dates_test = test_clean["date"].astype(str).tolist()
                        self.visualizer.plot_actual_vs_predicted(
                            dates=dates_test,
                            y_true=y_test.to_numpy(),
                            y_pred=y_test_pred,
                            ticker=ticker,
                            model_name=model_key,
                            target=self.config.target,
                            split="test",
                        )
                        self.visualizer.plot_residuals_distribution(
                            y_true=y_test.to_numpy(),
                            y_pred=y_test_pred,
                            ticker=ticker,
                            model_name=model_key,
                            target=self.config.target,
                            split="test",
                        )
                        if isinstance(model, LSTMStockModel) and model.train_loss_history:
                            self.visualizer.plot_lstm_loss_curve(
                                train_losses=model.train_loss_history,
                                val_losses=model.val_loss_history,
                                ticker=ticker,
                            )
                    except Exception as plot_err:
                        logger.warning(f"Could not generate plot for {ticker} {model_key}: {plot_err}")

                    res = ModelEvaluationResult(
                        model_name=model_key,
                        model_version=model.version,
                        ticker=ticker,
                        target=self.config.target,
                        horizon=1,
                        hyperparameters=model.get_hyperparameters(),
                        validation_metrics=val_metrics,
                        test_metrics=test_metrics,
                        artifact_path=artifact_path,
                        model_id=reg_entry.model_id,
                        training_duration_seconds=duration,
                        status="SUCCESS",
                    )
                    ticker_eval_results.append(res)
                    summary.results.append(res.to_dict())

                except DataLeakageError:
                    # Critical leakage must fail pipeline immediately
                    raise
                except Exception as e:
                    logger.error(f"Model {model_key} failed on {ticker}: {e}", exc_info=True)
                    fail_rec = {
                        "ticker": ticker,
                        "model": model_key,
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    summary.failed_models.append(fail_rec)

            # Model Selection strictly based on VALIDATION split
            if ticker_eval_results:
                best_cand, rationale = self.comparator.select_best_candidate(ticker_eval_results)
                if best_cand and best_cand.model_id:
                    self.registry.update_status(
                        model_id=best_cand.model_id,
                        new_status=ModelStatus.CANDIDATE,
                        reason=rationale,
                    )
                    logger.info(f"Promoted {best_cand.model_name} to CANDIDATE for {ticker}:\n{rationale}")
                    if summary.production_candidate is None:
                        summary.production_candidate = {
                            "ticker": ticker,
                            "model_id": best_cand.model_id,
                            "model_name": best_cand.model_name,
                            "rationale": rationale,
                            "validation_metrics": best_cand.validation_metrics,
                            "test_metrics": best_cand.test_metrics,
                        }

                # Output comparison table to logs
                val_table = self.comparator.generate_ascii_table(ticker_eval_results, split="validation")
                test_table = self.comparator.generate_ascii_table(ticker_eval_results, split="test")
                logger.info(f"\n{val_table}\n\n{test_table}")

    def _run_global(
        self,
        target_tickers: List[str],
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
        test_df: pd.DataFrame,
        features_list: List[str],
        summary: ExperimentRunSummary,
    ) -> None:
        """Executes global/panel models across all eligible tickers."""
        target_col = self.config.target

        # Filter to target tickers
        tr_panel = train_df[train_df["symbol"].isin(target_tickers)].dropna(subset=[target_col] + features_list)
        val_panel = val_df[val_df["symbol"].isin(target_tickers)].dropna(subset=[target_col] + features_list)
        test_panel = test_df[test_df["symbol"].isin(target_tickers)].dropna(subset=[target_col] + features_list)

        logger.info(
            f"Global Panel Shape - Train: {tr_panel.shape}, Val: {val_panel.shape}, Test: {test_panel.shape}"
        )

        X_train = tr_panel[features_list].copy()
        y_train = tr_panel[target_col].copy()
        X_val = val_panel[features_list].copy()
        y_val = val_panel[target_col].copy()
        X_test = test_panel[features_list].copy()
        y_test = test_panel[target_col].copy()

        summary.tickers_evaluated = target_tickers
        global_results: List[ModelEvaluationResult] = []

        for model_key in self.config.models_to_run:
            logger.info(f"Training Global {model_key} model...")
            start_time = time.time()
            try:
                model = self._instantiate_model(model_key)
                model.fit(X_train=X_train, y_train=y_train, X_val=X_val, y_val=y_val)
                duration = round(time.time() - start_time, 3)

                y_val_pred = model.predict(X_val)
                y_test_pred = model.predict(X_test)

                val_metrics = StockMetricsCalculator.evaluate_predictions(
                    y_true=y_val.to_numpy(),
                    y_pred=y_val_pred,
                    task_type=self.config.task_type,
                    ticker="GLOBAL",
                    model_name=model_key,
                    target=self.config.target,
                    period="validation",
                )
                test_metrics = StockMetricsCalculator.evaluate_predictions(
                    y_true=y_test.to_numpy(),
                    y_pred=y_test_pred,
                    task_type=self.config.task_type,
                    ticker="GLOBAL",
                    model_name=model_key,
                    target=self.config.target,
                    period="test",
                )

                prefix = f"GLOBAL_{self.config.target}_{model_key}"
                artifact_path = model.save(
                    output_dir=self.config.artifacts_dir, prefix=prefix
                )

                reg_entry = self.registry.register_model(
                    model_name=f"Global_{model.name}",
                    model_version=model.version,
                    ticker="GLOBAL_NIFTY500",
                    target=self.config.target,
                    horizon=1,
                    feature_version="v1.0.0",
                    preprocessing_version="v1.0.0",
                    training_start=str(tr_panel["date"].min()),
                    training_end=str(tr_panel["date"].max()),
                    validation_start=str(val_panel["date"].min()),
                    validation_end=str(val_panel["date"].max()),
                    test_start=str(test_panel["date"].min()),
                    test_end=str(test_panel["date"].max()),
                    hyperparameters=model.get_hyperparameters(),
                    metrics={"validation": val_metrics, "test": test_metrics},
                    artifact_path=artifact_path,
                    dataset_version=summary.dataset_version,
                    status=ModelStatus.EXPERIMENTAL,
                )

                res = ModelEvaluationResult(
                    model_name=f"global_{model_key}",
                    model_version=model.version,
                    ticker="GLOBAL",
                    target=self.config.target,
                    horizon=1,
                    hyperparameters=model.get_hyperparameters(),
                    validation_metrics=val_metrics,
                    test_metrics=test_metrics,
                    artifact_path=artifact_path,
                    model_id=reg_entry.model_id,
                    training_duration_seconds=duration,
                    status="SUCCESS",
                )
                global_results.append(res)
                summary.results.append(res.to_dict())

            except DataLeakageError:
                raise
            except Exception as e:
                logger.error(f"Global model {model_key} failed: {e}", exc_info=True)
                summary.failed_models.append({
                    "ticker": "GLOBAL",
                    "model": model_key,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

        if global_results:
            best_cand, rationale = self.comparator.select_best_candidate(global_results)
            if best_cand and best_cand.model_id:
                self.registry.update_status(
                    model_id=best_cand.model_id,
                    new_status=ModelStatus.CANDIDATE,
                    reason=rationale,
                )
                summary.production_candidate = {
                    "ticker": "GLOBAL",
                    "model_id": best_cand.model_id,
                    "model_name": best_cand.model_name,
                    "rationale": rationale,
                    "validation_metrics": best_cand.validation_metrics,
                    "test_metrics": best_cand.test_metrics,
                }
            val_table = self.comparator.generate_ascii_table(global_results, split="validation")
            test_table = self.comparator.generate_ascii_table(global_results, split="test")
            logger.info(f"\n{val_table}\n\n{test_table}")
