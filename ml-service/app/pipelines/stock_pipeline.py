"""
Reproducible End-to-End Stock Prediction Data Pipeline.
Coordinates validation, normalization, cleaning, feature engineering,
target generation, chronological splitting, and artifact persistence.
"""
import os
from typing import Any, Dict, Optional
import pandas as pd
from app.core.logger import logger
from app.features.engineer import FeatureEngineer
from app.models.metadata import ModelMetadata
from app.pipelines.config import PipelineConfig
from app.preprocessing.cleaning import DataCleaner
from app.preprocessing.normalization import ColumnNormalizer
from app.preprocessing.scaling import LeakageFreeScaler
from app.targets.generator import TargetGenerator
from app.utils.time_series_split import TimeSeriesSplitter
from app.validation.validator import DataValidator


class StockDataPipeline:
    """
    Main orchestration pipeline for stock market data engineering.
    Guarantees strict data hygiene, per-ticker calculations, and leakage prevention.
    """

    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self.normalizer = ColumnNormalizer()
        self.validator = DataValidator(
            min_historical_records=self.config.min_historical_records
        )
        self.cleaner = DataCleaner(
            min_historical_records=self.config.min_historical_records,
            selected_tickers=self.config.selected_tickers,
        )
        self.engineer = FeatureEngineer(self.config)
        self.target_generator = TargetGenerator(self.config)
        self.splitter = TimeSeriesSplitter(
            train_ratio=self.config.train_ratio,
            val_ratio=self.config.val_ratio,
            test_ratio=self.config.test_ratio,
        )
        self.scaler = (
            LeakageFreeScaler(self.config.scaler_type)
            if self.config.scaler_type
            else None
        )

    def run(self) -> Dict[str, Any]:
        """
        Executes the complete pipeline:
        RAW DATA -> Validation -> Normalization -> Cleaning -> Sorting ->
        Features -> Targets -> Leakage-Free Split -> Artifact Persistence.
        """
        logger.info(f"Starting StockDataPipeline with dataset: {self.config.dataset_path}")

        # 1. Load Raw Dataset
        if not os.path.exists(self.config.dataset_path):
            raise FileNotFoundError(
                f"Raw stock dataset not found at: '{self.config.dataset_path}'. "
                f"Ensure the dataset is placed at the configured path."
            )

        raw_df = pd.read_csv(self.config.dataset_path)
        logger.info(f"Loaded raw dataset: {len(raw_df)} rows, {len(raw_df.columns)} columns.")

        # 2. Column Normalization
        normalized_df = self.normalizer.normalize(raw_df)

        # 3. Data Validation on Raw Structure
        raw_report = self.validator.validate_raw(normalized_df)
        raw_report.save_json(
            self.config.validation_report_dir, "raw_validation_report.json"
        )

        # 4. Cleaning, Deduplication, and Chronological Sorting
        cleaned_df, clean_stats = self.cleaner.clean(normalized_df)

        # 5. Feature Engineering (Per-ticker isolated)
        featured_df, feature_cols = self.engineer.transform(cleaned_df)

        # 6. Target Generation (Per-ticker isolated)
        targeted_df, target_cols = self.target_generator.generate(featured_df)

        # 7. Handling of Windowing and Horizon Boundary NaNs
        final_df = targeted_df
        initial_feature_rows = len(final_df)
        if self.config.drop_na_rows:
            # Drop rows with NaN in features or primary target
            check_cols = feature_cols + [
                f"target_return_{self.config.primary_horizon}d",
                f"target_close_{self.config.primary_horizon}d",
            ]
            check_cols = [c for c in check_cols if c in final_df.columns]
            final_df = final_df.dropna(subset=check_cols).reset_index(drop=True)
            dropped_na = initial_feature_rows - len(final_df)
            logger.info(
                f"Dropped {dropped_na} boundary rows (lookback warmup + forward horizon tail) "
                f"({round((dropped_na / initial_feature_rows) * 100, 2)}%). "
                f"Clean model-ready rows: {len(final_df)}."
            )

        # 8. Post-Feature Validation
        feature_report = self.validator.validate_features(final_df, feature_cols)
        feature_report.save_json(
            self.config.validation_report_dir, "feature_validation_report.json"
        )

        # 9. Chronological Time-Series Splitting
        train_df, val_df, test_df, date_ranges = self.splitter.split_global_temporal(
            final_df
        )

        # 10. Optional Leakage-Free Scaling (Fit on train only)
        if self.scaler:
            logger.info(f"Fitting {self.config.scaler_type} scaler on training split...")
            train_df = self.scaler.fit_transform(train_df, feature_cols)
            val_df = self.scaler.transform(val_df, feature_cols)
            test_df = self.scaler.transform(test_df, feature_cols)
            final_df = self.scaler.transform(final_df, feature_cols)

        # 11. Persist Processed Artifacts
        os.makedirs(self.config.processed_data_dir, exist_ok=True)
        paths_saved: Dict[str, str] = {}

        if self.config.save_parquet:
            full_pq = os.path.join(
                self.config.processed_data_dir, "nifty500_features.parquet"
            )
            train_pq = os.path.join(self.config.processed_data_dir, "train.parquet")
            val_pq = os.path.join(self.config.processed_data_dir, "validation.parquet")
            test_pq = os.path.join(self.config.processed_data_dir, "test.parquet")

            final_df.to_parquet(full_pq, index=False)
            train_df.to_parquet(train_pq, index=False)
            val_df.to_parquet(val_pq, index=False)
            test_df.to_parquet(test_pq, index=False)

            paths_saved["full_parquet"] = full_pq
            paths_saved["train_parquet"] = train_pq
            paths_saved["val_parquet"] = val_pq
            paths_saved["test_parquet"] = test_pq

        if self.config.save_csv:
            full_csv = os.path.join(
                self.config.processed_data_dir, "nifty500_features.csv"
            )
            train_csv = os.path.join(self.config.processed_data_dir, "train.csv")
            val_csv = os.path.join(self.config.processed_data_dir, "validation.csv")
            test_csv = os.path.join(self.config.processed_data_dir, "test.csv")

            final_df.to_csv(full_csv, index=False)
            train_df.to_csv(train_csv, index=False)
            val_df.to_csv(val_csv, index=False)
            test_df.to_csv(test_csv, index=False)

            paths_saved["full_csv"] = full_csv
            paths_saved["train_csv"] = train_csv
            paths_saved["val_csv"] = val_csv
            paths_saved["test_csv"] = test_csv

        # 12. Create and Persist Model Metadata
        ticker_desc = (
            ",".join(self.config.selected_tickers)
            if self.config.selected_tickers
            else f"ALL_NIFTY500 ({final_df['symbol'].nunique()} tickers)"
        )
        metadata = ModelMetadata(
            ticker=ticker_desc,
            dataset_start_date=str(final_df["date"].min().date()),
            dataset_end_date=str(final_df["date"].max().date()),
            number_of_records=len(final_df),
            feature_version="v1.0.0",
            preprocessing_version="v1.0.0",
            target_definition={
                "target_next_close": "Close price at trading day t+1",
                "target_next_return": "(Close[t+1] - Close[t]) / Close[t]",
                "target_return_5d": "(Close[t+5] - Close[t]) / Close[t]",
                "target_return_10d": "(Close[t+10] - Close[t]) / Close[t]",
                "target_return_20d": "(Close[t+20] - Close[t]) / Close[t]",
            },
            prediction_horizon=self.config.primary_horizon,
            train_period=date_ranges["train"],
            validation_period=date_ranges["validation"],
            test_period=date_ranges["test"],
            dataset_file=self.config.dataset_path,
            features_list=feature_cols,
            target_columns=target_cols,
            scaler_type=self.config.scaler_type,
        )
        metadata_path = metadata.save_json(self.config.processed_data_dir)
        paths_saved["metadata_json"] = metadata_path

        summary = {
            "dataset_shape": final_df.shape,
            "ticker_count": final_df["symbol"].nunique(),
            "date_range": {
                "start": str(final_df["date"].min().date()),
                "end": str(final_df["date"].max().date()),
            },
            "feature_count": len(feature_cols),
            "features": feature_cols,
            "target_count": len(target_cols),
            "target_columns": target_cols,
            "missing_values_total": int(final_df[feature_cols].isna().sum().sum()),
            "train_period": date_ranges["train"],
            "validation_period": date_ranges["validation"],
            "test_period": date_ranges["test"],
            "artifacts_saved": paths_saved,
        }

        logger.info("StockDataPipeline finished successfully!")
        return summary
