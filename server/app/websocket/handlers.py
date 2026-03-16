"""WebSocket event handlers — process incoming messages by type."""

import json
from datetime import datetime, timezone
from typing import Optional

from app.websocket.manager import ws_manager
from app.services.session_manager import session_manager


async def handle_message(session_code: str, sender: str, raw_data: str):
    """Route an incoming WebSocket message to the appropriate handler."""
    try:
        message = json.loads(raw_data)
    except json.JSONDecodeError:
        await ws_manager.send_to(session_code, sender, {
            "type": "error",
            "payload": {"message": "Invalid JSON"},
        })
        return

    msg_type = message.get("type")
    payload = message.get("payload", {})

    # Get the session and check sender's role
    session = session_manager.get_session(session_code)
    if not session:
        return

    sender_player = session.players.get(sender)
    is_dm = sender_player and sender_player.role == "dm"

    # Attach server metadata
    envelope = {
        "type": msg_type,
        "sender": sender,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }

    # Route by message type
    handler = HANDLERS.get(msg_type)
    if handler:
        await handler(session_code, sender, is_dm, envelope, payload)
    else:
        # Unknown type — just broadcast if it's from the DM
        if is_dm:
            await ws_manager.broadcast(session_code, envelope)


# --- Handler functions ---

async def handle_chat_message(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Public chat message — broadcast to all."""
    await ws_manager.broadcast(session_code, envelope)


async def handle_whisper(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Private whisper — send only to target and sender."""
    target = payload.get("target")
    if not target:
        return

    # Send to target
    await ws_manager.send_to(session_code, target, envelope)
    # Echo back to sender (so they see their own whisper)
    if target != sender:
        await ws_manager.send_to(session_code, sender, envelope)


async def handle_dice_roll(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Dice roll — broadcast to all (universal) unless secret."""
    if payload.get("secret") and is_dm:
        # DM secret roll — only DM sees it
        await ws_manager.send_to(session_code, sender, envelope)
    else:
        await ws_manager.broadcast(session_code, envelope)


async def handle_token_move(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Token movement — broadcast to all."""
    # TODO: validate that player can only move their own token (unless DM)
    await ws_manager.broadcast(session_code, envelope)


async def handle_token_add(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Add token — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_token_remove(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Remove token — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_fog_update(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Fog of war reveal — DM only, broadcast to players."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_combat_start(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Start combat — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_combat_next_turn(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Advance combat turn — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_combat_damage(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Apply damage/healing — DM only for NPCs, players for own character."""
    await ws_manager.broadcast(session_code, envelope)


async def handle_combat_end(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """End combat — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_music_play(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Play music — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_music_stop(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Stop music — DM only."""
    if not is_dm:
        return
    await ws_manager.broadcast(session_code, envelope)


async def handle_character_update(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Character sheet update — broadcast to DM."""
    session = session_manager.get_session(session_code)
    if session:
        await ws_manager.send_to(session_code, session.dm_name, envelope)


async def handle_speech_transcript(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Speech transcript from Discord bot — store and optionally broadcast captions to DM."""
    session = session_manager.get_session(session_code)
    if session:
        # Send to DM for live captions
        await ws_manager.send_to(session_code, session.dm_name, envelope)


async def handle_handout_reveal(session_code: str, sender: str, is_dm: bool, envelope: dict, payload: dict):
    """Reveal a handout — DM only, to specific players or all."""
    if not is_dm:
        return
    targets = payload.get("targets")  # list of player names, or None for all
    if targets:
        for target in targets:
            await ws_manager.send_to(session_code, target, envelope)
    else:
        await ws_manager.broadcast(session_code, envelope)


# --- Handler registry ---

HANDLERS = {
    "chat_message": handle_chat_message,
    "whisper": handle_whisper,
    "dice_roll": handle_dice_roll,
    "token_move": handle_token_move,
    "token_add": handle_token_add,
    "token_remove": handle_token_remove,
    "map_fog_update": handle_fog_update,
    "combat_start": handle_combat_start,
    "combat_next_turn": handle_combat_next_turn,
    "combat_damage": handle_combat_damage,
    "combat_end": handle_combat_end,
    "music_play": handle_music_play,
    "music_stop": handle_music_stop,
    "character_update": handle_character_update,
    "speech_transcript": handle_speech_transcript,
    "handout_reveal": handle_handout_reveal,
}
