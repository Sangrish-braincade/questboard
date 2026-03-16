"""Quest routes — Quest builder with objectives, NPCs, rewards, and status tracking."""

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class QuestObjective(BaseModel):
    id: str = ""
    description: str
    completed: bool = False
    optional: bool = False


class QuestCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "available"  # available, active, completed, failed, hidden
    quest_giver: str = ""
    location: str = ""
    level_range: str = ""
    objectives: list[QuestObjective] = []
    rewards: dict = {}  # {xp: 100, gold: 50, items: ["Potion of Healing"]}
    notes: str = ""  # DM private notes
    linked_npcs: list[str] = []
    linked_maps: list[str] = []


class QuestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    quest_giver: Optional[str] = None
    location: Optional[str] = None
    level_range: Optional[str] = None
    objectives: Optional[list[QuestObjective]] = None
    rewards: Optional[dict] = None
    notes: Optional[str] = None
    linked_npcs: Optional[list[str]] = None
    linked_maps: Optional[list[str]] = None


def _quests_path(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "quests.json"


def _read_quests(campaign_folder: str) -> list[dict]:
    path = _quests_path(campaign_folder)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return []


def _write_quests(campaign_folder: str, quests: list[dict]):
    path = _quests_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(quests, indent=2))


@router.get("/{campaign_folder}")
async def list_quests(campaign_folder: str, status: Optional[str] = None):
    """List all quests, optionally filtered by status."""
    quests = _read_quests(campaign_folder)
    if status:
        quests = [q for q in quests if q.get("status") == status]
    return quests


@router.get("/{campaign_folder}/{quest_id}")
async def get_quest(campaign_folder: str, quest_id: str):
    """Get a specific quest by ID."""
    quests = _read_quests(campaign_folder)
    for q in quests:
        if q["id"] == quest_id:
            return q
    raise HTTPException(404, "Quest not found")


@router.post("/{campaign_folder}")
async def create_quest(campaign_folder: str, quest: QuestCreate):
    """Create a new quest."""
    quests = _read_quests(campaign_folder)
    data = quest.model_dump()
    data["id"] = str(uuid.uuid4())[:8]

    # Auto-assign objective IDs
    for i, obj in enumerate(data.get("objectives", [])):
        if not obj.get("id"):
            obj["id"] = f"obj-{i+1}"

    quests.append(data)
    _write_quests(campaign_folder, quests)
    return data


@router.put("/{campaign_folder}/{quest_id}")
async def update_quest(campaign_folder: str, quest_id: str, updates: QuestUpdate):
    """Update a quest."""
    quests = _read_quests(campaign_folder)
    for i, q in enumerate(quests):
        if q["id"] == quest_id:
            for key, value in updates.model_dump(exclude_none=True).items():
                if key == "objectives" and value is not None:
                    q[key] = [obj if isinstance(obj, dict) else obj.model_dump() for obj in value]
                else:
                    q[key] = value
            _write_quests(campaign_folder, quests)
            return q
    raise HTTPException(404, "Quest not found")


@router.post("/{campaign_folder}/{quest_id}/objective/{obj_id}/toggle")
async def toggle_objective(campaign_folder: str, quest_id: str, obj_id: str):
    """Toggle a quest objective's completion status."""
    quests = _read_quests(campaign_folder)
    for q in quests:
        if q["id"] == quest_id:
            for obj in q.get("objectives", []):
                if obj["id"] == obj_id:
                    obj["completed"] = not obj["completed"]
                    _write_quests(campaign_folder, quests)
                    return q
            raise HTTPException(404, "Objective not found")
    raise HTTPException(404, "Quest not found")


@router.delete("/{campaign_folder}/{quest_id}")
async def delete_quest(campaign_folder: str, quest_id: str):
    """Delete a quest."""
    quests = _read_quests(campaign_folder)
    filtered = [q for q in quests if q["id"] != quest_id]
    if len(filtered) == len(quests):
        raise HTTPException(404, "Quest not found")
    _write_quests(campaign_folder, filtered)
    return {"status": "deleted"}
