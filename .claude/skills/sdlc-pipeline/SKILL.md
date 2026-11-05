---
name: sdlc-pipeline
description: >
  Use when user says "run sdlc pipeline", "start pipeline", "full feature workflow",
  invokes /sdlc command, or needs full feature lifecycle orchestration.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - Skill
  - AskUserQuestion
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# SDLC Pipeline Orchestrator — Ghostfolio

You are the pipeline conductor for the Ghostfolio project. Chain phase skills together in sequence, manage checkpoints, enforce iteration limits, and handle gated flow control. You do NOT implement any phase methodology — delegate to specialized skills.

## Arguments

| Argument             | Required | Description                                   |
| -------------------- | -------- | --------------------------------------------- |
| `--ticket=TICKET-ID` | Yes      | GitHub Issue ID in GH-NNN format (e.g., GH-3) |
| `--resume`           | No       | Restart from last saved checkpoint            |
| `--from=<phase>`     | No       | Start from a specific phase                   |
| `--waves`            | No       | Force wave-based parallel execution           |
| `--rebuild-index`    | No       | Force rebuild of codebase index               |

## Ticket ID Format

Ghostfolio uses GitHub Issues. The ticket ID format is `GH-NNN` (e.g., `GH-3`).

The pipeline state file is `pipeline_state_GH-3.json`.

## Validation and Directory Setup

1. `--ticket` must match `GH-[0-9]+`. If invalid, stop and report.

2. Capture workspace root and create ticket directory:

   ```bash
   PROJECT_ROOT=$(python -c "
   import os, sys
   d = os.getcwd()
   while d != os.path.dirname(d):
       if os.path.isdir(os.path.join(d, 'docs')):
           print(d); sys.exit()
       d = os.path.dirname(d)
   print(os.getcwd())
   ")
   mkdir -p "$PROJECT_ROOT/docs/artifacts/<ticket>/.state"
   ```

3. `--resume` requires `pipeline_state_<ticket>.json` to exist

## Iron Laws

- NEVER INLINE PHASE LOGIC — always invoke phases via the Skill tool.
- NEVER WRITE `ph1_problem_spec.md` YOURSELF — only `sdlc-requirements` may produce it.
- NEVER PROCEED PAST A "reject" DESIGN REVIEW — feed findings back to `sdlc-architecture`.
- NEVER SKIP PHASE 10 (PR CREATION) — the pipeline ends at the PR URL, not the risk score.
- NEVER CONTINUE INLINE TO THE NEXT PHASE — every phase ends with STOP. User resumes with `--resume`.
- NEVER OUTPUT TEXT AFTER A SKILL RETURNS BEFORE RUNNING `date`.
- NEVER LEAVE `tokens_used` AS NULL AFTER A PHASE COMPLETES.
- NEVER WRITE PIPELINE STATE FROM AN IN-MEMORY COPY — re-read from disk first every time.
- NEVER PRESENT A GATE WITHOUT RECORDING gate_history FIRST.

## Phase Definitions

| Phase              | Skill                      | Artifact                   |
| ------------------ | -------------------------- | -------------------------- |
| classification     | sdlc-ticket-classification | pipeline_state initialised |
| requirements       | sdlc-requirements          | ph1_problem_spec.md        |
| architecture       | sdlc-architecture          | ph2_design_spec.md         |
| design-review      | sdlc-design-review         | ph3_design_review.md       |
| qa-test-generation | sdlc-qa-test-generation    | ph3b_qa_test_plan.md       |
| impl-planning      | sdlc-impl-planning         | ph4_implementation_plan.md |
| implementation     | (inline — this skill)      | ph5_6_impl_manifest.md     |
| simplify           | sdlc-simplify              | (appends to manifest)      |
| review             | sdlc-review                | (findings in context)      |
| verification       | sdlc-verification          | ph8_verification_report.md |
| risk-assessment    | sdlc-risk                  | ph9_risk_assessment.md     |
| pr-creation        | sdlc-pr-creation           | PR URL                     |

## Critical Path — Execute for Each Phase

**Before invoking each phase:**

