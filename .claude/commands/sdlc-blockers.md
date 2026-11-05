List all blocking findings across design review and verification for a ticket, so the developer knows exactly what must be resolved before the pipeline can continue.

Arguments: $ARGUMENTS

**Usage:** `--ticket=TICKET-ID`

Extract the ticket ID from `$ARGUMENTS`. Read the following artifact files if they exist:
- `docs/artifacts/<ticket>/ph3_design_review.md`
- `docs/artifacts/<ticket>/ph8_verification_report.md`

Extract all findings where `severity = critical` or `blocking = true`. Output in this format:

```
Blockers — <TICKET-ID>
══════════════════════════════════════════════════════════════

Design Review Blockers (ph3_design_review.md):
  [ARCH-001]  critical  Data Flow Completeness
              Current:  <what the design does>
              Fix:      <recommended action>

  [ARCH-002]  critical  Circular dependency: COMP-003 → COMP-007 → COMP-003
              Fix:      <recommended action>

Verification Blockers (ph8_verification_report.md):
  [VER-001]  critical  AC-004 has no implementation evidence
             Fix:      Implement <file path> as specified in ph4_implementation_plan.md

  No verification blockers  (if verification has not run or passed cleanly)

Summary:
  Design Review:  <N> blocker(s)
  Verification:   <N> blocker(s)
  Total:          <N> blocker(s) to resolve before pipeline can proceed

Next step: resolve the findings above, then run:
  /sdlc-retry --ticket=<TICKET-ID> --phase=<phase-that-blocked>
```

If no blocking findings exist across both phases: report "No blockers found for <TICKET-ID> — pipeline is clear to proceed."

If neither artifact file exists yet: report which phases have not run and suggest running the pipeline first.
