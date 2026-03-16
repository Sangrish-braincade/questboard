#!/bin/bash
# Questboard — macOS/Linux setup script

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Questboard Setup ==="
echo ""

# --- Python backend ---
echo "[1/3] Setting up Python backend..."

cd "$ROOT/server"
if [ ! -d ".venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv .venv
fi

echo "  Installing Python dependencies..."
.venv/bin/pip install -r requirements.txt -q

# --- Frontend ---
echo "[2/3] Setting up frontend..."
cd "$ROOT/frontend"
npm install

# --- Electron ---
echo "[3/3] Setting up Electron..."
cd "$ROOT/electron"
npm install

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start development:"
echo "  ./scripts/dev.sh"
echo ""
