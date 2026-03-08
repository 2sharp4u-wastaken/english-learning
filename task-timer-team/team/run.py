#!/usr/bin/env python3
"""Task Timer Team Runner - Run all agents in parallel."""

import json
import subprocess
import sys
import time
from pathlib import Path

def run_all_agents():
    """Run all three agents in parallel."""
    project_dir = Path(__file__).parent

    # Read team configuration
    with open(project_dir / "team.json") as f:
        config = json.load(f)

    print(f"🚀 Starting Task Timer Team ({config['name']})")
    print(f"📦 Version: {config['version']}")
    print("=" * 50)

    # Run Architect (Core Logic)
    print("\n🏗️  Architect: Building core timer logic...")
    try:
        subprocess.run([
            sys.executable, "-m", "team.architect",
            "--mode", "build"
        ], check=True, capture_output=False)
        print("✅ Architect completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Architect failed: {e}")
        return 1

    # Run Interface (CLI)
    print("\n🎨 Interface: Building CLI...")
    try:
        subprocess.run([
            sys.executable, "-m", "team.interface",
            "--mode", "build"
        ], check=True, capture_output=False)
        print("✅ Interface completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Interface failed: {e}")
        return 1

    # Run Tester
    print("\n🧪 Tester: Running unit tests...")
    try:
        subprocess.run([
            sys.executable, "-m", "team.tests",
            "--mode", "run"
        ], check=True, capture_output=False)
        print("✅ Tests completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Tests failed: {e}")
        return 1

    print("\n" + "=" * 50)
    print("🎉 All agents completed successfully!")
    print("=" * 50)

    return 0

if __name__ == "__main__":
    sys.exit(run_all_agents())
