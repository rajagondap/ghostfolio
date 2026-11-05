---
name: sdlc-impl-planning
description: >
  Phase 4 of the SDLC pipeline. Produces a self-contained implementation plan
  from prior SDLC artifacts (ph4_implementation_plan.md).
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Bash
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 4 — Implementation Planning

## Client Context (read at runtime)

| File                           | How to use                                                                |
| ------------------------------ | ------------------------------------------------------------------------- |
| `client-kb.md`                 | Read fully. Apply Ghostfolio tech stack, test commands, file conventions. |
| `client-notes/architecture.md` | Apply NestJS module patterns, path aliases, Prisma conventions.           |

---

## Purpose

Produce a self-contained implementation plan from prior SDLC artifacts. The plan must contain enough context that a fresh session can execute it correctly.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Ghostfolio Test Commands

| Scope       | Command                                         |
| ----------- | ----------------------------------------------- |
| All tests   | `npm test`                                      |
| API only    | `npm run test:api`                              |
| Single file | `npm run test:single -- --test-file <filename>` |
| Lint        | `npm run lint`                                  |

Always use these commands in the `Verify:` field of each step.

---

## Process

### Step 1 — Load Artifacts

```bash
python scripts/extract-sections.py docs/artifacts/<ticket>/ph1_problem_spec.md "Requirements" "Acceptance Criteria" "Constraints" "Non-Goals" "Assumptions" "Edge Cases"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph2_design_spec.md "Architecture" "Implementation Guidelines" "Testing Strategy" "Data Models"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph3_design_review.md "Summary" "Architectural Review" "Complexity Concerns" "Missing Considerations"
# Include ph3b if present
if exist docs\artifacts\<ticket>\ph3b_qa_test_plan.md (python scripts/extract-sections.py docs/artifacts/<ticket>/ph3b_qa_test_plan.md "AC → Test Matrix" "Regression Subset")
```

### Step 2-6 — Build ordered file list, dependency graph, AC mapping, test strategy, risks

Follow the implementation planning contract steps 2-6.

Ghostfolio is a single-repo project — no multi-repo complexity.

### Step 7 — Write Implementation Plan

Write `docs/artifacts/<ticket>/ph4_implementation_plan.md` with all required sections.

**Required sections:**

- `## Pipeline Context`
- `## Problem Summary`
- `## Key Requirements & Constraints`
- `## Architecture Summary`
- `## Design Review Conditions`
- `## Affected Repos` (always "Single-repo change — ghostfolio")
- `## Pre-Implementation Baseline` (always `npm test`)
- `## Implementation Steps`
- `## Risks`
- `## Edge Cases`
- `## Post-Implementation Checklist`
- `## Pipeline Continuation`

Update `pipeline_state_<ticket>.json` → `phases.impl-planning.status = "completed"`.

---

## Exit Criteria

- [ ] `ph4_implementation_plan.md` written with all required sections
- [ ] Every step has file path, new/modify status, component ID, verify command
- [ ] `## Pipeline Continuation` section present
- [ ] `pipeline_state_<ticket>.json` → `phases.impl-planning.status = "completed"`
