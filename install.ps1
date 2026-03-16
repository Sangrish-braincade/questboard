#Requires -Version 5.1
<#
.SYNOPSIS
    Questboard — One-click installer for Windows
.DESCRIPTION
    Downloads and installs everything needed to run Questboard:
    - Checks for Python 3.10+ and Node 18+ (offers to install via winget if missing)
    - Clones the repo (or updates if already present)
    - Creates Python venv and installs backend deps
    - Installs frontend npm deps
    - Creates a desktop shortcut to launch Questboard
.NOTES
    Run in PowerShell as: .\install.ps1
    Or from anywhere:     iwr -useb https://raw.githubusercontent.com/Sangrish-braincade/questboard/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ─── Config ───────────────────────────────────────────────────────────

$RepoUrl = "https://github.com/Sangrish-braincade/questboard.git"
$InstallDir = "$env:LOCALAPPDATA\Questboard"
$DesktopShortcut = "$env:USERPROFILE\Desktop\Questboard.lnk"
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

# ─── Helpers ──────────────────────────────────────────────────────────

function Write-Step($num, $msg) {
    Write-Host ""
    Write-Host "  [$num] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "      ✓ $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "      ! $msg" -ForegroundColor Yellow
}

function Write-Err($msg) {
    Write-Host "      ✗ $msg" -ForegroundColor Red
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Get-PythonVersion {
    $cmds = @("python", "python3", "py")
    foreach ($cmd in $cmds) {
        try {
            $ver = & $cmd --version 2>&1
            if ($ver -match "Python (\d+)\.(\d+)") {
                $major = [int]$Matches[1]
                $minor = [int]$Matches[2]
                if ($major -ge 3 -and $minor -ge 10) {
                    return @{ Cmd = $cmd; Version = "$major.$minor" }
                }
            }
        } catch {}
    }
    return $null
}

function Get-NodeVersion {
    try {
        $ver = & node --version 2>&1
        if ($ver -match "v(\d+)") {
            $major = [int]$Matches[1]
            if ($major -ge 18) {
                return $major
            }
        }
    } catch {}
    return $null
}

# ─── Banner ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║                                       ║" -ForegroundColor Magenta
Write-Host "  ║      QUESTBOARD INSTALLER  v0.1       ║" -ForegroundColor Magenta
Write-Host "  ║      Local-first D&D Session Manager  ║" -ForegroundColor Magenta
Write-Host "  ║                                       ║" -ForegroundColor Magenta
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Install location: $InstallDir" -ForegroundColor Gray
Write-Host ""

# ─── Step 1: Check Python ────────────────────────────────────────────

Write-Step 1 "Checking Python 3.10+..."

$py = Get-PythonVersion
if ($py) {
    Write-Ok "Python $($py.Version) found ($($py.Cmd))"
    $PythonCmd = $py.Cmd
} else {
    Write-Warn "Python 3.10+ not found"
    Write-Host "      Installing Python via winget..." -ForegroundColor Yellow

    if (Test-Command "winget") {
        winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        $py = Get-PythonVersion
        if ($py) {
            Write-Ok "Python $($py.Version) installed"
            $PythonCmd = $py.Cmd
        } else {
            Write-Err "Python install failed. Please install Python 3.10+ manually from python.org"
            Write-Host "      Then re-run this installer." -ForegroundColor Gray
            exit 1
        }
    } else {
        Write-Err "winget not available. Please install Python 3.10+ from https://python.org"
        exit 1
    }
}

# ─── Step 2: Check Node.js ───────────────────────────────────────────

Write-Step 2 "Checking Node.js 18+..."

$nodeVer = Get-NodeVersion
if ($nodeVer) {
    Write-Ok "Node.js v$nodeVer found"
} else {
    Write-Warn "Node.js 18+ not found"
    Write-Host "      Installing Node.js via winget..." -ForegroundColor Yellow

    if (Test-Command "winget") {
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        $nodeVer = Get-NodeVersion
        if ($nodeVer) {
            Write-Ok "Node.js v$nodeVer installed"
        } else {
            Write-Err "Node.js install failed. Please install Node.js 18+ from https://nodejs.org"
            exit 1
        }
    } else {
        Write-Err "winget not available. Please install Node.js 18+ from https://nodejs.org"
        exit 1
    }
}

# ─── Step 3: Check Git ───────────────────────────────────────────────

Write-Step 3 "Checking Git..."

if (Test-Command "git") {
    Write-Ok "Git found"
} else {
    Write-Warn "Git not found — installing via winget..."
    if (Test-Command "winget") {
        winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    if (-not (Test-Command "git")) {
        Write-Err "Git install failed. Please install from https://git-scm.com"
        exit 1
    }
    Write-Ok "Git installed"
}

# ─── Step 4: Clone / Update Repo ─────────────────────────────────────

Write-Step 4 "Getting Questboard source..."

if (Test-Path "$InstallDir\.git") {
    Write-Host "      Updating existing installation..." -ForegroundColor Gray
    Set-Location $InstallDir
    git pull --ff-only 2>&1 | Out-Null
    Write-Ok "Updated to latest"
} else {
    Write-Host "      Cloning repository..." -ForegroundColor Gray
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
    }
    git clone $RepoUrl $InstallDir 2>&1 | Out-Null
    Write-Ok "Cloned to $InstallDir"
}

Set-Location $InstallDir

# ─── Step 5: Python venv + deps ──────────────────────────────────────

Write-Step 5 "Setting up Python backend..."

$ServerDir = "$InstallDir\server"

if (-not (Test-Path "$ServerDir\.venv")) {
    Write-Host "      Creating virtual environment..." -ForegroundColor Gray
    & $PythonCmd -m venv "$ServerDir\.venv"
}

Write-Host "      Installing Python packages..." -ForegroundColor Gray
& "$ServerDir\.venv\Scripts\pip.exe" install -r "$ServerDir\requirements.txt" -q 2>&1 | Out-Null
Write-Ok "Backend ready"

# ─── Step 6: Frontend deps ───────────────────────────────────────────

Write-Step 6 "Setting up frontend..."

Set-Location "$InstallDir\frontend"
Write-Host "      Installing npm packages (this may take a minute)..." -ForegroundColor Gray
npm install --loglevel=error 2>&1 | Out-Null
Write-Ok "Frontend ready"

# ─── Step 7: Create launcher + shortcuts ──────────────────────────────

Write-Step 7 "Creating launcher..."

# Write the launcher batch file
$LauncherPath = "$InstallDir\Questboard.bat"
@"
@echo off
title Questboard - D&D Session Manager
color 0D
echo.
echo   Starting Questboard...
echo   ─────────────────────
echo.

cd /d "$InstallDir\server"
start "Questboard API" /min "$InstallDir\server\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 7777

timeout /t 3 /nobreak >nul

cd /d "$InstallDir\frontend"
start "Questboard UI" /min npx vite --host

timeout /t 3 /nobreak >nul

echo   Questboard is running!
echo.
echo   DM Dashboard:  http://localhost:5173/dm
echo   Player Join:   http://localhost:5173/play
echo   API Docs:      http://localhost:7777/docs
echo.
start http://localhost:5173/dm
echo   Press any key to stop Questboard...
pause >nul

taskkill /fi "WINDOWTITLE eq Questboard API*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Questboard UI*" /f >nul 2>&1
"@ | Out-File -FilePath $LauncherPath -Encoding ASCII

Write-Ok "Launcher created: $LauncherPath"

# Desktop shortcut
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
    $Shortcut.TargetPath = $LauncherPath
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Questboard - D&D Session Manager"
    $Shortcut.Save()
    Write-Ok "Desktop shortcut created"
} catch {
    Write-Warn "Could not create desktop shortcut (non-critical)"
}

# ─── Done ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║                                       ║" -ForegroundColor Green
Write-Host "  ║      INSTALLATION COMPLETE! ✓         ║" -ForegroundColor Green
Write-Host "  ║                                       ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  To launch Questboard:" -ForegroundColor White
Write-Host "    • Double-click the 'Questboard' shortcut on your Desktop" -ForegroundColor Gray
Write-Host "    • Or run: $LauncherPath" -ForegroundColor Gray
Write-Host ""
Write-Host "  To update later:" -ForegroundColor White
Write-Host "    • Re-run this installer — it'll pull the latest version" -ForegroundColor Gray
Write-Host ""

# Ask to launch now
$launch = Read-Host "  Launch Questboard now? (y/n)"
if ($launch -eq "y" -or $launch -eq "Y") {
    Start-Process $LauncherPath
}
