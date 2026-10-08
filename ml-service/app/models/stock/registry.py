"""
Model Registry and Life Cycle Management for SmartFin AI stock models.
Tracks model versions, parameters, performance metrics, artifacts, and promotional status:
EXPERIMENTAL -> CANDIDATE -> PRODUCTION -> RETIRED.
"""
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
import json
import os
from typing import Any, Dict, List, Optional
import uuid


class ModelStatus(str, Enum):
    EXPERIMENTAL = "EXPERIMENTAL"
    CANDIDATE = "CANDIDATE"
    PRODUCTION = "PRODUCTION"
    RETIRED = "RETIRED"


@dataclass
class ModelRegistryEntry:
    """Detailed registry record for a trained stock forecasting model."""

    model_id: str
    model_name: str
    model_version: str
    ticker: str
    target: str
    horizon: int
    feature_version: str
    preprocessing_version: str
    training_start: str
    training_end: str
    validation_start: str
    validation_end: str
    test_start: str
    test_end: str
    training_timestamp: str
    hyperparameters: Dict[str, Any]
    metrics: Dict[str, Any]
    artifact_path: str
    dataset_version: str
    status: str = ModelStatus.EXPERIMENTAL.value
    status_history: List[Dict[str, str]] = field(default_factory=list)
    scaler_artifact_path: Optional[str] = None
    sequence_length: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ModelRegistry:
    """
    Central repository for tracking, discovering, and promoting models.
    Persists registry catalog and individual model metadata.
    """

    def __init__(
        self,
        registry_dir: str = "models/registry",
        metadata_dir: str = "models/metadata",
    ):
        self.registry_dir = registry_dir
        self.metadata_dir = metadata_dir
        self.catalog_file = os.path.join(registry_dir, "model_catalog.json")

        os.makedirs(self.registry_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)
        self.entries: Dict[str, ModelRegistryEntry] = {}
        self._load_catalog()

    def _load_catalog(self) -> None:
        if os.path.exists(self.catalog_file):
            try:
                with open(self.catalog_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                loaded = {}
                for item in data.values():
                    valid_keys = {k: v for k, v in item.items() if k in ModelRegistryEntry.__dataclass_fields__}
                    entry = ModelRegistryEntry(**valid_keys)
                    loaded[entry.model_id] = entry
                if loaded:
                    self.entries = loaded
            except Exception:
                pass

    def _save_catalog(self) -> None:
        serialized = {k: v.to_dict() for k, v in self.entries.items()}
        tmp_file = f"{self.catalog_file}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2)
        os.replace(tmp_file, self.catalog_file)

    def register_model(
        self,
        model_name: str,
        model_version: str,
        ticker: str,
        target: str,
        horizon: int,
        feature_version: str,
        preprocessing_version: str,
        training_start: str,
        training_end: str,
        validation_start: str,
        validation_end: str,
        test_start: str,
        test_end: str,
        hyperparameters: Dict[str, Any],
        metrics: Dict[str, Any],
        artifact_path: str,
        dataset_version: str,
        status: ModelStatus = ModelStatus.EXPERIMENTAL,
        custom_model_id: Optional[str] = None,
        scaler_artifact_path: Optional[str] = None,
        sequence_length: Optional[int] = None,
    ) -> ModelRegistryEntry:
        """
        Registers a new model in the registry under EXPERIMENTAL status by default.
        """
        model_id = custom_model_id or f"mod_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()

        # If sequence_length not explicitly passed, inspect hyperparameters
        if sequence_length is None and hyperparameters and "sequence_length" in hyperparameters:
            sequence_length = int(hyperparameters["sequence_length"])

        entry = ModelRegistryEntry(
            model_id=model_id,
            model_name=model_name,
            model_version=model_version,
            ticker=ticker,
            target=target,
            horizon=horizon,
            feature_version=feature_version,
            preprocessing_version=preprocessing_version,
            training_start=training_start,
            training_end=training_end,
            validation_start=validation_start,
            validation_end=validation_end,
            test_start=test_start,
            test_end=test_end,
            training_timestamp=now,
            hyperparameters=hyperparameters,
            metrics=metrics,
            artifact_path=artifact_path,
            dataset_version=dataset_version,
            status=status.value,
            status_history=[{"status": status.value, "timestamp": now, "reason": "Initial registration"}],
            scaler_artifact_path=scaler_artifact_path,
            sequence_length=sequence_length,
        )

        self.entries[model_id] = entry
        self._save_catalog()

        # Save individual metadata file
        meta_path = os.path.join(self.metadata_dir, f"{model_id}.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(entry.to_dict(), f, indent=2)

        return entry

    def update_status(
        self, model_id: str, new_status: ModelStatus, reason: str = ""
    ) -> ModelRegistryEntry:
        """
        Updates the promotional status of a model (e.g. promoting to CANDIDATE or PRODUCTION).
        """
        if model_id not in self.entries:
            raise KeyError(f"Model ID '{model_id}' not found in registry.")

        entry = self.entries[model_id]
        now = datetime.now(timezone.utc).isoformat()
        entry.status = new_status.value
        entry.status_history.append({"status": new_status.value, "timestamp": now, "reason": reason})

        self._save_catalog()

        # Update metadata file
        meta_path = os.path.join(self.metadata_dir, f"{model_id}.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(entry.to_dict(), f, indent=2)

        return entry

    def get_model(self, model_id: str) -> Optional[ModelRegistryEntry]:
        self._load_catalog()
        return self.entries.get(model_id)

    def list_models(
        self,
        ticker: Optional[str] = None,
        target: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[ModelRegistryEntry]:
        self._load_catalog()
        results = list(self.entries.values())
        if ticker:
            clean_tick = ticker.strip().upper()
            results = [e for e in results if e.ticker.strip().upper() == clean_tick]
        if target:
            results = [e for e in results if e.target == target]
        if status:
            results = [e for e in results if e.status == status]
        return results

    def get_production_model(self, ticker: str, target: str) -> Optional[ModelRegistryEntry]:
        """Retrieves currently active production model for ticker and target."""
        prods = self.list_models(ticker=ticker, target=target, status=ModelStatus.PRODUCTION.value)
        return prods[-1] if prods else None

    def get_candidate_model(self, ticker: str, target: str) -> Optional[ModelRegistryEntry]:
        """Retrieves best candidate model for ticker and target."""
        cands = self.list_models(ticker=ticker, target=target, status=ModelStatus.CANDIDATE.value)
        return cands[-1] if cands else None
