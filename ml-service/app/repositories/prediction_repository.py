"""
Repository for storing and querying stock prediction historical audit records.
Thread-safe in-memory store with optional JSON persistence.
"""
from datetime import datetime, timezone
import json
import os
import threading
from typing import List, Optional, Tuple
import uuid

from app.core.logger import logger
from app.schemas.predictions import StockPredictionRecord


class PredictionRepository:
    """Thread-safe repository managing prediction history audit logs."""

    def __init__(self, storage_path: str = "app/data/predictions/history.json"):
        self.storage_path = storage_path
        self._lock = threading.Lock()
        self._records: List[StockPredictionRecord] = []
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    raw_list = json.load(f)
                    self._records = [StockPredictionRecord(**item) for item in raw_list]
                logger.info(f"Loaded {len(self._records)} prediction audit records from disk.")
            except Exception as e:
                logger.warning(f"Could not load prediction history from {self.storage_path}: {e}")
                self._records = []

    def _persist_to_disk(self) -> None:
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([r.model_dump() for r in self._records], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist prediction history: {e}")

    def save(self, record_data: dict) -> StockPredictionRecord:
        """Saves a new prediction record thread-safely."""
        with self._lock:
            if "id" not in record_data or not record_data["id"]:
                record_data["id"] = f"pred_{uuid.uuid4().hex[:12]}"
            if "prediction_timestamp" not in record_data or not record_data["prediction_timestamp"]:
                record_data["prediction_timestamp"] = datetime.now(timezone.utc).isoformat()

            record = StockPredictionRecord(**record_data)
            self._records.append(record)
            self._persist_to_disk()
            return record

    def get_total_count(self) -> int:
        with self._lock:
            return len(self._records)

    def get_latest_timestamp(self) -> Optional[str]:
        with self._lock:
            if not self._records:
                return None
            return max(r.prediction_timestamp for r in self._records)

    def get_history(
        self,
        symbol: Optional[str] = None,
        horizon: Optional[int] = None,
        model: Optional[str] = None,
        status_filter: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[StockPredictionRecord], int]:
        """
        Retrieves paginated prediction records matching the query filters.
        Supports filtering across all stocks or by specific symbol.
        Returns (records, total_matching_count).
        """
        clean_sym = symbol.strip().upper() if symbol and symbol.strip().upper() != "ALL" else None
        with self._lock:
            # Filter by symbol if specified
            if clean_sym:
                matches = [r for r in self._records if r.symbol == clean_sym]
            else:
                matches = list(self._records)

            if horizon is not None:
                matches = [r for r in matches if r.horizon == horizon]

            if model:
                model_lower = model.lower()
                matches = [r for r in matches if model_lower in r.model_name.lower()]

            if status_filter:
                sf = status_filter.upper()
                matches = [r for r in matches if (r.status or "PENDING").upper() == sf]

            if start_date:
                matches = [r for r in matches if r.prediction_timestamp >= start_date]

            if end_date:
                matches = [r for r in matches if r.prediction_timestamp <= end_date]

            # Sort descending by prediction timestamp
            matches.sort(key=lambda r: r.prediction_timestamp, reverse=True)
            total_count = len(matches)

            # Paginate
            paginated = matches[offset : offset + limit]

            # Ensure direction and status fields are populated
            enriched_records = []
            for r in paginated:
                record_copy = r.model_copy()
                if record_copy.actual_value is None and record_copy.status == "PENDING":
                    record_copy.direction = "Pending"
                    record_copy.status = "PENDING"
                enriched_records.append(record_copy)

            return enriched_records, total_count

    def clear(self) -> None:
        """Clears memory and disk store (used in tests)."""
        with self._lock:
            self._records = []
            if os.path.exists(self.storage_path):
                try:
                    os.remove(self.storage_path)
                except Exception:
                    pass


# Global singleton instance
prediction_repository = PredictionRepository()
