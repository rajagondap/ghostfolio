#!/usr/bin/env python3
"""Env File Guard — Claude Code PreToolUse Hook

Prevents Claude from writing credential files outside gitignored paths.

Exit codes (Claude Code hook contract):
  0 — allowed
  2 — blocked; stdout is fed back to Claude as context
"""
import sys
import json
import re
from pathlib import Path

CREDENTIAL_PATTERNS = [
    r"(^|[\\/])\.env$",
    r"(^|[\\/])\.env\.",
    r"(^|[\\/])secrets?\.",
    r"(^|[\\/])credentials?\.",
    r"(^|[\\/])\.secrets",
]

ALLOWED_EXCEPTIONS = [
    ".env.example",
    ".env.template",
    ".env.test",
]


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        sys.exit(0)

    if data.get("tool_name") not in ("Write", "Edit"):
        sys.exit(0)

    raw_path: str = data.get("tool_input", {}).get("file_path", "")
    if not raw_path:
        sys.exit(0)

    path = Path(raw_path)
    filename = path.name

    # Allow explicitly safe exceptions
    for allowed in ALLOWED_EXCEPTIONS:
        if filename == allowed or str(path).endswith(allowed):
            sys.exit(0)

    for pattern in CREDENTIAL_PATTERNS:
        if re.search(pattern, str(path), re.IGNORECASE):
            print(
                f"BLOCKED by Env File Guard\n"
                f"Path    : {raw_path}\n\n"
                f"Writing credential files is blocked to prevent accidental secret exposure.\n"
                f"If you need to update .env values, edit the file directly in your editor.",
                flush=True,
            )
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
