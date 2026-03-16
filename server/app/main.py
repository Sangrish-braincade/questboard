"""Questboard — FastAPI server entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, campaigns, characters, maps, combat, dice, npcs, inventory, audio
from app.websocket.manager import ws_manager
from app.websocket.handlers import handle_message
from app.services.campaign_manager import campaign_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print(f"🎲 Questboard server starting on port {settings.port}")
    print(f"📁 Campaign root: {settings.campaign_root}")
    campaign_manager.ensure_root_exists()
    yield
    # Shutdown
    campaign_manager.stop_all_watchers()
    print("🛑 Questboard server shutting down")


app = FastAPI(
    title="Questboard",
    description="Local-first D&D session manager API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow Electron and browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to Electron origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# Register API routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(characters.router, prefix="/api/characters", tags=["characters"])
app.include_router(maps.router, prefix="/api/maps", tags=["maps"])
app.include_router(combat.router, prefix="/api/combat", tags=["combat"])
app.include_router(dice.router, prefix="/api/dice", tags=["dice"])
app.include_router(npcs.router, prefix="/api/npcs", tags=["npcs"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(audio.router, prefix="/api/audio", tags=["audio"])

# --- WebSocket endpoint ---

@app.websocket("/ws/{session_code}")
async def websocket_endpoint(websocket: WebSocket, session_code: str):
    """Main WebSocket endpoint — one connection per player/DM per session."""
    name = await ws_manager.connect(websocket, session_code)
    if name is None:
        return  # Auth failed, connection already closed

    try:
        while True:
            raw = await websocket.receive_text()
            await handle_message(raw, session_code, name)
    except WebSocketDisconnect:
        await ws_manager.disconnect(session_code, name)
