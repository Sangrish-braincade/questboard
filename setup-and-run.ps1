# ═══════════════════════════════════════════════════════════════════
#  QUESTBOARD — Setup & Launch (Windows PowerShell)
#  Run this once. It fixes everything and starts the app.
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║    QUESTBOARD — Setup & Launch        ║" -ForegroundColor Magenta
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ─── Step 1: Find Python ──────────────────────────────────────────

Write-Host "  [1/5] Checking Python..." -ForegroundColor Cyan
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python (\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -ge 3 -and $minor -ge 10) {
                $pythonCmd = $cmd
                Write-Host "      OK: $ver ($cmd)" -ForegroundColor Green
                break
            }
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Host "      Python 3.10+ not found. Installing..." -ForegroundColor Yellow
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $pythonCmd = "python"
}

# ─── Step 2: Find Node (need 18-22, NOT 24) ──────────────────────

Write-Host "  [2/5] Checking Node.js..." -ForegroundColor Cyan
$nodeOk = $false
try {
    $nodeVer = (node --version 2>$null)
    if ($nodeVer -match "v(\d+)\.") {
        $nodeMajor = [int]$Matches[1]
        if ($nodeMajor -ge 18 -and $nodeMajor -le 22) {
            Write-Host "      OK: Node $nodeVer" -ForegroundColor Green
            $nodeOk = $true
        } else {
            Write-Host "      Node $nodeVer found but not compatible (need 18-22)" -ForegroundColor Yellow
        }
    }
} catch {}

if (-not $nodeOk) {
    Write-Host "      Installing Node.js 22 LTS via winget..." -ForegroundColor Yellow
    # Uninstall current Node if present
    winget uninstall OpenJS.NodeJS 2>$null
    winget uninstall OpenJS.NodeJS.LTS 2>$null
    # Install 22 LTS
    winget install OpenJS.NodeJS.LTS --version 22.16.0 --accept-package-agreements --accept-source-agreements 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    $nodeVer = (node --version 2>$null)
    if ($nodeVer) {
        Write-Host "      OK: Node $nodeVer installed" -ForegroundColor Green
    } else {
        Write-Host "      WARNING: Node install may need a terminal restart" -ForegroundColor Red
        Write-Host "      Close this terminal, reopen, and run this script again." -ForegroundColor Red
        Read-Host "      Press Enter to exit"
        exit 1
    }
}

# ─── Step 3: Python venv + deps ──────────────────────────────────

Write-Host "  [3/5] Setting up Python backend..." -ForegroundColor Cyan
$serverDir = Join-Path $ROOT "server"
$venvDir = Join-Path $serverDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "      Creating virtual environment..." -ForegroundColor Gray
    & $pythonCmd -m venv $venvDir
}

Write-Host "      Upgrading pip..." -ForegroundColor Gray
& $venvPython -m pip install --upgrade pip setuptools wheel -q 2>$null

Write-Host "      Installing dependencies..." -ForegroundColor Gray
& $venvPip install -r (Join-Path $serverDir "requirements.txt") -q
Write-Host "      OK: Backend ready" -ForegroundColor Green

# ─── Step 4: Frontend deps ───────────────────────────────────────

Write-Host "  [4/5] Setting up frontend..." -ForegroundColor Cyan
$frontendDir = Join-Path $ROOT "frontend"

# Clean corrupted node_modules if present
$nmDir = Join-Path $frontendDir "node_modules"
$rollupCheck = Join-Path $nmDir "vite\node_modules\rollup\dist\native.js"
if ((Test-Path $nmDir) -and -not (Test-Path (Join-Path $nmDir "@rollup\rollup-win32-x64-msvc"))) {
    Write-Host "      Cleaning corrupted node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $nmDir -ErrorAction SilentlyContinue
    # Also clean root node_modules
    $rootNm = Join-Path $ROOT "node_modules"
    if (Test-Path $rootNm) {
        Remove-Item -Recurse -Force $rootNm -ErrorAction SilentlyContinue
    }
    # Delete lockfiles
    Remove-Item -Force (Join-Path $ROOT "package-lock.json") -ErrorAction SilentlyContinue
    Remove-Item -Force (Join-Path $frontendDir "package-lock.json") -ErrorAction SilentlyContinue
}

Write-Host "      Installing npm packages (this takes a minute)..." -ForegroundColor Gray
Push-Location $ROOT
npm install 2>&1 | Out-Null
Pop-Location
Write-Host "      OK: Frontend ready" -ForegroundColor Green

# ─── Step 5: Launch ──────────────────────────────────────────────

Write-Host "  [5/5] Starting Questboard..." -ForegroundColor Cyan
Write-Host ""

# Start backend
$backendJob = Start-Job -ScriptBlock {
    param($venvPython, $serverDir)
    Set-Location $serverDir
    & $venvPython -m uvicorn app.main:app --host 127.0.0.1 --port 7777
} -ArgumentList $venvPython, $serverDir

Write-Host "      Backend starting on http://localhost:7777 ..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Health check
$healthy = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:7777/health" -TimeoutSec 2
        if ($resp.status -eq "ok") {
            $healthy = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if ($healthy) {
    Write-Host "      OK: Backend running" -ForegroundColor Green
} else {
    Write-Host "      WARNING: Backend may still be starting..." -ForegroundColor Yellow
}

# Start frontend
$frontendJob = Start-Job -ScriptBlock {
    param($frontendDir)
    Set-Location $frontendDir
    npx vite --host 2>&1
} -ArgumentList $frontendDir

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║      QUESTBOARD IS RUNNING!           ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  DM Dashboard:  http://localhost:5173/dm" -ForegroundColor White
Write-Host "  Player Join:   http://localhost:5173/play" -ForegroundColor White
Write-Host "  API Docs:      http://localhost:7777/docs" -ForegroundColor White
Write-Host ""

# Open browser
Start-Process "http://localhost:5173"

Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Keep alive
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Check if jobs are still running
        if ($backendJob.State -eq "Failed") {
            Write-Host "  Backend crashed! Logs:" -ForegroundColor Red
            Receive-Job $backendJob
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "  Frontend crashed! Logs:" -ForegroundColor Red
            Receive-Job $frontendJob
        }
    }
} finally {
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue

    # Kill any leftover processes
    Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*questboard*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "  Goodbye!" -ForegroundColor Magenta
}
