"""
Linear Regression stock prediction model with leakage-free feature scaling.
"""
import os
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.models.stock.base import BaseStockModel
from app.preprocessing.scaling import LeakageFreeScaler


class LinearRegressionStockModel(BaseStockModel):
    """
    Linear Regression model with strictly isolated feature scaling.
    Scaler is fitted exclusively on training data and stored in the artifact.
    """

    def __init__(
        self,
        fit_intercept: bool = True,
        use_scaler: bool = True,
        scaler_type: str = "standard",
        version: str = "1.0.0",
    ):
        super().__init__(name="LinearRegression", version=version)
        self.fit_intercept = fit_intercept
        self.use_scaler = use_scaler
        self.scaler_type = scaler_type
        self.model = LinearRegression(fit_intercept=fit_intercept)
        self.scaler: Optional[LeakageFreeScaler] = (
            LeakageFreeScaler(scaler_type=scaler_type) if use_scaler else None
        )

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "LinearRegressionStockModel":
        self.feature_names = list(X_train.columns)

        # Scale features strictly on training data
        if self.scaler:
            X_train_scaled = self.scaler.fit_transform(X_train, self.feature_names)
            X_fit = X_train_scaled[self.feature_names].to_numpy()
        else:
            X_fit = X_train[self.feature_names].to_numpy()

        y_fit = y_train.to_numpy()
        self.model.fit(X_fit, y_fit)
        self.is_fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predicting.")

        if self.scaler:
            X_scaled = self.scaler.transform(X, self.feature_names)
            X_eval = X_scaled[self.feature_names].to_numpy()
        else:
            X_eval = X[self.feature_names].to_numpy()

        return self.model.predict(X_eval)

    def save(self, output_dir: str, prefix: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{prefix}_linear_regression.joblib")
        data = {
            "name": self.name,
            "version": self.version,
            "fit_intercept": self.fit_intercept,
            "use_scaler": self.use_scaler,
            "scaler_type": self.scaler_type,
            "model": self.model,
            "scaler": self.scaler,
            "feature_names": self.feature_names,
            "is_fitted": self.is_fitted,
        }
        joblib.dump(data, filepath)
        return filepath

    @classmethod
    def load(cls, artifact_path: str) -> "LinearRegressionStockModel":
        data = joblib.load(artifact_path)
        inst = cls(
            fit_intercept=data["fit_intercept"],
            use_scaler=data["use_scaler"],
            scaler_type=data["scaler_type"],
            version=data["version"],
        )
        inst.model = data["model"]
        inst.scaler = data["scaler"]
        inst.feature_names = data["feature_names"]
        inst.is_fitted = data["is_fitted"]
        return inst

    def get_hyperparameters(self) -> Dict[str, Any]:
        return {
            "fit_intercept": self.fit_intercept,
            "use_scaler": self.use_scaler,
            "scaler_type": self.scaler_type,
        }
