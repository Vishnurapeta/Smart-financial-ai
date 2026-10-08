"""
Comprehensive unit and integration tests for Financial Anomaly Detection subsystem.
Covers feature extraction, causality (temporal leakage prevention), statistical baselines,
Isolation Forest ML detector, hybrid ensembling, and FastAPI endpoint contracts.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.anomalies import (
    AnomalyDetectionRequest,
    AnomalyType,
    TransactionInputItem,
)
from app.anomalies.feature_extractor import AnomalyFeatureExtractor
from app.anomalies.statistical_detector import StatisticalAnomalyDetector
from app.anomalies.isolation_forest_detector import IsolationForestAnomalyDetector
from app.anomalies.engine import AnomalyDetectionEngine


@pytest.fixture
def client():
    return TestClient(app)


def build_sample_transactions(n=20, spike_amount=None, spike_idx=15, spike_cat=None):
    """Generates synthetic sequence of transactions with steady baseline and optional spike."""
    txs = []
    base_amount = 50.0
    for i in range(n):
        # Day i in 2026
        day = (i % 28) + 1
        month = (i // 28) + 1
        dt_str = f"2026-{month:02d}-{day:02d}T12:00:00Z"
        
        amt = base_amount + (i % 5) * 5.0  # amounts between 50 and 70
        cat = "Food" if i % 2 == 0 else "Transport"
        merch = "Cafe Central" if i % 2 == 0 else "Metro City"

        if i == spike_idx and spike_amount is not None:
            amt = spike_amount
            if spike_cat:
                cat = spike_cat

        txs.append(
            TransactionInputItem(
                id=f"tx_{i+1}",
                date=dt_str,
                amount=amt,
                currency="USD",
                merchant=merch,
                category=cat,
                type="EXPENSE",
                is_recurring=False,
            )
        )
    return txs


# 1. Data Cleaning and Transfer Exclusion Tests
def test_clean_and_sort_transactions():
    txs = [
        TransactionInputItem(
            id="t1", date="2026-03-05T10:00:00Z", amount=100.0,
            currency="USD", merchant="Bank", category="Transfer", type="TRANSFER"
        ),
        TransactionInputItem(
            id="t2", date="2026-03-02T10:00:00Z", amount=-50.0,
            currency="USD", merchant="Bad", category="Refund", type="EXPENSE"
        ),
        TransactionInputItem(
            id="t3", date="2026-03-04T10:00:00Z", amount=45.0,
            currency="USD", merchant="Coffee", category="Food", type="EXPENSE"
        ),
        TransactionInputItem(
            id="t4", date="2026-03-01T10:00:00Z", amount=25.0,
            currency="USD", merchant="Bookstore", category="Books", type="EXPENSE"
        ),
    ]
    cleaned = AnomalyFeatureExtractor.clean_and_sort_transactions(txs)
    # Transfer and negative amount should be excluded
    assert len(cleaned) == 2
    assert cleaned[0].id == "t4"  # March 01
    assert cleaned[1].id == "t3"  # March 04


# 2. Temporal Causality (No Leakage) Test
def test_temporal_causality_zero_leakage():
    # If transaction 10 is huge ($10,000), transaction 5 should NOT have its median shifted by tx 10
    txs = build_sample_transactions(n=15, spike_amount=10000.0, spike_idx=12)
    enriched = AnomalyFeatureExtractor.compute_causal_features(txs)

    # For transaction 10, the prior history only includes tx 0..9 (amounts 50-70)
    tx10_ctx = enriched[10]["context"]
    assert tx10_ctx["user_median"] < 80.0
    assert tx10_ctx["prior_history_count"] == 10

    # For transaction 13 (after the spike at 12), the history now includes the spike
    tx13_ctx = enriched[13]["context"]
    assert tx13_ctx["prior_history_count"] == 13


# 3. Robust Modified Z-Score Tests
def test_modified_z_score():
    # Normal inlier
    z_norm = AnomalyFeatureExtractor.calculate_modified_z_score(55.0, 50.0, 5.0)
    assert z_norm < 1.0

    # Extreme outlier
    z_extreme = AnomalyFeatureExtractor.calculate_modified_z_score(500.0, 50.0, 5.0)
    assert z_extreme > 10.0

    # Zero MAD handling
    z_zero_mad = AnomalyFeatureExtractor.calculate_modified_z_score(150.0, 50.0, 0.0)
    assert z_zero_mad > 0.0


# 4. Cold Start / Insufficient History
def test_insufficient_history():
    engine = AnomalyDetectionEngine()
    short_txs = build_sample_transactions(n=3)
    req = AnomalyDetectionRequest(
        user_id="user_cold_start",
        transactions=short_txs,
        min_history_count=5,
    )
    res = engine.detect_anomalies(req)
    assert res.status == "insufficient_data"
    assert res.anomalies_detected == 0
    assert "Insufficient transaction history" in res.message


# 5. Amount Anomaly Detection
def test_amount_anomaly_detection():
    engine = AnomalyDetectionEngine()
    # Baseline spending is 50-70, sudden spike of 2,500 at index 14
    txs = build_sample_transactions(n=18, spike_amount=2500.0, spike_idx=14)
    req = AnomalyDetectionRequest(
        user_id="user_test_amount",
        transactions=txs,
        min_history_count=5,
    )
    res = engine.detect_anomalies(req)
    assert res.status == "success"
    assert res.anomalies_detected >= 1

    # Check the spiked transaction
    spiked_anomalies = [a for a in res.anomalies if a.transaction_id == "tx_15"]
    assert len(spiked_anomalies) == 1
    anom = spiked_anomalies[0]
    assert anom.amount == 2500.0
    assert anom.anomaly_score >= 0.70
    assert any(cf.feature == "user_amount_deviation" or cf.feature == "category_amount_deviation" for cf in anom.contributing_features)
    # Ensure no fraud claims
    assert "fraud" not in anom.reason.lower()
    assert "scam" not in anom.reason.lower()


# 6. Merchant Frequency / Burst Anomaly
def test_merchant_burst_anomaly():
    # 5 transactions at "Rapid Store" within 24 hours
    txs = build_sample_transactions(n=10)
    for k in range(5):
        txs.append(
            TransactionInputItem(
                id=f"burst_{k+1}",
                date=f"2026-03-20T1{k}:00:00Z",
                amount=45.0,
                currency="USD",
                merchant="Rapid Store",
                category="Shopping",
                type="EXPENSE",
            )
        )
    engine = AnomalyDetectionEngine()
    req = AnomalyDetectionRequest(
        user_id="user_burst_test",
        transactions=txs,
        min_history_count=5,
    )
    res = engine.detect_anomalies(req)
    assert res.status == "success"
    # The later burst transactions should be flagged with frequency anomaly
    burst_flags = [a for a in res.anomalies if a.anomaly_type == AnomalyType.FREQUENCY_ANOMALY]
    assert len(burst_flags) >= 1
    assert "frequency" in burst_flags[0].reason.lower()


# 7. Isolation Forest Detector Directly
def test_isolation_forest_detector():
    txs = build_sample_transactions(n=25, spike_amount=3500.0, spike_idx=20)
    enriched = AnomalyFeatureExtractor.compute_causal_features(txs)
    if_detector = IsolationForestAnomalyDetector(n_estimators=50, contamination=0.05, random_state=42)
    scored = if_detector.fit_and_score(enriched, min_samples=10)
    assert len(scored) == len(enriched)

    # Check spiked record
    spiked_rec, spiked_item = scored[20]
    assert spiked_rec["transaction"].id == "tx_21"
    # Spiked record should have a high normalized anomaly score
    if spiked_item:
        assert spiked_item.anomaly_score >= 0.60
        assert spiked_item.detector_type == "ISOLATION_FOREST"


# 8. FastAPI Endpoints Integration
def test_fastapi_detect_endpoint(client):
    txs = build_sample_transactions(n=16, spike_amount=1800.0, spike_idx=12)
    payload = {
        "user_id": "test_user_api",
        "transactions": [tx.model_dump() for tx in txs],
        "lookback_days": 90,
        "min_history_count": 5,
    }
    response = client.post("/api/v1/anomalies/detect", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["user_id"] == "test_user_api"
    assert data["total_evaluated"] == 16
    assert data["anomalies_detected"] >= 1
    # Check disclaimer contains no fraud claim
    assert "fraud" in data["disclaimer"].lower()
    assert "does not establish fraud" in data["disclaimer"].lower()


def test_fastapi_detector_info(client):
    response = client.get("/api/v1/anomalies/info")
    assert response.status_code == 200
    data = response.json()
    assert data["detector_name"] == "SmartFin Hybrid Anomaly Detector"
    assert "thresholds" in data
    assert data["thresholds"]["high"] == 0.85
