#!/usr/bin/env bash
# CA-xNIDS Dashboard — start both servers
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       CA-xNIDS Live Threat Monitor       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Kill any leftover processes on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 0.5

echo "  [1/2] Starting FastAPI backend on http://localhost:8000 …"
python -m uvicorn backend.main:app --port 8000 --log-level warning &
BACKEND_PID=$!

echo "  [2/2] Starting React frontend on http://localhost:5173 …"
cd frontend && npm run dev -- --open &
FRONTEND_PID=$!

echo ""
echo "  Dashboard → http://localhost:5173"
echo "  Backend   → http://localhost:8000/api/status"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '  Stopped.'" EXIT
wait
