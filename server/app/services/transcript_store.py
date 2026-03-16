"""Transcript storage and retrieval for Discord STT bot."""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class TranscriptStore:
    """File-based storage for transcripts in campaign folders."""

    def __init__(self, campaign_root: Path):
        """Initialize transcript store with campaign root path."""
        self.campaign_root = Path(campaign_root)

    def get_transcripts_dir(self, campaign_folder: str) -> Path:
        """Get the transcripts directory for a campaign."""
        transcripts_dir = self.campaign_root / campaign_folder / "transcripts"
        transcripts_dir.mkdir(parents=True, exist_ok=True)
        return transcripts_dir

    def save_transcript(
        self, campaign_folder: str, session_id: str, entries: List[Dict[str, Any]]
    ) -> Path:
        """
        Save a transcript as JSON.

        Args:
            campaign_folder: Campaign folder name
            session_id: Session identifier (e.g., "session-2026-03-16")
            entries: List of transcript entries with speaker, text, timestamp, confidence

        Returns:
            Path to saved transcript file
        """
        transcripts_dir = self.get_transcripts_dir(campaign_folder)
        file_path = transcripts_dir / f"{session_id}.json"

        try:
            with open(file_path, "w") as f:
                json.dump(
                    {"session_id": session_id, "entries": entries, "saved_at": datetime.now().isoformat()},
                    f,
                    indent=2,
                )
            logger.info(f"Saved transcript to {file_path}")
            return file_path
        except IOError as e:
            logger.error(f"Failed to save transcript: {e}")
            raise

    def load_transcript(self, campaign_folder: str, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Load a transcript by session ID.

        Args:
            campaign_folder: Campaign folder name
            session_id: Session identifier

        Returns:
            Transcript dict with entries, or None if not found
        """
        transcripts_dir = self.get_transcripts_dir(campaign_folder)
        file_path = transcripts_dir / f"{session_id}.json"

        if not file_path.exists():
            return None

        try:
            with open(file_path, "r") as f:
                return json.load(f)
        except IOError as e:
            logger.error(f"Failed to load transcript: {e}")
            return None

    def list_sessions(self, campaign_folder: str) -> List[Dict[str, Any]]:
        """
        List all transcript sessions for a campaign.

        Args:
            campaign_folder: Campaign folder name

        Returns:
            List of session summaries with id, created_at, entry_count
        """
        transcripts_dir = self.get_transcripts_dir(campaign_folder)

        sessions = []
        for file_path in sorted(transcripts_dir.glob("*.json"), reverse=True):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    sessions.append(
                        {
                            "session_id": data.get("session_id", file_path.stem),
                            "filename": file_path.name,
                            "entry_count": len(data.get("entries", [])),
                            "saved_at": data.get("saved_at"),
                        }
                    )
            except IOError:
                logger.warning(f"Failed to read session file: {file_path}")
                continue

        return sessions

    def search_transcripts(self, campaign_folder: str, query: str) -> List[Dict[str, Any]]:
        """
        Search across all transcripts for a campaign.

        Args:
            campaign_folder: Campaign folder name
            query: Search query (case-insensitive)

        Returns:
            List of matching entries with session_id, speaker, text, timestamp
        """
        transcripts_dir = self.get_transcripts_dir(campaign_folder)
        query_lower = query.lower()
        results = []

        for file_path in transcripts_dir.glob("*.json"):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    session_id = data.get("session_id", file_path.stem)

                    for entry in data.get("entries", []):
                        if query_lower in entry.get("text", "").lower() or query_lower in entry.get("speaker", "").lower():
                            results.append({**entry, "session_id": session_id})
            except IOError:
                logger.warning(f"Failed to search session file: {file_path}")
                continue

        return sorted(results, key=lambda x: x.get("timestamp", ""), reverse=True)

    def append_entry(
        self, campaign_folder: str, session_id: str, entry: Dict[str, Any]
    ) -> None:
        """
        Append a single entry to an existing transcript.

        Args:
            campaign_folder: Campaign folder name
            session_id: Session identifier
            entry: Entry to append
        """
        transcripts_dir = self.get_transcripts_dir(campaign_folder)
        file_path = transcripts_dir / f"{session_id}.json"

        try:
            # Load existing or create new
            if file_path.exists():
                with open(file_path, "r") as f:
                    data = json.load(f)
            else:
                data = {"session_id": session_id, "entries": []}

            data["entries"].append(entry)
            data["saved_at"] = datetime.now().isoformat()

            with open(file_path, "w") as f:
                json.dump(data, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to append entry: {e}")
            raise
