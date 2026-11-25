# VYNR implementation plan

This is the plan the MVP was built against. Design details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Goals

- Complete loop: launch → onboarding → camera permission → photo → identification → review/correct → add to garage → XP → contract and achievement progress → survives restart.
- Offline-first: the game works with no network. Only automatic identification needs the server.
- No secrets in the app, no unnecessary infrastructure and no paid services besides the AI API.
- Honest UI: verified catalog facts are visually separate from AI predictions, simulated results are always labelled, and the app never invents trims, years or specs.

## Key decisions

| Decision | Why |
| --- | --- |
| Expo SDK 58, Expo Router, TypeScript strict, React Compiler | Current Expo stack; file-based routes; one codebase for iOS and Android |
| SQLite (expo-sqlite) as the source of truth, with versioned migrations | Durable, transactional and offline. No backend database to run |
| Pure domain engine separate from storage | Deterministic tests for every progression rule; can run on a server later |
| Append-only XP ledger | Totals cannot drift; auditable; ready for sync |
| Seeded deterministic contracts | No server needed to generate them; verifiable later |
| Generation-level catalog with curated rarity | Matches what a photo can actually tell you; rarity cannot be gamed through the AI |
| Thin Node server with only the Anthropic SDK as a dependency | Keeps the key off devices; easy to host anywhere; easy to audit |
| Claude vision with structured JSON output, validated on both sides | Reliable parsing; untrusted output never reaches the UI unvalidated |
| Typographic emblem tiles instead of car photos | No image licensing; consistent look |
| No accounts or analytics | Smallest possible data footprint for an MVP |

## Phases

1. Scaffold, design tokens, UI kit, icons.
2. Domain engine and game config, with unit tests.
3. Catalog with integrity tests.
4. SQLite schema, migrations, repository and store, with integration tests on real SQLite.
5. Recognition interface, validation, matcher, simulated and remote providers.
6. Screens: onboarding, home, scanner, identify, catalog picker, discovery, garage, vehicle detail, contracts, profile, privacy.
7. Recognition server with rate limits, budget and tests.
8. App icon, splash and app config.
9. Docs, full verification, native bundle export.
10. Adversarial audit and fixes.

All phases are complete. See [PROGRESS.md](PROGRESS.md) for results and [TASKS.md](TASKS.md) for what remains.

## Phase 2: immersion, accuracy, autonomous review

Evidence and alternatives are in [RESEARCH.md](RESEARCH.md). Decisions:

| Decision | Why |
| --- | --- |
| Scanner is the first tab; old home becomes "Career" | Cal AI pattern: open → shoot → result, two taps to a registered discovery |
| "Dusk" palette, Inter Tight only, aperture logo, synthesised sounds | Original identity in the spirit of an in-game phone app; nothing copied from Rockstar (docs/DESIGN.md) |
| Confidence shown as a band, not a % | Model confidence is self-reported and unbenchmarked |
| Specs from Wikipedia per generation, with source links, options listed not guessed | Only legally usable source reachable; CC BY-SA attribution by link; no fabrication |
| Street intel generated on the phone from a seed and stored with the encounter | Free, offline, stable, and provably independent of real security |
| Local Expo module for redaction (Apple Vision / ML Kit), fail-closed | Platform detectors, no model to ship, nothing unblurred leaves the phone |
| Haiku 5.5 first, Sonnet 5.5 only when unsure; SQLite server state | ~$0.33–$2.47 per 1,000 scans (estimate); quotas and spend survive restarts without new infrastructure |
| Claude reviews read-only; a separate non-LLM job approves as a GitHub App, bound to the SHA | The model never holds approval power; approval is independent of the author; never auto-merge |

Steps: research → cost controls and server state → design tokens and scanner → redaction module and photo pipeline → intel engine and migration → specs data → report and discovery screens → tests → review workflow → docs and verification.
