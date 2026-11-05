---
name: sdlc-design-review
description: >
  Phase 3 of the SDLC pipeline. Critically reviews the architecture design across
  5 dimensions and produces a scored review with gate decision (ph3_design_review.md).
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

# Phase 3 — Design Review

## Client Context (read at runtime)

| File           | How to use                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| `client-kb.md` | Read fully. Apply Ghostfolio domain knowledge, tech stack, NestJS/Angular patterns. |

---

## Purpose

Challenge the architecture design before implementation. Find flaws, challenge assumptions, identify gaps. Score 0–100. Gate: approve / approve_with_concerns / reject.

**This skill is READ-ONLY.** You evaluate artifacts and codebase. You do not modify source files.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Process

Follow the Design Review contract — execute all 6 dimensions:

**A — Codebase Validation (Mode B):** Verify components exist at specified paths.
**B — Architectural Review:** SRP, data flow, circular deps, DI compatibility, error propagation.
**C — Assumption Challenges:** Challenge every ASM-### for likelihood and impact.
**D — Complexity Concerns:** Over-engineering, unnecessary abstractions.
**E — Alternative Approaches:** At least 2 alternatives per major decision.
**F — Missing Considerations:** Error handling, observability, security, backward compat.

Score each dimension 0–100. Compute overall average.

**Gate decision:**

- `approve`: all dimensions ≥70, zero critical findings
- `approve_with_concerns`: all dimensions ≥50, zero critical findings
- `reject`: any dimension <50 OR any critical finding

Write output to `docs/artifacts/<ticket>/ph3_design_review.md`.

Update `pipeline_state_<ticket>.json` → `phases.design-review.status = "completed"`.

---

## Exit Criteria

- [ ] All 6 review dimensions evaluated
- [ ] Design quality score computed
- [ ] Gate decision applied
- [ ] `ph3_design_review.md` written with required sections
- [ ] `pipeline_state_<ticket>.json` → `phases.design-review.status = "completed"`
