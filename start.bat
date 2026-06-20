@echo off
title CA-xNIDS Dashboard

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║       CA-xNIDS Live Threat Monitor       ║
echo   ╚══════════════════════════════════════════╝
echo.

:: Kill anything already on port 8000 or 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo   [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "CA-xNIDS Backend" cmd /k "python -m uvicorn backend.main:app --port 8000 --log-level warning"

:: Give backend 2 seconds to start
timeout /t 2 /nobreak >nul

echo   [2/2] Starting React frontend on http://localhost:5173 ...
start "CA-xNIDS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo   Dashboard  ^>  http://localhost:5173
echo   Backend    ^>  http://localhost:8000/api/status
echo.
echo   Close the two terminal windows to stop both servers.
echo.
pause
