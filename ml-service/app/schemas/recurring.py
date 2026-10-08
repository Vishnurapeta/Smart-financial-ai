"""Pydantic Request and Response Schemas for Recurring & Subscription Pattern Intelligence."""

from typing import List, Optional
from pydantic import BaseModel, Field


class TransactionItem(BaseModel):
    """Transaction input structure for recurring detection."""

    id: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: Optional[str] = "USD"
    category: Optional[str] = None
    date: str
    type: Optional[str] = "EXPENSE"


class RecurringDetectionRequest(BaseModel):
    """Request payload containing historical transactions."""

    transactions: List[TransactionItem] = Field(..., min_length=1)
    reference_date: Optional[str] = Field(
        None, description="Optional ISO timestamp representing the 'now' baseline"
    )


class DetectedRecurringPattern(BaseModel):
    """Output recurring pattern detected from transaction history."""

    merchant: str
    normalizedMerchant: str
    expectedAmount: float
    currency: str
    frequency: str
    recurringType: str
    confidence: float
    confidenceLevel: Optional[str] = "HIGH"
    tier: Optional[str] = "CONFIRMED"
    source: Optional[str] = "AI_DETECTED"
    intervalDays: int
    transactionCount: int
    lastTransactionDate: str
    nextExpectedDate: str
    isPossiblyInactive: bool
    inactivityEvidence: Optional[str] = None
    isActive: bool
    matchedTransactionIds: List[str] = []


class RecurringDetectionResponse(BaseModel):
    """Standard API response container for recurring detection."""

    status: str = "success"
    total_detected: int
    patterns: List[DetectedRecurringPattern]
