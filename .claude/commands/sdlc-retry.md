Rerun a single pipeline phase for a ticket without executing the full pipeline.

Arguments: $ARGUMENTS

**IMPORTANT:** Do NOT attempt to read or locate skill files. Instead, use the `Skill` tool to invoke skills by name.

**Usage:** `--ticket=TICKET-ID --phase=PHASE-NAME`

Valid phase names: `classification`, `requirements`, `architecture`, `design-review`, `qa-test-generation`, `impl-planning`, `implementation`, `simplify`, `review`, `verification`, `risk`, `pr`

Before retrying, invoke the `sdlc-pipeline` skill with the `--from` flag set to the requested phase and `--to` set to the same phase so only that phase runs:

```
Skill: sdlc-pipeline
Args: --ticket=<ticket> --from=<phase> --to=<phase>
```

**Pre-retry checks (run before invoking the skill):**

1. Verify `docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json` exists. If not: report "No pipeline run found for <TICKET-ID> — run /sdlc --ticket=<TICKET-ID> first."
2. Verify the prerequisite artifacts for the requested phase exist:

| Phase | Required artifacts |
|-------|--------------------|
| architecture | ph1_problem_spec.md |
| design-review | ph2_design_spec.md |
| impl-planning | ph2_design_spec.md, ph3_design_review.md (if Large Feature) |
| implementation | ph4_implementation_plan.md |
| simplify | ph5_6_impl_manifest.md |
| review | ph5_6_impl_manifest.md |
| verification | ph5_6_impl_manifest.md |
| risk | ph8_verification_report.md |
| pr | ph8_verification_report.md |

If a required artifact is missing, report which artifact is missing and which phase produces it.

3. Warn the user that retrying will overwrite the existing artifact for this phase. Wait for confirmation before proceeding.
