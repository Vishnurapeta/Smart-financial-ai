"""
FastAPI router for stock prediction inference and prediction history.
Follows thin-controller pattern and exposes OpenAPI documentation.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.core.logger import logger
from app.repositories.prediction_repository import prediction_repository
from app.schemas.predictions import (
    MarketForecastItem,
    MarketForecastsResponse,
    PredictionHistoryResponse,
    StockPredictionRequest,
    StockPredictionResponse,
)
from app.services.prediction_service import (
    PredictionServiceError,
    prediction_service,
)

router = APIRouter(prefix="/predictions/stock", tags=["Stock Predictions"])


@router.post(
    "",
    response_model=StockPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Stock Price or Return Prediction",
    description="""
    Generates a model-based forecast for the specified stock equity and horizon.
    - Resolves active registered model from the Model Registry.
    - Retrieves latest sanitized market OHLCV data.
    - Generates 58 backward-looking technical features using the verified Prompt 14 pipeline.
    - Validates prediction sanity and returns forecasts with historical model evaluation metrics.
    - Persists prediction record for audit and history tracking.
    """,
    responses={
        200: {"description": "Prediction generated successfully."},
        400: {"description": "Invalid input, symbol, or feature compatibility error."},
        404: {"description": "No active model registered for the requested symbol/horizon."},
        409: {"description": "Requested model is incompatible with target/horizon."},
        503: {"description": "Market data provider is unavailable or data is stale."},
        500: {"description": "Internal model inference failure."},
    },
)
async def predict_stock(request: StockPredictionRequest):
    try:
        response = prediction_service.predict(request)
        return response
    except PredictionServiceError as pse:
        logger.warning(f"PredictionServiceError [{pse.status_code}]: {pse.message}")
        raise HTTPException(status_code=pse.status_code, detail=pse.message)
    except Exception as e:
        logger.error(f"Unexpected error during stock prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during prediction generation.",
        )


SUPPORTED_METADATA = {
    "TCS": {"company_name": "Tata Consultancy Services", "market": "India"},
    "RELIANCE": {"company_name": "Reliance Industries", "market": "India"},
    "INFY": {"company_name": "Infosys", "market": "India"},
    "AAPL": {"company_name": "Apple Inc.", "market": "US"},
}


@router.get(
    "/market-forecasts",
    response_model=MarketForecastsResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Multi-Stock AI Forecasts for Active Horizon",
    description="Returns real machine learning forecasts across all supported equities for a given horizon.",
)
async def get_market_forecasts(
    horizon: int = Query(1, ge=1, le=30, description="Forecast horizon in trading days"),
):
    items = []
    # Identify unique tickers in the model catalog
    all_models = prediction_service.registry.list_models()
    tickers = sorted(
        list(set(m.ticker for m in all_models if m.ticker and not m.ticker.startswith("GLOBAL")))
    )
    if not tickers:
        tickers = ["TCS", "RELIANCE", "INFY", "AAPL"]

    for sym in tickers:
        meta = SUPPORTED_METADATA.get(
            sym, {"company_name": f"{sym} Equity", "market": "Global"}
        )

        # Check if a model exists for this symbol and horizon
        has_horizon_model = any(m.ticker == sym and m.horizon == horizon for m in all_models)

        if not has_horizon_model:
            # Report model unavailable for this specific horizon
            items.append(
                MarketForecastItem(
                    symbol=sym,
                    company_name=meta["company_name"],
                    market=meta["market"],
                    horizon=horizon,
                    model_name="N/A",
                    model_version="N/A",
                    status="UNAVAILABLE",
                    direction="Neutral",
                    message=f"No trained production model registered for {sym} at {horizon}D horizon.",
                )
            )
            continue

        try:
            pred = prediction_service.predict(
                StockPredictionRequest(
                    symbol=sym,
                    horizon=horizon,
                    target="target_next_return",
                    allow_candidate=True,
                )
            )
            val_metrics = pred.historical_metrics or {}
            items.append(
                MarketForecastItem(
                    symbol=sym,
                    company_name=meta["company_name"],
                    market=meta["market"],
                    current_price=pred.current_price,
                    predicted_price=pred.predicted_value,
                    predicted_return=pred.predicted_return,
                    direction=pred.direction or "Neutral",
                    horizon=horizon,
                    model_name=pred.model_name,
                    model_version=pred.model_version,
                    historical_accuracy=val_metrics.get("directional_accuracy"),
                    mae=val_metrics.get("mae"),
                    rmse=val_metrics.get("rmse"),
                    r2=val_metrics.get("r2"),
                    last_updated=pred.prediction_timestamp,
                    status="READY",
                    signals=pred.signals,
                )
            )
        except Exception as e:
            logger.warning(f"Could not compute batch forecast for {sym} ({horizon}D): {e}")
            items.append(
                MarketForecastItem(
                    symbol=sym,
                    company_name=meta["company_name"],
                    market=meta["market"],
                    horizon=horizon,
                    model_name="Registered",
                    model_version="1.0.0",
                    status="UNAVAILABLE",
                    direction="Neutral",
                    message=f"Live inference temporarily unavailable: {str(e)}",
                )
            )

    return MarketForecastsResponse(
        horizon=horizon,
        total_supported=len(items),
        forecasts=items,
    )


@router.get(
    "/history",
    response_model=PredictionHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Global Stock Prediction History",
    description="Returns paginated historical predictions across all or filtered stock symbols.",
)
async def get_all_prediction_history(
    symbol: Optional[str] = Query(None, description="Optional stock ticker filter"),
    horizon: Optional[int] = Query(None, ge=1, le=30, description="Filter by horizon"),
    model: Optional[str] = Query(None, description="Filter by model name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (PENDING, COMPLETED)"),
    start_date: Optional[str] = Query(None, description="Filter on/after ISO timestamp"),
    end_date: Optional[str] = Query(None, description="Filter on/before ISO timestamp"),
    limit: int = Query(50, ge=1, le=200, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
):
    clean_sym = symbol.strip().upper() if symbol else None
    records, total_count = prediction_repository.get_history(
        symbol=clean_sym,
        horizon=horizon,
        model=model,
        status_filter=status_filter,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )

    return PredictionHistoryResponse(
        symbol=clean_sym,
        total_count=total_count,
        limit=limit,
        offset=offset,
        items=records,
    )


@router.get(
    "/{symbol}/history",
    response_model=PredictionHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Historical Stock Predictions for Symbol",
    description="Returns paginated historical predictions recorded for a given stock symbol.",
)
async def get_prediction_history(
    symbol: str,
    horizon: Optional[int] = Query(None, ge=1, le=30, description="Filter by horizon"),
    model: Optional[str] = Query(None, description="Filter by model name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    start_date: Optional[str] = Query(None, description="Filter on/after ISO timestamp"),
    end_date: Optional[str] = Query(None, description="Filter on/before ISO timestamp"),
    limit: int = Query(50, ge=1, le=200, description="Page limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
):
    clean_sym = symbol.strip().upper()
    records, total_count = prediction_repository.get_history(
        symbol=clean_sym,
        horizon=horizon,
        model=model,
        status_filter=status_filter,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )

    return PredictionHistoryResponse(
        symbol=clean_sym,
        total_count=total_count,
        limit=limit,
        offset=offset,
        items=records,
    )

