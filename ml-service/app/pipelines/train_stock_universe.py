"""
Universe Training and Intelligent Prediction Generation Pipeline.
Discovers all available stocks in the dataset, runs strict data validation,
performs chronological time-series validation across candidate models (Naive, LR, RF, XGBoost, LSTM),
selects the best model per stock and horizon, registers models, and persists validated predictions.
Strictly leakage-free: zero future lookahead, chronological walk-forward splits.
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
from app.data.stock_metadata import get_stock_metadata, STOCK_METADATA_REGISTRY
from app.experiments.metrics import StockMetricsCalculator
from app.models.stock.linear_regression import LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistry, ModelStatus
from app.models.stock.xgboost_model import XGBoostStockModel


def compute_reliability_score(dir_acc: float, rmse: float, n_bars: int) -> Tuple[str, float]:
    """
    Computes a mathematical reliability indicator from historical directional accuracy,
    validation error, and dataset depth. Guarantees zero fabricated percentages.
    """
    if dir_acc is None or np.isnan(dir_acc):
        return "UNKNOWN", 0.0

    # Base score derived from directional accuracy relative to 50% random chance
    # 50% -> 0.50, 65% -> 0.80, 75% -> 0.95
    base = max(0.0, min(1.0, (dir_acc - 45.0) / 30.0))
    # Penalty for large RMSE (above 0.04)
    rmse_factor = max(0.5, min(1.0, 1.0 - (rmse * 5.0))) if rmse else 0.8
    # Depth factor
    depth_factor = min(1.0, n_bars / 500.0)

    score = round(base * 0.7 + rmse_factor * 0.2 + depth_factor * 0.1, 3)

    if dir_acc >= 62.0 and score >= 0.70:
        level = "HIGH"
    elif dir_acc >= 53.0 and score >= 0.45:
        level = "MODERATE"
    else:
        level = "LOW"

    return level, score


class UniverseTrainingPipeline:
    def __init__(
        self,
        data_path: str = "app/data/processed/nifty500_features.parquet",
        registry: Optional[ModelRegistry] = None,
        artifacts_dir: str = "models/artifacts",
        output_predictions_path: str = "app/data/predictions/universe_predictions.json",
        output_status_path: str = "app/data/training/training_status.json",
        min_bars_required: int = 60,
    ):
        self.data_path = data_path
        self.registry = registry or ModelRegistry()
        self.artifacts_dir = artifacts_dir
        self.output_predictions_path = output_predictions_path
        self.output_status_path = output_status_path
        self.min_bars_required = min_bars_required

        os.makedirs(self.artifacts_dir, exist_ok=True)
        os.makedirs(os.path.dirname(self.output_predictions_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.output_status_path), exist_ok=True)

    def run(
        self,
        max_stocks: Optional[int] = None,
        specific_symbols: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        pipeline_start_t = time.time()
        logger.info(f"Initiating Universe Training Pipeline from {self.data_path}...")

        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Historical dataset not found at {self.data_path}")

        full_df = pd.read_parquet(self.data_path)
        all_symbols = sorted(full_df["symbol"].unique().tolist())
        logger.info(f"Discovered {len(all_symbols)} unique stock symbols in historical dataset.")

        if specific_symbols:
            all_symbols = [s.strip().upper() for s in specific_symbols if s.strip().upper() in all_symbols]
            logger.info(f"Filtered execution to {len(all_symbols)} specified symbols: {all_symbols}")
        elif max_stocks:
            all_symbols = all_symbols[:max_stocks]
            logger.info(f"Limiting execution to first {max_stocks} symbols for staging.")

        # Identify candidate feature columns (strictly backward-looking)
        target_prefixes = ("target_", "future_")
        excluded_cols = {"date", "symbol", "close", "adj_close"}
        feature_cols = [
            c for c in full_df.columns
            if not any(c.startswith(tp) for tp in target_prefixes) and c not in excluded_cols
        ]
        logger.info(f"Feature set size: {len(feature_cols)} technical and statistical indicators.")

        stats = {
            "total_discovered": len(all_symbols),
            "completed": 0,
            "insufficient_data": 0,
            "failed_validation": 0,
            "registered_models": 0,
            "production_models": 0,
            "rejected_stocks": [],
            "start_time": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": 0.0,
            "status": "TRAINING",
        }

        # Save initial status
        with open(self.output_status_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2)

        universe_predictions: List[Dict[str, Any]] = []
        model_eval_records: List[Dict[str, Any]] = []

        horizons = [1, 5, 20]

        for idx, symbol in enumerate(all_symbols, 1):
            sym_start_t = time.time()
            logger.info(f"\nTraining {symbol}... [{idx}/{len(all_symbols)}]")
            sym_df = full_df[full_df["symbol"] == symbol].sort_values("date").copy()
            meta = get_stock_metadata(symbol)

            # 1. Data Validation Checks
            if len(sym_df) < self.min_bars_required:
                logger.warning(
                    f"[{idx}/{len(all_symbols)}] {symbol} REJECTED: Insufficient historical data "
                    f"({len(sym_df)} bars < {self.min_bars_required} required for sequence generation)."
                )
                stats["insufficient_data"] += 1
                stats["rejected_stocks"].append({
                    "symbol": symbol,
                    "status": "insufficient_data",
                    "reason": f"Insufficient historical data ({len(sym_df)} bars < {self.min_bars_required} required).",
                    "available_bars": len(sym_df),
                    "required_bars": self.min_bars_required,
                })
                continue

            # Check price validity
            if (sym_df["close"] <= 0).any() or (sym_df["high"] < sym_df["low"]).any():
                logger.warning(f"[{idx}/{len(all_symbols)}] {symbol} REJECTED: Corrupted/negative price data.")
                stats["failed_validation"] += 1
                stats["rejected_stocks"].append({
                    "symbol": symbol,
                    "status": "failed_validation",
                    "reason": "Invalid price sanity checks (negative close or high < low).",
                    "available_bars": len(sym_df),
                })
                continue

            # Ensure chronological order
            sym_df.reset_index(drop=True, inplace=True)
            n_bars = len(sym_df)
            latest_row = sym_df.iloc[-1]
            current_price = float(latest_row["close"])
            latest_date_str = str(latest_row["date"])

            # 2. Chronological Split (70% Train, 15% Validation, 15% Test)
            n_train = int(n_bars * 0.70)
            n_val = int(n_bars * 0.15)

            train_df = sym_df.iloc[:n_train].copy()
            val_df = sym_df.iloc[n_train:n_train + n_val].copy()
            test_df = sym_df.iloc[n_train + n_val:].copy()

            tr_dates = train_df["date"]
            val_dates = val_df["date"]
            test_dates = test_df["date"]

            stock_horizon_predictions = {}

            for horizon in horizons:
                # Target column names
                return_target_col = "target_next_return" if horizon == 1 else f"target_return_{horizon}d"
                close_target_col = "target_next_close" if horizon == 1 else f"target_close_{horizon}d"

                if return_target_col not in sym_df.columns:
                    # Compute target if column missing
                    sym_df[return_target_col] = (sym_df["close"].shift(-horizon) - sym_df["close"]) / sym_df["close"] * 100.0

                # Prepare train/val/test matrices for return target
                tr_c = train_df.dropna(subset=[return_target_col] + feature_cols)
                val_c = val_df.dropna(subset=[return_target_col] + feature_cols)
                te_c = test_df.dropna(subset=[return_target_col] + feature_cols)

                if len(tr_c) < 30 or len(val_c) < 10:
                    continue

                X_tr = tr_c[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
                y_tr = tr_c[return_target_col]
                X_v = val_c[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
                y_v = val_c[return_target_col]
                X_te = te_c[feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
                y_te = te_c[return_target_col]

                # 3. Candidate Models Competition (All 5 candidate models evaluated identically)
                candidate_specs = [
                    ("naive", "NaiveBaseline", NaiveBaselineModel(task_type="return")),
                    ("linear_regression", "LinearRegression", LinearRegressionStockModel(use_scaler=True)),
                    ("random_forest", "RandomForest", RandomForestStockModel(n_estimators=30, max_depth=5, random_state=42)),
                    ("xgboost", "XGBoost", XGBoostStockModel(n_estimators=40, max_depth=4, learning_rate=0.06, random_state=42)),
                    ("lstm", "LSTM", LSTMStockModel(sequence_length=30, hidden_size=32, num_layers=2, dropout=0.2, epochs=8, batch_size=32, patience=2, random_state=42)),
                ]

                evaluated_candidates = []

                for c_num, (model_key, model_display_name, cand_model) in enumerate(candidate_specs, 1):
                    logger.info(f"  [{c_num}/5] Training {model_display_name} for {symbol} (h={horizon}D)...")
                    try:
                        cand_model.fit(X_train=X_tr, y_train=y_tr, X_val=X_v, y_val=y_v)
                        val_pred = cand_model.predict(X_v)
                        test_pred = cand_model.predict(X_te)

                        val_metrics = StockMetricsCalculator.evaluate_predictions(
                            y_true=y_v.to_numpy(),
                            y_pred=val_pred,
                            task_type="return",
                            ticker=symbol,
                            model_name=model_key,
                            target=return_target_col,
                            period="validation",
                        )
                        test_metrics = StockMetricsCalculator.evaluate_predictions(
                            y_true=y_te.to_numpy(),
                            y_pred=test_pred,
                            task_type="return",
                            ticker=symbol,
                            model_name=model_key,
                            target=return_target_col,
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
                        })

                        model_eval_records.append({
                            "symbol": symbol,
                            "horizon": horizon,
                            "model": model_key,
                            "directional_accuracy": dir_acc,
                            "rmse": rmse,
                            "mae": mae,
                            "r2": r2,
                        })

                    except Exception as train_err:
                        logger.warning(f"Candidate {model_key} training failed for {symbol} h={horizon}: {train_err}")

                if not evaluated_candidates:
                    continue

                # 4. Model Selection Policy:
                # Candidate models (non-naive) compete on validation Directional Accuracy and RMSE.
                # Naive is only selected if all candidates fail.
                non_naive = [c for c in evaluated_candidates if c["model_key"] != "naive"]
                competing_pool = non_naive if non_naive else evaluated_candidates

                # Sort by directional accuracy desc, then rmse asc
                competing_pool.sort(key=lambda c: (c["directional_accuracy"], -c["rmse"]), reverse=True)
                best_cand = competing_pool[0]

                logger.info(
                    f"  Model selected for {symbol} h={horizon}D: {best_cand['model_name']} as PRODUCTION "
                    f"(Dir Acc: {best_cand['directional_accuracy']:.1f}%, RMSE: {best_cand['rmse']:.4f})"
                )

                # 5. Register All Candidate Models (Best as PRODUCTION, others as CANDIDATE)
                for cand in evaluated_candidates:
                    is_best = (cand["model_key"] == best_cand["model_key"])
                    status = ModelStatus.PRODUCTION if is_best else ModelStatus.CANDIDATE

                    prefix = f"{symbol}_{return_target_col}_h{horizon}_{cand['model_key']}"
                    art_path = cand["model_instance"].save(output_dir=self.artifacts_dir, prefix=prefix)

                    scaler_art = getattr(cand["model_instance"], "scaler_artifact_path", None)
                    seq_len = getattr(cand["model_instance"], "sequence_length", None)

                    self.registry.register_model(
                        model_name=cand["model_name"],
                        model_version=cand["model_instance"].version,
                        ticker=symbol,
                        target=return_target_col,
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
                        artifact_path=art_path,
                        dataset_version="v1.0.0",
                        status=status,
                        scaler_artifact_path=scaler_art,
                        sequence_length=seq_len,
                    )
                    stats["registered_models"] += 1
                    if is_best:
                        stats["production_models"] += 1

                logger.info(f"  Model registered: {len(evaluated_candidates)} candidates for {symbol} h={horizon}D")

                # 6. Generate Live Prediction for Latest Bar
                if best_cand["model_key"] == "lstm":
                    seq_len_req = getattr(best_cand["model_instance"], "sequence_length", 30)
                    latest_X = sym_df.iloc[-seq_len_req:][feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
                else:
                    latest_X = sym_df.iloc[[-1]][feature_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)

                raw_preds = best_cand["model_instance"].predict(latest_X)
                pred_return_raw = float(raw_preds[-1])

                # Model outputs decimal return (e.g. -0.018027 = -1.8027%).
                # Calculate predicted price directly from decimal return
                predicted_price = round(current_price * (1.0 + pred_return_raw), 2)

                # Expected return in percentage mathematically consistent with target price:
                # predictedReturn = ((predicted_price - current_price) / current_price) * 100
                if current_price > 0:
                    expected_return_pct = round(((predicted_price - current_price) / current_price) * 100.0, 2)
                    if expected_return_pct == 0.0 and pred_return_raw != 0.0:
                        expected_return_pct = round(pred_return_raw * 100.0, 4)
                else:
                    expected_return_pct = round(pred_return_raw * 100.0, 2)

                # Direction determination with +/- 1.0% threshold
                if expected_return_pct >= 1.0:
                    direction = "Bullish"
                elif expected_return_pct <= -1.0:
                    direction = "Bearish"
                else:
                    direction = "Neutral"

                dir_acc = best_cand["directional_accuracy"]
                rel_level, rel_score = compute_reliability_score(dir_acc, best_cand["rmse"], n_bars)

                stock_horizon_predictions[horizon] = {
                    "horizon": horizon,
                    "target_return": return_target_col,
                    "target_close": close_target_col,
                    "expected_return": expected_return_pct,
                    "predicted_price": predicted_price,
                    "direction": direction,
                    "best_model": best_cand["model_name"],
                    "best_model_key": best_cand["model_key"],
                    "directional_accuracy": round(dir_acc, 1),
                    "mae": round(best_cand["mae"], 4),
                    "rmse": round(best_cand["rmse"], 4),
                    "r2": round(best_cand["r2"], 4),
                    "reliability_level": rel_level,
                    "reliability_score": rel_score,
                    "candidate_models": [
                        {
                            "model_name": c["model_name"],
                            "model_key": c["model_key"],
                            "directional_accuracy": round(c["directional_accuracy"], 1),
                            "rmse": round(c["rmse"], 4),
                            "mae": round(c["mae"], 4),
                            "r2": round(c["r2"], 4),
                            "is_production": (c["model_key"] == best_cand["model_key"]),
                            "status": "PRODUCTION" if (c["model_key"] == best_cand["model_key"]) else "CANDIDATE",
                        }
                        for c in evaluated_candidates
                    ],
                }

            if stock_horizon_predictions:
                stats["completed"] += 1
                logger.info(f"Training completed for {symbol} across {len(stock_horizon_predictions)} horizons.")
                h1_data = stock_horizon_predictions.get(1, stock_horizon_predictions[list(stock_horizon_predictions.keys())[0]])

                universe_predictions.append({
                    "symbol": symbol,
                    "company_name": meta["company_name"],
                    "sector": meta["sector"],
                    "industry": meta["industry"],
                    "market": meta["market"],
                    "market_cap_category": meta["market_cap_category"],
                    "current_price": current_price,
                    "latest_market_date": latest_date_str,
                    "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_bars_evaluated": n_bars,
                    "horizon": 1,
                    "predicted_price": h1_data["predicted_price"],
                    "expected_return": h1_data["expected_return"],
                    "direction": h1_data["direction"],
                    "best_model": h1_data["best_model"],
                    "best_model_key": h1_data["best_model_key"],
                    "directional_accuracy": h1_data["directional_accuracy"],
                    "reliability_level": h1_data["reliability_level"],
                    "reliability_score": h1_data["reliability_score"],
                    "mae": h1_data["mae"],
                    "rmse": h1_data["rmse"],
                    "r2": h1_data["r2"],
                    "horizons": stock_horizon_predictions,
                })

            sym_duration = round(time.time() - sym_start_t, 2)
            if idx % 5 == 0 or idx == len(all_symbols):
                logger.info(
                    f"Progress [{idx}/{len(all_symbols)}] Completed: {stats['completed']} stocks. "
                    f"Latest: {symbol} in {sym_duration}s."
                )

        # Merge with existing predictions if partial run
        final_predictions = universe_predictions
        if os.path.exists(self.output_predictions_path):
            try:
                with open(self.output_predictions_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                existing_items = existing_data.get("predictions", [])
                new_symbols = set(p["symbol"] for p in universe_predictions)
                # Keep existing items for symbols not updated in this run
                merged = [p for p in existing_items if p["symbol"] not in new_symbols]
                merged.extend(universe_predictions)
                final_predictions = merged
            except Exception as e:
                logger.warning(f"Could not merge with existing predictions: {e}")

        # Calculate rank across universe by Expected Return
        final_predictions.sort(key=lambda p: p["expected_return"], reverse=True)
        for rank_idx, pred in enumerate(final_predictions, 1):
            pred["rank"] = rank_idx

        # Write predictions to disk
        with open(self.output_predictions_path, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "total_count": len(final_predictions),
                "predictions": final_predictions,
            }, f, indent=2)

        # Final stats update
        stats["status"] = "COMPLETED"
        stats["duration_seconds"] = round(time.time() - pipeline_start_t, 2)
        stats["last_training_timestamp"] = datetime.now(timezone.utc).isoformat()
        with open(self.output_status_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2)

        logger.info(
            f"=== Universe Training Pipeline Completed in {stats['duration_seconds']}s ===\n"
            f"Discovered: {stats['total_discovered']} | Completed: {stats['completed']} | "
            f"Insufficient Data: {stats['insufficient_data']} | Failed: {stats['failed_validation']} | "
            f"Registered Models: {stats['registered_models']} | Production Models: {stats['production_models']}"
        )
        return stats


if __name__ == "__main__":
    pipeline = UniverseTrainingPipeline()
    pipeline.run()
