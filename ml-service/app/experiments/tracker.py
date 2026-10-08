"""
Experiment tracking and execution audit logging.
Persists structured experiment configurations, evaluation metrics, and run summaries.
"""
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import os
from typing import Any, Dict, List, Optional


@dataclass
class ModelEvaluationResult:
    """Evaluation result for an individual model within an experiment."""

    model_name: str
    model_version: str
    ticker: str
    target: str
    horizon: int
    hyperparameters: Dict[str, Any]
    validation_metrics: Dict[str, Any]
    test_metrics: Dict[str, Any]
    artifact_path: Optional[str] = None
    model_id: Optional[str] = None
    training_duration_seconds: float = 0.0
    status: str = "SUCCESS"
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ExperimentRunSummary:
    """Complete summary of an experiment run across multiple models and tickers."""

    experiment_id: str
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    training_mode: str = "per_ticker"
    target: str = "target_next_close"
    task_type: str = "price"
    random_seed: int = 42
    dataset_version: str = "unknown"
    dataset_sha256: str = ""
    feature_count: int = 0
    feature_names: List[str] = field(default_factory=list)
    tickers_evaluated: List[str] = field(default_factory=list)
    tickers_skipped: Dict[str, str] = field(default_factory=dict)
    models_executed: List[str] = field(default_factory=list)
    results: List[Dict[str, Any]] = field(default_factory=list)
    failed_models: List[Dict[str, Any]] = field(default_factory=list)
    training_period: Dict[str, str] = field(default_factory=dict)
    validation_period: Dict[str, str] = field(default_factory=dict)
    test_period: Dict[str, str] = field(default_factory=dict)
    production_candidate: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ExperimentTracker:
    """Manages experiment logging, persistence of configurations, and run results."""

    def __init__(
        self,
        results_dir: str = "experiments/results",
        configs_dir: str = "experiments/configs",
    ):
        self.results_dir = results_dir
        self.configs_dir = configs_dir
        os.makedirs(self.results_dir, exist_ok=True)
        os.makedirs(self.configs_dir, exist_ok=True)

    def save_config(self, experiment_id: str, config_dict: Dict[str, Any]) -> str:
        """Saves configuration snapshot before training starts."""
        path = os.path.join(self.configs_dir, f"{experiment_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2)
        return path

    def save_results(self, summary: ExperimentRunSummary) -> str:
        """Saves completed experiment run summary and metrics."""
        path = os.path.join(self.results_dir, f"{summary.experiment_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(summary.to_dict(), f, indent=2)
        return path

    def load_results(self, experiment_id: str) -> Optional[Dict[str, Any]]:
        path = os.path.join(self.results_dir, f"{experiment_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
