"""Character model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, JSON, Text
from app.core.database import Base


class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    race = Column(String)
    char_class = Column(String)
    level = Column(Integer, default=1)
    stats = Column(JSON)
    hp_current = Column(Integer)
    hp_max = Column(Integer)
    armor_class = Column(Integer)
    speed = Column(Integer)
    spell_slots = Column(JSON)
    spells = Column(JSON)
    features = Column(JSON)
    proficiencies = Column(JSON)
    inventory = Column(JSON)
    portrait_path = Column(String)
    sheet_data = Column(JSON)
    uploaded_sheet_path = Column(String)
    owned_by = Column(String)
