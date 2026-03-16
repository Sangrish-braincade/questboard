# Questboard — GitHub Issues

> Run these with `gh` CLI once the repo is created. Each issue has a title, labels, and body.
> Grouped by milestone / phase.

---

## Milestone: Phase 1 — Foundation

### Issue 1
**Title:** Project scaffolding — monorepo with Electron + React + FastAPI
**Labels:** `setup`, `phase-1`
**Body:**
Set up the monorepo structure:
- `electron/` — Electron main process
- `frontend/` — React + TypeScript + Vite
- `server/` — Python + FastAPI
- Root `package.json` with npm workspaces
- `docker-compose.yml` for dev (optional — or just run processes directly)
- ESLint, Prettier, Python linting (ruff), pre-commit hooks
- Basic README with project overview

---

### Issue 2
**Title:** Electron app shell — window management, system tray, dev mode
**Labels:** `electron`, `phase-1`
**Body:**
- Create Electron main process with BrowserWindow
- System tray icon with context menu (Start Session, Stop Session, Quit)
- Dev mode: load from Vite dev server (`localhost:5173`)
- Prod mode: load from bundled static files
- Preload script with context bridge for IPC
- Window state persistence (size, position)

---

### Issue 3
**Title:** FastAPI sidecar — Electron spawns Python server as child process
**Labels:** `electron`, `backend`, `phase-1`
**Body:**
- Electron main process spawns FastAPI via `child_process`
- Health check endpoint (`GET /health`) — Electron polls until server is ready
- Graceful shutdown on app quit (SIGTERM → uvicorn shutdown)
- Configurable port (default 7777)
- Stdout/stderr piped to Electron logs
- Dev mode: assume server is running externally (manual `uvicorn` start)

---

### Issue 4
**Title:** SQLite database setup with SQLAlchemy + Alembic migrations
**Labels:** `backend`, `database`, `phase-1`
**Body:**
- SQLAlchemy 2.0 async setup with `aiosqlite`
- WAL mode enabled for concurrent reads
- Database file lives at `{campaign_folder}/campaign.db`
- Alembic migration setup
- Initial migration with all core models: Player, Character, Map, Token, NPC, Session, GameEvent, CombatEncounter, Spell, Quest, EncounterTemplate, SharedInventory, TranscriptEntry
- Pydantic schemas for all models

---

### Issue 5
**Title:** Campaign folder structure — creation, watching, validation
**Labels:** `backend`, `filesystem`, `phase-1`
**Body:**
- Create campaign folder structure on new campaign: `maps/`, `tokens/`, `handouts/`, `audio/`, `npcs/`, `sessions/`, `players/`
- File watcher (watchdog) to detect new files dropped into folders
- `app-config.json` for global settings (root directory, default port, tunnel preference)
- Campaign list endpoint: scan root directory for campaign folders
- Validate folder structure on load

---

### Issue 6
**Title:** Session code auth system — generate code, validate, issue JWT
**Labels:** `backend`, `auth`, `phase-1`
**Body:**
- DM starts session → server generates 6-char alphanumeric code
- `POST /api/auth/join` — player submits code → server validates → returns JWT
- JWT stored in memory only (not localStorage) — session lifetime
- Middleware: all API routes require valid JWT
- DM role detection (the session creator)
- Rate limiting on join attempts (5 tries, 60s cooldown)
- DM can regenerate code, kick players

---

### Issue 7
**Title:** WebSocket infrastructure — connection manager, rooms, auth
**Labels:** `backend`, `websocket`, `phase-1`
**Body:**
- FastAPI WebSocket endpoint at `/ws/{session_code}`
- Connection manager: track connected clients per session
- Auth on handshake: validate JWT from query param
- Standard message envelope: `{type, sender, timestamp, payload}`
- Broadcast helpers: `broadcast_all`, `broadcast_to`, `broadcast_except`
- Heartbeat/ping-pong for connection health
- Reconnection handling: client reconnects → server hydrates current state
- Player join/leave events broadcast to all

---

### Issue 8
**Title:** Frontend shell — routing, auth flow, campaign list, session join
**Labels:** `frontend`, `phase-1`
**Body:**
- React Router setup: `/dm/*` routes and `/play/*` routes
- DM view: campaign list → campaign detail → session host
- Player view: join screen (enter code) → session view
- Zustand stores: sessionStore, authStore
- API client service (fetch wrapper with JWT)
- WebSocket client hook (`useWebSocket`) with auto-reconnect
- Basic Tailwind setup + layout components
- Loading states, error handling

