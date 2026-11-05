Validate that the workspace is correctly set up for running the SDLC pipeline. Run before executing a ticket for the first time, or when troubleshooting.

Arguments: $ARGUMENTS

No arguments required. Run all checks and report ✓ / ✗ / ⚠ for each.

---

**Check 1 — Claude Code CLI**
```bash
claude --version
```
✗ if missing: `npm install -g @anthropic-ai/claude-code`

**Check 2 — Claude Code authentication**
Check if authenticated to Claude Code.

**Check 3 — gh CLI (GitHub SCM)**
```bash
gh auth status
```
✓ if authenticated. ⚠ if not: run `gh auth login`

**Check 4 — Generated SDLC skills**
Glob for `.claude/skills/sdlc-*/SKILL.md`.
⚠ if missing: "SDLC phase skills not found. Run `/sdlc-generate` to generate them from the intake form."

**Check 5 — Standalone skills**
Glob for `.claude/skills/systematic-debugging/SKILL.md`, `writing-plans/SKILL.md`, etc.
✓ report count found.

**Check 6 — Claude Code hooks**
Read `.claude/settings.json` and verify the following hooks are registered:
- `eslint-on-save.py` under `PostToolUse`
- `guard-destructive-commands.py` under `PreToolUse`
- `guard-env-files.py` under `PreToolUse`

⚠ if missing: "Hooks not registered. Check `.claude/settings.json`."

**Check 7 — Prerequisites**
- `python` or `python3` available
- `node` available
- `gh` CLI available

**Check 8 — .gitignore coverage**
Verify `docs/artifacts/` and `.codebase-index/` are gitignored.

---

**Output format:**

```
SDLC Doctor — Ghostfolio
══════════════════════════════════════════════════════════════
✓  Claude Code CLI          installed
✓  gh CLI                   authenticated
✓  Standalone skills        5 skills found
⚠  SDLC phase skills        MISSING — run /sdlc-generate after filling docs/intake-sources.md
✓  Hook: eslint-on-save     registered
✓  Hook: guard-destructive  registered
✓  Hook: guard-env-files    registered
✓  Python                   present
✓  Node.js                  present
✓  .gitignore               docs/artifacts/ covered

Result: 1 issue(s) found — fix items marked ⚠ or ✗ before running the pipeline.
```

If all checks pass: "All checks passed — workspace is ready. Run: /sdlc --ticket=<TICKET-ID>"
