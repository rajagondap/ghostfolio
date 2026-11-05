# AI Agentic SDLC — Complete Mentor Guide for Ghostfolio

> **How to read this guide:** Start at the top and work down. Every section answers "what is this?", "why does it exist?", and "what do I do here for Ghostfolio?". Follow the actions in order — they build on each other.

---

## The Big Picture

The template at `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template` is a **factory**. It does not run the pipeline itself. It _generates_ a customised pipeline for your specific project, tools, and team — then you run that pipeline inside your project.

Think of it like this:

```
┌─────────────────────────────────────────────────────┐
│         FACTORY (claude-sdlc-plugin-template)        │
│                                                       │
│  1. client-onboarding-wizard.html  ← You fill this   │
│  2. docs/intake-sources.md         ← Wizard outputs  │
│  3. client/ folder                 ← Context added   │
│  4. /preflight                     ← Runs setup      │
│  5. /generate-skills               ← Builds skills   │
│  6. generated-skills/              ← Output folder   │
└─────────────────────┬───────────────────────────────┘
                      │ copy generated-skills → .claude/skills/
                      ▼
┌─────────────────────────────────────────────────────┐
│             YOUR PROJECT (ghostfolio)                 │
│                                                       │
│  .claude/skills/sdlc-pipeline/     ← Orchestrator    │
│  .claude/skills/sdlc-requirements/ ← Phase 1 skill   │
│  .claude/skills/sdlc-architecture/ ← Phase 2 skill   │
│  ... (all 11 phase skills)                            │
│                                                       │
│  /sdlc --ticket=GH-3  ← You run this to start        │
└─────────────────────────────────────────────────────┘
```

**You are here:** The factory exists. Your project exists. The bridge between them — running the factory — is what this guide walks you through.

---

## Component 1: The Onboarding Wizard

**File:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\client-onboarding-wizard.html`

**What it is:** A self-contained HTML form that runs in your browser (no server needed). It collects everything the factory needs to know about your project, tools, and team in one structured session.

**Why it exists:** The factory generates _different_ pipeline skills depending on your answers. A project using Jira + GitHub gets different skill files than one using GitHub Issues + gh CLI. The wizard captures this cleanly without you having to manually edit config files.

**The 4 sections of the wizard:**

| Section                            | Who fills it     | What it captures                                                                                       |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Step 1: Engagement Overview**    | Delivery Manager | Company name, industry, compliance frameworks (GDPR/PCI/HIPAA), approved AI tools, LLM models          |
| **Step 2: Knowledge Sources**      | Delivery Manager | Confluence URLs, documentation links — the agents will read these for context                          |
| **Step 3: SDLC Tools**             | Architect / Lead | ALM system (GitHub Issues/Jira/ADO), SCM (GitHub/GitLab), auth strategy per tool, branch naming, CI/CD |
| **Step 4: Integrations & Context** | Architect / Lead | Feature flags, APM/observability, test management, QA tools                                            |

**Output:** Click "Copy to Clipboard" at the end. This gives you a formatted markdown document — the intake form.

### What to fill in for Ghostfolio

Open the wizard in your browser:

```
C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\client-onboarding-wizard.html
```

Fill in these values:

| Field               | Value for Ghostfolio                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| Company name        | Ghostfolio                                                             |
| Industry            | BFSI (Banking, Financial Services & Insurance) — personal finance tool |
| Compliance          | None (open source, personal use)                                       |
| PII handled         | None / Public only                                                     |
| Approved AI tools   | Claude Code                                                            |
| Approved models     | claude-sonnet-4-6, claude-haiku-4-5                                    |
| ALM System          | GitHub Issues                                                          |
| GitHub Issues auth  | gh-cli                                                                 |
| GitHub org          | rajagondap                                                             |
| GitHub repo         | ghostfolio                                                             |
| SCM                 | GitHub                                                                 |
| SCM auth            | gh-cli                                                                 |
| Default branch      | main                                                                   |
| Branch naming       | `<type>/<short-description>`                                           |
| Feature Flags       | None                                                                   |
| APM / Observability | None                                                                   |
| Test Management     | None                                                                   |
| CI/CD               | GitHub Actions                                                         |

**Action:** Open the wizard → fill in the values above → click "Copy to Clipboard" → save the output.

---

## Component 2: The Intake Form

**File:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\docs\intake-sources.md`

