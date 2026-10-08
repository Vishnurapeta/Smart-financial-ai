"""
Configuration schema for stock prediction model experimentation.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
import uuid


class ExperimentConfig(BaseModel):
    """Configuration governing model experimentation, hyperparameter spaces, and evaluation."""

    experiment_id: str = Field(
        default_factory=lambda: f"exp_{uuid.uuid4().hex[:8]}",
        description="Unique experiment identifier",
    )
    dataset_path: str = Field(
        default="app/data/processed/nifty500_features.parquet",
        description="Path to processed feature dataset produced by Prompt 14 pipeline",
    )
    metadata_path: str = Field(
        default="app/data/processed/model_metadata.json",
        description="Path to model metadata describing features and split dates",
    )

    # Strategy & Scope
    training_mode: str = Field(
        default="per_ticker",
        description="Training mode: 'per_ticker' (separate model per stock) or 'global' (panel model)",
    )
    selected_tickers: Optional[List[str]] = Field(
        default=None,
        description="Optional subset of tickers to experiment on. None processes all eligible tickers",
    )

    # Target & Task Configuration
    target: str = Field(
        default="target_next_close",
        description="Prediction target: e.g. 'target_next_close', 'target_next_return', 'target_return_5d'",
    )
    task_type: str = Field(
        default="price",
        description="Task type: 'price' for price level regression, 'return' for percentage return forecasting",
    )

    # Models to include
    models_to_run: List[str] = Field(
        default=["naive", "linear_regression", "random_forest", "xgboost", "lstm"],
        description="List of model keys to train and evaluate",
    )

    # Minimum observations required per ticker
    minimum_training_samples: int = Field(
        default=150, description="Minimum training samples required for a ticker to be trained"
    )
    minimum_validation_samples: int = Field(
        default=30, description="Minimum validation samples required"
    )
    minimum_test_samples: int = Field(
        default=30, description="Minimum test samples required"
    )

    # Reproducibility
    random_seed: int = Field(default=42, description="Deterministic seed for all models")

    # Hyperparameters
    linear_regression_params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "fit_intercept": True,
            "use_scaler": True,
            "scaler_type": "standard",
        }
    )
    random_forest_params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "n_estimators": 50,
            "max_depth": 8,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "max_features": "sqrt",
            "n_jobs": -1,
        }
    )
    xgboost_params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "n_estimators": 100,
            "max_depth": 5,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3.0,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "early_stopping_rounds": 15,
        }
    )
    lstm_params: Dict[str, Any] = Field(
        default_factory=lambda: {
            "sequence_length": 15,
            "hidden_size": 24,
            "num_layers": 1,
            "dropout": 0.1,
            "learning_rate": 0.003,
            "batch_size": 64,
            "epochs": 20,
            "patience": 5,
        }
    )

    # Directory Paths
    experiments_dir: str = Field(default="experiments")
    results_dir: str = Field(default="experiments/results")
    reports_dir: str = Field(default="experiments/reports")
    configs_dir: str = Field(default="experiments/configs")
    artifacts_dir: str = Field(default="models/artifacts")
    registry_dir: str = Field(default="models/registry")
    metadata_dir: str = Field(default="models/metadata")

    @model_validator(mode="after")
    def validate_task_and_target(self) -> "ExperimentConfig":
        valid_modes = ["per_ticker", "global"]
        if self.training_mode not in valid_modes:
            raise ValueError(f"Invalid training_mode '{self.training_mode}'. Must be one of {valid_modes}")

        valid_tasks = ["price", "return"]
        if self.task_type not in valid_tasks:
            raise ValueError(f"Invalid task_type '{self.task_type}'. Must be one of {valid_tasks}")

        return self
