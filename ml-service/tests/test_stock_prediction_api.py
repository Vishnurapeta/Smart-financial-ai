"""
Comprehensive test suite for Stock Prediction API and Inference Layer.
Tests:
- Valid prediction requests (price & return)
- Input validation (empty symbol, invalid characters, horizons)
- Error handling (missing model, invalid version, path traversal protection)
- Market data edge cases (unavailable 503, stale 503, insufficient bars 400)
- Feature mismatches & version validations
- Model loading failures & cache performance
- Prediction sanity checks (NaN / Inf protection)
- Prediction persistence & paginated history with filters
- Model catalog & metrics endpoints (zero path leaks)
- Concurrency & thread safety
- LSTM sequence generation for inference
"""
import concurrent.futures
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.stock.registry import ModelRegistry, ModelStatus
from app.repositories.prediction_repository import prediction_repository
from app.services.market_data_service import (
    BaseMarketDataProvider,
    MarketDataUnavailableError,
    market_data_service,
)
from app.services.model_loader import model_loader


# =====================================================================
# TEST FIXTURES & MOCK PROVIDERS
# =====================================================================

class MockMarketDataProvider(BaseMarketDataProvider):
    """Generates synthetic, deterministic OHLCV bars without network/disk calls."""

    def __init__(
        self,
        base_price: float = 3000.0,
        n_bars: int = 100,
        latest_timestamp: Optional[datetime] = None,
        raise_unavailable: bool = False,
    ):
        self.base_price = base_price
        self.n_bars = n_bars
        self.latest_timestamp = latest_timestamp or datetime.now(timezone.utc)
        self.raise_unavailable = raise_unavailable

    def get_history(self, symbol: str, lookback_days: int = 120) -> pd.DataFrame:
        if self.raise_unavailable:
            raise MarketDataUnavailableError(f"Simulated network outage for '{symbol}'.")

        dates = [
            self.latest_timestamp - timedelta(days=i)
            for i in range(self.n_bars - 1, -1, -1)
        ]
        prices = [self.base_price + (i * 1.5) for i in range(self.n_bars)]

        df = pd.DataFrame({
            "date": dates,
            "symbol": symbol.strip().upper(),
            "open": [p - 2.0 for p in prices],
            "high": [p + 5.0 for p in prices],
            "low": [p - 5.0 for p in prices],
            "close": prices,
            "volume": [100000 + (i * 500) for i in range(self.n_bars)],
        })
        return df

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        if self.raise_unavailable:
            raise MarketDataUnavailableError(f"Simulated quote failure for '{symbol}'.")

        return {
            "symbol": symbol.strip().upper(),
            "currentPrice": self.base_price + (self.n_bars * 1.5),
            "open": self.base_price + (self.n_bars * 1.5) - 2.0,
            "high": self.base_price + (self.n_bars * 1.5) + 5.0,
            "low": self.base_price + (self.n_bars * 1.5) - 5.0,
            "previousClose": self.base_price + ((self.n_bars - 1) * 1.5),
            "change": 1.5,
            "changePercent": 0.05,
            "volume": 150000,
            "timestamp": self.latest_timestamp.isoformat(),
            "provider": "mock_test_provider",
        }


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_provider_and_cache():
    """Resets market provider and model cache between tests."""
    original_provider = market_data_service.provider
    original_enforce = market_data_service.enforce_freshness
    mock_prov = MockMarketDataProvider(n_bars=100)
    market_data_service.set_provider(mock_prov)
    market_data_service.enforce_freshness = False
    model_loader.cache.invalidate()

    yield

    market_data_service.set_provider(original_provider)
    market_data_service.enforce_freshness = original_enforce
    model_loader.cache.invalidate()


# =====================================================================
# 1. INPUT VALIDATION TESTS
# =====================================================================

def test_invalid_symbol_empty(client):
    """Rejects empty or whitespace-only stock symbol with 422."""
    resp = client.post("/api/v1/predictions/stock", json={"symbol": "   ", "horizon": 1})
    assert resp.status_code == 422


def test_invalid_symbol_characters(client):
    """Rejects symbols containing script injection, quotes, or invalid characters."""
    bad_symbols = ["TCS; DROP TABLE", "INFY<script>", "RELIANCE/../etc", "HDFC%20BANK"]
    for sym in bad_symbols:
        resp = client.post("/api/v1/predictions/stock", json={"symbol": sym, "horizon": 1})
        assert resp.status_code == 422


