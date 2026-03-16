"""Dice routes — roll dice via REST (WebSocket also supports real-time rolls)."""

import re
import random

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class DiceRollRequest(BaseModel):
    notation: str  # e.g. "2d6+3", "1d20", "4d6kh3"
    label: Optional[str] = None  # e.g. "Attack Roll"


class DiceRollResult(BaseModel):
    notation: str
    rolls: list[int]
    kept: list[int]
    modifier: int
    total: int
    label: Optional[str] = None


@router.post("/roll")
async def roll_dice(req: DiceRollRequest) -> DiceRollResult:
    """Roll dice using standard D&D notation."""
    try:
        result = parse_and_roll(req.notation)
        return DiceRollResult(
            notation=req.notation,
            rolls=result["rolls"],
            kept=result["kept"],
            modifier=result["modifier"],
            total=result["total"],
            label=req.label,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/roll/{notation}")
async def roll_dice_get(notation: str, label: Optional[str] = None) -> DiceRollResult:
    """Quick roll via GET — e.g. /api/dice/roll/2d6+3"""
    try:
        result = parse_and_roll(notation)
        return DiceRollResult(
            notation=notation,
            rolls=result["rolls"],
            kept=result["kept"],
            modifier=result["modifier"],
            total=result["total"],
            label=label,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


def parse_and_roll(notation: str) -> dict:
    """Parse D&D dice notation and roll.

    Supports: "2d6", "1d20+5", "4d6kh3", "2d8kl1", "d12-2"
    """
    clean = notation.lower().strip().replace(" ", "")
    match = re.match(r"^(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?([+-]\d+)?$", clean)

    if not match:
        raise ValueError(f"Invalid dice notation: '{notation}'")

    count = int(match.group(1)) if match.group(1) else 1
    sides = int(match.group(2))
    keep_highest = int(match.group(3)) if match.group(3) else None
    keep_lowest = int(match.group(4)) if match.group(4) else None
    modifier = int(match.group(5)) if match.group(5) else 0

    if count < 1 or count > 100:
        raise ValueError("Dice count must be 1-100")
    if sides < 2 or sides > 1000:
        raise ValueError("Dice sides must be 2-1000")

    rolls = [random.randint(1, sides) for _ in range(count)]
    kept = list(rolls)

    if keep_highest is not None:
        kept = sorted(rolls, reverse=True)[:keep_highest]
    elif keep_lowest is not None:
        kept = sorted(rolls)[:keep_lowest]

    total = sum(kept) + modifier

    return {
        "rolls": rolls,
        "kept": kept,
        "modifier": modifier,
        "total": total,
    }
