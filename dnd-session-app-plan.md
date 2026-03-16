# Questboard — Local-First D&D Session Manager

## Overview

A **local-first** Electron desktop app where the DM's machine IS the server. Players connect via browser using a session code. All data (campaigns, maps, characters, transcripts) lives on the DM's filesystem — zero cloud dependencies, zero hosting costs. Assets like maps and quest sheets are streamed to players as base64 on-demand and never persist on their machines. Google Speech-to-Text provides live voice transcription attributed per player.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **DM App** | Electron + React + TypeScript | Native desktop app, bundles the server, one-click launch, system tray |
| **Embedded Server** | Python + FastAPI (bundled via PyInstaller or as sidecar) | Runs inside Electron as a child process. Handles API + WebSocket |
| **Player Client** | React SPA served by the DM's server | Players open a URL in their browser — no install needed |
| **Real-time** | WebSockets (native FastAPI WebSocket) | Bi-directional sync for maps, dice, chat, combat. No Socket.IO needed — lighter |
| **Database** | SQLite | Single file, zero config, lives in DM's campaign folder. No Postgres/Redis needed |
| **File Storage** | Local filesystem | Maps, portraits, audio files stored in structured folders on DM's machine |
| **Auth** | Session code + simple tokens | DM generates a 6-char code, players enter it to join. JWT for the session lifetime |
| **Voice Transcription** | Discord bot audio capture + Google Cloud STT | Bot joins voice channel, records per-speaker audio, runs STT, logs attributed transcript on DM's machine |
| **Voice/Video** | Discord (integrated) | Discord bot joins voice channel for both comms and transcription |
| **Spell Database** | SRD 5e spells (JSON) + custom spell editor | Pre-loaded SRD spell data (range, AoE, damage) with full customization |
| **Networking** | Cloudflare Tunnel / ngrok / Tailscale | Exposes the DM's local server to the internet so remote players can connect |

---

## Architecture

```
  DM'S MACHINE (Electron App)
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │              ELECTRON SHELL                          │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │ System   │  │ DM Frontend  │  │ Tunnel       │   │    │
│  │  │ Tray     │  │ (React app   │  │ Manager      │   │    │
│  │  │ + Menu   │  │  in webview) │  │ (ngrok/CF)   │   │    │
│  │  └──────────┘  └──────┬───────┘  └──────┬────────┘  │    │
│  └────────────────────────┼─────────────────┼───────────┘    │
│                           │                 │                │
│  ┌────────────────────────┴─────────────────┴───────────┐    │
│  │              EMBEDDED SERVER (FastAPI)                 │    │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐             │    │
│  │  │REST API  │ │WebSocket │ │ Asset     │             │    │
│  │  │endpoints │ │ manager  │ │ Streamer  │             │    │
│  │  │          │ │ (rooms)  │ │ (b64 pipe)│             │    │
│  │  └────┬─────┘ └────┬─────┘ └─────┬─────┘             │    │
│  │       └─────────────┴─────────────┘                   │    │
│  │                     │                                  │    │
│  │       ┌─────────────┼──────────────┐                  │    │
│  │  ┌────┴────┐  ┌─────┴──────┐ ┌────┴──────┐           │    │
│  │  │ SQLite  │  │ Campaign   │ │ Transcript│           │    │
│  │  │ (data)  │  │ Files      │ │ Logs      │           │    │
│  │  │         │  │ (maps,     │ │ (per-user │           │    │
│  │  │         │  │  audio,    │ │  speech)  │           │    │
│  │  │         │  │  tokens)   │ │           │           │    │
│  │  └─────────┘  └────────────┘ └───────────┘           │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │ tunnel / direct IP
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴─────┐     ┌────┴─────┐     ┌────┴─────┐
    │ Player 1 │     │ Player 2 │     │ Player N │
    │ (Browser)│     │ (Browser)│     │ (Browser)│
    │          │     │          │     │          │
    │ React UI │     │ React UI │     │ React UI │
    │ + Mic    │     │ + Mic    │     │ + Mic    │
    │ (STT)    │     │ (STT)    │     │ (STT)    │
    └──────────┘     └──────────┘     └──────────┘
```

### Key Architecture Decisions

**DM = Server:** The Electron app spawns a FastAPI process on a local port (e.g., `localhost:7777`). The React frontend for both DM and players is served from this server. The DM's Electron webview loads `localhost:7777/dm`, players load `{tunnel_url}/play?code=ABC123`.

**Asset Streaming (not downloading):** When the DM reveals a map or quest sheet, the server reads the file from disk, encodes it as base64, and pushes it over WebSocket. The player's browser renders it in-memory (canvas for maps, inline for images/PDFs). When the session ends or the player disconnects, the data is gone from their side. No files are saved to the player's machine.

**SQLite over Postgres:** Single-file database, zero config. For 6-8 concurrent users with one writer (the server), SQLite with WAL mode is more than sufficient. The `.db` file lives in the campaign folder — easy to back up, move, or share.

**No Redis:** With a single server process handling all connections, there's no need for pub/sub or cross-instance coordination. In-memory Python dicts handle session state. WebSocket connections are managed directly.

**Event Sourcing (still):** Every game action is an event stored in SQLite. This gives undo/redo, session replay, and transcript generation — all stored locally.

**Tunnel for Remote Play:** When the DM clicks "Host Online," the app opens a Cloudflare Tunnel (or ngrok) and generates a shareable URL + session code. Players paste the URL in their browser and enter the code. For LAN play, players just use the local IP.

---

## DM's Folder Structure

