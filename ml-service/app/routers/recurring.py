"""FastAPI Router for Recurring Expenses & Subscriptions Intelligence."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from app.ml.recurring_detector import detect_recurring_patterns
from app.schemas.recurring import (
    DetectedRecurringPattern,
    RecurringDetectionRequest,
    RecurringDetectionResponse,
)

router = APIRouter(prefix="/recurring-detect", tags=["Recurring Intelligence"])


@router.post(
    "",
    response_model=RecurringDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect recurring expense & subscription patterns from historical transactions",
)
async def detect_recurring_endpoint(payload: RecurringDetectionRequest):
    """
    Analyzes historical transactions using merchant similarity, amount consistency,
    time intervals, and frequency to identify recurring expenses and subscriptions.
    """
    ref_dt = None
    if payload.reference_date:
        try:
            ref_dt = datetime.fromisoformat(
                payload.reference_date.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reference_date format. Must be a valid ISO-8601 string.",
            )

    tx_dicts = [tx.model_dump() for tx in payload.transactions]
    patterns_raw = detect_recurring_patterns(tx_dicts, reference_date=ref_dt)

    typed_patterns = [DetectedRecurringPattern(**p) for p in patterns_raw]

    return RecurringDetectionResponse(
        status="success",
        total_detected=len(typed_patterns),
        patterns=typed_patterns,
    )
