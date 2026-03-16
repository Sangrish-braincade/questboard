"""Combat encounter model."""
import uuid
from sqlalchemy import Column, String, Integer, JSON
from app.core.database import Base


class CombatEncounter(Base):
    __tablename__ = "combat_encounters"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=False)
    map_id = Column(String)
    turn_order = Column(JSON)
    current_turn = Column(Integer)
    round_number = Column(Integer)
    status = Column(String)