Everything lives in a user-chosen root directory (e.g., `~/DnD Sessions/`):

```
~/DnD Sessions/
├── campaigns/
│   ├── curse-of-strahd/
│   │   ├── campaign.db              # SQLite database (all structured data)
│   │   ├── maps/
│   │   │   ├── barovia-village.jpg
│   │   │   ├── death-house-f1.png
│   │   │   └── castle-ravenloft.webp
│   │   ├── tokens/
│   │   │   ├── strahd.png
│   │   │   ├── ireena.png
│   │   │   └── wolves.png
│   │   ├── handouts/                 # Quest sheets, letters, lore docs
│   │   │   ├── letter-from-kolyan.pdf
│   │   │   └── tarokka-reading.png
│   │   ├── audio/                    # Ambient sounds, music
│   │   │   ├── tavern-ambiance.mp3
│   │   │   ├── combat-theme.mp3
│   │   │   └── rain-thunder.ogg
│   │   ├── npcs/
│   │   │   └── stat-blocks/          # DM's custom stat block images/PDFs
│   │   ├── sessions/
│   │   │   ├── session-001/
│   │   │   │   ├── events.jsonl      # Event log (append-only)
│   │   │   │   ├── transcript.md     # Combined speech-to-text transcript
│   │   │   │   ├── chat-log.md       # In-app text chat export
│   │   │   │   └── recap.md          # DM/player-written recap
│   │   │   ├── session-002/
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── players/
│   │       ├── player-sangrish/
│   │       │   ├── character.json    # Character sheet data
│   │       │   └── portrait.png
│   │       ├── player-alex/
│   │       │   └── ...
│   │       └── ...
│   └── tomb-of-annihilation/
│       └── ...
├── shared-assets/                    # Reusable across campaigns
│   ├── tokens/                       # Generic token pack
│   ├── audio/                        # Shared music/ambiance library
│   └── maps/                         # Reusable map tiles
└── app-config.json                   # Global settings (default port, tunnel preference, etc.)
```

### Why This Structure Matters

- **Portable:** Zip a campaign folder → send it to another DM → they can run it. The SQLite DB + files are self-contained.
- **Backupable:** Drop the whole thing in Google Drive / Dropbox / git.
- **Transparent:** DMs can manually add maps/tokens/audio by dropping files in the right folder. The app watches for changes.
- **No lock-in:** It's just files. If the app dies, the data is still usable.

---

## Data Models (SQLite)

```python
# Using SQLAlchemy with SQLite backend
# All models live in campaign.db per campaign

class Player:
    id: str               # UUID
    display_name: str
    character_id: str | None  # FK -> Character
    color: str            # Player color for UI (token rings, chat)
    joined_at: datetime

class Character:
    id: str
    player_id: str
    name: str
    race: str
    char_class: str
    level: int
    stats: JSON           # {str: 16, dex: 14, ...}
    hp_current: int
    hp_max: int
    armor_class: int
    speed: int
    spell_slots: JSON
    spells: JSON          # List of spell IDs (from SRD DB + custom)
    features: JSON        # Class features, racial traits
    proficiencies: JSON
    inventory: JSON
    portrait_path: str | None  # Relative path within campaign folder
    sheet_data: JSON      # Full sheet blob for extensibility
    uploaded_sheet_path: str | None  # Original uploaded character card (PDF/image)
    owned_by: str         # "player" — player uploads and owns, DM can read/download

class Spell:
    id: str
    name: str
    source: str           # "srd" | "custom"
    level: int            # 0 = cantrip
    school: str           # "evocation", "abjuration", etc.
    casting_time: str
    range_ft: int         # Range in feet
    aoe_shape: str | None # "sphere" | "cone" | "line" | "cube" | "cylinder" | None
    aoe_size_ft: int | None  # Radius/length in feet
    duration: str
    damage_dice: str | None   # e.g. "8d6" for fireball
    damage_type: str | None   # "fire", "force", "necrotic", etc.
    save_type: str | None     # "dex", "wis", etc.
    num_targets: int | None   # e.g. 3 for magic missile darts
    description: str
    higher_levels: str | None # Upcast description
    components: str       # "V, S, M (a tiny ball of bat guano)"
    concentration: bool
    ritual: bool
    custom_fields: JSON   # Player can add homebrew properties

class Map:
    id: str
    name: str
    file_path: str        # Relative path to image in maps/
    grid_type: str        # "square" | "hex"
    grid_size: int        # Pixels per grid cell
    width: int
    height: int
    fog_of_war: JSON      # Array of revealed polygon regions

class Token:
    id: str
    map_id: str
    entity_type: str      # "character" | "npc" | "object"
    entity_id: str | None
    name: str
    x: int                # Grid position
    y: int
    size: str             # "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan"
    icon_path: str        # Relative path to token image
    visible_to: JSON      # ["all"] or list of player IDs
    conditions: JSON      # Active status effects

class NPC:
    id: str
    name: str
    description: str
    race: str
    stat_block: JSON      # {hp, ac, attacks, abilities, cr}
    notes: str            # DM private notes
    token_path: str | None

class Session:
    id: str
    session_number: int
    status: str           # "prep" | "active" | "completed"
    map_id: str | None    # Active map
    started_at: datetime | None
    ended_at: datetime | None
    notes: str            # DM session prep notes

class GameEvent:
    id: str
    session_id: str
    type: str             # "dice_roll" | "token_move" | "damage" | "chat" | "fog_reveal" | ...
    actor: str            # Player display name or "DM"
    payload: JSON
    timestamp: datetime

class CombatEncounter:
    id: str
    session_id: str
    map_id: str
    turn_order: JSON      # [{entity_id, name, initiative, is_npc, hp_current, hp_max}]
    current_turn: int
    round_number: int
    status: str           # "active" | "completed"

class TranscriptEntry:
    id: str
    session_id: str
    speaker: str          # Player display name
    text: str             # Transcribed speech
    confidence: float     # STT confidence score
    timestamp: datetime

class Quest:
    id: str
    campaign_id: str
    title: str
    description: str
    status: str           # "hidden" | "active" | "completed"
    objectives: JSON      # [{text, completed, sub_objectives}]
    rewards: JSON         # [{type, description, value}]
    npc_ids: list[str]    # Related NPCs
    map_ids: list[str]    # Related maps
    hooks: str            # How to introduce this quest
    notes: str            # DM private notes
    created_at: datetime

class EncounterTemplate:
    id: str
    name: str
    campaign_id: str
    map_id: str | None
    monsters: JSON        # [{npc_id, count, x, y, initiative}]
    difficulty: str       # "easy" | "medium" | "hard" | "deadly"
    notes: str

class SharedInventory:
    id: str
    items: JSON           # [{name, quantity, description, held_by, value_gp}]
    party_gold: int
```

