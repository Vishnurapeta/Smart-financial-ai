"""
Financial Forecasting Models: Moving Average Baseline, Linear Regression, Random Forest, XGBoost, and Exponential Smoothing.
"""
from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import xgboost as xgb

from app.forecasting.feature_pipeline import FinancialFeaturePipeline


class BaseForecaster(ABC):
    """Abstract base class for all personal financial forecasting models."""

    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.is_fitted = False

    @abstractmethod
    def fit(self, values: np.ndarray, periods: List[str]) -> "BaseForecaster":
        pass

    @abstractmethod
    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        pass


class MovingAverageForecaster(BaseForecaster):
    """
    Moving Average Baseline model (3-Month or 6-Month window).
    Strong, non-overfitting, interpretable personal finance baseline.
    """

    def __init__(self, window: int = 3, version: str = "1.0.0"):
        super().__init__(name=f"{window}-Month Moving Average", version=version)
        self.window = window

    def fit(self, values: np.ndarray, periods: List[str]) -> "MovingAverageForecaster":
        self.is_fitted = True
        return self

    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        values_list = list(historical_values)
        predictions = []

        for _ in range(horizon):
            w = min(self.window, len(values_list))
            if w == 0:
                pred = 0.0
            else:
                pred = float(np.mean(values_list[-w:]))
            # Financial values cannot be negative
            pred = max(0.0, pred)
            predictions.append(pred)
            values_list.append(pred)

        return np.array(predictions, dtype=float)


class LinearRegressionForecaster(BaseForecaster):
    """
    Linear Regression with trend, month seasonality, and lag components.
    """

    def __init__(self, version: str = "1.0.0"):
        super().__init__(name="Linear Regression", version=version)
        self.model = LinearRegression()

    def fit(self, values: np.ndarray, periods: List[str]) -> "LinearRegressionForecaster":
        X, y, _ = FinancialFeaturePipeline.build_feature_matrix(values, periods)
        if len(y) > 0:
            self.model.fit(X, y)
            self.is_fitted = True
        else:
            self.is_fitted = False
        return self

    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        if not self.is_fitted:
            # Fall back to moving average if model was not fittable
            ma = MovingAverageForecaster(window=3)
            return ma.predict(historical_values, last_period, horizon)

        future_periods = FinancialFeaturePipeline.compute_next_periods(last_period, horizon)
        working_series = list(historical_values)
        predictions = []

        start_step = len(historical_values)
        for step, period_str in enumerate(future_periods):
            curr_arr = np.array(working_series, dtype=float)
            x_vec = FinancialFeaturePipeline.get_latest_feature_vector(
                curr_arr, period_str, start_step + step
            )
            pred = float(self.model.predict(x_vec)[0])
            pred = max(0.0, pred)
            predictions.append(pred)
            working_series.append(pred)

        return np.array(predictions, dtype=float)


class RandomForestForecaster(BaseForecaster):
    """
    Random Forest Regressor with lag and calendar features.
    """

    def __init__(self, n_estimators: int = 30, max_depth: int = 4, version: str = "1.0.0"):
        super().__init__(name="Random Forest", version=version)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.model = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=42,
        )

    def fit(self, values: np.ndarray, periods: List[str]) -> "RandomForestForecaster":
        X, y, _ = FinancialFeaturePipeline.build_feature_matrix(values, periods)
        if len(y) >= 3:
            self.model.fit(X, y)
            self.is_fitted = True
        else:
            self.is_fitted = False
        return self

    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        if not self.is_fitted:
            ma = MovingAverageForecaster(window=3)
            return ma.predict(historical_values, last_period, horizon)

        future_periods = FinancialFeaturePipeline.compute_next_periods(last_period, horizon)
        working_series = list(historical_values)
        predictions = []

        start_step = len(historical_values)
        for step, period_str in enumerate(future_periods):
            curr_arr = np.array(working_series, dtype=float)
            x_vec = FinancialFeaturePipeline.get_latest_feature_vector(
                curr_arr, period_str, start_step + step
            )
            pred = float(self.model.predict(x_vec)[0])
            pred = max(0.0, pred)
            predictions.append(pred)
            working_series.append(pred)

        return np.array(predictions, dtype=float)


class XGBoostForecaster(BaseForecaster):
    """
    XGBoost Regressor for non-linear lag relationships.
    """

    def __init__(
        self,
        n_estimators: int = 30,
        max_depth: int = 3,
        learning_rate: float = 0.08,
        version: str = "1.0.0",
    ):
        super().__init__(name="XGBoost", version=version)
        self.model = xgb.XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=42,
            verbosity=0,
        )

    def fit(self, values: np.ndarray, periods: List[str]) -> "XGBoostForecaster":
        X, y, _ = FinancialFeaturePipeline.build_feature_matrix(values, periods)
        if len(y) >= 4:
            self.model.fit(X, y)
            self.is_fitted = True
        else:
            self.is_fitted = False
        return self

    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        if not self.is_fitted:
            ma = MovingAverageForecaster(window=3)
            return ma.predict(historical_values, last_period, horizon)

        future_periods = FinancialFeaturePipeline.compute_next_periods(last_period, horizon)
        working_series = list(historical_values)
        predictions = []

        start_step = len(historical_values)
        for step, period_str in enumerate(future_periods):
            curr_arr = np.array(working_series, dtype=float)
            x_vec = FinancialFeaturePipeline.get_latest_feature_vector(
                curr_arr, period_str, start_step + step
            )
            pred = float(self.model.predict(x_vec)[0])
            pred = max(0.0, pred)
            predictions.append(pred)
            working_series.append(pred)

        return np.array(predictions, dtype=float)


class ExponentialSmoothingForecaster(BaseForecaster):
    """
    Holt's Linear Trend Exponential Smoothing.
    Level + Trend decomposition for smooth financial projections.
    """

    def __init__(self, alpha: float = 0.4, beta: float = 0.2, version: str = "1.0.0"):
        super().__init__(name="Exponential Smoothing", version=version)
        self.alpha = alpha
        self.beta = beta
        self.level = 0.0
        self.trend = 0.0

    def fit(self, values: np.ndarray, periods: List[str]) -> "ExponentialSmoothingForecaster":
        n = len(values)
        if n < 2:
            self.is_fitted = False
            return self

        # Initialize level and trend
        level = values[0]
        trend = values[1] - values[0]

        for i in range(1, n):
            val = values[i]
            prev_level = level
            level = self.alpha * val + (1.0 - self.alpha) * (prev_level + trend)
            trend = self.beta * (level - prev_level) + (1.0 - self.beta) * trend

        self.level = level
        self.trend = trend
        self.is_fitted = True
        return self

    def predict(
        self, historical_values: np.ndarray, last_period: str, horizon: int
    ) -> np.ndarray:
        if not self.is_fitted:
            ma = MovingAverageForecaster(window=3)
            return ma.predict(historical_values, last_period, horizon)

        predictions = []
        for h in range(1, horizon + 1):
            pred = self.level + h * self.trend
            pred = max(0.0, pred)
            predictions.append(pred)

        return np.array(predictions, dtype=float)
