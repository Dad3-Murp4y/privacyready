#!/bin/bash

# Setup environment variables if not present
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Start Infrastructure
echo "Starting infrastructure services..."
docker-compose -f docker-compose.dev.yml up -d

# Start Scanner Service
echo "Starting Scanner Service on port 8080..."
cd services/scanner/cmd/scanner
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
nohup uvicorn main:app --reload --port 8080 > scanner.log 2>&1 &
cd ../../../..

# Start DSR Service
echo "Starting DSR Service on port 8000..."
cd services/dsr
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
nohup uvicorn main:app --reload --port 8000 > dsr.log 2>&1 &
cd ../..

# Start Frontend
echo "Starting Frontend on port 3001..."
cd frontend
nohup python3 -m http.server 3001 > frontend.log 2>&1 &
cd ..

echo "========================================="
echo "✅ Local Environment is running!"
echo "Frontend: http://localhost:3001"
echo "Scanner API: http://localhost:8080"
echo "DSR API: http://localhost:8000"
echo "Check scanner.log, dsr.log, and frontend/frontend.log for output."
echo "========================================="
