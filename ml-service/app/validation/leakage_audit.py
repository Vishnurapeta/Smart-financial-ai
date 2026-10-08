"""
Data leakage audit engine.
Enforces strict prevention of lookahead bias, target leakage, cross-ticker contamination,
and temporal boundary violations.
Fails hard by raising DataLeakageError upon detecting any integrity violation.
"""
from typing import List, Optional
import pandas as pd


class DataLeakageError(Exception):
    """Raised immediately when any lookahead or data leakage condition is detected."""
    pass


class LeakageAuditor:
    """Performs rigorous audits across features, splits, and temporal bounds."""

    FORBIDDEN_PREFIXES = ("target_", "future_", "lead_", "next_")
    METADATA_COLUMNS = {"date", "symbol", "adj_close"}

    @classmethod
    def audit_features(
        cls,
        feature_names: List[str],
        target_name: str,
        allowed_features: Optional[List[str]] = None,
    ) -> None:
        """
        Verifies feature columns contain zero future lookahead or target contamination.
        Raises DataLeakageError immediately if any leakage is found.
        """
        # 1. Target column must not be in feature set
        if target_name in feature_names:
            raise DataLeakageError(
                f"CRITICAL LEAKAGE: Target '{target_name}' is included in feature space X!"
            )

        # 2. No target_ prefixed columns in feature set
        for col in feature_names:
            col_lower = col.lower()
            if col_lower.startswith(cls.FORBIDDEN_PREFIXES):
                raise DataLeakageError(
                    f"CRITICAL LEAKAGE: Forward-looking/target column '{col}' detected in feature set!"
                )
            if col_lower in cls.METADATA_COLUMNS:
                raise DataLeakageError(
                    f"CRITICAL LEAKAGE: Unencoded metadata column '{col}' detected in feature set!"
                )

        # 3. If allowed_features specified, verify every feature is in allowed list
        if allowed_features is not None:
            allowed_set = set(allowed_features)
            unauthorized = [f for f in feature_names if f not in allowed_set]
            if unauthorized:
                raise DataLeakageError(
                    f"CRITICAL LEAKAGE: Features not in approved feature list: {unauthorized}"
                )

    @classmethod
    def audit_temporal_order(
        cls,
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
        test_df: pd.DataFrame,
        date_col: str = "date",
    ) -> None:
        """
        Verifies chronological split order: Train < Validation < Test.
        """
        if train_df.empty or val_df.empty or test_df.empty:
            raise DataLeakageError("Empty dataset partition provided for temporal audit.")

        train_max = pd.to_datetime(train_df[date_col]).max()
        val_min = pd.to_datetime(val_df[date_col]).min()
        val_max = pd.to_datetime(val_df[date_col]).max()
        test_min = pd.to_datetime(test_df[date_col]).min()

        if train_max >= val_min:
            raise DataLeakageError(
                f"CRITICAL LEAKAGE: Train period overlaps with Validation period! "
                f"Train max ({train_max}) >= Validation min ({val_min})"
            )

        if val_max >= test_min:
            raise DataLeakageError(
                f"CRITICAL LEAKAGE: Validation period overlaps with Test period! "
                f"Validation max ({val_max}) >= Test min ({test_min})"
            )

    @classmethod
    def audit_ticker_isolation(
        cls,
        df: pd.DataFrame,
        expected_ticker: str,
        symbol_col: str = "symbol",
    ) -> None:
        """
        Verifies that a per-ticker slice contains exclusively data for the target stock.
        """
        if symbol_col not in df.columns:
            return  # Symbol column not present

        unique_symbols = df[symbol_col].unique()
        if len(unique_symbols) > 1 or (len(unique_symbols) == 1 and unique_symbols[0] != expected_ticker):
            raise DataLeakageError(
                f"CRITICAL LEAKAGE: Cross-ticker contamination detected! "
                f"Expected '{expected_ticker}', but found symbols: {list(unique_symbols)}"
            )

    @classmethod
    def audit_sorting(cls, df: pd.DataFrame, date_col: str = "date") -> None:
        """Verifies chronological monotonic sort order."""
        dates = pd.to_datetime(df[date_col])
        if not dates.is_monotonic_increasing:
            raise DataLeakageError(
                f"CRITICAL INTEGRITY: Observations are not monotonically sorted by date!"
            )