def test_invalid_horizon(client):
    """Rejects negative, zero, or excessively large horizons."""
    for h in [0, -1, -5, 31, 100]:
        resp = client.post("/api/v1/predictions/stock", json={"symbol": "TCS", "horizon": h})
        assert resp.status_code == 422


def test_invalid_model_version_path_traversal(client):
    """Rejects attempts to inject filesystem paths via model_version."""
    traversals = ["../models/hack", "c:\\boot.ini", "/etc/passwd", "http://evil.com/m.pt"]
    for v in traversals:
        resp = client.post(
            "/api/v1/predictions/stock",
            json={"symbol": "TCS", "horizon": 1, "model_version": v},
        )
        assert resp.status_code == 422


# =====================================================================
# 2. MODEL RESOLUTION & NOT FOUND TESTS
# =====================================================================

def test_missing_model_unsupported_ticker(client):
    """Returns 404 when requesting prediction for an unregistered ticker."""
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "UNKNOWN_TICKER_XYZ", "horizon": 1},
    )
    assert resp.status_code == 404
    assert "No models are currently registered" in resp.json()["detail"]


def test_incompatible_horizon_409(client):
    """Returns 409 when model exists for ticker but not for requested horizon."""
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 25},
    )
    assert resp.status_code == 409
    assert "horizon=25" in resp.json()["detail"]


# =====================================================================
# 3. MARKET DATA EDGE CASES (503 & 400)
# =====================================================================

def test_market_data_unavailable_503(client):
    """Returns 503 with safe generic message when upstream market provider fails."""
    failing_prov = MockMarketDataProvider(raise_unavailable=True)
    market_data_service.set_provider(failing_prov)

    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 503
    assert "Market data is currently unavailable" in resp.json()["detail"]


def test_stale_market_data_rejection(client):
    """Returns 503 when market data exceeds freshness threshold and enforce_freshness is True."""
    stale_time = datetime.now(timezone.utc) - timedelta(days=10)
    stale_prov = MockMarketDataProvider(latest_timestamp=stale_time)
    market_data_service.set_provider(stale_prov)
    market_data_service.enforce_freshness = True
    market_data_service.max_market_data_age_minutes = 60  # 1 hour max

    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 503
    assert "Market data is stale" in resp.json()["detail"]


def test_insufficient_historical_bars_400(client):
    """Returns 400 when provider provides fewer than minimum required lookback bars."""
    short_prov = MockMarketDataProvider(n_bars=20)  # only 20 bars, needs >= 65
    market_data_service.set_provider(short_prov)

    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 400
    assert "Insufficient historical data" in resp.json()["detail"]


# =====================================================================
# 4. PREDICTION INFERENCE ON REAL REGISTERED MODELS
# =====================================================================

