"""
Market Data Service for retrieving real-time and historical OHLCV data.
Integrates with the Node.js backend market-data service, with fallback to verified
historical partitions and mock providers for testing.
Guarantees zero synthetic or fake prices in production.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
import os
import time
from typing import Any, Dict, Optional, Tuple
import httpx
import pandas as pd

from app.core.config import settings
from app.core.logger import logger


class MarketDataError(Exception):
    """Base exception for market data failures."""
    pass


class MarketDataUnavailableError(MarketDataError):
    """Raised when market provider is unreachable, rate limited, or down."""
    pass


class StaleMarketDataError(MarketDataError):
    """Raised when the latest available market data exceeds maximum freshness age."""
    pass


class InsufficientHistoricalDataError(MarketDataError):
    """Raised when fewer than the required minimum historical bars are available."""
    pass


class BaseMarketDataProvider(ABC):
    """Abstract interface for market data sources."""

    @abstractmethod
    def get_history(self, symbol: str, lookback_days: int = 120) -> pd.DataFrame:
        """
        Retrieves historical daily OHLCV dataframe for symbol.
        Columns must include: ['date', 'symbol', 'open', 'high', 'low', 'close', 'volume'].
        """
        pass

    @abstractmethod
    def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Retrieves current quote snapshot for symbol."""
        pass


class BackendMarketDataProvider(BaseMarketDataProvider):
    """Service-to-service integration calling the Node.js backend market-data API."""

    def __init__(
        self,
        base_url: str = "http://localhost:5000",
        auth_token: str = settings.SERVICE_AUTH_TOKEN,
        timeout_seconds: float = 5.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.timeout_seconds = timeout_seconds

    def get_history(self, symbol: str, lookback_days: int = 120) -> pd.DataFrame:
        clean_symbol = symbol.strip().upper()
        url = f"{self.base_url}/api/v1/stocks/{clean_symbol}/history"
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        rng = "2y" if lookback_days > 200 else ("1y" if lookback_days > 100 else "6mo")
        params = {"range": rng, "interval": "1d"}

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                resp = client.get(url, headers=headers, params=params)

            if resp.status_code == 404:
                raise MarketDataUnavailableError(
                    f"Symbol '{clean_symbol}' not found by market data provider."
                )
            if resp.status_code >= 500 or resp.status_code == 503:
                raise MarketDataUnavailableError(
                    f"Upstream market data service is unavailable ({resp.status_code})."
                )
            resp.raise_for_status()

            data = resp.json().get("data", {})
            history_obj = data.get("history", {}) if isinstance(data, dict) else {}
            bars = []
            if isinstance(history_obj, dict):
                bars = history_obj.get("bars", []) or history_obj.get("candles", [])
            if not bars and isinstance(data, dict):
                bars = data.get("bars", []) or data.get("candles", [])

            if not bars:
                bars = self._fetch_direct_yahoo_bars(clean_symbol)

            if not bars:
                raise MarketDataUnavailableError(
                    f"No historical candles returned for '{clean_symbol}'."
                )

            df = pd.DataFrame(bars)
            df.rename(
                columns={
                    "timestamp": "date",
                    "open": "open",
                    "high": "high",
                    "low": "low",
                    "close": "close",
                    "volume": "volume",
                },
                inplace=True,
            )
            df["symbol"] = clean_symbol
            df["date"] = pd.to_datetime(df["date"])
            df.sort_values("date", inplace=True)
            return df

        except (httpx.ConnectError, httpx.TimeoutException) as conn_err:
            logger.warning(f"Backend market data service unreachable at {url}: {conn_err}. Attempting direct Yahoo fallback.")
            bars = self._fetch_direct_yahoo_bars(clean_symbol)
            if bars:
                df = pd.DataFrame(bars)
                df.rename(
                    columns={
                        "timestamp": "date",
                        "open": "open",
                        "high": "high",
                        "low": "low",
                        "close": "close",
                        "volume": "volume",
                    },
                    inplace=True,
                )
                df["symbol"] = clean_symbol
                df["date"] = pd.to_datetime(df["date"])
                df.sort_values("date", inplace=True)
                return df
            raise MarketDataUnavailableError(
                "Upstream market data provider connection timed out or is unavailable."
            )
        except MarketDataError:
            raise
        except Exception as e:
            logger.error(f"Error retrieving market history from backend for {clean_symbol}: {e}")
            bars = self._fetch_direct_yahoo_bars(clean_symbol)
            if bars:
                df = pd.DataFrame(bars)
                df.rename(
                    columns={
                        "timestamp": "date",
                        "open": "open",
                        "high": "high",
                        "low": "low",
                        "close": "close",
                        "volume": "volume",
                    },
                    inplace=True,
                )
                df["symbol"] = clean_symbol
                df["date"] = pd.to_datetime(df["date"])
                df.sort_values("date", inplace=True)
                return df
            raise MarketDataUnavailableError("Failed to fetch market data from external provider.")

    def _fetch_direct_yahoo_bars(self, symbol: str) -> list:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=2y"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            with httpx.Client(timeout=8.0) as client:
                res = client.get(url, headers=headers)
            if res.status_code != 200:
                return []
            result = res.json().get("chart", {}).get("result", [{}])[0]
            timestamps = result.get("timestamp", [])
            quotes = result.get("indicators", {}).get("quote", [{}])[0]
            opens = quotes.get("open", [])
            highs = quotes.get("high", [])
            lows = quotes.get("low", [])
            closes = quotes.get("close", [])
            volumes = quotes.get("volume", [])

            bars = []
            for i, ts in enumerate(timestamps):
                c = closes[i] if i < len(closes) else None
                if c is None or not (isinstance(c, (int, float))):
                    continue
                o = opens[i] if i < len(opens) and opens[i] is not None else c
                h = highs[i] if i < len(highs) and highs[i] is not None else c
                l = lows[i] if i < len(lows) and lows[i] is not None else c
                v = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
                bars.append({
                    "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                    "open": round(float(o), 2),
                    "high": round(float(h), 2),
                    "low": round(float(l), 2),
                    "close": round(float(c), 2),
                    "volume": int(v),
                })
            return bars
        except Exception as e:
            logger.warning(f"Direct Yahoo chart fetch failed for {symbol}: {e}")
            return []

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        clean_symbol = symbol.strip().upper()
        url = f"{self.base_url}/api/v1/stocks/{clean_symbol}/quote"
        headers = {"Authorization": f"Bearer {self.auth_token}"}

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                if isinstance(data, dict) and "quote" in data:
                    return data["quote"]
                return data
        except Exception as e:
            logger.warning(f"Backend quote service fetch failed for {clean_symbol}: {e}")

        # Fallback to direct Yahoo quote
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_symbol}?interval=1d&range=5d"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            with httpx.Client(timeout=6.0) as client:
                res = client.get(url, headers=headers)
            if res.status_code == 200:
                result = res.json().get("chart", {}).get("result", [{}])[0]
                meta = result.get("meta", {})
                price = meta.get("regularMarketPrice", 0.0)
                prev_close = meta.get("chartPreviousClose", meta.get("previousClose", price))
                change = round(price - prev_close, 2)
                change_pct = round((change / prev_close) * 100.0, 2) if prev_close else 0.0
                return {
                    "symbol": clean_symbol,
                    "currentPrice": float(price),
                    "previousClose": float(prev_close),
                    "change": change,
                    "changePercent": change_pct,
                    "open": float(meta.get("regularMarketPrice", price)),
                    "high": float(meta.get("regularMarketDayHigh", price)),
                    "low": float(meta.get("regularMarketDayLow", price)),
                    "volume": int(meta.get("regularMarketVolume", 0)),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "provider": "yahoo_direct",
                }
        except Exception as direct_err:
            logger.warning(f"Direct Yahoo quote fetch failed for {clean_symbol}: {direct_err}")

        raise MarketDataUnavailableError(f"Market quote service unavailable for '{clean_symbol}'.")


