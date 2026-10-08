"""
XGBoost gradient boosted decision tree model for stock forecasting.
Enforces chronological early stopping on validation split with test set isolation.
"""
import os
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from app.models.stock.base import BaseStockModel


class XGBoostStockModel(BaseStockModel):
    """
    XGBoost Regressor with early stopping on chronological validation observations.
    """

    def __init__(
        self,
        n_estimators: int = 150,
        max_depth: int = 5,
        learning_rate: float = 0.05,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: float = 3.0,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        random_state: int = 42,
        early_stopping_rounds: Optional[int] = 15,
        version: str = "1.0.0",
    ):
        super().__init__(name="XGBoost", version=version)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.early_stopping_rounds = early_stopping_rounds

        self.model = xgb.XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            min_child_weight=min_child_weight,
            reg_alpha=reg_alpha,
            reg_lambda=reg_lambda,
            random_state=random_state,
            early_stopping_rounds=early_stopping_rounds if early_stopping_rounds else None,
            eval_metric="rmse",
            tree_method="hist",
        )

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "XGBoostStockModel":
        self.feature_names = list(X_train.columns)
        X_fit = X_train[self.feature_names].to_numpy()
        y_fit = y_train.to_numpy()

        if X_val is not None and y_val is not None and self.early_stopping_rounds:
            X_v = X_val[self.feature_names].to_numpy()
            y_v = y_val.to_numpy()
            self.model.fit(
                X_fit,
                y_fit,
                eval_set=[(X_v, y_v)],
                verbose=False,
            )
        else:
            # Recreate model without early stopping if no validation set provided
            no_es_model = xgb.XGBRegressor(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                learning_rate=self.learning_rate,
                subsample=self.subsample,
                colsample_bytree=self.colsample_bytree,
                min_child_weight=self.min_child_weight,
                reg_alpha=self.reg_alpha,
                reg_lambda=self.reg_lambda,
                random_state=self.random_state,
                eval_metric="rmse",
                tree_method="hist",
            )
            no_es_model.fit(X_fit, y_fit, verbose=False)
            self.model = no_es_model

        self.is_fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predicting.")

        X_eval = X[self.feature_names].to_numpy()
        return self.model.predict(X_eval)

    def save(self, output_dir: str, prefix: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{prefix}_xgboost.joblib")
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
    def load(cls, artifact_path: str) -> "XGBoostStockModel":
        data = joblib.load(artifact_path)
        params = data["hyperparameters"]
        inst = cls(
            n_estimators=params["n_estimators"],
            max_depth=params["max_depth"],
            learning_rate=params["learning_rate"],
            subsample=params["subsample"],
            colsample_bytree=params["colsample_bytree"],
            min_child_weight=params["min_child_weight"],
            reg_alpha=params["reg_alpha"],
            reg_lambda=params["reg_lambda"],
            random_state=params["random_state"],
            early_stopping_rounds=params.get("early_stopping_rounds", 15),
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
            "learning_rate": self.learning_rate,
            "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "reg_alpha": self.reg_alpha,
            "reg_lambda": self.reg_lambda,
            "random_state": self.random_state,
            "early_stopping_rounds": self.early_stopping_rounds,
        }
