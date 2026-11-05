# Ghostfolio — AI PDLC/SDLC & STLC User Manual

> **This document records every step taken to set up and operate the Agentic AI Software Development and Testing Lifecycle for the Ghostfolio project. Use it as your reference guide for everything done, why it was done, and how to repeat or extend it.**

---

## Table of Contents

1. [What We Built](#1-what-we-built)
2. [Infrastructure Setup](#2-infrastructure-setup)
3. [Repository Setup](#3-repository-setup)
4. [SDLC Template Integration](#4-sdlc-template-integration)
5. [Onboarding Wizard & Intake](#5-onboarding-wizard--intake)
6. [Preflight — What It Does & What We Did](#6-preflight--what-it-does--what-we-did)
7. [Skills Deployment](#7-skills-deployment)
8. [GitHub Issues Created](#8-github-issues-created)
9. [QA Automation Repo (STLC)](#9-qa-automation-repo-stlc)
10. [Docker/Podman Test Environment](#10-dockerpodman-test-environment)
11. [Running the SDLC Pipeline](#11-running-the-sdlc-pipeline)
12. [Running the STLC Pipeline](#12-running-the-stlc-pipeline)
13. [Complete File Map](#13-complete-file-map)
14. [Quick Reference Commands](#14-quick-reference-commands)

---

## 1. What We Built

We integrated an **Agentic AI PDLC/SDLC pipeline** into the Ghostfolio personal finance project. The pipeline:

- Reads a GitHub Issue
- Automatically produces requirements, architecture, test cases, implementation plan, code, code review, verification, and a Pull Request
- Uses Claude Code as the AI engine
- Runs entirely inside your terminal — no external services needed beyond GitHub

We also built a companion **Agentic AI STLC (Software Testing Lifecycle) pipeline** in a separate repo that generates Playwright E2E automation tests from the same GitHub Issues.

```
GitHub Issue
    │
    ├── /sdlc --ticket=GH-N  → 10-phase SDLC → Pull Request (ghostfolio)
    │
    └── /stlc --ticket=GH-N  → 7-phase STLC → Test PR (ghostfolio-qa-automation)
```

---

## 2. Infrastructure Setup

### What was verified / installed

| Tool             | Version       | Status | Notes                                            |
| ---------------- | ------------- | ------ | ------------------------------------------------ |
| Node.js          | v24.14.0      | ✅     | Required ≥22.22.3                                |
| npm              | v11.9.0       | ✅     |                                                  |
| Python           | v3.11.9       | ✅     | Available as `python` (not `python3`) on Windows |
| Podman           | v5.8.3        | ✅     | Docker substitute                                |
| `podman compose` | v5.6.0        | ✅     | Via docker-compose.exe delegate                  |
| Git              | v2.53.0       | ✅     |                                                  |
| `gh` CLI         | authenticated | ✅     | Logged in as `rajagondap` with `repo` scope      |
| OpenSSL          | not in PATH   | ⚠️     | Needed only for SSL certs for local Angular dev  |

### Starting the application

The Ghostfolio app runs as three Podman containers:

```powershell
podman compose -f docker/docker-compose.yml up -d
```

| Container     | Purpose                | Port             |
| ------------- | ---------------------- | ---------------- |
| `gf-postgres` | PostgreSQL 15 database | internal         |
| `gf-redis`    | Redis cache            | internal         |
| `ghostfolio`  | Ghostfolio app         | `localhost:3333` |

**Verify health:**

```powershell
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### npm install

```powershell
cd C:\EPAM_AI_Initiatives\ghostfolio
npm install
```

Required for: running local dev server, running tests, using Nx CLI tools.

---

## 3. Repository Setup

### Main application repo

- **Original upstream:** `https://github.com/ghostfolio/ghostfolio`
- **Your fork:** `https://github.com/rajagondap/ghostfolio`
- **Local path:** `C:\EPAM_AI_Initiatives\ghostfolio`

**Remotes:**

```
origin   → https://github.com/rajagondap/ghostfolio.git   (your fork — push here)
upstream → https://github.com/ghostfolio/ghostfolio.git   (original — pull updates from here)
```

**Why fork?** The SDLC pipeline creates branches and PRs on your repo. You can't push to the original Ghostfolio repo. Forking gives you full control.

**How the fork was created:**

```bash
gh repo fork ghostfolio/ghostfolio --clone=false
git remote add upstream https://github.com/ghostfolio/ghostfolio.git
git remote set-url origin https://github.com/rajagondap/ghostfolio.git
git push origin main --force
```

### QA Automation repo

- **Repo:** `https://github.com/rajagondap/ghostfolio-qa-automation` (private)
- **Local path:** `C:\EPAM_AI_Initiatives\ghostfolio-qa-automation`

Created fresh — not a fork.

---

## 4. SDLC Template Integration

### What the template is

The SDLC template at `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template` is a **generator** — a factory that produces client-specific AI pipeline skills for your project.

```
claude-sdlc-plugin-template/   ← FACTORY (generator)
        │
        │  fills intake form → runs preflight → generates skills
        ▼
ghostfolio/.claude/skills/     ← DEPLOYED (runs here)
```

### What was copied into Ghostfolio

Everything under `ghostfolio/.claude/`:

```
.claude/
├── settings.json              ← Hook registrations (approved 2026-11-06)
├── codebase-index-config.json ← Excludes node_modules, dist, coverage, .nx, tmp
├── commands/                  ← 7 SDLC slash commands
│   ├── sdlc.md                ← /sdlc --ticket=GH-N
│   ├── sdlc-status.md         ← /sdlc-status --ticket=GH-N
│   ├── sdlc-artifacts.md      ← /sdlc-artifacts --ticket=GH-N
│   ├── sdlc-retry.md          ← /sdlc-retry --ticket=GH-N --phase=X
│   ├── sdlc-blockers.md       ← /sdlc-blockers --ticket=GH-N
│   ├── sdlc-doctor.md         ← /sdlc-doctor
│   └── sdlc-clean.md          ← /sdlc-clean --ticket=GH-N
├── hooks/                     ← 6 Python guardrail + telemetry hooks
│   ├── eslint-on-save.py      ← Auto ESLint on every TS/JS file write
│   ├── guard-destructive-commands.py  ← Blocks rm -rf, mkfs, dd
│   ├── guard-env-files.py     ← Blocks .env writes
│   ├── ensure-workspace-index.py  ← Index freshness before pipeline
│   ├── track-loc-changes.py   ← LOC tracking per pipeline phase
│   └── track-token-usage.py   ← Token/LOC flush at session end
├── skills/
│   ├── sdlc-pipeline/         ← Pipeline orchestrator
│   ├── sdlc-ticket-classification/ ← Phase 0
│   ├── sdlc-requirements/     ← Phase 1
│   ├── sdlc-architecture/     ← Phase 2
│   ├── sdlc-design-review/    ← Phase 3
│   ├── sdlc-qa-test-generation/ ← Phase 3b
│   ├── sdlc-impl-planning/    ← Phase 4
│   ├── sdlc-implementation/   ← Phase 5
│   ├── sdlc-simplify/         ← Phase 6
│   ├── sdlc-review/           ← Phase 7
│   ├── sdlc-code-review/      ← Phase 7 sub-agent
│   ├── sdlc-security-scan/    ← Phase 7 sub-agent
│   ├── sdlc-generate-tests/   ← Phase 7 sub-agent
│   ├── sdlc-verification/     ← Phase 8
│   ├── sdlc-risk/             ← Phase 9
│   ├── sdlc-pr-creation/      ← Phase 10
│   ├── sdlc-checkpoint/       ← Resume support
│   ├── sdlc-build-codebase-index/ ← Codebase indexer
│   ├── systematic-debugging/  ← Standalone: debug before fixing
│   ├── writing-plans/         ← Standalone: multi-step task planning
│   ├── executing-plans/       ← Standalone: step-by-step execution
│   ├── finishing-a-development-branch/ ← Standalone: pre-PR gate
│   └── session-learnings/     ← Standalone: capture session insights
└── config/
    ├── execution_phases.json  ← Phase sets per ticket type
    └── pipeline-models.json   ← Model assignments per phase
```

### Other files added to Ghostfolio

| File                                 | Purpose                                      |
| ------------------------------------ | -------------------------------------------- |
| `CLAUDE.md`                          | Project instructions for Claude Code         |
| `docs/intake-sources.md`             | Ghostfolio project profile for the pipeline  |
| `docs/SDLC-PIPELINE.md`              | Detailed explanation of all 10 phases        |
| `docs/AI-SDLC-MENTOR-GUIDE.md`       | Complete mentor guide for AI PDLC/SDLC       |
| `docs/client-onboarding-wizard.html` | Browser-based intake wizard                  |
| `docs/artifacts/`                    | Pipeline artifacts directory (gitignored)    |
| `docker/docker-compose.test.yml`     | Test environment for SDLC verification phase |
| `.env.test`                          | Test environment variables (gitignored)      |

---

## 5. Onboarding Wizard & Intake

### What the wizard is

`docs/client-onboarding-wizard.html` — a self-contained HTML form you open in your browser. It collects everything the AI needs to know about your project in a structured way.

**How to open it:**

```
File: C:\EPAM_AI_Initiatives\ghostfolio\docs\client-onboarding-wizard.html
Open in: any browser (Chrome, Edge, Firefox)
No server needed.
```

### What the wizard captures

| Section                   | What you fill in                                                       |
| ------------------------- | ---------------------------------------------------------------------- |
| Step 1: Engagement        | Company, industry, compliance, AI tools, LLM models                    |
| Step 2: Knowledge Sources | Confluence URLs, documentation links                                   |
| Step 3: SDLC Tools        | ALM system (GitHub Issues), SCM (GitHub), auth strategy, branch naming |
| Step 4: Integrations      | Feature flags, APM, test management, CI/CD                             |

**For Ghostfolio, the answers are:**

| Field          | Value                        |
| -------------- | ---------------------------- |
| Company        | Ghostfolio                   |
| Industry       | BFSI (Personal Finance)      |
| Compliance     | None                         |
| AI tools       | Claude Code                  |
| ALM System     | GitHub Issues                |
| Auth           | gh-cli                       |
| GitHub org     | rajagondap                   |
| Repo           | ghostfolio                   |
| SCM            | GitHub (gh-cli)              |
| Default branch | main                         |
| Branch naming  | `<type>/<short-description>` |
| Feature Flags  | None                         |
| APM            | None                         |
| Test Mgmt      | None                         |

**After filling the wizard:** Click "Copy to Clipboard" and save to:

- `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\docs\intake-sources.md`
- `C:\EPAM_AI_Initiatives\ghostfolio\docs\intake-sources.md`

---

## 6. Preflight — What It Does & What We Did

### What preflight is

Preflight is the 10-step automated setup that runs in the template directory. It validates your tools, installs MCP servers if needed, writes config files, installs hooks, and generates all the skills.

**Run it from:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template`

```
claude
/preflight
```

### What each step does and our status

| Step | What it does                                           | Our Status                                 |
| ---- | ------------------------------------------------------ | ------------------------------------------ |
| 0    | Read `intake-sources.md`                               | ✅ Written manually                        |
| 1    | Check prerequisites (Node, Python, gh CLI, Claude CLI) | ✅ All present                             |
| 2    | Confirm detected tools with user                       | ✅ GitHub Issues + gh-cli                  |
| 3    | Collect auth strategies                                | ✅ gh-cli for both                         |
| 4    | Collect non-sensitive config (org, repo, branch)       | ✅ rajagondap / ghostfolio / main          |
| 5    | Install MCP servers                                    | ✅ None needed (gh-cli handles everything) |
| 6    | Add `.claude/` to `.gitignore`                         | ✅ Pipeline state files gitignored         |
| 7    | OAuth authentication                                   | ✅ Skipped (gh-cli, not OAuth)             |
| 8    | Write `pipeline-config.json` + `.env.template`         | ✅ Written in template dir                 |
| 8b   | Install Claude Code hooks                              | ✅ 6 hooks registered in `settings.json`   |
| 8c   | Configure codebase index exclusions                    | ✅ `codebase-index-config.json` written    |
| 9    | Crawl Confluence                                       | ✅ Skipped (no Confluence configured)      |
| 10   | Run `generate-skills`                                  | ✅ All 23 skills generated + deployed      |

### Files written in the template directory

| File                                 | What it is                                        |
| ------------------------------------ | ------------------------------------------------- |
| `docs/intake-sources.md`             | Ghostfolio project profile                        |
| `pipeline-config.json`               | Non-sensitive config: org, repo, auth type        |
| `client/client-kb.md`                | Ghostfolio knowledge base for AI agents           |
| `client/phase-notes/requirements.md` | Phase 1 overrides (no Zephyr, no multi-brand)     |
| `client/phase-notes/architecture.md` | Phase 2 overrides (NestJS patterns, Prisma rules) |

### Environment variables

Open `C:\EPAM_AI_Initiatives\ghostfolio\.env` in your editor and fill in:

| Variable            | Where to get it                             | Status    |
| ------------------- | ------------------------------------------- | --------- |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | ✅ Filled |
| `REDIS_PASSWORD`    | Already set                                 | ✅        |
| `POSTGRES_PASSWORD` | Already set                                 | ✅        |
| `ACCESS_TOKEN_SALT` | Already set                                 | ✅        |
| `JWT_SECRET_KEY`    | Already set                                 | ✅        |

---

## 7. Skills Deployment

### What skills are and how they were generated

Skills are `SKILL.md` files that tell Claude Code exactly how to execute each pipeline phase. They were generated by reading the template's generic contracts and injecting Ghostfolio-specific content:

- `{{pm-system#fetch}}` → `gh issue view $N --repo rajagondap/ghostfolio --json ...`
- `{{scm#create-pr}}` → `gh pr create --base main --repo rajagondap/ghostfolio`
- `python3` → `python` (Windows compatibility)
- Unused markers (compliance, feature flags, test management) → removed

### Complete skills inventory

**Pipeline skills (23 total in `.claude/skills/`):**

| Skill                            | Phase             | Invoked by      |
| -------------------------------- | ----------------- | --------------- |
| `sdlc-pipeline`                  | Orchestrator      | `/sdlc` command |
| `sdlc-ticket-classification`     | Phase 0           | pipeline        |
| `sdlc-requirements`              | Phase 1           | pipeline        |
| `sdlc-architecture`              | Phase 2           | pipeline        |
| `sdlc-design-review`             | Phase 3           | pipeline        |
| `sdlc-qa-test-generation`        | Phase 3b          | pipeline        |
| `sdlc-impl-planning`             | Phase 4           | pipeline        |
| `sdlc-implementation`            | Phase 5           | pipeline        |
| `sdlc-simplify`                  | Phase 6           | pipeline        |
| `sdlc-review`                    | Phase 7           | pipeline        |
| `sdlc-code-review`               | Phase 7 sub-agent | review          |
| `sdlc-security-scan`             | Phase 7 sub-agent | review          |
| `sdlc-generate-tests`            | Phase 7 sub-agent | review          |
| `sdlc-verification`              | Phase 8           | pipeline        |
| `sdlc-risk`                      | Phase 9           | pipeline        |
| `sdlc-pr-creation`               | Phase 10          | pipeline        |
| `sdlc-checkpoint`                | Resume support    | pipeline        |
| `sdlc-build-codebase-index`      | Index builder     | pipeline        |
| `systematic-debugging`           | Standalone        | auto-triggered  |
| `writing-plans`                  | Standalone        | auto-triggered  |
| `executing-plans`                | Standalone        | auto-triggered  |
| `finishing-a-development-branch` | Standalone        | auto-triggered  |
| `session-learnings`              | Standalone        | auto-triggered  |

---

## 8. GitHub Issues Created

Three issues created on `https://github.com/rajagondap/ghostfolio/issues`:

| Issue    | Title                                                      | Pipeline Type | Phases        |
| -------- | ---------------------------------------------------------- | ------------- | ------------- |
| **GH-1** | Automated Corporate Actions & Dividend Adjustment Engine   | Large Feature | All 10 phases |
| **GH-2** | Advanced Portfolio Rebalancing & Target Allocation Planner | Large Feature | All 10 phases |
| **GH-3** | Multi-Currency FX Conversion & Base Currency Normalization | Small Feature | 9 phases      |

**Recommended starting point: GH-3** — smallest scope, clearest requirements, well-defined codebase touchpoints.

---

## 9. QA Automation Repo (STLC)

### Repo details

- **GitHub:** https://github.com/rajagondap/ghostfolio-qa-automation (private)
- **Local:** `C:\EPAM_AI_Initiatives\ghostfolio-qa-automation`
- **Framework:** Playwright + TypeScript
- **Test types:** E2E (browser) + API

### Directory structure

```
ghostfolio-qa-automation/
├── e2e/
│   ├── pages/          ← Page Object Models
│   │   ├── base.page.ts
│   │   ├── login.page.ts
│   │   └── portfolio.page.ts
│   ├── fixtures/
│   │   └── auth.fixture.ts   ← Token-based auth helper
│   └── tests/
│       └── auth/
│           └── login.spec.ts ← Smoke tests: login flow
├── api/
│   ├── helpers/
│   │   └── api-client.ts     ← GhostfolioApiClient
│   └── tests/
│       └── health.spec.ts    ← API smoke tests
├── .claude/
│   ├── skills/               ← 6 STLC pipeline skills
│   └── commands/             ← /stlc, /stlc-status
├── .github/workflows/
│   └── e2e.yml               ← CI: smoke tests on every PR
├── playwright.config.ts
├── package.json
└── CLAUDE.md                 ← STLC workflow rules
```

### STLC pipeline phases

| Phase | Command                    | Artifact                             |
| ----- | -------------------------- | ------------------------------------ |
| 1     | `stlc-test-analysis`       | `ph1_test_requirements.md`           |
| 2     | `stlc-test-strategy`       | `ph2_test_strategy.md`               |
| 3     | `stlc-test-design`         | `ph3_test_cases.md`                  |
| 4     | `stlc-impl-planning`       | `ph4_test_plan.md`                   |
| 5     | `stlc-test-implementation` | Test scripts on `test/GH-N-*` branch |
| 6     | `stlc-test-review`         | `ph6_test_review.md`                 |
| 7     | `stlc-pr-creation`         | PR on ghostfolio-qa-automation       |

### Workflow rule

```
Base framework code → main (stable, human-authored)
Generated test scripts → test/GH-N-* branch → PR → human review → merge
```

### Setup (first time)

```powershell
cd C:\EPAM_AI_Initiatives\ghostfolio-qa-automation
npm install
npx playwright install chromium
cp .env.example .env
# Fill in GHOSTFOLIO_ACCESS_TOKEN (get from Ghostfolio → Settings → Security tokens)
```

---

## 10. Docker/Podman Test Environment

### Two compose files

| File                             | Purpose                                 | Port | Image                                     |
| -------------------------------- | --------------------------------------- | ---- | ----------------------------------------- |
| `docker/docker-compose.yml`      | Running app (production image)          | 3333 | `ghostfolio/ghostfolio:latest`            |
| `docker/docker-compose.test.yml` | Test environment (built from YOUR code) | 3334 | `ghostfolio-local:latest` (built locally) |

### How the SDLC pipeline uses the test environment

After Phase 5 (Implementation) writes code changes:

```powershell
# Step 1: Build your modified code into a local image
podman build -t ghostfolio-local .

# Step 2: Start test stack (port 3334, isolated test DB on port 5433)
podman compose -f docker/docker-compose.test.yml up -d

# Step 3: Run STLC tests against your code changes
cd C:\EPAM_AI_Initiatives\ghostfolio-qa-automation
$env:BASE_URL = "http://localhost:3334"
npm run test:smoke

# Step 4: Tear down when done
podman compose -f docker/docker-compose.test.yml down
```

This ensures the SDLC pipeline tests **your actual code changes**, not the published image.

---

## 11. Running the SDLC Pipeline

### Prerequisites checklist (run through before first pipeline execution)

```powershell
# 1. Verify containers are running
podman ps

# 2. Verify API key is set
Get-Content .env | Select-String "ANTHROPIC_API_KEY"

# 3. Verify gh CLI is authenticated
gh auth status

# 4. Verify skills are present
ls .claude/skills/sdlc-pipeline

# 5. Verify settings.json exists (hooks registered)
ls .claude/settings.json
```

### Start the pipeline

```
/sdlc --ticket=GH-3
```

### Phase-by-phase what happens

| Phase  | What AI does                                       | Artifact produced                       | Your action                |
| ------ | -------------------------------------------------- | --------------------------------------- | -------------------------- |
| **0**  | Reads GH-3, classifies as Small Feature            | Pipeline state initialised              | Confirm classification     |
| **1**  | Fetches issue, scans codebase, interrogates you    | `ph1_problem_spec.md`                   | Review spec, approve       |
| **2**  | Designs ExchangeRate table, FX service, UI         | `ph2_design_spec.md`                    | Review design, approve     |
| **3b** | Writes test cases for each AC                      | `ph3_test_cases.md`                     | Review test cases          |
| **4**  | Creates ordered file list with verify commands     | `ph4_implementation_plan.md`            | Review plan, approve       |
| **5**  | Writes code one file at a time, verifies each step | Code changes + `ph5_6_impl_manifest.md` | Watch, intervene if needed |
| **6**  | Cleans up Phase 5 code (dead code, duplicates)     | Updated manifest                        | Review cleanup             |
| **7**  | 3 parallel agents: code quality + security + tests | Review report                           | Review findings            |
| **8**  | Maps every AC to implementation evidence           | `ph8_verification_report.md`            | Review score (must be ≥80) |
| **10** | Creates branch + opens PR                          | PR on rajagondap/ghostfolio             | Review + merge PR          |

### Useful pipeline commands

```
/sdlc --ticket=GH-3             # Start pipeline
/sdlc --ticket=GH-3 --resume    # Resume after interruption
/sdlc-status --ticket=GH-3      # Check progress, scores, token spend
/sdlc-artifacts --ticket=GH-3   # List all artifacts produced
/sdlc-blockers --ticket=GH-3    # Show critical findings blocking progress
/sdlc-retry --ticket=GH-3 --phase=design-review  # Rerun one phase
/sdlc-doctor                    # Validate workspace setup
/sdlc-clean --ticket=GH-3       # Start fresh (deletes all artifacts)
```

### Where artifacts are saved

```
docs/artifacts/GH-3/
├── ph1_problem_spec.md
├── ph2_design_spec.md
├── ph3_test_cases.md          (from phase 3b)
├── ph4_implementation_plan.md
├── ph5_6_impl_manifest.md
├── ph8_verification_report.md
├── ph9_risk_assessment.md
└── .state/
    └── pipeline_state_GH-3.json
```

---

## 12. Running the STLC Pipeline

Run **after** the SDLC pipeline completes for a ticket (or in parallel — STLC reads the SDLC requirements spec).

### Setup (first time)

```powershell
cd C:\EPAM_AI_Initiatives\ghostfolio-qa-automation
npm install
npx playwright install chromium
cp .env.example .env
# Set GHOSTFOLIO_ACCESS_TOKEN in .env
```

### Start the STLC pipeline

Open Claude Code in the QA automation directory:

```powershell
cd C:\EPAM_AI_Initiatives\ghostfolio-qa-automation
claude
```

Then run:

```
/stlc --ticket=GH-3
```

### What happens

1. AI reads GH-3 and (if available) the SDLC requirements spec
2. Produces test requirements, strategy, and test cases
3. Creates branch `test/GH-3-multi-currency-fx`
4. Writes Playwright E2E + API test scripts to the branch
5. Creates a PR on `rajagondap/ghostfolio-qa-automation`
6. Posts a comment on GH-3 linking to the test PR

### Workflow rule — always followed

```
test/GH-N-* branch → PR → YOU review → merge to main
                                ↑
                         NEVER auto-merged
```

---

## 13. Complete File Map

### ghostfolio repo

```
C:\EPAM_AI_Initiatives\ghostfolio\
├── .claude/
│   ├── settings.json              ← Hook registrations
│   ├── codebase-index-config.json ← Index exclusions
│   ├── commands/                  ← 7 SDLC commands
│   ├── hooks/                     ← 6 Python hooks
│   ├── skills/                    ← 23 SDLC + standalone skills
│   ├── config/                    ← Phase models + execution phases
│   └── plans/                     ← Plans written by writing-plans skill
├── docs/
│   ├── intake-sources.md          ← Ghostfolio project profile
│   ├── SDLC-PIPELINE.md           ← Detailed phase guide
│   ├── AI-SDLC-MENTOR-GUIDE.md    ← Mentor guide (component-by-component)
│   ├── USER-MANUAL.md             ← THIS FILE — step-by-step manual
│   ├── client-onboarding-wizard.html ← Browser-based intake wizard
│   └── artifacts/                 ← Pipeline artifacts (gitignored)
├── docker/
│   ├── docker-compose.yml         ← Production image stack (port 3333)
│   ├── docker-compose.dev.yml     ← Dev DB only (port 5432 exposed)
│   └── docker-compose.test.yml    ← Test build stack (port 3334) ← NEW
├── .env                           ← Secrets (gitignored) — fill ANTHROPIC_API_KEY
├── .env.test                      ← Test env vars (gitignored) ← NEW
├── .gitignore                     ← Updated with pipeline state exclusions
├── CLAUDE.md                      ← Claude Code project instructions
└── Dockerfile                     ← Multi-stage build (existing)
```

### ghostfolio-qa-automation repo

```
C:\EPAM_AI_Initiatives\ghostfolio-qa-automation\
├── .claude/
│   ├── commands/                  ← /stlc, /stlc-status
│   └── skills/                    ← 6 STLC pipeline skills
├── e2e/
│   ├── pages/                     ← Page Object Models
│   ├── fixtures/                  ← Auth helpers
│   └── tests/                     ← E2E test specs (by feature)
├── api/
│   ├── helpers/                   ← API client
│   └── tests/                     ← API test specs
├── .github/workflows/e2e.yml      ← CI pipeline
├── playwright.config.ts
├── package.json
├── CLAUDE.md                      ← STLC workflow rules
└── .env.example                   ← Template for .env
```

### SDLC template (generator — separate from your project)

```
C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\
├── docs/intake-sources.md         ← Ghostfolio intake (gitignored)
├── pipeline-config.json           ← Non-sensitive config
├── client/
│   ├── client-kb.md               ← Ghostfolio knowledge base
│   └── phase-notes/
│       ├── requirements.md        ← Phase 1 overrides
│       └── architecture.md        ← Phase 2 overrides
└── generated-skills/              ← Generated output (gitignored)
```

---

## 14. Quick Reference Commands

### Application

```powershell
# Start all containers
podman compose -f docker/docker-compose.yml up -d

# Stop all containers
podman compose -f docker/docker-compose.yml down

# Check health
podman ps

# Start test environment (after building)
podman build -t ghostfolio-local .
podman compose -f docker/docker-compose.test.yml up -d
```

### SDLC Pipeline (run from ghostfolio directory)

```
/sdlc --ticket=GH-3              Start pipeline for an issue
/sdlc --ticket=GH-3 --resume     Resume after interruption
/sdlc-status --ticket=GH-3       Check pipeline status dashboard
/sdlc-artifacts --ticket=GH-3    List all artifacts
/sdlc-blockers --ticket=GH-3     Show critical findings
/sdlc-doctor                     Validate workspace setup
/sdlc-clean --ticket=GH-3        Delete artifacts and start fresh
```

### STLC Pipeline (run from ghostfolio-qa-automation directory)

```
/stlc --ticket=GH-3              Start STLC pipeline
/stlc-status --ticket=GH-3       Check STLC status
npm run test:smoke                Run smoke tests
npm run test:regression           Run full regression suite
npm run test:e2e:ui               Open Playwright visual test runner
```

### Standalone Skills (always available in ghostfolio directory)

These activate automatically based on context — no command needed:

| Skill                            | Activates when                           |
| -------------------------------- | ---------------------------------------- |
| `systematic-debugging`           | You describe a bug or test failure       |
| `writing-plans`                  | You say "plan this" or "break this down" |
| `executing-plans`                | You say "execute the plan"               |
| `finishing-a-development-branch` | You say "I'm done" or "ready for PR"     |
| `session-learnings`              | You say "capture learnings"              |

### GitHub

```bash
gh issue list --repo rajagondap/ghostfolio
gh pr list --repo rajagondap/ghostfolio
gh issue view 3 --repo rajagondap/ghostfolio
```

---

_Last updated: 2026-11-06 | Ghostfolio AI PDLC/SDLC Setup_
