---
name: sdlc-risk
description: >
  Phase 9 of the SDLC pipeline. Adversarial review — finds failure modes, attack
  scenarios, and blind spots. Produces ph9_risk_assessment.md with ship recommendation.
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

# Phase 9 — Risk Assessment

## Client Context (read at runtime)

| File           | How to use                                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| `client-kb.md` | Read fully. Apply Ghostfolio domain knowledge, portfolio calculation sensitivity. |

---

## Purpose

Adversarial review before PR creation. Find failure modes, attack scenarios, and blind spots.

**This skill is READ-ONLY.** It assesses risk. It does not remediate.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Key Ghostfolio Risk Areas

Always evaluate these Ghostfolio-specific risks:

- **Portfolio calculation impact**: does this change affect `portfolio.service.ts`? (affects all users' portfolios — HIGH risk)
- **Prisma schema migration**: new models or migrations risk data loss on failed deployment
- **Data provider reliability**: if feature depends on external data provider (Yahoo Finance, ECB, etc.) — availability risk
- **Exchange rate staleness**: if feature uses exchange rates — stale data risk
- **Queue performance**: new Bull queue jobs — worker overload at high activity

---

## Process

Follow the Risk Assessment contract steps 0-11:

1. Load prior artifacts
2. Enter adversarial mindset
3. Challenge all ASM-### assumptions
4. Identify Failure Modes (FM-###) across 7 categories
5. Construct Attack Scenarios (ATK-###)
6. Scan for Blind Spots (BS-###) across 10 categories
7. Design stress test scenarios
8. Assess dependency risks
9. Make ship recommendation: `ship` / `ship_with_monitoring` / `fix_first` / `redesign`
10. Document rollback plan
11. Compile prioritised recommendations

Write `docs/artifacts/<ticket>/ph9_risk_assessment.md`.

Update `pipeline_state_<ticket>.json` → `phases.risk-assessment.status = "completed"`.

---

## Exit Criteria

- [ ] All assumptions challenged
- [ ] Failure modes identified across all categories
- [ ] Ghostfolio-specific risks evaluated
- [ ] Ship recommendation made
- [ ] Rollback plan documented
- [ ] `ph9_risk_assessment.md` written with required sections
- [ ] `pipeline_state_<ticket>.json` → `phases.risk-assessment.status = "completed"`
