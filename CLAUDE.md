# VYNR: instructions for Claude

These are the owner's standing instructions for anyone (human or AI) working in this repository. The Phase 2 directive (25 November 2026) supersedes the original MVP brief wherever they conflict. See also `AGENTS.md` for Expo-specific rules.

## Authority

- Make routine engineering, design and architectural decisions independently: research alternatives, choose, implement, test and review without asking.
- Ask the owner first for anything that costs money, needs new credentials or accounts, or needs new permissions. Never purchase anything without explicit authorisation.
- Never merge a pull request automatically. Merging is always a human action.

## Commands

```bash
npm run verify            # typecheck, lint, app tests, server typecheck and tests (must pass before pushing)
npm run export:check      # iOS and Android bundle build (EXPO_OFFLINE=1 if api.expo.dev is unreachable)
node server/scripts/sync-shared.mjs   # after editing src/services/jpeg.ts or src/recognition/validate.ts
```

Run only the failing tests while fixing, then the full `npm run verify` before pushing.

## Product rules (non-negotiable)

- Never perform licence plate recognition or store or transmit text read from an image. Text and face detection may only produce bounding boxes for redaction; any recognised text is discarded immediately.
- Faces and licence plates are redacted on the device before a photo is uploaded or kept. If redaction cannot run, the photo is not uploaded and not kept (fail closed).
- Strip image metadata, never collect precise location, minimise retention.
- No secrets in the app. `EXPO_PUBLIC_*` values are public. AI credentials live only on the server.
- Validate every external input and every AI response on both client and server.
- Keep the cost controls: client daily cap, server rate limits, daily request budget and daily spend ceiling (`DAILY_SPEND_LIMIT_USD`, $2/day by default during development).
- Simulated recognition is development-only and always labelled.
- Rarity comes from the curated catalog, never from the AI. Never invent specifications, trims or model years. Specifications may only come from a properly licensed source recorded in `docs/DATA_PROVENANCE.md`.
- Never encourage trespassing, distracted driving or approaching vehicles. Never interact with vehicle locks, keys, electronics or security systems.
- The visual identity is VYNR's own: a pink, violet and blue palette. Do not copy another game's or app's branding, layouts, art, logos or sounds.

## Engineering standards

- TypeScript strict, Expo Router, React Compiler rules (no ref reads or impure calls during render, no setState in effects).
- Every screen handles loading, empty and error states and has accessibility labels. No buttons that do nothing and no misleading placeholders.
- New logic gets tests. Domain logic stays pure and deterministic.
- Keep `PROGRESS.md`, `TASKS.md` and the docs in `docs/` accurate. Never report a feature as working unless it was verified, and say how.

## Pull request reviews

Every pull request is reviewed independently by `.github/workflows/claude-review.yml` after CI passes. Reviewers (human or AI) follow these rules:

1. Review the exact head commit that CI tested. A review of an older commit does not count.
2. Check correctness, security and privacy, and every rule in this file. Verify each finding against the code before reporting it.
3. Label each finding BLOCKING (a bug, a security or privacy problem, a broken rule above, missing tests for new logic, or failing CI) or NON-BLOCKING (style, naming, optional improvements).
4. Approve only when CI is green on that exact head, there are no BLOCKING findings, and the reviewer is not the PR's author. The approval identity is the `github-actions[bot]` workflow, never the author's account.
5. Never self-approve and never merge. Approval is a signal for the owner, who merges.
6. If the head changes during review, discard the verdict and review the new head.

When you are the author responding to a review: fix BLOCKING findings, answer each thread, and push. Do not dismiss or resolve a security finding without the owner's decision.

Setup and security notes for the review workflow are in `docs/PR_REVIEWS.md`.
