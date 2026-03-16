@echo off
title Questboard - Starting...
color 0D
echo.
echo   ========================================
echo    QUESTBOARD - D^&D 5e Session Manager
echo   ========================================
echo.

:: ─── Backend ──────────────────────────────────
echo   [1/3] Setting up backend...
cd /d "%~dp0server"

if not exist ".venv\Scripts\python.exe" (
    echo   Creating Python venv...
    python -m venv .venv
)

echo   Ensuring dependencies are installed...
.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel -q 2>nul
.venv\Scripts\pip.exe install -r requirements.txt -q 2>nul

echo   Starting backend server...
start /b "" .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7777
echo   Backend starting on port 7777...

:: ─── Wait for backend ─────────────────────────
timeout /t 3 /nobreak > nul

:: ─── Frontend ─────────────────────────────────
echo   [2/3] Setting up frontend...
cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo   Installing npm packages (takes a minute)...
    call npm install
)

:: Check if lucide-react is installed (fix for missing dep)
if not exist "node_modules\lucide-react" (
    echo   Installing missing dependency: lucide-react...
    call npm install lucide-react
)

echo   Starting frontend dev server...
start /b "" npx vite --host
timeout /t 4 /nobreak > nul

:: ─── Open browser ─────────────────────────────
echo   [3/3] Opening browser...
start http://localhost:5173

echo.
echo   ========================================
color 0A
echo    QUESTBOARD IS RUNNING!
echo.
echo    DM Dashboard:  http://localhost:5173/dm
echo    Player Join:   http://localhost:5173/play
echo    API Docs:      http://localhost:7777/docs
echo   ========================================
echo.
echo   Close this window to stop Questboard.
echo.
pause > nul
