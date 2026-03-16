"""
Questboard Server — Entry point for PyInstaller frozen builds.

When frozen with PyInstaller, this file is the main entry point.
It starts uvicorn programmatically instead of via command line.
"""

import sys
import os
import uvicorn

# When frozen, make sure the app module is findable
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    base_dir = sys._MEIPASS
    os.chdir(base_dir)
    sys.path.insert(0, base_dir)
else:
    # Running as normal script
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

from app.main import app  # noqa: E402


def main():
    """Start the Questboard server."""
    host = os.environ.get("QUESTBOARD_HOST", "127.0.0.1")
    port = int(os.environ.get("QUESTBOARD_PORT", "7777"))

    print(f"🎲 Questboard server starting on {host}:{port}")
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        # Don't use reload in frozen mode
        reload=not getattr(sys, 'frozen', False),
    )


if __name__ == "__main__":
    main()
