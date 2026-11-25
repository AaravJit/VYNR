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
