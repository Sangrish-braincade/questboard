#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Questboard — One-click installer for macOS / Linux
# ─────────────────────────────────────────────────────────────────────
#   curl -fsSL https://raw.githubusercontent.com/Sangrish-braincade/questboard/main/install.sh | bash
#   — or —
#   chmod +x install.sh && ./install.sh
# ─────────────────────────────────────────────────────────────────────

set -e

# ─── Config ──────────────────────────────────────────────────────────

REPO_URL="https://github.com/Sangrish-braincade/questboard.git"
INSTALL_DIR="$HOME/.local/share/questboard"
BIN_LINK="$HOME/.local/bin/questboard"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────────────

step() { printf "\n  ${CYAN}[$1]${NC} $2\n"; }
ok()   { printf "      ${GREEN}✓${NC} $1\n"; }
warn() { printf "      ${YELLOW}!${NC} $1\n"; }
err()  { printf "      ${RED}✗${NC} $1\n"; }

has_cmd() { command -v "$1" &>/dev/null; }

OS="$(uname -s)"
ARCH="$(uname -m)"

install_with_brew() {
    if has_cmd brew; then
        echo "      Installing $1 via Homebrew..."
        brew install "$1"
        return 0
    fi
    return 1
}

install_with_apt() {
    if has_cmd apt-get; then
        echo "      Installing $1 via apt..."
        sudo apt-get update -qq && sudo apt-get install -y -qq "$1"
        return 0
    fi
    return 1
}

install_with_dnf() {
    if has_cmd dnf; then
        echo "      Installing $1 via dnf..."
        sudo dnf install -y -q "$1"
        return 0
    fi
    return 1
}

install_with_pacman() {
    if has_cmd pacman; then
        echo "      Installing $1 via pacman..."
        sudo pacman -S --noconfirm "$1"
        return 0
    fi
    return 1
}

install_pkg() {
    local pkg="$1"
    local apt_name="${2:-$1}"
    install_with_brew "$pkg" || install_with_apt "$apt_name" || install_with_dnf "$apt_name" || install_with_pacman "$apt_name" || return 1
}

# ─── Banner ──────────────────────────────────────────────────────────

printf "\n"
printf "  ${MAGENTA}╔═══════════════════════════════════════╗${NC}\n"
printf "  ${MAGENTA}║                                       ║${NC}\n"
printf "  ${MAGENTA}║      QUESTBOARD INSTALLER  v0.1       ║${NC}\n"
printf "  ${MAGENTA}║      Local-first D&D Session Manager  ║${NC}\n"
printf "  ${MAGENTA}║                                       ║${NC}\n"
printf "  ${MAGENTA}╚═══════════════════════════════════════╝${NC}\n"
printf "\n"
printf "  ${GRAY}OS: $OS ($ARCH)${NC}\n"
printf "  ${GRAY}Install location: $INSTALL_DIR${NC}\n"
printf "\n"

# ─── Step 1: Check Python ───────────────────────────────────────────

step 1 "Checking Python 3.10+..."

