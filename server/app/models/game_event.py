"""Game event model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base


class GameEvent(Base):
    __tablename__ = "game_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=False)
    type = Column(String)
    actor = Column(String)
    payload = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
