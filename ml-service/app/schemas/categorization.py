"""Pydantic Request and Response Schemas for Transaction Categorization."""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class CategorizationRequest(BaseModel):
    """Input payload for natural language transaction categorization."""

    text: str = Field(
        ..., min_length=1, max_length=500, description="Natural text description of the transaction"
    )
    date_context: Optional[str] = Field(
        None, description="Optional ISO timestamp representing evaluation context"
    )
    base_currency: Optional[str] = Field(
        None, description="Optional user base currency fallback"
    )

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("Transaction description cannot be empty or whitespace only")
        return v.strip()


class CategorizedTransactionData(BaseModel):
    """Structured categorized transaction payload."""

    raw_text: str
    amount: Optional[float] = None
    currency: str
    merchant: str
    category: str
    category_name: str
    subcategory: str
    transaction_type: str
    date: str
    confidence: float
    requires_confirmation: bool
    source: str
    model_version: str
    explanation: Optional[str] = None
    is_approximate: Optional[bool] = False
    confidence_level: Optional[str] = "HIGH"
    field_confidence: Optional[dict] = None


class CategorizationResponse(BaseModel):
    """Standard API response container."""

    status: str = "success"
    data: CategorizedTransactionData
