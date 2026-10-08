"""Tests for Recurring Expense & Subscription Intelligence in Python ML Service."""

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.ml.recurring_detector import detect_recurring_patterns

client = TestClient(app)


def test_detect_monthly_subscription():
    """Detect regular monthly subscription payments (e.g. Netflix $15.99)."""
    base_date = datetime(2026, 1, 15)
    txs = [
        {
            "merchant": "Netflix",
            "amount": 15.99,
            "date": (base_date + timedelta(days=0)).isoformat(),
            "category": "Entertainment",
            "type": "EXPENSE",
        },
        {
            "merchant": "Netflix Inc",
            "amount": 15.99,
            "date": (base_date + timedelta(days=30)).isoformat(),
            "category": "Entertainment",
            "type": "EXPENSE",
        },
        {
            "merchant": "Netflix.com",
            "amount": 15.99,
            "date": (base_date + timedelta(days=60)).isoformat(),
            "category": "Entertainment",
            "type": "EXPENSE",
        },
        {
            "merchant": "Netflix",
            "amount": 15.99,
            "date": (base_date + timedelta(days=90)).isoformat(),
            "category": "Entertainment",
            "type": "EXPENSE",
        },
    ]

    ref_date = datetime(2026, 4, 20)
    detected = detect_recurring_patterns(txs, reference_date=ref_date)

    assert len(detected) == 1
    netflix = detected[0]
    assert netflix["frequency"] == "MONTHLY"
    assert netflix["recurringType"] == "SUBSCRIPTION"
    assert netflix["expectedAmount"] == 15.99
    assert netflix["confidence"] >= 0.85
    assert netflix["isActive"] is True
    assert netflix["isPossiblyInactive"] is False


def test_detect_weekly_recurring_expense():
    """Detect regular weekly recurring expenses (e.g. Weekly Whole Foods Groceries)."""
    base_date = datetime(2026, 3, 1)
    txs = [
        {
            "merchant": "Whole Foods Market",
            "amount": 85.0,
            "date": (base_date + timedelta(days=0)).isoformat(),
            "category": "Groceries",
            "type": "EXPENSE",
        },
        {
            "merchant": "Whole Foods Market",
            "amount": 88.0,
            "date": (base_date + timedelta(days=7)).isoformat(),
            "category": "Groceries",
            "type": "EXPENSE",
        },
        {
            "merchant": "Whole Foods Market",
            "amount": 84.5,
            "date": (base_date + timedelta(days=14)).isoformat(),
            "category": "Groceries",
            "type": "EXPENSE",
        },
        {
            "merchant": "Whole Foods Market",
            "amount": 86.0,
            "date": (base_date + timedelta(days=21)).isoformat(),
            "category": "Groceries",
            "type": "EXPENSE",
        },
    ]

    ref_date = datetime(2026, 3, 25)
    detected = detect_recurring_patterns(txs, reference_date=ref_date)

    assert len(detected) == 1
    groceries = detected[0]
    assert groceries["frequency"] == "WEEKLY"
    assert groceries["intervalDays"] == 7
    assert groceries["confidence"] >= 0.80


def test_detect_emi_recurring_payment():
    """Detect fixed high-value monthly loan/EMI repayments."""
    base_date = datetime(2026, 1, 5)
    txs = [
        {
            "merchant": "HDFC Bank Car Loan EMI",
            "amount": 14500.0,
            "date": (base_date + timedelta(days=0)).isoformat(),
            "category": "Loans",
            "type": "EXPENSE",
        },
        {
            "merchant": "HDFC Bank Car Loan EMI",
            "amount": 14500.0,
            "date": (base_date + timedelta(days=31)).isoformat(),
            "category": "Loans",
            "type": "EXPENSE",
        },
        {
            "merchant": "HDFC Bank Car Loan EMI",
            "amount": 14500.0,
            "date": (base_date + timedelta(days=61)).isoformat(),
            "category": "Loans",
            "type": "EXPENSE",
        },
    ]

    ref_date = datetime(2026, 3, 10)
    detected = detect_recurring_patterns(txs, reference_date=ref_date)

    assert len(detected) == 1
    emi = detected[0]
    assert emi["frequency"] == "MONTHLY"
    assert emi["recurringType"] == "EMI"
    assert emi["expectedAmount"] == 14500.0
    assert emi["confidence"] >= 0.85


def test_detect_utility_recurring_with_amount_variance():
    """Detect utility payments that occur monthly but fluctuate in amount."""
    base_date = datetime(2026, 1, 10)
    txs = [
        {
            "merchant": "BESCOM Electricity Bill",
            "amount": 1250.0,
            "date": (base_date + timedelta(days=0)).isoformat(),
            "category": "Utilities",
            "type": "EXPENSE",
        },
        {
            "merchant": "BESCOM Electricity Bill",
            "amount": 1420.0,
            "date": (base_date + timedelta(days=30)).isoformat(),
            "category": "Utilities",
            "type": "EXPENSE",
        },
        {
            "merchant": "BESCOM Electricity Bill",
            "amount": 1180.0,
            "date": (base_date + timedelta(days=60)).isoformat(),
            "category": "Utilities",
            "type": "EXPENSE",
        },
    ]

    ref_date = datetime(2026, 3, 15)
    detected = detect_recurring_patterns(txs, reference_date=ref_date)

    assert len(detected) == 1
    utility = detected[0]
    assert utility["frequency"] == "MONTHLY"
    assert utility["recurringType"] == "UTILITY"
    assert utility["confidence"] >= 0.70


