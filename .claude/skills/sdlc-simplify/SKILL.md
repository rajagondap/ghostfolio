---
name: sdlc-simplify
description: >
  Phase 6 of the SDLC pipeline. Reviews implementation-changed files for code quality,
  dead code, and duplication. Applies targeted fixes and updates ph5_6_impl_manifest.md.
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 6 — Simplify

## Client Context (read at runtime)

| File                           | How to use                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `client-kb.md`                 | Read fully. Apply Ghostfolio coding standards, path aliases, logger conventions. |
| `client-notes/architecture.md` | Apply: always use @ghostfolio path aliases, NestJS Logger not console.log.       |

---

## Purpose

Review implementation-changed files for code quality, clarity, dead code, and duplicate logic. Apply targeted improvements using Edit only. Never change behaviour.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Process

### Step 0 — Initialise

Record `started_at` in pipeline state.

### Step 1 — Get Changed Files

```bash
git diff --name-only HEAD~1
```

Skip: `*.lock`, `*.snap`, `*.md`, `dist/`, `build/`, `.next/`, `node_modules/`

### Step 2 — Read All Changed Files (parallel batch)

### Step 3 — Simplify Each File

Check `client-notes/architecture.md` for Ghostfolio-specific rules first.

Ghostfolio-specific standards to enforce:

- Use `@ghostfolio/common` path aliases (never `../../..` relative imports)
- Use `private readonly logger = new Logger(ServiceName.name)` not `console.log`
- `async/await` over `.then()` chains
- Explicit TypeScript return types on public methods
- No `any` without justification comment
- Typed error classes over `catch (e: any)`

Generic cleanups:

- Remove unused imports
- Remove commented-out code blocks (>3 lines)
- Extract copy-pasted blocks (>5 lines) to shared utils

### Step 4 — Apply Fixes

Use **Edit only** — never rewrite entire files with Write.

Before removing an export, verify it is unused:

```bash
grep -r "import.*<symbol>" apps/api/src libs --include="*.ts" --include="*.tsx"
```

### Step 5 — Output Summary and Update Manifest

Append `## Simplification` to `docs/artifacts/<ticket>/ph5_6_impl_manifest.md`.

### Step 6 — Update Pipeline State (mandatory — run even if no files changed)

```bash
TICKET="<TICKET-ID>"
COMPLETED_AT=$(date '+%Y-%m-%dT%H:%M:%S.000%z')
STATE_FILE="docs/artifacts/$TICKET/.state/pipeline_state_$TICKET.json"

python -c "
import json
from datetime import datetime
with open('$STATE_FILE') as f: state = json.load(f)
started = state['phases']['simplify'].get('started_at', '$COMPLETED_AT')
try:
    duration_ms = int((datetime.fromisoformat('$COMPLETED_AT') - datetime.fromisoformat(started)).total_seconds() * 1000)
except:
    duration_ms = 0
state['phases']['simplify'].update({'status': 'completed', 'completed_at': '$COMPLETED_AT', 'duration_ms': duration_ms, 'active_duration_ms': duration_ms})
state['updated_at'] = '$COMPLETED_AT'
with open('$STATE_FILE', 'w') as f: json.dump(state, f, indent=2)
print('Phase 6 state written')
"
```

---

## Exit Criteria

- [ ] All changed files reviewed
- [ ] Fixes applied with Edit only
- [ ] `## Simplification` appended to `ph5_6_impl_manifest.md`
- [ ] `pipeline_state_<ticket>.json` → `phases.simplify.status = "completed"` with non-null `tokens_used.total`
