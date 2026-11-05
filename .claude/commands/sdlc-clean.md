Remove all pipeline artifacts for a ticket. Use when starting a ticket fresh after a botched run, or when artifacts are stale and need to be regenerated from scratch.

Arguments: $ARGUMENTS

**Usage:** `--ticket=TICKET-ID`

Extract the ticket ID from `$ARGUMENTS`.

**Step 1 — Verify artifacts exist**

Check that `docs/artifacts/<ticket>/` exists. If not: report "No artifacts found for <TICKET-ID> — nothing to clean."

**Step 2 — Show what will be deleted**

List all files that will be removed:

```
The following artifacts will be permanently deleted for <TICKET-ID>:

  docs/artifacts/<ticket>/ph1_problem_spec.md
  docs/artifacts/<ticket>/ph2_design_spec.md
  docs/artifacts/<ticket>/ph3_design_review.md
  docs/artifacts/<ticket>/ph4_implementation_plan.md
  docs/artifacts/<ticket>/ph5_6_impl_manifest.md
  docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json
  docs/artifacts/<ticket>/.state/artifact-digest.md
  ... (N files total)

This cannot be undone. Type "yes" to confirm or anything else to cancel.
```

**Step 3 — Wait for explicit confirmation**

Do NOT proceed without the user typing "yes". Any other response cancels the operation.

**Step 4 — Delete artifacts**

After confirmation, remove the directory. On Windows use PowerShell:

```powershell
Remove-Item -Recurse -Force docs/artifacts/<ticket>/
```

On Unix:
```bash
rm -rf docs/artifacts/<ticket>/
```

**Step 5 — Report**

```
Cleaned: docs/artifacts/<ticket>/ — <N> files removed.
To start fresh: /sdlc --ticket=<TICKET-ID>
```

**Optional flag: `--phase=PHASE-NAME`**

If `--phase` is provided, delete only the artifact for that phase:

| Phase | File deleted |
|-------|-------------|
| requirements | ph1_problem_spec.md |
| architecture | ph2_design_spec.md |
| design-review | ph3_design_review.md |
| impl-planning | ph4_implementation_plan.md |
| implementation | ph5_6_impl_manifest.md |
| verification | ph8_verification_report.md |
| risk | ph9_risk_assessment.md |

Also resets the corresponding phase entry in `pipeline_state_<ticket>.json` to `not_started`.