def test_flag_possibly_inactive_subscription_based_on_evidence():
    """Flag subscriptions as possibly inactive when expected interval has elapsed."""
    base_date = datetime(2026, 1, 1)
    txs = [
        {
            "merchant": "Spotify India",
            "amount": 119.0,
            "date": (base_date + timedelta(days=0)).isoformat(),
            "category": "Subscriptions",
            "type": "EXPENSE",
        },
        {
            "merchant": "Spotify India",
            "amount": 119.0,
            "date": (base_date + timedelta(days=30)).isoformat(),
            "category": "Subscriptions",
            "type": "EXPENSE",
        },
    ]

    ref_date = base_date + timedelta(days=30 + 65)
    detected = detect_recurring_patterns(txs, reference_date=ref_date)

    assert len(detected) == 1
    spotify = detected[0]
    assert spotify["isPossiblyInactive"] is True
    assert spotify["isActive"] is False
    assert spotify["inactivityEvidence"] is not None
    assert "No transaction detected for" in spotify["inactivityEvidence"]


def test_api_recurring_detect_endpoint():
    """Test the FastAPI /api/v1/ml/recurring-detect endpoint."""
    base_date = datetime(2026, 1, 1)
    payload = {
        "transactions": [
            {
                "merchant": "Gym Membership",
                "amount": 50.0,
                "date": (base_date + timedelta(days=0)).isoformat(),
                "category": "Fitness",
                "type": "EXPENSE",
            },
            {
                "merchant": "Gym Membership",
                "amount": 50.0,
                "date": (base_date + timedelta(days=30)).isoformat(),
                "category": "Fitness",
                "type": "EXPENSE",
            },
            {
                "merchant": "Gym Membership",
                "amount": 50.0,
                "date": (base_date + timedelta(days=60)).isoformat(),
                "category": "Fitness",
                "type": "EXPENSE",
            },
        ],
        "reference_date": datetime(2026, 3, 5).isoformat(),
    }

    res = client.post("/api/v1/ml/recurring-detect", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["total_detected"] == 1
    pattern = data["patterns"][0]
    assert pattern["merchant"] == "Gym Membership"
    assert pattern["frequency"] == "MONTHLY"
    assert pattern["recurringType"] == "SUBSCRIPTION"
    assert pattern["expectedAmount"] == 50.0


def test_uber_discretionary_rides_excluded():
    """Verify discretionary ride-sharing like Uber is never classified as recurring subscription."""
    base_date = datetime(2026, 9, 27)
    txs = [
        {"merchant": "Uber", "amount": 42.5, "date": base_date.isoformat(), "category": "Transport", "type": "EXPENSE"},
        {"merchant": "Uber", "amount": 42.5, "date": (base_date + timedelta(days=8)).isoformat(), "category": "Transport", "type": "EXPENSE"},
    ]
    detected = detect_recurring_patterns(txs)
    assert len(detected) == 0


def test_single_hotstar_possible_recurring():
    """Verify single transaction for known streaming service is detected as POSSIBLE recurring."""
    txs = [
        {"merchant": "Hotstar", "amount": 600.0, "currency": "INR", "date": datetime(2026, 10, 6).isoformat(), "category": "Subscriptions", "type": "EXPENSE"}
    ]
    detected = detect_recurring_patterns(txs)
    assert len(detected) == 1
    hotstar = detected[0]
    assert hotstar["merchant"] == "Hotstar"
    assert hotstar["tier"] == "POSSIBLE"
    assert hotstar["confidenceLevel"] == "LOW"
    assert hotstar["expectedAmount"] == 600.0
    assert hotstar["currency"] == "INR"


def test_netflix_anchored_to_latest_payment():
    """Verify next expected date is calculated strictly from the latest payment date."""
    txs = [
        {"merchant": "Netflix", "amount": 649.0, "currency": "INR", "date": "2026-08-05T10:00:00Z", "type": "EXPENSE"},
        {"merchant": "Netflix", "amount": 649.0, "currency": "INR", "date": "2026-09-05T10:00:00Z", "type": "EXPENSE"},
        {"merchant": "Netflix", "amount": 649.0, "currency": "INR", "date": "2026-10-05T10:00:00Z", "type": "EXPENSE"},
    ]
    detected = detect_recurring_patterns(txs)
    assert len(detected) == 1
    netflix = detected[0]
    assert netflix["tier"] == "CONFIRMED"
    assert netflix["frequency"] == "MONTHLY"
    assert netflix["expectedAmount"] == 649.0
    assert "2026-10-05" in netflix["lastTransactionDate"]
    assert "2026-11-04" in netflix["nextExpectedDate"] or "2026-11-05" in netflix["nextExpectedDate"]

