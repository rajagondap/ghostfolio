# Agentic SDLC Pipeline — Complete Guide

This document explains every phase of the 10-step AI-assisted Software Development Lifecycle (SDLC) pipeline integrated into this Ghostfolio project. The pipeline runs entirely inside **Claude Code** and takes a GitHub Issue from raw description all the way to a merged Pull Request.

---

## What is the Agentic SDLC Pipeline?

Traditional development relies on a developer reading a ticket, figuring out what to build, writing code, reviewing it manually, and opening a PR. The agentic SDLC pipeline replaces each of those mental steps with a **dedicated AI agent phase** — each one producing a structured, reviewable artifact before the next phase begins.

```
GitHub Issue
     │
     ▼
Phase 0: Classification  ──── What kind of work is this?
     │
     ▼
Phase 1: Requirements    ──── What exactly needs to be built?
     │
     ▼
Phase 2: Architecture    ──── How should it be designed?
     │
     ▼
Phase 3: Design Review   ──── Does the design hold up to scrutiny?
     │
     ▼
Phase 4: Impl Planning   ──── Step-by-step execution order
     │
     ▼
Phase 5: Implementation  ──── Write the actual code
     │
     ▼
Phase 6: Simplify        ──── Clean up and reduce complexity
     │
     ▼
Phase 7: Review          ──── Code quality, security, test coverage
     │
     ▼
Phase 8: Verification    ──── Did we build what was asked?
     │
     ▼
Phase 9: Risk Assessment ──── What could go wrong in production?
     │
     ▼
Phase 10: PR Creation    ──── Open a Pull Request with full context
```

**Key principle:** Every phase produces a **Markdown artifact** saved to `docs/artifacts/<ticket>/`. You can read, challenge, or override any artifact before the next phase begins. Nothing moves forward without your approval.

---

## How to Start the Pipeline

```
/sdlc --ticket=GH-<issue-number>
```

Example: If your GitHub Issue is #42, run `/sdlc --ticket=GH-42`.

The pipeline reads the issue, classifies it, and runs only the phases appropriate for that ticket type.

---

## Phase 0 — Ticket Classification

**What it does:** Reads your GitHub Issue and decides what _kind_ of work it represents.

**Why this matters:** A critical production bug should not go through a 10-phase design process — it needs to be fixed fast. Conversely, a major new feature must not skip architecture or you'll accumulate technical debt. Phase 0 matches the process to the work.

### The Six Ticket Types

| Type              | Description                                                                        | Phases that run                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Hotfix**        | Production is broken right now. Speed is critical.                                 | Requirements → Implementation → Review → PR                                                                        |
| **Bug**           | A defect with a known root cause, non-critical.                                    | Requirements → Implementation → Simplify → Review → Verification → PR                                              |
| **Spike**         | A time-boxed investigation to answer a technical question. No code shipped.        | Requirements → Spike Report                                                                                        |
| **Story**         | A well-understood user-facing change that doesn't need a new design.               | Requirements → Impl Planning → Implementation → Simplify → Review → PR                                             |
| **Small Feature** | A contained feature that needs a design but carries low architectural risk.        | Requirements → Architecture → QA Test Gen → Impl Planning → Implementation → Simplify → Review → Verification → PR |
| **Large Feature** | Broad impact, cross-module changes, or significant architectural decisions needed. | All 10 phases                                                                                                      |

### What you get

The pipeline shows you the classification and which phases will run, and **waits for your confirmation** before proceeding. You can override the classification if you disagree.

### Example output

```
Ticket GH-42: "Add Revolut CSV import support"
Classification: Small Feature

Phases to run:
  1. Requirements
  2. Architecture
  3b. QA Test Generation
  4. Implementation Planning
  5. Implementation
  6. Simplify
  7. Review
  8. Verification
  10. PR Creation

Confirm? (yes / override classification)
```

---

## Phase 1 — Requirements Analysis

**Artifact:** `docs/artifacts/GH-42/ph1_problem_spec.md`

**What it does:** Transforms a loosely-written GitHub Issue into a precise, numbered specification that leaves no room for ambiguity.

**Why this matters:** Developers waste enormous time building the wrong thing because requirements were vague. "Add Revolut import" could mean dozens of different things. Phase 1 forces clarity before a single line of code is written.

### What the agent does