---

### Issue 9
**Title:** Tunnel integration — Cloudflare Tunnel for remote play
**Labels:** `electron`, `networking`, `phase-1`
**Body:**
- Bundle `cloudflared` binary with Electron app
- "Host Online" button: spawns `cloudflared tunnel --url http://localhost:7777`
- Parse stdout to extract generated URL
- Display URL + session code to DM
- "Host LAN" option: just show local IP + port
- Graceful tunnel shutdown on session end
- Error handling: tunnel fails to start, connection drops

---

## Milestone: Phase 2 — Core Gameplay

### Issue 10
**Title:** Battle map renderer — Pixi.js canvas with grid overlay
**Labels:** `frontend`, `battlemap`, `phase-2`
**Body:**
- Pixi.js Application setup inside a React component
- Load map image (from b64 data received via WebSocket)
- Configurable grid overlay: square (default) or hex, 5ft per square
- Pan (click-drag on empty space) and zoom (scroll wheel)
- Viewport culling: only render visible area
- Grid coordinate display on hover
- Layer system: background → grid → fog → tokens → drawings → UI
- Responsive: fills available space

---

### Issue 11
**Title:** Asset streaming pipeline — file → compress → b64 → WebSocket
**Labels:** `backend`, `streaming`, `phase-2`
**Body:**
- `AssetStreamer` service: reads file from disk, compresses (Pillow → WebP), encodes as b64
- For large files (>1MB): chunk into 512KB WebSocket messages with sequence numbers
- Player assembles chunks in memory, progress bar during load
- Endpoints: map reveal, handout reveal, token icon push
- Memory management: don't hold entire file in memory server-side (stream from disk)
- Revoke/cleanup on disconnect

---

### Issue 12
**Title:** Token system — place, move, remove, snap-to-grid
**Labels:** `frontend`, `backend`, `battlemap`, `phase-2`
**Body:**
- Token component: sprite on Pixi.js canvas
- Drag-and-drop movement with snap-to-grid (5ft squares)
- Token sizes: tiny (half), small/medium (1), large (2x2), huge (3x3), gargantuan (4x4)
- DM: can place, move, remove any token
- Players: can only move their own character's token
- Token visibility: DM can hide tokens from players (visible_to field)
- Condition icons displayed on tokens
- Token ring color = player color
- Real-time sync: moves broadcast via WebSocket, debounced at ~30fps during drag

---

### Issue 13
**Title:** Fog of war — DM reveal tool with delta streaming
**Labels:** `frontend`, `backend`, `battlemap`, `phase-2`
**Body:**
- DM tool: paint polygon regions to reveal
- Brush modes: rectangle select, polygon draw, circle brush
- "Reveal all" and "hide all" buttons
- Fog rendered as a dark overlay with revealed regions cut out
- Delta streaming: when DM reveals new area, only the new polygon is sent via WS
- Players accumulate revealed regions client-side
- Fog state persisted in Map model (fog_of_war JSON)

---

### Issue 14
**Title:** Character sheet editor — full 5e sheet with auto-calc
**Labels:** `frontend`, `backend`, `character`, `phase-2`
**Body:**
- Full 5e character sheet form: ability scores, saves, skills, HP, AC, speed, proficiencies
- Auto-calculate: modifiers from ability scores, proficiency bonus from level, save/skill bonuses
- Spell slot tracking with per-rest reset
- Class feature tracking (rage, ki, sorcery points, etc.)
- Inventory tab with weight calculation
- Portrait upload
- react-hook-form + zod validation
- Real-time sync: changes broadcast to DM view via WebSocket
- DM can view any player's sheet (read-only)

---

### Issue 15
**Title:** Character card upload — player uploads PDF/image to DM's machine
**Labels:** `frontend`, `backend`, `character`, `phase-2`
**Body:**
- Player can upload their character card (PDF, PNG, JPG) when creating a character
- File streamed via WebSocket (chunked b64) or multipart POST to server
- Stored in `players/{player_name}/` on DM's filesystem
- DM can view and download any uploaded character card
- In-app viewer for uploaded cards (PDF rendered inline, images displayed)
- Optional: parse uploaded JSON (D&D Beyond export format) to auto-fill sheet fields

