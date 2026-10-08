"""
FastAPI Router for Financial Anomaly Detection.
Provides microservice endpoints for statistical and ML-based unusual spending detection.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

from app.core.config import settings
from app.core.logger import logger
from app.anomalies.engine import AnomalyDetectionEngine
from app.schemas.anomalies import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyDetectorMetadata,
)

router = APIRouter(prefix="/anomalies", tags=["Financial Anomaly Detection"])
anomaly_engine = AnomalyDetectionEngine()


def verify_service_token(authorization: Optional[str] = Header(None)) -> None:
    """
    Enforces service-to-service authentication when configured.
    """
    if not settings.SERVICE_AUTH_TOKEN:
        return

    # In development mode, allow localhost internal requests if token is empty
    if settings.PYTHON_ENV == "development" and not authorization:
        return

    expected = f"Bearer {settings.SERVICE_AUTH_TOKEN}"
    if authorization != expected and authorization != settings.SERVICE_AUTH_TOKEN:
        logger.warning("Unauthorized financial anomaly detection request received")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service authorization credentials",
        )


@router.post(
    "/detect",
    response_model=AnomalyDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect Financial Spending Anomalies",
    description="""
    Evaluates a user's transaction stream for unusual spending behavior.
    - Strictly preserves chronological causality to avoid look-ahead temporal leakage.
    - Evaluates robust statistical baselines (Median + MAD Modified Z-score).
    - Evaluates multi-dimensional Isolation Forest tree ensembles.
    - Combines signals and generates human-interpretable contributing factors.
    - Identifies AMOUNT_ANOMALY, CATEGORY_ANOMALY, MERCHANT_ANOMALY, and FREQUENCY_ANOMALY.
    - Never uses fraud terminology; flags transactions neutrally as unusual patterns.
    """,
)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    authorization: Optional[str] = Header(None),
):
    verify_service_token(authorization)
    try:
        response = anomaly_engine.detect_anomalies(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Error during anomaly detection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Financial anomaly detection failed: {str(e)}",
        )


@router.get(
    "/info",
    response_model=AnomalyDetectorMetadata,
    status_code=status.HTTP_200_OK,
    summary="Get Anomaly Detector Metadata and Thresholds",
)
async def get_detector_info():
    """
    Returns detector configuration, algorithm versions, and threshold boundaries.
    """
    return AnomalyDetectorMetadata()
