---
name: sdlc-pr-creation
description: >
  Phase 10 of the SDLC pipeline. Creates a pull request on rajagondap/ghostfolio
  using gh CLI, links it to the GitHub Issue, and posts a summary comment.
allowed-tools:
  - Read
  - Bash
  - Write
---

<!-- Generated for Ghostfolio — rajagondap/ghostfolio | gh-cli auth -->

## Active Client Tools

- **pm-system:** github-issues (gh-cli)
- **scm:** github (gh-cli)

# Phase 10 — PR Creation

## Client Context (read at runtime)

| File           | How to use                                                       |
| -------------- | ---------------------------------------------------------------- |
| `client-kb.md` | Read GitHub org, repo, default branch, branch naming convention. |

---

## Purpose

Create a pull request for the implementation. Link back to the GitHub Issue. Final pipeline step.

---

## Arguments

| Argument             | Required |
| -------------------- | -------- |
| `--ticket=TICKET-ID` | Yes      |

---

## Pre-flight Checks

```bash
# 1. Check gh CLI is authenticated
gh auth status

# 2. Confirm not on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "ERROR: Cannot create PR from main branch"
  exit 1
fi

# 3. Check for uncommitted changes
git status --porcelain

# 4. Verify branch has commits ahead of main
git log --oneline $(git merge-base HEAD origin/main)..HEAD
```

---

## Extract Ticket ID

Ticket ID is in GH-NNN format. Extract issue number: `ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')`

---

## Gather Context

```bash
git log --oneline --no-merges $(git merge-base HEAD origin/main)..HEAD
git diff --stat $(git merge-base HEAD origin/main)..HEAD
```

Also read SDLC artifacts if available:

- `docs/artifacts/<ticket>/ph9_risk_assessment.md` — monitoring requirements
- `docs/artifacts/<ticket>/ph8_verification_report.md` — test scores

---

## Generate PR Title

Format: `<TICKET-ID>: <Short description>`

- Imperative mood, ≤72 chars
- Example: `GH-3: Add historical FX rate lookup to exchange rate service`

---

## Generate PR Description

Read `templates/pr-description.md` for the template structure.

For Ghostfolio (no Jira):

- Replace `[<TICKET-ID>](<JIRA_BASE_URL>/browse/<TICKET-ID>)` with `Closes #<ISSUE_NUM>` where ISSUE_NUM is the GitHub issue number
- Fill all sections from git diff, commit messages, and SDLC artifacts

---

## Push Branch and Create PR (gh CLI)

```bash
# Push branch
git push origin HEAD

# Create PR
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')

gh pr create \
  --title "<TICKET-ID>: <description>" \
  --body "$(cat <<'PRBODY'
### Ticket Reference

Closes #<ISSUE_NUM>

---

### Type of Change

- [x] <type of change>

---

### Context

**Before:**
[Previous behavior]

**After:**
[New behavior]

---

### Architecture Document

[ph2_design_spec.md](docs/artifacts/<TICKET-ID>/ph2_design_spec.md)

---

### How Has This Been Tested?

- [x] Unit tests added / updated and passing (`npm test`)
- [x] Manually tested locally

---

### Checklist

- [x] My code follows the project's coding and PR guidelines
- [x] I have added or updated unit/integration tests
- [x] All new and existing tests pass locally
- [x] My code does not send any PII data in logs
- [x] Performed a self-review of my own code
- [x] Removed all unnecessary comments and logs

---

### SDLC Pipeline Artifacts

- [Requirements](docs/artifacts/<TICKET-ID>/ph1_problem_spec.md)
- [Architecture](docs/artifacts/<TICKET-ID>/ph2_design_spec.md)
- [Verification Report](docs/artifacts/<TICKET-ID>/ph8_verification_report.md)
- [Risk Assessment](docs/artifacts/<TICKET-ID>/ph9_risk_assessment.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code) via Agentic SDLC Pipeline
PRBODY
)" \
  --base main \
  --repo rajagondap/ghostfolio
```

---

## Link PR to GitHub Issue

GitHub auto-links via `Closes #<ISSUE_NUM>` in the PR body — no additional API call needed.

---

## Post Summary Comment on GitHub Issue

```bash
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
PR_URL=$(gh pr view --repo rajagondap/ghostfolio --json url --jq '.url')

gh issue comment "$ISSUE_NUM" --repo rajagondap/ghostfolio --body "**[Phase 10 — PR Creation]: completed**

Pull request created: $PR_URL

Pipeline complete — all phases executed successfully."
```

---

## After Creation

1. Display the PR URL prominently
2. Update GitHub Issue label: remove `pipeline:in-progress`, add `pipeline:in-review`

```bash
ISSUE_NUM=$(echo "<TICKET-ID>" | sed 's/GH-//')
gh issue edit "$ISSUE_NUM" --repo rajagondap/ghostfolio --remove-label "pipeline:in-progress" --add-label "pipeline:in-review" 2>/dev/null || true
```

3. Remind user to add screenshots if UI changes are present
4. Optional: watch CI: `gh pr checks --watch`

Update `pipeline_state_<ticket>.json` → `phases.pr-creation.status = "completed"`.

---

## Exit Criteria

- [ ] Pre-flight checks passed
- [ ] Branch pushed
- [ ] PR created with `Closes #<ISSUE_NUM>` in description
- [ ] PR URL displayed
- [ ] Summary comment posted on GitHub Issue
- [ ] `pipeline_state_<ticket>.json` → `phases.pr-creation.status = "completed"`