---

### Issue 16
**Title:** Dice roller — server-side RNG with Three.js + Cannon-es 3D animation
**Labels:** `frontend`, `backend`, `dice`, `phase-2`
**Body:**
- Server endpoint: `POST /api/dice/roll` — accepts expression (e.g., `2d6+4`), returns result
- Dice expression parser: supports `NdX`, `NdXkhY` (keep highest), `NdXklY` (keep lowest), `1d20adv`, `1d20dis`, modifiers
- Three.js scene: 3D dice meshes (d4, d6, d8, d10, d12, d20)
- Cannon-es physics: dice thrown with random force/spin, settle naturally
- Animation "corrected" to land on face matching server result
- Sound effects on throw and land
- Result broadcast to ALL players in chat (universal roll)
- DM secret roll option: result only shown to DM
- Quick-roll buttons on character sheet (click skill → d20 + modifier)
- Roll history in chat log
- Reference: [dice-box](https://github.com/3d-dice/dice-box) (MIT) for inspiration

---

### Issue 17
**Title:** Text chat system with DM private whisper channels
**Labels:** `frontend`, `backend`, `chat`, `phase-2`
**Body:**
- Public chat channel: all players see messages
- DM private channel: each player has a 1-on-1 channel with the DM
- Player can switch between public and DM-whisper tabs
- DM sees all private channels in a tabbed interface
- Dice roll results appear inline in public chat
- Character speech mode: "Thorin says: ..." with portrait
- Out-of-character mode: player name, visually distinct
- Chat history persisted to `sessions/session-XXX/chat-log.md`
- Unread message indicators on channel tabs

---

### Issue 18
**Title:** SRD 5e spell database — JSON data file with ~300 spells
**Labels:** `data`, `spells`, `phase-2`
**Body:**
- Compile SRD 5e spells into a JSON file: name, level, school, casting_time, range_ft, aoe_shape, aoe_size_ft, duration, damage_dice, damage_type, save_type, num_targets, description, higher_levels, components, concentration, ritual
- Source: 5e SRD (Open Gaming License) — only include OGL-legal content
- Searchable by name, level, school, class
- Bundled with the app (loaded on startup)
- Schema matches the Spell model in the database

---

## Milestone: Phase 3 — Combat + Spells

### Issue 19
**Title:** Initiative tracker — roll, sort, display, turn management
**Labels:** `frontend`, `backend`, `combat`, `phase-3`
**Body:**
- DM starts encounter → initiative roll prompt for all players
- DM inputs NPC initiative values
- Auto-sorted turn order display (sidebar/overlay)
- Current turn highlighted, optional timer
- "Next Turn" button advances to next combatant
- Round counter
- Turn order widget shows: portrait, name, HP bar (DM sees exact, players see color)
- Broadcast to all players in real-time

---

### Issue 20
**Title:** HP tracking, damage/healing, conditions, death saves
**Labels:** `frontend`, `backend`, `combat`, `phase-3`
**Body:**
- DM can deal damage / heal any token
- Players manage their own HP
- Conditions: stunned, prone, concentrating, poisoned, etc. — displayed as icons on tokens
- Apply/remove conditions from turn order widget
- Death saves: auto-prompt when character hits 0 HP, track successes/failures
- Lair actions / legendary actions: DM-triggered at specific round points
- All combat events logged to GameEvent table

---

### Issue 21
**Title:** Spell registration flow — SRD lookup + custom spell creation
**Labels:** `frontend`, `backend`, `spells`, `phase-3`
**Body:**
- Character sheet → Spells tab → "Add Spell" button
- Search SRD spell database by name (autocomplete)
- Selecting SRD spell auto-fills all fields (range, AoE, damage, etc.)
- Player can customize any auto-filled field (homebrew variants)
- "Create Custom Spell" for fully homebrew spells
- Spell saved to character's spell list
- Spell slots consumed on cast (tracked per rest)
- Spells grouped by level in the character sheet

---

### Issue 22
**Title:** Spell AoE visualization — LoL-style indicators on the battle map
**Labels:** `frontend`, `battlemap`, `spells`, `phase-3`
**Body:**
- Player casts a spell → AoE indicator appears on map, attached to cursor
- Shapes: sphere/radius (circle), cone (triangle), line (rectangle), cube (square), cylinder (circle + height)
- Indicator is translucent, color-coded by damage type
- Player sets position (click) and direction (drag for cones/lines)
- Confirm placement → indicator locks, visible to all players
- DM sees which tokens are inside the AoE
- Grid-aware: snaps to 5ft grid, shows affected squares
- Measurement labels (range from caster, AoE dimensions)

---

### Issue 23
**Title:** Multi-target spell visualization (e.g., Magic Missile)
**Labels:** `frontend`, `battlemap`, `spells`, `phase-3`
**Body:**
- For spells with `num_targets > 1` (e.g., Magic Missile = 3 darts)
- Player clicks N separate targets on the map
- Arrow indicators drawn from caster to each target
- Each dart resolves separately (DM sees damage per target)
- DM can reflect/redirect arrows (drag endpoint to new target)
- Works with any single-target spell that can target multiple entities

---

### Issue 24
**Title:** Attack trajectory arrows — DM can draw attack paths on map
**Labels:** `frontend`, `battlemap`, `phase-3`
**Body:**
- DM tool: click source → drag to destination → arrow appears on map
- Arrow visible to all players
- Optional label on arrow ("Reflected beam!", "Thrown javelin")
- Arrow style options: straight, curved, dashed
- Auto-clear after configurable time or DM dismisses
- Used for: showing attack directions, movement paths, reflected attacks

---

### Issue 25
**Title:** Pixi.js particle effects for spell damage types
**Labels:** `frontend`, `battlemap`, `spells`, `phase-3`
**Body:**
- Brief visual effects (~1-2 seconds) when a spell resolves on the map
- Effect types mapped to damage types:
  - Fire: orange/red particles expanding
  - Ice/Cold: blue crystals + frost
  - Lightning: jagged line with glow
  - Force: purple/blue ripple
  - Necrotic: green/black tendrils
  - Radiant: golden burst
  - Healing: green sparkles rising
  - Thunder: shockwave ring
  - Poison: green cloud
- Pixi.js particle system (pixi-particles or custom)
- Don't obstruct map — effects are cosmetic

---

### Issue 26
**Title:** Auto-queued damage rolls after spell cast
**Labels:** `frontend`, `dice`, `spells`, `phase-3`
**Body:**
- When a player casts a spell with damage_dice, auto-queue the roll
- "Roll Damage" button appears in chat/spell panel
- Player clicks → 3D dice animate → result broadcasts to all
- DM can then apply damage to affected tokens with one click
- For save-based spells: DM rolls saves for affected NPCs, damage halved on success
- Upcast support: if spell is cast at higher level, adjust damage dice accordingly

---

## Milestone: Phase 4 — Discord + Transcription

### Issue 27
**Title:** Discord bot — join voice channel, post session links, turn notifications
**Labels:** `backend`, `discord`, `phase-4`
**Body:**
- discord.py bot with cogs
- DM registers Discord server + channel in app settings
- On session start: bot posts session URL + code to designated channel
- Turn notifications: "It's Thorin's turn!" posted to text channel
- Session end: post recap summary to Discord
- `/roll` slash command that forwards to the app's dice roller
- Bot joins voice channel when session starts

---

### Issue 28
**Title:** Discord bot voice capture — per-speaker audio streams
**Labels:** `backend`, `discord`, `transcription`, `phase-4`
**Body:**
- Discord bot joins voice channel and receives audio
- discord.py voice receive: separate PCM audio streams per user
- Buffer audio in ~5 second chunks per speaker
- Tag each chunk with Discord user ID → mapped to player/character
- Audio format conversion: Discord PCM → Google STT compatible format (pydub)
- Handle: speaker overlap, silence detection, mic mute/unmute

---

### Issue 29
**Title:** Google Cloud Speech-to-Text integration
**Labels:** `backend`, `transcription`, `phase-4`
**Body:**
- DM provides Google Cloud API key in app settings
- Stream audio chunks to Google Cloud STT API
- Use streaming recognition for near-real-time results
- Return: transcribed text, confidence score, speaker label
- Handle errors: API quota, network issues, invalid audio
- Fallback: if no API key configured, transcription disabled
- Cost tracking: estimate and display session transcription cost

---

### Issue 30
**Title:** Transcript storage, live captions, and export
**Labels:** `backend`, `frontend`, `transcription`, `phase-4`
**Body:**
- TranscriptEntry model: speaker, character, text, confidence, timestamp
- Append to SQLite + write to `sessions/session-XXX/transcript.md` in real-time
- Interleave game events (dice rolls, combat actions) into transcript
- DM dashboard panel: live caption feed via WebSocket
- Post-session export: markdown, plain text, or JSON
- Search across all session transcripts
- DM can edit/redact entries post-session

---

### Issue 31
**Title:** Music/ambiance system — local audio files, HTTP streaming, DM controls
**Labels:** `frontend`, `backend`, `audio`, `phase-4`
**Body:**
- DM drops audio files into campaign's `audio/` folder
- Audio served via HTTP endpoint with range request support (`/api/audio/{file}`)
- Player browsers stream audio (HTML5 `<audio>` with blob URL)
- DM controls: play, pause, stop, volume, next track
- Playlist support: drag to reorder
- Volume mixing: layer multiple tracks (music + ambient)
- Quick-switch presets: "Combat", "Tavern", "Exploration" (DM configurable)
- Players can adjust their own volume independently
- Playback state synced to all players via WebSocket

---

## Milestone: Phase 5 — DM Tools + Social

### Issue 32
**Title:** DM quest builder — create, manage, reveal quests
**Labels:** `frontend`, `backend`, `dm-tools`, `phase-5`
**Body:**
- Quest model: title, description, objectives, rewards, linked NPCs, linked maps, hooks, status
- CRUD UI for DM to create/edit quests
- Quest status: hidden → active → completed
- Nested objectives with checkboxes
- Quest rewards (XP, gold, items)
- Reveal quest to players: streamed as a styled handout card
- Quest log panel in DM dashboard

---

### Issue 33
**Title:** Encounter template builder — pre-build and save encounters
**Labels:** `frontend`, `backend`, `dm-tools`, `phase-5`
**Body:**
- DM selects a map, places NPC/monster tokens, sets initiative values
- Save as reusable template (e.g., "Goblin Ambush" = 6 goblins + 1 bugbear)
- Quick-load: one click to deploy encounter onto the active map
- Estimated difficulty calculator: party level + monster CRs → easy/medium/hard/deadly
- Link encounters to quests
- Template library: list of saved encounters per campaign

---

### Issue 34
**Title:** Session notes — markdown editor, linked to quests/NPCs/maps
**Labels:** `frontend`, `dm-tools`, `phase-5`
**Body:**
- Markdown editor for DM session prep notes
- Auto-saved to `sessions/session-XXX/notes.md`
- Opens automatically when DM starts session prep
- Auto-link references: `@quest:`, `@npc:`, `@map:` syntax
- Post-session: DM can annotate what happened vs what was planned
- Rich editing: headers, bold, lists, checklists, code blocks

---

### Issue 35
**Title:** World state / campaign lore — DM-only reference notes
**Labels:** `frontend`, `backend`, `dm-tools`, `phase-5`
**Body:**
- Campaign-level notes: factions, locations, timeline, lore
- Organized as a wiki-like structure (pages with links)
- DM-only: never streamed to players
- Searchable across the entire campaign
- Stored in SQLite as campaign world_state

---

### Issue 36
**Title:** DM dashboard — customizable drag-and-drop panel layout
**Labels:** `frontend`, `dm-tools`, `phase-5`
**Body:**
- react-grid-layout for draggable/resizable panels
- Available panels: initiative tracker, NPC stat blocks, session notes, player overview (HP/AC/PP), live transcript, music controls, map controls, session code + connected players, quest log
- DM can save custom layouts
- Quick actions: AoE damage, rest (short/long), random encounter, award XP/loot
- Responsive: works on different screen sizes

---

### Issue 37
**Title:** Shared party inventory and loot distribution
**Labels:** `frontend`, `backend`, `phase-5`
**Body:**
- Shared party inventory: items, party gold
- Individual character inventories (synced with character sheet)
- Transfer flow: drag item from one character to another
- Loot distribution: DM awards loot → players claim/distribute
- Magic item cards: styled display with properties, attunement
- Gold tracking with transaction log
- Weight tracking per character

---

### Issue 38
**Title:** Handout / quest sheet streaming to players
**Labels:** `frontend`, `backend`, `streaming`, `phase-5`
**Body:**
- DM selects a file from `handouts/` folder
- File streamed as b64 to specific players or all players
- Rendered in a modal: PDF inline viewer, image display
- Player can dismiss but cannot save/download
- DM can target specific players ("Only Thorin sees this letter")
- Handout history: DM can see which handouts have been shown

---

### Issue 39
**Title:** Spectator mode — read-only session view
**Labels:** `frontend`, `backend`, `phase-5`
**Body:**
- Separate spectator code (different from player code)
- Read-only view: see map, tokens, chat, dice rolls, hear music
- Cannot move tokens, roll dice, or send messages
- DM can toggle spectator access per session
- Spectator count displayed to DM
- Optional 5-second delay to prevent metagaming

---

### Issue 40
**Title:** Session replay — step through event log
**Labels:** `frontend`, `backend`, `phase-5`
**Body:**
- Load past session's `events.jsonl` file
- Playback controls: play, pause, speed (1x, 2x, 4x), scrub
- Replay renders map state, token positions, dice rolls, chat
- DM can review past sessions for recap writing
- Export specific moments as screenshots

---

## Milestone: Phase 6 — Packaging + Distribution

### Issue 41
**Title:** Electron packaging — Windows, macOS, Linux installers
**Labels:** `electron`, `packaging`, `phase-6`
**Body:**
- electron-builder config for all 3 platforms
- Windows: .exe installer (NSIS) + portable
- macOS: .dmg
- Linux: .AppImage + .deb
- Code signing setup (optional, platform-specific)
- Bundle `cloudflared` binary per platform
- App icon and branding

---

### Issue 42
**Title:** Python sidecar bundling — PyInstaller executable
**Labels:** `backend`, `packaging`, `phase-6`
**Body:**
- PyInstaller spec file to bundle FastAPI + all dependencies into single executable
- Test on Windows, macOS, Linux
- Optimize bundle size (exclude unnecessary packages)
- Alternative evaluation: cx_Freeze, Nuitka
- Electron bundles the Python executable alongside the app

---

### Issue 43
**Title:** Auto-updater — electron-updater for seamless updates
**Labels:** `electron`, `packaging`, `phase-6`
**Body:**
- electron-updater setup
- Update server: GitHub Releases (free) or custom
- Check for updates on app launch
- Download + install in background
- Notify DM when update is ready
- Changelog display

---

### Issue 44
**Title:** First-run wizard — campaign folder selection + setup
**Labels:** `electron`, `ux`, `phase-6`
**Body:**
- First launch: welcome screen + folder picker for campaign root directory
- Create initial folder structure
- Optional: import existing campaign data
- Google Cloud API key configuration (optional, for STT)
- Discord bot token configuration (optional)
- Tutorial walkthrough of key features

---

### Issue 45
**Title:** Mobile responsive polish + PWA consideration
**Labels:** `frontend`, `mobile`, `phase-6`
**Body:**
- Ensure player UI works well on mobile browsers
- Touch-friendly: tap to move tokens, pinch to zoom map
- Responsive character sheet
- Mobile dice roller (tap to roll)
- Chat input accessible on mobile keyboard
- Test on iOS Safari and Android Chrome

---

### Issue 46
**Title:** Performance testing — 8 players, large maps, long sessions
**Labels:** `testing`, `performance`, `phase-6`
**Body:**
- Load test: 8 simultaneous WebSocket connections
- Large map test: 8000x6000 pixel map with 50+ tokens
- Long session test: 4+ hours, verify no memory leaks
- Bandwidth measurement: confirm <2 Mbps upload from DM
- SQLite performance: verify WAL mode handles concurrent reads
- Asset streaming: verify chunked transfer works for >5MB maps
- Transcript: verify continuous STT doesn't degrade over time

---

### Issue 47
**Title:** DM onboarding tutorial
**Labels:** `frontend`, `ux`, `phase-6`
**Body:**
- Interactive tutorial on first campaign creation
- Highlight key features: map upload, token placement, fog of war
- Explain session hosting flow (LAN vs Online)
- Show how to configure Discord bot + STT
- Tooltip hints on DM dashboard panels
- Skip option for experienced users
