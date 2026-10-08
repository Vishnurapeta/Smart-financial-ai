"""
Lag features computation for prices, returns, and volume.
Ensures strictly historical lookback with zero lookahead bias.
"""
from typing import List
import pandas as pd


def compute_lags(
    df: pd.DataFrame,
    close_lags: List[int],
    return_lags: List[int],
    volume_lags: List[int],
    daily_return_col: str = "daily_return",
) -> pd.DataFrame:
    """
    Computes lagged values for close price, returns, and volume.
    Lags use positive shifts (e.g. shift(1) = yesterday's value).

    Args:
        df: DataFrame containing 'close', 'volume', and daily return
        close_lags: List of lag periods for close, e.g. [1, 2, 3, 5, 10]
        return_lags: List of lag periods for returns, e.g. [1, 2, 3, 5]
        volume_lags: List of lag periods for volume, e.g. [1, 2, 3, 5]

    Returns:
        DataFrame containing lag feature columns:
        - close_lag_{k}
        - return_lag_{k}
        - volume_lag_{k}
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]
    volume = df["volume"]

    # Daily return
    if daily_return_col in df.columns:
        ret = df[daily_return_col]
    else:
        ret = close.pct_change(1)

    # Close price lags
    for k in close_lags:
        out[f"close_lag_{k}"] = close.shift(k)

    # Return lags
    for k in return_lags:
        out[f"return_lag_{k}"] = ret.shift(k)

    # Volume lags
    for k in volume_lags:
        out[f"volume_lag_{k}"] = volume.shift(k)

    return out