**What it is:** The output of the wizard. A structured markdown document that is the single source of truth for your project's configuration. Every subsequent step reads this file.

**Why it exists:** The factory (preflight, generate-skills) reads this file to know which tools to configure, which MCP servers to install, and which tool-specific instructions to inject into each phase skill.

**Critical rules:**

- Never edit it manually after the wizard fills it — re-run the wizard if you need to change it
- It is **gitignored** — it's per-client and per-project, never committed
- It lives in the _template directory_, not your project

**We already created this file for Ghostfolio** at:
`C:\EPAM_AI_Initiatives\ghostfolio\docs\intake-sources.md`

But we need to **copy it into the template directory** before running preflight:

```powershell
copy C:\EPAM_AI_Initiatives\ghostfolio\docs\intake-sources.md `
     C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\docs\intake-sources.md
```

---

## Component 3: The Client Folder

**Path:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\client\`

**What it is:** Two types of files that store your project-specific context — knowledge that doesn't belong in the intake form but that every pipeline phase needs to know at runtime.

```
client/
├── client-kb.md              ← Organisation-wide knowledge base
└── phase-notes/
    ├── requirements.md       ← Overrides / customs for Phase 1
    ├── architecture.md       ← Overrides / customs for Phase 2
    ├── design-review.md      ← Overrides / customs for Phase 3
    ├── implementation.md     ← Overrides / customs for Phase 5
    └── verification.md       ← Overrides / customs for Phase 8
```

**Why it exists:** The skill contracts (blueprints for each phase) are generic. `client-kb.md` and the phase notes inject project-specific knowledge _without_ baking it into the generated skill files. This means you can update context without regenerating all skills.

### client-kb.md

This is the organisation knowledge base. Think of it as "what every developer on this project should know before writing a single line of code."

**Sections:**

- `## Organisation` — company, industry, compliance, ticket prefixes
- `## Internal Tooling` — tools list with auth methods
- `## Pipeline Process` — approval gates, phase customisations
- `## Standards & Patterns` — coding standards, architecture guardrails
- `## PII & Compliance` — what data exists, rules for handling it
- `## Observability` — logging, metrics, alerting standards

**For Ghostfolio**, we need to fill this with Ghostfolio-specific knowledge. The `generate-skills` skill will ask you questions and fill this file automatically during setup.

### phase-notes/

Each file tells the AI what's different about how THIS project does a specific phase compared to the generic contract.

**Example from another project (`phase-notes/requirements.md`):**

```
## Do Not
- Do not proceed to architecture without explicit user approval of the spec.
- Do not create test cases during this phase (QA phase only).

## Client-Specific Checks
- Every ticket must declare brand scope before spec is approved.
```

**For Ghostfolio**, the generate-skills process will ask you questions and write these files. You can also edit them directly at any time.

---

## Component 4: Preflight

**Location:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\skills\preflight\SKILL.md`

**What it is:** A 10-step automated setup wizard that runs inside Claude Code. You run it once (and re-run when things change).

**Why it exists:** Setting up the pipeline manually would require you to: install MCPs, configure authentication, write config files, install hooks, generate skills — all in the right order. Preflight does all of this for you, safely, with validation at every step.

### The 10 Steps of Preflight

```
Step 0: Read intake-sources.md
        → Extracts: ALM system, SCM, compliance, org name, auth strategies
        → STOPS if intake-sources.md doesn't exist

Step 1: Prerequisites check
        → Checks: Claude Code CLI ✓, Python ✓, Node.js ✓, gh CLI ✓
        → STOPS if Claude Code CLI is missing

Step 2: Confirm tool detection
        → Shows what it found and asks you to confirm before proceeding
        → You can correct any mistake here

