"""
Pydantic schemas for the AI Stock Prediction Intelligence Center & Screener.
Follows strict typing, zero mock values, and clean documentation.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CandidateModelMetric(BaseModel):
    model_name: str
    model_key: str
    directional_accuracy: float
    rmse: float
    mae: float
    r2: float
    is_production: bool


class StockPredictionIntelligenceItem(BaseModel):
    rank: int = Field(..., description="Rank in universe sorted by expected return descending")
    symbol: str = Field(..., description="Stock ticker symbol")
    company_name: str = Field(..., description="Full legal company name")
    sector: str = Field(..., description="Standard industry sector (IT, Banking, Energy, etc.)")
    industry: str = Field(..., description="Specific industry classification")
    market: str = Field(..., description="Primary trading market (e.g. NSE, NASDAQ)")
    market_cap_category: str = Field(..., description="Large Cap, Mid Cap, Small Cap")
    current_price: float = Field(..., description="Most recent actual market close price (INR/USD)")
    predicted_price: float = Field(..., description="Model forecasted close price for horizon")
    expected_return: float = Field(..., description="Predicted percentage change from current price")
    direction: str = Field(..., description="Bullish (>+2%), Bearish (<-2%), or Neutral")
    horizon: int = Field(..., description="Prediction horizon in trading days (1, 5, 20)")
    best_model: str = Field(..., description="Name of the best-performing production model")
    best_model_key: str = Field(..., description="Key identifier of model architecture")
    directional_accuracy: float = Field(..., description="Historical out-of-sample directional accuracy (%)")
    reliability_level: str = Field(..., description="Mathematical reliability tier (HIGH, MODERATE, LOW)")
    reliability_score: float = Field(..., description="Composite reliability metric [0.0 - 1.0]")
    mae: float = Field(..., description="Validation Mean Absolute Error")
    rmse: float = Field(..., description="Validation Root Mean Squared Error")
    r2: float = Field(..., description="Validation Coefficient of Determination (R²)")
    latest_market_date: str = Field(..., description="Date of the input observation used for inference")
    prediction_timestamp: str = Field(..., description="ISO timestamp when prediction was computed")
    candidate_models: Optional[List[CandidateModelMetric]] = Field(default=[], description="Comparison of candidate models")
    horizons: Optional[Dict[str, Any]] = Field(default=None, description="Multi-horizon forecasts dictionary")


class UniverseIntelligenceSummary(BaseModel):
    total_supported: int = Field(..., description="Total supported stocks discovered in dataset")
    predictions_available: int = Field(..., description="Stocks with valid verified predictions")
    stocks_without_valid_models: int = Field(..., description="Stocks rejected or with insufficient data")
    registered_models: int = Field(..., description="Total candidate & production models in registry")
    production_models: int = Field(..., description="Total production-selected models")
    predictions_generated: int = Field(..., description="Total active predictions precomputed")
    avg_directional_accuracy: float = Field(..., description="Average directional accuracy of production models")
    last_training_time: Optional[str] = Field(None, description="Last pipeline training completion timestamp")
    last_prediction_update: Optional[str] = Field(None, description="Last prediction update timestamp")


class StockIntelligenceResponse(BaseModel):
    items: List[StockPredictionIntelligenceItem]
    total_count: int
    page: int
    limit: int
    total_pages: int
    summary: UniverseIntelligenceSummary


class SectorPerformanceItem(BaseModel):
    sector: str
    avg_expected_return: float
    stocks_count: int
    bullish_count: int
    bearish_count: int
    neutral_count: int
    top_stock_symbol: str
    top_stock_return: float


class SectorsPerformanceResponse(BaseModel):
    sectors: List[SectorPerformanceItem]
    timestamp: str


class ModelArchitecturePerformanceItem(BaseModel):
    model_name: str
    model_key: str
    stocks_evaluated: int
    avg_directional_accuracy: float
    avg_mae: float
    avg_rmse: float
    avg_r2: float
    production_models_count: int


class ModelArchitecturePerformanceResponse(BaseModel):
    models: List[ModelArchitecturePerformanceItem]
    timestamp: str


class StockModelComparisonResponse(BaseModel):
    symbol: str
    company_name: str
    sector: str
    current_price: float
    horizons: Dict[str, Any]


class TrainingStatusResponse(BaseModel):
    total_discovered: int
    completed: int
    insufficient_data: int
    failed_validation: int
    registered_models: int
    production_models: int
    rejected_stocks: List[Dict[str, Any]]
    status: str
    duration_seconds: float
    last_training_timestamp: Optional[str] = None
