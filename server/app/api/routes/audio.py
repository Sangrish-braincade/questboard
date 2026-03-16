"""Audio routes — list, stream, and manage ambient audio tracks."""

import base64
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services.campaign_manager import campaign_manager

router = APIRouter()

ALLOWED_AUDIO_TYPES = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"}


@router.get("/{campaign_folder}")
async def list_audio(campaign_folder: str):
    """List all audio tracks in a campaign."""
    audio_dir = campaign_manager.root / "campaigns" / campaign_folder / "audio"
    if not audio_dir.exists():
        return []

    tracks = []
    for f in sorted(audio_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_AUDIO_TYPES:
            meta = _read_audio_meta(f)
            tracks.append(
                {
                    "name": f.stem,
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "type": meta.get("type", "ambient"),
                    "tags": meta.get("tags", []),
                }
            )
    return tracks


@router.get("/{campaign_folder}/{track_name}")
async def get_audio(campaign_folder: str, track_name: str):
    """Get an audio track as base64 for streaming to players."""
    audio_dir = campaign_manager.root / "campaigns" / campaign_folder / "audio"
    if not audio_dir.exists():
        raise HTTPException(404, "Audio track not found")

    for f in audio_dir.iterdir():
        if f.stem == track_name and f.suffix.lower() in ALLOWED_AUDIO_TYPES:
            data = f.read_bytes()
            b64 = base64.b64encode(data).decode("utf-8")
            mime = _mime_for(f.suffix)
            return {
                "name": f.stem,
                "filename": f.name,
                "mime": mime,
                "data": b64,
            }

    raise HTTPException(404, "Audio track not found")


@router.post("/{campaign_folder}")
async def upload_audio(
    campaign_folder: str,
    file: UploadFile = File(...),
    track_type: str = "ambient",
    tags: str = "",
):
    """Upload an audio track."""
    ext = Path(file.filename or "track.mp3").suffix.lower()
    if ext not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(400, f"Unsupported audio type: {ext}")

    audio_dir = campaign_manager.root / "campaigns" / campaign_folder / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    dest = audio_dir / (file.filename or "track.mp3")
    content = await file.read()
    dest.write_bytes(content)

    # Save metadata sidecar
    meta = {
        "type": track_type,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
    }
    meta_path = dest.with_suffix(dest.suffix + ".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2))

    return {"status": "uploaded", "filename": dest.name, "size_bytes": len(content)}


@router.delete("/{campaign_folder}/{track_name}")
async def delete_audio(campaign_folder: str, track_name: str):
    """Delete an audio track."""
    audio_dir = campaign_manager.root / "campaigns" / campaign_folder / "audio"
    if not audio_dir.exists():
        raise HTTPException(404, "Audio track not found")

    for f in audio_dir.iterdir():
        if f.stem == track_name and f.suffix.lower() in ALLOWED_AUDIO_TYPES:
            f.unlink()
            meta_path = f.with_suffix(f.suffix + ".meta.json")
            if meta_path.exists():
                meta_path.unlink()
            return {"status": "deleted"}
    raise HTTPException(404, "Audio track not found")


def _read_audio_meta(audio_file: Path) -> dict:
    meta_path = audio_file.with_suffix(audio_file.suffix + ".meta.json")
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def _mime_for(ext: str) -> str:
    return {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }.get(ext, "audio/mpeg")
