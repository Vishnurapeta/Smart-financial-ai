"""
FastAPI router for AI Stock Prediction & Intelligent Screening Center.
Exposes paginated, filterable, sortable stock intelligence, sector rankings,
model performance benchmarks, stock model comparisons, and training status.
"""
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.core.logger import logger
from app.repositories.universe_prediction_repository import universe_prediction_repository
from app.schemas.universe_predictions import (
    ModelArchitecturePerformanceResponse,
    SectorsPerformanceResponse,
    StockIntelligenceResponse,
    StockModelComparisonResponse,
    TrainingStatusResponse,
)

router = APIRouter(prefix="", tags=["Stock Prediction Intelligence & Screening"])


@router.get(
    "/predictions/stocks",
    response_model=StockIntelligenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Screen and Filter Stock Universe Predictions",
    description="""
    Production-grade AI stock screener supporting server-side filtering, searching,
    sorting, multi-horizon selection, and pagination across all validated equities.
    """,
)
async def get_stock_predictions_screener(
    search: Optional[str] = Query(None, description="Search by ticker symbol, company name, or sector"),
    sector: Optional[str] = Query(None, description="Filter by sector (e.g. IT, Banking, Energy, Pharma)"),
    industry: Optional[str] = Query(None, description="Filter by specific industry"),
    market: Optional[str] = Query(None, description="Filter by market (e.g. NSE, NASDAQ)"),
    horizon: int = Query(1, ge=1, le=30, description="Forecast horizon in trading days (1, 5, 20)"),
    direction: Optional[str] = Query(None, description="Filter direction: Bullish, Neutral, Bearish"),
    min_return: Optional[float] = Query(None, description="Minimum expected return percentage"),
    max_return: Optional[float] = Query(None, description="Maximum expected return percentage"),
    return_range: Optional[str] = Query(None, description="Preset range: >10, 5to10, 2to5, 0to2, 0to-2, -2to-5, <-5"),
    model: Optional[str] = Query(None, description="Filter by best model architecture (e.g. XGBoost, Random Forest)"),
    min_accuracy: Optional[float] = Query(None, description="Minimum historical directional accuracy percentage"),
    sort: str = Query("expected_return_desc", description="Sorting key: expected_return_desc, expected_return_asc, predicted_price_desc, accuracy_desc, symbol_asc, sector_asc"),
    preset: Optional[str] = Query(None, description="Quick preset: top_gainers, top_losers, bullish, bearish, highest_accuracy, it_opportunities, banking_opportunities, energy_opportunities"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(25, ge=1, le=250, description="Records per page (25, 50, 100, 250)"),
):
    try:
        items, total_count, summary = universe_prediction_repository.get_paginated_stocks(
            search=search,
            sector=sector,
            industry=industry,
            market=market,
            horizon=horizon,
            direction=direction,
            min_return=min_return,
            max_return=max_return,
            return_range=return_range,
            model=model,
            min_accuracy=min_accuracy,
            sort=sort,
            preset=preset,
            page=page,
            limit=limit,
        )

        total_pages = max(1, (total_count + limit - 1) // limit) if total_count > 0 else 1

        return StockIntelligenceResponse(
            items=items,
            total_count=total_count,
            page=page,
            limit=limit,
            total_pages=total_pages,
            summary=summary,
        )
    except Exception as e:
        logger.error(f"Error querying stock predictions screener: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve stock predictions from repository.",
        )


@router.get(
    "/predictions/stocks/search",
    response_model=StockIntelligenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Dynamic Stock Search across Supported Universe",
)
async def search_stocks(
    q: str = Query(..., min_length=1, description="Search query string"),
    horizon: int = Query(1, ge=1, le=30),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    try:
        items, total_count, summary = universe_prediction_repository.get_paginated_stocks(
            search=q,
            horizon=horizon,
            page=page,
            limit=limit,
        )
        total_pages = max(1, (total_count + limit - 1) // limit) if total_count > 0 else 1
        return StockIntelligenceResponse(
            items=items,
            total_count=total_count,
            page=page,
            limit=limit,
            total_pages=total_pages,
            summary=summary,
        )
    except Exception as e:
        logger.error(f"Error in search_stocks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search stock predictions.",
        )


@router.get(
    "/predictions/stocks/{symbol}",
    status_code=status.HTTP_200_OK,
    summary="Get Detailed Prediction and Horizon Breakdown for a Stock",
)
async def get_stock_detail(symbol: str):
    detail = universe_prediction_repository.get_stock_detail(symbol)
    if not detail:
        # Check if symbol is in rejected / insufficient data
        status_info = universe_prediction_repository.get_training_status()
        rejected = [r for r in status_info.get("rejected_stocks", []) if r.get("symbol") == symbol.upper()]
        if rejected:
            reason = rejected[0].get("reason", "Insufficient historical data")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prediction unavailable for {symbol.upper()} because the latest historical dataset does not meet the minimum training requirements: {reason}.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No verified prediction or registered production model found for '{symbol.upper()}'.",
        )
    return detail


@router.get(
    "/predictions/stocks/{symbol}/models",
    response_model=StockModelComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare Candidate ML Models for a Stock Across Horizons",
)
async def get_stock_model_comparison(symbol: str):
    detail = universe_prediction_repository.get_stock_detail(symbol)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model comparison unavailable for '{symbol.upper()}'.",
        )
    return StockModelComparisonResponse(
        symbol=detail["symbol"],
        company_name=detail["company_name"],
        sector=detail["sector"],
        current_price=detail["current_price"],
        horizons=detail.get("horizons", {}),
    )


@router.get(
    "/predictions/sectors",
    response_model=SectorsPerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Sector-Level AI Predicted Performance Rankings",
)
async def get_sector_performance(
    horizon: int = Query(1, ge=1, le=30, description="Forecast horizon in days"),
):
    sectors = universe_prediction_repository.get_sector_performance(horizon=horizon)
    t_status = universe_prediction_repository.get_training_status()
    return SectorsPerformanceResponse(
        sectors=sectors,
        timestamp=t_status.get("last_training_timestamp") or "",
    )


@router.get(
    "/predictions/model-performance",
    response_model=ModelArchitecturePerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Model Architecture Performance Benchmarks",
)
async def get_model_performance(
    horizon: int = Query(1, ge=1, le=30, description="Forecast horizon in days"),
):
    models = universe_prediction_repository.get_model_architecture_performance(horizon=horizon)
    t_status = universe_prediction_repository.get_training_status()
    return ModelArchitecturePerformanceResponse(
        models=models,
        timestamp=t_status.get("last_training_timestamp") or "",
    )


@router.get(
    "/training/status",
    response_model=TrainingStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve Real ML Universe Training Pipeline Status",
)
async def get_training_pipeline_status():
    status_dict = universe_prediction_repository.get_training_status()
    return TrainingStatusResponse(
        total_discovered=status_dict.get("total_discovered", 106),
        completed=status_dict.get("completed", 0),
        insufficient_data=status_dict.get("insufficient_data", 0),
        failed_validation=status_dict.get("failed_validation", 0),
        registered_models=status_dict.get("registered_models", 0),
        production_models=status_dict.get("production_models", 0),
        rejected_stocks=status_dict.get("rejected_stocks", []),
        status=status_dict.get("status", "IDLE"),
        duration_seconds=status_dict.get("duration_seconds", 0.0),
        last_training_timestamp=status_dict.get("last_training_timestamp"),
    )


def _execute_retraining_job():
    try:
        from app.pipelines.train_stock_universe import UniverseTrainingPipeline
        pipeline = UniverseTrainingPipeline()
        pipeline.run()
    except Exception as e:
        logger.error(f"Background universe retraining failed: {e}", exc_info=True)


@router.post(
    "/training/stocks",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger Asynchronous Universe Retraining Job",
)
async def trigger_universe_training(background_tasks: BackgroundTasks):
    current_status = universe_prediction_repository.get_training_status()
    if current_status.get("status") == "TRAINING":
        return {"message": "A universe training job is already in progress.", "status": "TRAINING"}

    background_tasks.add_task(_execute_retraining_job)
    return {"message": "Universe training job initiated asynchronously.", "status": "QUEUED"}
