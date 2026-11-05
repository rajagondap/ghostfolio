---
name: sdlc-ticket-classification
description: >
  Phase 0 of the SDLC pipeline. Classifies a GitHub Issue into Hotfix/Bug/Spike/Story/Small Feature/Large Feature
  and initialises pipeline state. Invoked by sdlc-pipeline as the first step.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 0 — Classification

## Client Context (read at runtime)

Read the following files at the start of this phase:

| File           | How to use                                                                            |
| -------------- | ------------------------------------------------------------------------------------- |
| `client-kb.md` | Read fully. Apply domain knowledge, ticket prefix conventions relevant to this phase. |

Do not ask the user to repeat information already present in these files.

---

## Purpose

Determine the ticket type and map it to the correct phase set before any development begins. The pipeline cannot proceed until classification is confirmed by the user.

---

## Arguments

| Argument             | Required | Description                                                                                     |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `--ticket=TICKET-ID` | Yes      | GitHub Issue ID in GH-NNN format (e.g., GH-3). The number after GH- is the GitHub issue number. |

---

## Input Modes

### Mode A — GitHub Issues API (gh-cli)

When the user runs the pipeline with only a ticket ID, fetch the issue via gh CLI:

```bash
# Extract issue number from GH-NNN format (e.g., GH-3 → 3)
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
gh issue view "$ISSUE_NUM" --repo rajagondap/ghostfolio --json number,title,body,state,labels,milestone,assignees
```

Strip null/empty fields from the response before analysis.

**Error handling:**

- gh not authenticated → run `gh auth login` first
- Issue not found → report and ask user to verify number
- Network failure → ask user to paste issue content inline (Mode B)

### Mode B — Inline Text

When the user pastes ticket content directly, use it as-is. No API call needed.

---

## Iron Laws (GitHub Issues)

- **Never proceed without a valid issue number.** Issue number must be a positive integer in GH-NNN format.
- **Never fabricate issue content.** If gh CLI is unavailable, ask user to paste inline.
- **Always strip null/empty fields** from the API response before analysis.
- **GitHub Issues has no native workflow states.** Use labels to signal pipeline state — never close the issue as a proxy for "done".

---

## Process

### Step 1 — Load Classification Config

Read `config/execution_phases.json` to load all phase sets.

### Step 2 — Normalise Ticket Data

Strip null, empty, and irrelevant fields from the API response before analysis.

### Step 3 — Analyse Ticket

Extract signals from the normalised ticket:

| Signal                  | What to look for                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Title**               | "fix", "broken", "regression" → Bug/Hotfix; "investigate", "spike" → Spike; "add", "build", "implement" → Feature |
| **Body length**         | Short + urgent → Hotfix; long + detailed ACs → Feature                                                            |
| **Labels**              | "hotfix", "bug", "spike", "enhancement"                                                                           |
| **Acceptance criteria** | Present and detailed → Story/Feature; absent → Bug/Hotfix                                                         |

### Step 4 — Determine Classification and Confidence

| Type              | Key indicators                                              |
| ----------------- | ----------------------------------------------------------- |
| **Hotfix**        | Production broken, critical priority, immediate fix needed  |
| **Bug**           | Defect with known cause, not production-critical            |
| **Spike**         | Investigation, time-box, no deliverable code                |
| **Story**         | User-facing change, clear ACs, no architectural uncertainty |
| **Small Feature** | New functionality, contained scope, limited impact          |
| **Large Feature** | Architectural change, cross-module, extensive ACs           |

### Step 5 — Present Findings to User

```
Classification: Small Feature (confidence: 0.88)

Reasoning:
- Feature adds a new Prisma model (ExchangeRate table)
- Requires FX rate data provider integration
- Has clear acceptance criteria with UI component
- Contained scope: exchange-rate-data service + prisma + settings UI

Phase set that will execute (9 phases):
  requirements → architecture → qa-test-generation → impl-planning →
  implementation → simplify → review → verification → pr

Confirm? (yes / or type a different classification: Hotfix | Bug | Spike | Story | Small Feature | Large Feature)
```

### Step 6 — Handle User Response

- **User confirms** (yes/y): proceed with detected classification
- **User provides different type**: use user-provided type, look up phase set from `execution_phases.json`

### Step 7 — Resolve Affected Repos

Ghostfolio is a single-repo project. Set:

```json
{ "source": "codebase_scan", "repos": ["ghostfolio"], "confidence": "high" }
```

### Step 8 — Initialise Pipeline State

```bash
mkdir -p docs/artifacts/<ticket>/.state
```

Read model assignments from `config/pipeline-models.json` (never hardcode):

```bash
python -c "import json; cfg=json.load(open('config/pipeline-models.json')); print(json.dumps(cfg))"
```

Write `docs/artifacts/<ticket>/.state/pipeline_state_<ticket>.json` with only the phases in the confirmed phase set.

### Step 9 — Initialise Artifact Digest

Create `docs/artifacts/<ticket>/.state/artifact-digest.md`:

```markdown
# Artifact Digest: <TICKET-ID>

## Classification

- Type: <confirmed type>
- Phase set: <phase1> → <phase2> → ...
- Reasoning: <one sentence summary>
```

---

## Exit Criteria

- [ ] Ticket type confirmed by user
- [ ] Phase set derived and stored in `pipeline_state`
- [ ] `pipeline_state_<ticket>.json` exists with all phases initialised as `pending`
- [ ] `artifact-digest.md` created with `## Classification` section
