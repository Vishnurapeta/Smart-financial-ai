"""
Moving average features computation (SMA and EMA) for stock time series.
"""
from typing import List
import pandas as pd


def compute_moving_averages(
    df: pd.DataFrame,
    sma_windows: List[int],
    ema_windows: List[int],
) -> pd.DataFrame:
    """
    Computes SMA and EMA features and price-to-average ratios.
    Assumes df is sorted chronologically for a single ticker.

    Args:
        df: DataFrame containing at least 'close'
        sma_windows: Window sizes for Simple Moving Average, e.g. [10, 20, 50]
        ema_windows: Spans for Exponential Moving Average, e.g. [10, 20, 50]

    Returns:
        DataFrame with moving average columns:
        - sma_{w}, close_to_sma_{w}
        - ema_{w}, close_to_ema_{w}
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]

    for w in sma_windows:
        sma = close.rolling(window=w).mean()
        out[f"sma_{w}"] = sma
        out[f"close_to_sma_{w}"] = close / sma

    for w in ema_windows:
        ema = close.ewm(span=w, adjust=False).mean()
        out[f"ema_{w}"] = ema
        out[f"close_to_ema_{w}"] = close / ema

    return out