Step 3: Collect auth strategies
        → Asks: OAuth? PAT? gh-cli? — for each tool in one batch
        → For Ghostfolio: GitHub Issues → gh-cli, GitHub SCM → gh-cli

Step 4: Collect non-sensitive config
        → Asks: GitHub org name, default branch
        → NEVER asks for tokens or passwords

Step 5: Install MCP servers
        → Installs only what's needed (skips already-installed)
        → For Ghostfolio (gh-cli auth): no MCP needed — gh handles everything

Step 6: Update .gitignore
        → Adds .claude/ to .gitignore in all repos under workspace root
        → Prevents accidentally committing pipeline state

Step 7: OAuth authentication
        → Skipped for Ghostfolio (we use gh-cli, not OAuth)

Step 8: Write pipeline-config.json + .env.template
        → pipeline-config.json: non-sensitive config only (URLs, org names)
        → .env.template: blank token slots with instructions
        → NEVER writes actual token values

Step 9: Crawl Confluence (if configured)
        → Skipped for Ghostfolio (no Confluence)
        → Writes client/phase-notes/ files from Confluence pages
        → Falls back to generate-skills Q&A if Confluence not configured

Step 10: Run generate-skills
         → Reads contracts + tool profiles + intake
         → Generates all 11 phase SKILL.md files into generated-skills/
         → Asks targeted Q&A for gaps not covered by intake
```

### How to Run Preflight

```powershell
# Step 1: Copy intake form to template directory
copy C:\EPAM_AI_Initiatives\ghostfolio\docs\intake-sources.md `
     C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\docs\intake-sources.md

# Step 2: Open Claude Code in the template directory
cd C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template
claude

# Step 3: Inside Claude Code, run:
/preflight
```

Preflight will run all 10 steps, asking questions along the way. It will finish by telling you exactly which files to copy.

---

## Component 5: Generate Skills

**Location:** `C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\skills\generate-skills\SKILL.md`

**What it is:** The skill that assembles client-specific SKILL.md files from contracts + tool profiles + your intake form.

**Why it exists:** The phase contracts are generic blueprints. They contain placeholder markers like `{{pm-system#fetch}}` that mean "insert the instructions for reading a GitHub Issue here." Generate-skills replaces those markers with actual GitHub-specific instructions from `skill-contracts/tool-profiles/pm-system/github-issues-pat.md`.

### How skill assembly works

```
skill-contracts/phase-01-requirements.md    ← Generic blueprint
         +
skill-contracts/tool-profiles/
  pm-system/github-issues-pat.md            ← GitHub-specific instructions
  scm/github-gh-cli.md                      ← gh CLI-specific instructions
         +
docs/intake-sources.md                      ← Your project config
         +
Interactive Q&A with you                    ← Project-specific gaps
         │
         ▼
generated-skills/sdlc-requirements/SKILL.md ← Ready to use
```

The marker `{{pm-system#fetch}}` in the requirements contract gets replaced with the exact `gh issue view` command needed to read your GitHub Issue. Every placeholder becomes concrete, project-specific instructions.

### What gets generated

```
generated-skills/
├── sdlc-pipeline/SKILL.md              ← Pipeline orchestrator (the brain)
├── sdlc-checkpoint/SKILL.md            ← Resume after interruption
├── sdlc-build-codebase-index/SKILL.md  ← Index builder
├── sdlc-ticket-classification/SKILL.md ← Phase 0
├── sdlc-requirements/SKILL.md          ← Phase 1
├── sdlc-architecture/SKILL.md          ← Phase 2
├── sdlc-design-review/SKILL.md         ← Phase 3
├── sdlc-qa-test-generation/SKILL.md    ← Phase 3b
├── sdlc-impl-planning/SKILL.md         ← Phase 4
├── sdlc-implementation/SKILL.md        ← Phase 5
├── sdlc-simplify/SKILL.md              ← Phase 6
├── sdlc-review/SKILL.md                ← Phase 7 orchestrator
├── sub-skills/
│   ├── sdlc-code-review/SKILL.md       ← Phase 7: code reviewer agent
│   ├── sdlc-security-scan/SKILL.md     ← Phase 7: security auditor agent
│   └── sdlc-generate-tests/SKILL.md    ← Phase 7: test engineer agent
├── sdlc-verification/SKILL.md          ← Phase 8
├── sdlc-risk/SKILL.md                  ← Phase 9
├── sdlc-pr-creation/SKILL.md           ← Phase 10
└── standalone/
    ├── sdlc-systematic-debugging/
    ├── sdlc-writing-plans/
    ├── sdlc-executing-plans/
    ├── sdlc-finishing-branch/
    └── sdlc-session-learnings/
```

