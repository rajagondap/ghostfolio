---
name: sdlc-review
description: >
  Phase 7 of the SDLC pipeline. Runs three parallel review agents — code quality,
  test coverage, security — and gates on spec compliance.
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

# Phase 7 — Review

## Client Context (read at runtime)

| File           | How to use                                                 |
| -------------- | ---------------------------------------------------------- |
| `client-kb.md` | Read fully. Apply Ghostfolio tech stack, coding standards. |

---

## Purpose

Run three parallel review agents against the implementation. Gate on spec compliance before aggregating results.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Process

### Step 1 — Extract Context

```bash
python scripts/extract-sections.py docs/artifacts/<ticket>/ph1_problem_spec.md "Requirements" "Acceptance Criteria"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph2_design_spec.md "Architecture" "API Contracts" "Testing Strategy"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph5_6_impl_manifest.md "Files Created" "Files Modified" "Known Conflicts"
```

### Step 2 — Multi-Repo Coverage Check

Ghostfolio is single-repo — verify ghostfolio appears in the manifest. If empty: HALT.

### Step 3 — Dispatch Three Parallel Review Agents

Launch all three concurrently using the Agent tool:

**a) spec-reviewer** — invokes `sdlc-code-review` sub-skill:

- Check every REQ-### covered, every component path correct
- Returns: `{ spec_compliant: bool, violations_found: [REQ-IDs] }`

**b) test-engineer** — invokes `sdlc-generate-tests` sub-skill:

- Check all ACs covered, generate missing Jest tests

**c) security-auditor** — invokes `sdlc-security-scan` sub-skill:

- Secrets, injection, auth, OWASP Top 10

### Step 4 — Record gate_history BEFORE processing spec result

### Step 5 — Spec Compliance Gate

If `spec_compliant: false` and loop < 2: return to Phase 5.
If `spec_compliant: false` and loop >= 2: HALT.
If `spec_compliant: true`: aggregate all three results.

### Step 6 — Aggregate and Present Results

Combine findings, present unified summary, call `AskUserQuestion` for approval.

Update `pipeline_state_<ticket>.json` → `phases.review.status = "completed"`.

---

## Exit Criteria

- [ ] All three review agents completed
- [ ] gate_history entry recorded before spec gate decision
- [ ] `pipeline_state_<ticket>.json` → `phases.review.status = "completed"`
