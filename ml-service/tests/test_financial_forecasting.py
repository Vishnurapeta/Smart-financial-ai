"""
Comprehensive Unit & Integration Tests for Financial Forecasting Subsystem.
Tests data validation, feature engineering, models, baseline selection, and FastAPI endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.forecasting.engine import FinancialForecastingEngine
from app.forecasting.evaluator import TimeSeriesEvaluator
from app.forecasting.feature_pipeline import FinancialFeaturePipeline
from app.forecasting.models import (
    ExponentialSmoothingForecaster,
    LinearRegressionForecaster,
    MovingAverageForecaster,
    RandomForestForecaster,
    XGBoostForecaster,
)
from app.schemas.forecasting import (
    CashFlowForecastRequest,
    ExpenseForecastRequest,
    MonthlyDataPoint,
    PlannedContributionsData,
    PlannedContributionItem,
    RecurringCommitmentsData,
    RecurringCommitmentItem,
)
import numpy as np


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_monthly_series():
    """Deterministic 12-month financial fixture for test isolation."""
    data = []
    base_expenses = [
        20000, 21500, 19800, 22000, 23500, 21000,
        24000, 22500, 25000, 24200, 26000, 25500,
    ]
    base_incomes = [
        50000, 50000, 52000, 52000, 52000, 55000,
        55000, 55000, 55000, 58000, 58000, 58000,
    ]
    for i, (exp, inc) in enumerate(zip(base_expenses, base_incomes)):
        month = i + 1
        data.append(
            MonthlyDataPoint(
                period=f"2025-{month:02d}",
                total_expense=float(exp),
                total_income=float(inc),
                category_expenses={
                    "Food": float(exp * 0.35),
                    "Housing": float(exp * 0.40),
                    "Transport": float(exp * 0.15),
                    "Shopping": float(exp * 0.10) if month >= 10 else 0.0,
                },
                transaction_count=35 + i,
            )
        )
    return data


def test_insufficient_data_handling():
    """Verify that fewer than 3 months of history gracefully returns insufficient_data status."""
    short_series = [
        MonthlyDataPoint(period="2026-01", total_expense=15000.0, total_income=40000.0, transaction_count=10),
        MonthlyDataPoint(period="2026-02", total_expense=16000.0, total_income=40000.0, transaction_count=12),
    ]
    req = ExpenseForecastRequest(
        user_id="user_test_123",
        frequency="monthly",
        horizon=3,
        historical_series=short_series,
    )
    resp = FinancialForecastingEngine.generate_expense_forecast(req)
    assert resp.status == "insufficient_data"
    assert resp.actual_history_months == 2
    assert resp.min_history_required == 3
    assert len(resp.forecast) == 0


def test_feature_pipeline_no_lookahead_bias(sample_monthly_series):
    """Verify that feature matrix uses strictly backward-looking lag variables."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    assert len(values) == 12
    assert len(periods) == 12

    X, y, valid_periods = FinancialFeaturePipeline.build_feature_matrix(values, periods)
    assert len(X) == 9  # 12 - 3 lags = 9
    assert len(y) == 9
    assert valid_periods[0] == "2025-04"

    # Row 0 target is 2025-04 value: lags must be index 2, 1, 0
    assert y[0] == values[3]
    # Check lag_1, lag_2, lag_3 in X row 0
    assert X[0][3] == values[2]  # lag_1
    assert X[0][4] == values[1]  # lag_2
    assert X[0][5] == values[0]  # lag_3


def test_moving_average_forecaster(sample_monthly_series):
    """Verify 3-Month Moving Average baseline prediction."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    ma = MovingAverageForecaster(window=3)
    ma.fit(values, periods)
    preds = ma.predict(values, periods[-1], horizon=3)

    assert len(preds) == 3
    # First prediction must equal the mean of the last 3 values
    expected_first = np.mean(values[-3:])
    assert abs(preds[0] - expected_first) < 1e-4
    assert all(p > 0 for p in preds)


def test_linear_regression_forecaster(sample_monthly_series):
    """Verify Linear Regression forecaster produces valid forward trajectory."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    lr = LinearRegressionForecaster()
    lr.fit(values, periods)
    preds = lr.predict(values, periods[-1], horizon=3)

    assert len(preds) == 3
    assert all(p > 0 for p in preds)


def test_random_forest_forecaster(sample_monthly_series):
    """Verify Random Forest forecaster."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    rf = RandomForestForecaster(n_estimators=20)
    rf.fit(values, periods)
    preds = rf.predict(values, periods[-1], horizon=3)

    assert len(preds) == 3
    assert all(p > 0 for p in preds)


def test_xgboost_forecaster(sample_monthly_series):
    """Verify XGBoost forecaster."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    xgb_model = XGBoostForecaster(n_estimators=20)
    xgb_model.fit(values, periods)
    preds = xgb_model.predict(values, periods[-1], horizon=3)

    assert len(preds) == 3
    assert all(p > 0 for p in preds)


