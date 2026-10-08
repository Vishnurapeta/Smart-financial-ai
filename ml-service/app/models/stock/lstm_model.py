"""
Production LSTM deep learning model for stock prediction using PyTorch.
Generates chronological sliding windows without lookahead bias.
Executes reliably on CPU or GPU with early stopping, dropout regularization, and loss history tracking.
"""
import os
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from app.core.logger import logger
from app.models.stock.base import BaseStockModel
from app.preprocessing.scaling import LeakageFreeScaler


class StockLSTMNet(nn.Module):
    """
    PyTorch 2-layer stacked LSTM architecture for multi-feature sequence-to-one regression.
    Input -> LSTM Layer 1 -> Dropout -> LSTM Layer 2 -> Dropout -> Dense Layer -> Output
    """

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 32,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, sequence_length, input_size)
        out, _ = self.lstm(x)
        # Take the hidden state of the final time step
        last_step = out[:, -1, :]
        last_step = self.dropout(last_step)
        return self.fc(last_step).squeeze(-1)


def create_sliding_sequences(
    X_arr: np.ndarray,
    y_arr: Optional[np.ndarray],
    sequence_length: int,
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """
    Constructs chronological 3D tensors: (num_samples, sequence_length, num_features).
    Target at index i is strictly aligned with the observation at the end of the 30-day sequence.
    Guarantees no future lookahead.
    """
    n_samples = len(X_arr)
    if n_samples < sequence_length:
        return np.empty((0, sequence_length, X_arr.shape[1]), dtype=np.float32), None

    X_seqs = []
    y_seqs = [] if y_arr is not None else None

    for i in range(sequence_length, n_samples + 1):
        X_seqs.append(X_arr[i - sequence_length : i])
        if y_arr is not None:
            # Target associated with observation at the end of the sequence
            y_seqs.append(y_arr[i - 1])

    X_out = np.array(X_seqs, dtype=np.float32)
    y_out = np.array(y_seqs, dtype=np.float32) if y_arr is not None else None
    return X_out, y_out


class LSTMStockModel(BaseStockModel):
    """
    PyTorch LSTM model for stock price/return forecasting.
    Includes feature scaling fitted strictly on training observations,
    30-trading-day sliding window sequence generation, early stopping on validation loss,
    and persisted scaler artifacts.
    """

    def __init__(
        self,
        sequence_length: int = 30,
        hidden_size: int = 32,
        num_layers: int = 2,
        dropout: float = 0.2,
        learning_rate: float = 0.001,
        batch_size: int = 32,
        epochs: int = 15,
        patience: int = 3,
        random_state: int = 42,
        random_seed: Optional[int] = None,
        version: str = "1.0.0",
    ):
        super().__init__(name="LSTM", version=version)
        self.sequence_length = sequence_length
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.epochs = epochs
        self.patience = patience
        self.random_state = random_seed if random_seed is not None else random_state

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.net: Optional[StockLSTMNet] = None
        self.scaler = LeakageFreeScaler("standard")
        self.target_scaler: Optional[Any] = None
        self.scaler_artifact_path: Optional[str] = None
        self.train_loss_history: List[float] = []
        self.val_loss_history: List[float] = []

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ) -> "LSTMStockModel":
        torch.manual_seed(self.random_state)
        np.random.seed(self.random_state)

        self.feature_names = list(X_train.columns)
        n_features = len(self.feature_names)

        # 1. Fit scaler strictly on training features (zero validation or test leakage)
        X_train_scaled = self.scaler.fit_transform(X_train, self.feature_names)[self.feature_names].to_numpy()
        y_train_arr = y_train.to_numpy(dtype=np.float32)

        # Scale target if it represents absolute price rather than percentage return
        self.target_scaler = None
        if float(np.abs(y_train).mean()) > 5.0:
            from sklearn.preprocessing import StandardScaler
            self.target_scaler = StandardScaler()
            y_train_arr = self.target_scaler.fit_transform(y_train_arr.reshape(-1, 1)).flatten().astype(np.float32)

        # 2. Build training sliding windows (30 days default)
        X_tr_seq, y_tr_seq = create_sliding_sequences(
            X_train_scaled, y_train_arr, self.sequence_length
        )

        if len(X_tr_seq) == 0:
            raise ValueError(
                f"Insufficient training rows ({len(X_train)}) for sequence_length={self.sequence_length}."
            )

        train_dataset = TensorDataset(
            torch.from_numpy(X_tr_seq), torch.from_numpy(y_tr_seq)
        )
        train_loader = DataLoader(
            train_dataset, batch_size=self.batch_size, shuffle=False
        )

        # 3. Build validation sliding windows if available
        val_loader = None
        if X_val is not None and y_val is not None and len(X_val) > 0:
            # Transform validation using the fitted training scaler
            X_val_scaled = self.scaler.transform(X_val, self.feature_names)[self.feature_names].to_numpy()
            y_val_arr = y_val.to_numpy(dtype=np.float32)
            if self.target_scaler is not None:
                y_val_arr = self.target_scaler.transform(y_val_arr.reshape(-1, 1)).flatten().astype(np.float32)

            # Prepend the tail of training data so validation sequences cover all val rows
            warmup_len = self.sequence_length - 1
            if len(X_train_scaled) >= warmup_len:
                X_val_full = np.vstack([X_train_scaled[-warmup_len:], X_val_scaled])
                y_val_full = np.concatenate([y_train_arr[-warmup_len:], y_val_arr])
                X_v_seq, y_v_seq = create_sliding_sequences(
                    X_val_full, y_val_full, self.sequence_length
                )
            else:
                X_v_seq, y_v_seq = create_sliding_sequences(
                    X_val_scaled, y_val_arr, self.sequence_length
                )

            if len(X_v_seq) > 0:
                val_dataset = TensorDataset(
                    torch.from_numpy(X_v_seq), torch.from_numpy(y_v_seq)
                )
                val_loader = DataLoader(
                    val_dataset, batch_size=self.batch_size, shuffle=False
                )

        # 4. Instantiate neural network
        self.net = StockLSTMNet(
            input_size=n_features,
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            dropout=self.dropout,
        ).to(self.device)

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.net.parameters(), lr=self.learning_rate)

        best_val_loss = float("inf")
        best_state = None
        patience_counter = 0

        self.train_loss_history = []
        self.val_loss_history = []

        # 5. Training loop with early stopping
        self.net.train()
        for epoch in range(self.epochs):
            batch_losses = []
            for b_x, b_y in train_loader:
                b_x = b_x.to(self.device)
                b_y = b_y.to(self.device)
                optimizer.zero_grad()
                pred = self.net(b_x)
                loss = criterion(pred, b_y)
                loss.backward()
                optimizer.step()
                batch_losses.append(loss.item())

            avg_train_loss = float(np.mean(batch_losses))
            self.train_loss_history.append(avg_train_loss)

            # Validation step
            if val_loader:
                self.net.eval()
                val_losses = []
                with torch.no_grad():
                    for b_vx, b_vy in val_loader:
                        b_vx = b_vx.to(self.device)
                        b_vy = b_vy.to(self.device)
                        v_pred = self.net(b_vx)
                        v_loss = criterion(v_pred, b_vy)
                        val_losses.append(v_loss.item())
                avg_val_loss = float(np.mean(val_losses))
                self.val_loss_history.append(avg_val_loss)

                # Early stopping check
                if avg_val_loss < best_val_loss:
                    best_val_loss = avg_val_loss
                    best_state = {k: v.cpu().clone() for k, v in self.net.state_dict().items()}
                    patience_counter = 0
                else:
                    patience_counter += 1
                    if patience_counter >= self.patience:
                        break
                self.net.train()

        # Restore best weights if early stopping was used
        if best_state is not None:
            self.net.load_state_dict(best_state)

        self.net.eval()
        self.is_fitted = True
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """
        Generates predictions for X using the trained 30-day sequence model.
        For rows before sequence_length, pads with initial forecast.
        If input length is less than sequence_length, pads head with earliest row.
        """
        if not self.is_fitted or self.net is None:
            raise RuntimeError("Model must be fitted before predicting.")

        clean_X = X.copy()
        # If input has fewer rows than sequence_length, pad leading rows
        if len(clean_X) < self.sequence_length:
            pad_needed = self.sequence_length - len(clean_X)
            head_pad = pd.concat([clean_X.iloc[[0]]] * pad_needed, ignore_index=True)
            clean_X = pd.concat([head_pad, clean_X], ignore_index=True)

        X_scaled = self.scaler.transform(clean_X, self.feature_names)[self.feature_names].to_numpy()
        X_seq, _ = create_sliding_sequences(X_scaled, None, self.sequence_length)

        if len(X_seq) == 0:
            return np.zeros(len(X), dtype=np.float64)

        self.net.eval()
        with torch.no_grad():
            tensor_in = torch.from_numpy(X_seq).to(self.device)
            preds = self.net(tensor_in).cpu().numpy().astype(np.float64)

        if self.target_scaler is not None:
            preds = self.target_scaler.inverse_transform(preds.reshape(-1, 1)).flatten().astype(np.float64)

        # Re-align output size to original len(X)
        if len(clean_X) > len(X):
            # We padded head earlier, take trailing predictions
            preds = preds[-len(X):]
        else:
            # Pad the leading sequence_length - 1 observations with the first prediction
            n_lead = len(X) - len(preds)
            if n_lead > 0:
                pad = np.full(n_lead, preds[0] if len(preds) > 0 else 0.0, dtype=np.float64)
                preds = np.concatenate([pad, preds])

        return preds

    def save(self, output_dir: str, prefix: str) -> str:
        """
        Persists both the PyTorch LSTM model weights and the fitted Scaler artifact.
        Returns the primary model artifact path.
        """
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{prefix}_lstm.pt")
        scaler_filepath = os.path.join(output_dir, f"{prefix}_scaler.joblib")

        # Persist scaler separately for standalone verification and registry linkage
        try:
            joblib.dump(self.scaler, scaler_filepath)
            self.scaler_artifact_path = scaler_filepath
        except Exception as e:
            logger.warning(f"Failed to dump scaler to {scaler_filepath}: {e}")

        save_dict = {
            "name": self.name,
            "version": self.version,
            "hyperparameters": self.get_hyperparameters(),
            "state_dict": self.net.state_dict() if self.net else None,
            "scaler": self.scaler,
            "target_scaler": self.target_scaler,
            "scaler_artifact_path": self.scaler_artifact_path,
            "feature_names": self.feature_names,
            "is_fitted": self.is_fitted,
            "train_loss_history": self.train_loss_history,
            "val_loss_history": self.val_loss_history,
        }
        torch.save(save_dict, filepath)
        return filepath

    @classmethod
    def load(cls, artifact_path: str) -> "LSTMStockModel":
        data = torch.load(artifact_path, map_location="cpu", weights_only=False)
        params = data["hyperparameters"]
        inst = cls(
            sequence_length=params.get("sequence_length", 30),
            hidden_size=params.get("hidden_size", 32),
            num_layers=params.get("num_layers", 2),
            dropout=params.get("dropout", 0.2),
            learning_rate=params.get("learning_rate", 0.001),
            batch_size=params.get("batch_size", 32),
            epochs=params.get("epochs", 15),
            patience=params.get("patience", 3),
            random_state=params.get("random_state", 42),
            version=data.get("version", "1.0.0"),
        )
        inst.feature_names = data["feature_names"]
        inst.target_scaler = data.get("target_scaler", None)

        # Restore scaler: check external joblib artifact first, then embedded dict
        scaler_art = data.get("scaler_artifact_path")
        if scaler_art and os.path.exists(scaler_art):
            try:
                inst.scaler = joblib.load(scaler_art)
                inst.scaler_artifact_path = scaler_art
            except Exception:
                inst.scaler = data.get("scaler", LeakageFreeScaler("standard"))
        else:
            # Check parallel filename on disk
            candidate_scaler = artifact_path.replace("_lstm.pt", "_scaler.joblib")
            if os.path.exists(candidate_scaler):
                try:
                    inst.scaler = joblib.load(candidate_scaler)
                    inst.scaler_artifact_path = candidate_scaler
                except Exception:
                    inst.scaler = data.get("scaler", LeakageFreeScaler("standard"))
            else:
                inst.scaler = data.get("scaler", LeakageFreeScaler("standard"))

        inst.is_fitted = data["is_fitted"]
        inst.train_loss_history = data.get("train_loss_history", [])
        inst.val_loss_history = data.get("val_loss_history", [])

        if data["state_dict"] is not None:
            inst.net = StockLSTMNet(
                input_size=len(inst.feature_names),
                hidden_size=inst.hidden_size,
                num_layers=inst.num_layers,
                dropout=inst.dropout,
            )
            inst.net.load_state_dict(data["state_dict"])
            inst.net.eval()

        return inst

    def get_hyperparameters(self) -> Dict[str, Any]:
        return {
            "sequence_length": self.sequence_length,
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "dropout": self.dropout,
            "learning_rate": self.learning_rate,
            "batch_size": self.batch_size,
            "epochs": self.epochs,
            "patience": self.patience,
            "random_state": self.random_state,
        }
