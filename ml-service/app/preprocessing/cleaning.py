"""
Cleaning and chronological sorting module for stock market data.
Ensures zero duplicates, valid OHLCV values, and strict monotonic dates per ticker.
"""
from typing import Dict, List, Optional, Tuple
import pandas as pd
from app.core.logger import logger


class DataCleaner:
    """
    Cleans raw market data:
    1. Parses dates to datetime.
    2. Enforces numeric OHLCV types.
    3. Removes non-positive prices and negative volumes.
    4. Deduplicates (symbol, date) records.
    5. Filters tickers by historical length.
    6. Sorts strictly chronologically by (symbol, date).
    """

    def __init__(
        self,
        min_historical_records: int = 100,
        selected_tickers: Optional[List[str]] = None,
    ):
        self.min_historical_records = min_historical_records
        self.selected_tickers = (
            [t.strip().upper() for t in selected_tickers] if selected_tickers else None
        )

    def clean(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, int]]:
        """
        Cleans and chronologically sorts the normalized market data.

        Returns:
            Tuple of (cleaned_df, drop_stats)
        """
        initial_len = len(df)
        df_clean = df.copy()
        stats: Dict[str, int] = {}

        # 1. Strip and uppercase symbol
        df_clean["symbol"] = df_clean["symbol"].astype(str).str.strip().str.upper()

        # Filter by selected_tickers if requested
        if self.selected_tickers:
            before_filter = len(df_clean)
            df_clean = df_clean[df_clean["symbol"].isin(self.selected_tickers)]
            stats["filtered_non_selected_tickers"] = before_filter - len(df_clean)
            if df_clean.empty:
                raise ValueError(
                    f"None of the selected tickers {self.selected_tickers} were found in the dataset."
                )

        # 2. Parse dates
        df_clean["date"] = pd.to_datetime(df_clean["date"], errors="coerce")
        invalid_dates = df_clean["date"].isna().sum()
        if invalid_dates > 0:
            df_clean = df_clean.dropna(subset=["date"])
            stats["invalid_dates_dropped"] = int(invalid_dates)

        # 3. Numeric OHLCV coercion
        ohlcv_cols = ["open", "high", "low", "close", "volume"]
        if "adj_close" in df_clean.columns:
            ohlcv_cols.append("adj_close")

        for col in ohlcv_cols:
            df_clean[col] = pd.to_numeric(df_clean[col], errors="coerce")

        before_null_drop = len(df_clean)
        df_clean = df_clean.dropna(subset=["open", "high", "low", "close", "volume"])
        stats["null_ohlcv_dropped"] = before_null_drop - len(df_clean)

        # 4. Remove non-positive prices and negative volumes
        price_mask = (
            (df_clean["open"] > 0)
            & (df_clean["high"] > 0)
            & (df_clean["low"] > 0)
            & (df_clean["close"] > 0)
            & (df_clean["volume"] >= 0)
        )
        invalid_market_values = int((~price_mask).sum())
        if invalid_market_values > 0:
            df_clean = df_clean[price_mask]
            stats["invalid_market_values_dropped"] = invalid_market_values

        # 5. Deduplicate (symbol, date) keeping first
        before_dedup = len(df_clean)
        df_clean = df_clean.drop_duplicates(subset=["symbol", "date"], keep="first")
        stats["duplicates_dropped"] = before_dedup - len(df_clean)

        # 6. Filter tickers with insufficient historical length
        ticker_counts = df_clean.groupby("symbol").size()
        valid_tickers = ticker_counts[ticker_counts >= self.min_historical_records].index
        insufficient_tickers = ticker_counts[ticker_counts < self.min_historical_records].index

        if len(insufficient_tickers) > 0:
            before_len_drop = len(df_clean)
            df_clean = df_clean[df_clean["symbol"].isin(valid_tickers)]
            stats["insufficient_history_rows_dropped"] = before_len_drop - len(df_clean)
            stats["insufficient_tickers_count"] = len(insufficient_tickers)
            logger.warning(
                f"Dropped {len(insufficient_tickers)} tickers with < {self.min_historical_records} records: "
                f"{list(insufficient_tickers)}"
            )

        if df_clean.empty:
            raise ValueError(
                f"No records remaining after cleaning with "
                f"min_historical_records={self.min_historical_records}."
            )

        # 7. Strict Chronological Sorting per ticker and date
        df_clean = df_clean.sort_values(by=["symbol", "date"]).reset_index(drop=True)

        total_dropped = initial_len - len(df_clean)
        stats["total_dropped"] = total_dropped
        stats["retained_rows"] = len(df_clean)
        stats["retained_tickers"] = df_clean["symbol"].nunique()

        logger.info(
            f"Cleaning completed: {initial_len} -> {len(df_clean)} rows "
            f"({total_dropped} dropped, {stats['retained_tickers']} tickers retained)."
        )

        return df_clean, stats
