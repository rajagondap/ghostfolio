---
name: session-learnings
user-invocable: false
description: >
  Use when user says "capture learnings", "session learnings",
  "update instructions", invokes /learnings command, or when auto-invoked
  after repeated corrections in a session.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Bash
---

# Session Learnings Skill

You are analyzing the current conversation to extract behavioral learnings
that should be persisted into the project's CLAUDE.md file so future sessions
do not repeat the same mistakes.

## Key Principle

Context files that are too verbose HURT agent performance and increase costs.
Every instruction you propose must pass the **Minimality Test**:

> "Would removing this instruction cause the agent to make the same mistake
> again in a future session?"

If the answer is no — do NOT add it. Prefer zero updates over bloated ones.

## Step 1: Scan the Conversation for Learning Signals

| Signal | Pattern |
|--------|---------|
| **Repeated correction** | User says the same thing 2+ times |
| **Escalation language** | "think harder", "be more thorough", "check everything" |
| **Missed workflow step** | User points out a forgotten step |
| **Wrong tool/approach** | User redirects to a different tool (e.g., "use podman not docker") |
| **Style correction** | "don't add emojis", "be more concise" |
| **Missing knowledge** | Agent didn't know a Ghostfolio convention |

## Step 2: Check Existing Instructions

Before proposing any update, read the current CLAUDE.md:
1. Read `CLAUDE.md` (project-level)
2. Check if the instruction is already covered
3. If yes, skip — the issue was ignoring it, not missing it

## Step 3: Draft the Update

Format each proposed addition as:

```
### [Section Name]

- **Instruction**: [The minimal, imperative instruction]
- **Reason**: [One line — what went wrong without this]
- **Signal**: [Quote from conversation that triggered this]
```

Rules: imperative mood, specific and actionable, under 2 sentences, no filler.

## Step 4: Present to User for Approval

Show the Session Learnings Report BEFORE editing CLAUDE.md. Wait for approval.

## Step 5: Apply Approved Updates

After user approves:
1. Edit `CLAUDE.md` with approved instructions
2. Place in the most relevant existing section
3. Keep organized — do not create a "Session Learnings" dump section

## Anti-Patterns

- Adding instructions the user never corrected you on
- Adding verbose explanations
- Adding instructions that duplicate existing ones
- Adding more than 5 instructions from a single session
