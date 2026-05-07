#!/bin/bash
# Spendemic startup script
# Starts the local backend (with Chronos AI model) and ngrok tunnel.
# The frontend and database are already hosted on Vercel and Neon.

# Stop any previous instances
lsof -ti:8000 | xargs kill -9 2>/dev/null
pkill -f ngrok 2>/dev/null
sleep 2

# Move into the backend folder and activate the Python environment
cd "$(dirname "$0")/backend"
source .venv/bin/activate

# Start the FastAPI backend (includes the Chronos forecasting model)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/spendemic_backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check the backend actually started
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "Backend failed to start:"
  cat /tmp/spendemic_backend.log
  exit 1
fi

# Start ngrok tunnel
ngrok http --url=context-chaste-pristine.ngrok-free.dev 8000 > /tmp/spendemic_ngrok.log 2>&1 &
NGROK_PID=$!
sleep 4

# Check ngrok actually started
if ! kill -0 $NGROK_PID 2>/dev/null; then
  echo "Ngrok failed to start:"
  cat /tmp/spendemic_ngrok.log
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# Get the actual tunnel URL from ngrok's local API
TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null)

echo ""
echo "Backend:  http://localhost:8000"
echo "Tunnel:   ${TUNNEL_URL:-https://context-chaste-pristine.ngrok-free.dev}"
echo "App:      https://spendemic-rosy.vercel.app"
echo ""

# If the tunnel URL differs from the static domain, remind to update Render
if [ -n "$TUNNEL_URL" ] && [ "$TUNNEL_URL" != "https://context-chaste-pristine.ngrok-free.dev" ]; then
  echo "ACTION NEEDED: Tunnel URL changed."
  echo "Go to Render → your service → Environment → set:"
  echo "  FORECAST_API_URL = $TUNNEL_URL"
  echo ""
fi

echo "Press Ctrl+C to stop."

# Keep running — Ctrl+C stops both processes cleanly
trap "kill $BACKEND_PID $NGROK_PID 2>/dev/null; echo 'Stopped.'" INT TERM EXIT
wait $BACKEND_PID $NGROK_PID
