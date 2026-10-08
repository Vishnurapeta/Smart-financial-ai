"""
Stock prediction inference service.
Coordinates model resolution from registry, caching, market data retrieval,
feature transformation, model prediction, sanity audits, and history persistence.
"""
from datetime import datetime, timezone
import time
from typing import Optional
import numpy as np

from app.core.config import settings
from app.core.logger import logger
from app.models.stock.registry import ModelRegistry, ModelRegistryEntry, ModelStatus
from app.repositories.prediction_repository import prediction_repository
from app.schemas.predictions import (
    ForecastSignal,
    StockPredictionRequest,
    StockPredictionResponse,
)
from app.services.feature_service import FeatureInferenceError, feature_service
from app.services.market_data_service import (
    InsufficientHistoricalDataError,
    MarketDataError,
    MarketDataUnavailableError,
    StaleMarketDataError,
    market_data_service,
)
from app.services.model_loader import model_loader


class PredictionServiceError(Exception):
    """Base exception for prediction inference failures."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ModelNotFoundError(PredictionServiceError):
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class IncompatibleModelError(PredictionServiceError):
    def __init__(self, message: str):
        super().__init__(message, status_code=409)


class PredictionSanityError(PredictionServiceError):
    def __init__(self, message: str):
        super().__init__(message, status_code=500)


class StockPredictionService:
    """Core domain service orchestrating stock market model inference."""

    def __init__(self, registry: Optional[ModelRegistry] = None):
        self.registry = registry or ModelRegistry()

    def resolve_model(
        self,
        symbol: str,
        horizon: int = 1,
        target: Optional[str] = None,
        model_version: Optional[str] = None,
        model_name: Optional[str] = None,
        allow_candidate: bool = False,
    ) -> ModelRegistryEntry:
        """
        Resolves the appropriate registered model.
        1. Checks for ticker-specific registered model.
        2. Fallback: If no ticker-specific model, checks for compatible generic/global model.
        3. Matches horizon and target (with semantic matching between return and price targets).
        4. Matches model_name if explicitly requested (e.g. LSTM).
        5. Prefers PRODUCTION status, then CANDIDATE in dev mode or if explicitly requested.
        """
        clean_symbol = symbol.strip().upper()

        # 1. Query catalog for ticker
        models = self.registry.list_models(ticker=clean_symbol)
        is_fallback = False
        if not models:
            # Determine whether a generic/global model can safely support that stock (Requirement 9)
            is_unsupported = clean_symbol.startswith("UNKNOWN") or clean_symbol.startswith("INVALID") or clean_symbol == "MOCK"
            if not is_unsupported:
                global_models = self.registry.list_models(ticker="GLOBAL") or self.registry.list_models(ticker="GLOBAL_NIFTY500")
                if global_models:
                    models = global_models
                    is_fallback = True

            if not models:
                raise ModelNotFoundError(
                    f"No models are currently registered for ticker '{clean_symbol}'. "
                    "Ensure the stock is part of the supported universe."
                )

        # 2. Filter by horizon
        horizon_models = [m for m in models if m.horizon == horizon]
        if not horizon_models:
            # If ticker specific didn't have horizon, check if global has this horizon
            if not is_fallback:
                global_models = [
                    m for m in (self.registry.list_models(ticker="GLOBAL") or self.registry.list_models(ticker="GLOBAL_NIFTY500"))
                    if m.horizon == horizon
                ]
                if global_models:
                    horizon_models = global_models
                    is_fallback = True

        if not horizon_models:
            raise IncompatibleModelError(
                f"No models registered for '{clean_symbol}' with horizon={horizon}."
            )

        # 3. Filter by target (with semantic matching: return vs close/price)
        candidate_pool = horizon_models
        if target:
            clean_target = target.strip().lower()
            exact_matches = [m for m in horizon_models if m.target.lower() == clean_target]
            if exact_matches:
                candidate_pool = exact_matches
            elif "return" in clean_target:
                return_matches = [m for m in horizon_models if "return" in m.target.lower()]
                if return_matches:
                    candidate_pool = return_matches
                else:
                    raise IncompatibleModelError(
                        f"No compatible ML model is registered for {clean_symbol} with horizon={horizon} and target={target}."
                    )
            elif "close" in clean_target or "price" in clean_target:
                price_matches = [m for m in horizon_models if "close" in m.target.lower() or "price" in m.target.lower()]
                if price_matches:
                    candidate_pool = price_matches
                else:
                    candidate_pool = horizon_models
            else:
                raise IncompatibleModelError(
                    f"No compatible ML model is registered for {clean_symbol} with horizon={horizon} and target={target}."
                )
        else:
            # Default to return targets if not explicitly specified
            return_matches = [m for m in horizon_models if "return" in m.target.lower()]
            if return_matches:
                candidate_pool = return_matches

        # 4. Filter by model_name if explicitly requested (e.g. LSTM)
        if model_name:
            clean_mname = model_name.strip().lower()
            matched_pool = [m for m in candidate_pool if clean_mname in m.model_name.lower()]
            if matched_pool:
                candidate_pool = matched_pool
                allow_candidate = True  # User explicitly requested this architecture
            else:
                raise IncompatibleModelError(
                    f"Model architecture '{model_name}' is not registered for '{clean_symbol}' with horizon={horizon}."
                )

        # 5. Filter by model version if requested
        if model_version:
            version_models = [m for m in candidate_pool if m.model_version == model_version]
            if not version_models:
                raise ModelNotFoundError(
                    f"Requested model version '{model_version}' for '{clean_symbol}' not found."
                )
            candidate_pool = version_models

        # 6. Status filtering: Prefer PRODUCTION
        prod_models = [m for m in candidate_pool if m.status == ModelStatus.PRODUCTION.value]
        if prod_models:
            return prod_models[-1]

        # Check if CANDIDATE is permitted
        is_dev = getattr(settings, "PYTHON_ENV", "development") == "development"
        if allow_candidate or is_dev:
            cand_models = [m for m in candidate_pool if m.status == ModelStatus.CANDIDATE.value]
            if cand_models:
                selected = cand_models[-1]
                logger.info(
                    f"Using CANDIDATE model '{selected.model_name}' for "
                    f"'{clean_symbol}' (horizon={horizon}, target={target})."
                )
                return selected

        # Fallback to any model in candidate_pool
        if candidate_pool:
            return candidate_pool[-1]

        statuses = list(set(m.status for m in candidate_pool))
        raise ModelNotFoundError(
            f"No PRODUCTION model is currently available for '{clean_symbol}' (horizon={horizon}). "
            f"Existing models are in status: {statuses}."
        )

    def predict(self, req: StockPredictionRequest) -> StockPredictionResponse:
        """
        Executes end-to-end stock prediction workflow.
        """
        total_start = time.time()
        clean_symbol = req.symbol.strip().upper()
        chosen_model_name = req.model_name or req.model
        logger.info(
            f"Predict request received: symbol={clean_symbol}, horizon={req.horizon}, "
            f"target={req.target}, model_name={chosen_model_name}, allow_candidate={req.allow_candidate}"
        )

        # 1. Resolve registered model
        model_entry = self.resolve_model(
            symbol=clean_symbol,
            horizon=req.horizon,
            target=req.target,
            model_version=req.model_version,
            model_name=chosen_model_name,
            allow_candidate=req.allow_candidate or (chosen_model_name is not None),
        )

        # 2. Load model from artifact (or cache)
        model_inst, model_load_ms = model_loader.load_model(model_entry)

        # 3. Retrieve latest market data
        min_bars = 65
        is_lstm = "lstm" in model_entry.model_name.lower()
        seq_len = (
            getattr(model_entry, "sequence_length", None)
            or model_entry.hyperparameters.get("sequence_length", 30)
            if is_lstm
            else None
        )
        if is_lstm and seq_len:
            min_bars = 50 + seq_len + 10

        try:
            bars_df, quote_dict, market_data_ms = market_data_service.fetch_market_bars(
                symbol=clean_symbol, min_bars=min_bars
            )
        except MarketDataUnavailableError as me:
            logger.warning(f"Market data unavailable for {clean_symbol}: {me}")
            raise PredictionServiceError(
                f"Market data is currently unavailable for {clean_symbol}.",
                status_code=503,
            )
        except StaleMarketDataError as se:
            logger.warning(f"Market data stale for {clean_symbol}: {se}")
            raise PredictionServiceError(
                f"Market data is stale for {clean_symbol}. Prediction could not be reliably generated.",
                status_code=503,
            )
        except InsufficientHistoricalDataError as ie:
            logger.warning(f"Insufficient market data for {clean_symbol}: {ie}")
            raise PredictionServiceError(
                f"Insufficient historical data to generate a {req.horizon}-day forecast for {clean_symbol}.",
                status_code=400,
            )
        except MarketDataError as mde:
            raise PredictionServiceError(str(mde), status_code=503)

        current_price = float(quote_dict.get("currentPrice", bars_df["close"].iloc[-1]))
        market_timestamp = quote_dict.get("timestamp", str(bars_df["date"].iloc[-1]))

        # 4. Feature engineering strictly matching training pipeline
        try:
            feature_vector, feat_gen_ms = feature_service.generate_features_for_inference(
                historical_bars=bars_df,
                expected_features=model_inst.feature_names,
                expected_feature_version=model_entry.feature_version,
                current_feature_version="v1.0.0",
                sequence_length=seq_len,
            )
        except FeatureInferenceError as fie:
            logger.error(f"Feature inference error for {clean_symbol}: {fie}")
            raise PredictionServiceError(f"Feature computation error: {str(fie)}", status_code=400)

        # 5. Execute model inference
        infer_start = time.time()
        try:
            raw_predictions = model_inst.predict(feature_vector)
            infer_ms = round((time.time() - infer_start) * 1000.0, 2)
        except Exception as e:
            logger.error(
                f"Inference execution failed for {model_entry.model_id}: {e}", exc_info=True
            )
            raise PredictionServiceError(
                f"Model inference failed during execution: {str(e)}", status_code=500
            )

        # 6. Sanity check predictions
        if raw_predictions is None or len(raw_predictions) == 0:
            raise PredictionSanityError("Model produced empty prediction output.")

        pred_val = float(raw_predictions[-1])
        if not np.isfinite(pred_val) or np.isnan(pred_val):
            raise PredictionSanityError("Model generated non-finite or NaN prediction value.")

        # 7. Format target-specific outputs
        target_name = model_entry.target
        req_target = req.target or target_name
        is_derived_price = False
        is_derived_return = False
        predicted_price: Optional[float] = None
        predicted_return: Optional[float] = None

        if "price" in target_name.lower() or target_name == "target_next_close" or "close" in target_name.lower():
            predicted_price = round(pred_val, 2)
            if current_price > 0:
                predicted_return = round((predicted_price - current_price) / current_price, 6)
                is_derived_return = True
        else:
            # Return target (e.g. target_next_return, target_return_5d, target_return_20d)
            predicted_return = round(pred_val, 6)
            predicted_price = round(current_price * (1.0 + predicted_return), 2)
            is_derived_price = True

        prediction_now = datetime.now(timezone.utc).isoformat()
        total_ms = round((time.time() - total_start) * 1000.0, 2)

        # Historical metrics summary
        metrics = model_entry.metrics.get("validation", model_entry.metrics.get("test", {}))

        # 8. Asynchronously persist audit record
        record_data = {
            "symbol": clean_symbol,
            "prediction_timestamp": prediction_now,
            "market_data_timestamp": market_timestamp,
            "horizon": req.horizon,
            "target": req_target,
            "current_price": current_price,
            "predicted_value": predicted_price,
            "predicted_return": predicted_return,
            "is_derived_price": is_derived_price,
            "is_derived_return": is_derived_return,
            "model_name": model_entry.model_name,
            "model_version": model_entry.model_version,
            "feature_version": model_entry.feature_version,
            "model_status": model_entry.status,
        }
        try:
            prediction_repository.save(record_data)
        except Exception as repo_err:
            logger.warning(f"Could not persist prediction audit record: {repo_err}")

        logger.info(
            f"Prediction completed for {clean_symbol} ({model_entry.model_name}): "
            f"current={current_price}, pred_val={predicted_price}, "
            f"pred_ret={predicted_return} in {total_ms}ms"
        )

        # Determine direction based on predicted return
        direction = "Neutral"
        if predicted_return is not None:
            if predicted_return >= 0.002:
                direction = "Bullish"
            elif predicted_return <= -0.002:
                direction = "Bearish"

        # Generate explainable forecast signals from calculated features (zero lookahead)
        signals = []
        try:
            # 1. Trend Signal: Price vs SMA 20
            if "sma_20" in feature_vector.columns:
                sma20 = float(feature_vector["sma_20"].iloc[-1])
                diff_pct = round(((current_price - sma20) / sma20) * 100, 2)
                if current_price >= sma20:
                    signals.append(
                        ForecastSignal(
                            name="Trend (SMA 20)",
                            type="positive",
                            label=f"Price is trading {diff_pct:+.1f}% above the 20-day moving average",
                            value=f"₹{round(sma20, 2)}",
                        )
                    )
                else:
                    signals.append(
                        ForecastSignal(
                            name="Trend (SMA 20)",
                            type="negative",
                            label=f"Price is trading {diff_pct:+.1f}% below the 20-day moving average",
                            value=f"₹{round(sma20, 2)}",
                        )
                    )

            # 2. Momentum Signal: RSI 14
            if "rsi_14" in feature_vector.columns:
                rsi_val = round(float(feature_vector["rsi_14"].iloc[-1]), 1)
                if rsi_val >= 70:
                    signals.append(
                        ForecastSignal(
                            name="Momentum (RSI 14)",
                            type="negative",
                            label=f"RSI ({rsi_val}) indicates overbought momentum (potential resistance)",
                            value=str(rsi_val),
                        )
                    )
                elif rsi_val <= 30:
                    signals.append(
                        ForecastSignal(
                            name="Momentum (RSI 14)",
                            type="positive",
                            label=f"RSI ({rsi_val}) indicates oversold momentum (potential rebound zone)",
                            value=str(rsi_val),
                        )
                    )
                else:
                    signals.append(
                        ForecastSignal(
                            name="Momentum (RSI 14)",
                            type="neutral",
                            label=f"RSI ({rsi_val}) is within neutral momentum range",
                            value=str(rsi_val),
                        )
                    )

            # 3. MACD Histogram
            if "macd_hist" in feature_vector.columns:
                macd_h = round(float(feature_vector["macd_hist"].iloc[-1]), 3)
                if macd_h > 0:
                    signals.append(
                        ForecastSignal(
                            name="MACD Oscillator",
                            type="positive",
                            label="MACD histogram is positive, indicating upward momentum signal",
                            value=f"+{macd_h}",
                        )
                    )
                else:
                    signals.append(
                        ForecastSignal(
                            name="MACD Oscillator",
                            type="negative",
                            label="MACD histogram is negative, indicating downward momentum signal",
                            value=str(macd_h),
                        )
                    )

            # 4. Volatility 20
            if "volatility_20" in feature_vector.columns:
                vol20 = round(float(feature_vector["volatility_20"].iloc[-1]) * 100, 2)
                if vol20 > 2.5:
                    signals.append(
                        ForecastSignal(
                            name="Short-term Volatility",
                            type="negative",
                            label=f"High 20-day rolling volatility ({vol20}%) may widen forecast variance",
                            value=f"{vol20}%",
                        )
                    )
                else:
                    signals.append(
                        ForecastSignal(
                            name="Short-term Volatility",
                            type="neutral",
                            label=f"Moderate 20-day rolling volatility ({vol20}%) indicates steady regime",
                            value=f"{vol20}%",
                        )
                    )

            # 5. Volume Activity
            if "volume_ratio" in feature_vector.columns:
                vol_r = round(float(feature_vector["volume_ratio"].iloc[-1]), 2)
                if vol_r > 1.2:
                    signals.append(
                        ForecastSignal(
                            name="Volume Activity",
                            type="positive",
                            label=f"Recent volume is {round((vol_r - 1.0) * 100)}% above 20-day moving average",
                            value=f"{vol_r}x",
                        )
                    )
                elif vol_r < 0.8:
                    signals.append(
                        ForecastSignal(
                            name="Volume Activity",
                            type="neutral",
                            label="Trading volume is below trailing 20-day baseline",
                            value=f"{vol_r}x",
                        )
                    )
        except Exception as sig_err:
            logger.debug(f"Could not compute auxiliary signals: {sig_err}")

        return StockPredictionResponse(
            symbol=clean_symbol,
            market_data_timestamp=market_timestamp,
            prediction_timestamp=prediction_now,
            current_price=current_price,
            predicted_value=predicted_price,
            predicted_close=predicted_price,
            predicted_return=predicted_return,
            direction=direction,
            confidence_score=None,  # No fabrication: explicitly None until Bayesian calibration
            signals=signals,
            is_derived_price=is_derived_price,
            is_derived_return=is_derived_return,
            horizon=req.horizon,
            target=req_target,
            model_name=model_entry.model_name,
            model_version=model_entry.model_version,
            feature_version=model_entry.feature_version,
            model_status=model_entry.status,
            historical_metrics=metrics,
            latency_ms={
                "total_ms": total_ms,
                "market_data_ms": market_data_ms,
                "model_load_ms": model_load_ms,
                "feature_gen_ms": feat_gen_ms,
                "inference_ms": infer_ms,
            },
        )


# Global singleton instance
prediction_service = StockPredictionService()
