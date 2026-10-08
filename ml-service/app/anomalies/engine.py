"""
Hybrid Financial Anomaly Detection Engine.
Combines statistical baseline (Median + MAD) with unsupervised machine learning (Isolation Forest).
Guarantees zero future temporal leakage and provides neutral, non-fraud explainability.
"""
from typing import Dict, List, Optional
from app.schemas.anomalies import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyDetectorMetadata,
    AnomalySeverity,
    DetectedAnomalyItem,
)
from app.anomalies.feature_extractor import AnomalyFeatureExtractor
from app.anomalies.statistical_detector import StatisticalAnomalyDetector
from app.anomalies.isolation_forest_detector import IsolationForestAnomalyDetector


class AnomalyDetectionEngine:
    """
    Coordinates feature extraction, statistical baseline testing,
    Isolation Forest evaluation, signal ensembling, and explanation generation.
    """

    def __init__(
        self,
        isolation_forest_estimators: int = 100,
        contamination: float = 0.05,
        random_state: int = 42,
    ):
        self.isolation_forest = IsolationForestAnomalyDetector(
            n_estimators=isolation_forest_estimators,
            contamination=contamination,
            random_state=random_state,
        )

    def detect_anomalies(
        self, request: AnomalyDetectionRequest
    ) -> AnomalyDetectionResponse:
        """
        Executes personalized anomaly detection for the authenticated user.
        """
        user_id = request.user_id
        raw_txs = request.transactions
        min_history = request.min_history_count

        # 1. Clean transactions (exclude transfers, sort chronologically)
        valid_txs = AnomalyFeatureExtractor.clean_and_sort_transactions(raw_txs)

        # 2. Check for cold-start / insufficient history
        if len(valid_txs) < min_history:
            return AnomalyDetectionResponse(
                status="insufficient_data",
                message=(
                    "Insufficient transaction history for personalized anomaly detection. "
                    f"A minimum of {min_history} transactions is required to calculate reliable spending baselines."
                ),
                user_id=user_id,
                total_evaluated=len(valid_txs),
                anomalies_detected=0,
                anomalies=[],
                detector_metadata=AnomalyDetectorMetadata(),
            )

        # 3. Extract causal features (strictly 0 temporal leakage)
        enriched_records = AnomalyFeatureExtractor.compute_causal_features(valid_txs)

        # 4. Run Statistical Baseline Detector
        stat_results: Dict[str, Optional[DetectedAnomalyItem]] = {}
        for rec in enriched_records:
            tx_id = rec["transaction"].id
            stat_item = StatisticalAnomalyDetector.evaluate_record(
                rec, min_history=min_history
            )
            stat_results[tx_id] = stat_item

        # 5. Run Isolation Forest ML Detector
        if_scored_records = self.isolation_forest.fit_and_score(
            enriched_records, min_samples=max(min_history, 8)
        )
        if_results: Dict[str, Optional[DetectedAnomalyItem]] = {}
        for rec, if_item in if_scored_records:
            tx_id = rec["transaction"].id
            if_results[tx_id] = if_item

        # 6. Ensemble Signals
        final_anomalies: List[DetectedAnomalyItem] = []

        for rec in enriched_records:
            tx = rec["transaction"]
            tx_id = tx.id
            stat_item = stat_results.get(tx_id)
            if_item = if_results.get(tx_id)

            if stat_item and if_item:
                # Both detectors agree this transaction deviates from normal behavior
                combined_score = round(
                    0.55 * stat_item.anomaly_score + 0.45 * if_item.anomaly_score, 3
                )
                combined_score = min(0.99, max(0.55, combined_score))

                # Combine contributing features, deduplicating by feature name
                features_by_name = {}
                for cf in stat_item.contributing_features + if_item.contributing_features:
                    features_by_name[cf.feature] = cf
                combined_features = list(features_by_name.values())

                if combined_score >= 0.85:
                    severity = AnomalySeverity.HIGH
                elif combined_score >= 0.70:
                    severity = AnomalySeverity.MEDIUM
                else:
                    severity = AnomalySeverity.LOW

                final_item = DetectedAnomalyItem(
                    transaction_id=tx_id,
                    date=tx.date,
                    amount=tx.amount,
                    currency=tx.currency,
                    merchant=tx.merchant,
                    category=tx.category,
                    anomaly_type=stat_item.anomaly_type,
                    anomaly_score=combined_score,
                    severity=severity,
                    reason=stat_item.reason,
                    contributing_features=combined_features,
                    detector_type="ENSEMBLE",
                )
                final_anomalies.append(final_item)

            elif stat_item and not if_item:
                # Statistical baseline identified a clear deviation (e.g. single-category outlier)
                final_anomalies.append(stat_item)

            elif if_item and not stat_item:
                # Isolation Forest identified a multivariate pattern deviation
                final_anomalies.append(if_item)

        # Sort anomalies by date descending (most recent first)
        final_anomalies.sort(
            key=lambda x: AnomalyFeatureExtractor.parse_iso_date(x.date), reverse=True
        )

        return AnomalyDetectionResponse(
            status="success",
            message=f"Successfully analyzed {len(valid_txs)} transactions and identified {len(final_anomalies)} unusual spending patterns.",
            user_id=user_id,
            total_evaluated=len(valid_txs),
            anomalies_detected=len(final_anomalies),
            anomalies=final_anomalies,
            detector_metadata=AnomalyDetectorMetadata(),
        )
