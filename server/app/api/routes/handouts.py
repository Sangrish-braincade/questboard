"""Handout routes — Share images, PDFs, and text handouts with players during session."""

import base64
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Optional

from app.services.campaign_manager import campaign_manager

router = APIRouter()

ALLOWED_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".md"}


@router.get("/{campaign_folder}")
async def list_handouts(campaign_folder: str):
    """List all handouts for a campaign."""
    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    if not handout_dir.exists():
        return []

    handouts = []
    meta = _read_handout_meta(campaign_folder)

    for f in sorted(handout_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_TYPES:
            info = meta.get(f.name, {})
            handouts.append({
                "name": f.stem,
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "revealed": info.get("revealed", False),
                "description": info.get("description", ""),
                "visible_to": info.get("visible_to", []),  # empty = all players
            })
    return handouts


@router.get("/{campaign_folder}/{handout_name}")
async def get_handout(campaign_folder: str, handout_name: str):
    """Get a handout as base64 for streaming to players."""
    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    if not handout_dir.exists():
        raise HTTPException(404, "Handout not found")

    for f in handout_dir.iterdir():
        if f.stem == handout_name and f.suffix.lower() in ALLOWED_TYPES:
            data = f.read_bytes()
            b64 = base64.b64encode(data).decode("utf-8")
            mime = _mime_for(f.suffix)
            meta = _read_handout_meta(campaign_folder).get(f.name, {})
            return {
                "name": f.stem,
                "filename": f.name,
                "mime": mime,
                "data": b64,
                "revealed": meta.get("revealed", False),
                "description": meta.get("description", ""),
            }
    raise HTTPException(404, "Handout not found")


@router.post("/{campaign_folder}")
async def upload_handout(
    campaign_folder: str,
    file: UploadFile = File(...),
    description: str = "",
    revealed: bool = False,
):
    """Upload a handout file."""
    ext = Path(file.filename or "handout.png").suffix.lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    handout_dir.mkdir(parents=True, exist_ok=True)

    dest = handout_dir / (file.filename or "handout.png")
    content = await file.read()
    dest.write_bytes(content)

    # Update metadata
    meta = _read_handout_meta(campaign_folder)
    meta[dest.name] = {"revealed": revealed, "description": description, "visible_to": []}
    _write_handout_meta(campaign_folder, meta)

    return {"status": "uploaded", "filename": dest.name, "size_bytes": len(content)}


@router.post("/{campaign_folder}/{handout_name}/reveal")
async def reveal_handout(campaign_folder: str, handout_name: str, to: Optional[str] = None):
    """Reveal a handout to all players or a specific player."""
    meta = _read_handout_meta(campaign_folder)

    # Find the actual filename
    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    filename = None
    for f in handout_dir.iterdir():
        if f.stem == handout_name:
            filename = f.name
            break

    if not filename:
        raise HTTPException(404, "Handout not found")

    entry = meta.get(filename, {"revealed": False, "description": "", "visible_to": []})

    if to:
        if to not in entry.get("visible_to", []):
            entry.setdefault("visible_to", []).append(to)
    else:
        entry["revealed"] = True

    meta[filename] = entry
    _write_handout_meta(campaign_folder, meta)
    return {"status": "revealed", "handout": handout_name, "to": to or "all"}


@router.post("/{campaign_folder}/{handout_name}/hide")
async def hide_handout(campaign_folder: str, handout_name: str):
    """Hide a handout from players again."""
    meta = _read_handout_meta(campaign_folder)

    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    filename = None
    for f in handout_dir.iterdir():
        if f.stem == handout_name:
            filename = f.name
            break

    if not filename:
        raise HTTPException(404, "Handout not found")

    if filename in meta:
        meta[filename]["revealed"] = False
        meta[filename]["visible_to"] = []
        _write_handout_meta(campaign_folder, meta)

    return {"status": "hidden"}


@router.delete("/{campaign_folder}/{handout_name}")
async def delete_handout(campaign_folder: str, handout_name: str):
    """Delete a handout."""
    handout_dir = campaign_manager.root / "campaigns" / campaign_folder / "handouts"
    if not handout_dir.exists():
        raise HTTPException(404, "Handout not found")

    for f in handout_dir.iterdir():
        if f.stem == handout_name:
            f.unlink()
            meta = _read_handout_meta(campaign_folder)
            meta.pop(f.name, None)
            _write_handout_meta(campaign_folder, meta)
            return {"status": "deleted"}

    raise HTTPException(404, "Handout not found")


def _meta_path(campaign_folder: str) -> Path:
    return campaign_manager.root / "campaigns" / campaign_folder / "handouts-meta.json"


def _read_handout_meta(campaign_folder: str) -> dict:
    path = _meta_path(campaign_folder)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def _write_handout_meta(campaign_folder: str, meta: dict):
    path = _meta_path(campaign_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, indent=2))


def _mime_for(ext: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
    }.get(ext, "application/octet-stream")
