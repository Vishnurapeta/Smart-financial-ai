"""
Random Forest regression model for stock forecasting.
Deterministic random seeds, non-shuffled time-series inputs.
"""
import os
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from app.models.stock.base import BaseStockModel


class RandomForestStockModel(BaseStockModel):
    """
    Random Forest Regressor with configurable tree hyperparameters.
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: Optional[int] = 10,
        min_samples_split: int = 5,
        min_samples_leaf: int = 2,
        max_features: Any = "sqrt",
        random_state: int = 42,
        n_jobs: int = -1,
        version: str = "1.0.0",
    ):
        super().__init__(name="RandomForest", version=version)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.max_features = max_features
        self.random_state = random_state
        self.n_jobs = n_jobs

        self.model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            max_features=max_features,
            random_state=random_state,
            n_jobs=n_jobs,
        )

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "RandomForestStockModel":
        self.feature_names = list(X_train.columns)
        X_fit = X_train[self.feature_names].to_numpy()
        y_fit = y_train.to_numpy()

        self.model.fit(X_fit, y_fit)
        self.is_fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predicting.")

        X_eval = X[self.feature_names].to_numpy()
        return self.model.predict(X_eval)

    def save(self, output_dir: str, prefix: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{prefix}_random_forest.joblib")
        data = {
            "name": self.name,
            "version": self.version,
            "hyperparameters": self.get_hyperparameters(),
            "model": self.model,
            "feature_names": self.feature_names,
            "is_fitted": self.is_fitted,
        }
        joblib.dump(data, filepath)
        return filepath

    @classmethod
    def load(cls, artifact_path: str) -> "RandomForestStockModel":
        data = joblib.load(artifact_path)
        params = data["hyperparameters"]
        inst = cls(
            n_estimators=params["n_estimators"],
            max_depth=params["max_depth"],
            min_samples_split=params["min_samples_split"],
            min_samples_leaf=params["min_samples_leaf"],
            max_features=params["max_features"],
            random_state=params["random_state"],
            n_jobs=params["n_jobs"],
            version=data["version"],
        )
        inst.model = data["model"]
        inst.feature_names = data["feature_names"]
        inst.is_fitted = data["is_fitted"]
        return inst

    def get_hyperparameters(self) -> Dict[str, Any]:
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "min_samples_leaf": self.min_samples_leaf,
            "max_features": self.max_features,
            "random_state": self.random_state,
            "n_jobs": self.n_jobs,
        }
