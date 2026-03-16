"""Discord STT bot for Questboard — captures and transcribes voice chat."""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict
import json

try:
    import discord
    from discord.ext import commands
    DISCORD_AVAILABLE = True
except ImportError:
    DISCORD_AVAILABLE = False

from app.services.transcript_store import TranscriptStore

logger = logging.getLogger(__name__)


@dataclass
class TranscriptEntry:
    """Single transcript entry."""

    speaker: str
    text: str
    timestamp: str  # ISO 8601
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AudioBuffer:
    """Buffers audio from a user and detects silence."""

    def __init__(self, user_id: int, username: str, silence_threshold_seconds: float = 5.0):
        self.user_id = user_id
        self.username = username
        self.silence_threshold_seconds = silence_threshold_seconds
        self.audio_chunks: List[bytes] = []
        self.last_chunk_time = datetime.now()
        self.is_active = False

    def add_chunk(self, chunk: bytes) -> bool:
        now = datetime.now()
        time_since_last = (now - self.last_chunk_time).total_seconds()
        if time_since_last > self.silence_threshold_seconds and self.audio_chunks:
            return True
        self.audio_chunks.append(chunk)
        self.last_chunk_time = now
        self.is_active = True
        return False

    def get_audio(self) -> Optional[bytes]:
        if not self.audio_chunks:
            return None
        audio = b"".join(self.audio_chunks)
        self.audio_chunks = []
        self.is_active = False
        return audio

    def has_buffered_audio(self) -> bool:
        return len(self.audio_chunks) > 0


async def _transcribe_audio(audio_data: bytes) -> Optional[str]:
    """Transcribe audio data. Uses Google Cloud or falls back to Whisper."""
    try:
        from google.cloud import speech
        client = speech.SpeechClient()
        audio = speech.RecognitionAudio(content=audio_data)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=48000,
            language_code="en-US",
        )
        response = client.recognize(config=config, audio=audio)
        if response.results:
            return response.results[0].alternatives[0].transcript
        return None
    except Exception as e:
        logger.warning(f"Google Cloud STT failed: {e}, falling back to Whisper")
        try:
            import whisper
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_data)
                temp_path = f.name
            model = whisper.load_model("base")
            result = model.transcribe(temp_path, language="en")
            Path(temp_path).unlink(missing_ok=True)
            if result and result.get("text"):
                return result["text"]
            return None
        except Exception as e2:
            logger.error(f"Whisper transcription failed: {e2}")
            return None


