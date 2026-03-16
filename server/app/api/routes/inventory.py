"""Inventory routes — shared party inventory and gold tracking."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class InventoryItem(BaseModel):
    name: str
    quantity: int = 1
    description: str = ""
    weight: float = 0
    value: str = ""  # e.g. "50gp", "2sp"


class GoldUpdate(BaseModel):
    gold: int = 0
    silver: int = 0
    copper: int = 0
    platinum: int = 0
    electrum: int = 0


def _inventory_path(campaign_folder: str) -> Path:
    return (
        campaign_manager.root
        / "campaigns"
        / campaign_folder
        / "shared-inventory.json"
    )


def _read_inventory(campaign_folder: str) -> dict:
    path = _inventory_path(campaign_folder)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "items": [],
        "gold": {"gold": 0, "silver": 0, "copper": 0, "platinum": 0, "electrum": 0},
    }


def _write_inventory(campaign_folder: str, data: dict):
    path = _inventory_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


@router.get("/{campaign_folder}")
async def get_inventory(campaign_folder: str):
    """Get the full shared inventory."""
    return _read_inventory(campaign_folder)


@router.post("/{campaign_folder}/items")
async def add_item(campaign_folder: str, item: InventoryItem):
    """Add an item to the shared inventory."""
    inv = _read_inventory(campaign_folder)

    # Check if item already exists — stack it
    for existing in inv["items"]:
        if existing["name"].lower() == item.name.lower():
            existing["quantity"] += item.quantity
            _write_inventory(campaign_folder, inv)
            return inv

    inv["items"].append(item.model_dump())
    _write_inventory(campaign_folder, inv)
    return inv


@router.put("/{campaign_folder}/items/{item_name}")
async def update_item(campaign_folder: str, item_name: str, item: InventoryItem):
    """Update an item in the inventory."""
    inv = _read_inventory(campaign_folder)
    for i, existing in enumerate(inv["items"]):
        if existing["name"].lower() == item_name.lower():
            inv["items"][i] = item.model_dump()
            _write_inventory(campaign_folder, inv)
            return inv
    raise HTTPException(404, f"Item '{item_name}' not found")


@router.delete("/{campaign_folder}/items/{item_name}")
async def remove_item(campaign_folder: str, item_name: str, quantity: int = 0):
    """Remove an item or reduce its quantity. quantity=0 removes entirely."""
    inv = _read_inventory(campaign_folder)
    for i, existing in enumerate(inv["items"]):
        if existing["name"].lower() == item_name.lower():
            if quantity <= 0 or existing["quantity"] <= quantity:
                inv["items"].pop(i)
            else:
                existing["quantity"] -= quantity
            _write_inventory(campaign_folder, inv)
            return inv
    raise HTTPException(404, f"Item '{item_name}' not found")


@router.put("/{campaign_folder}/gold")
async def update_gold(campaign_folder: str, gold: GoldUpdate):
    """Set the party's gold (absolute values)."""
    inv = _read_inventory(campaign_folder)
    inv["gold"] = gold.model_dump()
    _write_inventory(campaign_folder, inv)
    return inv


@router.post("/{campaign_folder}/gold/add")
async def add_gold(campaign_folder: str, gold: GoldUpdate):
    """Add gold to the party treasury."""
    inv = _read_inventory(campaign_folder)
    current = inv.get("gold", {})
    for denomination, amount in gold.model_dump().items():
        current[denomination] = current.get(denomination, 0) + amount
    inv["gold"] = current
    _write_inventory(campaign_folder, inv)
    return inv