---

## Feature Breakdown

### 1. One-Click Session Hosting (Electron)

**The DM experience:**

1. DM opens the app → sees list of campaigns
2. Clicks a campaign → sees session history, maps, NPCs, players
3. Clicks **"Host Session"** → the embedded FastAPI server starts on `localhost:7777`
4. App asks: **LAN or Online?**
   - **LAN:** Shows local IP + port (`192.168.1.42:7777`) and a 6-character session code
   - **Online:** Spins up a Cloudflare Tunnel, shows a public URL (`https://abc123.trycloudflare.com`) + session code
5. DM shares the URL + code with players (or pastes into Discord)
6. Players open the URL in any browser, enter the code, pick/create their character → they're in

**Under the hood:**

```
Electron main process
  ├── Spawns FastAPI as child process (Python sidecar)
  │     ├── Serves React player UI at /play
  │     ├── Serves React DM UI at /dm (or Electron loads it directly)
  │     ├── WebSocket endpoint at /ws
  │     └── REST API at /api/*
  ├── Manages tunnel lifecycle (start/stop cloudflared)
  ├── Watches campaign folder for file changes
  └── System tray icon with quick actions
```

**Session code auth flow:**
1. DM starts session → server generates a random 6-char alphanumeric code (e.g., `K7X9M2`)
2. Player navigates to URL → enters code → server validates → issues a session JWT
3. JWT is stored in memory only (not localStorage) — gone when tab closes
4. DM can kick players, regenerate the code, or lock the session

### 2. Asset Streaming (No Player-Side Storage)

**Core principle:** Players are thin clients. They see what the DM shows them, and nothing persists.

**How map streaming works:**

```
DM reveals map "barovia-village.jpg"
  │
  ├── Server reads file from disk
  ├── Compresses if needed (sharp/pillow → WebP, quality 80)
  ├── Encodes as base64
  ├── Sends via WebSocket:
  │   {
  │     type: "map_reveal",
  │     payload: {
  │       map_id: "...",
  │       image_b64: "data:image/webp;base64,/9j/4AAQ...",
  │       grid_type: "square",
  │       grid_size: 70,
  │       width: 4000,
  │       height: 3000,
  │       fog: [{polygon points for revealed areas}]
  │     }
  │   }
  │
  └── Player client:
      ├── Decodes b64 → creates Image object in memory
      ├── Renders on Pixi.js canvas
      ├── Applies fog of war mask
      └── On disconnect → canvas destroyed, image GC'd → nothing left
```

**For large maps (>5MB):** Chunk the base64 into multiple WS messages (e.g., 512KB chunks). Player assembles chunks in memory, then renders. Progress bar shows on the player's screen.

**Handouts / Quest Sheets:** Same pattern. DM selects a PDF/image from the handouts folder → streamed as b64 → rendered in a modal on the player's screen. Can be dismissed. Never saved.

**Audio streaming:** Different approach — audio files are served via HTTP endpoint (`/api/audio/{file_id}`) with range request support. The player's browser streams it (HTML5 `<audio>` tag with a blob URL). When DM stops playback or session ends, the blob URL is revoked.

### 3. Battle Map System

Same feature set as before, but adapted for local:

**Rendering:** Pixi.js (WebGL). Map images loaded from b64 stream, not a URL.

**Core features:**
- DM uploads maps by dropping files into the campaign's `maps/` folder (or via in-app file picker)
- Configurable grid overlay (square or hex), **5ft per square** (standard 5e)
- Drag-and-drop token placement and movement
- Snap-to-grid with optional free movement
- Fog of War: DM paints revealed/hidden regions, players only see what's revealed
- Dynamic lighting (stretch): line-of-sight based on token position and wall segments
- Measurement tool: click-drag to measure distances in feet (auto-calculates from grid)
- Drawing tools: DM can draw shapes, arrows, areas of effect on the map
- Layer system: background (map image) → grid → fog → tokens → drawings → UI

**Real-time sync:** Same WebSocket model. Token positions broadcast to all players. DM is authoritative.

**Fog of war streaming:** When DM reveals a new region, only the delta is sent (the new polygon), not the entire fog state. Players accumulate revealed regions client-side.

### 4. Character Sheets (Player-Owned)

**Players own their characters. DM can view and download.**