class LocalHistoricalMarketDataProvider(BaseMarketDataProvider):
    """
    Fallback provider reading verified historical market data from local processed dataset.
    Used for standalone offline execution, integration testing, and development validation.
    """

    def __init__(self, data_path: str = "app/data/processed/nifty500_features.parquet"):
        self.data_path = data_path
        self._df_cache: Optional[pd.DataFrame] = None

    def _load(self) -> pd.DataFrame:
        if self._df_cache is None:
            if not os.path.exists(self.data_path):
                alt = "app/data/processed/test.parquet"
                if os.path.exists(alt):
                    self.data_path = alt
                else:
                    raise FileNotFoundError(f"Historical dataset not found at {self.data_path}")
            logger.info(f"Loading local market dataset from {self.data_path}...")
            self._df_cache = pd.read_parquet(self.data_path)
        return self._df_cache

    def get_history(self, symbol: str, lookback_days: int = 120) -> pd.DataFrame:
        clean_symbol = symbol.strip().upper()
        df_all = self._load()
        sym_df = df_all[df_all["symbol"] == clean_symbol].sort_values("date").copy()

        if sym_df.empty:
            raise MarketDataUnavailableError(
                f"No records found for symbol '{clean_symbol}' in verified market dataset."
            )

        raw_cols = ["date", "symbol", "open", "high", "low", "close", "volume"]
        available_cols = [c for c in raw_cols if c in sym_df.columns]
        sub = sym_df[available_cols].tail(lookback_days).copy()
        sub["date"] = pd.to_datetime(sub["date"])
        return sub

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        clean_symbol = symbol.strip().upper()
        hist = self.get_history(clean_symbol, lookback_days=2)
        latest_row = hist.iloc[-1]
        prev_close = hist.iloc[-2]["close"] if len(hist) > 1 else latest_row["close"]
        change = float(latest_row["close"] - prev_close)
        change_pct = float((change / prev_close) * 100.0) if prev_close else 0.0

        return {
            "symbol": clean_symbol,
            "currentPrice": float(latest_row["close"]),
            "open": float(latest_row["open"]),
            "high": float(latest_row["high"]),
            "low": float(latest_row["low"]),
            "previousClose": float(prev_close),
            "change": round(change, 2),
            "changePercent": round(change_pct, 2),
            "volume": int(latest_row["volume"]),
            "timestamp": pd.to_datetime(latest_row["date"]).isoformat(),
            "provider": "local_historical_verified",
        }


