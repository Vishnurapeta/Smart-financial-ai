"""
Volatility features computation for stock time series.
"""
from typing import List
import numpy as np
import pandas as pd


def compute_volatility(
    df: pd.DataFrame,
    windows: List[int],
    daily_return_col: str = "daily_return",
) -> pd.DataFrame:
    """
    Computes rolling standard deviations, annualized rolling volatility,
    and intra-day spread metrics.

    Args:
        df: DataFrame containing at least 'close', 'high', 'low', 'open', and daily returns
        windows: Rolling windows in trading days, e.g. [10, 20, 50]
        daily_return_col: Column name representing 1-day return

    Returns:
        DataFrame with volatility features:
        - rolling_std_{w}
        - rolling_vol_{w} (annualized: std * sqrt(252))
        - hl_spread_ratio ((high - low) / close)
        - co_spread_ratio ((close - open) / open)
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]
    high = df["high"]
    low = df["low"]
    open_p = df["open"]

    # Intra-day spreads
    out["hl_spread_ratio"] = (high - low) / close
    out["co_spread_ratio"] = (close - open_p) / open_p

    # Daily return series
    if daily_return_col in df.columns:
        ret = df[daily_return_col]
    else:
        ret = close.pct_change(1)

    for w in windows:
        # Rolling standard deviation of price
        out[f"rolling_std_{w}"] = close.rolling(window=w).std()
        # Annualized volatility of returns
        out[f"rolling_vol_{w}"] = ret.rolling(window=w).std() * np.sqrt(252)

    return out
