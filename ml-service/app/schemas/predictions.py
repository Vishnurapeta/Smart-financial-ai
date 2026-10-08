"""
Pydantic schemas for Stock Prediction API requests, responses, model metadata, and history.
Strictly validates inputs and ensures internal filesystem paths are never exposed.
"""
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StockPredictionRequest(BaseModel):
    """Request payload for generating a stock price or return prediction."""

    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Exchange stock ticker symbol (e.g. RELIANCE, TCS, INFY)",
        examples=["TCS"],
    )
    horizon: int = Field(
        default=1,
        ge=1,
        le=30,
        description="Forecast horizon in trading days (default: 1 day ahead)",
        examples=[1],
    )
    target: Optional[str] = Field(
        default=None,
        description="Target variable (e.g. target_next_close, target_next_return)",
        examples=["target_next_return"],
    )
    model_version: Optional[str] = Field(
        default=None,
        description="Optional model version. Uses active PRODUCTION model if omitted.",
        examples=["1.0.0"],
    )
    model_name: Optional[str] = Field(
        default=None,
        description="Optional model architecture name to query directly (e.g. LSTM, XGBoost, RandomForest)",
        examples=["LSTM"],
    )
    model: Optional[str] = Field(
        default=None,
        description="Alias for model_name (e.g. LSTM)",
        examples=["LSTM"],
    )
    allow_candidate: bool = Field(
        default=False,
        description="Permits inference using a CANDIDATE model if no PRODUCTION model exists.",
    )

    @field_validator("symbol")
    @classmethod
    def validate_and_clean_symbol(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned:
            raise ValueError("Stock symbol cannot be empty or whitespace only.")
        if not re.match(r"^[A-Z0-9_\.\-]+$", cleaned):
            raise ValueError(
                f"Symbol '{v}' contains invalid characters. Use alphanumeric, dot, or hyphen."
            )
        return cleaned

    @field_validator("model_version")
    @classmethod
    def validate_model_version(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        # Disallow directory traversals, paths, and URLs
        if any(c in cleaned for c in ["/", "\\", "..", ":", "http", "ftp", "@"]):
            raise ValueError("model_version cannot contain paths, traversals, or URLs.")
        if not re.match(r"^[A-Za-z0-9_\.\-]+$", cleaned):
            raise ValueError(
                "model_version must contain only alphanumeric characters, dots, or dashes."
            )
        return cleaned


class ForecastSignal(BaseModel):
    """Explainable model feature or indicator signal contribution."""

    name: str = Field(..., description="Indicator or signal name")
    type: str = Field(..., description="positive, negative, or neutral")
    label: str = Field(..., description="Human-readable signal explanation")
    value: Optional[str] = Field(default=None, description="Formatted indicator value")


class StockPredictionResponse(BaseModel):
    """Public inference response containing forecasts, historical metrics, and timestamps."""

    symbol: str = Field(..., description="Stock symbol")
    market_data_timestamp: str = Field(
        ..., description="ISO 8601 UTC timestamp of latest market data used for inference"
    )
    prediction_timestamp: str = Field(
        ..., description="ISO 8601 UTC timestamp when prediction was computed"
    )
    current_price: float = Field(
        ..., description="Latest available closing price (INR ₹)"
    )
    predicted_value: Optional[float] = Field(
        default=None, description="Forecasted target price (INR ₹) when target is price"
    )
    predicted_close: Optional[float] = Field(
        default=None, description="Forecasted target close price (same as predicted_value)"
    )
    predicted_return: Optional[float] = Field(
        default=None,
        description="Forecasted percentage return as decimal (e.g. 0.015 = +1.5%)",
    )
    direction: Optional[str] = Field(
        default=None, description="Forecast direction: Bullish, Bearish, or Neutral"
    )
    confidence_score: Optional[float] = Field(
        default=None, description="Calibrated model forecast confidence if supported"
    )
    signals: Optional[List[ForecastSignal]] = Field(
        default=None, description="Explainable feature signals and indicator contributions"
    )
    is_derived_price: bool = Field(
        default=False,
        description="True if predicted_value was derived from current_price & predicted_return",
    )
    is_derived_return: bool = Field(
        default=False,
        description="True if predicted_return was derived from predicted_value & current_price",
    )
    horizon: int = Field(..., description="Forecast horizon in trading days")
    target: str = Field(..., description="Model target column")
    model_name: str = Field(..., description="Name of the model architecture")
    model_version: str = Field(..., description="Model version")
    feature_version: str = Field(..., description="Feature engineering pipeline version")
    model_status: str = Field(..., description="Status in registry (PRODUCTION or CANDIDATE)")
    historical_metrics: Dict[str, Any] = Field(
        ...,
        description="Historical out-of-sample evaluation metrics (validation/test)",
    )
    latency_ms: Optional[Dict[str, float]] = Field(
        default=None,
        description="Stage breakdown latencies in milliseconds",
    )


class StockPredictionRecord(BaseModel):
    """Persisted historical stock prediction audit record."""

    id: str = Field(..., description="Unique prediction record identifier")
    symbol: str
    prediction_timestamp: str
    market_data_timestamp: str
    horizon: int
    target: str
    current_price: float
    predicted_value: Optional[float] = None
    predicted_return: Optional[float] = None
    is_derived_price: bool = False
    is_derived_return: bool = False
    model_name: str
    model_version: str
    feature_version: str
    model_status: str
    actual_value: Optional[float] = None
    actual_return: Optional[float] = None
    error: Optional[float] = None
    direction: Optional[str] = "Pending"
    status: Optional[str] = "PENDING"

    model_config = ConfigDict(from_attributes=True)


class PredictionHistoryResponse(BaseModel):
    """Paginated list of historical stock predictions."""

    symbol: Optional[str] = None
    total_count: int
    limit: int
    offset: int
    items: List[StockPredictionRecord]


class ModelMetadataCard(BaseModel):
    """Safe public model metadata card without filesystem paths or internal secrets."""

    model_id: str
    symbol: str
    model_name: str
    model_version: str
    target: str
    horizon: int
    status: str
    metrics: Dict[str, Any]
    feature_version: str
    preprocessing_version: str
    training_start: Optional[str] = None
    training_end: Optional[str] = None
    validation_end: Optional[str] = None
    test_end: Optional[str] = None
    training_timestamp: Optional[str] = None
    dataset_version: Optional[str] = None


class ModelListResponse(BaseModel):
    """Catalog of registered stock forecasting models."""

    total_count: int
    models: List[ModelMetadataCard]


class ModelMetricsResponse(BaseModel):
    """Historical evaluation metrics for models registered for a specific stock."""

    symbol: str
    models: List[Dict[str, Any]]


class ModelDetailsResponse(BaseModel):
    """Comprehensive public model metadata for deep audit and inspection."""

    model_id: str
    model_name: str
    model_version: str
    ticker: str
    target: str
    horizon: int
    status: str
    feature_version: str
    preprocessing_version: str
    dataset_version: str
    training_start: str
    training_end: str
    validation_start: str
    validation_end: str
    test_start: str
    test_end: str
    training_timestamp: str
    hyperparameters: Dict[str, Any]
    metrics: Dict[str, Any]
    status_history: List[Dict[str, str]]
    features_used: List[str]


class SupportedStockInfo(BaseModel):
    """Stock coverage status and model summary."""

    symbol: str
    company_name: str
    market: str
    model_status: str
    model_type: str
    supported_horizons: List[int]
    target: str
    model_version: str
    last_trained: str
    directional_accuracy: Optional[float] = None
    models_count: int
    best_model_name: Optional[str] = None


class UnsupportedStockInfo(BaseModel):
    """Market universe stock without a dedicated trained model."""

    symbol: str
    company_name: str
    market: str
    model_status: str
    message: str


class HorizonCoverageItem(BaseModel):
    """Analytics across forecast horizons."""

    horizon: int
    label: str
    models_count: int
    stocks_supported: int
    avg_mae: Optional[float] = None
    avg_rmse: Optional[float] = None
    avg_directional_accuracy: Optional[float] = None
    latest_prediction: Optional[Dict[str, Any]] = None


class MLOverviewResponse(BaseModel):
    """Centralized machine learning intelligence center overview."""

    total_models: int
    supported_stocks_count: int
    production_models: int
    candidate_models: int
    total_prediction_requests: int
    average_directional_accuracy: Optional[float] = None
    last_training_timestamp: Optional[str] = None
    latest_inference_timestamp: Optional[str] = None
    status: str
    supported_stocks: List[SupportedStockInfo]
    unsupported_stocks: List[UnsupportedStockInfo]
    horizon_coverage: List[HorizonCoverageItem]
    performance_by_stock: List[Dict[str, Any]]
    performance_by_model: List[Dict[str, Any]]


class PipelineHealthResponse(BaseModel):
    """Live status of machine learning pipeline subsystems."""

    market_data_api: Dict[str, Any]
    ml_inference_api: Dict[str, Any]
    model_registry: Dict[str, Any]
    database: Dict[str, Any]
    latest_model_status: str
    overall_status: str
    timestamp: str


class MarketForecastItem(BaseModel):
    """Unified AI market forecast entity for multi-stock comparative intelligence."""

    symbol: str
    company_name: str
    market: str
    current_price: Optional[float] = None
    predicted_price: Optional[float] = None
    predicted_return: Optional[float] = None
    direction: str = "Neutral"  # "Bullish" | "Bearish" | "Neutral"
    horizon: int = 1
    model_name: str
    model_version: str
    historical_accuracy: Optional[float] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    last_updated: Optional[str] = None
    status: str = "READY"  # "READY" | "UNAVAILABLE"
    message: Optional[str] = None
    signals: Optional[List[ForecastSignal]] = None


class MarketForecastsResponse(BaseModel):
    """Multi-stock AI market forecast overview response for active horizon."""

    horizon: int
    total_supported: int
    forecasts: List[MarketForecastItem]
