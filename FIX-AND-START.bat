@echo off
title Questboard - Fix and Start
color 0E
echo.
echo   ========================================
echo    QUESTBOARD - Fixing everything...
echo   ========================================
echo.

cd /d "%~dp0"

:: ─── Fix Backend ─────────────────────────────
echo   [1/6] Creating Python venv if needed...
cd /d "%~dp0server"
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    echo         Created venv
) else (
    echo         Venv exists
)

echo   [2/6] Upgrading pip + setuptools...
.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel -q
echo         Done

echo   [3/6] Installing Python dependencies...
.venv\Scripts\pip.exe install -r requirements.txt -q
echo         Done

:: ─── Fix Frontend ────────────────────────────
echo   [4/6] Cleaning corrupted node_modules...
cd /d "%~dp0frontend"
if exist "node_modules" (
    if not exist "node_modules\@rollup\rollup-win32-x64-msvc" (
        echo         Removing corrupted node_modules...
        rmdir /s /q node_modules 2>nul
        cd /d "%~dp0"
        if exist "node_modules" rmdir /s /q node_modules 2>nul
        if exist "package-lock.json" del /f package-lock.json 2>nul
        cd /d "%~dp0frontend"
        if exist "package-lock.json" del /f package-lock.json 2>nul
        echo         Cleaned
    ) else (
        echo         node_modules OK
    )
) else (
    echo         No node_modules yet
)

echo   [5/6] Installing npm packages (takes ~1 min)...
cd /d "%~dp0"
call npm install
echo         Done

:: ─── Start Everything ────────────────────────
echo   [6/6] Starting Questboard...
echo.
color 0A

cd /d "%~dp0server"
start "Questboard Backend" /min .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7777
echo   Backend starting on http://localhost:7777 ...

timeout /t 3 /nobreak > nul

cd /d "%~dp0frontend"
start "Questboard Frontend" /min npx vite --host
echo   Frontend starting on http://localhost:5173 ...

timeout /t 4 /nobreak > nul

start http://localhost:5173

echo.
echo   ========================================
echo    QUESTBOARD IS RUNNING!
echo.
echo    DM Dashboard:  http://localhost:5173/dm
echo    Player Join:   http://localhost:5173/play
echo    API Docs:      http://localhost:7777/docs
echo   ========================================
echo.
echo   Press any key to STOP everything...
pause > nul

echo   Shutting down...
taskkill /fi "WINDOWTITLE eq Questboard Backend*" /f 2>nul
taskkill /fi "WINDOWTITLE eq Questboard Frontend*" /f 2>nul
echo   Goodbye!
timeout /t 2 /nobreak > nul
