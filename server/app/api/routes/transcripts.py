"""Transcript and Discord bot management API routes."""

import asyncio
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.config import settings
from app.services.discord_bot import get_transcript_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# Global bot task
_bot_task: Optional[asyncio.Task] = None


class TranscriptSessionSummary(BaseModel):
    """Summary of a transcript session."""

    session_id: str
    filename: str
    entry_count: int
    saved_at: Optional[str]


class TranscriptEntry(BaseModel):
    """Single transcript entry."""

    speaker: str
    text: str
    timestamp: str
    confidence: float = 1.0


class TranscriptSessionFull(BaseModel):
    """Full transcript session with all entries."""

    session_id: str
    entries: List[TranscriptEntry]
    saved_at: Optional[str]


class SearchResult(BaseModel):
    """Search result entry."""

    session_id: str
    speaker: str
    text: str
    timestamp: str
    confidence: float = 1.0


class BotStatus(BaseModel):
    """Bot status."""

    is_running: bool
    user: Optional[str]
    active_sessions: int
    active_recordings: int


class StartBotRequest(BaseModel):
    """Request to start the bot."""

    pass


class StopBotRequest(BaseModel):
    """Request to stop the bot."""

    pass


# ============================================================================
# TRANSCRIPT ENDPOINTS
# ============================================================================


@router.get("/{campaign_folder}/sessions", response_model=List[TranscriptSessionSummary])
async def list_sessions(campaign_folder: str):
    """
    List all transcript sessions for a campaign.

    Args:
        campaign_folder: Name of the campaign folder

    Returns:
        List of session summaries
    """
    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)
        sessions = manager.get_sessions(campaign_folder)
        return sessions
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(500, f"Error listing sessions: {e}")


@router.get("/{campaign_folder}/sessions/{session_id}", response_model=TranscriptSessionFull)
async def get_session(campaign_folder: str, session_id: str):
    """
    Get full transcript for a session.

    Args:
        campaign_folder: Name of the campaign folder
        session_id: Session identifier (e.g., 'session-2026-03-16')

    Returns:
        Full transcript with all entries
    """
    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)
        transcript = manager.get_session_transcript(campaign_folder, session_id)

        if not transcript:
            raise HTTPException(404, f"Session '{session_id}' not found")

        return TranscriptSessionFull(
            session_id=transcript.get("session_id", session_id),
            entries=[TranscriptEntry(**entry) for entry in transcript.get("entries", [])],
            saved_at=transcript.get("saved_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(500, f"Error getting session: {e}")


@router.get("/{campaign_folder}/search", response_model=List[SearchResult])
async def search_transcripts(campaign_folder: str, q: str):
    """
    Search transcripts in a campaign.

    Args:
        campaign_folder: Name of the campaign folder
        q: Search query (case-insensitive)

    Returns:
        List of matching entries
    """
    if not q:
        raise HTTPException(400, "Search query 'q' is required")

    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)
        results = manager.search_transcripts(campaign_folder, q)
        return [SearchResult(**result) for result in results]
    except Exception as e:
        logger.error(f"Error searching transcripts: {e}")
        raise HTTPException(500, f"Error searching transcripts: {e}")


# ============================================================================
# BOT CONTROL ENDPOINTS
# ============================================================================


@router.post("/{campaign_folder}/bot/start")
async def start_bot(campaign_folder: str, req: StartBotRequest):
    """
    Start the Discord bot (if not already running).

    Requires QUESTBOARD_DISCORD_BOT_TOKEN environment variable.

    Args:
        campaign_folder: Name of the campaign folder (for context)

    Returns:
        Status confirmation
    """
    global _bot_task

    if not settings.discord_bot_token:
        raise HTTPException(400, "QUESTBOARD_DISCORD_BOT_TOKEN not configured")

    if _bot_task and not _bot_task.done():
        raise HTTPException(409, "Bot is already running")

    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)

        # Start bot in background task
        async def run_bot():
            try:
                await manager.start()
            except Exception as e:
                logger.error(f"Bot crashed: {e}")

        _bot_task = asyncio.create_task(run_bot())
        logger.info("Started Discord bot")

        return {"status": "started", "message": "Discord bot is starting"}
    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        raise HTTPException(500, f"Error starting bot: {e}")


@router.post("/{campaign_folder}/bot/stop")
async def stop_bot(campaign_folder: str, req: StopBotRequest):
    """
    Stop the Discord bot gracefully.

    Args:
        campaign_folder: Name of the campaign folder

    Returns:
        Status confirmation
    """
    global _bot_task

    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)
        await manager.stop()

        if _bot_task:
            _bot_task.cancel()
            _bot_task = None

        logger.info("Stopped Discord bot")
        return {"status": "stopped", "message": "Discord bot has stopped"}
    except Exception as e:
        logger.error(f"Error stopping bot: {e}")
        raise HTTPException(500, f"Error stopping bot: {e}")


@router.get("/{campaign_folder}/bot/status", response_model=BotStatus)
async def get_bot_status(campaign_folder: str):
    """
    Get current status of the Discord bot.

    Args:
        campaign_folder: Name of the campaign folder

    Returns:
        Bot status with active sessions and recordings
    """
    try:
        manager = get_transcript_manager(settings.discord_bot_token, settings.campaign_root)
        status = manager.get_status()
        return BotStatus(**status)
    except Exception as e:
        logger.error(f"Error getting bot status: {e}")
        raise HTTPException(500, f"Error getting bot status: {e}")
