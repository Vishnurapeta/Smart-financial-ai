"""Unified Categorization Pipeline: Entity Extraction + ML Classifier + Rule Fallback."""

from datetime import datetime
from typing import Dict, Any, Optional
from app.ml.preprocessor import clean_text
from app.ml.extractor import (
    extract_amount_and_currency,
    is_amount_approximate,
    extract_transaction_type,
    extract_date,
    extract_merchant,
    FORBIDDEN_MERCHANT_WORDS,
)
from app.ml.classifier import classifier
from app.ml.fallback import lookup_merchant_rule, CATEGORY_NAMES

CONFIDENCE_THRESHOLD = 0.75


class CategorizationPipeline:
    """End-to-end financial transaction categorization pipeline."""

    def __init__(self, confidence_threshold: float = CONFIDENCE_THRESHOLD):
        self.confidence_threshold = confidence_threshold

    def process(
        self,
        text: str,
        reference_date: Optional[datetime] = None,
        default_currency: str = "INR",
    ) -> Dict[str, Any]:
        """Parse natural language transaction input and return structured categorization payload."""
        raw_text = text.strip() if isinstance(text, str) else ""
        lower = raw_text.lower()

        # 1. Entity Extraction
        amount, currency = extract_amount_and_currency(raw_text, default_currency=default_currency)
        is_approx = is_amount_approximate(raw_text)
        transaction_type = extract_transaction_type(raw_text)
        date_obj = extract_date(raw_text, reference_date)
        extracted_merchant = extract_merchant(raw_text)

        # 2. Rule-Based Fallback Lookup
        rule_match = lookup_merchant_rule(raw_text)

        # 3. Machine Learning Inference
        ml_category, ml_confidence = classifier.predict(raw_text)

        # 4. Hybrid Decision Engine
        source = "ml_model"
        final_category = ml_category
        final_confidence = ml_confidence
        subcategory = "General"

        if rule_match:
            rule_cat, rule_subcat, rule_conf = rule_match
            subcategory = rule_subcat

            if ml_category == rule_cat:
                # Both ML and Rule agree: Boost confidence
                final_confidence = max(ml_confidence, rule_conf, 0.98)
                source = "rule_verified_ml"
                final_category = rule_cat
            elif ml_confidence < 0.85:
                # Rule takes precedence when ML is less certain or discordant
                final_category = rule_cat
                final_confidence = rule_conf
                source = "merchant_rule_override"
            else:
                source = "ml_model"
        else:
            # Set sensible subcategories based on standard category taxonomy
            default_subcats = {
                "dining-restaurants": "Restaurant & Dining",
                "groceries": "Groceries",
                "transportation-fuel": "Transit & Fuel",
                "utilities-bills": "Utility Bills",
                "subscriptions-software": "Subscriptions",
                "shopping-retail": "Retail Shopping",
                "healthcare-medical": "Healthcare",
                "entertainment-leisure": "Entertainment",
                "housing-rent": "Rent & Housing",
                "travel-vacation": "Travel",
                "education-learning": "Education",
                "salary-wages": "Paycheck",
                "investment-income": "Investment Returns",
            }
            subcategory = default_subcats.get(final_category, "General")

        # 5. Validation & Sanitization Layer
        # Reject invalid merchant names (e.g. modifier words like 'around', 'about', or empty)
        if (
            not extracted_merchant
            or extracted_merchant.lower() in FORBIDDEN_MERCHANT_WORDS
            or len(extracted_merchant.strip()) < 2
        ):
            # Derive contextual merchant from category and content
            if final_category == "entertainment-leisure":
                if any(w in lower for w in ["movie", "cinema", "theatre", "theater", "film"]):
                    extracted_merchant = "Movie / Cinema"
                elif any(
                    w in lower for w in ["game", "gaming", "steam", "playstation", "xbox", "nintendo"]
                ):
                    extracted_merchant = "Game"
                else:
                    extracted_merchant = "Entertainment"
            elif final_category == "dining-restaurants":
                if any(w in lower for w in ["swiggy", "zomato", "doordash", "delivery"]):
                    extracted_merchant = "Food Delivery"
                else:
                    extracted_merchant = "Restaurant"
            elif final_category == "groceries":
                extracted_merchant = "Groceries"
            elif final_category == "utilities-bills":
                if "electric" in lower:
                    extracted_merchant = "Electricity Provider"
                elif "water" in lower:
                    extracted_merchant = "Water Utility"
                elif "gas" in lower:
                    extracted_merchant = "Gas Utility"
                elif any(w in lower for w in ["internet", "wifi", "broadband"]):
                    extracted_merchant = "Internet Provider"
                else:
                    extracted_merchant = "Utility Provider"
            elif transaction_type == "INCOME" or final_category == "salary-wages":
                extracted_merchant = "Employer"
            elif final_category == "transportation-fuel":
                extracted_merchant = "Transit Provider"
            elif final_category == "subscriptions-software":
                extracted_merchant = "Subscription Service"
            else:
                extracted_merchant = "General Merchant"

        # 6. Field-Level Confidence Calculation
        has_amount = amount is not None and amount > 0
        has_clear_merchant = extracted_merchant and extracted_merchant not in (
            "General Merchant",
            "Entertainment",
        )

        # When semantic rule matched and amount is valid, overall confidence is high (90%+)
        if rule_match and has_amount:
            final_confidence = max(final_confidence, 0.94)
        elif has_amount and ml_confidence >= 0.70:
            final_confidence = max(final_confidence, 0.88)

        field_confidence = {
            "type": (
                0.99
                if transaction_type == "INCOME"
                or any(w in lower for w in ["spent", "paid", "bought", "cost", "for"])
                else 0.95
            ),
            "amount": 0.99 if has_amount else 0.0,
            "currency": 0.99,
            "merchant": 0.98 if has_clear_merchant else 0.85,
            "category": round(final_confidence, 4),
            "subcategory": 0.96,
            "date": 0.99,
        }

        confidence_level = (
            "HIGH" if final_confidence >= 0.85 else ("MEDIUM" if final_confidence >= 0.70 else "LOW")
        )

        # 7. Safety Gate: Require explicit user confirmation if confidence is below threshold or amount missing
        requires_confirmation = (
            final_confidence < self.confidence_threshold or amount is None or amount <= 0
        )

        explanation = None
        if amount is None or amount <= 0:
            explanation = "Transaction amount could not be detected. Please verify or enter the amount."
        elif requires_confirmation:
            explanation = (
                "The ML model detected lower confidence. Please review the details below before adding to your ledger."
            )

        category_display_name = CATEGORY_NAMES.get(
            final_category, final_category.replace("-", " ").title()
        )

        return {
            "raw_text": raw_text,
            "amount": amount,
            "currency": currency,
            "merchant": extracted_merchant,
            "category": final_category,
            "category_name": category_display_name,
            "subcategory": subcategory,
            "transaction_type": transaction_type,
            "date": date_obj.isoformat(),
            "confidence": round(final_confidence, 4),
            "confidence_level": confidence_level,
            "is_approximate": is_approx,
            "field_confidence": field_confidence,
            "requires_confirmation": requires_confirmation,
            "source": source,
            "model_version": classifier.metadata.get("version", "1.0.0"),
            "explanation": explanation,
        }


# Global singleton pipeline instance
pipeline = CategorizationPipeline()

