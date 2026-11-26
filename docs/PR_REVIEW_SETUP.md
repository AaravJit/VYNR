# Automated PR review: setup

The repository contains the workflows. These steps need the owner, because they
create identities, secrets and branch rules that a pull request must not be
able to change. Changes to this file need the owner's review.

## How it works

```
pull_request ──► CI (ci.yml)                 no secrets, read-only token, runs PR code
                    │ completed + success
                    ▼
               Claude review (claude-review.yml, runs from the default branch)
                 job "review":  Claude, read-only tools (Read/Glob/Grep), returns JSON verdict
                 job "decide":  no model. Mints vynr-reviewer App token, then:
                                  PR head still == reviewed SHA?   else stop
                                  every check on that SHA green?   else COMMENT
                                  protected paths touched?         else COMMENT
                                  blocking/major finding?          REQUEST_CHANGES
                                  otherwise                        APPROVE (commit_id = SHA)
```

The model never holds a token that can approve. Approval comes from a separate
GitHub App, so it counts as an independent review and can never be the PR
author approving their own work. Nothing in this setup merges.

Why `workflow_run` rather than `pull_request_target`: the review must only start
after CI is green, and it runs the workflow file from the default branch, so a
PR cannot edit the reviewer that reviews it. PR files are checked out into
`pr-head/` for reading only; nothing there is installed or executed. Fork PRs
are skipped.

## 1. Create the reviewer GitHub App

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
   Name it `vynr-reviewer` (any unique name works). Disable webhooks.
2. Repository permissions: **Pull requests: Read and write**, **Contents: Read**,
   **Checks: Read**, Metadata: Read. Nothing else.
3. Create it, generate a private key, and install it on this repository only.

## 2. Add the secrets and variable

Settings → Environments → New environment `pr-review`. Under *Deployment
branches and tags*, allow only the default branch. Then in that environment:

| Kind | Name | Value |
|---|---|---|
| Variable | `VYNR_REVIEWER_APP_ID` | The App's numeric ID |
| Secret | `VYNR_REVIEWER_PRIVATE_KEY` | The App's private key (PEM) |

Repository secret (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | A key for a workspace with a spend limit set |

`ci.yml` uses none of these. Fork PRs never receive them.

## 3. Branch ruleset for `main`

Settings → Rules → Rulesets → New branch ruleset, target the default branch:

- Require a pull request before merging, with **1 required approval**.
- **Dismiss stale pull request approvals when new commits are pushed.**
- **Require review from Code Owners** (so `.github/`, `CLAUDE.md` and the
  other protected paths always need you).
- **Require approval of the most recent reviewable push.**
- Require status checks to pass: `verify`. Require branches to be up to date.
- Block force pushes. Leave the bypass list empty.
- Do **not** turn on auto-merge for the repository.

With this ruleset, the App's approval can satisfy the one required review for
ordinary changes, but any change to protected paths still needs you.

## 4. Check it

Open a small PR from a branch in this repository. CI runs, then *Claude review*
posts a review from `vynr-reviewer`. Push another commit: the earlier approval
is dismissed and a new review follows.

## Notes

- Actions are pinned to full commit SHAs (claude-code-action v1.0.290). Update
  them deliberately, in a PR you review yourself.
- GitHub changes `pull_request_target` defaults on 2 December 2026. This setup
  does not use `pull_request_target`, so it is unaffected.
- The reviewer never merges. If you ever want automated merging, that is a
  separate, explicit decision for the owner.
