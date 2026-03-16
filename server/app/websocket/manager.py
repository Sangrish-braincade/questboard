"""WebSocket connection manager — handles rooms, broadcasting, auth."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.security import decode_jwt
from app.services.session_manager import session_manager


class ConnectionManager:
    """Manages WebSocket connections grouped by session code (rooms)."""

    def __init__(self):
        # session_code -> {display_name -> WebSocket}
        self._rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_code: str, token: str) -> Optional[str]:
        """
        Authenticate and connect a WebSocket to a session room.
        Returns the display_name if successful, None if auth failed.
        """
        # Validate JWT
        payload = decode_jwt(token)
        if not payload or payload.session_code != session_code.upper():
            await websocket.close(code=4001, reason="Invalid or expired token")
            return None

        # Validate session exists
        session = session_manager.get_session(session_code)
        if not session:
            await websocket.close(code=4002, reason="Session not found")
            return None

        await websocket.accept()

        display_name = payload.sub

        # Add to room
        code = session_code.upper()
        if code not in self._rooms:
            self._rooms[code] = {}
        self._rooms[code][display_name] = websocket

        # Update session manager
        session_manager.set_player_connected(code, display_name, True)

        # Broadcast player join
        await self.broadcast(
            code,
            {
                "type": "player_join",
                "sender": "server",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "display_name": display_name,
                    "role": payload.role,
                },
            },
            exclude=display_name,
        )

        return display_name

    async def disconnect(self, session_code: str, display_name: str):
        """Disconnect a WebSocket from a session room."""
        code = session_code.upper()
        if code in self._rooms and display_name in self._rooms[code]:
            ws = self._rooms[code].pop(display_name)

            # Close if still open
            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.close()
                except Exception:
                    pass

            # Clean up empty rooms
            if not self._rooms[code]:
                del self._rooms[code]

        # Update session manager
        session_manager.set_player_connected(code, display_name, False)

        # Broadcast player leave
        await self.broadcast(
            code,
            {
                "type": "player_leave",
                "sender": "server",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {"display_name": display_name},
            },
        )

    async def broadcast(
        self,
        session_code: str,
        message: dict,
        exclude: Optional[str] = None,
    ):
        """Broadcast a message to all connections in a room."""
        code = session_code.upper()
        room = self._rooms.get(code, {})
        data = json.dumps(message)

        disconnected = []
        for name, ws in room.items():
            if name == exclude:
                continue
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(data)
            except Exception:
                disconnected.append(name)

        # Clean up dead connections
        for name in disconnected:
            await self.disconnect(code, name)

    async def send_to(
        self,
        session_code: str,
        display_name: str,
        message: dict,
    ):
        """Send a message to a specific player in a room."""
        code = session_code.upper()
        room = self._rooms.get(code, {})
        ws = room.get(display_name)

        if ws and ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                await self.disconnect(code, display_name)

    async def broadcast_except(
        self,
        session_code: str,
        message: dict,
        exclude: str,
    ):
        """Broadcast to everyone except one player."""
        await self.broadcast(session_code, message, exclude=exclude)

    def get_room_members(self, session_code: str) -> list[str]:
        """Get list of connected display names in a room."""
        code = session_code.upper()
        return list(self._rooms.get(code, {}).keys())

    def is_connected(self, session_code: str, display_name: str) -> bool:
        """Check if a player is connected to a session."""
        code = session_code.upper()
        return display_name in self._rooms.get(code, {})

    async def close_room(self, session_code: str):
        """Close all connections in a room (session ended)."""
        code = session_code.upper()
        room = self._rooms.get(code, {})
        for name in list(room.keys()):
            await self.disconnect(code, name)


# Singleton
ws_manager = ConnectionManager()
