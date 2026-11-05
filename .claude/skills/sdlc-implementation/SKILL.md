---
name: sdlc-implementation
description: >
  Phase 5 of the SDLC pipeline. Executes the implementation plan step by step —
  one file at a time, testing after each. Produces ph5_6_impl_manifest.md.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 5 — Implementation

## Client Context (read at runtime)

| File                           | How to use                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `client-kb.md`                 | Read fully. Apply Ghostfolio coding standards, NestJS patterns, path aliases.           |
| `client-notes/architecture.md` | Apply architecture constraints: no raw SQL, use @ghostfolio/common, NestJS DI patterns. |

---

## Prime Directive

> **One step. Verify. Then next.**

Never batch steps. Never skip verification. Never proceed past a failed test.

---

## Iron Laws

- **NEVER SKIP A STEP** — execute in order, every time.
- **NEVER PROCEED PAST A FAILED VERIFICATION** — fix or stop.
- **NEVER BATCH MULTIPLE FILES** — one file at a time, verify, then next.
- **NEVER WRITE CODE WITHOUT THE PLAN** — if `ph4_implementation_plan.md` is missing, HALT.
- **NEVER SILENTLY DEVIATE FROM THE PLAN** — explain and get user confirmation first.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |
| `--resume`           | No       |

---

## Ghostfolio Test Commands

| Scope       | Command                                         |
| ----------- | ----------------------------------------------- |
| All tests   | `npm test`                                      |
| API only    | `npm run test:api`                              |
| Single file | `npm run test:single -- --test-file <filename>` |

After each file: run `npm run test:api` (or the specific test file's command from the plan).

---

## Process

### Step 1 — Load Plan

```bash
python scripts/extract-sections.py docs/artifacts/<ticket>/ph4_implementation_plan.md "*"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph2_design_spec.md "Architecture" "API Contracts" "Data Models" "Implementation Guidelines"
```

### Step 2 — Parallel Read All Existing Files

Before writing anything, read ALL files listed as "modify" in the plan as a single parallel batch.

### Step 3 — Run Baseline Tests

```bash
npm test 2>&1 | tee /tmp/baseline_tests.txt
```

If baseline tests fail: **STOP** — ask user to fix baseline first.

### Step 4 — Execute Steps

For each step in order:

1. Write or edit the file following the plan's notes, data models from `ph2_design_spec.md`, and Ghostfolio coding standards
2. Present diff to user — wait for approval
3. Run tests: `npm run test:api` (or plan's verify command)
   - Pass: "Step [N] complete." — checkpoint, next step
   - Fail: **STOP** — diagnose, fix, retry

### Step 5 — Write Manifest

After all steps complete, write `docs/artifacts/<ticket>/ph5_6_impl_manifest.md`.

### Step 6 — Update Pipeline State

Update `pipeline_state_<ticket>.json` → `phases.implementation.status = "completed"`.

---

## Exit Criteria

- [ ] All steps in `ph4_implementation_plan.md` completed
- [ ] No test regressions from baseline
- [ ] `ph5_6_impl_manifest.md` written with required sections
- [ ] `pipeline_state_<ticket>.json` → `phases.implementation.status = "completed"`
