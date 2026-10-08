"""
Core Financial Forecasting Engine for Expense and Cash-Flow Forecasting.
Enforces user isolation, data sufficiency, and strict separation between historical facts and forward estimates.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional
import numpy as np

from app.forecasting.evaluator import TimeSeriesEvaluator
from app.forecasting.feature_pipeline import FinancialFeaturePipeline
from app.schemas.forecasting import (
    CashFlowForecastPeriodItem,
    CashFlowForecastRequest,
    CashFlowForecastResponse,
    CategoryForecastItem,
    ExpenseForecastRequest,
    ExpenseForecastResponse,
    ForecastPeriodItem,
    ModelMetadataItem,
)


class FinancialForecastingEngine:
    """
    Production-grade financial forecasting engine.
    """

    MIN_HISTORY_REQUIRED = 3

    @classmethod
    def generate_expense_forecast(
        cls, request: ExpenseForecastRequest
    ) -> ExpenseForecastResponse:
        """
        Produces model-backed multi-period expense forecast.
        """
        sorted_series = FinancialFeaturePipeline.clean_and_sort_series(
            request.historical_series
        )
        actual_months = len(sorted_series)

        # 1. Enforce data sufficiency
        if actual_months < cls.MIN_HISTORY_REQUIRED:
            return ExpenseForecastResponse(
                status="insufficient_data",
                message=(
                    f"At least {cls.MIN_HISTORY_REQUIRED} months of transaction history are "
                    f"required to generate an expense forecast. Found {actual_months} months."
                ),
                min_history_required=cls.MIN_HISTORY_REQUIRED,
                actual_history_months=actual_months,
                user_id=request.user_id,
                forecast_type="expense",
                frequency=request.frequency,
                category=request.category,
                historical_series=sorted_series,
            )

        # 2. Extract target values (Total expense or specific category)
        if request.category and request.category.lower() != "all":
            target_cat = request.category
            values = []
            periods = []
            for dp in sorted_series:
                periods.append(dp.period)
                cat_val = dp.category_expenses.get(target_cat, 0.0)
                values.append(float(cat_val))
            values_arr = np.array(values, dtype=float)
        else:
            values_arr, periods = FinancialFeaturePipeline.extract_time_series_arrays(
                sorted_series, target_field="total_expense"
            )

        last_period = periods[-1]
        horizon = min(max(1, request.horizon), 12)

        # 3. Model evaluation & selection
        best_model, metrics, comparisons, reason = (
            TimeSeriesEvaluator.evaluate_and_select_best_model(
                values_arr, periods, request.preferred_model
            )
        )

        # 4. Generate forward predictions
        predictions = best_model.predict(values_arr, last_period, horizon)
        future_periods = FinancialFeaturePipeline.compute_next_periods(last_period, horizon)

        # 5. Fixed recurring obligations vs variable discretionary expenses
        recurring_monthly = (
            request.recurring_commitments.total_monthly
            if request.recurring_commitments
            else 0.0
        )

        forecast_items: List[ForecastPeriodItem] = []
        rmse_val = metrics.rmse if metrics.rmse > 0 else (np.std(values_arr) * 0.5)

        for period_str, pred in zip(future_periods, predictions):
            pred_rounded = round(float(pred), 2)
            fixed_part = min(recurring_monthly, pred_rounded)
            var_part = max(0.0, round(pred_rounded - fixed_part, 2))

            # 80% empirical prediction interval (+/- 1.28 * RMSE)
            lower = max(0.0, round(pred_rounded - 1.28 * rmse_val, 2))
            upper = round(pred_rounded + 1.28 * rmse_val, 2)

            forecast_items.append(
                ForecastPeriodItem(
                    period=period_str,
                    predicted_expense=pred_rounded,
                    fixed_recurring_expenses=round(fixed_part, 2),
                    variable_expenses=var_part,
                    lower_bound=lower,
                    upper_bound=upper,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            )

        # 6. Category-level forecasts
        category_forecasts: List[CategoryForecastItem] = []
        cat_months_count: Dict[str, int] = {}
        cat_values_map: Dict[str, List[float]] = {}

        for dp in sorted_series:
            for cat_name, amt in dp.category_expenses.items():
                if amt > 0:
                    cat_months_count[cat_name] = cat_months_count.get(cat_name, 0) + 1
                    cat_values_map.setdefault(cat_name, []).append(amt)

        for cat_name, count in sorted(cat_months_count.items(), key=lambda x: -x[1]):
            amt_list = cat_values_map.get(cat_name, [])
            avg_val = float(np.mean(amt_list)) if amt_list else 0.0

            if count >= cls.MIN_HISTORY_REQUIRED:
                # 3-Month moving average for category forecast
                w = min(3, len(amt_list))
                pred_cat = float(np.mean(amt_list[-w:])) if w > 0 else avg_val
                category_forecasts.append(
                    CategoryForecastItem(
                        category=cat_name,
                        predicted_expense=round(pred_cat, 2),
                        historical_avg=round(avg_val, 2),
                        history_months=count,
                        status="eligible",
                    )
                )
            else:
                category_forecasts.append(
                    CategoryForecastItem(
                        category=cat_name,
                        predicted_expense=0.0,
                        historical_avg=round(avg_val, 2),
                        history_months=count,
                        status="insufficient_data",
                    )
                )

        training_period_str = f"{periods[0]} to {periods[-1]}"
        model_meta = ModelMetadataItem(
            name=best_model.name,
            version=best_model.version,
            feature_version="1.0.0",
            model_type="baseline" if "Moving Average" in best_model.name else "machine_learning",
            training_period=training_period_str,
            selection_reason=reason,
        )

        return ExpenseForecastResponse(
            status="success",
            actual_history_months=actual_months,
            user_id=request.user_id,
            forecast_type="expense",
            frequency=request.frequency,
            category=request.category,
            historical_series=sorted_series,
            forecast=forecast_items,
            category_forecasts=category_forecasts,
            model=model_meta,
            metrics=metrics,
            candidate_models=comparisons,
        )

    @classmethod
    def generate_cash_flow_forecast(
        cls, request: CashFlowForecastRequest
    ) -> CashFlowForecastResponse:
        """
        Produces multi-period cash-flow forecast combining income, expenses, and planned contributions.
        """
        sorted_series = FinancialFeaturePipeline.clean_and_sort_series(
            request.historical_series
        )
        actual_months = len(sorted_series)

        if actual_months < cls.MIN_HISTORY_REQUIRED:
            return CashFlowForecastResponse(
                status="insufficient_data",
                message=(
                    f"At least {cls.MIN_HISTORY_REQUIRED} months of transaction history are "
                    f"required to generate a cash-flow forecast. Found {actual_months} months."
                ),
                min_history_required=cls.MIN_HISTORY_REQUIRED,
                actual_history_months=actual_months,
                user_id=request.user_id,
                forecast_type="cash_flow",
                frequency=request.frequency,
                historical_series=sorted_series,
            )

        horizon = min(max(1, request.horizon), 12)
        income_arr, periods = FinancialFeaturePipeline.extract_time_series_arrays(
            sorted_series, target_field="total_income"
        )
        expense_arr, _ = FinancialFeaturePipeline.extract_time_series_arrays(
            sorted_series, target_field="total_expense"
        )
        last_period = periods[-1]
        future_periods = FinancialFeaturePipeline.compute_next_periods(last_period, horizon)

        # 1. Income Projection
        # Check if non-zero income exists
        non_zero_income = income_arr[income_arr > 0]
        if len(non_zero_income) > 0:
            income_model, income_metrics, _, _ = (
                TimeSeriesEvaluator.evaluate_and_select_best_model(
                    income_arr, periods, preferred_model_name="Moving Average"
                )
            )
            projected_incomes = income_model.predict(income_arr, last_period, horizon)
        else:
            projected_incomes = np.zeros(horizon, dtype=float)

        # 2. Expense Projection
        expense_model, exp_metrics, comparisons, reason = (
            TimeSeriesEvaluator.evaluate_and_select_best_model(
                expense_arr, periods
            )
        )
        projected_expenses = expense_model.predict(expense_arr, last_period, horizon)

        # 3. Commitments and Contributions
        recurring_monthly = (
            request.recurring_commitments.total_monthly
            if request.recurring_commitments
            else 0.0
        )
        contributions_monthly = (
            request.planned_contributions.total_monthly
            if request.planned_contributions
            else 0.0
        )

        # 4. Assemble Cash-Flow Periods
        forecast_items: List[CashFlowForecastPeriodItem] = []

        for p_str, exp_val, inc_val in zip(
            future_periods, projected_expenses, projected_incomes
        ):
            inc_rounded = round(float(inc_val), 2)
            exp_rounded = round(float(exp_val), 2)
            fixed_part = min(recurring_monthly, exp_rounded)
            var_part = max(0.0, round(exp_rounded - fixed_part, 2))
            planned_part = round(contributions_monthly, 2)

            net_flow = round(inc_rounded - exp_rounded - planned_part, 2)
            is_deficit = net_flow < 0.0

            forecast_items.append(
                CashFlowForecastPeriodItem(
                    period=p_str,
                    expected_income=inc_rounded,
                    expected_expenses=exp_rounded,
                    fixed_recurring_expenses=round(fixed_part, 2),
                    variable_expenses=var_part,
                    planned_contributions=planned_part,
                    projected_net_cash_flow=net_flow,
                    is_deficit=is_deficit,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            )

        model_meta = ModelMetadataItem(
            name=f"Hybrid Cash-Flow ({expense_model.name} + Income Baseline)",
            version="1.0.0",
            feature_version="1.0.0",
            model_type="hybrid",
            training_period=f"{periods[0]} to {periods[-1]}",
            selection_reason=f"Combines {reason} with historical income stability",
        )

        return CashFlowForecastResponse(
            status="success",
            actual_history_months=actual_months,
            user_id=request.user_id,
            forecast_type="cash_flow",
            frequency=request.frequency,
            historical_series=sorted_series,
            forecast=forecast_items,
            recurring_commitments_monthly=round(recurring_monthly, 2),
            planned_contributions_monthly=round(contributions_monthly, 2),
            model=model_meta,
            metrics=exp_metrics,
            candidate_models=comparisons,
        )


forecasting_engine = FinancialForecastingEngine()
