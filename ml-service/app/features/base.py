"""
Basic price and volume transformation features.
"""
import numpy as np
import pandas as pd


def compute_base_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes basic interaction features between Open, High, Low, Close, and Volume.
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]
    open_p = df["open"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    out["log_volume"] = np.log1p(volume.clip(lower=0))
    out["volume_change_1d"] = volume.pct_change(1)
    out["close_to_open"] = close / (open_p + 1e-10)
    out["close_to_high"] = close / (high + 1e-10)
    out["close_to_low"] = close / (low + 1e-10)

    return out
