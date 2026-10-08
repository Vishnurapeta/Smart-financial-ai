"""
Chronological Time-Series Splitting and Walk-Forward Validation utilities.
Guarantees strict temporal precedence: train_date < val_date < test_date.
Zero random shuffling, zero lookahead bias.
"""
from typing import Dict, Generator, Tuple
import pandas as pd
from app.core.logger import logger


class TimeSeriesSplitter:
    """
    Performs leakage-free chronological splitting of stock time-series data.
    """

    def __init__(
        self,
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
    ):
        self.train_ratio = train_ratio
        self.val_ratio = val_ratio
        self.test_ratio = test_ratio

        total = round(train_ratio + val_ratio + test_ratio, 6)
        if abs(total - 1.0) > 1e-5:
            raise ValueError(f"Split ratios must sum to 1.0 (got {total})")

    def split_global_temporal(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Dict[str, str]]]:
        """
        Splits by distinct calendar trading days across all tickers.
        Ensures all tickers are evaluated on matching market regimes without lookahead.

        Returns:
            Tuple of (train_df, val_df, test_df, date_ranges)
        """
        distinct_dates = sorted(df["date"].unique())
        n_dates = len(distinct_dates)

        if n_dates < 10:
            raise ValueError(
                f"Too few distinct dates ({n_dates}) for time-series split."
            )

        train_cutoff_idx = int(n_dates * self.train_ratio)
        val_cutoff_idx = int(n_dates * (self.train_ratio + self.val_ratio))

        train_dates = set(distinct_dates[:train_cutoff_idx])
        val_dates = set(distinct_dates[train_cutoff_idx:val_cutoff_idx])
        test_dates = set(distinct_dates[val_cutoff_idx:])

        train_df = df[df["date"].isin(train_dates)].sort_values(by=["symbol", "date"]).reset_index(drop=True)
        val_df = df[df["date"].isin(val_dates)].sort_values(by=["symbol", "date"]).reset_index(drop=True)
        test_df = df[df["date"].isin(test_dates)].sort_values(by=["symbol", "date"]).reset_index(drop=True)

        date_ranges = {
            "train": {
                "start": str(train_df["date"].min().date()),
                "end": str(train_df["date"].max().date()),
                "rows": len(train_df),
                "trading_days": len(train_dates),
            },
            "validation": {
                "start": str(val_df["date"].min().date()),
                "end": str(val_df["date"].max().date()),
                "rows": len(val_df),
                "trading_days": len(val_dates),
            },
            "test": {
                "start": str(test_df["date"].min().date()),
                "end": str(test_df["date"].max().date()),
                "rows": len(test_df),
                "trading_days": len(test_dates),
            },
        }

        logger.info(
            f"Chronological Split complete:\n"
            f" - Train: {date_ranges['train']['start']} to {date_ranges['train']['end']} "
            f"({len(train_df)} rows)\n"
            f" - Val:   {date_ranges['validation']['start']} to {date_ranges['validation']['end']} "
            f"({len(val_df)} rows)\n"
            f" - Test:  {date_ranges['test']['start']} to {date_ranges['test']['end']} "
            f"({len(test_df)} rows)"
        )

        return train_df, val_df, test_df, date_ranges

    def split_per_ticker(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Splits chronologically within each individual ticker's timeline.
        Useful when individual tickers have widely disparate listing dates.
        """
        train_dfs, val_dfs, test_dfs = [], [], []

        for _, group in df.groupby("symbol", sort=False):
            grp_sorted = group.sort_values(by="date")
            n = len(grp_sorted)
            train_idx = int(n * self.train_ratio)
            val_idx = int(n * (self.train_ratio + self.val_ratio))

            train_dfs.append(grp_sorted.iloc[:train_idx])
            val_dfs.append(grp_sorted.iloc[train_idx:val_idx])
            test_dfs.append(grp_sorted.iloc[val_idx:])

        train_df = pd.concat(train_dfs, axis=0).sort_values(by=["symbol", "date"]).reset_index(drop=True)
        val_df = pd.concat(val_dfs, axis=0).sort_values(by=["symbol", "date"]).reset_index(drop=True)
        test_df = pd.concat(test_dfs, axis=0).sort_values(by=["symbol", "date"]).reset_index(drop=True)

        return train_df, val_df, test_df


class WalkForwardValidator:
    """
    Implements Walk-Forward (expanding window or rolling window) validation
    for out-of-sample backtesting without lookahead bias.
    """

    def __init__(
        self,
        n_splits: int = 5,
        test_size_days: int = 60,
        min_train_days: int = 250,
        expanding: bool = True,
    ):
        self.n_splits = n_splits
        self.test_size_days = test_size_days
        self.min_train_days = min_train_days
        self.expanding = expanding

    def split(
        self, df: pd.DataFrame
    ) -> Generator[Tuple[pd.DataFrame, pd.DataFrame, Dict[str, str]], None, None]:
        """
        Yields (train_fold_df, test_fold_df, fold_metadata).
        """
        distinct_dates = sorted(df["date"].unique())
        total_days = len(distinct_dates)

        required_days = self.min_train_days + (self.n_splits * self.test_size_days)
        if total_days < required_days:
            raise ValueError(
                f"Dataset has {total_days} trading days, but {required_days} are required "
                f"for {self.n_splits} folds of {self.test_size_days} test days."
            )

        for fold in range(self.n_splits):
            test_end_idx = total_days - (self.n_splits - 1 - fold) * self.test_size_days
            test_start_idx = test_end_idx - self.test_size_days

            if self.expanding:
                train_start_idx = 0
            else:
                train_start_idx = max(0, test_start_idx - self.min_train_days)

            train_dates = set(distinct_dates[train_start_idx:test_start_idx])
            test_dates = set(distinct_dates[test_start_idx:test_end_idx])

            train_fold = df[df["date"].isin(train_dates)].copy()
            test_fold = df[df["date"].isin(test_dates)].copy()

            fold_meta = {
                "fold": str(fold + 1),
                "train_start": str(distinct_dates[train_start_idx].date()),
                "train_end": str(distinct_dates[test_start_idx - 1].date()),
                "test_start": str(distinct_dates[test_start_idx].date()),
                "test_end": str(distinct_dates[test_end_idx - 1].date()),
                "train_rows": str(len(train_fold)),
                "test_rows": str(len(test_fold)),
            }

            yield train_fold, test_fold, fold_meta
