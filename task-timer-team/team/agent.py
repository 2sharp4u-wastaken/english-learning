#!/usr/bin/env python3
"""Base agent class for the Task Timer Team."""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional


class Agent:
    """Base Agent class for team members."""

    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.project_dir = Path(__file__).parent.parent

    def run(self, args: list[str]) -> int:
        """Run the agent with provided arguments."""
        parser = argparse.ArgumentParser(
            description=f"{self.role}: {self.name}"
        )
        parser.add_argument(
            "--mode",
            choices=["build", "run", "test"],
            default="build",
            help="Execution mode"
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Verbose output"
        )

        parsed = parser.parse_args(args)

        if parsed.mode == "build":
            return self.build(parsed)
        elif parsed.mode == "run":
            return self.run_command(parsed)
        elif parsed.mode == "test":
            return self.test_command(parsed)

        return 0

    def build(self, args) -> int:
        """Build mode - create/initialize the agent."""
        raise NotImplementedError("Subclasses must implement build()")

    def run_command(self, args) -> int:
        """Run mode - execute the agent's functionality."""
        raise NotImplementedError("Subclasses must implement run_command()")

    def test_command(self, args) -> int:
        """Test mode - run tests for the agent."""
        raise NotImplementedError("Subclasses must implement test_command()")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Task Timer Team Agent Runner"
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Agent name (architect, interface, tester)"
    )

    args = parser.parse_args()

    # Select and run the appropriate agent
    if args.name == "architect":
        from team.architect import ArchitectAgent
        agent = ArchitectAgent()
    elif args.name == "interface":
        from team.interface import InterfaceAgent
        agent = InterfaceAgent()
    elif args.name == "tester":
        from team.tester import TesterAgent
        agent = TesterAgent()
    else:
        print(f"Unknown agent: {args.name}")
        sys.exit(1)

    agent.run(sys.argv[1:])
