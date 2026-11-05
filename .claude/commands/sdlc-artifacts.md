List all artifact files for a ticket with a one-line summary of each.

Arguments: $ARGUMENTS

**Usage:** `--ticket=TICKET-ID`

Extract the ticket ID from `$ARGUMENTS`. List all files under `docs/artifacts/<ticket>/` and produce a structured summary:

1. Use Glob to find all `.md` and `.json` files under `docs/artifacts/<ticket>/`.
2. For each artifact file, read the first meaningful heading or summary line (skip frontmatter and blank lines).
3. Output in this format:

```
Artifacts — <TICKET-ID>
══════════════════════════════════════════════════════════════

Phase Artifacts:
  ph1_problem_spec.md         Requirements and acceptance criteria
  ph2_design_spec.md          Architecture and component design
  ph3_design_review.md        Design review — score: <N>/100
  ph4_implementation_plan.md  <N> steps, <M> new files, <K> modified
  ph5_6_impl_manifest.md      Implementation manifest — <N> files touched
  ph8_verification_report.md  Verification — score: <N>/100, status: <passed|failed>
  ph9_risk_assessment.md      Risk assessment — <low|medium|high>

State Files (.state/):
  pipeline_state_<ticket>.json   Pipeline state — phase <N> of <total>
  artifact-digest.md             Codebase scan and phase summaries
  impl_state.json                Implementation progress tracker

Total: <N> artifact files
```

If `docs/artifacts/<ticket>/` does not exist, report: "No artifacts found for <TICKET-ID>."
