#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

echo "=========================================================="
echo "SMARTFIN AI — Running Automated Test Suites"
echo "=========================================================="

echo -e "\n>>> Running Backend Vitest Suite..."
(cd "$ROOT_DIR/backend" && npm run test)

echo -e "\n>>> Running ML Microservice Pytest Suite..."
(cd "$ROOT_DIR/ml-service" && [ -f .venv/bin/activate ] && source .venv/bin/activate && pytest)

echo -e "\nAll test suites passed cleanly!"
