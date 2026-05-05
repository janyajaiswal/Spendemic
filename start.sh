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
uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/spendemic_backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check the backend actually started
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "Backend failed to start:"
  cat /tmp/spendemic_backend.log
  exit 1
fi

# Start ngrok to expose localhost:8000 to the internet
# (so the Vercel frontend can reach the local Chronos model)
ngrok http --url=context-chaste-pristine.ngrok-free.dev 8000 > /tmp/spendemic_ngrok.log 2>&1 &
NGROK_PID=$!
sleep 3

# Check ngrok actually started
if ! kill -0 $NGROK_PID 2>/dev/null; then
  echo "Ngrok failed to start:"
  cat /tmp/spendemic_ngrok.log
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo ""
echo "Backend:  http://localhost:8000"
echo "Tunnel:   https://context-chaste-pristine.ngrok-free.dev"
echo "App:      https://spendemic-rosy.vercel.app"
echo ""
echo "Press Ctrl+C to stop."

# Keep the script running — Ctrl+C stops both processes cleanly
trap "kill $BACKEND_PID $NGROK_PID 2>/dev/null; echo 'Stopped.'" INT TERM EXIT
wait $BACKEND_PID $NGROK_PID
