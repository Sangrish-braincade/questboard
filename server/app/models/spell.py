"""Spell model."""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, JSON, Text
from app.core.database import Base


class Spell(Base):
    __tablename__ = "spells"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    source = Column(String)
    level = Column(Integer)
    school = Column(String)
    casting_time = Column(String)
    range_ft = Column(Integer)
    aoe_shape = Column(String)
    aoe_size_ft = Column(Integer)
    duration = Column(String)
    damage_dice = Column(String)
    damage_type = Column(String)
    save_type = Column(String)
    num_targets = Column(Integer)
    description = Column(Text)
    higher_levels = Column(Text)
    components = Column(JSON)
    concentration = Column(Boolean)
    ritual = Column(Boolean)
    custom_fields = Column(JSON)
