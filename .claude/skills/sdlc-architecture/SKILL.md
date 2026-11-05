---
name: sdlc-architecture
description: >
  Phase 2 of the SDLC pipeline. Reads the problem spec, analyses the Ghostfolio
  codebase, and produces a complete technical design (ph2_design_spec.md).
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Bash
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 2 — Architecture

## Client Context (read at runtime)

| File                           | How to use                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `client-kb.md`                 | Read fully. Apply Ghostfolio tech stack, NestJS patterns, Angular patterns, Prisma conventions. |
| `client-notes/architecture.md` | Read fully. Apply Ghostfolio-specific architecture patterns and constraints.                    |

---

## Purpose

Design component structure, data flows, API contracts, and data models based on approved requirements. Produce `ph2_design_spec.md` without writing any code.

---

## Iron Laws

- **NEVER WRITE CODE IN `ph2_design_spec.md`** — describe interfaces, not implementations.
- **NEVER DESIGN WITHOUT READING THE CODEBASE FIRST.**
- **NEVER PROPOSE A NEW DEPENDENCY WITHOUT AN ADR.**
- **NEVER ASSIGN A FILE PATH AS "somewhere in src/"** — every path must be exact.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Key Ghostfolio Architecture Rules

Before designing anything, internalize these from `client-notes/architecture.md` and `client-kb.md`:

1. **NestJS module pattern**: Every new feature needs `<feature>.module.ts`, `<feature>.service.ts`, registered in the module's `providers[]`
2. **Path aliases always**: `@ghostfolio/common`, `@ghostfolio/api/*` — never `../../..` relative imports
3. **Prisma ORM**: Never write raw SQL. New models need: schema change + migration + regenerate typings
4. **Angular standalone components**: Ghostfolio migrating to standalone — prefer standalone
5. **Never use TypeScript `!` on injected properties** — breaks NestJS DI

---

## Process

Follow the Architecture contract phases 1-10:

- Load problem spec
- Analyse codebase (check `.codebase-index/repo-map.md` first if it exists)
- Document current architecture
- Select architecture pattern (consistent with existing codebase)
- Design components with COMP-### IDs and exact file paths
- Define data flows
- Define API contracts
- Define data models (check `prisma/schema.prisma` for existing models)
- Write ADRs (minimum 1: architecture pattern selection)
- Write implementation guidelines

Write output to `docs/artifacts/<ticket>/ph2_design_spec.md`.

Update `pipeline_state_<ticket>.json` → `phases.architecture.status = "completed"`.

---

## Exit Criteria

- [ ] Every REQ-### addressed by at least one component
- [ ] Every component has unique COMP-### ID and exact file path
- [ ] Every new library has a corresponding ADR with 2+ alternatives
- [ ] `ph2_design_spec.md` written with all required sections
- [ ] `pipeline_state_<ticket>.json` → `phases.architecture.status = "completed"`
