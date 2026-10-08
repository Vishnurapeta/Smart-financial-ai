"""
Structured model and dataset metadata schema for stock prediction.
Ensures lineage tracking, auditability, and reproducibility.
"""
import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class ModelMetadata:
    """
    Metadata capturing full data lineage, feature configuration,
    and split boundaries for model training reproducibility.
    """

    ticker: str
    dataset_start_date: str
    dataset_end_date: str
    number_of_records: int
    feature_version: str = "v1.0.0"
    preprocessing_version: str = "v1.0.0"
    target_definition: Dict[str, str] = field(default_factory=dict)
    prediction_horizon: int = 1
    train_period: Dict[str, Any] = field(default_factory=dict)
    validation_period: Dict[str, Any] = field(default_factory=dict)
    test_period: Dict[str, Any] = field(default_factory=dict)
    training_timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    model_version: str = "1.0.0"
    metrics_placeholder: Dict[str, Any] = field(default_factory=dict)
    dataset_file: str = "app/data/raw/nifty500_stocks.csv"
    features_list: List[str] = field(default_factory=list)
    target_columns: List[str] = field(default_factory=list)
    scaler_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save_json(self, output_dir: str, filename: str = "model_metadata.json") -> str:
        os.makedirs(output_dir, exist_ok=True)
        path = os.path.join(output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)
        return path

    @classmethod
    def from_json(cls, file_path: str) -> "ModelMetadata":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(**data)
