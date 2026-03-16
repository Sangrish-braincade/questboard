"""Campaign folder management — create, validate, watch, list campaigns."""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from app.core.config import settings


# Standard folder structure for a campaign
CAMPAIGN_FOLDERS = [
    "maps",
    "tokens",
    "handouts",
    "audio",
    "npcs/stat-blocks",
    "sessions",
    "players",
]

SHARED_ASSET_FOLDERS = [
    "shared-assets/tokens",
    "shared-assets/audio",
    "shared-assets/maps",
]


class CampaignFileHandler(FileSystemEventHandler):
    """Watch for file changes in a campaign folder (new maps, tokens, audio dropped in)."""

    def __init__(self, campaign_name: str, on_change: Optional[callable] = None):
        self.campaign_name = campaign_name
        self.on_change = on_change

    def on_created(self, event):
        if not event.is_directory:
            rel_path = os.path.relpath(event.src_path, settings.campaign_root)
            print(f"📁 New file detected in {self.campaign_name}: {rel_path}")
            if self.on_change:
                self.on_change("created", event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            rel_path = os.path.relpath(event.src_path, settings.campaign_root)
            print(f"🗑️ File removed from {self.campaign_name}: {rel_path}")
            if self.on_change:
                self.on_change("deleted", event.src_path)


class CampaignManager:
    """Manages campaign folders on the DM's filesystem."""

    def __init__(self):
        self.root = Path(settings.campaign_root)
        self._observers: dict[str, Observer] = {}

    def ensure_root_exists(self):
        """Create the campaign root directory and shared assets if they don't exist."""
        self.root.mkdir(parents=True, exist_ok=True)

        # Create shared asset folders
        for folder in SHARED_ASSET_FOLDERS:
            (self.root / folder).mkdir(parents=True, exist_ok=True)

        # Create app-config.json if it doesn't exist
        config_path = self.root / "app-config.json"
        if not config_path.exists():
            config_path.write_text(
                json.dumps(
                    {
                        "port": settings.port,
                        "tunnel_provider": "cloudflare",
                        "default_grid_type": "square",
                        "default_grid_size_ft": 5,
                        "gcp_api_key": "",
                        "discord_bot_token": "",
                    },
                    indent=2,
                )
            )

    def create_campaign(self, name: str, description: str = "") -> Path:
        """Create a new campaign with the standard folder structure."""
        # Sanitize name for filesystem
        safe_name = self._sanitize_name(name)
        campaign_path = self.root / "campaigns" / safe_name

        if campaign_path.exists():
            raise FileExistsError(f"Campaign '{safe_name}' already exists")

        # Create all standard folders
        for folder in CAMPAIGN_FOLDERS:
            (campaign_path / folder).mkdir(parents=True, exist_ok=True)

        # Create campaign metadata file
        metadata = {
            "name": name,
            "description": description,
            "created_at": datetime.utcnow().isoformat(),
            "system": "dnd-5e",
            "grid_type": "square",
            "grid_size_ft": 5,
        }
        (campaign_path / "campaign-meta.json").write_text(
            json.dumps(metadata, indent=2)
        )

        print(f"✅ Campaign created: {campaign_path}")
        return campaign_path

    def list_campaigns(self) -> list[dict]:
        """List all campaigns in the root directory."""
        campaigns_dir = self.root / "campaigns"
        if not campaigns_dir.exists():
            return []

        campaigns = []
        for item in sorted(campaigns_dir.iterdir()):
            if item.is_dir() and self.validate_campaign(item):
                meta = self._read_metadata(item)
                campaigns.append(
                    {
                        "name": meta.get("name", item.name),
                        "folder_name": item.name,
                        "path": str(item),
                        "description": meta.get("description", ""),
                        "created_at": meta.get("created_at", ""),
                        "system": meta.get("system", "dnd-5e"),
                        "session_count": self._count_sessions(item),
                        "player_count": self._count_players(item),
                    }
                )
        return campaigns

    def get_campaign(self, folder_name: str) -> Optional[dict]:
        """Get details for a specific campaign."""
        campaign_path = self.root / "campaigns" / folder_name
        if not campaign_path.exists():
            return None

        meta = self._read_metadata(campaign_path)
        return {
            "name": meta.get("name", folder_name),
            "folder_name": folder_name,
            "path": str(campaign_path),
            "description": meta.get("description", ""),
            "created_at": meta.get("created_at", ""),
            "system": meta.get("system", "dnd-5e"),
            "session_count": self._count_sessions(campaign_path),
            "player_count": self._count_players(campaign_path),
            "maps": self._list_files(campaign_path / "maps"),
            "tokens": self._list_files(campaign_path / "tokens"),
            "handouts": self._list_files(campaign_path / "handouts"),
            "audio": self._list_files(campaign_path / "audio"),
        }

    def validate_campaign(self, campaign_path: Path) -> bool:
        """Check if a folder has valid campaign structure."""
        required = ["maps", "tokens", "sessions", "players"]
        return all((campaign_path / folder).is_dir() for folder in required)

    def get_campaign_db_path(self, folder_name: str) -> str:
        """Get the SQLite database path for a campaign."""
        return str(self.root / "campaigns" / folder_name / "campaign.db")

    def create_session_folder(self, campaign_folder: str, session_number: int) -> Path:
        """Create a session folder within a campaign."""
        session_name = f"session-{session_number:03d}"
        session_path = (
            self.root / "campaigns" / campaign_folder / "sessions" / session_name
        )
        session_path.mkdir(parents=True, exist_ok=True)
        return session_path

    def create_player_folder(self, campaign_folder: str, player_name: str) -> Path:
        """Create a player folder within a campaign."""
        safe_name = self._sanitize_name(player_name)
        player_path = (
            self.root / "campaigns" / campaign_folder / "players" / f"player-{safe_name}"
        )
        player_path.mkdir(parents=True, exist_ok=True)
        return player_path

    def start_watching(self, campaign_folder: str, on_change: Optional[callable] = None):
        """Start watching a campaign folder for file changes."""
        campaign_path = self.root / "campaigns" / campaign_folder
        if not campaign_path.exists():
            return

        if campaign_folder in self._observers:
            self.stop_watching(campaign_folder)

        handler = CampaignFileHandler(campaign_folder, on_change)
        observer = Observer()
        observer.schedule(handler, str(campaign_path), recursive=True)
        observer.start()
        self._observers[campaign_folder] = observer
        print(f"👁️ Watching campaign folder: {campaign_folder}")

    def stop_watching(self, campaign_folder: str):
        """Stop watching a campaign folder."""
        if campaign_folder in self._observers:
            self._observers[campaign_folder].stop()
            self._observers[campaign_folder].join()
            del self._observers[campaign_folder]

    def stop_all_watchers(self):
        """Stop all file watchers."""
        for name in list(self._observers.keys()):
            self.stop_watching(name)

    # --- Private helpers ---

    def _sanitize_name(self, name: str) -> str:
        """Make a name filesystem-safe."""
        safe = name.lower().strip()
        safe = safe.replace(" ", "-")
        safe = "".join(c for c in safe if c.isalnum() or c in "-_")
        return safe or "unnamed"

    def _read_metadata(self, campaign_path: Path) -> dict:
        """Read campaign-meta.json if it exists."""
        meta_path = campaign_path / "campaign-meta.json"
        if meta_path.exists():
            try:
                return json.loads(meta_path.read_text())
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    def _count_sessions(self, campaign_path: Path) -> int:
        sessions_dir = campaign_path / "sessions"
        if not sessions_dir.exists():
            return 0
        return len([d for d in sessions_dir.iterdir() if d.is_dir()])

    def _count_players(self, campaign_path: Path) -> int:
        players_dir = campaign_path / "players"
        if not players_dir.exists():
            return 0
        return len([d for d in players_dir.iterdir() if d.is_dir()])

    def _list_files(self, folder: Path) -> list[dict]:
        """List files in a folder with metadata."""
        if not folder.exists():
            return []
        files = []
        for f in sorted(folder.iterdir()):
            if f.is_file() and not f.name.startswith("."):
                files.append(
                    {
                        "name": f.name,
                        "path": str(f.relative_to(self.root)),
                        "size_bytes": f.stat().st_size,
                        "modified": datetime.fromtimestamp(
                            f.stat().st_mtime
                        ).isoformat(),
                    }
                )
        return files


# Singleton instance
campaign_manager = CampaignManager()
