"""Spell routes — SRD spell database + custom spell CRUD."""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.data.srd_spells import get_all_spells, get_spell_by_name, search_spells
from app.services.campaign_manager import campaign_manager

router = APIRouter()


class CustomSpellCreate(BaseModel):
    name: str
    level: int = 0
    school: str = "evocation"
    casting_time: str = "1 action"
    range_ft: int = 0
    components: str = "V, S"
    duration: str = "Instantaneous"
    description: str = ""
    damage_type: Optional[str] = None
    damage_dice: Optional[str] = None
    aoe_shape: Optional[str] = None  # sphere, cone, cube, line, cylinder
    aoe_size_ft: int = 0
    num_targets: int = 1
    concentration: bool = False
    ritual: bool = False


# ─── SRD Spells ───────────────────────────────────────────────────────

@router.get("/srd")
async def list_srd_spells(
    q: str = "",
    level: Optional[int] = None,
    school: Optional[str] = None,
    class_name: Optional[str] = None,
):
    """Search the SRD spell database."""
    return search_spells(query=q, level=level, school=school, class_name=class_name)


@router.get("/srd/{spell_name}")
async def get_srd_spell(spell_name: str):
    """Get a specific SRD spell by name."""
    spell = get_spell_by_name(spell_name.replace("-", " "))
    if not spell:
        raise HTTPException(404, f"Spell '{spell_name}' not found in SRD")
    return spell


# ─── Custom Spells (per campaign) ─────────────────────────────────────

@router.get("/custom/{campaign_folder}")
async def list_custom_spells(campaign_folder: str):
    """List custom spells for a campaign."""
    spells_file = _custom_spells_path(campaign_folder)
    if not spells_file.exists():
        return []
    try:
        return json.loads(spells_file.read_text())
    except (json.JSONDecodeError, IOError):
        return []


@router.post("/custom/{campaign_folder}")
async def create_custom_spell(campaign_folder: str, spell: CustomSpellCreate):
    """Create a custom spell for a campaign."""
    spells_file = _custom_spells_path(campaign_folder)
    spells_file.parent.mkdir(parents=True, exist_ok=True)

    existing = []
    if spells_file.exists():
        try:
            existing = json.loads(spells_file.read_text())
        except (json.JSONDecodeError, IOError):
            pass

    # Check for duplicates
    for s in existing:
        if s["name"].lower() == spell.name.lower():
            raise HTTPException(409, f"Custom spell '{spell.name}' already exists")

    data = spell.model_dump()
    data["custom"] = True
    existing.append(data)
    spells_file.write_text(json.dumps(existing, indent=2))
    return data


@router.delete("/custom/{campaign_folder}/{spell_name}")
async def delete_custom_spell(campaign_folder: str, spell_name: str):
    """Delete a custom spell."""
    spells_file = _custom_spells_path(campaign_folder)
    if not spells_file.exists():
        raise HTTPException(404, "No custom spells found")

    existing = json.loads(spells_file.read_text())
    filtered = [s for s in existing if s["name"].lower() != spell_name.lower()]

    if len(filtered) == len(existing):
        raise HTTPException(404, f"Custom spell '{spell_name}' not found")

    spells_file.write_text(json.dumps(filtered, indent=2))
    return {"status": "deleted"}


def _custom_spells_path(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "custom-spells.json"