---

## Component 6: Deploying Skills to Your Project

After generate-skills runs, preflight shows you the copy commands. Run them in PowerShell:

```powershell
$SKILLS_DST = "C:\EPAM_AI_Initiatives\ghostfolio\.claude\skills"

# Pipeline phase skills
Copy-Item -Recurse -Force `
  "C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\generated-skills\sdlc-*" `
  $SKILLS_DST

# Phase 7 sub-agents (parallel review agents)
Copy-Item -Recurse -Force `
  "C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\generated-skills\sub-skills\*" `
  $SKILLS_DST

# Standalone skills (overwrite with generated versions)
Copy-Item -Recurse -Force `
  "C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\generated-skills\standalone\*" `
  $SKILLS_DST
```

After copying, your Ghostfolio project has all the skills it needs. The `/sdlc` command will work.

---

## Component 7: Running the Pipeline

### Before every session

Load your `.env` tokens into the terminal before starting Claude Code:

```powershell
# Load .env into PowerShell session
Get-Content "C:\EPAM_AI_Initiatives\ghostfolio\.env" | `
  Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | `
  ForEach-Object {
    $parts = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
  }
```

### Starting a pipeline run

```
/sdlc --ticket=GH-3
```

### What happens inside the pipeline

The `sdlc-pipeline` skill is the **orchestrator** — it reads the ticket, runs classification, then calls each phase skill in order. Each phase:

1. Produces a Markdown artifact in `docs/artifacts/GH-3/`
2. Updates `pipeline_state_GH-3.json` with status, timestamps, token usage
3. Presents a gate to you: **approve to continue** or **reject to fix**
4. STOPS — context is cleared between phases to keep the AI focused

You are in control at every boundary. Nothing auto-proceeds.

---

## The Complete Action Plan (What to Do Right Now)

Here is the exact sequence of steps to get from where you are to a fully running pipeline:

### Phase A: Fill the Wizard (5 minutes)

```
ACTION 1: Open the wizard in your browser
  File: C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\client-onboarding-wizard.html

ACTION 2: Fill in all 4 steps using the Ghostfolio values from Component 1 above

ACTION 3: Click "Copy to Clipboard"

ACTION 4: Save the output to:
  C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template\docs\intake-sources.md
  (replace the existing file)
```

### Phase B: Run Preflight (10-15 minutes)

```
ACTION 5: Open a new terminal
  cd C:\EPAM_AI_Initiatives\claude-sdlc-plugin-template

ACTION 6: Start Claude Code
  claude

ACTION 7: Inside Claude Code, run:
  /preflight

ACTION 8: Answer the questions preflight asks:
  - Confirm detected tools: GitHub Issues + gh CLI
  - GitHub org: rajagondap
  - Default branch: main
  - Exclusions from index: (press Enter, none needed)

ACTION 9: When preflight asks about the client-kb.md Q&A:
  Answer questions about Ghostfolio — the AI will write client-kb.md for you
```

### Phase C: Deploy Skills (2 minutes)

```
ACTION 10: Copy generated skills to Ghostfolio
  (Preflight will print the exact commands — run them in PowerShell)
```

### Phase D: Start the Pipeline (now it works!)

```
ACTION 11: Return to your Ghostfolio Claude Code session

ACTION 12: Run:
  /sdlc --ticket=GH-3

ACTION 13: Phase 0 classifies the ticket — confirm: "Small Feature"

ACTION 14: Phase 1 begins — the AI reads GH-3 and writes:
  docs/artifacts/GH-3/ph1_problem_spec.md

ACTION 15: Review the spec. Approve it. Phase 2 begins.

... and so on through all 9 phases until the PR is created.
```

