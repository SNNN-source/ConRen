@echo off
echo =======================================
echo     ConRen - Starting Application
echo =======================================

echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm install --silent
call npm run build

echo.
echo [2/2] Starting backend server (serving frontend on port 8000)...
cd /d "%~dp0backend"
call .\venv\Scripts\activate
echo.
echo ✓ App running at: http://localhost:8000
echo   Press Ctrl+C to stop.
echo.
uvicorn main:app --port 8000 --host 0.0.0.0 --reload
