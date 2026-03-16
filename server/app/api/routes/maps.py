"""Map routes — upload, list, and serve map images."""

import base64
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services.campaign_manager import campaign_manager

router = APIRouter()

ALLOWED_IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


@router.get("/{campaign_folder}")
async def list_maps(campaign_folder: str):
    """List all maps in a campaign."""
    maps_dir = campaign_manager.root / "campaigns" / campaign_folder / "maps"
    if not maps_dir.exists():
        return []

    maps = []
    for f in sorted(maps_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_IMAGE_TYPES:
            meta = _read_map_meta(f)
            maps.append(
                {
                    "name": f.stem,
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    **meta,
                }
            )
    return maps


@router.get("/{campaign_folder}/{map_name}")
async def get_map(campaign_folder: str, map_name: str):
    """Get a map image as base64 for streaming to players."""
    maps_dir = campaign_manager.root / "campaigns" / campaign_folder / "maps"
    if not maps_dir.exists():
        raise HTTPException(404, "Map not found")

    for f in maps_dir.iterdir():
        if f.stem == map_name and f.suffix.lower() in ALLOWED_IMAGE_TYPES:
            data = f.read_bytes()
            b64 = base64.b64encode(data).decode("utf-8")
            mime = _mime_for(f.suffix)
            meta = _read_map_meta(f)
            return {
                "name": f.stem,
                "filename": f.name,
                "mime": mime,
                "data": b64,
                **meta,
            }
    raise HTTPException(404, "Map not found")


@router.post("/{campaign_folder}")
async def upload_map(
    campaign_folder: str,
    file: UploadFile = File(...),
    grid_type: str = "square",
    grid_size_ft: int = 5,
):
    """Upload a map image."""
    ext = Path(file.filename or "map.png").suffix.lower()
    if ext not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f"Unsupported image type: {ext}")

    maps_dir = campaign_manager.root / "campaigns" / campaign_folder / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)

    dest = maps_dir / (file.filename or "map.png")
    content = await file.read()
    dest.write_bytes(content)

    # Save metadata sidecar
    meta = {"grid_type": grid_type, "grid_size_ft": grid_size_ft}
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2))

    return {"status": "uploaded", "filename": dest.name, "size_bytes": len(content)}


@router.delete("/{campaign_folder}/{map_name}")
async def delete_map(campaign_folder: str, map_name: str):
    """Delete a map and its metadata."""
    maps_dir = campaign_manager.root / "campaigns" / campaign_folder / "maps"
    if not maps_dir.exists():
        raise HTTPException(404, "Map not found")

    for f in maps_dir.iterdir():
        if f.stem == map_name and f.suffix.lower() in ALLOWED_IMAGE_TYPES:
            f.unlink()
            meta_path = f.with_suffix(f.suffix + ".meta.json")
            if meta_path.exists():
                meta_path.unlink()
            return {"status": "deleted"}
    raise HTTPException(404, "Map not found")


def _read_map_meta(map_file: Path) -> dict:
    meta_path = map_file.with_suffix(map_file.suffix + ".meta.json")
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {"grid_type": "square", "grid_size_ft": 5}


def _mime_for(ext: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
