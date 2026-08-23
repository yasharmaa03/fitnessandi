#!/bin/bash

# start-services.sh - Start all required services for FitnessAndi

set -e

echo "🚀 Starting FitnessAndi Services..."
echo ""

# Check if Python virtual environment exists
if [ ! -d "ml/venv" ]; then
    echo "⚠️  Python virtual environment not found. Creating it..."
    cd ml
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
    echo "✅ Virtual environment created and dependencies installed"
    echo ""
fi

# Start ML Workout Service
echo "Starting ML Workout Recommendation Service (port 8001)..."
cd ml
source venv/bin/activate
# Export Supabase credentials so workout_server.py can query the DB
export SUPABASE_URL=$(grep '^SUPABASE_URL=' ../.env.local | cut -d '=' -f2-)
export SUPABASE_SERVICE_KEY=$(grep '^SUPABASE_SERVICE_KEY=' ../.env.local | cut -d '=' -f2-)
uvicorn workout_server:app --host 0.0.0.0 --port 8001 --reload &
ML_WORKOUT_PID=$!
cd ..
echo "✅ ML Workout Service started (PID: $ML_WORKOUT_PID)"
echo ""

# Start Next.js Development Server
echo "⚛️  Starting Next.js Development Server (port 3000)..."
npm run dev &
NEXT_PID=$!
echo "✅ Next.js started (PID: $NEXT_PID)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All services started successfully!"
echo ""
echo "📱 Application: http://localhost:3000"
echo "🏋️  Workout ML API: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for Ctrl+C
trap "echo '\n🛑 Stopping all services...'; kill $ML_WORKOUT_PID $NEXT_PID 2>/dev/null; echo '✅ All services stopped'; exit" INT
wait
