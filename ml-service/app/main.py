from contextlib import asynccontextmanager
from datetime import datetime, timezone
import time
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logger import logger
from app.core.observability import ObservabilityMiddleware, ml_metrics
from app.ml.classifier import classifier
from app.routers.categorization import router as categorization_router
from app.routers.recurring import router as recurring_router
from app.routers.predictions import router as predictions_router
from app.routers.models import router as models_router
from app.routers.forecasting import router as forecasting_router
from app.routers.anomalies import router as anomalies_router
from app.routers.universe_predictions import router as universe_predictions_router

START_TIME = time.time()
_IS_READY = False


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _IS_READY
    # Startup logic: Warm up and load ML model
    logger.info(f">> {settings.APP_NAME} starting on port {settings.PORT} [{settings.PYTHON_ENV}]")
    try:
        classifier.load_model()
        _IS_READY = True
        logger.info(">> Transaction Categorization ML pipeline initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize ML pipeline: {e}")
        _IS_READY = False
    yield
    # Shutdown logic
    logger.info(f"Stopping {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description="SmartFin AI — Specialized Machine Learning & Quantitative Analytics Microservice",
    version="1.0.0",
    docs_url="/docs" if settings.PYTHON_ENV == "development" else None,
    redoc_url="/redoc" if settings.PYTHON_ENV == "development" else None,
    lifespan=lifespan,
)

cors_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["x-request-id", "x-correlation-id"],
)

# Unified Observability Middleware (Request ID tracing, structured logging, latency metrics)
app.add_middleware(ObservabilityMiddleware)

app.include_router(categorization_router, prefix="/api/v1/ml")
app.include_router(categorization_router)
app.include_router(recurring_router, prefix="/api/v1/ml")
app.include_router(recurring_router)
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(forecasting_router, prefix="/api/v1")
app.include_router(forecasting_router)
app.include_router(anomalies_router, prefix="/api/v1")
app.include_router(anomalies_router)
app.include_router(universe_predictions_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def get_health():
    """Health check endpoint to verify ML service availability and uptime."""
    uptime_seconds = int(time.time() - START_TIME)
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.PYTHON_ENV,
        "uptimeSeconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/live", tags=["Health"])
async def get_liveness():
    """Liveness probe: verifies the ML service process is alive."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/health/ready", tags=["Health"])
async def get_readiness():
    """Readiness probe: verifies ML pipelines and models are ready to serve."""
    return {
        "status": "ok" if _IS_READY else "warming_up",
        "ready": _IS_READY,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics", tags=["Observability"])
async def get_metrics():
    """Expose Prometheus-compatible metrics for the ML microservice."""
    content = ml_metrics.to_prometheus()
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
