"""Encounter template routes — Pre-built and custom encounter configurations."""

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class MonsterEntry(BaseModel):
    name: str
    count: int = 1
    hp: int = 10
    ac: int = 10
    cr: str = "0"
    initiative_bonus: int = 0
    notes: str = ""


class EncounterCreate(BaseModel):
    name: str
    description: str = ""
    difficulty: str = "medium"  # easy, medium, hard, deadly
    environment: str = ""  # dungeon, outdoor, underwater, etc.
    monsters: list[MonsterEntry] = []
    notes: str = ""
    map_suggestion: str = ""
    loot: list[str] = []
    xp_reward: int = 0


@router.get("/templates")
async def list_builtin_templates():
    """Get built-in encounter templates (Stormwreck Isle + generic)."""
    return BUILTIN_ENCOUNTERS


@router.get("/{campaign_folder}")
async def list_custom_encounters(campaign_folder: str):
    """List custom encounter templates for a campaign."""
    path = _encounters_path(campaign_folder)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, IOError):
        return []


@router.post("/{campaign_folder}")
async def create_encounter(campaign_folder: str, encounter: EncounterCreate):
    """Save a custom encounter template."""
    path = _encounters_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = []
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass

    data = encounter.model_dump()
    data["id"] = str(uuid.uuid4())[:8]
    data["custom"] = True
    existing.append(data)
    path.write_text(json.dumps(existing, indent=2))
    return data


@router.post("/{campaign_folder}/from-template/{template_name}")
async def copy_from_template(campaign_folder: str, template_name: str):
    """Copy a built-in template into the campaign's custom encounters."""
    template = None
    for t in BUILTIN_ENCOUNTERS:
        if t["name"].lower().replace(" ", "-") == template_name.lower().replace(" ", "-"):
            template = dict(t)
            break
    if not template:
        raise HTTPException(404, f"Template '{template_name}' not found")

    path = _encounters_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = []
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass

    template["id"] = str(uuid.uuid4())[:8]
    template["custom"] = True
    existing.append(template)
    path.write_text(json.dumps(existing, indent=2))
    return template


@router.delete("/{campaign_folder}/{encounter_id}")
async def delete_encounter(campaign_folder: str, encounter_id: str):
    """Delete a custom encounter template."""
    path = _encounters_path(campaign_folder)
    if not path.exists():
        raise HTTPException(404, "No encounters found")

    existing = json.loads(path.read_text())
    filtered = [e for e in existing if e.get("id") != encounter_id]
    if len(filtered) == len(existing):
        raise HTTPException(404, "Encounter not found")

    path.write_text(json.dumps(filtered, indent=2))
    return {"status": "deleted"}


