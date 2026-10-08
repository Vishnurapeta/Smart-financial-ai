"""
Model loading and thread-safe in-memory caching layer.
Avoids repeated disk I/O, protects memory bounds, and guarantees internal artifact paths
are never leaked in exceptions or public payloads.
"""
from collections import OrderedDict
import os
import threading
import time
from typing import Any, Dict, Optional, Tuple

from app.core.logger import logger
from app.models.stock.base import BaseStockModel
from app.models.stock.linear_regression import LinearRegressionStockModel
from app.models.stock.lstm_model import LSTMStockModel
from app.models.stock.naive_baseline import NaiveBaselineModel
from app.models.stock.random_forest import RandomForestStockModel
from app.models.stock.registry import ModelRegistryEntry
from app.models.stock.xgboost_model import XGBoostStockModel


class ModelCache:
    """Thread-safe bounded in-memory LRU model cache."""

    def __init__(self, capacity: int = 50):
        self.capacity = capacity
        self._cache: OrderedDict[str, BaseStockModel] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, model_id: str) -> Optional[BaseStockModel]:
        with self._lock:
            if model_id in self._cache:
                self._hits += 1
                self._cache.move_to_end(model_id)
                return self._cache[model_id]
            self._misses += 1
            return None

    def put(self, model_id: str, model: BaseStockModel) -> None:
        with self._lock:
            if model_id in self._cache:
                self._cache.move_to_end(model_id)
            else:
                if len(self._cache) >= self.capacity:
                    evicted_id, _ = self._cache.popitem(last=False)
                    logger.info(f"ModelCache capacity reached. Evicted model '{evicted_id}'.")
            self._cache[model_id] = model

    def invalidate(self, model_id: Optional[str] = None) -> None:
        """Invalidates specific model or flushes the entire cache."""
        with self._lock:
            if model_id:
                if model_id in self._cache:
                    del self._cache[model_id]
                    logger.info(f"Invalidated model '{model_id}' from cache.")
            else:
                self._cache.clear()
                logger.info("Flushed all models from ModelCache.")

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._hits + self._misses
            hit_ratio = (self._hits / total * 100.0) if total > 0 else 0.0
            return {
                "cached_models_count": len(self._cache),
                "capacity": self.capacity,
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio_pct": round(hit_ratio, 2),
                "cached_model_ids": list(self._cache.keys()),
            }


class ModelLoader:
    """Loads and deserializes stock models from artifact storage with caching."""

    def __init__(self, cache: Optional[ModelCache] = None):
        self.cache = cache or ModelCache()

    def load_model(self, entry: ModelRegistryEntry) -> Tuple[BaseStockModel, float]:
        """
        Loads model artifact into memory or retrieves from cache.
        Returns: Tuple of (model_instance, load_latency_ms)
        """
        start_time = time.time()

        # 1. Check cache
        cached = self.cache.get(entry.model_id)
        if cached is not None:
            latency_ms = (time.time() - start_time) * 1000.0
            logger.debug(
                f"Cache hit for model {entry.model_id} ({entry.model_name}) in {latency_ms:.2f}ms"
            )
            return cached, round(latency_ms, 2)

        # 2. Cache miss: Validate and load from disk
        artifact_path = entry.artifact_path
        if not os.path.exists(artifact_path):
            # Check relative to ml-service root if running from different working dir
            alt_path = os.path.join(os.getcwd(), artifact_path)
            if os.path.exists(alt_path):
                artifact_path = alt_path
            else:
                logger.error(f"Model artifact not found for model_id={entry.model_id}")
                raise FileNotFoundError(
                    f"Model artifact for {entry.model_name} (ID: {entry.model_id}) "
                    f"is missing from storage."
                )

        model_name_lower = entry.model_name.lower()
        try:
            if "naive" in model_name_lower:
                model = NaiveBaselineModel.load(artifact_path)
            elif "linear" in model_name_lower:
                model = LinearRegressionStockModel.load(artifact_path)
            elif "random" in model_name_lower or "forest" in model_name_lower:
                model = RandomForestStockModel.load(artifact_path)
            elif "xgboost" in model_name_lower:
                model = XGBoostStockModel.load(artifact_path)
            elif "lstm" in model_name_lower:
                model = LSTMStockModel.load(artifact_path)
            else:
                raise ValueError(f"Unsupported model architecture '{entry.model_name}'.")

            # Store in cache
            self.cache.put(entry.model_id, model)
            latency_ms = (time.time() - start_time) * 1000.0
            logger.info(
                f"Loaded model {entry.model_id} ({entry.model_name}) from disk "
                f"in {latency_ms:.2f}ms"
            )
            return model, round(latency_ms, 2)

        except Exception as e:
            logger.error(f"Failed to deserialize model {entry.model_id}: {e}", exc_info=True)
            raise RuntimeError(f"Failed to load model artifact for {entry.model_name}: {str(e)}")


# Global singleton loader
model_loader = ModelLoader()
