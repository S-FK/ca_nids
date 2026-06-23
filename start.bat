bat_content = """@echo off
setlocal enabledelayedexpansion

:: Set code page to UTF-8 to properly display the box-drawing characters
chcp 65001 >nul

:: Change to the directory of the batch file
cd /d "%~dp0"

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║       CA-xNIDS Live Threat Monitor       ║
echo   ╚══════════════════════════════════════════╝
echo.

:: Kill any leftover processes on our ports (Equivalent to lsof | xargs kill)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

:: Sleep for a moment (timeout is the Windows equivalent of sleep)
timeout /t 1 /nobreak >nul

echo   [1/2] Starting FastAPI backend on http://localhost:8000 ...
:: start /B runs the command in the background without opening a new window
start /B "" python -m uvicorn backend.main:app --port 8000 --log-level warning

:: Give the Python backend 5 seconds to load the ML model before starting Vite
echo   Waiting for backend model to initialize...
timeout /t 5 /nobreak >nul

echo   [2/2] Starting React frontend on http://localhost:5173 ...
cd frontend
start /B "" npm run dev -- --open
cd ..

echo.
echo   Dashboard -^> http://localhost:5173
echo   Backend   -^> http://localhost:8000/api/status
echo.
echo   Press any key to stop both servers...
echo.

:: Wait for user input to terminate
pause >nul

:: Cleanup on exit
echo   Stopping servers...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

echo   Stopped.
"""

with open("start.bat", "w", encoding="utf-8") as f:
    f.write(bat_content)

print("Created start.bat")