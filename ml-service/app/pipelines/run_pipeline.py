"""
Executable runner for the SmartFin AI stock prediction data pipeline.
Can be executed directly via Python CLI.
"""
import sys
import os
import argparse

# Ensure ml-service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.pipelines.config import PipelineConfig  # noqa: E402
from app.pipelines.stock_pipeline import StockDataPipeline  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Run SmartFin AI Stock Prediction Data Pipeline")
    parser.add_argument(
        "--dataset",
        type=str,
        default="app/data/raw/nifty500_stocks.csv",
        help="Path to raw stock CSV",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="app/data/processed",
        help="Directory to save processed features",
    )
    parser.add_argument(
        "--tickers",
        type=str,
        nargs="+",
        default=None,
        help="Optional list of specific tickers to process",
    )
    parser.add_argument(
        "--scaler",
        type=str,
        default=None,
        choices=["standard", "minmax", "robust", None],
        help="Feature scaler type",
    )
    parser.add_argument(
        "--no-parquet",
        action="store_true",
        help="Disable Parquet export",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Disable CSV export",
    )

    args = parser.parse_args()

    config = PipelineConfig(
        dataset_path=args.dataset,
        processed_data_dir=args.output_dir,
        selected_tickers=args.tickers,
        scaler_type=args.scaler,
        save_parquet=not args.no_parquet,
        save_csv=not args.no_csv,
    )

    pipeline = StockDataPipeline(config)
    summary = pipeline.run()

    print("\n" + "=" * 60)
    print("      SMARTFIN AI STOCK PREDICTION DATA PIPELINE SUMMARY")
    print("=" * 60)
    print(f"Dataset Shape (Rows, Cols) : {summary['dataset_shape']}")
    print(f"Ticker Count               : {summary['ticker_count']}")
    print(f"Date Range                 : {summary['date_range']['start']} to {summary['date_range']['end']}")
    print(f"Total Feature Count        : {summary['feature_count']}")
    print(f"Target Columns ({summary['target_count']})       : {summary['target_columns']}")
    print(f"Total Missing Values in Feat: {summary['missing_values_total']}")
    print("-" * 60)
    print("TRAIN / VALIDATION / TEST CHRONOLOGICAL RANGES:")
    val_p = summary["validation_period"]
    train_p = summary["train_period"]
    test_p = summary["test_period"]
    print(
        f" - Train      : {train_p['start']} to {train_p['end']} "
        f"({train_p['rows']} rows, {train_p['trading_days']} trading days)"
    )
    print(
        f" - Validation : {val_p['start']} to {val_p['end']} "
        f"({val_p['rows']} rows, {val_p['trading_days']} trading days)"
    )
    print(
        f" - Test       : {test_p['start']} to {test_p['end']} "
        f"({test_p['rows']} rows, {test_p['trading_days']} trading days)"
    )
    print("-" * 60)
    print("Generated Artifacts:")
    for k, v in summary["artifacts_saved"].items():
        print(f" - {k}: {v}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
