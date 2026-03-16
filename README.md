# Questboard

Local-first D&D session manager. DM hosts on their machine, players join via browser with a session code. All data stays on the DM's filesystem.

## Features (Planned)

- **Battle Map** — Pixi.js renderer with 5ft grid, fog of war, tokens, drag-and-drop
- **Character Sheets** — Full 5e sheets with auto-calc, player-owned with DM read access
- **Dice Roller** — 3D physics dice (Three.js + Cannon-es), universal rolls
- **Combat Tracker** — Initiative, HP, conditions, death saves
- **Spell System** — SRD database + custom spells, LoL-style AoE visualization
- **Chat** — Public chat + DM private whispers per player
- **Voice Transcription** — Discord bot captures voice, Google STT transcribes per speaker
- **Music/Ambiance** — Local audio files streamed to players
- **Quest Builder** — DM prep tools for quests, encounters, session notes

## Tech Stack

| Layer | Tech |
|---|---|
| DM App | Electron + React + TypeScript |
| Player Client | React SPA (served by DM's server) |
| Backend | Python + FastAPI |
| Database | SQLite (per campaign) |
| Real-time | WebSockets |
| Voice | Discord bot + Google Cloud STT |

## Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- npm

### Setup

```bash
# Install frontend dependencies
npm install

# Install Python dependencies
cd server
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -r requirements.txt
cd ..

# Run dev mode (frontend + backend)
npm run dev
```

### Project Structure

```
questboard/
├── electron/          # Electron main process
├── frontend/          # React + TypeScript (Vite)
│   └── src/
│       ├── components/  # UI components by feature
│       ├── hooks/       # Custom React hooks
│       ├── stores/      # Zustand state management
│       ├── views/       # DM and Player views
│       └── services/    # API + WebSocket clients
├── server/            # Python + FastAPI
│   └── app/
│       ├── api/         # REST endpoints
│       ├── core/        # Config, DB, auth, events
│       ├── models/      # SQLAlchemy models
│       ├── schemas/     # Pydantic validation
│       ├── services/    # Business logic
│       └── websocket/   # Real-time sync
└── discord-bot/       # Discord integration
```

## License

MIT
