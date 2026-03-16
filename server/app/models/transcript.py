"""Transcript entry model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text
from app.core.database import Base


class TranscriptEntry(Base):
    __tablename__ = "transcript_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=False)
    speaker = Column(String)
    character_name = Column(String)
    text = Column(Text, nullable=False)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