**Upload flow:** Players can upload an existing character card (PDF, image, or D&D Beyond export) when joining a campaign. The file is streamed to the DM's server and stored in `players/{player}/`. The app parses what it can (if PDF/JSON) or the player fills in the in-app sheet manually.

**Key difference from cloud version:** Character data is stored on the DM's machine (SQLite + files), but the player is the primary editor. DM has read access to all sheets and can download any character file. When a player edits their sheet, the change goes via WebSocket → server writes to SQLite → broadcasts to DM's view.

**Features:**
- Player uploads their character card (PDF/image) — stored on DM's machine
- Full in-app 5e sheet editor: stats, saves, skills, HP, AC, speed, proficiencies
- Auto-calculate modifiers from ability scores
- **Spell management:** register spells from the SRD database or create custom spells (see Spell System below)
- Spell slot tracking with per-rest reset
- Inventory management with weight calculation (optional encumbrance)
- Class feature tracking (rage uses, ki points, sorcery points, etc.)
- Level-up wizard: guided flow that handles HP roll, new features, ASI/feat selection
- Portrait upload
- DM can view any player's sheet in real-time
- DM can download any player's character card or export to PDF
- Export to PDF (generated server-side, streamed as b64 to player)

### 5. Dice Roller

**Server-side RNG, 3D animation client-side. Universal — everyone sees every roll (unless DM secret roll).**

