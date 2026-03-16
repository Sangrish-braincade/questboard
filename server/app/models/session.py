"""Game session model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text
from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_number = Column(Integer)
    status = Column(String)
    map_id = Column(String)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    notes = Column(Text)
