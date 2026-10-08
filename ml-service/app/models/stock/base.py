"""
Base class for stock prediction models.
Defines the standard training, prediction, serialization, and metadata interface.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import numpy as np
import pandas as pd


class BaseStockModel(ABC):
    """Abstract Base Class for all SmartFin AI stock forecasting models."""

    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.is_fitted: bool = False
        self.feature_names: list = []

    @abstractmethod
    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "BaseStockModel":
        """
        Trains the model.
        Validation data may be used strictly for early stopping.
        """
        pass

    @abstractmethod
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """
        Generates point forecasts for input features X.
        """
        pass

    @abstractmethod
    def save(self, output_dir: str, prefix: str) -> str:
        """
        Serializes model artifact to disk. Returns artifact filepath.
        """
        pass

    @classmethod
    @abstractmethod
    def load(cls, artifact_path: str) -> "BaseStockModel":
        """
        Loads model from artifact file.
        """
        pass

    @abstractmethod
    def get_hyperparameters(self) -> Dict[str, Any]:
        """
        Returns dictionary of hyperparameters.
        """
        pass
