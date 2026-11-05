---
name: sdlc-checkpoint
description: >
  Use when user says "save checkpoint", "load checkpoint", "checkpoint status",
  "validate artifacts", or when sdlc-pipeline invokes at phase boundaries.
  All artifacts are Markdown files validated by required section headers.
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# SDLC Checkpoint Skill

You are managing SDLC pipeline checkpoint artifacts. Your role is to persist, retrieve, validate, and track structured phase outputs so the pipeline is resumable across context boundaries.

## Operations

### 1. save <phase> <ticket-id>

1. Determine storage location from Storage Rules table
2. Create directories: `mkdir -p docs/artifacts/<ticket-id>/.state`
3. Write the structured artifact
4. Validate required sections
5. Update `pipeline_state_<ticket>.json`: set phase status to `completed`, `completed_at` to now, `artifact_path`, `schema_valid`
6. Report saved path and schema validity

### 2. load <phase> <ticket-id>

1. Read `pipeline_state_<ticket>.json` for `artifact_path`
2. Read artifact into context
3. Validate
4. Report what was loaded

### 3. status <ticket-id>

Display current pipeline state table for the ticket.

### 4. validate <ticket-id>

Validate all artifacts against required sections.

## Storage Rules

| Phase          | Artifact File              | Location                          |
| -------------- | -------------------------- | --------------------------------- |
| requirements   | ph1_problem_spec.md        | docs/artifacts/\<ticket\>/        |
| architecture   | ph2_design_spec.md         | docs/artifacts/\<ticket\>/        |
| design-review  | ph3_design_review.md       | docs/artifacts/\<ticket\>/        |
| impl-planning  | ph4_implementation_plan.md | docs/artifacts/\<ticket\>/        |
| implementation | ph5_6_impl_manifest.md     | docs/artifacts/\<ticket\>/        |
| implementation | impl_state.json            | docs/artifacts/\<ticket\>/.state/ |
| verification   | ph8_verification_report.md | docs/artifacts/\<ticket\>/        |
| risk           | ph9_risk_assessment.md     | docs/artifacts/\<ticket\>/        |

## Required Sections Validation

1. **ph1_problem_spec.md** — `## Meta`, `## Problem Statement`, `## Requirements`, `## Acceptance Criteria`, `## Constraints`, `## Non-Goals`, `## Assumptions`, `## Edge Cases`, `## Backward Compatibility`, `## Glossary`
2. **ph2_design_spec.md** — `## Meta`, `## Problem Spec Reference`, `## Current Architecture`, `## Architecture`, `## API Contracts`, `## Data Models`, `## Decisions (ADRs)`, `## Implementation Guidelines`, `## Testing Strategy`, `## Security Considerations`
3. **ph3_design_review.md** — `## Meta`, `## Summary`, `## Findings`, `## Sign-Off`
4. **ph4_implementation_plan.md** — `## Implementation Steps`, `## Pipeline Continuation`, `## Pre-Implementation Baseline`
5. **ph5_6_impl_manifest.md** — `## Summary`, `## Baseline Test Counts`, `## Final Test Counts`, `## Files Created`, `## Files Modified`, `## Test Files`, `## Simplification`
6. **ph8_verification_report.md** — `## Meta`, `## Summary`, `## Requirement Coverage`, `## Test Results`, `## Recommendations`
7. **ph9_risk_assessment.md** — `## Meta`, `## Summary`, `## Failure Modes`, `## Sign-Off`

Validation failure → report missing sections, still save, mark `schema_valid: false`.