PYTHON_CMD=""
for cmd in python3 python; do
    if has_cmd "$cmd"; then
        ver=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        major=$(echo "$ver" | cut -d. -f1)
        minor=$(echo "$ver" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ] 2>/dev/null; then
            PYTHON_CMD="$cmd"
            ok "Python $ver found ($cmd)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    warn "Python 3.10+ not found — attempting install..."
    if [ "$OS" = "Darwin" ]; then
        install_with_brew python@3.12 || { err "Install Homebrew first: https://brew.sh"; exit 1; }
        PYTHON_CMD="python3"
    else
        install_pkg python3 python3 || { err "Please install Python 3.10+ manually from https://python.org"; exit 1; }
        PYTHON_CMD="python3"
    fi

    ver=$("$PYTHON_CMD" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    ok "Python $ver installed"
fi

# ─── Step 2: Check Node.js ──────────────────────────────────────────

step 2 "Checking Node.js 18+..."

if has_cmd node; then
    node_ver=$(node --version | grep -oE '[0-9]+' | head -1)
    if [ "$node_ver" -ge 18 ] 2>/dev/null; then
        ok "Node.js v$node_ver found"
    else
        warn "Node.js v$node_ver is too old (need 18+)"
        node_ver=""
    fi
else
    node_ver=""
fi

if [ -z "$node_ver" ]; then
    warn "Node.js 18+ not found — attempting install..."
    if [ "$OS" = "Darwin" ]; then
        install_with_brew node || { err "Please install Node.js 18+ from https://nodejs.org"; exit 1; }
    else
        # Try NodeSource LTS if available, otherwise package manager
        if has_cmd curl && has_cmd bash; then
            echo "      Installing Node.js LTS via NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || true
            install_pkg nodejs nodejs || { err "Please install Node.js 18+ from https://nodejs.org"; exit 1; }
        else
            install_pkg nodejs nodejs || { err "Please install Node.js 18+ from https://nodejs.org"; exit 1; }
        fi
    fi
    node_ver=$(node --version | grep -oE '[0-9]+' | head -1)
    ok "Node.js v$node_ver installed"
fi

# ─── Step 3: Check Git ──────────────────────────────────────────────

step 3 "Checking Git..."

if has_cmd git; then
    ok "Git found"
else
    warn "Git not found — installing..."
    install_pkg git git || { err "Please install Git from https://git-scm.com"; exit 1; }
    ok "Git installed"
fi

# ─── Step 4: Clone / Update Repo ────────────────────────────────────

step 4 "Getting Questboard source..."

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "      Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --ff-only 2>&1 || true
    ok "Updated to latest"
else
    echo "      Cloning repository..."
    rm -rf "$INSTALL_DIR"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR" 2>&1
    ok "Cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ─── Step 5: Python venv + deps ─────────────────────────────────────

step 5 "Setting up Python backend..."

SERVER_DIR="$INSTALL_DIR/server"

if [ ! -d "$SERVER_DIR/.venv" ]; then
    echo "      Creating virtual environment..."
    "$PYTHON_CMD" -m venv "$SERVER_DIR/.venv"
fi

echo "      Installing Python packages..."
"$SERVER_DIR/.venv/bin/pip" install -r "$SERVER_DIR/requirements.txt" -q 2>&1
ok "Backend ready"

# ─── Step 6: Frontend deps ──────────────────────────────────────────

step 6 "Setting up frontend..."

cd "$INSTALL_DIR/frontend"
echo "      Installing npm packages (this may take a minute)..."
npm install --loglevel=error 2>&1
ok "Frontend ready"

# ─── Step 7: Create launcher ────────────────────────────────────────

step 7 "Creating launcher..."

LAUNCHER="$INSTALL_DIR/questboard.sh"
cat > "$LAUNCHER" << 'LAUNCHER_EOF'
#!/bin/bash
# Questboard — Launch script
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cleanup() {
    echo ""
    echo "  Stopping Questboard..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo "  Goodbye!"
}
trap cleanup INT TERM EXIT

echo ""
echo "  Starting Questboard..."
echo "  ─────────────────────"
echo ""

cd "$ROOT/server"
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 7777 &
BACKEND_PID=$!

sleep 2

cd "$ROOT/frontend"
npx vite --host &
FRONTEND_PID=$!

sleep 3

echo ""
echo "  Questboard is running!"
echo ""
echo "  DM Dashboard:  http://localhost:5173/dm"
echo "  Player Join:   http://localhost:5173/play"
echo "  API Docs:      http://localhost:7777/docs"
echo ""

# Open browser
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173/dm" 2>/dev/null &
elif command -v open &>/dev/null; then
    open "http://localhost:5173/dm" 2>/dev/null &
fi

echo "  Press Ctrl+C to stop."
wait
LAUNCHER_EOF
chmod +x "$LAUNCHER"
ok "Launcher created: $LAUNCHER"

# Symlink into PATH
mkdir -p "$(dirname "$BIN_LINK")"
ln -sf "$LAUNCHER" "$BIN_LINK" 2>/dev/null || true
if [ -L "$BIN_LINK" ]; then
    ok "Symlinked to $BIN_LINK (run 'questboard' from anywhere)"
fi

# macOS: create .app wrapper
if [ "$OS" = "Darwin" ]; then
    APP_DIR="$HOME/Applications/Questboard.app/Contents/MacOS"
    mkdir -p "$APP_DIR"
    cat > "$APP_DIR/Questboard" << APPEOF
#!/bin/bash
osascript -e 'tell application "Terminal" to do script "\"$LAUNCHER\""'
APPEOF
    chmod +x "$APP_DIR/Questboard"
    ok "macOS app created in ~/Applications"
fi

# ─── Done ────────────────────────────────────────────────────────────

cd "$INSTALL_DIR"

printf "\n"
printf "  ${GREEN}╔═══════════════════════════════════════╗${NC}\n"
printf "  ${GREEN}║                                       ║${NC}\n"
printf "  ${GREEN}║      INSTALLATION COMPLETE! ✓         ║${NC}\n"
printf "  ${GREEN}║                                       ║${NC}\n"
printf "  ${GREEN}╚═══════════════════════════════════════╝${NC}\n"
printf "\n"
printf "  To launch Questboard:\n"
printf "    ${GRAY}• Run: questboard${NC}\n"
printf "    ${GRAY}• Or:  $LAUNCHER${NC}\n"
printf "\n"
printf "  To update later:\n"
printf "    ${GRAY}• Re-run this installer — it'll pull the latest version${NC}\n"
printf "\n"

read -p "  Launch Questboard now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    exec "$LAUNCHER"
fi
