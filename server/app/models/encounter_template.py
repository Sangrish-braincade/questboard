"""Encounter template model."""
import uuid
from sqlalchemy import Column, String, JSON, Text
from app.core.database import Base


class EncounterTemplate(Base):
    __tablename__ = "encounter_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    map_id = Column(String)
    monsters = Column(JSON)
    difficulty = Column(String)
    notes = Column(Text)
