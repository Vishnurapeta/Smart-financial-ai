"""Tests for ML-powered natural-language transaction categorization."""

from fastapi.testclient import TestClient
from app.main import app
from app.ml.preprocessor import clean_text
from app.ml.extractor import extract_amount_and_currency, extract_transaction_type, extract_merchant
from app.ml.pipeline import pipeline

client = TestClient(app)


def test_text_cleaning():
    raw = "Spent ₹750 at Swiggy for dinner!!"
    cleaned = clean_text(raw)
    assert "750" not in cleaned
    assert "₹" not in cleaned
    assert "swiggy" in cleaned
    assert "dinner" in cleaned

    # Non-string and empty inputs should not crash
    assert clean_text(None) == ""
    assert clean_text("") == ""
    assert clean_text("   ") == ""


def test_entity_extraction():
    amount, currency = extract_amount_and_currency("Spent ₹750 at Swiggy")
    assert amount == 750.0
    assert currency == "INR"

    amount2, currency2 = extract_amount_and_currency("I spent 800 on dinner at Zomato yesterday")
    assert amount2 == 800.0
    assert currency2 == "INR" or currency2 == "USD"

    amount3, currency3 = extract_amount_and_currency("Paid $15.99 for Netflix")
    assert amount3 == 15.99
    assert currency3 == "USD"

    # 50,000 with comma formatting
    amount4, currency4 = extract_amount_and_currency("Received salary ₹50,000")
    assert amount4 == 50000.0
    assert currency4 == "INR"

    merchant = extract_merchant("Spent ₹750 at Swiggy")
    assert merchant == "Swiggy"

    merchant2 = extract_merchant("Dinner at Zomato yesterday")
    assert merchant2 == "Zomato"

    txn_type = extract_transaction_type("Salary credited 95000 from Google")
    assert txn_type == "INCOME"

    txn_type2 = extract_transaction_type("Paid 500 for coffee")
    assert txn_type2 == "EXPENSE"


def test_pipeline_swiggy_example():
    # User prompt example: "Spent ₹750 at Swiggy"
    result = pipeline.process("Spent ₹750 at Swiggy")

    assert result["amount"] == 750.0
    assert result["merchant"] == "Swiggy"
    assert result["category"] == "dining-restaurants"
    assert result["category_name"] == "Dining & Restaurants"
    assert result["subcategory"] == "Food Delivery"
    assert result["transaction_type"] == "EXPENSE"
    assert result["confidence"] >= 0.80
    assert result["requires_confirmation"] is False


def test_pipeline_netflix_inr_example():
    # User prompt: "Monthly Netflix subscription ₹649"
    result = pipeline.process("Monthly Netflix subscription ₹649")

    assert result["amount"] == 649.0
    assert result["currency"] == "INR"
    assert result["merchant"] == "Netflix"
    assert result["category"] == "subscriptions-software"
    assert result["category_name"] == "Subscriptions & Software"
    assert result["subcategory"] == "Streaming Entertainment"
    assert result["transaction_type"] == "EXPENSE"
    assert result["confidence"] >= 0.80
    assert result["requires_confirmation"] is False


def test_pipeline_netflix_usd_example():
    # User prompt: "Netflix subscription $15"
    result = pipeline.process("Netflix subscription $15")

    assert result["amount"] == 15.0
    assert result["currency"] == "USD"
    assert result["merchant"] == "Netflix"
    assert result["category"] == "subscriptions-software"
    assert result["transaction_type"] == "EXPENSE"


def test_pipeline_received_salary_example():
    # User prompt: "Received salary ₹50,000"
    result = pipeline.process("Received salary ₹50,000")

    assert result["amount"] == 50000.0
    assert result["currency"] == "INR"
    assert result["merchant"] == "Employer"
    assert result["category"] == "salary-wages"
    assert result["transaction_type"] == "INCOME"


def test_pipeline_uber_ride_example():
    # User prompt: "Uber ride ₹350"
    result = pipeline.process("Uber ride ₹350")

    assert result["amount"] == 350.0
    assert result["currency"] == "INR"
    assert result["merchant"] == "Uber"
    assert result["category"] == "transportation-fuel"
    assert result["transaction_type"] == "EXPENSE"


