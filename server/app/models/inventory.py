"""Shared inventory model."""
import uuid
from sqlalchemy import Column, String, Integer, JSON
from app.core.database import Base


class SharedInventory(Base):
    __tablename__ = "shared_inventory"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    items = Column(JSON)
    party_gold = Column(Integer)