---

## What Each Phase Produces for GH-3

| Phase                  | What the AI does                                              | You get                                                        |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| **0 · Classification** | Reads GH-3, determines ticket type                            | Confirmation: "Small Feature — 9 phases"                       |
| **1 · Requirements**   | Reads issue, scans codebase, writes numbered REQs and ACs     | `ph1_problem_spec.md` — the requirements contract              |
| **2 · Architecture**   | Designs ExchangeRate table, FX service changes, UI            | `ph2_design_spec.md` — component design, data model, file list |
| **3b · QA Tests**      | Writes test cases for each AC                                 | Test case document (no Jira — GitHub project)                  |
| **4 · Impl Planning**  | Orders the files to touch, wave assignments, verify commands  | `ph4_implementation_plan.md` — the execution checklist         |
| **5 · Implementation** | Writes the code, one file at a time, verifies each step       | Actual code changes + `ph5_6_impl_manifest.md`                 |
| **6 · Simplify**       | Reviews and cleans up Phase 5 changes only                    | Cleaner code — no scope creep                                  |
| **7 · Review**         | 3 agents in parallel: code quality + security + test coverage | Findings report — you decide what to fix                       |
| **8 · Verification**   | Maps every REQ/AC to implementation evidence                  | `ph8_verification_report.md` — score + pass/fail               |
| **10 · PR Creation**   | Creates branch, opens PR with full context                    | PR at github.com/rajagondap/ghostfolio/pulls                   |

---

## Understanding the Relationship Between Components

```
client-onboarding-wizard.html
        │ fills
        ▼
docs/intake-sources.md ──────────────────────────────┐
        │ read by                                      │
        ▼                                             │
/preflight                                            │
  ├── validates tools                                 │
  ├── installs hooks                                  │
  ├── writes pipeline-config.json                     │
  └── calls /generate-skills ◄── reads intake ────────┘
              │ reads
              ├── skill-contracts/phase-*.md          (generic blueprints)
              ├── skill-contracts/tool-profiles/*.md  (GitHub-specific content)
              └── client/ folder                      (your project context)
              │ outputs
              ▼
        generated-skills/
              │ copied to
              ▼
        ghostfolio/.claude/skills/
              │ used by
              ▼
        /sdlc --ticket=GH-3
              │ orchestrated by
              ▼
        sdlc-pipeline skill → calls phases 0→10 → produces docs/artifacts/GH-3/
```

Every component feeds into the next. Skip one and the next step breaks.

---

## Key Rules to Never Break

1. **Never type tokens into Claude's chat** — they get logged in the conversation context. Always paste into `.env` directly in your editor.

2. **Never edit `generated-skills/` directly** — it's regenerated every time you run `/generate-skills`. Edit `skill-contracts/` instead.

3. **Never skip filling the wizard** — guessing intake values causes mismatched tool profiles and broken skill generation.

4. **Never bypass a pipeline gate** — when Phase 3 (Design Review) finds a critical issue, it blocks for a reason. Fix it first.

5. **Always load `.env` before starting Claude Code** — the pipeline reads tokens from environment variables. Without them, it can't read issues or create PRs.

6. **The pipeline checkpoints after every phase** — if it gets interrupted, run `/sdlc --ticket=GH-3 --resume` to pick up where it left off.

---

## Summary: You Are the Architect, the AI Is the Engineer

The AI does not make decisions. You do. The AI:

- Reads the issue and writes a spec — **you review and approve it**
- Designs the architecture — **you review and approve it**
- Writes the code — **you review the PR**
- Flags risks — **you decide whether to ship**

Every phase ends with a gate. Every gate requires your explicit approval. The AI is your highly capable engineer who never gets tired, never skips steps, and produces documented artifacts at every stage. You are the architect and product owner who reviews, challenges, and approves the work.

That is the Agentic SDLC.
