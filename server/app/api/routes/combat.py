"""Combat routes — initiative tracker, damage, conditions."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# In-memory combat state per campaign (will be persisted to SQLite in Phase 2)
_active_combats: dict[str, dict] = {}


class CombatantEntry(BaseModel):
    name: str
    initiative: int
    hp: int
    max_hp: int
    ac: int = 10
    is_npc: bool = False
    conditions: list[str] = []


class CombatStartRequest(BaseModel):
    combatants: list[CombatantEntry]


class DamageRequest(BaseModel):
    target: str
    damage: int
    damage_type: str = "untyped"


class ConditionRequest(BaseModel):
    target: str
    condition: str


@router.post("/{campaign_folder}/start")
async def start_combat(campaign_folder: str, req: CombatStartRequest):
    """Start a combat encounter with initiative order."""
    if campaign_folder in _active_combats:
        raise HTTPException(409, "Combat already active for this campaign")

    sorted_combatants = sorted(
        [c.model_dump() for c in req.combatants],
        key=lambda c: c["initiative"],
        reverse=True,
    )

    _active_combats[campaign_folder] = {
        "round": 1,
        "turn_index": 0,
        "combatants": sorted_combatants,
    }

    return {
        "status": "combat_started",
        "round": 1,
        "current_turn": sorted_combatants[0]["name"],
        "initiative_order": sorted_combatants,
    }


@router.get("/{campaign_folder}")
async def get_combat(campaign_folder: str):
    """Get current combat state."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        return {"active": False}

    return {
        "active": True,
        "round": combat["round"],
        "turn_index": combat["turn_index"],
        "current_turn": combat["combatants"][combat["turn_index"]]["name"],
        "combatants": combat["combatants"],
    }


@router.post("/{campaign_folder}/next-turn")
async def next_turn(campaign_folder: str):
    """Advance to the next combatant's turn."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        raise HTTPException(404, "No active combat")

    combat["turn_index"] += 1
    if combat["turn_index"] >= len(combat["combatants"]):
        combat["turn_index"] = 0
        combat["round"] += 1

    current = combat["combatants"][combat["turn_index"]]
    return {
        "round": combat["round"],
        "current_turn": current["name"],
        "turn_index": combat["turn_index"],
    }


@router.post("/{campaign_folder}/damage")
async def apply_damage(campaign_folder: str, req: DamageRequest):
    """Apply damage to a combatant."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        raise HTTPException(404, "No active combat")

    for c in combat["combatants"]:
        if c["name"] == req.target:
            c["hp"] = max(0, c["hp"] - req.damage)
            return {
                "target": req.target,
                "damage": req.damage,
                "remaining_hp": c["hp"],
                "unconscious": c["hp"] == 0,
            }

    raise HTTPException(404, f"Combatant '{req.target}' not found")


@router.post("/{campaign_folder}/heal")
async def apply_healing(campaign_folder: str, target: str, healing: int):
    """Heal a combatant."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        raise HTTPException(404, "No active combat")

    for c in combat["combatants"]:
        if c["name"] == target:
            c["hp"] = min(c["max_hp"], c["hp"] + healing)
            return {"target": target, "hp": c["hp"]}

    raise HTTPException(404, f"Combatant '{target}' not found")


@router.post("/{campaign_folder}/condition")
async def add_condition(campaign_folder: str, req: ConditionRequest):
    """Add a condition to a combatant."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        raise HTTPException(404, "No active combat")

    for c in combat["combatants"]:
        if c["name"] == req.target:
            if req.condition not in c["conditions"]:
                c["conditions"].append(req.condition)
            return {"target": req.target, "conditions": c["conditions"]}

    raise HTTPException(404, f"Combatant '{req.target}' not found")


@router.delete("/{campaign_folder}/condition")
async def remove_condition(campaign_folder: str, target: str, condition: str):
    """Remove a condition from a combatant."""
    combat = _active_combats.get(campaign_folder)
    if not combat:
        raise HTTPException(404, "No active combat")

    for c in combat["combatants"]:
        if c["name"] == target:
            c["conditions"] = [cond for cond in c["conditions"] if cond != condition]
            return {"target": target, "conditions": c["conditions"]}

    raise HTTPException(404, f"Combatant '{target}' not found")


@router.post("/{campaign_folder}/end")
async def end_combat(campaign_folder: str):
    """End the current combat encounter."""
    if campaign_folder not in _active_combats:
        raise HTTPException(404, "No active combat")

    del _active_combats[campaign_folder]
    return {"status": "combat_ended"}
