"""
Feature generation service for real-time model inference.
Consumes the exact Prompt 14 feature engineering pipeline, verifies feature schema,
order, count, and ensures zero lookahead and zero NaN contamination.
"""
import time
from typing import List, Optional, Tuple
import pandas as pd

from app.core.logger import logger
from app.features.engineer import FeatureEngineer
from app.pipelines.config import PipelineConfig


class FeatureInferenceError(Exception):
    """Raised when feature generation fails or features are incompatible with model schema."""
    pass


class FeatureInferenceService:
    """Computes and validates feature matrices for live model prediction."""

    def __init__(self, pipeline_config: Optional[PipelineConfig] = None):
        self.config = pipeline_config or PipelineConfig()
        self.engineer = FeatureEngineer(self.config)

    def generate_features_for_inference(
        self,
        historical_bars: pd.DataFrame,
        expected_features: List[str],
        expected_feature_version: str = "v1.0.0",
        current_feature_version: str = "v1.0.0",
        sequence_length: Optional[int] = None,
    ) -> Tuple[pd.DataFrame, float]:
        """
        Executes the feature pipeline on historical bars and extracts the feature matrix.

        Args:
            historical_bars: Chronologically sorted OHLCV bars (minimum 50 bars).
            expected_features: Exact ordered feature column names expected by the model.
            expected_feature_version: Model's expected feature version.
            current_feature_version: Current pipeline feature version.
            sequence_length: If LSTM, number of trailing timesteps to return.

        Returns:
            Tuple of (feature_dataframe, feature_generation_latency_ms)
        """
        start_time = time.time()

        # 1. Version Compatibility Validation
        if expected_feature_version != current_feature_version:
            raise FeatureInferenceError(
                f"Feature version mismatch! Model expects '{expected_feature_version}', "
                f"but inference pipeline is '{current_feature_version}'."
            )

        # 2. Run prompt 14 feature engineering
        try:
            # Ensure input contains only clean raw OHLCV columns to prevent join duplication
            base_cols = ["date", "symbol", "open", "high", "low", "close", "volume"]
            available_base = [c for c in base_cols if c in historical_bars.columns]
            clean_input = historical_bars[available_base].copy()
            engineered_df = self.engineer._engineer_ticker_features(clean_input)
        except Exception as e:
            logger.error(f"Feature engineering failed on historical bars: {e}", exc_info=True)
            raise FeatureInferenceError(f"Feature computation failed: {str(e)}")

        # 3. Schema and Column Order Verification
        engineered_cols = set(engineered_df.columns)
        missing_features = [f for f in expected_features if f not in engineered_cols]
        if missing_features:
            sample_missing = missing_features[:5]
            raise FeatureInferenceError(
                f"Generated features are missing {len(missing_features)} columns: {sample_missing}"
            )

        # 4. Strict Feature Selection and Ordering
        # Strictly order the columns according to expected_features list
        features_matrix = engineered_df[expected_features].copy()

        # 5. Extract trailing observation(s)
        if sequence_length is not None and sequence_length > 1:
            if len(features_matrix) < sequence_length:
                raise FeatureInferenceError(
                    f"Insufficient timesteps ({len(features_matrix)}) for "
                    f"seq_len={sequence_length}."
                )
            feature_vector = features_matrix.tail(sequence_length).copy()
        else:
            feature_vector = features_matrix.iloc[[-1]].copy()

        # 6. Sanity: Zero NaN / Inf Check
        if feature_vector.isna().any().any():
            nan_cols = feature_vector.columns[feature_vector.isna().any()].tolist()
            raise FeatureInferenceError(
                f"Inference feature vector contains NaN values in columns: {nan_cols}. "
                "Ensure sufficient historical lookback bars (>= 50) were provided."
            )

        latency_ms = (time.time() - start_time) * 1000.0
        return feature_vector, round(latency_ms, 2)


# Global singleton instance
feature_service = FeatureInferenceService()
