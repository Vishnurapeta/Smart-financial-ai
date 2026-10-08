"""
Statistical Baseline Anomaly Detector.
Uses robust statistics (Median + MAD / Modified Z-Score) for transparent and explainable anomaly detection.
"""
from typing import Dict, List, Optional, Tuple
from app.schemas.anomalies import (
    AnomalySeverity,
    AnomalyType,
    ContributingFeatureItem,
    DetectedAnomalyItem,
)


class StatisticalAnomalyDetector:
    """
    Statistical baseline detector using robust Modified Z-scores and category/merchant medians.
    """

    # Modified Z-score thresholds
    THRESHOLD_HIGH = 4.5
    THRESHOLD_MEDIUM = 3.2
    THRESHOLD_LOW = 2.5

    @classmethod
    def evaluate_record(
        cls, record: Dict[str, any], min_history: int = 5
    ) -> Optional[DetectedAnomalyItem]:
        """
        Evaluates a single enriched transaction record against statistical baselines.
        Returns DetectedAnomalyItem if anomalous, otherwise None.
        """
        tx = record["transaction"]
        feats = record["features"]
        ctx = record["context"]

        # If user has insufficient prior history, we cannot produce a reliable personalized baseline
        if ctx["prior_history_count"] < min_history:
            return None

        user_dev = feats["user_amount_deviation"]
        cat_dev = feats["category_amount_deviation"]
        merch_dev = feats["merchant_amount_deviation"]
        burst_merch = feats["recent_3d_merchant_count"]
        cat_history_count = ctx["cat_history_count"]
        merch_history_count = ctx["merch_history_count"]

        candidate_anomalies: List[Tuple[AnomalyType, float, str, List[ContributingFeatureItem]]] = []

        # 1. Category Anomaly check (if user has historical transactions in this category)
        if cat_history_count >= 2 and cat_dev >= cls.THRESHOLD_LOW:
            score = min(0.98, 0.50 + (cat_dev / 10.0) * 0.45)
            contrib = [
                ContributingFeatureItem(
                    feature="category_amount_deviation",
                    value=cat_dev,
                    impact="high" if cat_dev >= cls.THRESHOLD_MEDIUM else "medium",
                    description=(
                        f"Amount of {tx.currency} {tx.amount:,.2f} is significantly above your typical "
                        f"{tx.category} median of {tx.currency} {ctx['cat_median']:,.2f}."
                    ),
                )
            ]
            reason = (
                f"Spending in category '{tx.category}' differs significantly from your typical historical pattern "
                f"({tx.currency} {tx.amount:,.2f} vs typical median {tx.currency} {ctx['cat_median']:,.2f})."
            )
            candidate_anomalies.append((AnomalyType.CATEGORY_ANOMALY, score, reason, contrib))

        # 2. Merchant Anomaly check (if user has historical transactions with this merchant)
        if merch_history_count >= 2 and merch_dev >= cls.THRESHOLD_LOW:
            score = min(0.98, 0.50 + (merch_dev / 10.0) * 0.45)
            contrib = [
                ContributingFeatureItem(
                    feature="merchant_amount_deviation",
                    value=merch_dev,
                    impact="high" if merch_dev >= cls.THRESHOLD_MEDIUM else "medium",
                    description=(
                        f"Amount of {tx.currency} {tx.amount:,.2f} deviates from your typical spending at "
                        f"{tx.merchant} (historical median {tx.currency} {ctx['merch_median']:,.2f})."
                    ),
                )
            ]
            reason = (
                f"Transaction amount at {tx.merchant} is unusually higher than your historical median of "
                f"{tx.currency} {ctx['merch_median']:,.2f}."
            )
            candidate_anomalies.append((AnomalyType.MERCHANT_ANOMALY, score, reason, contrib))

        # 3. Overall Amount Anomaly check (User level)
        if user_dev >= cls.THRESHOLD_LOW:
            score = min(0.98, 0.50 + (user_dev / 10.0) * 0.45)
            contrib = [
                ContributingFeatureItem(
                    feature="user_amount_deviation",
                    value=user_dev,
                    impact="high" if user_dev >= cls.THRESHOLD_MEDIUM else "medium",
                    description=(
                        f"Amount of {tx.currency} {tx.amount:,.2f} is unusually high compared to your "
                        f"overall median transaction amount of {tx.currency} {ctx['user_median']:,.2f}."
                    ),
                )
            ]
            reason = (
                f"Transaction amount of {tx.currency} {tx.amount:,.2f} is significantly higher than your typical "
                f"spending pattern across all categories."
            )
            candidate_anomalies.append((AnomalyType.AMOUNT_ANOMALY, score, reason, contrib))

        # 4. Frequency / Burst Anomaly (e.g. 4+ transactions at the same merchant in 3 days)
        if burst_merch >= 4 and merch_history_count >= 1:
            score = min(0.95, 0.60 + (burst_merch / 10.0) * 0.35)
            contrib = [
                ContributingFeatureItem(
                    feature="recent_3d_merchant_count",
                    value=float(burst_merch),
                    impact="high",
                    description=f"{burst_merch} transactions recorded at {tx.merchant} within a 3-day window.",
                )
            ]
            reason = (
                f"Transaction frequency for {tx.merchant} is higher than your typical pattern "
                f"({burst_merch} transactions within 3 days)."
            )
            candidate_anomalies.append((AnomalyType.FREQUENCY_ANOMALY, score, reason, contrib))

        if not candidate_anomalies:
            return None

        # Select highest-scoring anomaly candidate
        candidate_anomalies.sort(key=lambda x: x[1], reverse=True)
        best_type, best_score, best_reason, best_contrib = candidate_anomalies[0]

        # Determine severity
        if best_score >= 0.85:
            severity = AnomalySeverity.HIGH
        elif best_score >= 0.70:
            severity = AnomalySeverity.MEDIUM
        else:
            severity = AnomalySeverity.LOW

        return DetectedAnomalyItem(
            transaction_id=tx.id,
            date=tx.date,
            amount=tx.amount,
            currency=tx.currency,
            merchant=tx.merchant,
            category=tx.category,
            anomaly_type=best_type,
            anomaly_score=round(best_score, 3),
            severity=severity,
            reason=best_reason,
            contributing_features=best_contrib,
            detector_type="STATISTICAL",
        )
