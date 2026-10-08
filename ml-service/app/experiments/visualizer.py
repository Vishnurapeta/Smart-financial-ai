"""
Visual experiment reporting utilities.
Generates publication-quality charts for actual vs predicted values,
residual distributions, and LSTM learning curves without GUI dependencies.
"""
import os
from typing import Any, List, Optional
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np


class VisualReporter:
    """Generates and persists diagnostic visual charts for model experiments."""

    def __init__(self, reports_dir: str = "experiments/reports"):
        self.reports_dir = reports_dir
        os.makedirs(self.reports_dir, exist_ok=True)

    def plot_actual_vs_predicted(
        self,
        dates: List[Any],
        y_true: np.ndarray,
        y_pred: np.ndarray,
        ticker: str,
        model_name: str,
        target: str,
        split: str = "test",
        filename: Optional[str] = None,
    ) -> str:
        """Plots time-series comparison of ground truth vs model predictions."""
        if filename is None:
            filename = f"{ticker}_{model_name}_{target}_{split}_actual_vs_pred.png"
        filepath = os.path.join(self.reports_dir, filename)

        fig, ax = plt.subplots(figsize=(10, 5), dpi=150)
        ax.plot(dates, y_true, label="Actual Ground Truth", color="#1f77b4", linewidth=1.5)
        ax.plot(
            dates,
            y_pred,
            label=f"Predicted ({model_name})",
            color="#ff7f0e",
            linestyle="--",
            linewidth=1.5,
        )

        ax.set_title(
            f"{ticker} - Actual vs Predicted ({model_name.upper()})\nTarget: {target} | Split: {split.capitalize()}",
            fontsize=12,
            fontweight="bold",
        )
        ax.set_xlabel("Date", fontsize=10)
        ax.set_ylabel("Price / Value", fontsize=10)
        ax.grid(True, linestyle=":", alpha=0.6)
        ax.legend(loc="best")
        fig.autofmt_xdate()
        plt.tight_layout()
        fig.savefig(filepath)
        plt.close(fig)
        return filepath

    def plot_residuals_distribution(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        ticker: str,
        model_name: str,
        target: str,
        split: str = "test",
        filename: Optional[str] = None,
    ) -> str:
        """Plots dual panel: Residuals time-series and Residual Error distribution histogram."""
        residuals = y_true - y_pred
        if filename is None:
            filename = f"{ticker}_{model_name}_{target}_{split}_residuals.png"
        filepath = os.path.join(self.reports_dir, filename)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)

        # Residuals scatter
        ax1.scatter(range(len(residuals)), residuals, alpha=0.6, color="#2ca02c", s=15)
        ax1.axhline(0, color="red", linestyle="--", linewidth=1)
        ax1.set_title("Residuals Sequence", fontsize=11, fontweight="bold")
        ax1.set_xlabel("Sample Index", fontsize=9)
        ax1.set_ylabel("Residual (Actual - Pred)", fontsize=9)
        ax1.grid(True, linestyle=":", alpha=0.6)

        # Residuals distribution
        ax2.hist(residuals, bins=25, color="#17becf", edgecolor="black", alpha=0.7)
        ax2.axvline(0, color="red", linestyle="--", linewidth=1)
        ax2.set_title("Residuals Distribution", fontsize=11, fontweight="bold")
        ax2.set_xlabel("Residual Error", fontsize=9)
        ax2.set_ylabel("Frequency", fontsize=9)
        ax2.grid(True, linestyle=":", alpha=0.6)

        fig.suptitle(
            f"{ticker} Residual Analysis - {model_name.upper()} ({target})",
            fontsize=12,
            fontweight="bold",
        )
        plt.tight_layout()
        fig.savefig(filepath)
        plt.close(fig)
        return filepath

    def plot_lstm_loss_curve(
        self,
        train_losses: List[float],
        val_losses: List[float],
        ticker: str,
        filename: Optional[str] = None,
    ) -> str:
        """Plots training loss vs validation loss progression over training epochs for LSTM."""
        if filename is None:
            filename = f"{ticker}_lstm_loss_curve.png"
        filepath = os.path.join(self.reports_dir, filename)

        fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
        epochs = range(1, len(train_losses) + 1)
        ax.plot(epochs, train_losses, label="Train Loss (MSE)", color="#1f77b4", marker="o", markersize=3)
        ax.plot(epochs, val_losses, label="Validation Loss (MSE)", color="#d62728", marker="s", markersize=3)

        ax.set_title(
            f"LSTM Convergence Learning Curve - {ticker}",
            fontsize=12,
            fontweight="bold",
        )
        ax.set_xlabel("Epoch", fontsize=10)
        ax.set_ylabel("Loss (MSE)", fontsize=10)
        ax.grid(True, linestyle=":", alpha=0.6)
        ax.legend(loc="best")
        plt.tight_layout()
        fig.savefig(filepath)
        plt.close(fig)
        return filepath
