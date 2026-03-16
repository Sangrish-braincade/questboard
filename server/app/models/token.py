"""Token model."""
import uuid
from sqlalchemy import Column, String, Integer, Float, JSON
from app.core.database import Base


class Token(Base):
    __tablename__ = "tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    map_id = Column(String, nullable=False)
    entity_type = Column(String)
    entity_id = Column(String)
    name = Column(String, nullable=False)
    x = Column(Float)
    y = Column(Float)
    size = Column(Integer)
    icon_path = Column(String)
    visible_to = Column(JSON)
    conditions = Column(JSON)
