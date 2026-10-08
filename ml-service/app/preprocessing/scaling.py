"""
Leakage-free feature scaling module.
Guarantees scalers are fit strictly on training splits and applied out-of-sample.
"""
from typing import List, Optional
import pandas as pd
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler


class LeakageFreeScaler:
    """
    Fits feature scalers strictly on training data to prevent lookahead data leakage.
    Never fits on validation or test sets.
    """

    def __init__(self, scaler_type: Optional[str] = "standard"):
        """
        Args:
            scaler_type: 'standard', 'minmax', 'robust', or None
        """
        self.scaler_type = scaler_type.lower() if scaler_type else None
        self.scaler = None
        self.fitted_features: List[str] = []

        if self.scaler_type == "standard":
            self.scaler = StandardScaler()
        elif self.scaler_type == "minmax":
            self.scaler = MinMaxScaler()
        elif self.scaler_type == "robust":
            self.scaler = RobustScaler()
        elif self.scaler_type is None:
            self.scaler = None
        else:
            raise ValueError(
                f"Unknown scaler type: '{scaler_type}'. Choose 'standard', 'minmax', 'robust', or None."
            )

    def fit(self, train_df: pd.DataFrame, feature_cols: List[str]) -> "LeakageFreeScaler":
        """
        Fits the scaler strictly using training data.
        """
        if self.scaler is None:
            return self

        self.fitted_features = list(feature_cols)
        self.scaler.fit(train_df[feature_cols])
        return self

    def transform(
        self, df: pd.DataFrame, feature_cols: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Transforms features using the pre-fitted training scaler.
        Preserves non-feature columns (e.g. date, symbol, targets).
        """
        cols = feature_cols if feature_cols is not None else self.fitted_features
        if self.scaler is None or not cols:
            return df.copy()

        out_df = df.copy()
        scaled_vals = self.scaler.transform(out_df[cols])
        out_df[cols] = scaled_vals
        return out_df

    def fit_transform(self, train_df: pd.DataFrame, feature_cols: List[str]) -> pd.DataFrame:
        """
        Fits on training data and returns scaled training DataFrame.
        """
        self.fit(train_df, feature_cols)
        return self.transform(train_df)
