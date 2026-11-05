#!/usr/bin/env python3
"""Ensure Workspace Codebase Index — Claude Code PreToolUse Hook

Fires before every sdlc-pipeline Skill invocation. Discovers all git repos
under $PROJECT_ROOT, pulls updates, and writes a .needs-rebuild flag when
any repo's HEAD has changed. The pipeline reads this flag and rebuilds index.

Exit codes:
  0 — always; this hook is non-blocking
"""

import json
import os
import subprocess
import sys
from pathlib import Path

TRIGGERING_SKILL = "sdlc-pipeline"


def load_input() -> dict:
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        return {}


def is_sdlc_pipeline_call(data: dict) -> bool:
    if data.get("tool_name") != "Skill":
        return False
    skill_name = data.get("tool_input", {}).get("skill", "")
    return skill_name.endswith(TRIGGERING_SKILL)


def find_project_root(cwd: Path) -> Path:
    d = cwd
    while d != d.parent:
        if (d / "docs").is_dir():
            return d
        d = d.parent
    return cwd


def load_excluded_dirs(project_root: Path) -> set:
    config_path = project_root / ".claude" / "codebase-index-config.json"
    if config_path.exists():
        try:
            cfg = json.loads(config_path.read_text())
            return set(cfg.get("excluded_dirs", []))
        except Exception:
            pass
    return set()


def discover_git_repos(workspace: Path, excluded: set):
    repos = []
    try:
        for entry in sorted(workspace.iterdir()):
            if (
                entry.is_dir()
                and not entry.name.startswith(".")
                and entry.name not in excluded
                and (entry / ".git").exists()
            ):
                repos.append(entry)
    except PermissionError:
        pass
    return repos


def get_head_sha(repo: Path):
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def git_pull(repo: Path) -> bool:
    try:
        result = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result.returncode == 0
    except Exception:
        return False


def main() -> None:
    data = load_input()

    if not is_sdlc_pipeline_call(data):
        sys.exit(0)

    cwd = Path(os.getcwd())
    project_root = find_project_root(cwd)
    index_dir = project_root / ".codebase-index"
    index_dir.mkdir(parents=True, exist_ok=True)

    excluded = load_excluded_dirs(project_root)
    repos = discover_git_repos(project_root, excluded)

    if not repos:
        print("[index-check] No git repos found under workspace root.", flush=True)
        sys.exit(0)

    heads_path = index_dir / "repo-heads.json"
    stored_heads: dict = {}
    if heads_path.exists():
        try:
            stored_heads = json.loads(heads_path.read_text())
        except Exception:
            stored_heads = {}

    needs_rebuild = False

    for repo in repos:
        repo_key = repo.name
        current_sha = get_head_sha(repo)
        stored_sha = stored_heads.get(repo_key)

        is_stale = (stored_sha is None) or (current_sha != stored_sha)

        if not is_stale:
            print(
                f"[index-check] {repo_key}: up-to-date ({(current_sha or '')[:8]})",
                flush=True,
            )
            continue

        reason = "new repo" if stored_sha is None else f"HEAD changed ({(stored_sha or '')[:8]} -> {(current_sha or '')[:8]})"
        print(f"[index-check] {repo_key}: stale ({reason}) — pulling", flush=True)

        success = git_pull(repo)
        if not success:
            print(
                f"[index-check] Warning: pull failed (detached HEAD / no remote?): {repo_key}",
                flush=True,
            )

        needs_rebuild = True

    if needs_rebuild:
        (index_dir / ".needs-rebuild").touch()
        print(
            "[index-check] .needs-rebuild flag written — pipeline will rebuild codebase index.",
            flush=True,
        )
    else:
        print("[index-check] All repos current — no rebuild needed.", flush=True)

    sys.exit(0)


if __name__ == "__main__":
    main()
