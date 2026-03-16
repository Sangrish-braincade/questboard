"""Character routes — CRUD for player characters."""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class CharacterCreate(BaseModel):
    name: str
    player_name: str
    race: str = ""
    char_class: str = ""
    level: int = 1
    hp: int = 10
    max_hp: int = 10
    ac: int = 10
    stats: dict = {}  # {str: 10, dex: 12, ...}


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    race: Optional[str] = None
    char_class: Optional[str] = None
    level: Optional[int] = None
    hp: Optional[int] = None
    max_hp: Optional[int] = None
    ac: Optional[int] = None
    stats: Optional[dict] = None


@router.get("/{campaign_folder}")
async def list_characters(campaign_folder: str):
    """List all characters in a campaign."""
    players_dir = campaign_manager.root / "campaigns" / campaign_folder / "players"
    if not players_dir.exists():
        return []

    characters = []
    for player_dir in sorted(players_dir.iterdir()):
        if player_dir.is_dir():
            char_file = player_dir / "character.json"
            if char_file.exists():
                try:
                    data = json.loads(char_file.read_text())
                    data["folder"] = player_dir.name
                    characters.append(data)
                except (json.JSONDecodeError, IOError):
                    pass
    return characters


@router.get("/{campaign_folder}/{player_folder}")
async def get_character(campaign_folder: str, player_folder: str):
    """Get a specific character."""
    char_file = (
        campaign_manager.root
        / "campaigns"
        / campaign_folder
        / "players"
        / player_folder
        / "character.json"
    )
    if not char_file.exists():
        raise HTTPException(404, "Character not found")
    return json.loads(char_file.read_text())


@router.post("/{campaign_folder}")
async def create_character(campaign_folder: str, character: CharacterCreate):
    """Create a new character for a player."""
    player_path = campaign_manager.create_player_folder(
        campaign_folder, character.player_name
    )
    char_data = character.model_dump()
    char_file = player_path / "character.json"
    char_file.write_text(json.dumps(char_data, indent=2))
    return {"status": "created", "path": str(player_path), **char_data}


@router.put("/{campaign_folder}/{player_folder}")
async def update_character(
    campaign_folder: str, player_folder: str, updates: CharacterUpdate
):
    """Update a character's stats."""
    char_file = (
        campaign_manager.root
        / "campaigns"
        / campaign_folder
        / "players"
        / player_folder
        / "character.json"
    )
    if not char_file.exists():
        raise HTTPException(404, "Character not found")

    data = json.loads(char_file.read_text())
    for key, value in updates.model_dump(exclude_none=True).items():
        data[key] = value
    char_file.write_text(json.dumps(data, indent=2))
    return data


@router.delete("/{campaign_folder}/{player_folder}")
async def delete_character(campaign_folder: str, player_folder: str):
    """Delete a character (removes the JSON, keeps the folder)."""
    char_file = (
        campaign_manager.root
        / "campaigns"
        / campaign_folder
        / "players"
        / player_folder
        / "character.json"
    )
    if char_file.exists():
        char_file.unlink()
    return {"status": "deleted"}