1. Reads the full GitHub Issue — description, comments, linked issues
2. Scans the Ghostfolio codebase for related existing code (e.g., existing importers in `apps/api/src/app/import/`)
3. Runs an **interrogation loop** — asks up to 5 targeted clarifying questions before writing the spec
4. Produces a structured problem specification

### What the artifact contains

```markdown
## Requirements

REQ-001 [P0] The system shall parse Revolut CSV export files containing ...
REQ-002 [P1] The importer shall map Revolut's "BUY" transaction type to Ghostfolio's BUY activity type
REQ-003 [P2] The importer shall handle multiple currencies using Revolut's base currency field

## Acceptance Criteria

AC-001 (REQ-001) Given a valid Revolut CSV file, when imported, then all transactions appear in the activity list
AC-002 (REQ-002) Given a Revolut BUY transaction, when mapped, then it creates a BUY Order in the database

## Assumptions

ASM-001 Revolut's CSV format does not change between export versions — validation strategy: pin to tested version

## Non-Goals (explicit scope boundaries)

- This importer does NOT handle Revolut Crypto transactions (separate ticket)
- This does NOT support automatic scheduled imports (manual only)

## Edge Cases

- Empty CSV file
- CSV with unsupported transaction types
- Duplicate imports (same transaction ID)
```

### Priority levels

- **P0** — Must have. Pipeline blocks if not implemented.
- **P1** — Should have. Verified in Phase 8.
- **P2** — Nice to have. Tracked but not blocking.

---

## Phase 2 — Architecture Design

**Artifact:** `docs/artifacts/GH-42/ph2_design_spec.md`

**What it does:** Designs the technical solution — which files to create/modify, how components connect, what the data model looks like, and how the new code fits into the existing Ghostfolio architecture.

