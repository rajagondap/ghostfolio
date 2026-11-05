---
name: sdlc-qa-test-generation
description: >
  Phase 3b of the SDLC pipeline. Generates structured QA test cases from acceptance criteria.
  No external test management tool configured for Ghostfolio — produces markdown test plan only.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)
- **test-management:** None configured — markdown output only

# Phase 3b — QA Test Generation

## Client Context (read at runtime)

| File           | How to use                                                                               |
| -------------- | ---------------------------------------------------------------------------------------- |
| `client-kb.md` | Read fully. Apply Ghostfolio testing conventions (Jest, `npm test`, `npm run test:api`). |

---

## Purpose

Generate a structured test plan from the problem spec and design spec. Runs in parallel with Phase 3 for Large Features, sequentially after Phase 2 for Small Features. Result is **informational only** — does not gate Phase 4.

**No test management tool configured.** This phase generates a Markdown test plan only. No Jira/Zephyr/ADO test issues are created.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Process

### Step 1 — Read Inputs

```bash
python scripts/extract-sections.py docs/artifacts/<ticket>/ph1_problem_spec.md "Requirements" "Acceptance Criteria" "Edge Cases"
python scripts/extract-sections.py docs/artifacts/<ticket>/ph2_design_spec.md "Architecture" "API Contracts" "Testing Strategy"
```

### Step 2 — Skip: No test management tool

No existing tests to find in an external system. All tests are `decision: new`.

### Step 3 — Generate Test Cases

For every Acceptance Criterion, generate minimum:

- One **functional positive** case
- One **negative / validation** case
- One **edge** case

Each test case:

```
id:            TC-###
title:         <descriptive title>
type:          functional | integration | e2e
preconditions: <what must be true>
steps:         <numbered steps>
expected:      <what should happen>
related_acs:   [AC-###, ...]
priority:      critical | high | medium | low
regression:    true | false
jest_path:     <suggested test file path>
```

Ghostfolio test file naming convention: `<service>.service.spec.ts` for NestJS services.

### Step 4 — Skip: No test management tool

Skip external test issue creation. Document as `status: markdown-only`.

### Step 5 — Classify Regression Subset

Mark `regression: true` when:

- Type is `functional` or `integration`, AND
- AC modifies an existing endpoint or service, OR
- AC is P0 priority

### Step 6 — Skip: No QA automation repo

No separate QA automation repo configured for Ghostfolio. Skip.

### Step 7 — Post Comment on GitHub Issue

```bash
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
gh issue comment "$ISSUE_NUM" --repo rajagondap/ghostfolio --body "**[Phase 3b — QA Test Generation]: completed**

Generated $(echo $TEST_COUNT) test cases for $(echo $AC_COUNT) acceptance criteria.

Artifact: docs/artifacts/<ticket>/ph3b_qa_test_plan.md"
```

### Step 8 — Write Artifact

Write `docs/artifacts/<ticket>/ph3b_qa_test_plan.md` with:

- `## Meta`, `## AC → Test Matrix`, `## Test Cases`, `## Regression Subset`
- `## Automation PR` section: "Skipped — no QA automation repo configured for Ghostfolio"

Update `pipeline_state_<ticket>.json` → `phases.qa-test-generation.status = "completed"`.

---

## Exit Criteria

- [ ] Test cases generated for every AC
- [ ] Regression subset classified
- [ ] `ph3b_qa_test_plan.md` written
- [ ] `pipeline_state_<ticket>.json` → `phases.qa-test-generation.status = "completed"`
