"""
Stock prediction models package.
"""
from app.models.stock.base import BaseStockModel
from app.models.stock.linear_regression import LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistry, ModelRegistryEntry, ModelStatus
from app.models.stock.xgboost_model import XGBoostStockModel

__all__ = [
    "BaseStockModel",
    "NaiveBaselineModel",
    "LinearRegressionStockModel",
    "RandomForestStockModel",
    "XGBoostStockModel",
    "LSTMStockModel",
    "ModelRegistry",
    "ModelRegistryEntry",
    "ModelStatus",
]
