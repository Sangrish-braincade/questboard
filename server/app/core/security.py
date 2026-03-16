"""Security — session codes, JWT tokens, rate limiting."""

import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings


# --- Session Code ---

def generate_session_code(length: int = 6) -> str:
    """Generate a random alphanumeric session code (e.g., 'K7X9M2')."""
    alphabet = string.ascii_uppercase + string.digits
    # Remove ambiguous characters: 0/O, 1/I/L
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("L", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


# --- JWT ---

class TokenPayload(BaseModel):
    sub: str          # player display name
    role: str         # "dm" or "player" or "spectator"
    session_code: str
    campaign: str     # campaign folder name
    exp: datetime


def create_jwt(
    display_name: str,
    role: str,
    session_code: str,
    campaign: str,
    expires_minutes: Optional[int] = None,
) -> str:
    """Create a JWT token for a session participant."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_expire_minutes
    )
    payload = {
        "sub": display_name,
        "role": role,
        "session_code": session_code,
        "campaign": campaign,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_jwt(token: str) -> Optional[TokenPayload]:
    """Decode and validate a JWT token. Returns None if invalid/expired."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        return TokenPayload(**payload)
    except (JWTError, Exception):
        return None


# --- Rate Limiter (in-memory, per-IP) ---

class RateLimiter:
    """Simple in-memory rate limiter for join attempts."""

    def __init__(self, max_attempts: int = 5, cooldown_seconds: int = 60):
        self.max_attempts = max_attempts
        self.cooldown_seconds = cooldown_seconds
        self._attempts: dict[str, list[float]] = {}

    def check(self, key: str) -> bool:
        """Returns True if the request is allowed, False if rate limited."""
        now = time.time()
        cutoff = now - self.cooldown_seconds

        if key not in self._attempts:
            self._attempts[key] = []

        # Remove old attempts outside the window
        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]

        if len(self._attempts[key]) >= self.max_attempts:
            return False

        self._attempts[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        """How many attempts remain in the current window."""
        now = time.time()
        cutoff = now - self.cooldown_seconds
        if key not in self._attempts:
            return self.max_attempts
        recent = [t for t in self._attempts[key] if t > cutoff]
        return max(0, self.max_attempts - len(recent))

    def reset(self, key: str):
        """Reset attempts for a key."""
        self._attempts.pop(key, None)


# Global rate limiter instance
join_limiter = RateLimiter(
    max_attempts=settings.max_join_attempts,
    cooldown_seconds=settings.join_cooldown_seconds,
)