1. LOC boundary flush (if resuming — write accumulated LOC to pipeline_state)

2. Write `.claude/active-ticket`:

   ```bash
   python -c "
   import json, os
   from pathlib import Path
   d = os.getcwd()
   while d != os.path.dirname(d):
       if os.path.isdir(os.path.join(d, 'docs')):
           break
       d = os.path.dirname(d)
   Path(d, '.claude', 'active-ticket').write_text(json.dumps({'ticket_id': '<ticket>', 'phase': '<phase-name>'}))
   "
   ```

3. Capture `started_at`:

   ```bash
   STARTED_AT=$(date '+%Y-%m-%dT%H:%M:%S.000%z')
   ```

4. Update `pipeline_state_<ticket>.json` — set phase status to `in_progress`:

   ```bash
   python -c "
   import json
   from pathlib import Path
   state_path = Path('docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json')
   if state_path.exists():
       state = json.loads(state_path.read_text())
       if '<phase>' in state.get('phases', {}):
           state['phases']['<phase>']['status'] = 'in_progress'
           state['phases']['<phase>']['started_at'] = '<STARTED_AT>'
           state['current_phase'] = '<phase>'
           state['updated_at'] = '<STARTED_AT>'
           state_path.write_text(json.dumps(state, indent=2))
   "
   ```

5. Invoke the phase skill:

   ```
   Skill("<skill-name>", args="--ticket=<ticket>")
   ```

6. IMMEDIATELY after Skill returns, capture `completed_at`:

   ```bash
   COMPLETED_AT=$(date '+%Y-%m-%dT%H:%M:%S.000%z')
   ```

7. Re-read `pipeline_state_<ticket>.json` from disk and update phase to `completed`:

   ```bash
   python -c "
   import json
   from pathlib import Path
   state_path = Path('docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json')
   state = json.loads(state_path.read_text())
   phase = state['phases'].get('<phase>', {})
   phase.update({'status': 'completed', 'completed_at': '<COMPLETED_AT>'})
   state['updated_at'] = '<COMPLETED_AT>'
   state_path.write_text(json.dumps(state, indent=2))
   "
   ```

8. Post comment on GitHub Issue:

   ```bash
   ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
   gh issue comment "$ISSUE_NUM" --repo rajagondap/ghostfolio --body "**[Phase N — Name]: completed**

   Brief summary of what was produced.

   Artifact: docs/artifacts/<ticket>/<artifact-file>"
   ```

9. Present gate to user via `AskUserQuestion` for approval.

10. On approval: save checkpoint, print resume command, **STOP**.

## Fresh Run (no --resume, no --from)

1. Run classification:

   ```
   Skill("sdlc-ticket-classification", args="--ticket=<ticket>")
   ```

2. After classification returns, read `pipeline_state_<ticket>.json` to get confirmed `phase_set`.

3. For each phase in `phase_set`, execute the Critical Path above.

## Resume Run (--resume)

1. Read `pipeline_state_<ticket>.json`.
2. Find the first phase with status ≠ `completed`.
3. Resume from that phase.

## --from Run

1. Read `pipeline_state_<ticket>.json` to get `phase_set`.
2. Find the specified phase in `phase_set`.
3. Start from that phase.

## Loop Limits

| Loop                         | Max Iterations |
| ---------------------------- | -------------- |
| Design Review → Architecture | 3              |
| Spec Review → Implementation | 2              |
| Risk → Implementation        | 3              |
| Risk → Architecture          | 2              |

When a loop limit is reached: halt with reason, set `phases.<phase>.halt_reason`.

## Pipeline Completion

After `pr-creation` completes:

1. Set `pipeline_state_<ticket>.json` → `completed_at` and `total_duration_ms`
2. Remove `.claude/active-ticket`
3. Display:
   ```
   Pipeline Complete — <TICKET-ID>

   All phases completed. PR created: <PR_URL>

   Artifacts:
     docs/artifacts/<ticket>/ph1_problem_spec.md
     docs/artifacts/<ticket>/ph2_design_spec.md
     ...
   ```
