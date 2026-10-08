"""
Data validation module for stock market time-series datasets.
Generates comprehensive audit reports and logs removal reasons.
"""
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from app.core.logger import logger


@dataclass
class ValidationReport:
    """Detailed audit report of dataset quality and validation findings."""

    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    total_rows_inspected: int = 0
    valid_rows: int = 0
    removed_rows_total: int = 0
    removal_breakdown: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    tickers_found_count: int = 0
    tickers_retained_count: int = 0
    tickers_dropped_count: int = 0
    tickers_dropped_list: List[str] = field(default_factory=list)
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    duplicate_ticker_dates_count: int = 0
    unsorted_tickers_count: int = 0
    nan_inf_features_count: int = 0
    is_valid: bool = True
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save_json(self, output_dir: str, filename: str = "validation_report.json") -> str:
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)
        return file_path


class DataValidator:
    """
    Validates structural integrity, market sanity checks, and temporal consistency
    of stock market datasets.
    """

    def __init__(self, min_historical_records: int = 100):
        self.min_historical_records = min_historical_records

    def validate_raw(self, df: pd.DataFrame) -> ValidationReport:
        """
        Runs comprehensive validation on normalized raw data prior to feature calculation.
        """
        report = ValidationReport(total_rows_inspected=len(df))
        total_rows = len(df)

        if total_rows == 0:
            report.is_valid = False
            report.errors.append("Dataset is completely empty.")
            return report

        # 1. Missing ticker check
        missing_ticker_mask = df["symbol"].isna() | (df["symbol"].astype(str).str.strip() == "")
        missing_tickers = int(missing_ticker_mask.sum())
        if missing_tickers > 0:
            report.removal_breakdown["missing_ticker"] = {
                "count": missing_tickers,
                "percentage": round((missing_tickers / total_rows) * 100, 4),
                "reason": "Missing or empty stock ticker/symbol",
            }
            report.warnings.append(f"Found {missing_tickers} rows with missing or blank ticker symbol.")

        # 2. Missing or invalid date check
        missing_date_mask = df["date"].isna()
        missing_dates = int(missing_date_mask.sum())
        if missing_dates > 0:
            report.removal_breakdown["missing_date"] = {
                "count": missing_dates,
                "percentage": round((missing_dates / total_rows) * 100, 4),
                "reason": "Missing date value",
            }

        dates_parsed = pd.to_datetime(df["date"], errors="coerce")
        invalid_dates = int((dates_parsed.isna() & ~missing_date_mask).sum())
        if invalid_dates > 0:
            report.removal_breakdown["invalid_date_format"] = {
                "count": invalid_dates,
                "percentage": round((invalid_dates / total_rows) * 100, 4),
                "reason": "Date string could not be parsed to datetime",
            }

        valid_dates = dates_parsed.dropna()
        if len(valid_dates) > 0:
            report.date_min = str(valid_dates.min().date())
            report.date_max = str(valid_dates.max().date())

        # 3. OHLCV checks: non-numeric, missing, or negative
        ohlcv_cols = ["open", "high", "low", "close", "volume"]
        for col in ohlcv_cols:
            if col not in df.columns:
                report.errors.append(f"Required column '{col}' is missing.")
                report.is_valid = False
                continue

            # Non-numeric check
            non_numeric = int(pd.to_numeric(df[col], errors="coerce").isna().sum())
            if non_numeric > 0:
                report.removal_breakdown[f"non_numeric_{col}"] = {
                    "count": non_numeric,
                    "percentage": round((non_numeric / total_rows) * 100, 4),
                    "reason": f"Non-numeric values in {col}",
                }

            # Negative price/volume check
            numeric_vals = pd.to_numeric(df[col], errors="coerce")
            neg_count = int((numeric_vals < 0).sum())
            if neg_count > 0:
                report.removal_breakdown[f"negative_{col}"] = {
                    "count": neg_count,
                    "percentage": round((neg_count / total_rows) * 100, 4),
                    "reason": f"Negative value in {col}",
                }

        # 4. Duplicate (symbol, date) check
        dup_mask = df.duplicated(subset=["symbol", "date"], keep=False)
        report.duplicate_ticker_dates_count = int(dup_mask.sum())
        if report.duplicate_ticker_dates_count > 0:
            dup_removals = int(df.duplicated(subset=["symbol", "date"], keep="first").sum())
            report.removal_breakdown["duplicate_symbol_date"] = {
                "count": dup_removals,
                "percentage": round((dup_removals / total_rows) * 100, 4),
                "reason": "Duplicate records sharing identical ticker and date",
            }
            report.warnings.append(
                f"Identified {report.duplicate_ticker_dates_count} rows with "
                f"duplicate (symbol, date) combinations."
            )

        # 5. Chronological sorting check within tickers
        tickers = df["symbol"].dropna().unique()
        report.tickers_found_count = len(tickers)
        unsorted_tickers = 0
        dropped_tickers = []

        for sym in tickers:
            sym_df = df[df["symbol"] == sym]
            # Check length
            if len(sym_df) < self.min_historical_records:
                dropped_tickers.append(str(sym))
                continue
            # Check sorting
            sym_dates = pd.to_datetime(sym_df["date"], errors="coerce")
            if not sym_dates.is_monotonic_increasing:
                unsorted_tickers += 1

        report.unsorted_tickers_count = unsorted_tickers
        if unsorted_tickers > 0:
            report.warnings.append(
                f"{unsorted_tickers} tickers have unsorted or disordered historical dates in the raw data."
            )

        report.tickers_dropped_count = len(dropped_tickers)
        report.tickers_dropped_list = dropped_tickers
        report.tickers_retained_count = report.tickers_found_count - report.tickers_dropped_count

        if report.tickers_dropped_count > 0:
            report.removal_breakdown["insufficient_history"] = {
                "count": sum(len(df[df["symbol"] == sym]) for sym in dropped_tickers),
                "percentage": round(
                    (sum(len(df[df["symbol"] == sym]) for sym in dropped_tickers) / total_rows)
                    * 100,
                    4,
                ),
                "reason": f"Ticker has fewer than {self.min_historical_records} historical trading days",
            }

        # Calculate total removals
        report.removed_rows_total = sum(
            item["count"] for item in report.removal_breakdown.values()
        )
        report.valid_rows = max(0, total_rows - report.removed_rows_total)

        # Log detailed audit
        self._log_report(report)

        return report

    def validate_features(self, df: pd.DataFrame, feature_cols: List[str]) -> ValidationReport:
        """
        Validates post-feature-generation DataFrame for NaNs, Infs, or column anomalies.
        """
        report = ValidationReport(total_rows_inspected=len(df), valid_rows=len(df))

        nan_inf_count = 0
        for col in feature_cols:
            if col not in df.columns:
                report.errors.append(f"Engineered feature column '{col}' missing from DataFrame.")
                report.is_valid = False
                continue

            nans = int(df[col].isna().sum())
            infs = int(np.isinf(df[col]).sum()) if np.issubdtype(df[col].dtype, np.number) else 0

            if nans > 0 or infs > 0:
                nan_inf_count += (nans + infs)
                report.warnings.append(f"Feature '{col}' contains {nans} NaNs and {infs} Infs.")

        report.nan_inf_features_count = nan_inf_count
        if nan_inf_count > 0:
            report.is_valid = False

        return report

    def _log_report(self, report: ValidationReport) -> None:
        """Logs validation summary with counts and percentages."""
        logger.info(
            f"=== DATA VALIDATION AUDIT ===\n"
            f"Total rows inspected: {report.total_rows_inspected}\n"
            f"Tickers found: {report.tickers_found_count}, Retained: {report.tickers_retained_count}, "
            f"Dropped (< {self.min_historical_records} days): {report.tickers_dropped_count}\n"
            f"Date Range: {report.date_min} to {report.date_max}\n"
            f"Duplicate (Symbol, Date) rows: {report.duplicate_ticker_dates_count}\n"
            f"Unsorted tickers: {report.unsorted_tickers_count}"
        )

        if report.removal_breakdown:
            logger.info("Removals Breakdown:")
            for key, val in report.removal_breakdown.items():
                logger.info(f" - {key}: {val['count']} rows ({val['percentage']}%) — {val['reason']}")
