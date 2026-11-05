#!/usr/bin/env python3
"""Destructive Command Guard — Claude Code PreToolUse Hook

Intercepts every Bash tool call and blocks commands that could cause
irreversible damage to the host machine.

Exit codes (Claude Code hook contract):
  0 — safe, allow tool to proceed
  2 — blocked; stdout is fed back to Claude as context
"""

import json
import re
import sys

CRITICAL_PATHS = (
    "/",
    "~",
    "$HOME",
    "${HOME}",
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
    "/boot",
    "/var",
    "/private",
    "/opt",
    "/System",
    "/Library",
    "/Applications",
    "/Volumes",
    "/dev",
    "/proc",
    "/sys",
)

_SHELL_SEP = re.compile(r"[;&]|\|\|?|\n")


def _has_recursive_flag(args: str) -> bool:
    return bool(re.search(r"(?:^|\s)-[a-zA-Z]*[rR]|--recursive", args))


def check_destructive_rm(command: str):
    for part in _SHELL_SEP.split(command):
        tokens = part.strip().split()
        if not tokens:
            continue

        if tokens[0] in ("sudo", "doas") and len(tokens) > 1:
            tokens = tokens[1:]

        if not tokens or tokens[0] != "rm":
            continue

        args = " ".join(tokens[1:])
        if not _has_recursive_flag(args):
            continue

        for path in CRITICAL_PATHS:
            pattern = rf"(?:^|\s){re.escape(path)}(?:\s|/|\*|$)"
            if re.search(pattern, args):
                return True, f"recursive rm targeting critical path '{path}'"

    return False, ""


_STATIC_RULES = [
    (r"\bmkfs\b", "filesystem format command (mkfs)"),
    (r"\bdd\b.+of\s*=\s*/dev/(disk|sd[a-z]+|nvme|rd/)", "dd writing to a block device"),
    (
        r"\bdiskutil\s+(eraseDisk|eraseVolume|zeroDisk|secureErase|reformat)\b",
        "diskutil destructive operation",
    ),
    (r"\bchmod\b.+-R.+777\s+/(?:\s|$)", "chmod -R 777 on filesystem root"),
    (r"\bchmod\b.+777\s+(~|\$\{?HOME\}?)(?:\s|$)", "chmod 777 on home directory"),
    (r":\s*\(\s*\)\s*\{[^}]*:\s*\|.*:\s*&", "fork bomb pattern"),
    (
        r"(?:^|[;&|])\s*>\s*/etc/(passwd|shadow|sudoers|hosts|fstab)\b",
        "truncation of critical system file via shell redirection",
    ),
    (r"\bshred\b.+/dev/(disk|sd[a-z]+|nvme)", "shred targeting a block device"),
    (r"\bwipefs\b.+/dev/", "wipefs on a block device"),
]


def _block(reason: str, command: str) -> None:
    print(
        f"BLOCKED by Destructive Command Guard\n"
        f"Reason  : {reason}\n"
        f"Command : {command!r}\n\n"
        f"This command could cause irreversible system damage and has been prevented.\n"
        f"If you genuinely need to run this, execute it manually in your own terminal.",
        flush=True,
    )
    sys.exit(2)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError, ValueError):
        sys.exit(0)

    if data.get("tool_name") != "Bash":
        sys.exit(0)

    command: str = data.get("tool_input", {}).get("command", "")
    if not command:
        sys.exit(0)

    blocked, reason = check_destructive_rm(command)
    if blocked:
        _block(reason, command)

    for pattern, description in _STATIC_RULES:
        if re.search(pattern, command, re.IGNORECASE | re.DOTALL):
            _block(description, command)

    sys.exit(0)


if __name__ == "__main__":
    main()