class TranscriptManager:
    """Manages Discord bot and transcript collection.

    Works in two modes:
    - With discord.py installed: full bot + voice recording
    - Without discord.py: transcript store only (read/search existing transcripts)
    """

    def __init__(self, bot_token: str, campaign_root: Path):
        self.bot_token = bot_token
        self.campaign_root = Path(campaign_root)
        self.transcript_store = TranscriptStore(self.campaign_root)
        self.recorders: Dict[str, Any] = {}
        self.bot = None
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

        if DISCORD_AVAILABLE and bot_token:
            self._setup_bot()

    def _setup_bot(self):
        """Create and configure the Discord bot (only if discord.py available)."""
        if not DISCORD_AVAILABLE:
            return

        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True

        self.bot = commands.Bot(command_prefix="!", intents=intents)

        @self.bot.event
        async def on_ready():
            logger.info(f"Bot logged in as {self.bot.user}")

        @self.bot.command(name="join")
        async def join(ctx):
            if not ctx.author.voice:
                await ctx.send("You must be in a voice channel to use this command.")
                return
            channel = ctx.author.voice.channel
            try:
                await channel.connect()
                await ctx.send(f"Joined {channel.name}")
                logger.info(f"Joined {channel.name} in {ctx.guild.name}")
            except Exception as e:
                await ctx.send(f"Failed to join: {e}")

        @self.bot.command(name="leave")
        async def leave(ctx):
            if ctx.voice_client:
                await ctx.voice_client.disconnect()
                await ctx.send("Left the voice channel")
            else:
                await ctx.send("Not in a voice channel")

        @self.bot.command(name="transcribe")
        async def transcribe_cmd(ctx, action: str = "start"):
            if action.lower() == "start":
                if not ctx.author.voice:
                    await ctx.send("You must be in a voice channel.")
                    return

                channel = ctx.author.voice.channel
                guild = ctx.guild
                recorder_key = f"{guild.id}_{channel.id}"

                try:
                    session_id = f"session-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}"
                    campaign_folder = ctx.guild.name

                    sink = discord.sinks.WaveSink()
                    vc = ctx.voice_client or await channel.connect()
                    vc.start_recording(sink, self._recording_finished, ctx)

                    self.recorders[recorder_key] = {
                        "voice_client": vc,
                        "sink": sink,
                        "campaign_folder": campaign_folder,
                        "session_id": session_id,
                    }
                    self.active_sessions[session_id] = {
                        "guild_id": guild.id,
                        "channel_id": channel.id,
                        "campaign_folder": campaign_folder,
                        "started_at": datetime.now().isoformat(),
                    }
                    await ctx.send(f"Started transcribing in {channel.name} (Session: {session_id})")
                except Exception as e:
                    await ctx.send(f"Error: {e}")
                    logger.error(f"Error starting transcription: {e}")

            elif action.lower() == "stop":
                guild = ctx.guild
                channel = ctx.author.voice.channel if ctx.author.voice else None
                if not channel:
                    await ctx.send("You must be in a voice channel to stop transcription.")
                    return

                recorder_key = f"{guild.id}_{channel.id}"
                if recorder_key in self.recorders:
                    rec = self.recorders[recorder_key]
                    rec["voice_client"].stop_recording()
                    del self.recorders[recorder_key]
                    await ctx.send("Stopped transcribing")
                else:
                    await ctx.send("No active recording in this channel")
            else:
                await ctx.send("Usage: !transcribe start|stop")

    async def _recording_finished(self, sink, ctx):
        """Called when recording stops — process audio per user."""
        for user_id, audio in sink.audio_data.items():
            audio_data = audio.file.read()
            user = ctx.guild.get_member(user_id)
            username = user.display_name if user else f"User-{user_id}"
            text = await _transcribe_audio(audio_data)
            if text:
                # Find session info from active recorders
                for rec in self.recorders.values():
                    entry = TranscriptEntry(
                        speaker=username,
                        text=text,
                        timestamp=datetime.now().isoformat(),
                        confidence=0.95,
                    )
                    self.transcript_store.append_entry(
                        rec["campaign_folder"], rec["session_id"], entry.to_dict()
                    )
                    break

    async def start(self) -> bool:
        """Start the Discord bot."""
        if not DISCORD_AVAILABLE:
            logger.error("discord.py is not installed — cannot start bot")
            return False
        if not self.bot_token:
            logger.error("DISCORD_BOT_TOKEN not configured")
            return False
        try:
            await self.bot.start(self.bot_token)
            return True
        except Exception as e:
            logger.error(f"Failed to start bot: {e}")
            return False

    async def stop(self) -> None:
        """Stop the Discord bot gracefully."""
        for rec in list(self.recorders.values()):
            try:
                vc = rec.get("voice_client")
                if vc:
                    vc.stop_recording()
                    await vc.disconnect()
            except Exception:
                pass
        self.recorders.clear()

        if self.bot:
            await self.bot.close()
            logger.info("Bot disconnected")

    # ─── API methods (always available, even without discord.py) ─────

    def get_sessions(self, campaign_folder: str) -> List[Dict[str, Any]]:
        return self.transcript_store.list_sessions(campaign_folder)

    def get_session_transcript(self, campaign_folder: str, session_id: str) -> Optional[Dict[str, Any]]:
        return self.transcript_store.load_transcript(campaign_folder, session_id)

    def search_transcripts(self, campaign_folder: str, query: str) -> List[Dict[str, Any]]:
        return self.transcript_store.search_transcripts(campaign_folder, query)

    def get_status(self) -> Dict[str, Any]:
        bot_running = False
        bot_user = None
        if DISCORD_AVAILABLE and self.bot and hasattr(self.bot, 'user') and self.bot.user:
            bot_running = True
            bot_user = str(self.bot.user)
        return {
            "discord_available": DISCORD_AVAILABLE,
            "is_running": bot_running,
            "user": bot_user,
            "active_sessions": len(self.active_sessions),
            "active_recordings": len(self.recorders),
        }


# ─── Global instance ────────────────────────────────────────────────

_transcript_manager: Optional[TranscriptManager] = None


def get_transcript_manager(bot_token: str = "", campaign_root: Path = Path(".")) -> TranscriptManager:
    """Get or create the global TranscriptManager instance."""
    global _transcript_manager
    if _transcript_manager is None:
        _transcript_manager = TranscriptManager(bot_token, campaign_root)
    return _transcript_manager