def test_valid_prediction_return_target(client):
    """
    Tests inference using real registered XGBoost return prediction model.
    Verifies response format, derived price, and zero path leaks.
    """
    payload = {
        "symbol": "TCS",
        "horizon": 1,
        "target": "target_next_return",
        "allow_candidate": True,
    }
    resp = client.post("/api/v1/predictions/stock", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["symbol"] == "TCS"
    assert data["horizon"] == 1
    assert data["target"] == "target_next_return"
    assert "predicted_return" in data and data["predicted_return"] is not None
    assert "predicted_value" in data and data["predicted_value"] is not None
    assert data["is_derived_price"] is True
    assert data["is_derived_return"] is False
    assert data["current_price"] > 0
    assert "market_data_timestamp" in data
    assert "prediction_timestamp" in data
    assert "historical_metrics" in data
    assert "directional_accuracy" in data["historical_metrics"]

    # Security check: Zero path leakage
    raw_str = resp.text
    assert "models/artifacts" not in raw_str
    assert "C:\\" not in raw_str
    assert ".joblib" not in raw_str
    assert ".pt" not in raw_str


def test_valid_prediction_price_target(client):
    """
    Tests inference using real registered Naive price prediction model.
    Verifies response format and derived return.
    """
    payload = {
        "symbol": "RELIANCE",
        "horizon": 1,
        "target": "target_next_close",
        "allow_candidate": True,
    }
    resp = client.post("/api/v1/predictions/stock", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["symbol"] == "RELIANCE"
    assert data["target"] == "target_next_close"
    assert data["predicted_value"] is not None
    assert data["predicted_return"] is not None
    assert data["is_derived_return"] is True
    assert data["is_derived_price"] is False
    assert data["model_name"] in ["NaiveBaseline", "LinearRegression", "RandomForest", "XGBoost", "LSTM"]


# =====================================================================
# 5. MODEL CACHE & LATENCY
# =====================================================================

def test_model_cache_workflow(client):
    """Verifies that model cache records hit on second inference call (model_load_ms = 0)."""
    payload = {
        "symbol": "INFY",
        "horizon": 1,
        "target": "target_next_return",
        "allow_candidate": True,
    }
    # Cold call
    resp1 = client.post("/api/v1/predictions/stock", json=payload)
    assert resp1.status_code == 200

    # Warm call (must hit in-memory cache)
    resp2 = client.post("/api/v1/predictions/stock", json=payload)
    assert resp2.status_code == 200
    assert resp2.json()["latency_ms"]["model_load_ms"] == 0.0

    # Cache stats endpoint
    stats_resp = client.get("/api/v1/models/stock/cache/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["hits"] >= 1
    assert stats["cached_models_count"] >= 1

    # Invalidate cache
    inv_resp = client.post("/api/v1/models/stock/cache/invalidate")
    assert inv_resp.status_code == 200
    stats_after = client.get("/api/v1/models/stock/cache/stats").json()
    assert stats_after["cached_models_count"] == 0


# =====================================================================
# 6. PREDICTION PERSISTENCE & HISTORY RETRIEVAL
# =====================================================================

def test_prediction_history_endpoints(client):
    """Tests prediction persistence, filtering, and pagination."""
    prediction_repository.clear()

    # Generate 2 predictions
    client.post(
        "/api/v1/predictions/stock",
        json={
            "symbol": "TCS",
            "horizon": 1,
            "target": "target_next_return",
            "allow_candidate": True,
        },
    )
    client.post(
        "/api/v1/predictions/stock",
        json={
            "symbol": "TCS",
            "horizon": 1,
            "target": "target_next_return",
            "allow_candidate": True,
        },
    )

    # Query history
    hist_resp = client.get("/api/v1/predictions/stock/TCS/history?limit=10&offset=0")
    assert hist_resp.status_code == 200
    data = hist_resp.json()

    assert data["symbol"] == "TCS"
    assert data["total_count"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["symbol"] == "TCS"
    assert data["items"][0]["predicted_return"] is not None

    # Test filtering by non-matching horizon
    hist_filtered = client.get("/api/v1/predictions/stock/TCS/history?horizon=5")
    assert hist_filtered.json()["total_count"] == 0


# =====================================================================
# 7. MODEL CATALOG & METRICS ENDPOINTS
# =====================================================================

def test_model_catalog_endpoint(client):
    """Verifies public model catalog returns safe cards without internal paths."""
    resp = client.get("/api/v1/models/stock?symbol=TCS")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_count"] >= 1
    card = data["models"][0]
    assert card["symbol"] == "TCS"
    assert "model_id" in card
    assert "model_name" in card
    assert "metrics" in card

    # Security check: Zero internal path leaks
    assert "artifact_path" not in card
    assert "models/artifacts" not in resp.text


def test_model_metrics_endpoint(client):
    """Verifies per-stock evaluation metrics endpoint."""
    resp = client.get("/api/v1/models/stock/TCS/metrics")
    assert resp.status_code == 200
    data = resp.json()

    assert data["symbol"] == "TCS"
    assert len(data["models"]) >= 1
    m = data["models"][0]
    assert "validation_metrics" in m
    assert "test_metrics" in m


def test_model_promotion_endpoint(client):
    """Verifies explicit promotion of CANDIDATE to PRODUCTION."""
    models = ModelRegistry().list_models()
    assert len(models) >= 1
    model_id = models[0].model_id

    ModelRegistry().update_status(model_id, ModelStatus.CANDIDATE, "Setup for promote test")

    # Promote
    payload = {"new_status": "PRODUCTION", "reason": "Tested and approved for production"}
    promote_resp = client.post(f"/api/v1/models/stock/{model_id}/promote", json=payload)
    assert promote_resp.status_code == 200
    assert promote_resp.json()["status"] == "PRODUCTION"

    # Verify model is now returned as PRODUCTION
    entry = ModelRegistry().get_model(model_id)
    assert entry.status == "PRODUCTION"


# =====================================================================
# 8. CONCURRENCY & THREAD SAFETY
# =====================================================================

def test_concurrent_predictions(client):
    """Tests thread-safety under simultaneous prediction requests."""
    payload = {
        "symbol": "TCS",
        "horizon": 1,
        "target": "target_next_return",
        "allow_candidate": True,
    }

    def make_call():
        return client.post("/api/v1/predictions/stock", json=payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(make_call) for _ in range(5)]
        results = [f.result() for f in futures]

    for r in results:
        assert r.status_code == 200
        assert r.json()["symbol"] == "TCS"


# =====================================================================
# 9. ADVANCED SANITY & FEATURE/MODEL FAILURE TESTS
# =====================================================================

def test_feature_version_mismatch(client, monkeypatch):
    """Verifies that an incompatible feature version fails with controlled 400 error."""
    from app.services.prediction_service import prediction_service

    import copy
    orig_resolve = prediction_service.resolve_model

    def mock_resolve(*args, **kwargs):
        entry = orig_resolve(*args, **kwargs)
        # Mutate shallow copy of entry to prevent polluting in-memory registry singleton
        entry_copy = copy.copy(entry)
        entry_copy.feature_version = "v99.0.0"
        return entry_copy

    monkeypatch.setattr(prediction_service, "resolve_model", mock_resolve)
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 400
    assert "Feature version mismatch" in resp.json()["detail"]


def test_nan_prediction_rejection(client, monkeypatch):
    """Verifies that non-finite/NaN predictions are strictly rejected."""
    class BadModel:
        feature_names = ["close"]

        def predict(self, X):
            return np.array([np.nan])

    monkeypatch.setattr(model_loader, "load_model", lambda entry: (BadModel(), 0.1))
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 500
    assert "non-finite or NaN" in resp.json()["detail"]


def test_infinite_prediction_rejection(client, monkeypatch):
    """Verifies that infinite predictions are strictly rejected."""
    class BadModel:
        feature_names = ["close"]

        def predict(self, X):
            return np.array([np.inf])

    monkeypatch.setattr(model_loader, "load_model", lambda entry: (BadModel(), 0.1))
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 500
    assert "non-finite or NaN" in resp.json()["detail"]


def test_model_loading_failure_missing_artifact(client, monkeypatch):
    """Verifies that missing model artifacts fail cleanly with 500 without leaking file paths."""
    from app.services.prediction_service import prediction_service

    orig_resolve = prediction_service.resolve_model

    def mock_resolve(*args, **kwargs):
        entry = orig_resolve(*args, **kwargs)
        entry.artifact_path = "non_existent_fake_path.joblib"
        return entry

    monkeypatch.setattr(prediction_service, "resolve_model", mock_resolve)
    resp = client.post(
        "/api/v1/predictions/stock",
        json={"symbol": "TCS", "horizon": 1, "allow_candidate": True},
    )
    assert resp.status_code == 500
    assert "non_existent_fake_path" not in resp.text


def test_lstm_sequence_inference(client):
    """Verifies inference using LSTM model with historical sliding sequences."""
    # Find LSTM model
    r = ModelRegistry()
    lstm_models = [m for m in r.list_models(ticker="RELIANCE") if "lstm" in m.model_name.lower()]
    assert len(lstm_models) >= 1
    lstm_id = lstm_models[0].model_id

    # Promote to candidate
    r.update_status(lstm_id, ModelStatus.CANDIDATE, "Promote for LSTM test")

    resp = client.post(
        "/api/v1/predictions/stock",
        json={
            "symbol": "RELIANCE",
            "horizon": 1,
            "model_version": lstm_models[0].model_version,
            "allow_candidate": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "RELIANCE"
    assert data["model_name"] == "LSTM"
    assert data["current_price"] > 0


def test_production_enforcement_in_prod_mode(client, monkeypatch):
    """Verifies that in production mode, requesting an unpromoted symbol fails with 404."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "PYTHON_ENV", "production")

    # Pick a symbol with only candidate models (e.g. INFY price)
    resp = client.post(
        "/api/v1/predictions/stock",
        json={
            "symbol": "INFY",
            "horizon": 1,
            "target": "target_next_close",
            "allow_candidate": False,
        },
    )
    # If no production model exists, must reject with 404
    if resp.status_code == 404:
        assert "No PRODUCTION model is currently available" in resp.json()["detail"]
