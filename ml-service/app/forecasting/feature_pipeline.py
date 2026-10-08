"""
Financial Time-Series Feature Engineering with Strict Data-Leakage Prevention.
"""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from app.schemas.forecasting import MonthlyDataPoint


class FinancialFeaturePipeline:
    """
    Transforms chronological monthly financial records into lag-based features
    strictly ensuring zero future data is observed at prediction time.
    """

    FEATURE_NAMES = [
        "trend_idx",
        "month_of_year",
        "quarter",
        "lag_1",
        "lag_2",
        "lag_3",
        "rolling_mean_3",
        "rolling_std_3",
        "tx_count_lag_1",
    ]

    @classmethod
    def clean_and_sort_series(
        cls, series: List[MonthlyDataPoint]
    ) -> List[MonthlyDataPoint]:
        """
        Deduplicates periods and sorts chronologically.
        """
        period_map: Dict[str, MonthlyDataPoint] = {}
        for dp in series:
            # If duplicate period appears, preserve the one with higher transaction count or positive expense
            if dp.period in period_map:
                existing = period_map[dp.period]
                if dp.transaction_count > existing.transaction_count or dp.total_expense > existing.total_expense:
                    period_map[dp.period] = dp
            else:
                period_map[dp.period] = dp

        sorted_points = sorted(period_map.values(), key=lambda x: x.period)
        return sorted_points

    @classmethod
    def extract_time_series_arrays(
        cls, series: List[MonthlyDataPoint], target_field: str = "total_expense"
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Extracts 1D numpy array of values and list of periods.
        """
        values = []
        periods = []
        for dp in series:
            periods.append(dp.period)
            val = getattr(dp, target_field, 0.0)
            values.append(float(val) if val is not None and not np.isnan(val) else 0.0)
        return np.array(values, dtype=float), periods

    @classmethod
    def build_feature_matrix(
        cls, values: np.ndarray, periods: List[str]
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Constructs (X, y) matrices where each row t uses strictly lags from t-1, t-2, t-3.
        Rows where full 3-lag history is unavailable are excluded from training rows.
        Returns:
            X: 2D array of features of shape (N - 3, num_features)
            y: 1D array of actual values of shape (N - 3,)
            valid_periods: list of periods corresponding to each y
        """
        n = len(values)
        if n < 4:
            # Need at least 3 lags + 1 target
            return np.empty((0, len(cls.FEATURE_NAMES))), np.empty((0,)), []

        rows_X = []
        rows_y = []
        valid_periods = []

        for i in range(3, n):
            period_str = periods[i]
            parts = period_str.split("-")
            month = int(parts[1]) if len(parts) == 2 else ((i % 12) + 1)
            quarter = ((month - 1) // 3) + 1

            lag_1 = values[i - 1]
            lag_2 = values[i - 2]
            lag_3 = values[i - 3]

            window_3 = values[i - 3 : i]
            rolling_mean_3 = float(np.mean(window_3))
            rolling_std_3 = float(np.std(window_3)) if len(window_3) > 1 else 0.0

            trend_idx = float(i)

            features = [
                trend_idx,
                float(month),
                float(quarter),
                lag_1,
                lag_2,
                lag_3,
                rolling_mean_3,
                rolling_std_3,
                1.0,  # default tx count weight
            ]
            rows_X.append(features)
            rows_y.append(values[i])
            valid_periods.append(period_str)

        return np.array(rows_X, dtype=float), np.array(rows_y, dtype=float), valid_periods

    @classmethod
    def get_latest_feature_vector(
        cls, values: np.ndarray, next_period_str: str, step_idx: int
    ) -> np.ndarray:
        """
        Builds the 1D feature vector for predicting the next unobserved period.
        Strictly observes only the most recent actual or projected values up to current step.
        """
        n = len(values)
        if n < 3:
            raise ValueError("At least 3 past values are required to compute lag features.")

        parts = next_period_str.split("-")
        month = int(parts[1]) if len(parts) == 2 else 1
        quarter = ((month - 1) // 3) + 1

        lag_1 = values[-1]
        lag_2 = values[-2]
        lag_3 = values[-3]

        window_3 = values[-3:]
        rolling_mean_3 = float(np.mean(window_3))
        rolling_std_3 = float(np.std(window_3))

        trend_idx = float(step_idx)

        features = [
            trend_idx,
            float(month),
            float(quarter),
            lag_1,
            lag_2,
            lag_3,
            rolling_mean_3,
            rolling_std_3,
            1.0,
        ]
        return np.array(features, dtype=float).reshape(1, -1)

    @staticmethod
    def compute_next_periods(last_period_str: str, count: int) -> List[str]:
        """
        Calculates the next `count` consecutive calendar months.
        Example: '2026-09' + 3 -> ['2026-10', '2026-11', '2026-12']
        """
        parts = last_period_str.split("-")
        year = int(parts[0])
        month = int(parts[1])

        periods = []
        for _ in range(count):
            month += 1
            if month > 12:
                month = 1
                year += 1
            periods.append(f"{year:04d}-{month:02d}")
        return periods
