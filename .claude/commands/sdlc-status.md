Show the current status of an SDLC pipeline run — phases completed, scores, blocking findings, and token spend so far.

Arguments: $ARGUMENTS

**Usage:** `--ticket=TICKET-ID`

Read `docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json` and `docs/artifacts/<ticket>/.state/artifact-digest.md` and produce a status report in this format:

```
SDLC Status — <TICKET-ID>
══════════════════════════════════════════════════════════════
Ticket:   <TICKET-ID>
Type:     <classification>
Progress: <N>/<total> phases complete

Phase Results:
  ✓ Phase 0 — Classification       completed
  ✓ Phase 1 — Requirements         completed
  ✓ Phase 2 — Architecture         completed
  ✗ Phase 3 — Design Review        BLOCKED (2 critical findings)
  — Phase 4 — Impl Planning        not started
  — Phase 5 — Implementation       not started
  ...

Blocking Findings:
  [ARCH-001] critical — <title> (Design Review)
  [ARCH-002] critical — <title> (Design Review)

Scores:
  Design Review:   <score>/100
  Verification:    <score>/100  (if run)

Token Spend (so far):
  Input:        <N>
  Output:       <N>
  Cache read:   <N>
  Estimated cost: $<N>

Artifacts:
  docs/artifacts/<ticket>/ph1_problem_spec.md      ✓
  docs/artifacts/<ticket>/ph2_design_spec.md       ✓
  docs/artifacts/<ticket>/ph3_design_review.md     ✓
  docs/artifacts/<ticket>/ph4_implementation_plan.md  —
```

If `pipeline_state_<ticket>.json` does not exist, report: "No pipeline run found for <TICKET-ID>. Start with: /sdlc --ticket=<TICKET-ID>"