def test_exponential_smoothing_forecaster(sample_monthly_series):
    """Verify Holt Linear Trend Exponential Smoothing."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    es = ExponentialSmoothingForecaster()
    es.fit(values, periods)
    preds = es.predict(values, periods[-1], horizon=3)

    assert len(preds) == 3
    assert all(p > 0 for p in preds)


def test_model_selection_beats_or_retains_baseline(sample_monthly_series):
    """Verify TimeSeriesEvaluator holdout validation and model selection logic."""
    values, periods = FinancialFeaturePipeline.extract_time_series_arrays(sample_monthly_series)
    best_model, metrics, comparisons, reason = TimeSeriesEvaluator.evaluate_and_select_best_model(
        values, periods
    )

    assert best_model is not None
    assert metrics.mae >= 0.0
    assert metrics.rmse >= 0.0
    assert len(comparisons) >= 2
    # At least 1 model is marked selected
    assert any(c.is_selected for c in comparisons)


def test_category_forecast_data_sufficiency(sample_monthly_series):
    """Verify category eligibility: >=3 months eligible, <3 months insufficient_data."""
    req = ExpenseForecastRequest(
        user_id="user_test_123",
        frequency="monthly",
        horizon=3,
        historical_series=sample_monthly_series,
    )
    resp = FinancialForecastingEngine.generate_expense_forecast(req)
    assert resp.status == "success"

    food_cat = next((c for c in resp.category_forecasts if c.category == "Food"), None)
    assert food_cat is not None
    assert food_cat.status == "eligible"
    assert food_cat.predicted_expense > 0

    shopping_cat = next((c for c in resp.category_forecasts if c.category == "Shopping"), None)
    assert shopping_cat is not None
    # Shopping had only 3 months (months 10, 11, 12), so exactly 3 months -> eligible
    assert shopping_cat.history_months == 3


def test_cash_flow_net_flow_calculation(sample_monthly_series):
    """Verify cash-flow formula: Net = Income - Expenses - Contributions."""
    req = CashFlowForecastRequest(
        user_id="user_test_123",
        frequency="monthly",
        horizon=3,
        historical_series=sample_monthly_series,
        recurring_commitments=RecurringCommitmentsData(
            total_monthly=12000.0,
            items=[RecurringCommitmentItem(merchant="Housing Rent", amount=12000.0, frequency="MONTHLY")]
        ),
        planned_contributions=PlannedContributionsData(
            total_monthly=5000.0,
            items=[PlannedContributionItem(title="Emergency Fund", amount=5000.0)]
        ),
    )
    resp = FinancialForecastingEngine.generate_cash_flow_forecast(req)
    assert resp.status == "success"
    assert len(resp.forecast) == 3

    for item in resp.forecast:
        expected_net = round(item.expected_income - item.expected_expenses - item.planned_contributions, 2)
        assert abs(item.projected_net_cash_flow - expected_net) < 1e-2
        assert item.planned_contributions == 5000.0
        assert item.fixed_recurring_expenses <= item.expected_expenses


def test_fastapi_expense_forecast_endpoint(client, sample_monthly_series):
    """Test POST /api/v1/forecasts/expenses endpoint."""
    payload = {
        "user_id": "test_user_789",
        "frequency": "monthly",
        "horizon": 3,
        "historical_series": [dp.model_dump() for dp in sample_monthly_series],
        "recurring_commitments": {
            "total_monthly": 10000.0,
            "items": [{"merchant": "Rent", "amount": 10000.0, "frequency": "MONTHLY"}]
        }
    }
    response = client.post("/api/v1/forecasts/expenses", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["forecast_type"] == "expense"
    assert len(data["forecast"]) == 3
    assert data["model"] is not None
    assert data["metrics"] is not None


def test_fastapi_cash_flow_endpoint(client, sample_monthly_series):
    """Test POST /api/v1/forecasts/cash-flow endpoint."""
    payload = {
        "user_id": "test_user_789",
        "frequency": "monthly",
        "horizon": 3,
        "historical_series": [dp.model_dump() for dp in sample_monthly_series],
        "recurring_commitments": {"total_monthly": 10000.0, "items": []},
        "planned_contributions": {"total_monthly": 4000.0, "items": []},
    }
    response = client.post("/api/v1/forecasts/cash-flow", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["forecast_type"] == "cash_flow"
    assert len(data["forecast"]) == 3


def test_fastapi_models_endpoint(client):
    """Test GET /api/v1/forecasts/models endpoint."""
    response = client.get("/api/v1/forecasts/models")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "supported_models" in data
    assert any(m["name"] == "3-Month Moving Average" for m in data["supported_models"])
