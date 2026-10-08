"""
Isolation Forest Machine Learning Anomaly Detector.
Trains an unsupervised tree ensemble on historical user transaction feature vectors.
"""
from typing import Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest
from app.schemas.anomalies import (
    AnomalySeverity,
    AnomalyType,
    ContributingFeatureItem,
    DetectedAnomalyItem,
)
from app.anomalies.feature_extractor import AnomalyFeatureExtractor


class IsolationForestAnomalyDetector:
    """
    Isolation Forest anomaly detector that isolates feature outliers in multi-dimensional space.
    """

    def __init__(
        self,
        n_estimators: int = 100,
        contamination: float = 0.05,
        random_state: int = 42,
    ):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state
        self.model: Optional[IsolationForest] = None
        self.feature_names = AnomalyFeatureExtractor.FEATURE_NAMES

    def fit_and_score(
        self, enriched_records: List[Dict[str, any]], min_samples: int = 10
    ) -> List[Tuple[Dict[str, any], Optional[DetectedAnomalyItem]]]:
        """
        Fits Isolation Forest on all feature vectors and scores each transaction.
        Returns list of (record, anomaly_item_or_none).
        """
        n_records = len(enriched_records)
        if n_records < min_samples:
            # Insufficient samples to train a stable Isolation Forest
            return [(rec, None) for rec in enriched_records]

        X = np.array([rec["feature_vector"] for rec in enriched_records])

        # Initialize and fit Isolation Forest
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.model.fit(X)

        # decision_function: lower (negative) values indicate more anomalous
        # predict: -1 for anomaly, 1 for inlier
        raw_scores = self.model.decision_function(X)
        predictions = self.model.predict(X)

        # Compute feature medians across the dataset for explainability
        feature_medians = np.median(X, axis=0)

        results = []
        for i, rec in enumerate(enriched_records):
            raw_score = float(raw_scores[i])
            is_anomaly = predictions[i] == -1
            tx = rec["transaction"]
            ctx = rec["context"]

            # Only evaluate transactions that have some prior history context
            if ctx["prior_history_count"] < 3:
                results.append((rec, None))
                continue

            # Convert raw_score to normalized anomaly score in [0.0, 1.0]
            # When raw_score is 0.0, mapped score is ~0.50.
            # Negative raw scores map to > 0.50 up to ~0.98.
            # Sigmoid mapping: 1 / (1 + exp(raw_score * 8))
            normalized_score = float(1.0 / (1.0 + np.exp(raw_score * 8.0)))
            normalized_score = round(min(0.99, max(0.01, normalized_score)), 3)

            if not is_anomaly and normalized_score < 0.60:
                results.append((rec, None))
                continue

            # Calculate feature deviations to identify top contributing signals
            vec = X[i]
            contribs: List[ContributingFeatureItem] = []
            deviations = []
            for f_idx, fname in enumerate(self.feature_names):
                val = float(vec[f_idx])
                med = float(feature_medians[f_idx])
                diff = abs(val - med) / (med + 1e-4) if med > 0 else abs(val)
                deviations.append((fname, val, diff))

            deviations.sort(key=lambda x: x[2], reverse=True)
            top_deviations = deviations[:2]

            for fname, val, diff in top_deviations:
                impact = "high" if diff > 2.0 else "medium"
                readable_name = fname.replace("_", " ").title()
                contribs.append(
                    ContributingFeatureItem(
                        feature=fname,
                        value=round(val, 2),
                        impact=impact,
                        description=f"{readable_name} of {val:,.2f} deviates from your typical spending pattern.",
                    )
                )

            # Determine dominant anomaly type based on highest deviating feature
            top_feat = top_deviations[0][0] if top_deviations else "amount"
            if "category" in top_feat:
                anomaly_type = AnomalyType.CATEGORY_ANOMALY
                reason = (
                    f"Spending in '{tx.category}' of {tx.currency} {tx.amount:,.2f} differs from your "
                    f"multi-dimensional spending pattern."
                )
            elif "merchant" in top_feat:
                anomaly_type = AnomalyType.MERCHANT_ANOMALY
                reason = (
                    f"Merchant pattern at '{tx.merchant}' deviates from your typical transaction profile."
                )
            elif "recent" in top_feat or "days" in top_feat:
                anomaly_type = AnomalyType.FREQUENCY_ANOMALY
                reason = (
                    f"Transaction timing or frequency for this transaction differs from your regular rhythm."
                )
            else:
                anomaly_type = AnomalyType.AMOUNT_ANOMALY
                reason = (
                    f"Transaction amount of {tx.currency} {tx.amount:,.2f} deviates from your "
                    f"typical transaction amounts."
                )

            if normalized_score >= 0.85:
                severity = AnomalySeverity.HIGH
            elif normalized_score >= 0.70:
                severity = AnomalySeverity.MEDIUM
            else:
                severity = AnomalySeverity.LOW

            item = DetectedAnomalyItem(
                transaction_id=tx.id,
                date=tx.date,
                amount=tx.amount,
                currency=tx.currency,
                merchant=tx.merchant,
                category=tx.category,
                anomaly_type=anomaly_type,
                anomaly_score=normalized_score,
                severity=severity,
                reason=reason,
                contributing_features=contribs,
                detector_type="ISOLATION_FOREST",
            )
            results.append((rec, item))

        return results
