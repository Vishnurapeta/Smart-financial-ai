"""
Temporal Feature Extractor for Financial Anomaly Detection.
Strictly ensures zero future information leaks into historical baseline statistics.
"""
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import numpy as np
from app.schemas.anomalies import TransactionInputItem


class AnomalyFeatureExtractor:
    """
    Extracts personalized, causally-sound features for each transaction.
    """

    FEATURE_NAMES = [
        "amount",
        "log_amount",
        "user_amount_deviation",
        "category_amount_deviation",
        "merchant_amount_deviation",
        "merchant_frequency",
        "recent_3d_tx_count",
        "recent_3d_merchant_count",
        "days_since_last_tx",
    ]

    @classmethod
    def parse_iso_date(cls, date_str: str) -> datetime:
        try:
            # Handle ISO formats with or without Z
            cleaned = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(cleaned)
        except Exception:
            # Fallback to current timestamp if parsing fails
            return datetime.now()

    @classmethod
    def clean_and_sort_transactions(
        cls, transactions: List[TransactionInputItem]
    ) -> List[TransactionInputItem]:
        """
        Filters out non-expense/transfer records and sorts chronologically.
        """
        valid_txs = []
        for tx in transactions:
            # Exclude transfers to avoid flagging internal balance shifts
            if tx.type.upper() == "TRANSFER":
                continue
            # Amount must be strictly positive
            if tx.amount <= 0:
                continue
            valid_txs.append(tx)

        # Sort chronologically by date
        valid_txs.sort(key=lambda x: cls.parse_iso_date(x.date))
        return valid_txs

    @classmethod
    def calculate_modified_z_score(
        cls, val: float, median: float, mad: float
    ) -> float:
        """
        Calculates robust modified Z-score using Median Absolute Deviation.
        M_z = 0.6745 * |val - median| / (mad + eps)
        """
        eps = 1e-4
        if mad < eps:
            # When variance is zero or negligible, score based on relative ratio
            if median > 0:
                ratio = abs(val - median) / median
                return float(min(10.0, ratio * 2.0))
            return 0.0
        return float(0.6745 * abs(val - median) / (mad + eps))

    @classmethod
    def compute_causal_features(
        cls, transactions: List[TransactionInputItem]
    ) -> List[Dict[str, any]]:
        """
        Computes features for each transaction i strictly using past transactions 0 .. i-1.
        Returns a list of dictionaries containing features and historical context.
        """
        sorted_txs = cls.clean_and_sort_transactions(transactions)
        n = len(sorted_txs)
        enriched_records = []

        # Running history accumulators
        history_amounts: List[float] = []
        history_by_category: Dict[str, List[float]] = {}
        history_by_merchant: Dict[str, List[Tuple[datetime, float]]] = {}
        past_dates: List[datetime] = []

        for i, tx in enumerate(sorted_txs):
            tx_dt = cls.parse_iso_date(tx.date)
            amount = float(tx.amount)
            cat = tx.category.strip()
            merch = tx.merchant.strip().lower()

            # 1. User overall amount statistics from past transactions
            if len(history_amounts) >= 3:
                user_median = float(np.median(history_amounts))
                user_mad = float(np.median(np.abs(np.array(history_amounts) - user_median)))
                user_z = cls.calculate_modified_z_score(amount, user_median, user_mad)
            else:
                user_median = amount
                user_mad = 0.0
                user_z = 0.0

            # 2. Category specific statistics from past transactions
            cat_past = history_by_category.get(cat, [])
            if len(cat_past) >= 2:
                cat_median = float(np.median(cat_past))
                cat_mad = float(np.median(np.abs(np.array(cat_past) - cat_median)))
                cat_z = cls.calculate_modified_z_score(amount, cat_median, cat_mad)
            else:
                cat_median = user_median
                cat_mad = user_mad
                cat_z = user_z * 0.8  # Soft estimate when category history is new

            # 3. Merchant specific statistics from past transactions
            merch_past = history_by_merchant.get(merch, [])
            merch_amounts = [m[1] for m in merch_past]
            if len(merch_amounts) >= 2:
                merch_median = float(np.median(merch_amounts))
                merch_mad = float(np.median(np.abs(np.array(merch_amounts) - merch_median)))
                merch_z = cls.calculate_modified_z_score(amount, merch_median, merch_mad)
            else:
                merch_median = user_median
                merch_mad = user_mad
                merch_z = user_z * 0.7

            # 4. Merchant frequency and burst detection
            # Count transactions at this merchant in the past 3 days [tx_dt - 3 days, tx_dt)
            three_days_ago = tx_dt.timestamp() - (3 * 86400)
            recent_3d_merch_count = sum(
                1 for m in merch_past if m[0].timestamp() >= three_days_ago
            )

            # Count total user transactions in past 3 days
            recent_3d_tx_count = sum(
                1 for d in past_dates if d.timestamp() >= three_days_ago
            )

            # 5. Days since last transaction
            if past_dates:
                days_since_last = max(0.0, (tx_dt - past_dates[-1]).total_seconds() / 86400.0)
            else:
                days_since_last = 1.0

            feature_dict = {
                "amount": amount,
                "log_amount": float(np.log1p(amount)),
                "user_amount_deviation": round(user_z, 3),
                "category_amount_deviation": round(cat_z, 3),
                "merchant_amount_deviation": round(merch_z, 3),
                "merchant_frequency": len(merch_past),
                "recent_3d_tx_count": recent_3d_tx_count,
                "recent_3d_merchant_count": recent_3d_merch_count,
                "days_since_last_tx": round(days_since_last, 2),
            }

            feature_vector = [
                feature_dict[name] for name in cls.FEATURE_NAMES
            ]

            enriched_records.append({
                "transaction": tx,
                "index": i,
                "features": feature_dict,
                "feature_vector": feature_vector,
                "context": {
                    "user_median": round(user_median, 2),
                    "user_mad": round(user_mad, 2),
                    "cat_median": round(cat_median, 2),
                    "cat_history_count": len(cat_past),
                    "merch_median": round(merch_median, 2),
                    "merch_history_count": len(merch_past),
                    "prior_history_count": i,
                },
            })

            # Update running history accumulators strictly AFTER evaluating current transaction
            history_amounts.append(amount)
            history_by_category.setdefault(cat, []).append(amount)
            history_by_merchant.setdefault(merch, []).append((tx_dt, amount))
            past_dates.append(tx_dt)

        return enriched_records
