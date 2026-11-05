---
name: sdlc-requirements
description: >
  Phase 1 of the SDLC pipeline. Fetches the GitHub Issue, interrogates the user,
  produces an approved problem specification (ph1_problem_spec.md).
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

# Phase 1 — Requirements

## Client Context (read at runtime)

Read the following files at the start of this phase:

| File                           | How to use                                                                 |
| ------------------------------ | -------------------------------------------------------------------------- |
| `client-kb.md`                 | Read fully. Apply Ghostfolio domain knowledge, tech stack, key file paths. |
| `client-notes/requirements.md` | Read fully. Apply all Ghostfolio-specific checks and guards.               |

---

## Purpose

Transform a GitHub Issue into a precise, well-structured problem specification with clear acceptance criteria, edge cases, and documented assumptions.

---

## Prime Directive

> **"Ask 10 questions before you write 1 requirement."**

Never guess. Always ask. Only produce `ph1_problem_spec.md` when requirements are crystal clear and every mandatory interrogation category is covered.

---

## Iron Laws (GitHub Issues)

- **Never proceed without a valid issue number.**
- **Never fabricate issue content.** If gh CLI is unavailable, ask user to paste inline.
- **Always strip null/empty fields** from the API response before analysis.
- **GitHub Issues has no native workflow states** — use labels (`pipeline:in-progress`, `pipeline:in-review`, `pipeline:completed`) to signal pipeline state.

---

## Arguments

```
--ticket=TICKET-ID
```

`--ticket` (required): GitHub Issue ID in GH-NNN format.

---

## Step 2 — Fetch GitHub Issue

```bash
# Extract issue number (GH-3 → 3)
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
gh issue view "$ISSUE_NUM" --repo rajagondap/ghostfolio --json number,title,body,state,labels,milestone,assignees
```

Extract: `title`, `body`, `state`, `labels[].name`, `milestone.title`, `assignees[].login`, `number`.

**Fallback (Mode B):** If gh CLI fails, ask user to paste issue content inline.

After fetching, also read the feature description from inline arguments if provided.

---

## Step 3 — Targeted Codebase Scan

Before asking any questions, scan the Ghostfolio codebase to convert assumptions into facts.

Key paths to always check for Ghostfolio:

- `prisma/schema.prisma` — check existing data models before proposing new ones
- `libs/common/src/lib/config.ts` — check for existing constants (currencies, queues)
- `apps/api/src/services/` — check for existing services before creating new ones

---

## Step 5 — Interrogation Phase

**Ask ALL questions in ONE message, then STOP and WAIT.**

Mandatory interrogation categories for Ghostfolio:

- [ ] **Scope** — what is explicitly in and out of scope
- [ ] **Error States** — failure modes, degraded states
- [ ] **Database Schema Impact** — new Prisma models? migrations?
- [ ] **Data Provider Impact** — affects market data or exchange rate providers?
- [ ] **Portfolio Calculation Impact** — affects `portfolio.service.ts`? (high blast radius)
- [ ] **Backward Compatibility** — API changes, data migrations, default behaviour changes
- [ ] **Performance** — response times, payload limits, caching needs

Note: Skip Feature Flags (no feature flag system), Skip Multi-brand (single-user), Skip PII (no PII).

---

## Step 7 — Present Draft Plan for User Approval (mandatory)

Present draft and STOP. Wait for "approved" before writing `ph1_problem_spec.md`.

---

## Step 8 — Produce Problem Specification

Write `docs/artifacts/<ticket>/ph1_problem_spec.md` with all required sections:

`## Meta`, `## Problem Statement`, `## Requirements`, `## Acceptance Criteria`, `## Constraints`, `## Non-Goals`, `## Assumptions`, `## Edge Cases`, `## Backward Compatibility`, `## Decision Log`, `## Glossary`, `## Affected Repos`

After saving, update `pipeline_state_<ticket>.json` → `phases.requirements.status = "completed"`.

Also add pipeline label to GitHub Issue:

```bash
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
gh label create "pipeline:in-progress" --color "0075ca" --repo rajagondap/ghostfolio 2>/dev/null || true
gh issue edit "$ISSUE_NUM" --repo rajagondap/ghostfolio --add-label "pipeline:in-progress"
```

---

## Exit Criteria

- [ ] All mandatory interrogation categories covered (adjusted for Ghostfolio — no feature flags, no multi-brand)
- [ ] User explicitly approved the draft plan
- [ ] `ph1_problem_spec.md` written with all required sections non-empty
- [ ] Decision Log has minimum 3 entries
- [ ] `pipeline_state_<ticket>.json` → `phases.requirements.status = "completed"`
