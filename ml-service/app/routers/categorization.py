"""FastAPI Router for Natural Language Transaction Categorization."""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.schemas.categorization import (
    CategorizationRequest,
    CategorizationResponse,
    CategorizedTransactionData,
)
from app.ml.pipeline import pipeline
from app.core.logger import logger

router = APIRouter(prefix="/categorize", tags=["Categorization"])


@router.post("", response_model=CategorizationResponse)
async def categorize_transaction(payload: CategorizationRequest):
    """Categorize a natural-language transaction input and return structured entity data."""
    if not payload or not isinstance(payload.text, str) or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Transaction description cannot be empty")

    try:
        ref_date = None
        if payload.date_context:
            try:
                ref_date = datetime.fromisoformat(payload.date_context.replace("Z", "+00:00"))
            except Exception:
                pass

        result = pipeline.process(
            payload.text,
            reference_date=ref_date,
            default_currency=payload.base_currency or "INR",
        )
        return CategorizationResponse(
            status="success",
            data=CategorizedTransactionData(**result),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing categorization for '{payload.text}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to categorize transaction: {str(e)}")
