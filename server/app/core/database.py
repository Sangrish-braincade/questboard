"""SQLite database setup with SQLAlchemy async."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# Engine cache per campaign (each campaign has its own .db file)
_engines: dict[str, create_async_engine] = {}
_session_factories: dict[str, async_sessionmaker] = {}


def get_engine(campaign_path: str):
    """Get or create an async engine for a campaign's SQLite database."""
    if campaign_path not in _engines:
        db_path = Path(campaign_path) / "campaign.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"

        engine = create_async_engine(
            db_url,
            echo=False,
            connect_args={"check_same_thread": False},
        )
        _engines[campaign_path] = engine
    return _engines[campaign_path]


def get_session_factory(campaign_path: str) -> async_sessionmaker[AsyncSession]:
    """Get or create a session factory for a campaign."""
    if campaign_path not in _session_factories:
        engine = get_engine(campaign_path)
        _session_factories[campaign_path] = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
    return _session_factories[campaign_path]


async def init_db(campaign_path: str):
    """Initialize the database for a campaign — create all tables."""
    engine = get_engine(campaign_path)

    # Enable WAL mode for better concurrent read performance
    async with engine.begin() as conn:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")

    # Import all models so they register with Base.metadata
    from app.models import (  # noqa: F401
        player, character, campaign_map, token, npc,
        session, game_event, combat, spell, quest,
        encounter_template, inventory, transcript,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db(campaign_path: str):
    """Close the database engine for a campaign."""
    if campaign_path in _engines:
        await _engines[campaign_path].dispose()
        del _engines[campaign_path]
        del _session_factories[campaign_path]
