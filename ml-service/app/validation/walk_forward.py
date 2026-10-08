"""
Walk-forward expanding window time-series cross-validation.
Ensures zero future lookahead by strictly expanding historical training windows.
The final test partition is strictly excluded and held out.
"""
from dataclasses import dataclass
from typing import Generator, List, Tuple
import pandas as pd


@dataclass
class WalkForwardFold:
    """Represents a single walk-forward expanding window fold."""

    fold_idx: int
    train_indices: List[int]
    val_indices: List[int]
    train_start_date: str
    train_end_date: str
    val_start_date: str
    val_end_date: str


class WalkForwardValidator:
    """
    Time-series expanding window validator.
    Splits chronological data into expanding training windows and strictly subsequent validation windows.
    """

    def __init__(self, n_splits: int = 3, min_train_ratio: float = 0.5):
        if n_splits < 2:
            raise ValueError("n_splits must be at least 2 for walk-forward validation.")
        self.n_splits = n_splits
        self.min_train_ratio = min_train_ratio

    def split(
        self,
        df: pd.DataFrame,
        date_column: str = "date",
    ) -> Generator[WalkForwardFold, None, None]:
        """
        Yields expanding window folds ordered chronologically.
        df must be pre-sorted chronologically.
        """
        n_samples = len(df)
        if n_samples < 50:
            raise ValueError(f"Insufficient samples ({n_samples}) for walk-forward validation.")

        min_train_samples = int(n_samples * self.min_train_ratio)
        remaining_samples = n_samples - min_train_samples
        step_size = remaining_samples // self.n_splits

        if step_size < 10:
            raise ValueError(
                f"Step size ({step_size}) too small. Increase dataset size or decrease n_splits."
            )

        dates = df[date_column].astype(str).tolist()

        for i in range(self.n_splits):
            train_end_idx = min_train_samples + (i * step_size)
            if i == self.n_splits - 1:
                val_end_idx = n_samples
            else:
                val_end_idx = min_train_samples + ((i + 1) * step_size)

            train_idx = list(range(0, train_end_idx))
            val_idx = list(range(train_end_idx, val_end_idx))

            yield WalkForwardFold(
                fold_idx=i + 1,
                train_indices=train_idx,
                val_indices=val_idx,
                train_start_date=dates[train_idx[0]],
                train_end_date=dates[train_idx[-1]],
                val_start_date=dates[val_idx[0]],
                val_end_date=dates[val_idx[-1]],
            )
