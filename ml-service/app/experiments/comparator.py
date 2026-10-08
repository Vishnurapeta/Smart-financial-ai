"""
Model comparison and production candidate selection engine.
Compares models based strictly on validation split performance.
Guarantees test split is reserved solely for final unbiased evaluation.
"""
from typing import Any, Dict, List, Optional, Tuple
from app.experiments.tracker import ModelEvaluationResult


class ModelComparator:
    """Compares model evaluation results and selects candidate based on validation metrics."""

    METRIC_DIRECTIONS = {
        "rmse": "min",
        "mae": "min",
        "mape": "min",
        "r2": "max",
        "directional_accuracy": "max",
        "precision": "max",
        "recall": "max",
        "f1": "max",
    }

    def __init__(
        self,
        primary_metric: Optional[str] = None,
        secondary_metric: Optional[str] = None,
        task_type: str = "price",
    ):
        self.task_type = task_type
        if primary_metric is None:
            self.primary_metric = "rmse" if task_type == "price" else "rmse"
        else:
            self.primary_metric = primary_metric

        if secondary_metric is None:
            self.secondary_metric = "mae" if task_type == "price" else "directional_accuracy"
        else:
            self.secondary_metric = secondary_metric

    def compare_models(
        self,
        results: List[ModelEvaluationResult],
        split: str = "validation",
    ) -> List[Dict[str, Any]]:
        """
        Extracts comparison records across models for the given split (validation or test).
        Computes delta relative to the Naive baseline.
        """
        valid_results = [r for r in results if r.status == "SUCCESS"]
        if not valid_results:
            return []

        # Find naive baseline
        naive_result = next((r for r in valid_results if r.model_name == "naive"), None)
        naive_metrics = {}
        if naive_result:
            naive_metrics = (
                naive_result.validation_metrics if split == "validation" else naive_result.test_metrics
            )

        comparison_records = []
        for r in valid_results:
            metrics = r.validation_metrics if split == "validation" else r.test_metrics
            rec = {
                "model_name": r.model_name,
                "model_version": r.model_version,
                "ticker": r.ticker,
                "target": r.target,
                "split": split,
                "mae": metrics.get("mae"),
                "rmse": metrics.get("rmse"),
                "r2": metrics.get("r2"),
                "training_duration_seconds": r.training_duration_seconds,
            }
            if self.task_type == "price":
                rec["mape"] = metrics.get("mape")
            else:
                rec["directional_accuracy"] = metrics.get("directional_accuracy")
                rec["f1"] = metrics.get("f1")

            # Calculate relative delta vs baseline on primary metric
            if naive_metrics and self.primary_metric in metrics and self.primary_metric in naive_metrics:
                naive_val = naive_metrics[self.primary_metric]
                model_val = metrics[self.primary_metric]
                if naive_val and naive_val != 0:
                    pct_diff = ((model_val - naive_val) / abs(naive_val)) * 100.0
                    rec["delta_vs_baseline_pct"] = round(pct_diff, 2)

            comparison_records.append(rec)

        return comparison_records

    def generate_ascii_table(
        self,
        results: List[ModelEvaluationResult],
        split: str = "validation",
    ) -> str:
        """Generates formatted ASCII table of comparison metrics."""
        records = self.compare_models(results, split=split)
        if not records:
            return "No successful evaluation results found to display."

        ticker = records[0].get("ticker", "UNKNOWN")
        target = records[0].get("target", "UNKNOWN")

        lines = [
            f"=== Model Comparison ({split.upper()} Set) | Ticker: {ticker} | Target: {target} ==="
        ]

        if self.task_type == "price":
            header = f"{'Model':<20} | {'MAE':<10} | {'RMSE':<10} | {'MAPE (%)':<10} | {'R²':<10} | {'vs Base %':<10}"
            lines.append(header)
            lines.append("-" * len(header))
            for r in records:
                mae_str = f"{r['mae']:.4f}" if r.get("mae") is not None else "N/A"
                rmse_str = f"{r['rmse']:.4f}" if r.get("rmse") is not None else "N/A"
                mape_str = f"{r['mape']:.2f}%" if r.get("mape") is not None else "N/A"
                r2_str = f"{r['r2']:.4f}" if r.get("r2") is not None else "N/A"
                delta_str = (
                    f"{r['delta_vs_baseline_pct']:+.2f}%"
                    if "delta_vs_baseline_pct" in r
                    else "baseline"
                )
                lines.append(
                    f"{r['model_name']:<20} | {mae_str:<10} | {rmse_str:<10} | {mape_str:<10} | {r2_str:<10} | {delta_str:<10}"
                )
        else:
            header = f"{'Model':<20} | {'MAE':<10} | {'RMSE':<10} | {'R²':<10} | {'Dir Acc':<10} | {'vs Base %':<10}"
            lines.append(header)
            lines.append("-" * len(header))
            for r in records:
                mae_str = f"{r['mae']:.4f}" if r.get("mae") is not None else "N/A"
                rmse_str = f"{r['rmse']:.4f}" if r.get("rmse") is not None else "N/A"
                r2_str = f"{r['r2']:.4f}" if r.get("r2") is not None else "N/A"
                dir_acc_str = (
                    f"{r['directional_accuracy']:.2f}%"
                    if r.get("directional_accuracy") is not None
                    else "N/A"
                )
                delta_str = (
                    f"{r['delta_vs_baseline_pct']:+.2f}%"
                    if "delta_vs_baseline_pct" in r
                    else "baseline"
                )
                lines.append(
                    f"{r['model_name']:<20} | {mae_str:<10} | {rmse_str:<10} | {r2_str:<10} | {dir_acc_str:<10} | {delta_str:<10}"
                )

        return "\n".join(lines)

    def select_best_candidate(
        self,
        results: List[ModelEvaluationResult],
    ) -> Tuple[Optional[ModelEvaluationResult], str]:
        """
        Selects the best production candidate based purely on VALIDATION set metrics.
        Never uses test set results for candidate selection.
        """
        valid_results = [r for r in results if r.status == "SUCCESS"]
        if not valid_results:
            return None, "No successful models to evaluate."

        direction = self.METRIC_DIRECTIONS.get(self.primary_metric, "min")

        # Sort candidate models by primary metric on validation split
        def sort_key(res: ModelEvaluationResult):
            val = res.validation_metrics.get(self.primary_metric)
            if val is None:
                return float("inf") if direction == "min" else float("-inf")
            return val if direction == "min" else -val

        sorted_results = sorted(valid_results, key=sort_key)
        best_candidate = sorted_results[0]

        # Inspect performance relative to naive baseline
        naive_result = next((r for r in valid_results if r.model_name == "naive"), None)
        rationale_lines = [
            f"Candidate Selection Rationale for {best_candidate.ticker} ({self.task_type} prediction):",
            f"- Primary Metric: {self.primary_metric.upper()} (Optimization: {direction.upper()})",
            f"- Validation Score: {best_candidate.validation_metrics.get(self.primary_metric)}",
        ]

        if naive_result and naive_result.model_name != best_candidate.model_name:
            naive_score = naive_result.validation_metrics.get(self.primary_metric)
            cand_score = best_candidate.validation_metrics.get(self.primary_metric)
            if naive_score is not None and cand_score is not None:
                if direction == "min" and cand_score < naive_score:
                    improvement = ((naive_score - cand_score) / abs(naive_score)) * 100.0
                    rationale_lines.append(
                        f"- Outperforms Naive Baseline on validation set by {improvement:.2f}% improvement in {self.primary_metric.upper()}."
                    )
                elif direction == "max" and cand_score > naive_score:
                    improvement = ((cand_score - naive_score) / abs(naive_score)) * 100.0
                    rationale_lines.append(
                        f"- Outperforms Naive Baseline on validation set with {improvement:.2f}% higher {self.primary_metric.upper()}."
                    )
                else:
                    rationale_lines.append(
                        f"- Warning: Model did not strictly beat Naive Baseline ({cand_score} vs naive {naive_score}). "
                        "Retaining for transparency; production promotion requires strict outperformance."
                    )
        elif best_candidate.model_name == "naive":
            rationale_lines.append(
                "- Naive baseline performed best among tested models on the validation split. "
                "No ML model justified replacing the baseline."
            )

        rationale_lines.append(
            f"- Selected Model: {best_candidate.model_name} (ID: {best_candidate.model_id})"
        )
        rationale = "\n".join(rationale_lines)

        return best_candidate, rationale
