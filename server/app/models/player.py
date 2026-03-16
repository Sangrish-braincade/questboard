"""Player model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from app.core.database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String, nullable=False)
    character_id = Column(String)
    color = Column(String)
    joined_at = Column(DateTime, default=datetime.utcnow)