def test_low_confidence_and_missing_amount():
    # Ambiguous input without amount
    result = pipeline.process("random unknown transaction without merchant")

    assert result["requires_confirmation"] is True
    assert result["amount"] is None
    assert result["explanation"] is not None
    assert "amount could not be detected" in result["explanation"].lower()


def test_api_categorize_endpoint_success():
    response = client.post("/categorize", json={"text": "Monthly Netflix subscription ₹649"})
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["amount"] == 649.0
    assert data["currency"] == "INR"
    assert data["merchant"] == "Netflix"
    assert data["category"] == "subscriptions-software"
    assert data["requires_confirmation"] is False


def test_api_categorize_empty_input_validation():
    # Empty string
    res_empty = client.post("/categorize", json={"text": ""})
    assert res_empty.status_code in [400, 422]

    # Whitespace-only string
    res_ws = client.post("/categorize", json={"text": "   "})
    assert res_ws.status_code in [400, 422]


def test_user_requested_movie_around_prompt():
    # Primary user bug prompt: "Today I spent around ₹1,000 on a movie"
    res = client.post("/categorize", json={"text": "Today I spent around ₹1,000 on a movie"})
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["amount"] == 1000.0
    assert data["currency"] == "INR"
    assert data["merchant"] in ["Movie / Cinema", "Cinema", "Movie"]
    assert data["merchant"].lower() != "around"
    assert data["category"] == "entertainment-leisure"
    assert data["category_name"] == "Entertainment & Leisure"
    assert "movie" in data["subcategory"].lower() or "cinema" in data["subcategory"].lower()
    assert data["transaction_type"] == "EXPENSE"
    assert data["confidence"] >= 0.90
    assert data["confidence_level"] == "HIGH"
    assert data["is_approximate"] is True


def test_user_requested_test_cases_suite():
    cases = [
        (
            "Today I spent around ₹1,000 on a movie",
            1000.0,
            "EXPENSE",
            "entertainment-leisure",
            ["Movie / Cinema", "Cinema", "Movie"],
        ),
        (
            "I spent ₹800 on dinner at Zomato yesterday",
            800.0,
            "EXPENSE",
            "dining-restaurants",
            ["Zomato"],
        ),
        (
            "Spent ₹750 at Swiggy",
            750.0,
            "EXPENSE",
            "dining-restaurants",
            ["Swiggy"],
        ),
        (
            "I paid ₹500 for an Uber ride",
            500.0,
            "EXPENSE",
            "transportation-fuel",
            ["Uber"],
        ),
        (
            "I spent ₹300 at PVR",
            300.0,
            "EXPENSE",
            "entertainment-leisure",
            ["PVR"],
        ),
        (
            "Paid approximately ₹2,000 for groceries",
            2000.0,
            "EXPENSE",
            "groceries",
            ["Groceries"],
        ),
        (
            "Netflix subscription ₹649",
            649.0,
            "EXPENSE",
            "subscriptions-software",
            ["Netflix"],
        ),
        (
            "I paid ₹1500 electricity bill",
            1500.0,
            "EXPENSE",
            "utilities-bills",
            ["Electricity Provider", "Electricity"],
        ),
        (
            "I spent about ₹500 on a game",
            500.0,
            "EXPENSE",
            "entertainment-leisure",
            ["Game"],
        ),
        (
            "Received ₹20,000 salary today",
            20000.0,
            "INCOME",
            "salary-wages",
            ["Employer", "Salary"],
        ),
    ]

    for text, exp_amount, exp_type, exp_cat, valid_merchants in cases:
        r = pipeline.process(text)
        assert r["amount"] == exp_amount, f"Amount failed for {text}: {r['amount']} != {exp_amount}"
        assert r["transaction_type"] == exp_type, f"Type failed for {text}"
        assert r["category"] == exp_cat, f"Category failed for {text}: {r['category']} != {exp_cat}"
        assert r["merchant"] in valid_merchants or any(vm.lower() in r["merchant"].lower() for vm in valid_merchants), (
            f"Merchant failed for {text}: got '{r['merchant']}'"
        )
        assert r["merchant"].lower() not in ["around", "about", "approximately", "spent", "paid"]
        assert r["confidence"] >= 0.85, f"Confidence too low for {text}: {r['confidence']}"
