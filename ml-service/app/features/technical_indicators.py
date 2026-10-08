"""
Technical indicators computation: RSI, MACD, and Bollinger Bands.
"""
import pandas as pd


def compute_rsi(close: pd.Series, window: int = 14) -> pd.Series:
    """
    Computes Wilder's Relative Strength Index (RSI).
    Bounded between 0 and 100.
    """
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Wilder's smoothing (alpha = 1 / window)
    avg_gain = gain.ewm(alpha=1.0 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / window, min_periods=window, adjust=False).mean()

    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi


def compute_macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """
    Computes Moving Average Convergence Divergence (MACD), Signal line, and Histogram.
    """
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    macd_hist = macd_line - signal_line

    return pd.DataFrame(
        {
            "macd": macd_line,
            "macd_signal": signal_line,
            "macd_hist": macd_hist,
        },
        index=close.index,
    )


def compute_bollinger_bands(
    close: pd.Series,
    window: int = 20,
    num_std: float = 2.0,
) -> pd.DataFrame:
    """
    Computes Bollinger Bands: Upper, Middle, Lower, Bandwidth, and %B.
    """
    middle = close.rolling(window=window).mean()
    std = close.rolling(window=window).std()
    upper = middle + (num_std * std)
    lower = middle - (num_std * std)
    width = (upper - lower) / (middle + 1e-10)
    pct_b = (close - lower) / ((upper - lower) + 1e-10)

    return pd.DataFrame(
        {
            f"bb_upper_{window}": upper,
            f"bb_middle_{window}": middle,
            f"bb_lower_{window}": lower,
            f"bb_width_{window}": width,
            f"bb_pct_{window}": pct_b,
        },
        index=close.index,
    )


def compute_technical_indicators(
    df: pd.DataFrame,
    rsi_window: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    bb_window: int = 20,
    bb_std: float = 2.0,
) -> pd.DataFrame:
    """
    Computes all technical indicators for a single stock time series.
    """
    out = pd.DataFrame(index=df.index)
    close = df["close"]

    # RSI
    out[f"rsi_{rsi_window}"] = compute_rsi(close, window=rsi_window)

    # MACD
    macd_df = compute_macd(close, fast=macd_fast, slow=macd_slow, signal=macd_signal)
    out = pd.concat([out, macd_df], axis=1)

    # Bollinger Bands
    bb_df = compute_bollinger_bands(close, window=bb_window, num_std=bb_std)
    out = pd.concat([out, bb_df], axis=1)

    return out
