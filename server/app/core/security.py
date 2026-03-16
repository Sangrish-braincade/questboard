"""Security utilities."""
import uuid
import secrets


def generate_session_code() -> str:
    """Generate a secure session code."""
    return secrets.token_hex(16)


def create_jwt(payload: dict) -> str:
    """Create a JWT token from payload."""
    # Placeholder implementation
    return secrets.token_urlsafe(32)
