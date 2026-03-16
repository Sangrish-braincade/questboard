# Questboard — Windows setup script
# Run this once to install all dependencies

Write-Host "=== Questboard Setup ===" -ForegroundColor Cyan
Write-Host ""

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$Root\package.json")) {
    $Root = Split-Path -Parent $PSScriptRoot
}

# --- Python backend ---
Write-Host "[1/3] Setting up Python backend..." -ForegroundColor Yellow

$ServerDir = "$Root\server"
if (-not (Test-Path "$ServerDir\.venv")) {
    Write-Host "  Creating virtual environment..."
    python -m venv "$ServerDir\.venv"
}

Write-Host "  Installing Python dependencies..."
& "$ServerDir\.venv\Scripts\pip.exe" install -r "$ServerDir\requirements.txt" -q

# --- Frontend ---
Write-Host "[2/3] Setting up frontend..." -ForegroundColor Yellow

$FrontendDir = "$Root\frontend"
Set-Location $FrontendDir
npm install

# --- Electron ---
Write-Host "[3/3] Setting up Electron..." -ForegroundColor Yellow

$ElectronDir = "$Root\electron"
Set-Location $ElectronDir
npm install

Set-Location $Root

Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start development:" -ForegroundColor Cyan
Write-Host "  .\scripts\dev.ps1"
Write-Host ""
Write-Host "Or manually:"
Write-Host "  Terminal 1: cd server && .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 7777 --reload"
Write-Host "  Terminal 2: cd frontend && npm run dev"
Write-Host ""
