"""
Target generation module for stock prediction.
Computes forward-looking targets strictly per ticker after feature generation.
"""
from typing import List, Tuple
import pandas as pd
from app.core.logger import logger
from app.pipelines.config import PipelineConfig


class TargetGenerator:
    """
    Generates forward-looking prediction targets:
    - target_next_close: close price at t+1
    - target_next_return: return from t to t+1
    - target_return_{h}d: future h-day return from t to t+h
    - target_close_{h}d: future h-day close at t+h
    - target_next_direction: binary classification (1 if next return > 0 else 0)

    Crucially calculated per ticker with negative shifts.
    """

    def __init__(self, config: PipelineConfig):
        self.config = config

    def _generate_ticker_targets(self, ticker_df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates target columns for a single ticker.
        """
        df = ticker_df.copy()
        close = df["close"]

        # Next-day targets (horizon = 1)
        df["target_next_close"] = close.shift(-1)
        df["target_next_return"] = (close.shift(-1) - close) / close
        df["target_next_direction"] = (df["target_next_return"] > 0).astype(float)
        # Mark NaN direction where next return is NaN
        df.loc[df["target_next_return"].isna(), "target_next_direction"] = float("nan")

        # Multi-horizon future targets
        for h in self.config.target_horizons:
            df[f"target_close_{h}d"] = close.shift(-h)
            df[f"target_return_{h}d"] = (close.shift(-h) - close) / close

        return df

    def generate(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """
        Generates targets for all tickers, strictly isolated by symbol.

        Returns:
            Tuple of (dataframe_with_targets, target_column_names)
        """
        logger.info(
            f"Generating future targets for horizons {self.config.target_horizons} "
            f"across {df['symbol'].nunique()} tickers..."
        )

        ticker_dfs = []
        for _, group in df.groupby("symbol", sort=False):
            t_df = self._generate_ticker_targets(group)
            ticker_dfs.append(t_df)

        result_df = pd.concat(ticker_dfs, axis=0).sort_values(
            by=["symbol", "date"]
        ).reset_index(drop=True)

        target_cols = [c for c in result_df.columns if c.startswith("target_")]

        logger.info(f"Target generation complete. Created targets: {target_cols}")

        return result_df, target_cols