def _encounters_path(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "encounter-templates.json"


# ─── Built-in Encounter Templates (Stormwreck Isle + Generic 5e) ──────

BUILTIN_ENCOUNTERS = [
    # --- Stormwreck Isle encounters ---
    {
        "name": "Dragon's Rest - Zombie Attack",
        "description": "Zombies shuffle out of the fog toward the monastery at Dragon's Rest. The adventurers must defend the inhabitants.",
        "difficulty": "easy",
        "environment": "outdoor",
        "monsters": [
            {"name": "Zombie", "count": 3, "hp": 22, "ac": 8, "cr": "1/4", "initiative_bonus": -2},
        ],
        "notes": "Zombies approach from the north. Runara asks the party to handle it. Good intro combat for level 1.",
        "loot": [],
        "xp_reward": 150,
        "source": "Stormwreck Isle",
    },
    {
        "name": "Seagrow Caves - Myconid Colony",
        "description": "A colony of myconids inhabits the Seagrow Caves. They communicate telepathically and are generally peaceful unless threatened.",
        "difficulty": "medium",
        "environment": "cave",
        "monsters": [
            {"name": "Myconid Sprout", "count": 4, "hp": 7, "ac": 10, "cr": "0", "initiative_bonus": 0},
            {"name": "Myconid Adult", "count": 2, "hp": 22, "ac": 12, "cr": "1/2", "initiative_bonus": 0},
        ],
        "notes": "Can be resolved through diplomacy. Rapport spores allow communication. Sovereign is willing to negotiate.",
        "loot": ["Potion of Healing"],
        "xp_reward": 200,
        "source": "Stormwreck Isle",
    },
    {
        "name": "Clifftop Observatory - Harpy Nest",
        "description": "Harpies have taken up residence in the clifftop observatory. Their luring song can be heard from a distance.",
        "difficulty": "medium",
        "environment": "outdoor",
        "monsters": [
            {"name": "Harpy", "count": 2, "hp": 38, "ac": 11, "cr": "1", "initiative_bonus": 1},
        ],
        "notes": "Harpies use Luring Song to draw PCs toward the cliff edge (DC 11 Wis save). Advantage on save if taking damage.",
        "loot": ["50 gp in scattered coins", "Pearl necklace (75 gp)"],
        "xp_reward": 400,
        "source": "Stormwreck Isle",
    },
    {
        "name": "Cursed Shipwreck - Undead Sailors",
        "description": "The wreck of a ship near the shore holds undead sailors who rise when disturbed.",
        "difficulty": "hard",
        "environment": "coastal",
        "monsters": [
            {"name": "Skeleton", "count": 4, "hp": 13, "ac": 13, "cr": "1/4", "initiative_bonus": 2},
            {"name": "Zombie", "count": 2, "hp": 22, "ac": 8, "cr": "1/4", "initiative_bonus": -2},
            {"name": "Ghoul", "count": 1, "hp": 22, "ac": 12, "cr": "1", "initiative_bonus": 2},
        ],
        "notes": "The ghoul is the former captain. Searching the wreck reveals a waterlogged map and a locked chest (DC 15 to pick, contains quest item).",
        "loot": ["Waterlogged map", "Driftglobe", "30 gp"],
        "xp_reward": 550,
        "source": "Stormwreck Isle",
    },
    {
        "name": "Sparkrender's Lair",
        "description": "The young blue dragon Sparkrender lairs in a cavern crackling with static electricity. This is the climactic encounter of Stormwreck Isle.",
        "difficulty": "deadly",
        "environment": "cave",
        "monsters": [
            {"name": "Young Blue Dragon (Sparkrender)", "count": 1, "hp": 93, "ac": 18, "cr": "9", "initiative_bonus": 2,
             "notes": "Lightning Breath 10d10 (recharge 5-6), 60ft line. Frightful Presence DC 14 Wis. Multiattack: bite + 2 claws."},
        ],
        "notes": "Sparkrender can be reasoned with (DC 18 Persuasion) if the party brings evidence of the threat to the island. May flee below half HP.",
        "map_suggestion": "Dragon cave with elevated ledges and a pool of water",
        "loot": ["Dragon hoard: 800 gp, gems worth 200 gp", "Wand of Magic Missiles", "+1 Shield"],
        "xp_reward": 5000,
        "source": "Stormwreck Isle",
    },
    # --- Generic 5e encounters ---
    {
        "name": "Goblin Ambush",
        "description": "A band of goblins attacks from hidden positions along the road. Classic starter encounter.",
        "difficulty": "easy",
        "environment": "outdoor",
        "monsters": [
            {"name": "Goblin", "count": 4, "hp": 7, "ac": 15, "cr": "1/4", "initiative_bonus": 2},
        ],
        "notes": "Goblins use Nimble Escape to hide/disengage as bonus action. Two hide in bushes, two behind rocks.",
        "loot": ["3 gp each", "Shortbow with 20 arrows"],
        "xp_reward": 200,
        "source": "Generic 5e",
    },
    {
        "name": "Bandit Roadblock",
        "description": "Bandits have set up a crude roadblock and demand a toll.",
        "difficulty": "medium",
        "environment": "outdoor",
        "monsters": [
            {"name": "Bandit", "count": 4, "hp": 11, "ac": 12, "cr": "1/8", "initiative_bonus": 1},
            {"name": "Bandit Captain", "count": 1, "hp": 65, "ac": 15, "cr": "2", "initiative_bonus": 2},
        ],
        "notes": "Captain has Multiattack (3 attacks). Can be bribed (50 gp) or intimidated (DC 15 Cha). Bandits flee if captain drops.",
        "loot": ["120 gp total", "Captain's leather armor", "Letter revealing employer"],
        "xp_reward": 650,
        "source": "Generic 5e",
    },
    {
        "name": "Owlbear Den",
        "description": "An owlbear and its cub have made a den in a shallow cave.",
        "difficulty": "hard",
        "environment": "cave",
        "monsters": [
            {"name": "Owlbear", "count": 1, "hp": 59, "ac": 13, "cr": "3", "initiative_bonus": 1},
        ],
        "notes": "Owlbear is protecting its young and fights to the death. The cub is non-combatant. If cub is threatened, owlbear gains advantage on attacks. Ranger/druid can calm it (DC 18 Animal Handling).",
        "loot": ["Previous victim's pack: 45 gp, Potion of Healing, Explorer's Pack"],
        "xp_reward": 700,
        "source": "Generic 5e",
    },
]
