"""NPC model."""
import uuid
from sqlalchemy import Column, String, JSON, Text
from app.core.database import Base


class NPC(Base):
    __tablename__ = "npcs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    race = Column(String)
    stat_block = Column(JSON)
    notes = Column(Text)
    token_path = Column(String)
