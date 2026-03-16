# Questboard — Dev server launcher (Windows)
# Starts both the Python API server and Vite frontend dev server

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$Root\package.json")) {
    $Root = Split-Path -Parent $PSScriptRoot
}

Write-Host "=== Starting Questboard Dev Servers ===" -ForegroundColor Cyan
Write-Host ""

$ServerDir = "$Root\server"
$FrontendDir = "$Root\frontend"

# Check venv exists
if (-not (Test-Path "$ServerDir\.venv\Scripts\python.exe")) {
    Write-Host "Python venv not found. Run .\scripts\setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Start Python API server
Write-Host "[Backend] Starting FastAPI on http://localhost:7777" -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    & "$dir\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 7777 --reload
} -ArgumentList $ServerDir

# Give the server a moment to start
Start-Sleep -Seconds 2

# Start Vite frontend
Write-Host "[Frontend] Starting Vite on http://localhost:5173" -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $FrontendDir

Write-Host ""
Write-Host "=== Both servers running ===" -ForegroundColor Green
Write-Host ""
Write-Host "  DM view:    http://localhost:5173/dm" -ForegroundColor White
Write-Host "  Player view: http://localhost:5173/play" -ForegroundColor White
Write-Host "  API docs:    http://localhost:7777/docs" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Gray
Write-Host ""

# Stream logs
try {
    while ($true) {
        Receive-Job $backendJob -ErrorAction SilentlyContinue | Write-Host
        Receive-Job $frontendJob -ErrorAction SilentlyContinue | Write-Host
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
}
