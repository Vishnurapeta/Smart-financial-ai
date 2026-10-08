"""
Configuration module for the SmartFin AI stock prediction data pipeline.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class PipelineConfig(BaseModel):
    """
    Centralized, strongly typed configuration for the stock data pipeline.
    Avoids hardcoding paths, column names, rolling windows, and split ratios across the codebase.
    """

    # Data paths
    dataset_path: str = Field(
        default="app/data/raw/nifty500_stocks.csv",
        description="Path to the raw immutable historical stock CSV dataset",
    )
    processed_data_dir: str = Field(
        default="app/data/processed",
        description="Directory where engineered feature datasets are saved",
    )
    validation_report_dir: str = Field(
        default="app/data/validation",
        description="Directory where data validation reports are stored",
    )

    # Column configuration
    date_col: str = Field(default="Date", description="Raw date column name")
    ticker_col: str = Field(default="Symbol", description="Raw ticker/symbol column name")
    open_col: str = Field(default="Open", description="Raw Open price column name")
    high_col: str = Field(default="High", description="Raw High price column name")
    low_col: str = Field(default="Low", description="Raw Low price column name")
    close_col: str = Field(default="Close", description="Raw Close price column name")
    adj_close_col: str = Field(
        default="Adj Close", description="Raw Adjusted Close price column name"
    )
    volume_col: str = Field(default="Volume", description="Raw Volume column name")

    # Feature Engineering Window Configurations
    return_periods: List[int] = Field(
        default=[1, 5, 10, 20],
        description="Multi-period historical return horizons in trading days",
    )
    sma_windows: List[int] = Field(
        default=[10, 20, 50],
        description="Simple Moving Average window periods in trading days",
    )
    ema_windows: List[int] = Field(
        default=[10, 20, 50],
        description="Exponential Moving Average window periods in trading days",
    )
    rsi_window: int = Field(
        default=14, description="Relative Strength Index lookback period"
    )
    macd_fast: int = Field(default=12, description="MACD fast EMA span")
    macd_slow: int = Field(default=26, description="MACD slow EMA span")
    macd_signal: int = Field(default=9, description="MACD signal line EMA span")
    bb_window: int = Field(default=20, description="Bollinger Bands lookback period")
    bb_std: float = Field(
        default=2.0, description="Bollinger Bands number of standard deviations"
    )
    volatility_windows: List[int] = Field(
        default=[10, 20, 50],
        description="Rolling volatility lookback periods in trading days",
    )
    close_lag_periods: List[int] = Field(
        default=[1, 2, 3, 5, 10], description="Lag periods for close price"
    )
    return_lag_periods: List[int] = Field(
        default=[1, 2, 3, 5], description="Lag periods for daily returns"
    )
    volume_lag_periods: List[int] = Field(
        default=[1, 2, 3, 5], description="Lag periods for trading volume"
    )

    # Target Definition
    target_horizons: List[int] = Field(
        default=[1, 5, 10, 20],
        description="Future forecast horizons in trading days for target return/close",
    )
    primary_horizon: int = Field(
        default=1,
        description="Primary forecast horizon (e.g. 1 for next-day close/return)",
    )

    # Time-Series Chronological Split Ratios
    train_ratio: float = Field(
        default=0.70, description="Chronological proportion of history for training"
    )
    val_ratio: float = Field(
        default=0.15, description="Chronological proportion of history for validation"
    )
    test_ratio: float = Field(
        default=0.15, description="Chronological proportion of history for testing"
    )

    # Filtering & Quality Controls
    min_historical_records: int = Field(
        default=100,
        description="Minimum required historical trading days for a ticker to be included",
    )
    selected_tickers: Optional[List[str]] = Field(
        default=None,
        description="Optional list of specific tickers to process. If None, processes all valid tickers",
    )
    drop_na_rows: bool = Field(
        default=True,
        description=(
            "Whether to drop rows with NaN values resulting from lookback lags "
            "and future target horizons"
        ),
    )
    save_parquet: bool = Field(
        default=True, description="Whether to persist processed features to Apache Parquet"
    )
    save_csv: bool = Field(
        default=True, description="Whether to persist processed features to CSV"
    )
    scaler_type: Optional[str] = Field(
        default=None,
        description="Optional feature scaling strategy ('standard', 'minmax', 'robust', or None)",
    )

    @model_validator(mode="after")
    def validate_split_ratios(self) -> "PipelineConfig":
        total = round(self.train_ratio + self.val_ratio + self.test_ratio, 6)
        if abs(total - 1.0) > 1e-5:
            raise ValueError(
                f"Split ratios must sum to 1.0. Got train={self.train_ratio}, "
                f"val={self.val_ratio}, test={self.test_ratio} (sum={total})"
            )
        return self
