#!/usr/bin/env bash
set -e

SERVICE=${1:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "=========================================================="
echo "SMARTFIN AI — Starting Development Services [$SERVICE]"
echo "=========================================================="

if [ "$SERVICE" = "backend" ] || [ "$SERVICE" = "all" ]; then
    echo "Starting Backend API (Port 5000)..."
    (cd "$ROOT_DIR/backend" && npm run dev) &
fi

if [ "$SERVICE" = "ml" ] || [ "$SERVICE" = "all" ]; then
    echo "Starting ML Microservice (Port 8000)..."
    (cd "$ROOT_DIR/ml-service" && [ -f .venv/bin/activate ] && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000) &
fi

if [ "$SERVICE" = "frontend" ] || [ "$SERVICE" = "all" ]; then
    echo "Starting Frontend Client (Port 5173)..."
    (cd "$ROOT_DIR/frontend" && npm run dev) &
fi

wait
