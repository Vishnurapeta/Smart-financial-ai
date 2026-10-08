"""
Time-Series Chronological Holdout Evaluation & Model Selection.
Ensures zero data leakage and enforces that complex models must beat the Moving Average baseline.
"""
from typing import Dict, List, Optional, Tuple
import numpy as np
from sklearn.metrics import r2_score

from app.forecasting.models import (
    BaseForecaster,
    ExponentialSmoothingForecaster,
    LinearRegressionForecaster,
    MovingAverageForecaster,
    RandomForestForecaster,
    XGBoostForecaster,
)
from app.schemas.forecasting import CandidateModelComparisonItem, ForecastMetricsItem


class TimeSeriesEvaluator:
    """
    Evaluates personal financial forecasting models chronologically.
    """

    @classmethod
    def evaluate_and_select_best_model(
        cls,
        values: np.ndarray,
        periods: List[str],
        preferred_model_name: Optional[str] = None,
    ) -> Tuple[BaseForecaster, ForecastMetricsItem, List[CandidateModelComparisonItem], str]:
        """
        Chronologically splits historical data, trains candidate models on train window,
        evaluates on out-of-sample holdout window, and selects the production model.
        Returns:
            (selected_model, holdout_metrics, comparison_items, selection_reason)
        """
        n = len(values)
        if n < 3:
            raise ValueError("Insufficient history for evaluation: at least 3 months required.")

        # Determine holdout window size: 1 to 3 months depending on sample size
        val_size = min(3, max(1, n // 4))
        train_size = n - val_size

        train_values = values[:train_size]
        train_periods = periods[:train_size]
        val_values = values[train_size:]
        last_train_period = train_periods[-1]

        # Initialize candidate models
        candidates: List[BaseForecaster] = [
            MovingAverageForecaster(window=3),
        ]

        if n >= 5:
            candidates.append(MovingAverageForecaster(window=min(6, n - 1)))
            candidates.append(ExponentialSmoothingForecaster())

        # Only evaluate ML models when there is sufficient training data (>= 6 months)
        if n >= 6:
            candidates.append(LinearRegressionForecaster())
            candidates.append(RandomForestForecaster())
            candidates.append(XGBoostForecaster())

        scores: Dict[str, Tuple[float, float, float, Optional[float], BaseForecaster]] = {}
        comparison_items: List[CandidateModelComparisonItem] = []

        # Train on train_values, predict on holdout window
        for cand in candidates:
            try:
                cand.fit(train_values, train_periods)
                preds = cand.predict(train_values, last_train_period, val_size)

                mae = float(np.mean(np.abs(val_values - preds)))
                rmse = float(np.sqrt(np.mean((val_values - preds) ** 2)))
                # Safe MAPE calculation avoiding division by zero
                denom = np.maximum(1.0, np.abs(val_values))
                mape = float(np.mean(np.abs(val_values - preds) / denom) * 100.0)

                # R2 score if variance exists
                if len(val_values) > 1 and np.var(val_values) > 1e-4:
                    try:
                        r2 = float(r2_score(val_values, preds))
                    except Exception:
                        r2 = None
                else:
                    r2 = None

                scores[cand.name] = (mae, rmse, mape, r2, cand)
            except Exception:
                # If a complex candidate fails on short data, skip gracefully
                continue

        if not scores:
            # Fallback to standard 3-Month Moving Average
            default_ma = MovingAverageForecaster(window=3)
            default_ma.fit(values, periods)
            metrics = ForecastMetricsItem(mae=0.0, rmse=0.0, mape=0.0, r2=None)
            return default_ma, metrics, [], "Baseline 3-Month Moving Average (Default)"

        # Baseline reference (3-Month Moving Average)
        baseline_name = "3-Month Moving Average"
        baseline_mae = scores[baseline_name][0] if baseline_name in scores else float("inf")

        # Pick best model:
        # If user explicitly preferred a valid fitted model, honor preference;
        # otherwise pick model with lowest validation MAE that beats or ties baseline.
        selected_cand_name = baseline_name
        lowest_mae = baseline_mae
        selection_reason = "3-Month Moving Average Baseline selected as primary benchmark"

        if preferred_model_name and preferred_model_name.lower() != "auto":
            # Match preferred name
            for name in scores:
                if preferred_model_name.lower() in name.lower():
                    selected_cand_name = name
                    selection_reason = f"User preferred model '{name}'"
                    break

        if selection_reason.startswith("3-Month Moving Average"):
            # Check if any advanced model strictly beats baseline
            for name, (mae, rmse, _, _, _) in scores.items():
                if mae < lowest_mae:
                    lowest_mae = mae
                    selected_cand_name = name
                    selection_reason = (
                        f"{name} achieved lowest out-of-sample MAE ({mae:.2f}) "
                        f"outperforming baseline ({baseline_mae:.2f})"
                    )

        best_cand = scores[selected_cand_name][4]
        best_mae, best_rmse, best_mape, best_r2, _ = scores[selected_cand_name]

        # Re-fit the winning candidate on ALL available historical data (train + val)
        best_cand.fit(values, periods)

        # Build comparison items
        for name, (mae, rmse, mape, _, _) in scores.items():
            comparison_items.append(
                CandidateModelComparisonItem(
                    name=name,
                    mae=round(mae, 2),
                    rmse=round(rmse, 2),
                    mape=round(mape, 2) if mape is not None else None,
                    is_selected=(name == selected_cand_name),
                )
            )

        best_metrics = ForecastMetricsItem(
            mae=round(best_mae, 2),
            rmse=round(best_rmse, 2),
            mape=round(best_mape, 2) if best_mape is not None else None,
            r2=round(best_r2, 3) if best_r2 is not None else None,
        )

        return best_cand, best_metrics, comparison_items, selection_reason
