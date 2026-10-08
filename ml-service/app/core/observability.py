import time
import uuid
import re
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.logger import logger


class MLMetricsTracker:
    def __init__(self):
        self.requests_total: Dict[str, int] = {}
        self.inference_total: Dict[str, int] = {}
        self.inference_latencies: Dict[str, List[float]] = {}
        self.http_latencies: List[float] = []
        self.max_samples = 1000
        self.started_at = time.time()

    def record_request(self, method: str, route: str, status_code: int, duration_ms: float):
        status_class = f"{status_code // 100}xx"
        key = f"{method}_{route}_{status_class}"
        self.requests_total[key] = self.requests_total.get(key, 0) + 1

        if len(self.http_latencies) >= self.max_samples:
            self.http_latencies.pop(0)
        self.http_latencies.append(duration_ms)

    def record_inference(
        self,
        model_name: str,
        model_version: str,
        feature_version: str,
        success: bool,
        duration_ms: float,
    ):
        status = "success" if success else "failure"
        key = f"{model_name}_{model_version}_{status}"
        self.inference_total[key] = self.inference_total.get(key, 0) + 1

        if model_name not in self.inference_latencies:
            self.inference_latencies[model_name] = []
        samples = self.inference_latencies[model_name]
        if len(samples) >= self.max_samples:
            samples.pop(0)
        samples.append(duration_ms)

    def get_quantiles(self, samples: List[float]) -> Dict[str, float]:
        if not samples:
            return {"p50": 0.0, "p95": 0.0, "p99": 0.0, "avg": 0.0}
        sorted_samples = sorted(samples)
        count = len(sorted_samples)
        p50 = sorted_samples[int(count * 0.50)]
        p95 = sorted_samples[min(int(count * 0.95), count - 1)]
        p99 = sorted_samples[min(int(count * 0.99), count - 1)]
        avg = round(sum(sorted_samples) / count, 2)
        return {"p50": p50, "p95": p95, "p99": p99, "avg": avg}

    def to_prometheus(self) -> str:
        lines = [
            "# HELP smartfin_ml_uptime_seconds Process uptime in seconds",
            "# TYPE smartfin_ml_uptime_seconds gauge",
            f"smartfin_ml_uptime_seconds {int(time.time() - self.started_at)}",
            "# HELP smartfin_ml_http_requests_total Total HTTP requests handled",
            "# TYPE smartfin_ml_http_requests_total counter",
        ]
        for key, count in self.requests_total.items():
            parts = key.split("_")
            if len(parts) >= 3:
                m, r, s = parts[0], parts[1], parts[2]
                lines.append(f'smartfin_ml_http_requests_total{{method="{m}",route="{r}",status="{s}"}} {count}')

        lines.extend([
            "# HELP smartfin_ml_inference_total Total ML inference operations",
            "# TYPE smartfin_ml_inference_total counter",
        ])
        for key, count in self.inference_total.items():
            parts = key.split("_")
            if len(parts) >= 3:
                m, v, s = parts[0], parts[1], parts[2]
                lines.append(f'smartfin_ml_inference_total{{model="{m}",version="{v}",status="{s}"}} {count}')

        return "\n".join(lines) + "\n"


ml_metrics = MLMetricsTracker()


def log_structured_event(
    event: str,
    level: str = "INFO",
    request_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
    **metadata,
):
    """Outputs a uniform structured JSON log record."""
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level.lower(),
        "service": "ml_service",
        "event": event,
        "requestId": request_id or "unknown",
    }
    if duration_ms is not None:
        payload["durationMs"] = round(duration_ms, 2)
    if metadata:
        payload["metadata"] = metadata

    log_msg = json.dumps(payload)
    if level.upper() in ("ERROR", "FATAL"):
        logger.error(log_msg)
    elif level.upper() == "WARN":
        logger.warning(log_msg)
    else:
        logger.info(log_msg)


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # 1. Request ID Handling & Propagation
        req_id = (
            request.headers.get("x-request-id")
            or request.headers.get("x-correlation-id")
            or str(uuid.uuid4())
        )
        # Sanitize against injection
        req_id = re.sub(r"[^a-zA-Z0-9\-_]", "", req_id)[:64]
        request.state.request_id = req_id

        # 2. Execute Request
        response: Response = await call_next(request)

        # 3. Post-execution telemetry
        duration_ms = round((time.time() - start_time) * 1000, 2)
        route = request.url.path
        # Normalize route IDs
        norm_route = re.sub(r"[0-9a-fA-F]{24}", ":id", route)
        norm_route = re.sub(r"/[A-Z0-9\.\-]{1,10}(?=/quote|/history|$)", "/:symbol", norm_route)

        ml_metrics.record_request(request.method, norm_route, response.status_code, duration_ms)

        log_level = "ERROR" if response.status_code >= 500 else ("WARN" if response.status_code >= 400 else "INFO")
        event = "HTTP_ERROR" if response.status_code >= 500 else "HTTP_REQUEST"

        log_structured_event(
            event=event,
            level=log_level,
            request_id=req_id,
            duration_ms=duration_ms,
            method=request.method,
            route=norm_route,
            statusCode=response.status_code,
        )

        response.headers["X-Request-ID"] = req_id
        response.headers["X-Correlation-ID"] = req_id
        return response
