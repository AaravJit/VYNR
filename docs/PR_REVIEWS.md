# Automatic independent PR reviews

Two GitHub Actions workflows provide CI and an independent AI review with conditional approval. The rules reviewers follow are in `CLAUDE.md`.

## How it works

1. **CI** (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: `npm run verify` (typecheck, lint, app and server tests) and the native bundle export.
2. **Independent review** (`.github/workflows/claude-review.yml`) starts only when CI **succeeds** on a pull request from this repository. It reviews exactly the commit CI tested:
   - It checks out that commit read-only and runs the Claude Code GitHub Action to review the diff against `CLAUDE.md`. Claude posts one review comment with findings marked BLOCKING or NON-BLOCKING and writes a one-word verdict.
   - Claude itself has no permission to approve or merge. A separate shell step approves **only if** the verdict is APPROVE, the PR's head is still that exact commit, every other check on it is green, and the PR author is not the approving identity.
   - The approval comes from `github-actions[bot]`, which is never the author of a PR, so nobody approves their own work.
   - Nothing ever merges. The owner merges.

## Security design

- `workflow_run` always runs the workflow file from the default branch, so a pull request cannot rewrite its own review rules or give itself access to secrets.
- PR code is never installed, built or executed in the review job. It is only read.
- Pull requests from forks are skipped entirely, so untrusted contributors never trigger a job with the API key.
- Permissions are the minimum needed: read contents, checks and actions; write pull-request reviews.
- Claude's tools are restricted to reading files, `gh pr diff`, `gh pr view`, commenting reviews, and writing the verdict file.
- For stricter supply-chain hardening, pin each action to a full commit SHA instead of a major version tag.

## One-time setup (owner)

These need your GitHub account and an API key, so they can't be done from here:

1. **Merge this PR** so both workflow files are on `main`. `workflow_run` only fires for workflows that exist on the default branch.
2. **Add the API key secret:** Settings → Secrets and variables → Actions → New repository secret, named `ANTHROPIC_API_KEY`. Use a separate key from the recognition server, with its own spend limit in the Anthropic console.
3. **Allow Actions to approve:** Settings → Actions → General → Workflow permissions → tick "Allow GitHub Actions to create and approve pull requests".
4. **Install the Claude GitHub App** (https://github.com/apps/claude) on the repository, which the action uses for its review comments.
5. **Branch protection for `main`** (recommended): Settings → Branches → Add rule. Require a pull request, require 1 approval, require the `verify` status check, dismiss stale approvals when new commits are pushed, and do not allow bypassing. Leave auto-merge off.

With "dismiss stale approvals" on, any new commit removes the approval and the cycle runs again on the new head.

## Cost

Each review is one Claude Code run over the diff. Large PRs cost more. Set a monthly spend limit on the key used for reviews.
