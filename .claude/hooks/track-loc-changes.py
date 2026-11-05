#!/usr/bin/env python3
"""track-loc-changes.py — Claude Code PostToolUse Hook

Tracks lines-of-code written by the agent during active pipeline phases.
Only runs when .claude/active-ticket exists (a pipeline phase is active).

Exit codes:
  0 — always; this hook is observational and never blocks execution.
"""

import difflib
import json
import os
import sys
from pathlib import Path

# Windows-compatible file locking
try:
    import fcntl
    def _lock_file(f): fcntl.flock(f, fcntl.LOCK_EX)
    def _unlock_file(f): fcntl.flock(f, fcntl.LOCK_UN)
except ImportError:
    def _lock_file(f): pass
    def _unlock_file(f): pass

_TRACKED_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
    ".py", ".rb", ".go", ".java", ".kt", ".swift", ".rs",
    ".c", ".cpp", ".cc", ".h", ".hpp",
    ".css", ".scss", ".sass", ".less",
    ".html", ".vue", ".svelte",
    ".json", ".yaml", ".yml", ".toml",
    ".sh", ".bash", ".zsh",
    ".tf", ".hcl",
    ".sql",
    ".graphql", ".gql",
}

_SKIP_SEGMENTS = {
    "node_modules", ".git", "dist", "build", ".next", ".turbo",
    "coverage", "__pycache__", ".venv", "venv", ".cache",
}


def _should_track(path: Path) -> bool:
    if path.suffix.lower() not in _TRACKED_EXT:
        return False
    if path.name.endswith(".lock") or path.name.endswith("-lock.json"):
        return False
    for segment in path.parts:
        if segment in _SKIP_SEGMENTS:
            return False
    return True


def _find_dot_claude() -> Path | None:
    d = Path(os.getcwd())
    while True:
        candidate = d / ".claude"
        if candidate.is_dir():
            return candidate
        parent = d.parent
        if parent == d:
            break
        d = parent
    return None


def _count_diff(old_lines, new_lines):
    added = removed = 0
    for tag in difflib.ndiff(old_lines, new_lines):
        if tag.startswith("+ "):
            added += 1
        elif tag.startswith("- "):
            removed += 1
    return added, removed


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        sys.exit(0)

    if data.get("tool_name") not in ("Write", "Edit"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    raw_path: str = tool_input.get("file_path", "")
    if not raw_path:
        sys.exit(0)

    abs_path = Path(raw_path).resolve()
    if not _should_track(abs_path) or not abs_path.exists():
        sys.exit(0)

    dot_claude = _find_dot_claude()
    if not dot_claude:
        sys.exit(0)

    active_ticket_path = dot_claude / "active-ticket"
    if not active_ticket_path.exists():
        sys.exit(0)

    try:
        active = json.loads(active_ticket_path.read_text())
        ticket_id = active.get("ticket_id", "")
        phase = active.get("phase", "")
        if not ticket_id or not phase:
            sys.exit(0)
    except (json.JSONDecodeError, OSError):
        sys.exit(0)

    try:
        new_content = abs_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        sys.exit(0)

    loc_state_path = dot_claude / "loc-state.json"
    lock_path = dot_claude / "loc-state.lock"

    try:
        with lock_path.open("a") as lf:
            _lock_file(lf)
            try:
                loc_state: dict = {}
                if loc_state_path.exists():
                    try:
                        loc_state = json.loads(loc_state_path.read_text())
                    except (json.JSONDecodeError, OSError):
                        loc_state = {}

                if (loc_state.get("ticket_id") != ticket_id
                        or loc_state.get("phase") != phase):
                    loc_state = {"ticket_id": ticket_id, "phase": phase, "files": {}}

                files: dict = loc_state.setdefault("files", {})
                key = str(abs_path)
                entry: dict = files.setdefault(key, {
                    "agent_added": 0,
                    "agent_removed": 0,
                    "last_agent_content": "",
                })

                prev_lines = entry.get("last_agent_content", "").splitlines()
                new_lines = new_content.splitlines()
                added, removed = _count_diff(prev_lines, new_lines)

                entry["agent_added"] = entry.get("agent_added", 0) + added
                entry["agent_removed"] = entry.get("agent_removed", 0) + removed
                entry["last_agent_content"] = new_content

                loc_state_path.write_text(
                    json.dumps(loc_state, indent=2), encoding="utf-8"
                )
            finally:
                _unlock_file(lf)
    except OSError:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
