#!/usr/bin/env python3
"""
Space Music Startup Script

Starts the Vite dev server for the spatial music visualization.
Press Ctrl+C to stop the server and exit.

Author: Perry Radau
Date: 2025-02-13
Dependencies: Python 3.6+, subprocess, pathlib, signal
Usage: python3 start.py
       or: ./start.py (after chmod +x start.py)
"""

import os
import sys
import subprocess
import signal
from pathlib import Path
from typing import Optional


class SpaceMusicStarter:
    """Starts and stops the Vite dev server for Space Music."""

    def __init__(self) -> None:
        """Initialize with script directory and process reference."""
        self.script_dir = Path(__file__).parent.absolute()
        self.process: Optional[subprocess.Popen] = None
        os.chdir(self.script_dir)
        signal.signal(signal.SIGINT, self._cleanup_handler)
        signal.signal(signal.SIGTERM, self._cleanup_handler)

    def _cleanup_handler(self, signum: int, frame: Optional[object]) -> None:
        """Handle Ctrl+C or SIGTERM: stop the dev server and exit."""
        print("\nShutting down...")
        self.cleanup()
        sys.exit(0)

    def is_process_running(self) -> bool:
        """Return True if the dev server process is still running."""
        if self.process is None:
            return False
        return self.process.poll() is None

    def cleanup(self) -> None:
        """Terminate the dev server process if it is running."""
        if self.process and self.is_process_running():
            print(f"Stopping dev server (PID: {self.process.pid})...")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()

    def run(self) -> int:
        """
        Start the Vite dev server and wait for it.

        Returns:
            Exit code: 0 if server exits normally, non-zero on failure.
        """
        print(f"Starting Space Music from: {self.script_dir}")
        print("Running: npm run dev")
        print("To stop the server and exit: press Ctrl+C in this terminal (not 'q').\n")

        try:
            self.process = subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=self.script_dir,
                stdout=sys.stdout,
                stderr=sys.stderr,
            )
            return self.process.wait()
        except FileNotFoundError:
            print("Error: npm not found. Ensure Node.js and npm are installed.", file=sys.stderr)
            return 1
        except Exception as e:
            print(f"Error starting dev server: {e}", file=sys.stderr)
            return 1


def main() -> None:
    """Entry point."""
    starter = SpaceMusicStarter()
    sys.exit(starter.run())


if __name__ == "__main__":
    main()
