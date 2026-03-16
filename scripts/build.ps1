# Questboard build script for Windows — builds frontend, compiles electron, packages app

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Questboard Build Script (Windows)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$PackageOnly = $false
if ($args.Count -gt 0 -and $args[0] -eq "--package-only") {
  $PackageOnly = $true
}

# Step 1: Build the Vite frontend
if (-not $PackageOnly) {
  Write-Host ""
  Write-Host "📦 Building Vite frontend..." -ForegroundColor Yellow
  Set-Location "$ProjectRoot\frontend"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
  }
  Set-Location $ProjectRoot
}

# Step 2: Compile Electron TypeScript
if (-not $PackageOnly) {
  Write-Host ""
  Write-Host "⚙️  Compiling Electron TypeScript..." -ForegroundColor Yellow
  npx tsc --project electron/tsconfig.json
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    exit 1
  }
}

# Step 3: Run electron-builder to package the app
Write-Host ""
Write-Host "🔨 Packaging with electron-builder (Windows NSIS installer)..." -ForegroundColor Yellow
npx electron-builder --win
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ electron-builder failed" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Build complete! Check the dist/ folder for the installer." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
