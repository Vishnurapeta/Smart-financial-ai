"""
Unit and integration tests for the AI Stock Prediction Intelligence Center & Screener.
Verifies discovery, filtering, search, multi-horizon selection, model comparisons,
sector rankings, pagination, and training status without synthetic/mock data.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_screener_universe_coverage():
    """Verifies that all 106 discovered equities have genuine predictions."""
    resp = client.get("/api/v1/predictions/stocks?limit=10")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_count"] >= 106
    assert len(data["items"]) == 10
    assert data["total_pages"] >= 11

    summary = data["summary"]
    assert summary["total_supported"] >= 106
    assert summary["predictions_available"] >= 106
    assert summary["registered_models"] >= 1000
    assert summary["production_models"] >= 300
    assert summary["avg_directional_accuracy"] > 45.0


def test_sector_filtering():
    """Verifies server-side sector filtering across the universe."""
    resp = client.get("/api/v1/predictions/stocks?sector=IT")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_count"] == 13
    for item in data["items"]:
        assert item["sector"] == "IT"


def test_horizon_switching():
    """Verifies 1-Day, 5-Day, and 20-Day horizon predictions."""
    for h in [1, 5, 20]:
        resp = client.get(f"/api/v1/predictions/stocks?horizon={h}&limit=5")
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["horizon"] == h
            assert "predicted_price" in item
            assert "expected_return" in item
            assert item["current_price"] > 0
            assert item["predicted_price"] > 0


def test_stock_search_by_ticker_and_name():
    """Verifies search by symbol, company name, and sector."""
    # Search by ticker
    resp = client.get("/api/v1/predictions/stocks/search?q=TCS")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["symbol"] == "TCS"

    # Search by company name substring
    resp_name = client.get("/api/v1/predictions/stocks/search?q=Infosys")
    assert resp_name.status_code == 200
    assert resp_name.json()["items"][0]["symbol"] == "INFY"

    # Search by sector
    resp_sec = client.get("/api/v1/predictions/stocks/search?q=Banking")
    assert resp_sec.status_code == 200
    assert resp_sec.json()["total_count"] >= 10


def test_sorting_and_pagination():
    """Verifies expected return sorting and page slicing."""
    # Descending expected return
    resp_desc = client.get("/api/v1/predictions/stocks?sort=expected_return_desc&limit=5")
    assert resp_desc.status_code == 200
    items_desc = resp_desc.json()["items"]
    assert items_desc[0]["expected_return"] >= items_desc[1]["expected_return"]

    # Pagination page 2
    resp_p2 = client.get("/api/v1/predictions/stocks?page=2&limit=25")
    assert resp_p2.status_code == 200
    assert len(resp_p2.json()["items"]) == 25
    assert resp_p2.json()["items"][0]["rank"] == 26


def test_sector_performance_rankings():
    """Verifies sector-level aggregated performance calculations."""
    resp = client.get("/api/v1/predictions/sectors?horizon=1")
    assert resp.status_code == 200
    data = resp.json()
    assert "sectors" in data
    assert len(data["sectors"]) >= 10
    # Ensure sectors are sorted descending by avg_expected_return
    returns = [s["avg_expected_return"] for s in data["sectors"]]
    assert returns == sorted(returns, reverse=True)


def test_model_architecture_benchmarks():
    """Verifies candidate model comparison metrics."""
    resp = client.get("/api/v1/predictions/model-performance?horizon=1")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    model_names = [m["model_name"] for m in data["models"]]
    assert "XGBoost" in model_names
    assert "Random Forest" in model_names
    assert "Linear Regression" in model_names
    assert "Naive Baseline" in model_names


def test_stock_detail_and_candidate_comparison():
    """Verifies single stock detail and candidate models comparison across horizons."""
    resp = client.get("/api/v1/predictions/stocks/TCS")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["symbol"] == "TCS"
    assert "horizons" in detail
    assert "1" in detail["horizons"]
    assert "5" in detail["horizons"]
    assert "20" in detail["horizons"]

    resp_models = client.get("/api/v1/predictions/stocks/TCS/models")
    assert resp_models.status_code == 200
    m_data = resp_models.json()
    cands = m_data["horizons"]["1"]["candidate_models"]
    assert len(cands) >= 4
    prod_candidates = [c for c in cands if c["is_production"]]
    assert len(prod_candidates) == 1


def test_training_pipeline_status():
    """Verifies training governance status endpoint."""
    resp = client.get("/api/v1/training/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_discovered"] == 106
    assert data["completed"] == 106
    assert data["insufficient_data"] == 0
    assert data["registered_models"] >= 1000
    assert data["production_models"] >= 300
    assert data["status"] == "COMPLETED"


def test_insufficient_or_missing_stock_handling():
    """Verifies clean 404 message when a stock has no model or insufficient data."""
    resp = client.get("/api/v1/predictions/stocks/UNKNOWN_EQUITY_XYZ")
    assert resp.status_code == 404
    assert "No verified prediction or registered production model found" in resp.json()["detail"]