**Why this matters:** Without a design, developers make ad-hoc decisions that create inconsistency. Phase 2 ensures new code follows established patterns (e.g., Ghostfolio's data-provider pattern, NestJS module structure) and doesn't introduce circular dependencies or duplicate logic.

### What the agent does

1. Reads the requirements from Phase 1
2. Scans the codebase for **existing patterns** to follow
   - Looks at existing importers: `apps/api/src/app/import/`
   - Checks existing data providers: `apps/api/src/services/data-provider/`
   - Reads the Prisma schema: `prisma/schema.prisma`
3. Produces a design specification

### What the artifact contains

**Architecture Decision Records (ADRs)** — documented technical decisions with rationale:

```
ADR-001: Use the existing ImportService pattern rather than creating a new service
Rationale: Ghostfolio already has import infrastructure. Adding a new importer
follows the existing AbstractImportService pattern for consistency.
Decision: Extend AbstractImportService with RevolutImportService.
```

**Component Design** — every new/modified component with a unique ID:

```
COMP-001 RevolutImportService (NEW)
  Type: NestJS Service
  File: apps/api/src/app/import/revolut-import.service.ts
  Responsibility: Parse Revolut CSV and map to Ghostfolio CreateOrderDto
  Dependencies: ImportService (COMP-002), PrismaService
  Exports: importActivities(file: Express.Multer.File): Promise<Activity[]>

COMP-002 ImportService (MODIFY)
  File: apps/api/src/app/import/import.service.ts
  Change: Add RevolutImportService to the provider registry
```

**Data Flow:**

```
Revolut CSV file upload
  → ImportController (existing)
  → ImportService.detectFormat() → 'revolut'
  → RevolutImportService.parse()
  → CreateOrderDto[]
  → OrderService.createOrders()
  → Prisma Order records
```

**TypeScript Data Models:**

```typescript
interface RevolutTransaction {
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'TRANSFER';
  date: string; // 'YYYY-MM-DD HH:mm:ss'
  symbol: string; // e.g., 'AAPL'
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  currency: string; // ISO 4217
}
```

---

## Phase 3 — Design Review

**Artifact:** `docs/artifacts/GH-42/ph3_design_review.md`

**What it does:** A separate AI agent acts as a **design critic** — challenging the architecture from Phase 2 across five dimensions. This is the quality gate that catches architectural mistakes before implementation begins.

**Why this matters:** It's 10x cheaper to fix a design flaw before coding starts than after. Phase 3 simulates having a senior engineer review your design document before you write a single line.

### The Five Review Dimensions

**A — Existing Component Accuracy**
Does the design accurately describe the components it claims to use? If the design says "extend AbstractImportService" but that class doesn't actually exist in the codebase, this is caught here.

**B — Architectural Review**

- Single Responsibility Principle violations
- Circular dependencies between modules
- TypeScript type safety issues
- NestJS Dependency Injection compatibility
- Inconsistency with existing patterns

**C — Assumption Challenges**
Every `ASM-###` from Phase 1 is challenged:

```
ASM-001: "Revolut CSV format doesn't change"
Challenge: HIGH RISK — Revolut has changed CSV formats twice in 2023.
Recommended mitigation: Add a format version header check and fail fast
with a clear error message rather than silently importing corrupt data.
```

**D — Complexity Concerns**

- Over-engineering flags
- Opportunities to merge components
- Unnecessary abstraction layers

**E — Gap Analysis**

- Missing error handling (what if the CSV is malformed?)
- Missing auth checks
- Missing observability (no logging on import failures)
- Missing edge case handling from Phase 1

### Scoring and blocking

The review produces a **score out of 100** and classifies findings as:

- `critical` — **Pipeline stops.** Must be resolved before Phase 4.
- `major` — Flagged to user, recommended to fix.
- `minor` — Informational.

```
Design Review Score: 74/100

Critical findings (BLOCKING):
  [ARCH-001] No error handling for malformed CSV rows
             Fix: Wrap row parsing in try/catch, collect errors, return
             partial results with an error summary rather than throwing

Major findings:
  [ARCH-002] RevolutImportService should validate file MIME type
```

---

## Phase 3b — QA Test Generation

**Runs:** In parallel with Phase 3 for Large Features; sequentially after Phase 2 for Small Features.

**What it does:** Reads the acceptance criteria from Phase 1 and generates a complete set of **test cases** before implementation begins.

**Why this matters:** Writing tests after implementation is backwards — you end up testing what you built rather than what was specified. Phase 3b generates test cases from requirements, which then guide implementation.

### What it produces

For each Acceptance Criterion:

```
Test Case TC-001 (AC-001)
  Title: Valid Revolut CSV imports all transactions
  Type: Integration
  Precondition: User has a valid Revolut CSV export file
  Steps:
    1. Upload the CSV via POST /api/v1/import
    2. Check the response status is 201
    3. Query the activities endpoint
  Expected result: All transactions from the CSV appear as activities
  Regression candidate: YES — core import path, add to regression suite
```

For Ghostfolio, these become Jest integration tests in `apps/api/src/app/import/revolut-import.service.spec.ts`.

---

## Phase 4 — Implementation Planning

**Artifact:** `docs/artifacts/GH-42/ph4_implementation_plan.md`

**What it does:** Converts the design from Phase 2 into a **precise, ordered list of file changes** — what to create, what to modify, in what order, and how to verify each step.

**Why this matters:** Without a plan, implementation becomes chaotic — you edit files in the wrong order, break things you haven't tested yet, and lose track of what's done. Phase 4 creates a checklist that keeps implementation disciplined.

### What the artifact contains

**Ordered file list:**

```
Step 1: CREATE apps/api/src/app/import/revolut-import.service.ts
  Component: COMP-001
  Purpose: Core Revolut CSV parser
  Verify: npx nx test api --test-file revolut-import.service.spec.ts

Step 2: CREATE apps/api/src/app/import/revolut-import.service.spec.ts
  Purpose: Unit tests for the parser
  Verify: Tests pass with 0 failures

Step 3: MODIFY apps/api/src/app/import/import.module.ts
  Purpose: Register RevolutImportService as a provider
  Verify: npm run build:api -- --dry-run (no compilation errors)

Step 4: MODIFY apps/api/src/app/import/import.service.ts
  Purpose: Add 'revolut' to the format detection registry
  Verify: npx nx test api --test-file import.service.spec.ts
```

**Dependency graph (wave assignments):**

- Wave 1 (parallel-safe): Steps 1 and 2 — no dependencies on each other
- Wave 2 (after Wave 1): Steps 3 and 4 — depend on COMP-001 existing

**Acceptance Criteria coverage map:**

```
AC-001 ← Steps 1, 2, 3, 4
AC-002 ← Step 1 (type mapping logic)
AC-003 ← Step 1 (currency handling)
```

---

## Phase 5 — Implementation

**Artifact:** `docs/artifacts/GH-42/ph5_6_impl_manifest.md` + actual code changes

**What it does:** Executes the implementation plan from Phase 4 — writes the actual code, one file at a time, running the verification command after each file before moving to the next.

**Why this matters:** Batching changes across multiple files makes it impossible to isolate failures. Phase 5's discipline of one-file-at-a-time with per-step verification means if something breaks, you know exactly which file caused it.

### Iron Laws during implementation

- **Never skip a step** — every step in the plan is executed, even "trivial" ones
- **Never batch multiple files** — one file written, verify it compiles/tests pass, then next file
- **Never proceed past a failed verification** — if step 3's test fails, stop and fix before step 4
- **Never reformat unchanged code** — only the lines that need to change are touched; no whitespace-only diffs

### What the manifest tracks

```markdown
## Implementation Manifest — GH-42

Step 1: CREATE revolut-import.service.ts ✓ COMPLETE
Verification: 12 tests passing
Lines added: 187

Step 2: CREATE revolut-import.service.spec.ts ✓ COMPLETE
Verification: 12 tests passing
Lines added: 143

Step 3: MODIFY import.module.ts ✓ COMPLETE
Verification: Build succeeded
Lines changed: +3

Step 4: MODIFY import.service.ts ✓ COMPLETE
Verification: 24 tests passing
Lines changed: +8
```

### Baseline test recording

Before writing a single line, Phase 5 runs the full test suite and records the pass/fail count. After all steps are complete, it runs the suite again. Any regression (a test that passed before but fails now) is a blocker.

---

## Phase 6 — Simplify

**What it does:** Reviews only the files changed in Phase 5 and eliminates unnecessary complexity — dead code, duplicate logic, over-engineered abstractions.

**Why this matters:** First-pass implementation often leaves behind code that works but is harder to maintain than it needs to be. Phase 6 is a targeted cleanup pass that improves code quality without introducing new risk.

### What it looks for

| Issue                           | Example                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| Dead code                       | A helper function written but never called                                |
| Duplicate logic                 | The same date-parsing logic written twice                                 |
| Over-abstraction                | A factory pattern for something that only has one implementation          |
| Inconsistent naming             | `parseRow()` in one file, `processLine()` in another doing the same thing |
| Violations of existing patterns | Using `console.log` instead of Ghostfolio's logger                        |

### Scope is strictly limited

Phase 6 **only touches files that appear in the Phase 5 manifest**. It never "while I'm here" refactors unrelated code. Scope creep in a simplify pass introduces unrelated risk.

---

## Phase 7 — Review

**What it does:** Spawns **three independent AI agents in parallel**, each reviewing the implementation from a different angle. Results are aggregated into a single report.

**Why this matters:** One reviewer has blind spots. Three reviewers with different mandates catch more issues. The parallel execution means this takes no longer than a single review.

### The Three Review Agents

**Agent 1 — Code Reviewer**
Focuses on correctness and code quality:

- Logic errors and edge cases not handled
- TypeScript type safety violations (`any` usage, missing null checks)
- Naming conventions (following Ghostfolio's camelCase/PascalCase standards)
- Error handling completeness
- Performance concerns (N+1 queries, unbounded loops)

**Agent 2 — Security Auditor**
Focuses on security using OWASP Top 10:

- Input validation (is the uploaded CSV validated before parsing?)
- Path traversal risks
- Injection vulnerabilities
- Secrets exposure (no API keys in code)
- PII handling (are user financial details logged anywhere?)

**Agent 3 — Test Engineer**
Focuses on test quality:

- Coverage gaps (which branches have no test?)
- Missing edge case tests (what happens with an empty file? A file with one row? 10,000 rows?)
- Test isolation (do tests depend on each other's state?)
- Test quality (are assertions specific enough?)

### Example finding from the Security Auditor

```
[SEC-001] MAJOR — No file size limit on CSV upload
File: apps/api/src/app/import/import.controller.ts
Issue: The file upload endpoint accepts files of unlimited size.
A malicious user could upload a 1GB file and cause memory exhaustion.
Fix: Add @FileInterceptor with limits: { fileSize: 10 * 1024 * 1024 }
```

---

## Phase 8 — Verification

**Artifact:** `docs/artifacts/GH-42/ph8_verification_report.md`

**What it does:** The final correctness check — systematically verifies that everything specified in Phase 1 was actually built.

**Why this matters:** Implementation can drift from requirements. A developer might implement REQ-001 and REQ-002 but forget REQ-003 entirely, or implement AC-001 but with subtly wrong behavior. Phase 8 catches this gap.

### The Four Verification Dimensions

**1. Requirement Coverage**
Every `REQ-###` and `AC-###` from Phase 1 is mapped to a specific piece of implementation:

```
REQ-001 ✓ — Covered by RevolutImportService.parse() in revolut-import.service.ts:47
REQ-002 ✓ — Covered by mapTransactionType() in revolut-import.service.ts:89
REQ-003 ✗ — NOT COVERED — Currency handling not implemented (BLOCKING)
```

**2. Component Wiring**
Every component defined in Phase 2 is verified to:

- Exist as a real file at the specified path
- Have the specified method signatures (not just stubs)
- Be imported and used by the components that depend on it
- Be registered in the correct NestJS module

**3. Test Coverage**
Every acceptance criterion has at least one test that exercises it.

**4. Edge Case Coverage**
The edge cases listed in Phase 1 are verified to have handling in the implementation.

### Scoring and gates

```
Verification Score: 87/100

✓ Requirement Coverage: 3/3 requirements covered
✗ Component Wiring: RevolutImportService not registered in import.module.ts (BLOCKING)
✓ Test Coverage: All ACs have tests
```

- **≥80** — Passed
- **60–79** — Passed with warnings
- **<60** — Failed — pipeline stops until issues are resolved

---

## Phase 9 — Risk Assessment

**Artifact:** `docs/artifacts/GH-42/ph9_risk_assessment.md`

**What it does:** Evaluates the risks of shipping this change to production before the PR is opened.

**Why this matters:** Code that passes all tests can still be risky to ship. A database migration that runs on a table with 10 million rows, a change to a core calculation that affects all users' portfolios, or a new external API dependency — these are production risks that tests don't catch.

### Risk Categories

| Category         | What it evaluates                                           |
| ---------------- | ----------------------------------------------------------- |
| **Technical**    | Complexity, new dependencies, performance under load        |
| **Security**     | New attack surface, data exposure, auth changes             |
| **Operational**  | Deployment complexity, rollback difficulty, monitoring gaps |
| **Business**     | User-facing impact, data integrity risk                     |
| **Cross-module** | Does this change affect other parts of Ghostfolio?          |

### Risk Scoring

Each risk is scored: **Likelihood (1-5) × Impact (1-5) = Risk Score**

```
RISK-001: CSV parser memory usage on large files
  Category: Technical
  Likelihood: 3 (users may import years of history)
  Impact: 4 (could crash the API process)
  Score: 12 — HIGH
  Mitigation: Add streaming CSV parser instead of loading entire file into memory
  Status: Recommendation — address before shipping to production

RISK-002: New npm dependency (csv-parse)
  Category: Technical
  Likelihood: 2 (well-maintained package)
  Impact: 2 (only affects import feature)
  Score: 4 — LOW
  Mitigation: None required
```

### Go/No-Go recommendation

```
Risk Assessment: CONDITIONAL GO
  High risks: 1 (RISK-001 — address in follow-up ticket)
  Medium risks: 0
  Low risks: 2

Recommendation: Proceed to PR. Create follow-up GH issue for streaming
parser before this feature is used with production data volumes.
```

---

## Phase 10 — PR Creation

**What it does:** Opens a Pull Request on your GitHub fork with a complete, structured description that includes all pipeline artifacts as context.

**Why this matters:** PRs with poor descriptions slow down reviews. Reviewers don't know what was built, why, or how to test it. Phase 10 generates a PR description that gives reviewers everything they need.

### What the PR includes

**Branch name:** Created following your convention (`feature/GH-42-revolut-csv-import`)

**PR title:** `feat: add Revolut CSV import support (GH-42)`

**PR body automatically includes:**

- Summary of what was built
- Acceptance criteria coverage (which ACs are addressed)
- Test plan (how to manually verify)
- Risk summary from Phase 9
- Links to all phase artifacts
- Reviewer suggestions based on `CODEOWNERS` for touched files

```markdown
## Summary

- Adds RevolutImportService to parse Revolut CSV export files
- Maps Revolut transaction types to Ghostfolio activity types
- Handles EUR/USD/GBP multi-currency exports

## Acceptance Criteria

- [x] AC-001: Valid CSV imports all transactions
- [x] AC-002: BUY transactions map correctly
- [x] AC-003: Multi-currency handled via base currency field

## Test Plan

1. Download a Revolut CSV export from the Revolut app
2. Go to Ghostfolio → Import Data → Upload CSV
3. Verify all transactions appear in the activity list

## Risk Notes

- Large CSV files (>50MB): streaming not yet implemented — track in GH-67

## Pipeline Artifacts

- [Requirements](../docs/artifacts/GH-42/ph1_problem_spec.md)
- [Architecture](../docs/artifacts/GH-42/ph2_design_spec.md)
- [Verification Report](../docs/artifacts/GH-42/ph8_verification_report.md)
- [Risk Assessment](../docs/artifacts/GH-42/ph9_risk_assessment.md)

Closes #42
```

---

## Standalone Skills (Always Available)

These skills work outside the pipeline — any time, any branch.

### `/systematic-debugging`

**When to use:** Before attempting any fix for a bug or unexpected behavior.

Forces a structured diagnostic process:

1. Read the error carefully (don't skip past stack traces)
2. Reproduce the issue consistently
3. Check recent git changes
4. Trace the data flow back to the root cause
5. Form ONE hypothesis and test it minimally
6. Only then implement the fix

Prevents the common trap of "try this and see" debugging that creates more bugs than it fixes.

### `/writing-plans`

**When to use:** For any multi-file or multi-step task that isn't a full feature.

Creates a `.claude/plans/<task-name>.md` file with:

- Numbered steps with specific file paths
- Per-step verification commands
- Risks table
- Rollback instructions

Does NOT start executing until you approve the plan.

### `/executing-plans`

**When to use:** After approving a plan from `/writing-plans`.

Executes the plan one step at a time:

- Displays `=== Step [N/Total]: <title> ===` before each step
- Runs the step's verification command
- **Stops immediately if verification fails** — never skips to the next step
- Runs the test suite every 3 steps to catch regressions early

### `/finishing-a-development-branch`

**When to use:** When you're done implementing and about to create a PR.

Runs a pre-PR quality gate:

1. Full test suite (`npm test`)
2. Scans for `console.log`, `TODO`, `.skip()`, `.only()` in changed files
3. Checks `npm run lint` and `npm run format:check`
4. Verifies no `.env` files staged
5. Checks branch is rebased on latest `main`
6. Creates the PR with `gh pr create`

### `/session-learnings`

**When to use:** At the end of a session where Claude made repeated mistakes or needed corrections.

Scans the conversation for correction patterns and proposes minimal additions to `CLAUDE.md` so the same mistakes don't repeat in future sessions.

---

## Pipeline Commands Reference

| Command                                             | When to use                                             |
| --------------------------------------------------- | ------------------------------------------------------- |
| `/sdlc --ticket=GH-<N>`                             | Start a new pipeline run for a GitHub Issue             |
| `/sdlc --ticket=GH-<N> --resume`                    | Resume after an interruption                            |
| `/sdlc --ticket=GH-<N> --from=architecture`         | Skip to a specific phase                                |
| `/sdlc-status --ticket=GH-<N>`                      | Check which phases are done, see scores and token spend |
| `/sdlc-artifacts --ticket=GH-<N>`                   | List all artifact files produced so far                 |
| `/sdlc-blockers --ticket=GH-<N>`                    | See all critical findings that are blocking progress    |
| `/sdlc-retry --ticket=GH-<N> --phase=design-review` | Re-run a single phase after fixing a blocker            |
| `/sdlc-doctor`                                      | Validate your workspace setup before first run          |
| `/sdlc-clean --ticket=GH-<N>`                       | Delete all artifacts and start fresh                    |

---

## Where Artifacts Are Stored

```
docs/artifacts/
└── GH-42/
    ├── ph1_problem_spec.md          ← Requirements and ACs
    ├── ph2_design_spec.md           ← Architecture and component design
    ├── ph3_design_review.md         ← Design critique and score
    ├── ph4_implementation_plan.md   ← Ordered steps with verify commands
    ├── ph5_6_impl_manifest.md       ← Files touched, LOC added
    ├── ph8_verification_report.md   ← AC coverage and score
    ├── ph9_risk_assessment.md       ← Risks and go/no-go
    └── .state/
        └── pipeline_state_GH-42.json  ← Full pipeline state (phases, tokens, scores)
```

All of these are Markdown files you can read, edit, or challenge at any point. If you disagree with the requirements spec after reading it, edit it before Phase 2 starts — everything downstream depends on it.

---

## The Golden Rule

> **Every phase produces an artifact. Every artifact is reviewable. Nothing moves forward without your approval.**

The pipeline is not autonomous. It is AI-assisted. You remain in control at every phase boundary. The AI handles the mechanical parts — reading code, writing specs, generating tests, opening PRs — so you can focus on the parts that require judgment: is this the right design? Is this an acceptable risk?