**3D Dice animation approach:**
- Use **Three.js** for 3D rendering + **Cannon-es** (maintained fork of Cannon.js) for physics simulation
- Each die type is a 3D mesh: d4 (tetrahedron), d6 (cube), d8 (octahedron), d10 (pentagonal trapezohedron), d12 (dodecahedron), d20 (icosahedron)
- Dice models can be created in Blender and exported as GLTF, or generated procedurally with Three.js geometry
- Physics: dice are thrown with random force/spin, Cannon-es simulates the tumble, when the die settles the animation is "corrected" to land on the face matching the server's result
- Open-source reference: **[dice-box](https://github.com/3d-dice/dice-box)** by 3d-dice — MIT licensed, does exactly this with Three.js + Ammo.js. Can fork or use as inspiration.
- Alternative: **[react-dice-complete](https://github.com/AdamTyler/react-dice-complete)** for simpler 2D/CSS dice if 3D is too heavy

**Features:**
- All standard dice: d4, d6, d8, d10, d12, d20, d100
- Complex expressions: `2d6+4`, `4d6kh3` (keep highest 3), `1d20adv` (advantage)
- **Universal roll:** results broadcast to ALL players in public chat with roll breakdown
- DM secret rolls: results visible only to DM (separate UI toggle)
- Quick-roll buttons on character sheet (click a skill → auto-rolls d20 + modifier)
- Spell damage auto-roll: casting a spell queues the damage dice
- Dice tray: pre-configure common rolls (attack + damage combo)
- Roll history in chat log with timestamps
- Satisfying sound effects on roll + land

### 6. Spell & Attack Visualization System (LoL-style)

**The flashy feature. Think League of Legends ability indicators on a D&D grid.**

**How it works:**

1. **Player casts a spell:** clicks a spell from their spell list on the character sheet
2. **AoE indicator appears:** a translucent shape overlays the map, attached to the cursor
   - **Sphere/radius** (Fireball): orange circle, 20ft radius, centered where player clicks
   - **Cone** (Burning Hands): triangular cone, 15ft, player sets direction by dragging
   - **Line** (Lightning Bolt): rectangular line, 100ft long × 5ft wide, rotatable
   - **Cube** (Cloudkill): square overlay, 20ft sides
   - **Cylinder** (Moonbeam): circle with a height indicator
   - **Single target** (Magic Missile): arrow/line from caster to each target
3. **Player confirms placement** → indicator locks in, visible to all players
4. **DM resolves:** sees which tokens are inside the AoE, can apply damage with one click
5. **Visual effect plays:** brief animation (fire burst, lightning crackle, etc.) using particle effects on the Pixi.js canvas

**Spell registration flow:**
```
Player opens character sheet → Spells tab → "Add Spell"
  ├── Search SRD database (pre-loaded ~300 SRD spells)
  │   └── Auto-fills: range, AoE shape, AoE size, damage dice,
  │       damage type, save type, components, casting time, etc.
  ├── OR "Create Custom Spell" for homebrew
  │   └── Player fills in all fields manually
  ├── Player can customize any auto-filled field
  │   └── e.g., change damage dice for a homebrew variant
  └── Spell saved to character → appears in spell list during session
```

**Magic Missile example (multi-target):**
- Spell data: `{num_targets: 3, damage_dice: "1d4+1", damage_type: "force", range_ft: 120}`
- Player casts → 3 target selectors appear → player clicks 3 different (or same) targets
- 3 arrow indicators fly from caster to each target on the map
- Each dart resolves separately (DM sees damage per dart)

**Attack reflection (DM tool):**
- DM can draw an arrow from any token to any point on the map
- Used to show attack trajectories, movement paths, or reflected attacks
- Arrow appears on all players' screens with optional label ("Reflected beam!")

**Visual effects library (Pixi.js particle system):**
- Fire: orange/red particles expanding outward
- Ice/Cold: blue crystals + frost spread
- Lightning: jagged line with glow
- Force: purple/blue ripple
- Necrotic: green/black tendrils
- Radiant: golden burst
- Healing: green sparkles rising
- Effects are brief (~1-2 seconds) and don't obstruct the map

**Dice integration:** When a spell is cast, the dice roller auto-queues the damage roll. Player clicks "Roll Damage" → 3D dice animate → result broadcasts to all → DM applies to affected tokens.

### 7. Combat / Initiative Tracker

Same feature set, all state in SQLite.

**Features:**
- DM starts encounter → players roll initiative (or DM inputs for NPCs)
- Auto-sorted turn order displayed to everyone
- Current turn highlighted with optional timer
- HP tracking: DM controls NPC HP, players manage their own
- Conditions: status effects with icons on tokens
- Death saves: auto-prompt at 0 HP
- Lair/legendary actions
- Combat log → auto-saved to session event log

### 8. Chat & Whisper System

**Features:**
- In-app text chat alongside Discord voice
- **Public channel:** everyone sees
- **DM private chat:** each player has a 1-on-1 private channel with the DM. DM whispers ("You notice the NPC is lying"), player sends secret notes to DM. Other players cannot see these.
- **Universal dice roll:** dice results appear in the public chat for all to see (unless DM secret roll)
- Dice results inline in chat with roll breakdown
- Character speech mode ("Thorin says: ..." with portrait)
- Out-of-character mode (player name, visually distinct styling)
- Chat history persisted in session folder as `chat-log.md`

### 9. Voice Transcription (Discord Bot + Google STT)

**The killer feature for session recaps. Transcription runs through Discord — no extra mic setup for players.**

**How it works:**

```
Discord Voice Channel
  │
  ├── Discord bot joins the voice channel when DM starts session
  ├── Bot receives per-user audio streams (discord.py voice receive)
  ├── Each user's audio is buffered in chunks (~5 second windows)
  ├── Chunks sent to Google Cloud Speech-to-Text API
  │     └── With speaker label = Discord username
  ├── Transcription results streamed to FastAPI server:
  │   {
  │     type: "speech_transcript",
  │     payload: {
  │       speaker: "Sangrish",
  │       character: "Thorin",  // mapped from Discord ID → character
  │       text: "I want to investigate the bookshelf",
  │       confidence: 0.94,
  │       timestamp: "2026-03-15T19:32:15Z"
  │     }
  │   }
  │
  └── Server:
      ├── Appends to TranscriptEntry table in SQLite
      ├── Writes to sessions/session-XXX/transcript.md in real-time
      ├── Interleaves dice rolls and game events into transcript
      └── Pushes live captions to DM dashboard via WebSocket
```

**Speaker identification:** The Discord bot receives separate audio streams per user (this is a discord.py feature). Each stream is tagged with the Discord user ID, which maps to a player/character in the session. No diarization needed — we know exactly who's talking.

**Transcript output format (transcript.md):**

```markdown
# Session 7 — March 15, 2026

## Transcript

**[19:32:15] Sangrish (Thorin):** I want to investigate the bookshelf in the back of the room.

**[19:32:22] DM:** As you pull back the dusty tomes, you notice one book that doesn't match the others. It's bound in what appears to be... leather of a different kind.

**[19:32:45] Alex (Lyra):** I cast detect magic. Does it radiate anything?

**[19:33:01] DM:** Roll arcana for me.

> 🎲 **Alex (Lyra)** rolled **d20+5** → **18** (Arcana check)

**[19:33:08] DM:** Yes — the book pulses with a faint necromantic aura.

> ⚔️ **Combat started** — Initiative order: Thorin (18), Lyra (15), Skeleton x3 (12)
```

**DM controls:**
- Toggle transcription on/off per session
- Live caption feed in DM dashboard panel
- One-click export after session (markdown, plain text, or JSON)
- Search across all session transcripts ("find mentions of the artifact")
- Redact/edit transcript entries post-session

**Cost:** Google Cloud STT costs ~$0.006 per 15 seconds of audio. For a 4-hour session with ~50% talk time, that's roughly $2.88. DM provides their own GCP API key in settings.

**Fallback:** If no API key is configured, transcription is disabled. Could add browser-based Web Speech API as a free fallback in the future.

### 10. Discord Integration

Lighter integration than the cloud version since players use Discord externally.

**What the Discord bot does:**
- DM registers a Discord server in app settings
- Bot posts session link + code to a designated channel when DM starts a session
- Sends turn notifications to a text channel ("It's Thorin's turn!")
- Posts session recap to Discord after session ends
- `/roll` slash command that forwards to the app's dice roller

**What it doesn't do:** Voice channel management (players join Discord voice manually — simpler and more reliable).

### 11. Session Management

**Session flow:**
1. DM preps a session: selects map, places tokens, writes notes
2. Clicks "Host Session" → server starts, tunnel opens
3. Players join via code
4. During session: map, combat, dice, chat, transcription all active
5. DM clicks "End Session" → events flushed to disk, transcript finalized, chat log saved
6. App generates a session folder with all artifacts

**Session resume:** If the DM's machine crashes or they need to pause, the event log is append-only on disk. Next time they host, they can "Resume Session" which replays the event log to restore state.

**Session replay:** The DM can step through past sessions' event logs to re-watch combat, review decisions, or pull quotes for recaps.

### 12. Shared Loot & Party Inventory

Same features — shared party inventory, individual inventories, transfers, gold tracking. All persisted in SQLite.

### 13. DM Screen / Dashboard

**Panels (customizable drag-and-drop layout):**
- Initiative tracker
- NPC stat block quick-reference
- Session notes (markdown editor, auto-saved)
- Player overview (HP, AC, passive perception at a glance)
- Live transcript feed
- Music/ambiance controls
- Map controls (fog, tokens, drawings)
- Session code + connected players list

### 14. Music & Ambiance

**Features:**
- DM drops audio files into the campaign's `audio/` folder
- In-app player with playlist support
- Volume mixing: layer multiple tracks
- Quick-switch presets (e.g., "Combat" → switches music + stops ambient rain)
- Players hear audio streamed from DM's server (HTTP range requests)
- Players can adjust their own volume
- DM controls what plays for everyone

### 15. Spectator Mode

Same as before — read-only view via a separate spectator code. Sees map, tokens, chat, dice, hears music. Can't interact.

### 16. DM Quest Preparation

**DM needs to prep sessions before game day.**

**Quest builder:**
- Create quests with: title, description, objectives, rewards, NPCs involved, maps linked
- Quest status tracking: hidden / active / completed
- Quest can be revealed to players during session (streamed as a handout card)
- Nested objectives with checkboxes (DM checks them off as players progress)
- Quest hooks: notes on how to introduce the quest to players

**Encounter prep:**
- Pre-build encounters: select a map, place NPC/monster tokens, set initiative values
- Save encounter templates (reusable — "6 goblins + 1 bugbear" as a preset)
- Link encounters to quests
- Estimated difficulty calculator based on party level + monster CRs (SRD formula)

**Session notes:**
- Markdown editor for DM prep notes
- Linked to the session — opens automatically when DM starts that session
- Can reference quests, NPCs, maps by name (auto-links)
- Post-session: DM can annotate what actually happened vs what was planned

**World state:**
- Campaign-level notes: factions, locations, timeline, lore
- DM-only (never streamed to players)
- Searchable across the whole campaign

### 17. Mobile Companion

Players on phones just use their mobile browser. The React UI should be responsive from day one. Core mobile experience: character sheet view, dice roller, chat, and transcription (if browser supports Web Speech API — Chrome mobile does).

---

## Networking Deep Dive

### How Remote Players Connect

The DM's machine runs the server locally. To let remote players in, we need to punch through NAT.

**Option 1: Cloudflare Tunnel (Recommended)**
- Free tier available, no account needed for temporary tunnels
- `cloudflared` binary bundled with the Electron app
- One command: `cloudflared tunnel --url http://localhost:7777`
- Generates a random `*.trycloudflare.com` URL
- HTTPS out of the box, handles WebSocket upgrades
- Reliable, fast, Cloudflare's global network

**Option 2: ngrok**
- Similar to Cloudflare but requires a free account for persistent URLs
- Good fallback if CF tunnels have issues

**Option 3: Tailscale**
- If all players are on the same Tailscale network, direct P2P connection
- Best latency, most secure, but requires all players to install Tailscale

**Option 4: Direct port forward**
- DM manually port-forwards 7777 on their router
- Works but requires technical knowledge, not "one-click"

**Bandwidth estimation (8 players):**
- Map reveal (5MB WebP): ~5MB one-time push, split across ~1 second
- Token moves: ~200 bytes per move, ~30 moves/minute in combat = ~6KB/min
- Chat: negligible
- Audio stream: ~128kbps per player = ~1Mbps total for 8 players
- Transcript: ~1KB/message, ~10 messages/min = ~10KB/min
- **Total sustained:** ~1-2 Mbps upload from DM's machine. Most home connections handle this easily.

---

## WebSocket Protocol

Same envelope format, updated event types:

```json
{
  "type": "token_move",
  "session_code": "K7X9M2",
  "sender": "sangrish",
  "timestamp": "2026-03-15T20:30:00Z",
  "payload": {
    "token_id": "...",
    "x": 12,
    "y": 8
  }
}
```

**Event types:**

| Type | Direction | Description |
|---|---|---|
| `map_reveal` | DM → Server → Players | Stream map image + fog as b64 |
| `map_fog_update` | DM → Server → Players | Delta fog reveal (new polygon only) |
| `token_move` | Client → Server → All | Move a token |
| `token_add` | DM → Server → All | Place new token |
| `token_remove` | DM → Server → All | Remove token |
| `dice_roll` | Client → Server → All/DM | Roll result |
| `chat_message` | Client → Server → Target(s) | Text message |
| `whisper` | Client → Server → Target | Private message |
| `combat_start` | DM → Server → All | Begin encounter |
| `combat_next_turn` | DM → Server → All | Advance turn |
| `combat_damage` | DM → Server → All | Apply damage/healing |
| `combat_condition` | DM → Server → All | Apply/remove condition |
| `combat_end` | DM → Server → All | End encounter |
| `handout_reveal` | DM → Server → Target(s) | Stream a handout (b64) |
| `music_play` | DM → Server → All | Start/change audio track |
| `music_stop` | DM → Server → All | Stop audio |
| `speech_transcript` | Player → Server | Voice transcription chunk |
| `character_update` | Player → Server → DM | Character sheet change |
| `session_start` | DM → All | Session begins |
| `session_end` | DM → All | Session ends |
| `player_join` | Server → All | Player connected |
| `player_leave` | Server → All | Player disconnected |
| `player_kick` | DM → Server → Target | Remove a player |

---

## Project Structure

```
dnd-session-app/
├── electron/
│   ├── main.ts                     # Electron main process
│   ├── preload.ts                  # Context bridge
│   ├── server-manager.ts           # Spawns/kills FastAPI process
│   ├── tunnel-manager.ts           # Manages cloudflared/ngrok
│   ├── file-watcher.ts             # Watches campaign folders for changes
│   └── tray.ts                     # System tray icon + menu
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── dm/                  # DM-specific views
│   │   │   │   ├── Dashboard.tsx    # Main DM screen with panels
│   │   │   │   ├── CampaignList.tsx
│   │   │   │   ├── SessionPrep.tsx
│   │   │   │   └── TranscriptViewer.tsx
│   │   │   └── player/              # Player-specific views
│   │   │       ├── JoinSession.tsx   # Code entry screen
│   │   │       ├── PlayerView.tsx    # Main player screen
│   │   │       └── CharacterCreate.tsx
│   │   ├── components/
│   │   │   ├── battlemap/           # Pixi.js map renderer
│   │   │   │   ├── MapCanvas.tsx
│   │   │   │   ├── TokenLayer.tsx
│   │   │   │   ├── FogLayer.tsx
│   │   │   │   ├── GridOverlay.tsx
│   │   │   │   └── DrawingTools.tsx
│   │   │   ├── character/           # Sheet editor
│   │   │   ├── combat/              # Initiative tracker
│   │   │   ├── dice/                # 3D dice roller
│   │   │   ├── chat/                # Chat + whispers
│   │   │   ├── music/               # Audio player controls
│   │   │   ├── transcript/          # Live caption display
│   │   │   ├── inventory/           # Loot management
│   │   │   └── common/              # Shared UI components
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WS connection + reconnect
│   │   │   ├── useSpeechToText.ts   # Web Speech API wrapper
│   │   │   ├── useDice.ts
│   │   │   └── useAudio.ts          # Audio streaming hook
│   │   ├── stores/                  # Zustand
│   │   │   ├── sessionStore.ts
│   │   │   ├── mapStore.ts
│   │   │   ├── combatStore.ts
│   │   │   ├── chatStore.ts
│   │   │   └── transcriptStore.ts
│   │   ├── services/
│   │   │   ├── api.ts               # REST client
│   │   │   └── ws.ts                # WebSocket client
│   │   ├── types/
│   │   └── utils/
│   │       ├── diceParser.ts        # Parse "2d6+4" expressions
│   │       ├── gridMath.ts          # Grid coordinate helpers
│   │       └── b64.ts               # Base64 encode/decode helpers
│   ├── public/
│   │   └── assets/                  # Default tokens, dice textures
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint
│   │   ├── config.py                # Settings (port, campaign path, etc.)
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py          # Session code validation
│   │   │   │   ├── campaign.py
│   │   │   │   ├── character.py
│   │   │   │   ├── combat.py
│   │   │   │   ├── maps.py
│   │   │   │   ├── npcs.py
│   │   │   │   ├── dice.py
│   │   │   │   ├── audio.py         # Audio file streaming endpoint
│   │   │   │   └── inventory.py
│   │   │   └── middleware.py
│   │   ├── core/
│   │   │   ├── security.py          # Session code + JWT
│   │   │   ├── events.py            # Event sourcing engine
│   │   │   └── database.py          # SQLite connection (aiosqlite)
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/
│   │   │   ├── asset_streamer.py    # Read file → b64 → WS push
│   │   │   ├── combat.py
│   │   │   ├── dice.py              # Server-side RNG
│   │   │   ├── transcript.py        # Collect + save STT entries
│   │   │   ├── npc.py
│   │   │   └── map.py
│   │   └── websocket/
│   │       ├── manager.py           # Connection manager (in-memory)
│   │       ├── handlers.py          # Event handlers
│   │       └── events.py            # Event type definitions
│   ├── requirements.txt
│   └── tests/
├── discord-bot/                     # Optional companion bot
│   ├── bot.py
│   └── cogs/
├── scripts/
│   ├── build-electron.sh            # Package Electron + Python sidecar
│   └── bundle-python.sh             # PyInstaller / cx_Freeze script
├── package.json                     # Root monorepo (npm workspaces)
├── electron-builder.yml             # Electron packaging config
└── README.md
```

---

## Security Considerations

- **Session codes:** 6-char alphanumeric, regeneratable by DM. Rate-limited login attempts (5 tries, then 60s cooldown).
- **JWT:** Short-lived tokens (session lifetime only). Stored in memory, not localStorage.
- **DM-only actions:** Server checks role on every WebSocket event. Players can't send `fog_reveal`, `combat_damage`, etc.
- **Asset protection:** Files are served through the API, not as static files. No directory listing. Players can't enumerate or download assets they haven't been shown.
- **Input validation:** All WS payloads validated with Pydantic.
- **Tunnel security:** Cloudflare tunnels are HTTPS by default. Session code adds a second layer.
- **No data at rest on player side:** b64 assets live only in browser memory. No IndexedDB, no localStorage, no downloads.

---

## Development Phases

### Phase 1: Foundation (Weeks 1–4)
- Electron app shell (main process, system tray, window management)
- FastAPI sidecar spawning + health check
- SQLite database setup + models + migrations
- Campaign folder structure creation
- Session code generation + validation
- Basic WebSocket infrastructure (connect, auth, echo)
- Player join flow (code entry → JWT → connected)
- Tunnel integration (cloudflared bundling)

### Phase 2: Core Gameplay (Weeks 5–12)
- Battle map renderer (Pixi.js, 5ft grid, pan/zoom)
- Asset streaming pipeline (file → compress → b64 → WS)
- Token system (place, move, remove, snap-to-grid)
- Fog of war (DM reveal tool + delta streaming)
- Character sheet editor (full 5e, auto-calc)
- Character card upload flow (player uploads PDF/image → stored on DM machine)
- Dice roller (server-side RNG, Three.js + Cannon-es 3D animation, broadcast)
- Universal dice roll (all players see results in chat)
- Text chat + DM private whisper channels
- SRD spell database (JSON, ~300 spells with range/AoE/damage/etc.)

### Phase 3: Combat + Spells (Weeks 13–18)
- Initiative tracker (roll, sort, display)
- Turn management + round counter
- HP tracking + damage/healing
- Conditions + status effects + death saves
- Spell registration flow (SRD lookup + custom spell creation)
- Spell AoE visualization (LoL-style indicators: sphere, cone, line, cube)
- Multi-target spells (e.g., Magic Missile 3-dart targeting)
- Attack/spell arrow indicators (DM can draw attack trajectories)
- Pixi.js particle effects for spell types (fire, ice, lightning, etc.)
- Auto-queued damage rolls after spell cast
- Combat event logging

### Phase 4: Discord + Transcription (Weeks 19–23)
- Discord bot (voice channel join, session link posting, turn notifications)
- Discord bot audio capture (per-speaker audio streams)
- Google Cloud STT integration (audio chunks → text)
- Transcript attributed per speaker, interleaved with game events
- Live caption panel on DM dashboard
- Transcript export (markdown)
- Music/ambiance system (local audio files, HTTP streaming)

### Phase 5: DM Tools + Social (Weeks 24–28)
- DM quest builder (quests, objectives, rewards, NPC links)
- Encounter template builder (pre-place tokens, save presets)
- Session notes (markdown editor, auto-linked to quests/NPCs/maps)
- World state / campaign lore notes
- DM dashboard (customizable panel layout)
- Shared inventory system
- Handout/quest sheet streaming
- Spectator mode
- Session replay from event log

### Phase 6: Packaging + Distribution (Weeks 29–32)
- Electron packaging (Windows, macOS, Linux)
- Python sidecar bundling (PyInstaller)
- Auto-updater (electron-updater)
- Installer UX (first-run wizard, campaign folder selection)
- Mobile responsive polish
- Performance testing (8 players, large maps, long sessions)
- Onboarding tutorial for new DMs

### Ongoing
- Bug fixes, community feedback
- Token packs, ambient sound library expansion
- Campaign import/export tools
- AI features (NPC dialogue, procedural gen) — future phase
- System-agnostic support (Pathfinder, etc.)

---

## Key Libraries & Dependencies

### Frontend (React + Electron)
| Package | Purpose |
|---|---|
| `electron` | Desktop app shell |
| `electron-builder` | Packaging + installers |
| `react` + `react-dom` | UI framework |
| `typescript` | Type safety |
| `vite` + `vite-plugin-electron` | Build tool with Electron support |
| `pixi.js` | WebGL battle map rendering |
| `three.js` + `cannon-es` | 3D dice physics |
| `zustand` | State management |
| `react-router-dom` | Routing (DM vs player views) |
| `tailwindcss` | Styling |
| `framer-motion` | Animations |
| `howler.js` | Audio playback + mixing |
| `react-dnd` | Drag and drop |
| `react-grid-layout` | DM dashboard panel layout |

### Backend (Python + FastAPI)
| Package | Purpose |
|---|---|
| `fastapi` | Web framework + WebSocket support |
| `uvicorn` | ASGI server |
| `aiosqlite` | Async SQLite driver |
| `sqlalchemy` | ORM (with SQLite backend) |
| `alembic` | Schema migrations |
| `pydantic` | Validation + schemas |
| `python-jose` | JWT handling |
| `pillow` | Image compression (map → WebP before streaming) |
| `watchdog` | File system watcher (detect new maps/assets) |
| `discord.py` | Discord bot + voice receive for transcription |
| `google-cloud-speech` | Google Cloud Speech-to-Text API |
| `pydub` | Audio chunk processing (Discord PCM → STT format) |
| `pytest` | Testing |

### Build / Packaging
| Tool | Purpose |
|---|---|
| `PyInstaller` or `cx_Freeze` | Bundle Python + FastAPI into a standalone executable |
| `cloudflared` | Cloudflare Tunnel binary (bundled) |
| `electron-builder` | Create .dmg, .exe, .AppImage installers |

---

## Cost

**For the DM: $0/month.** Everything runs on their machine.

**Optional costs:**
- Google Cloud STT API key: ~$0.006 per 15 seconds if you want premium transcription (free tier: Web Speech API)
- Discord bot hosting: free if it runs on the DM's machine alongside the app
- Cloudflare Tunnel: free tier is sufficient
- Domain (optional): ~$12/year if you want a custom domain for the tunnel

---

## Open Questions / Decisions to Make

1. **Licensing:** 5e content is partially open via the SRD/OGL. Stick to SRD content or let DMs input their own stat blocks. Don't bundle copyrighted content.
2. **Distribution:** Release on GitHub as open source? Or package and sell on itch.io / Steam? This affects the licensing of dependencies.
3. **System agnostic vs 5e-specific:** Starting 5e-specific is fine, but abstracting the character sheet system early (plugin architecture) saves pain later.
4. **Python bundling strategy:** PyInstaller creates a single executable but it's large (~100MB+). Alternative: require Python installed and use pip. Or ship a minimal Python runtime. Test what feels cleanest.
5. **Campaign sharing / portability:** Should there be a "export campaign as .zip" feature so DMs can share campaigns? The folder structure already supports this, just need a clean UX.
6. **Player reconnection:** If a player's browser tab crashes mid-session, they should be able to rejoin with the same code and get the current state hydrated. The event log makes this possible — replay recent events to rebuild client state.
