"""Application configuration — loaded from environment or app-config.json."""

from pydantic_settings import BaseSettings
from pathlib import Path
import json
import os


class Settings(BaseSettings):
    # Server
    port: int = 7777
    host: str = "0.0.0.0"
    debug: bool = True

    # Paths
    campaign_root: str = str(Path.home() / "DnD Sessions")

    # Auth
    jwt_secret: str = "questboard-dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hour session

    # Session
    session_code_length: int = 6
    max_join_attempts: int = 5
    join_cooldown_seconds: int = 60

    # Google Cloud STT (optional)
    gcp_api_key: str = ""

    # Discord (optional)
    discord_bot_token: str = ""

    model_config = {
        "env_prefix": "QUESTBOARD_",
        "env_file": ".env",
    }


def load_settings() -> Settings:
    """Load settings, optionally from app-config.json if it exists."""
    config_path = Path.home() / "DnD Sessions" / "app-config.json"
    overrides = {}

    if config_path.exists():
        try:
            with open(config_path) as f:
                overrides = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    return Settings(**overrides)


settings = load_settings()
