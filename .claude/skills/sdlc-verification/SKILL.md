---
name: sdlc-verification
description: >
  Phase 8 of the SDLC pipeline. Verifies implementation satisfies all requirements
  and acceptance criteria. Final gate before PR creation (ph8_verification_report.md).
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

# Phase 8 — Verification

## Client Context (read at runtime)

| File           | How to use                                     |
| -------------- | ---------------------------------------------- |
| `client-kb.md` | Read fully. Apply Ghostfolio test conventions. |

---

## Purpose

Verify that the implementation satisfies all requirements, acceptance criteria, and edge cases. Final gate before PR creation.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Ghostfolio Test Commands

```bash
npm test                                               # All tests
npm run test:api                                       # API tests
npx jest --json --outputFile=docs/artifacts/<ticket>/.state/test-output.json 2>&1
```

---

## Process

Follow the Verification contract:

1. Load checkpoint artifacts
2. Aggregate Phase 7 sub-agent results (if available)
3. **Wiring Verification (3-level):** existence → substantive → wired
4. **Requirement Coverage Matrix:** map REQ-### to implementation files
5. **Run Tests:** `npm test` — collect pass/fail counts
6. **Edge Case Coverage:** verify EC-### handling in tests
7. **Generate Recommendations** (priority 1-5, blocking/non-blocking)
8. **Calculate Score:** `Requirement Coverage (60) + Test Pass Rate (40)`
9. **Apply Quality Gates:**
   - Every P0 requirement has at least one passed AC
   - Test pass rate ≥80%
   - No failed edge cases

**Status:**

- ≥70 + no blocking + tests ≥80% → `passed`
- ≥50 → `passed_with_warnings`
- <50 OR any P0 not covered OR tests <60% → `failed`

Write `docs/artifacts/<ticket>/ph8_verification_report.md`.

Update `pipeline_state_<ticket>.json` → `phases.verification.status = "completed"`.

---

## Exit Criteria

- [ ] All 3 gates evaluated
- [ ] Wiring verification complete
- [ ] Requirement coverage matrix built
- [ ] Tests run and results collected
- [ ] `ph8_verification_report.md` written with all required sections
- [ ] `pipeline_state_<ticket>.json` → `phases.verification.status = "completed"`
