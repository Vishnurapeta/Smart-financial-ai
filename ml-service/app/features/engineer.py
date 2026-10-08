"""
Master feature engineering orchestrator for stock prediction.
Guarantees strict per-ticker isolation with zero cross-stock leakage.
"""
from typing import List, Tuple
import pandas as pd
from app.core.logger import logger
from app.features.base import compute_base_features
from app.features.lags import compute_lags
from app.features.moving_averages import compute_moving_averages
from app.features.returns import compute_returns
from app.features.technical_indicators import compute_technical_indicators
from app.features.volatility import compute_volatility
from app.pipelines.config import PipelineConfig


class FeatureEngineer:
    """
    Orchestrates calculation of technical indicators, moving averages,
    returns, volatility, and lags strictly per ticker.
    """

    def __init__(self, config: PipelineConfig):
        self.config = config

    def _engineer_ticker_features(self, ticker_df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates all features for a single ticker's chronological series.
        """
        # Ensure chronological order
        df = ticker_df.sort_values(by="date").copy()

        # 1. Base interactions
        base_df = compute_base_features(df)

        # 2. Historical Returns
        returns_df = compute_returns(df, periods=self.config.return_periods)

        # 3. Moving Averages (SMA & EMA)
        ma_df = compute_moving_averages(
            df,
            sma_windows=self.config.sma_windows,
            ema_windows=self.config.ema_windows,
        )

        # 4. Technical Indicators (RSI, MACD, Bollinger Bands)
        tech_df = compute_technical_indicators(
            df,
            rsi_window=self.config.rsi_window,
            macd_fast=self.config.macd_fast,
            macd_slow=self.config.macd_slow,
            macd_signal=self.config.macd_signal,
            bb_window=self.config.bb_window,
            bb_std=self.config.bb_std,
        )

        # 5. Volatility & Spreads
        vol_df = compute_volatility(
            pd.concat([df, returns_df], axis=1),
            windows=self.config.volatility_windows,
            daily_return_col="daily_return",
        )

        # 6. Lags (Prices, Returns, Volumes)
        lags_df = compute_lags(
            pd.concat([df, returns_df], axis=1),
            close_lags=self.config.close_lag_periods,
            return_lags=self.config.return_lag_periods,
            volume_lags=self.config.volume_lag_periods,
            daily_return_col="daily_return",
        )

        # Combine all features with original dataframe
        combined = pd.concat(
            [df, base_df, returns_df, ma_df, tech_df, vol_df, lags_df],
            axis=1,
        )

        # Drop any accidental duplicate column names from joins
        combined = combined.loc[:, ~combined.columns.duplicated()]

        return combined

    def transform(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """
        Applies feature engineering across all tickers strictly in isolation.

        Returns:
            Tuple of (feature_dataframe, feature_column_names)
        """
        logger.info(f"Generating features across {df['symbol'].nunique()} tickers...")

        # Columns that belong to raw identifiers or metadata
        meta_cols = {"date", "symbol", "adj_close"}

        processed_ticker_dfs = []
        for symbol, group in df.groupby("symbol", sort=False):
            t_df = self._engineer_ticker_features(group)
            processed_ticker_dfs.append(t_df)

        result_df = pd.concat(processed_ticker_dfs, axis=0).sort_values(
            by=["symbol", "date"]
        ).reset_index(drop=True)

        # Identify all engineered feature columns
        feature_cols = [
            c for c in result_df.columns
            if c not in meta_cols and not c.startswith("target_")
        ]

        logger.info(
            f"Feature engineering complete. Total rows: {len(result_df)}, "
            f"Engineered features count: {len(feature_cols)}."
        )

        return result_df, feature_cols
