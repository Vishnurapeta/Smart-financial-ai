"""
Pydantic Schemas for Financial Anomaly Detection.
Provides strict contracts for anomaly detection, explainability, and user feedback.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    AMOUNT_ANOMALY = "AMOUNT_ANOMALY"
    CATEGORY_ANOMALY = "CATEGORY_ANOMALY"
    MERCHANT_ANOMALY = "MERCHANT_ANOMALY"
    FREQUENCY_ANOMALY = "FREQUENCY_ANOMALY"


class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AnomalyStatus(str, Enum):
    NEW = "NEW"
    REVIEWED = "REVIEWED"
    DISMISSED = "DISMISSED"
    CONFIRMED_UNUSUAL = "CONFIRMED_UNUSUAL"
    RESOLVED = "RESOLVED"


class AnomalyFeedbackType(str, Enum):
    EXPECTED = "EXPECTED"
    UNUSUAL = "UNUSUAL"
    DISMISSED = "DISMISSED"


class TransactionInputItem(BaseModel):
    """Normalized transaction record supplied to the detector."""
    id: str = Field(..., description="Transaction unique ID")
    date: str = Field(..., description="ISO 8601 transaction timestamp")
    amount: float = Field(..., description="Transaction amount")
    currency: str = Field("USD", description="3-letter currency code")
    merchant: str = Field(..., description="Merchant name")
    category: str = Field(..., description="Category name or slug")
    type: str = Field("EXPENSE", description="EXPENSE, INCOME, or TRANSFER")
    is_recurring: bool = Field(False, description="Whether transaction is a known recurring expense")


class ContributingFeatureItem(BaseModel):
    """Individual feature signal contributing to the anomaly classification."""
    feature: str = Field(..., description="Feature name, e.g. 'category_amount_deviation'")
    value: float = Field(..., description="Calculated feature value or z-score")
    impact: str = Field("medium", description="'high', 'medium', or 'low'")
    description: str = Field(..., description="Human-readable signal explanation")


class DetectedAnomalyItem(BaseModel):
    """An identified unusual transaction with scores and explainability."""
    transaction_id: str = Field(..., description="Reference transaction ID")
    date: str = Field(...)
    amount: float = Field(...)
    currency: str = Field("USD")
    merchant: str = Field(...)
    category: str = Field(...)
    anomaly_type: AnomalyType = Field(...)
    anomaly_score: float = Field(..., ge=0.0, le=1.0, description="Normalized score 0.0 to 1.0 (higher = more unusual)")
    severity: AnomalySeverity = Field(...)
    reason: str = Field(..., description="Clear, non-fraud explanation of why this transaction is unusual")
    contributing_features: List[ContributingFeatureItem] = Field(default_factory=list)
    detector_type: str = Field("ENSEMBLE", description="'STATISTICAL', 'ISOLATION_FOREST', or 'ENSEMBLE'")


class AnomalyDetectorMetadata(BaseModel):
    """Metadata regarding the anomaly detector algorithms and thresholds."""
    detector_name: str = Field("SmartFin Hybrid Anomaly Detector")
    version: str = Field("1.0.0")
    feature_version: str = Field("1.0.0")
    statistical_baseline: str = Field("Median + Median Absolute Deviation (MAD)")
    ml_model: str = Field("Isolation Forest (scikit-learn)")
    thresholds: Dict[str, float] = Field(
        default_factory=lambda: {
            "high": 0.85,
            "medium": 0.70,
            "low": 0.55,
        }
    )
    evaluated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class AnomalyDetectionRequest(BaseModel):
    """Payload sent by Node API to run anomaly detection on user transactions."""
    user_id: str = Field(..., description="Authenticated user identifier")
    transactions: List[TransactionInputItem] = Field(..., description="User's historical and recent transactions")
    lookback_days: int = Field(90, ge=7, le=365, description="Lookback window for calculating baseline statistics")
    min_history_count: int = Field(5, ge=3, description="Minimum transactions required for personalized detection")


class AnomalyDetectionResponse(BaseModel):
    """Response returned by the anomaly detection microservice."""
    status: str = Field("success", description="'success' or 'insufficient_data'")
    message: Optional[str] = Field(None)
    user_id: str = Field(...)
    total_evaluated: int = Field(0, description="Total transactions analyzed")
    anomalies_detected: int = Field(0, description="Number of unusual transactions flagged")
    anomalies: List[DetectedAnomalyItem] = Field(default_factory=list)
    detector_metadata: AnomalyDetectorMetadata = Field(default_factory=AnomalyDetectorMetadata)
    disclaimer: str = Field(
        "Anomalies represent unusual spending patterns relative to your historical behavior. An anomaly indicates a statistical deviation and does not establish fraud."
    )
