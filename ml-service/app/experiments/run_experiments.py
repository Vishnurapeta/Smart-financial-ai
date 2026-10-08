"""
CLI Entrypoint for Stock Prediction Model Experimentation.
Executes reproducible model training and evaluation across Nifty 500 stocks.

Usage:
    python app/experiments/run_experiments.py --tickers RELIANCE,TCS,INFY --target target_next_close --task price
    python app/experiments/run_experiments.py --tickers RELIANCE,TCS --target target_next_return --task return
"""
import argparse
import sys
import os

# Ensure ml-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.logger import logger
from app.experiments.config import ExperimentConfig
from app.experiments.runner import ExperimentRunner


def parse_args():
    parser = argparse.ArgumentParser(
        description="SmartFin AI Stock Prediction Model Experimentation Runner"
    )
    parser.add_argument(
        "--target",
        type=str,
        default="target_next_close",
        help="Prediction target column (e.g. target_next_close, target_next_return, target_return_5d)",
    )
    parser.add_argument(
        "--task",
        type=str,
        choices=["price", "return"],
        default="price",
        help="Task type: 'price' for price level regression, 'return' for return forecasting",
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["per_ticker", "global"],
        default="per_ticker",
        help="Training mode: 'per_ticker' or 'global'",
    )
    parser.add_argument(
        "--tickers",
        type=str,
        default="RELIANCE,TCS,INFY",
        help="Comma-separated stock symbols or 'all' for all eligible tickers",
    )
    parser.add_argument(
        "--models",
        type=str,
        default="naive,linear_regression,random_forest,xgboost,lstm",
        help="Comma-separated list of models to run",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Deterministic random seed",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default="app/data/processed/nifty500_features.parquet",
        help="Path to processed features parquet file",
    )
    parser.add_argument(
        "--metadata",
        type=str,
        default="app/data/processed/model_metadata.json",
        help="Path to pipeline model metadata JSON",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    selected_tickers = None
    if args.tickers.lower() != "all":
        selected_tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]

    models_to_run = [m.strip().lower() for m in args.models.split(",") if m.strip()]

    config = ExperimentConfig(
        target=args.target,
        task_type=args.task,
        training_mode=args.mode,
        selected_tickers=selected_tickers,
        models_to_run=models_to_run,
        random_seed=args.seed,
        dataset_path=args.dataset,
        metadata_path=args.metadata,
    )

    logger.info("Initializing ExperimentRunner with config:")
    logger.info(f"Target: {config.target} | Task: {config.task_type} | Mode: {config.training_mode}")
    logger.info(f"Models: {config.models_to_run}")
    logger.info(f"Tickers: {config.selected_tickers or 'ALL'}")

    runner = ExperimentRunner(config)
    summary = runner.run()

    print("\n" + "=" * 70)
    print(f"EXPERIMENT SUMMARY: {summary.experiment_id}")
    print("=" * 70)
    print(f"Dataset SHA-256: {summary.dataset_sha256[:16]}...")
    print(f"Features Count : {summary.feature_count}")
    print(f"Tickers Evaluated: {len(summary.tickers_evaluated)} ({', '.join(summary.tickers_evaluated)})")
    if summary.tickers_skipped:
        print(f"Tickers Skipped  : {len(summary.tickers_skipped)}")
        for sym, reason in summary.tickers_skipped.items():
            print(f"  - {sym}: {reason}")
    print(f"Models Run     : {summary.models_executed}")
    print(f"Successful Runs: {len(summary.results)}")
    print(f"Failed Runs    : {len(summary.failed_models)}")
    if summary.production_candidate:
        print("\nPRODUCTION CANDIDATE SELECTED (strictly from validation metrics):")
        print(f"  Ticker   : {summary.production_candidate.get('ticker')}")
        print(f"  Model    : {summary.production_candidate.get('model_name')}")
        print(f"  Model ID : {summary.production_candidate.get('model_id')}")
        val_m = summary.production_candidate.get('validation_metrics', {})
        test_m = summary.production_candidate.get('test_metrics', {})
        print(f"  Val RMSE : {val_m.get('rmse')} | Val MAE: {val_m.get('mae')}")
        print(f"  Test RMSE: {test_m.get('rmse')} | Test MAE: {test_m.get('mae')} (unbiased holdout)")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
