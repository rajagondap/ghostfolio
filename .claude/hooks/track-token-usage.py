#!/usr/bin/env python3
"""track-token-usage.py — Claude Code Stop Hook

Safety LOC checkpoint: flushes accumulated LOC data from .claude/loc-state.json
into the active phase's `loc` field in pipeline_state_<ticket>.json each time
Claude finishes a response.

Only runs when .claude/active-ticket and .claude/loc-state.json both exist.

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


def _flush_loc(dot_claude: Path, ticket_id: str, phase: str) -> None:
    loc_state_path = dot_claude / "loc-state.json"
    if not loc_state_path.exists():
        return

    try:
        loc_state = json.loads(loc_state_path.read_text())
    except (json.JSONDecodeError, OSError):
        return

    if (loc_state.get("ticket_id") != ticket_id
            or loc_state.get("phase") != phase):
        return

    by_file: dict = {}
    total_aa = total_ar = total_ha = total_hr = 0

    for abs_path_str, f in loc_state.get("files", {}).items():
        aa = f.get("agent_added", 0)
        ar = f.get("agent_removed", 0)
        last_content = f.get("last_agent_content", "")

        ha = hr = 0
        try:
            cur = Path(abs_path_str).read_text(encoding="utf-8", errors="replace")
            for tag in difflib.ndiff(
                last_content.splitlines(), cur.splitlines()
            ):
                if tag.startswith("+ "):
                    ha += 1
                elif tag.startswith("- "):
                    hr += 1
        except OSError:
            ha = f.get("immediate_human_added", 0)
            hr = f.get("immediate_human_removed", 0)

        if aa + ar + ha + hr == 0:
            continue

        try:
            rel = os.path.relpath(abs_path_str, os.getcwd())
        except ValueError:
            rel = abs_path_str

        total_aa += aa
        total_ar += ar
        total_ha += ha
        total_hr += hr
        all_added = aa + ha
        by_file[rel] = {
            "agent_added": aa,
            "agent_removed": ar,
            "human_added": ha,
            "human_removed": hr,
            "agent_pct": round(aa / all_added * 100, 1) if all_added else 100.0,
        }

    if not by_file:
        return

    all_total = total_aa + total_ha
    loc_record = {
        "agent_added": total_aa,
        "agent_removed": total_ar,
        "human_added": total_ha,
        "human_removed": total_hr,
        "survival_rate": round(total_aa / all_total * 100, 1) if all_total else 100.0,
        "agent_pct": round(total_aa / all_total * 100, 1) if all_total else 100.0,
        "by_file": by_file,
    }

    workspace_root = dot_claude.parent
    state_dir = workspace_root / "docs" / "artifacts" / ticket_id / ".state"
    state_path = state_dir / f"pipeline_state_{ticket_id}.json"
    if not state_path.exists():
        state_path = state_dir / "pipeline_state.json"
    if not state_path.exists():
        return

    lock_path = state_path.with_suffix(".lock")
    try:
        with lock_path.open("a") as lf:
            _lock_file(lf)
            try:
                state = json.loads(state_path.read_text())
                phases = state.get("phases", {})
                if phase in phases:
                    phases[phase]["loc"] = loc_record
                    state["loc_summary"] = {
                        "total_agent_added": total_aa,
                        "total_agent_removed": total_ar,
                        "total_human_added": total_ha,
                        "total_human_removed": total_hr,
                        "survival_rate": loc_record["survival_rate"],
                        "by_file": by_file,
                    }
                    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
            finally:
                _unlock_file(lf)
    except OSError:
        pass


def main() -> None:
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        pass

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

    _flush_loc(dot_claude, ticket_id, phase)
    sys.exit(0)


if __name__ == "__main__":
    main()
