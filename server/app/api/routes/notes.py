"""Session notes routes — DM session notes and recaps."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    session_number: Optional[int] = None
    tags: list[str] = []
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    session_number: Optional[int] = None
    tags: Optional[list[str]] = None
    pinned: Optional[bool] = None


def _notes_path(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "session-notes.json"


def _read_notes(campaign_folder: str) -> list[dict]:
    path = _notes_path(campaign_folder)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return []


def _write_notes(campaign_folder: str, notes: list[dict]):
    path = _notes_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(notes, indent=2))


@router.get("/{campaign_folder}")
async def list_notes(campaign_folder: str, tag: Optional[str] = None):
    """List all session notes, optionally filtered by tag."""
    notes = _read_notes(campaign_folder)
    if tag:
        notes = [n for n in notes if tag in n.get("tags", [])]
    # Sort: pinned first, then by created_at descending
    notes.sort(key=lambda n: (not n.get("pinned", False), n.get("created_at", "")), reverse=False)
    return notes


@router.get("/{campaign_folder}/{note_id}")
async def get_note(campaign_folder: str, note_id: str):
    """Get a specific note."""
    notes = _read_notes(campaign_folder)
    for n in notes:
        if n["id"] == note_id:
            return n
    raise HTTPException(404, "Note not found")


@router.post("/{campaign_folder}")
async def create_note(campaign_folder: str, note: NoteCreate):
    """Create a new session note."""
    notes = _read_notes(campaign_folder)
    data = note.model_dump()
    data["id"] = str(uuid.uuid4())[:8]
    data["created_at"] = datetime.now().isoformat()
    data["updated_at"] = data["created_at"]
    notes.append(data)
    _write_notes(campaign_folder, notes)
    return data


@router.put("/{campaign_folder}/{note_id}")
async def update_note(campaign_folder: str, note_id: str, updates: NoteUpdate):
    """Update a session note."""
    notes = _read_notes(campaign_folder)
    for n in notes:
        if n["id"] == note_id:
            for key, value in updates.model_dump(exclude_none=True).items():
                n[key] = value
            n["updated_at"] = datetime.now().isoformat()
            _write_notes(campaign_folder, notes)
            return n
    raise HTTPException(404, "Note not found")


@router.delete("/{campaign_folder}/{note_id}")
async def delete_note(campaign_folder: str, note_id: str):
    """Delete a session note."""
    notes = _read_notes(campaign_folder)
    filtered = [n for n in notes if n["id"] != note_id]
    if len(filtered) == len(notes):
        raise HTTPException(404, "Note not found")
    _write_notes(campaign_folder, filtered)
    return {"status": "deleted"}
