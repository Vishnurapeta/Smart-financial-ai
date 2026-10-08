"""
Centralized metrics calculation for stock prediction experiments.
Provides uniform, safe calculations for price and return forecasting.
"""
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional
import numpy as np


@dataclass
class PricePredictionMetrics:
    """Standard evaluation metrics for stock price forecasting."""

    mae: float
    rmse: float
    mape: float
    r2: float
    sample_count: int
    ticker: str
    model_name: str
    target: str
    period: str  # 'validation' or 'test'

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ReturnPredictionMetrics:
    """Evaluation metrics for percentage return and directional market movement."""

    mae: float
    rmse: float
    r2: float
    directional_accuracy: float
    directional_precision: float
    directional_recall: float
    directional_f1: float
    sample_count: int
    ticker: str
    model_name: str
    target: str
    period: str  # 'validation' or 'test'
    zero_return_treatment: str = "Treated as neutral/flat (non-positive in binary direction)"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MetricsCalculator:
    """
    Computes regression and directional classification metrics safely,
    preventing division by zero or NaN propagation.
    """

    @staticmethod
    def calculate_price_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        ticker: str,
        model_name: str,
        target: str = "target_next_close",
        period: str = "validation",
        eps: float = 1e-7,
    ) -> PricePredictionMetrics:
        """
        Calculates MAE, RMSE, MAPE, and R2 for price prediction.
        """
        y_t = np.asarray(y_true, dtype=np.float64)
        y_p = np.asarray(y_pred, dtype=np.float64)

        if len(y_t) == 0:
            raise ValueError("Cannot calculate metrics on empty prediction array.")

        # MAE
        mae = float(np.mean(np.abs(y_t - y_p)))

        # RMSE
        rmse = float(np.sqrt(np.mean((y_t - y_p) ** 2)))

        # MAPE with division-by-zero protection
        abs_t = np.abs(y_t)
        safe_denom = np.where(abs_t < eps, eps, abs_t)
        mape = float(np.mean(np.abs(y_t - y_p) / safe_denom) * 100.0)

        # R-squared
        ss_res = np.sum((y_t - y_p) ** 2)
        ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
        if ss_tot < eps:
            r2 = 0.0
        else:
            r2 = float(1.0 - (ss_res / ss_tot))

        return PricePredictionMetrics(
            mae=round(mae, 4),
            rmse=round(rmse, 4),
            mape=round(mape, 4),
            r2=round(r2, 4),
            sample_count=len(y_t),
            ticker=ticker,
            model_name=model_name,
            target=target,
            period=period,
        )

    @staticmethod
    def calculate_return_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        ticker: str,
        model_name: str,
        target: str = "target_next_return",
        period: str = "validation",
        eps: float = 1e-7,
    ) -> ReturnPredictionMetrics:
        """
        Calculates regression metrics (MAE, RMSE, R2) and directional classification
        metrics (Accuracy, Precision, Recall, F1) for percentage return forecasting.

        Zero-return treatment:
        Actual returns > 0 are considered positive (UP = 1).
        Actual returns <= 0 are considered non-positive (DOWN/FLAT = 0).
        Zero is explicitly treated as neutral/flat rather than silently positive.
        """
        y_t = np.asarray(y_true, dtype=np.float64)
        y_p = np.asarray(y_pred, dtype=np.float64)

        if len(y_t) == 0:
            raise ValueError("Cannot calculate return metrics on empty prediction array.")

        # Continuous regression metrics
        mae = float(np.mean(np.abs(y_t - y_p)))
        rmse = float(np.sqrt(np.mean((y_t - y_p) ** 2)))

        ss_res = np.sum((y_t - y_p) ** 2)
        ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot >= eps else 0.0

        # Directional classification
        # UP: > 0, DOWN/FLAT: <= 0
        actual_up = (y_t > 0).astype(int)
        pred_up = (y_p > 0).astype(int)

        # Directional accuracy
        correct = np.sum(actual_up == pred_up)
        directional_acc = float((correct / len(y_t)) * 100.0)

        # True Positives, False Positives, False Negatives
        tp = int(np.sum((pred_up == 1) & (actual_up == 1)))
        fp = int(np.sum((pred_up == 1) & (actual_up == 0)))
        fn = int(np.sum((pred_up == 0) & (actual_up == 1)))

        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        if (precision + recall) > 0:
            f1 = float(2.0 * (precision * recall) / (precision + recall))
        else:
            f1 = 0.0

        return ReturnPredictionMetrics(
            mae=round(mae, 6),
            rmse=round(rmse, 6),
            r2=round(r2, 4),
            directional_accuracy=round(directional_acc, 2),
            directional_precision=round(precision, 4),
            directional_recall=round(recall, 4),
            directional_f1=round(f1, 4),
            sample_count=len(y_t),
            ticker=ticker,
            model_name=model_name,
            target=target,
            period=period,
        )

    @classmethod
    def evaluate_predictions(
        cls,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        task_type: str = "price",
        ticker: str = "UNKNOWN",
        model_name: str = "UNKNOWN",
        target: str = "target",
        period: str = "validation",
    ) -> Dict[str, Any]:
        """Convenience dispatcher returning metrics as a dictionary."""
        if task_type == "price":
            metrics_obj = cls.calculate_price_metrics(
                y_true=y_true,
                y_pred=y_pred,
                ticker=ticker,
                model_name=model_name,
                target=target,
                period=period,
            )
        else:
            metrics_obj = cls.calculate_return_metrics(
                y_true=y_true,
                y_pred=y_pred,
                ticker=ticker,
                model_name=model_name,
                target=target,
                period=period,
            )
        return metrics_obj.to_dict()


StockMetricsCalculator = MetricsCalculator
