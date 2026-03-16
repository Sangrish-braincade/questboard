"""NPC routes — manage NPCs and stat blocks for a campaign."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class NPCCreate(BaseModel):
    name: str
    race: str = ""
    description: str = ""
    hp: int = 10
    max_hp: int = 10
    ac: int = 10
    cr: str = "0"  # Challenge rating
    abilities: dict = {}  # {str: 10, dex: 12, ...}
    actions: list[dict] = []  # [{name: "Bite", damage: "1d6+2", ...}]
    notes: str = ""


class NPCUpdate(BaseModel):
    name: Optional[str] = None
    race: Optional[str] = None
    description: Optional[str] = None
    hp: Optional[int] = None
    max_hp: Optional[int] = None
    ac: Optional[int] = None
    cr: Optional[str] = None
    abilities: Optional[dict] = None
    actions: Optional[list[dict]] = None
    notes: Optional[str] = None


def _npcs_dir(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "npcs" / "stat-blocks"


def _safe_filename(name: str) -> str:
    safe = name.lower().strip().replace(" ", "-")
    return "".join(c for c in safe if c.isalnum() or c in "-_") or "unnamed"


@router.get("/{campaign_folder}")
async def list_npcs(campaign_folder: str):
    """List all NPCs in a campaign."""
    npcs_dir = _npcs_dir(campaign_folder)
    if not npcs_dir.exists():
        return []

    npcs = []
    for f in sorted(npcs_dir.iterdir()):
        if f.suffix == ".json":
            try:
                data = json.loads(f.read_text())
                data["id"] = f.stem
                npcs.append(data)
            except (json.JSONDecodeError, IOError):
                pass
    return npcs


@router.get("/{campaign_folder}/{npc_id}")
async def get_npc(campaign_folder: str, npc_id: str):
    """Get a specific NPC's stat block."""
    npc_file = _npcs_dir(campaign_folder) / f"{npc_id}.json"
    if not npc_file.exists():
        raise HTTPException(404, "NPC not found")
    data = json.loads(npc_file.read_text())
    data["id"] = npc_id
    return data


@router.post("/{campaign_folder}")
async def create_npc(campaign_folder: str, npc: NPCCreate):
    """Create a new NPC."""
    npcs_dir = _npcs_dir(campaign_folder)
    npcs_dir.mkdir(parents=True, exist_ok=True)

    npc_id = _safe_filename(npc.name)
    npc_file = npcs_dir / f"{npc_id}.json"

    data = npc.model_dump()
    npc_file.write_text(json.dumps(data, indent=2))
    return {"id": npc_id, **data}


@router.put("/{campaign_folder}/{npc_id}")
async def update_npc(campaign_folder: str, npc_id: str, updates: NPCUpdate):
    """Update an NPC's stat block."""
    npc_file = _npcs_dir(campaign_folder) / f"{npc_id}.json"
    if not npc_file.exists():
        raise HTTPException(404, "NPC not found")

    data = json.loads(npc_file.read_text())
    for key, value in updates.model_dump(exclude_none=True).items():
        data[key] = value
    npc_file.write_text(json.dumps(data, indent=2))
    return {"id": npc_id, **data}


@router.delete("/{campaign_folder}/{npc_id}")
async def delete_npc(campaign_folder: str, npc_id: str):
    """Delete an NPC."""
    npc_file = _npcs_dir(campaign_folder) / f"{npc_id}.json"
    if npc_file.exists():
        npc_file.unlink()
    return {"status": "deleted"}
