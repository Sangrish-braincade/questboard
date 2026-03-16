#!/bin/bash
# Questboard build script — builds frontend, compiles electron, packages app

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Questboard Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse optional arguments
PACKAGE_ONLY=false
if [[ "$1" == "--package-only" ]]; then
  PACKAGE_ONLY=true
fi

# Step 1: Build the Vite frontend
if [ "$PACKAGE_ONLY" = false ]; then
  echo ""
  echo "📦 Building Vite frontend..."
  cd "$PROJECT_ROOT/frontend"
  npm run build
  cd "$PROJECT_ROOT"
fi

# Step 2: Compile Electron TypeScript
if [ "$PACKAGE_ONLY" = false ]; then
  echo ""
  echo "⚙️  Compiling Electron TypeScript..."
  npx tsc --project electron/tsconfig.json
fi

# Step 3: Run electron-builder to package the app
echo ""
echo "🔨 Packaging with electron-builder..."

# Determine target based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Detected Linux — building AppImage and deb"
  npx electron-builder --linux
elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Detected macOS — building DMG and zip"
  npx electron-builder --mac
else
  echo "Unknown OS. Building for current platform..."
  npx electron-builder
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build complete! Check the dist/ folder for installers."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
