"""Active session management — tracks live sessions in memory."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.core.security import generate_session_code


@dataclass
class ActivePlayer:
    display_name: str
    role: str  # "dm", "player", "spectator"
    character_id: Optional[str] = None
    connected: bool = False
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ActiveSession:
    session_code: str
    campaign_folder: str
    dm_name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    players: dict[str, ActivePlayer] = field(default_factory=dict)
    locked: bool = False  # If True, no new players can join

    @property
    def player_count(self) -> int:
        return len([p for p in self.players.values() if p.role == "player"])

    @property
    def connected_count(self) -> int:
        return len([p for p in self.players.values() if p.connected])


class SessionManager:
    """Manages active game sessions in memory. One session per campaign at a time."""

    def __init__(self):
        self._sessions: dict[str, ActiveSession] = {}  # code -> session
        self._campaign_sessions: dict[str, str] = {}  # campaign_folder -> code

    def create_session(self, campaign_folder: str, dm_name: str) -> ActiveSession:
        """Create a new active session for a campaign."""
        # End any existing session for this campaign
        if campaign_folder in self._campaign_sessions:
            self.end_session(self._campaign_sessions[campaign_folder])

        code = generate_session_code()
        # Ensure unique code
        while code in self._sessions:
            code = generate_session_code()

        session = ActiveSession(
            session_code=code,
            campaign_folder=campaign_folder,
            dm_name=dm_name,
        )

        # Add DM as a player
        session.players[dm_name] = ActivePlayer(
            display_name=dm_name, role="dm", connected=True
        )

        self._sessions[code] = session
        self._campaign_sessions[campaign_folder] = code
        return session

    def get_session(self, code: str) -> Optional[ActiveSession]:
        """Get an active session by code."""
        return self._sessions.get(code.upper())

    def get_session_by_campaign(self, campaign_folder: str) -> Optional[ActiveSession]:
        """Get the active session for a campaign."""
        code = self._campaign_sessions.get(campaign_folder)
        if code:
            return self._sessions.get(code)
        return None

    def validate_code(self, code: str) -> bool:
        """Check if a session code is valid and the session is active."""
        session = self._sessions.get(code.upper())
        return session is not None and not session.locked

    def add_player(self, code: str, display_name: str, role: str = "player") -> Optional[ActivePlayer]:
        """Add a player to an active session."""
        session = self.get_session(code)
        if not session or session.locked:
            return None

        if display_name in session.players:
            # Player reconnecting
            session.players[display_name].connected = True
            return session.players[display_name]

        player = ActivePlayer(display_name=display_name, role=role)
        session.players[display_name] = player
        return player

    def remove_player(self, code: str, display_name: str):
        """Remove a player from an active session (kick)."""
        session = self.get_session(code)
        if session and display_name in session.players:
            del session.players[display_name]

    def set_player_connected(self, code: str, display_name: str, connected: bool):
        """Update a player's connection status."""
        session = self.get_session(code)
        if session and display_name in session.players:
            session.players[display_name].connected = connected

    def regenerate_code(self, old_code: str) -> Optional[str]:
        """Generate a new code for an existing session."""
        session = self._sessions.get(old_code.upper())
        if not session:
            return None

        new_code = generate_session_code()
        while new_code in self._sessions:
            new_code = generate_session_code()

        # Swap
        del self._sessions[old_code.upper()]
        session.session_code = new_code
        self._sessions[new_code] = session
        self._campaign_sessions[session.campaign_folder] = new_code
        return new_code

    def lock_session(self, code: str):
        """Lock a session so no new players can join."""
        session = self.get_session(code)
        if session:
            session.locked = True

    def unlock_session(self, code: str):
        """Unlock a session to allow new players."""
        session = self.get_session(code)
        if session:
            session.locked = False

    def end_session(self, code: str) -> Optional[ActiveSession]:
        """End an active session."""
        code = code.upper()
        session = self._sessions.pop(code, None)
        if session:
            self._campaign_sessions.pop(session.campaign_folder, None)
        return session

    def list_active_sessions(self) -> list[dict]:
        """List all active sessions."""
        return [
            {
                "session_code": s.session_code,
                "campaign_folder": s.campaign_folder,
                "dm_name": s.dm_name,
                "player_count": s.player_count,
                "connected_count": s.connected_count,
                "locked": s.locked,
                "created_at": s.created_at.isoformat(),
            }
            for s in self._sessions.values()
        ]


# Singleton
session_manager = SessionManager()
