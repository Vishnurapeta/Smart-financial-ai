"""
FastAPI Router for Financial Forecasting (Expenses & Cash-Flow).
Exposes production-quality endpoints for predictive personal finance analytics.
"""
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Header, status

from app.core.config import settings
from app.core.logger import logger
from app.forecasting.engine import forecasting_engine
from app.schemas.forecasting import (
    CashFlowForecastRequest,
    CashFlowForecastResponse,
    ExpenseForecastRequest,
    ExpenseForecastResponse,
)

router = APIRouter(prefix="/forecasts", tags=["Financial Forecasting"])


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
        logger.warning("Unauthorized financial forecast request received")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing service authorization credentials",
        )


@router.post(
    "/expenses",
    response_model=ExpenseForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Personal Expense Forecast",
    description="""
    Generates out-of-sample forward expense forecasts for the authenticated user.
    - Validates chronological data sufficiency (minimum 3 months).
    - Prevents data leakage with strictly backward-looking lag and rolling features.
    - Evaluates Moving Average baseline, Linear Regression, Random Forest, and XGBoost.
    - Selects the champion model based on chronological holdout validation error (MAE).
    - Decomposes forecast into fixed recurring commitments and discretionary variable expenses.
    - Produces category-level forecasts where sufficient category history exists.
    """,
)
async def forecast_expenses(
    request: ExpenseForecastRequest,
    authorization: Optional[str] = Header(None),
):
    verify_service_token(authorization)
    try:
        response = forecasting_engine.generate_expense_forecast(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Error during expense forecasting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Expense forecasting failed: {str(e)}",
        )


@router.post(
    "/cash-flow",
    response_model=CashFlowForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Cash-Flow & Liquidity Forecast",
    description="""
    Projects future cash flow by synthesizing:
    - Expected Cash Inflows (historical income stability and baseline projection)
    - Expected Cash Outflows (model-projected expenses with recurring commitment floor)
    - Planned Savings/Investment Contributions
    - Projected Net Cash Flow = Expected Income - Expected Expenses - Planned Contributions
    """,
)
async def forecast_cash_flow(
    request: CashFlowForecastRequest,
    authorization: Optional[str] = Header(None),
):
    verify_service_token(authorization)
    try:
        response = forecasting_engine.generate_cash_flow_forecast(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Error during cash-flow forecasting: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cash-flow forecasting failed: {str(e)}",
        )


@router.get(
    "/models",
    status_code=status.HTTP_200_OK,
    summary="List Supported Financial Forecasting Models",
)
async def list_forecasting_models():
    """
    Returns registered forecasting model architectures and their selection hierarchy.
    """
    return {
        "status": "success",
        "baseline_champion": "3-Month Moving Average",
        "supported_models": [
            {
                "name": "3-Month Moving Average",
                "type": "baseline",
                "min_months_required": 3,
                "description": "Robust, non-overfitting benchmark for personal finance.",
                "is_default": True,
            },
            {
                "name": "6-Month Moving Average",
                "type": "baseline",
                "min_months_required": 5,
                "description": "Smooth baseline filtering out short-term quarterly spikes.",
            },
            {
                "name": "Exponential Smoothing",
                "type": "time_series",
                "min_months_required": 5,
                "description": "Holt linear trend model with level and trend smoothing.",
            },
            {
                "name": "Linear Regression",
                "type": "regression",
                "min_months_required": 6,
                "description": "Trend, month-of-year seasonality, and lag feature regression.",
            },
            {
                "name": "Random Forest",
                "type": "ensemble",
                "min_months_required": 6,
                "description": "Non-linear decision tree ensemble with lag features.",
            },
            {
                "name": "XGBoost",
                "type": "gradient_boosting",
                "min_months_required": 6,
                "description": "Gradient boosted decision trees for non-linear time series patterns.",
            },
            {
                "name": "Hybrid Cash-Flow",
                "type": "hybrid",
                "min_months_required": 3,
                "description": "Component synthesis: Income Baseline - Expense Model - Planned Contributions.",
            },
        ],
        "disclaimer": "Models are evaluated out-of-sample on holdout validation data. Advanced models are selected only if they beat the Moving Average baseline.",
    }
