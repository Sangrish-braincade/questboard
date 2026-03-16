"""Authentication routes — session codes, JWT, player join/kick."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from app.core.security import create_jwt, decode_jwt, join_limiter
from app.services.session_manager import session_manager

router = APIRouter()


class HostSessionRequest(BaseModel):
    campaign_folder: str
    dm_name: str


class HostSessionResponse(BaseModel):
    session_code: str
    campaign_folder: str
    token: str


class JoinRequest(BaseModel):
    session_code: str
    display_name: str


class JoinResponse(BaseModel):
    token: str
    role: str
    campaign_folder: str
    session_code: str
    players: list[dict]


class KickRequest(BaseModel):
    display_name: str


# --- DM: Host a session ---

@router.post("/host", response_model=HostSessionResponse)
async def host_session(req: HostSessionRequest):
    """DM starts hosting a session for a campaign. Returns session code + JWT."""
    session = session_manager.create_session(req.campaign_folder, req.dm_name)
    token = create_jwt(
        display_name=req.dm_name,
        role="dm",
        session_code=session.session_code,
        campaign=req.campaign_folder,
    )
    return HostSessionResponse(
        session_code=session.session_code,
        campaign_folder=req.campaign_folder,
        token=token,
    )


# --- Player: Join a session ---

@router.post("/join", response_model=JoinResponse)
async def join_session(req: JoinRequest, request: Request):
    """Player joins a session with a code. Returns JWT."""
    # Rate limiting by IP
    client_ip = request.client.host if request.client else "unknown"
    if not join_limiter.check(client_ip):
        remaining_attempts = join_limiter.remaining(client_ip)
        raise HTTPException(
            429,
            f"Too many join attempts. Try again in {join_limiter.cooldown_seconds} seconds.",
        )

    # Validate code
    code = req.session_code.upper().strip()
    if not session_manager.validate_code(code):
        raise HTTPException(401, "Invalid or expired session code")

    session = session_manager.get_session(code)
    if not session:
        raise HTTPException(401, "Session not found")

    # Check for duplicate names
    if req.display_name.lower() == session.dm_name.lower() and req.display_name != session.dm_name:
        raise HTTPException(409, "That name is taken by the DM")

    # Add player
    player = session_manager.add_player(code, req.display_name, role="player")
    if not player:
        raise HTTPException(403, "Session is locked — no new players allowed")

    token = create_jwt(
        display_name=req.display_name,
        role="player",
        session_code=code,
        campaign=session.campaign_folder,
    )

    # Return current player list
    players = [
        {
            "display_name": p.display_name,
            "role": p.role,
            "connected": p.connected,
        }
        for p in session.players.values()
    ]

    return JoinResponse(
        token=token,
        role="player",
        campaign_folder=session.campaign_folder,
        session_code=code,
        players=players,
    )


# --- DM: Get current session info ---

@router.get("/session/{session_code}")
async def get_session_info(session_code: str):
    """Get info about an active session."""
    session = session_manager.get_session(session_code)
    if not session:
        raise HTTPException(404, "Session not found")

    return {
        "session_code": session.session_code,
        "campaign_folder": session.campaign_folder,
        "dm_name": session.dm_name,
        "locked": session.locked,
        "player_count": session.player_count,
        "connected_count": session.connected_count,
        "players": [
            {
                "display_name": p.display_name,
                "role": p.role,
                "connected": p.connected,
                "joined_at": p.joined_at.isoformat(),
            }
            for p in session.players.values()
        ],
    }


# --- DM: Kick a player ---

@router.post("/session/{session_code}/kick")
async def kick_player(session_code: str, req: KickRequest):
    """DM kicks a player from the session."""
    session = session_manager.get_session(session_code)
    if not session:
        raise HTTPException(404, "Session not found")

    if req.display_name == session.dm_name:
        raise HTTPException(400, "Cannot kick the DM")

    session_manager.remove_player(session_code, req.display_name)
    return {"message": f"Kicked {req.display_name}"}


# --- DM: Regenerate session code ---

@router.post("/session/{session_code}/regenerate")
async def regenerate_code(session_code: str):
    """Generate a new session code (invalidates the old one)."""
    new_code = session_manager.regenerate_code(session_code)
    if not new_code:
        raise HTTPException(404, "Session not found")
    return {"new_session_code": new_code}


# --- DM: Lock/unlock session ---

@router.post("/session/{session_code}/lock")
async def lock_session(session_code: str):
    """Lock session — no new players can join."""
    session_manager.lock_session(session_code)
    return {"locked": True}


@router.post("/session/{session_code}/unlock")
async def unlock_session(session_code: str):
    """Unlock session — new players can join again."""
    session_manager.unlock_session(session_code)
    return {"locked": False}


# --- DM: End session ---

@router.post("/session/{session_code}/end")
async def end_session(session_code: str):
    """End the session. Disconnects all players."""
    session = session_manager.end_session(session_code)
    if not session:
        raise HTTPException(404, "Session not found")
    return {"message": "Session ended", "campaign": session.campaign_folder}


# --- Validate token ---

@router.get("/me")
async def get_me(request: Request):
    """Validate JWT and return current user info."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid token")

    token = auth_header.split(" ", 1)[1]
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    return {
        "display_name": payload.sub,
        "role": payload.role,
        "session_code": payload.session_code,
        "campaign": payload.campaign,
    }
