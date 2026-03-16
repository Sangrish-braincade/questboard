"""Campaign map model."""
import uuid
from sqlalchemy import Column, String, Integer, JSON
from app.core.database import Base


class Map(Base):
    __tablename__ = "maps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    file_path = Column(String)
    grid_type = Column(String)
    grid_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    fog_of_war = Column(JSON)
