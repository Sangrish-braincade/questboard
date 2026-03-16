#!/bin/bash
# Questboard — Dev server launcher (macOS/Linux)

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Starting Questboard Dev Servers ==="
echo ""

# Start Python backend
echo "[Backend] Starting FastAPI on http://localhost:7777"
cd "$ROOT/server"
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 7777 --reload &
BACKEND_PID=$!

sleep 2

# Start Vite frontend
echo "[Frontend] Starting Vite on http://localhost:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== Both servers running ==="
echo ""
echo "  DM view:     http://localhost:5173/dm"
echo "  Player view:  http://localhost:5173/play"
echo "  API docs:     http://localhost:7777/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
