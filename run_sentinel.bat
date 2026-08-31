@echo off
echo ===================================================
echo   STARTING SENTINEL AI DEFENSE PLATFORM
echo ===================================================

echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "SENTINEL Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching React Dashboard on http://localhost:5173 ...
cd frontend
start "SENTINEL Frontend" cmd /k "npm run dev"

echo.
echo SENTINEL AI is launching!
echo Open your browser to http://localhost:5173
echo ===================================================

