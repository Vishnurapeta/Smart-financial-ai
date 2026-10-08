"""
Column normalization layer for raw stock market datasets.
Ensures standardized canonical lowercase column names without altering raw data.
"""
from typing import Dict, List, Optional
import pandas as pd


CANONICAL_COLUMNS = [
    "date",
    "symbol",
    "open",
    "high",
    "low",
    "close",
    "volume",
]

COMMON_ALIASES: Dict[str, List[str]] = {
    "date": ["date", "Date", "DATE", "timestamp", "Timestamp", "datetime", "Datetime"],
    "symbol": ["symbol", "Symbol", "SYMBOL", "ticker", "Ticker", "TICKER", "stock", "Stock"],
    "open": ["open", "Open", "OPEN"],
    "high": ["high", "High", "HIGH"],
    "low": ["low", "Low", "LOW"],
    "close": ["close", "Close", "CLOSE"],
    "adj_close": [
        "adj_close",
        "Adj Close",
        "Adj_Close",
        "adjClose",
        "adjusted_close",
        "Adjusted Close",
        "adj close",
    ],
    "volume": ["volume", "Volume", "VOLUME", "vol", "Vol", "VOL"],
}


class ColumnNormalizer:
    """
    Normalizes arbitrary column names in market datasets to standard lowercase names:
    'date', 'symbol', 'open', 'high', 'low', 'close', 'adj_close', 'volume'.
    """

    def __init__(self, custom_mapping: Optional[Dict[str, str]] = None):
        """
        Args:
            custom_mapping: Optional explicit mapping of {raw_col_name: canonical_col_name}.
        """
        self.custom_mapping = custom_mapping or {}

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Returns a new DataFrame with normalized column names.
        Does not mutate the input DataFrame.
        """
        df_out = df.copy()
        col_rename: Dict[str, str] = {}

        # 1. Apply custom explicit mapping if provided
        for raw_col, target in self.custom_mapping.items():
            if raw_col in df_out.columns:
                col_rename[raw_col] = target.lower()

        # 2. Check canonical aliases for unmapped columns
        for canonical, aliases in COMMON_ALIASES.items():
            # Check if this canonical target is already satisfied
            if canonical in col_rename.values():
                continue
            for raw_col in df_out.columns:
                if raw_col not in col_rename and raw_col in aliases:
                    col_rename[raw_col] = canonical
                    break

        # 3. Fallback: match case-insensitively with stripped whitespace
        for raw_col in df_out.columns:
            if raw_col in col_rename:
                continue
            cleaned = raw_col.strip().lower().replace(" ", "_")
            if cleaned in COMMON_ALIASES:
                col_rename[raw_col] = cleaned

        df_out = df_out.rename(columns=col_rename)

        # 4. Verify presence of required canonical columns
        missing = [col for col in CANONICAL_COLUMNS if col not in df_out.columns]
        if missing:
            raise ValueError(
                f"Dataset is missing required canonical market columns: {missing}. "
                f"Available columns: {list(df.columns)}"
            )

        # If adj_close not present, set default to close
        if "adj_close" not in df_out.columns and "close" in df_out.columns:
            df_out["adj_close"] = df_out["close"]

        # Ensure ticker symbol is cleanly uppercase and stripped
        df_out["symbol"] = df_out["symbol"].astype(str).str.strip().str.upper()

        return df_out
