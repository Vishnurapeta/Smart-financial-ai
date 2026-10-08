"""
Dataset Fingerprinting and Versioning utility.
Computes cryptographic SHA-256 hashes and structural metadata for raw and processed datasets.
"""
import hashlib
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional
import pandas as pd


@dataclass
class DatasetFingerprint:
    """Cryptographic and statistical fingerprint of a dataset version."""

    filepath: str
    filename: str
    sha256_hash: str
    file_size_bytes: int
    row_count: int
    column_count: int
    columns: list
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    ticker_count: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DatasetFingerprinter:
    """Computes reproducible fingerprints for dataset auditing and experiment tracking."""

    @staticmethod
    def compute_sha256(filepath: str, chunk_size: int = 65536) -> str:
        """Computes SHA-256 hash of a file on disk."""
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(chunk_size):
                sha256.update(chunk)
        return sha256.hexdigest()

    @classmethod
    def fingerprint_file(cls, filepath: str) -> DatasetFingerprint:
        """
        Generates full fingerprint for a CSV or Parquet dataset.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Dataset file not found: {filepath}")

        sha256 = cls.compute_sha256(filepath)
        size_bytes = os.path.getsize(filepath)
        filename = os.path.basename(filepath)

        # Read sample/structural metadata
        if filepath.endswith(".parquet"):
            df = pd.read_parquet(filepath)
        else:
            df = pd.read_csv(filepath)

        date_col = next((c for c in ["date", "Date"] if c in df.columns), None)
        symbol_col = next((c for c in ["symbol", "Symbol"] if c in df.columns), None)

        date_min = str(df[date_col].min()) if date_col else None
        date_max = str(df[date_col].max()) if date_col else None
        ticker_count = int(df[symbol_col].nunique()) if symbol_col else None

        return DatasetFingerprint(
            filepath=filepath,
            filename=filename,
            sha256_hash=sha256,
            file_size_bytes=size_bytes,
            row_count=len(df),
            column_count=len(df.columns),
            columns=list(df.columns),
            date_min=date_min,
            date_max=date_max,
            ticker_count=ticker_count,
        )

    @classmethod
    def generate_fingerprint(
        cls,
        raw_csv_path: Optional[str] = None,
        processed_parquet_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generates comprehensive fingerprint dictionary for raw and/or processed datasets."""
        res: Dict[str, Any] = {
            "version": "v1.0.0",
        }
        if raw_csv_path and os.path.exists(raw_csv_path):
            res["raw_checksum_sha256"] = cls.compute_sha256(raw_csv_path)
            res["raw_file"] = os.path.basename(raw_csv_path)
            res["raw_size_bytes"] = os.path.getsize(raw_csv_path)
        if processed_parquet_path and os.path.exists(processed_parquet_path):
            res["processed_checksum_sha256"] = cls.compute_sha256(processed_parquet_path)
            res["processed_file"] = os.path.basename(processed_parquet_path)
            res["processed_size_bytes"] = os.path.getsize(processed_parquet_path)
        return res
