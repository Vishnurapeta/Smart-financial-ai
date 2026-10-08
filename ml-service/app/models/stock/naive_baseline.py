"""
Naive / Persistence Baseline model for stock forecasting.
Predicts current close price for price target, or zero return for return target.
"""
import os
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd
from app.models.stock.base import BaseStockModel


class NaiveBaselineModel(BaseStockModel):
    """
    Persistence / Random Walk Baseline:
    - Price task: predicted_next_close = current_close (Close price at day t)
    - Return task: predicted_return = 0.0 (Efficient Market / Martingale baseline)

    Required benchmark for all ML models.
    """

    def __init__(self, task_type: str = "price", version: str = "1.0.0"):
        super().__init__(name="NaiveBaseline", version=version)
        self.task_type = task_type.lower()
        if self.task_type not in ["price", "return"]:
            raise ValueError(f"task_type must be 'price' or 'return' (got '{task_type}')")

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "NaiveBaselineModel":
        self.feature_names = list(X_train.columns)
        self.is_fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predicting.")

        if self.task_type == "price":
            # Current close price at day t
            if "close" in X.columns:
                return X["close"].to_numpy(dtype=np.float64)
            elif "close_lag_1" in X.columns:
                return X["close_lag_1"].to_numpy(dtype=np.float64)
            else:
                raise ValueError("Input X must contain 'close' column for naive price persistence.")
        else:
            # Expected return = 0.0
            return np.zeros(len(X), dtype=np.float64)

    def save(self, output_dir: str, prefix: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{prefix}_naive_baseline.joblib")
        data = {
            "name": self.name,
            "version": self.version,
            "task_type": self.task_type,
            "feature_names": self.feature_names,
            "is_fitted": self.is_fitted,
        }
        joblib.dump(data, filepath)
        return filepath

    @classmethod
    def load(cls, artifact_path: str) -> "NaiveBaselineModel":
        data = joblib.load(artifact_path)
        model = cls(task_type=data["task_type"], version=data["version"])
        model.feature_names = data["feature_names"]
        model.is_fitted = data["is_fitted"]
        return model

    def get_hyperparameters(self) -> Dict[str, Any]:
        return {
            "task_type": self.task_type,
            "strategy": "current_close" if self.task_type == "price" else "zero_return",
        }
