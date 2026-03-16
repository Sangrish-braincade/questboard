"""Quest model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, JSON, Text, DateTime
from app.core.database import Base


class Quest(Base):
    __tablename__ = "quests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String)
    objectives = Column(JSON)
    rewards = Column(JSON)
    npc_ids = Column(JSON)
    map_ids = Column(JSON)
    hooks = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
