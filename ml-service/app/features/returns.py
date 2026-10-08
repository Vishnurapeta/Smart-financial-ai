"""
Return features computation for stock time series.
"""
from typing import List
import numpy as np
import pandas as pd


def compute_returns(df: pd.DataFrame, periods: List[int]) -> pd.DataFrame:
    """
    Computes historical percentage and log returns for a single ticker's DataFrame.
    Assumes df is already sorted chronologically.

    Args:
        df: DataFrame containing at least 'close'
        periods: List of return horizons in trading days, e.g. [1, 5, 10, 20]

    Returns:
        DataFrame with added return feature columns:
        - daily_return
        - return_{k}d for k in periods
        - log_return_1d
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]

    # 1-day daily return
    out["daily_return"] = close.pct_change(1)
    out["log_return_1d"] = np.log(close / close.shift(1))

    # Multi-period returns
    for p in periods:
        col_name = f"return_{p}d"
        if col_name not in out.columns:
            out[col_name] = close.pct_change(p)

    return out
