"""
Pydantic Schemas for Financial Forecasting (Expense & Cash-Flow).
Strict validation, zero data leakage, and comprehensive auditability.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class MonthlyDataPoint(BaseModel):
    """Historical aggregate financial record for one calendar month."""
    period: str = Field(..., description="Year-month string, e.g. '2026-01'")
    total_expense: float = Field(0.0, ge=0.0, description="Total expense amount for this month")
    total_income: float = Field(0.0, ge=0.0, description="Total income amount for this month")
    category_expenses: Dict[str, float] = Field(
        default_factory=dict,
        description="Expense breakdown by category name/slug"
    )
    transaction_count: int = Field(0, ge=0, description="Total number of transactions in this month")

    @field_validator("period")
    @classmethod
    def validate_period_format(cls, v: str) -> str:
        parts = v.strip().split("-")
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            raise ValueError(f"Invalid period format '{v}'. Expected 'YYYY-MM'")
        year, month = int(parts[0]), int(parts[1])
        if year < 2000 or year > 2100 or month < 1 or month > 12:
            raise ValueError(f"Period '{v}' has out-of-range year or month")
        return f"{year:04d}-{month:02d}"


class RecurringCommitmentItem(BaseModel):
    """A recurring financial obligation or commitment."""
    merchant: str = Field(..., description="Merchant or commitment title (e.g. Rent, EMI)")
    amount: float = Field(..., gt=0.0, description="Normalized monthly equivalent amount")
    frequency: str = Field("MONTHLY", description="Original frequency (e.g. MONTHLY, ANNUALLY)")
    category: Optional[str] = Field(None, description="Category reference or name")


class RecurringCommitmentsData(BaseModel):
    """Aggregate recurring expenses/commitments known in advance."""
    total_monthly: float = Field(0.0, ge=0.0, description="Sum of monthly recurring commitments")
    items: List[RecurringCommitmentItem] = Field(default_factory=list)


class PlannedContributionItem(BaseModel):
    """Planned savings, investment, or goal contribution."""
    title: str = Field(..., description="Goal title or investment target")
    amount: float = Field(..., gt=0.0, description="Planned monthly contribution amount")
    category: Optional[str] = Field(None, description="Goal category (e.g. EMERGENCY_FUND)")


class PlannedContributionsData(BaseModel):
    """Aggregate planned savings/investment allocations."""
    total_monthly: float = Field(0.0, ge=0.0, description="Sum of monthly planned contributions")
    items: List[PlannedContributionItem] = Field(default_factory=list)


# --- Request Payloads ---

class ExpenseForecastRequest(BaseModel):
    """Payload sent by Node API to request an expense forecast."""
    user_id: str = Field(..., description="Authenticated user identifier")
    frequency: str = Field("monthly", description="Aggregation frequency: monthly (primary) or weekly")
    horizon: int = Field(3, ge=1, le=12, description="Number of future periods to forecast (1, 3, or 6)")
    category: Optional[str] = Field(None, description="Optional specific category filter ('all' or category name)")
    historical_series: List[MonthlyDataPoint] = Field(
        ...,
        description="Chronological historical monthly records of the authenticated user"
    )
    recurring_commitments: Optional[RecurringCommitmentsData] = Field(
        default=None,
        description="Active recurring expenses/commitments"
    )
    preferred_model: Optional[str] = Field(
        None,
        description="Optional requested model type (e.g. 'auto', 'moving_average', 'linear_regression', 'random_forest', 'xgboost')"
    )


class CashFlowForecastRequest(BaseModel):
    """Payload sent by Node API to request a cash-flow forecast."""
    user_id: str = Field(..., description="Authenticated user identifier")
    frequency: str = Field("monthly", description="Aggregation frequency")
    horizon: int = Field(3, ge=1, le=12, description="Number of future periods to forecast")
    historical_series: List[MonthlyDataPoint] = Field(
        ...,
        description="Chronological historical monthly records (income & expense)"
    )
    recurring_commitments: Optional[RecurringCommitmentsData] = Field(
        default=None,
        description="Active recurring commitments"
    )
    planned_contributions: Optional[PlannedContributionsData] = Field(
        default=None,
        description="Active planned savings/investment contributions"
    )


# --- Output / Response Payloads ---

class ForecastPeriodItem(BaseModel):
    """Single period forecast details."""
    period: str = Field(..., description="Forecasted year-month string, e.g. '2026-10'")
    predicted_expense: float = Field(..., description="Model forecasted expense amount")
    fixed_recurring_expenses: float = Field(0.0, description="Known fixed recurring obligations")
    variable_expenses: float = Field(0.0, description="Projected discretionary/variable spending")
    lower_bound: Optional[float] = Field(None, description="Lower prediction interval bound")
    upper_bound: Optional[float] = Field(None, description="Upper prediction interval bound")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Timestamp when forecast was produced"
    )


class CashFlowForecastPeriodItem(BaseModel):
    """Single period cash-flow forecast details."""
    period: str = Field(..., description="Forecasted period, e.g. '2026-10'")
    expected_income: float = Field(..., description="Expected cash inflow for this period")
    expected_expenses: float = Field(..., description="Expected total cash outflow for this period")
    fixed_recurring_expenses: float = Field(0.0, description="Fixed recurring commitments")
    variable_expenses: float = Field(0.0, description="Variable expense forecast")
    planned_contributions: float = Field(0.0, description="Planned savings/investment allocations")
    projected_net_cash_flow: float = Field(..., description="Net cash flow: Income - Expenses - Contributions")
    is_deficit: bool = Field(False, description="True if projected net cash flow is negative")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class CategoryForecastItem(BaseModel):
    """Category-level forecast breakdown with data sufficiency status."""
    category: str = Field(..., description="Category name")
    predicted_expense: float = Field(0.0, description="Forecasted next-month expense for this category")
    historical_avg: float = Field(0.0, description="Historical monthly average for this category")
    history_months: int = Field(..., description="Number of months category had activity")
    status: str = Field("eligible", description="'eligible' or 'insufficient_data'")


class ModelMetadataItem(BaseModel):
    """Metadata regarding the selected forecasting model."""
    name: str = Field(..., description="Model name (e.g. '3-Month Moving Average', 'XGBoost')")
    version: str = Field("1.0.0", description="Model version")
    feature_version: str = Field("1.0.0", description="Feature schema version")
    model_type: str = Field("baseline", description="'baseline', 'regression', 'ensemble', 'hybrid'")
    training_period: str = Field(..., description="Range of historical training data, e.g. '2025-01 to 2026-09'")
    selection_reason: str = Field(..., description="Why this model was selected (e.g. lowest out-of-sample MAE)")


class ForecastMetricsItem(BaseModel):
    """Holdout validation performance metrics."""
    mae: float = Field(..., description="Mean Absolute Error on holdout validation periods")
    rmse: float = Field(..., description="Root Mean Squared Error on holdout validation periods")
    mape: Optional[float] = Field(None, description="Mean Absolute Percentage Error (%)")
    r2: Optional[float] = Field(None, description="Coefficient of determination R-squared")


class CandidateModelComparisonItem(BaseModel):
    """Comparative benchmarking metrics across candidate models evaluated."""
    name: str = Field(..., description="Model architecture name")
    mae: float = Field(...)
    rmse: float = Field(...)
    mape: Optional[float] = Field(None)
    is_selected: bool = Field(False)


class ExpenseForecastResponse(BaseModel):
    """Complete response returned for expense forecasting."""
    status: str = Field("success", description="'success' or 'insufficient_data'")
    message: Optional[str] = Field(None)
    min_history_required: int = Field(3, description="Minimum months needed for forecasting")
    actual_history_months: int = Field(..., description="Actual months of historical data provided")
    user_id: str = Field(...)
    forecast_type: str = Field("expense")
    frequency: str = Field("monthly")
    category: Optional[str] = Field(None)
    historical_series: List[MonthlyDataPoint] = Field(default_factory=list)
    forecast: List[ForecastPeriodItem] = Field(default_factory=list)
    category_forecasts: List[CategoryForecastItem] = Field(default_factory=list)
    model: Optional[ModelMetadataItem] = Field(None)
    metrics: Optional[ForecastMetricsItem] = Field(None)
    candidate_models: List[CandidateModelComparisonItem] = Field(default_factory=list)
    disclaimer: str = Field(
        "Forecasts are model-generated estimates based on historical financial activity and available planned/recurring data. Actual future expenses may differ."
    )


class CashFlowForecastResponse(BaseModel):
    """Complete response returned for cash-flow forecasting."""
    status: str = Field("success", description="'success' or 'insufficient_data'")
    message: Optional[str] = Field(None)
    min_history_required: int = Field(3)
    actual_history_months: int = Field(...)
    user_id: str = Field(...)
    forecast_type: str = Field("cash_flow")
    frequency: str = Field("monthly")
    historical_series: List[MonthlyDataPoint] = Field(default_factory=list)
    forecast: List[CashFlowForecastPeriodItem] = Field(default_factory=list)
    recurring_commitments_monthly: float = Field(0.0)
    planned_contributions_monthly: float = Field(0.0)
    model: Optional[ModelMetadataItem] = Field(None)
    metrics: Optional[ForecastMetricsItem] = Field(None)
    candidate_models: List[CandidateModelComparisonItem] = Field(default_factory=list)
    disclaimer: str = Field(
        "Forecasts are model-generated estimates based on historical financial activity and available planned/recurring data. Actual future cash flow may differ."
    )
