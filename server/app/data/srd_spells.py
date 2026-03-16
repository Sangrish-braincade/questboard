"""
SRD 5e Spell Database — Imports from expanded spell database.
This module imports all ~300 SRD spells from srd_spells_expanded.py
Players can also create custom spells.
"""

from app.data.srd_spells_expanded import SRD_SPELLS


def get_all_spells():
    """Return the full SRD spell list."""
    return SRD_SPELLS


def get_spell_by_name(name: str):
    """Find a spell by name (case-insensitive)."""
    name_lower = name.lower()
    for spell in SRD_SPELLS:
        if spell["name"].lower() == name_lower:
            return spell
    return None


def search_spells(query: str = "", level: int | None = None, school: str | None = None, class_name: str | None = None):
    """Search/filter spells."""
    results = list(SRD_SPELLS)

    if query:
        q = query.lower()
        results = [s for s in results if q in s["name"].lower() or q in s.get("description", "").lower()]

    if level is not None:
        results = [s for s in results if s["level"] == level]

    if school:
        results = [s for s in results if s["school"].lower() == school.lower()]

    if class_name:
        c = class_name.lower()
        results = [s for s in results if c in s.get("classes", [])]

    return results
