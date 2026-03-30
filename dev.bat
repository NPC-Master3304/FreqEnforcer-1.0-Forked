@echo off
title FreqEnforcer Dev
cd /d "%~dp0"

echo Cleaning up leftover processes on ports 5174 and 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5174 " ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8765 " ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

echo [1/3] Starting FastAPI backend (port 8765)...
start "" /b python server/main.py > "%TEMP%\fe-backend.log" 2>&1

echo [2/3] Starting Vite dev server (port 5174)...
start "" /b npx vite > "%TEMP%\fe-vite.log" 2>&1

echo [3/3] Launching Electron (splash screen polls for Vite)...
npx electron electron/main.js

echo.
echo Dev session ended.
pause
