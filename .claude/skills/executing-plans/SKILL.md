---
name: executing-plans
user-invocable: false
description: >
  Use when a written plan exists at .claude/plans/ and the user says "execute the plan",
  "start the plan", "run the plan", or approves a plan for execution.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - PowerShell
---

# Executing Plans

You are executing a previously written implementation plan. Follow it step by step, verify after each step, and never skip ahead.

## Iron Laws

- NEVER SKIP A STEP — execute in order, every time.
- NEVER PROCEED PAST A FAILED VERIFICATION — fix or stop.
- NEVER MODIFY THE PLAN WITHOUT TELLING THE USER — if a step needs changing, say so first.
- NEVER BATCH MULTIPLE STEPS — one at a time, verify, then next.

---

## Process

### Step 1: Load the Plan

1. Read the plan file from `.claude/plans/<task-name>.md`
2. Count total steps
3. Display: "Executing plan: <name> — <N> steps total"

### Step 2: Execute Each Step

For each step in order:

```
=== Step [N/Total]: <Step Title> ===
Action: <what this step does>
Files: <paths being touched>
```

1. **Execute** the action described in the step
2. **Verify** using the step's verification method
3. **Report** the result:
   - Pass: "Step [N] complete. Verification passed."
   - Fail: "Step [N] FAILED. <error details>. Stopping execution."

### Step 3: Handle Failures

When a step's verification fails:
1. **Stop immediately** — do not attempt the next step
2. **Diagnose** — read the error, trace the cause
3. **Options** (present to user): Fix and retry / Modify the plan / Rollback / Stop

### Step 4: Handle Plan Modifications

If you discover the plan needs adjustment during execution:
1. **Stop** at the current step
2. **Explain** what changed and why
3. **Propose** the modified steps
4. **Wait** for user approval before continuing

Never silently deviate from the plan.

### Step 5: Completion

After all steps pass:
1. Run the plan's final verification checklist
2. Report results
3. If any verification items fail, report and ask user how to proceed

---

## Progress Tracking

```
Step 1: [done] <title>
Step 2: [done] <title>
Step 3: [current] <title>
Step 4: [pending] <title>
```

If the user says "resume the plan", start from the first non-done step.

---

## Checkpoint Discipline

After every 3 completed steps (or any step that modifies multiple files):
- Run `npm test` to verify no regressions
- If regressions found: stop and report before continuing

---

## Integration

**UPSTREAM:** This skill expects a plan written by `writing-plans` at `.claude/plans/<task-name>.md`.

**DOWNSTREAM:** After execution completes, if the task involved code changes, consider invoking `finishing-a-development-branch` to verify readiness for PR.
