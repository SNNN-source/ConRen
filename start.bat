@echo off
REM Windows helper script for beginners.
REM This script builds the frontend and then starts the backend server.
REM It assumes Node.js is installed and the backend virtual environment already exists.

echo =======================================
echo     ConRen - Starting Application
echo =======================================

echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
REM Install frontend packages if needed.
call npm install --silent
REM Build the production frontend into frontend\dist.
call npm run build

echo.
echo [2/2] Starting backend server (serving frontend on port 8000)...
cd /d "%~dp0backend"
REM Activate the backend Python virtual environment.
call .\venv\Scripts\activate
echo.
echo App running at: http://localhost:8000
echo   Press Ctrl+C to stop.
echo.
REM Start the FastAPI app with auto-reload for development.
uvicorn main:app --port 8000 --host 0.0.0.0 --reload