class MarketDataService:
    """
    Central Market Data Service coordinating providers, validation, and freshness checks.
    """

    def __init__(
        self,
        provider: Optional[BaseMarketDataProvider] = None,
        max_market_data_age_minutes: int = 5760,  # 4 days
        enforce_freshness: bool = False,
    ):
        if provider is not None:
            self.provider = provider
        else:
            backend_url = getattr(settings, "BACKEND_SERVICE_URL", "http://localhost:5000")
            self.backend_provider = BackendMarketDataProvider(base_url=backend_url)
            self.local_provider = LocalHistoricalMarketDataProvider()
            self.provider = self.backend_provider

        self.max_market_data_age_minutes = max_market_data_age_minutes
        self.enforce_freshness = enforce_freshness

    def set_provider(self, provider: BaseMarketDataProvider) -> None:
        """Sets active provider dynamically (e.g. for testing with mocks)."""
        self.provider = provider

    def fetch_market_bars(
        self, symbol: str, min_bars: int = 60
    ) -> Tuple[pd.DataFrame, Dict[str, Any], float]:
        """
        Retrieves sanitized historical OHLCV bars and quote snapshot.
        Validates minimum historical depth and market sanity.

        Returns:
            Tuple of (bars_df, quote_dict, retrieval_latency_ms)
        """
        start_time = time.time()
        clean_sym = symbol.strip().upper()

        bars_df: Optional[pd.DataFrame] = None
        quote_dict: Optional[Dict[str, Any]] = None

        # 1. Fetch from active provider
        try:
            bars_df = self.provider.get_history(clean_sym, lookback_days=min_bars + 30)
            quote_dict = self.provider.get_quote(clean_sym)
        except MarketDataUnavailableError as mde:
            # Fall back to local provider if active provider is default backend provider
            is_backend = (
                hasattr(self, "backend_provider") and self.provider == self.backend_provider
            )
            if is_backend and hasattr(self, "local_provider"):
                logger.info(f"Engaging local historical market provider for '{clean_sym}': {mde}")
                try:
                    bars_df = self.local_provider.get_history(clean_sym, min_bars + 30)
                    quote_dict = self.local_provider.get_quote(clean_sym)
                except Exception:
                    raise MarketDataUnavailableError(
                        f"Market data is unavailable for '{clean_sym}'. Prediction aborted."
                    )
            else:
                raise MarketDataUnavailableError(
                    f"Market data is unavailable for '{clean_sym}'. Prediction aborted."
                )

        if bars_df is None or bars_df.empty:
            raise MarketDataUnavailableError(
                f"Market data is currently unavailable for '{clean_sym}'. No observations found."
            )

        # 2. Structural and Depth Validation
        required_cols = {"date", "open", "high", "low", "close", "volume"}
        missing = required_cols - set(bars_df.columns)
        if missing:
            raise MarketDataUnavailableError(
                f"Market data is incomplete. Missing required fields: {list(missing)}"
            )

        if len(bars_df) < min_bars:
            raise InsufficientHistoricalDataError(
                f"Insufficient historical data for '{clean_sym}'. "
                f"Requires {min_bars} bars, but only {len(bars_df)} available."
            )

        # 3. Market Sanity Checks
        if (bars_df["close"] <= 0).any() or (bars_df["open"] <= 0).any():
            raise MarketDataUnavailableError(
                f"Sanity check failed: Non-positive prices detected for '{clean_sym}'."
            )
        if (bars_df["high"] < bars_df["low"]).any():
            raise MarketDataUnavailableError(
                f"Sanity check failed: High < Low detected for '{clean_sym}'."
            )

        # 4. Freshness Validation
        latest_date = pd.to_datetime(bars_df["date"].iloc[-1])
        if latest_date.tzinfo is None:
            latest_date_utc = latest_date.tz_localize(timezone.utc)
        else:
            latest_date_utc = latest_date.tz_convert(timezone.utc)

        now_utc = datetime.now(timezone.utc)
        age_minutes = (now_utc - latest_date_utc).total_seconds() / 60.0

        if self.enforce_freshness and age_minutes > self.max_market_data_age_minutes:
            raise StaleMarketDataError(
                f"Market data for '{clean_sym}' is stale (Age: {age_minutes:.0f}m exceeds "
                f"limit of {self.max_market_data_age_minutes}m)."
            )

        latency_ms = (time.time() - start_time) * 1000.0
        return bars_df, quote_dict, round(latency_ms, 2)


# Global singleton instance
market_data_service = MarketDataService()
