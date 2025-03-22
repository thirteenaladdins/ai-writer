#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path


def run_server():
    """Start the FastAPI server"""
    try:
        print("Starting FastAPI server...")
        subprocess.run([
            sys.executable,
            "-m", "uvicorn",
            "main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error starting server: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nShutting down server...")
        sys.exit(0)


def main():
    try:
        # Ensure we're in the correct directory
        script_dir = Path(__file__).parent
        os.chdir(script_dir)

        # Run the server
        run_server()
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
