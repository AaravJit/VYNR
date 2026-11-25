# Architecture

## Overview

```
┌──────────────────────── Phone (offline-first) ────────────────────────┐
│ Expo Router screens (src/app)                                          │
│      │ useAppState / useAppStore (useSyncExternalStore)                 │
│      ▼                                                                  │
│ AppStore (src/state) ──► GameService ──► applyEncounter (pure engine)   │
│      │                        │                                         │
│      │                        ▼                                         │
│      │                 GameRepository ──► SqlDriver ──► SQLite file     │
│      ▼                                                                  │
│ Recognition: provider interface                                         │
│   ├─ MockRecognitionProvider (dev only, labelled SIMULATED)             │
│   └─ RemoteRecognitionProvider ──HTTPS──┐                               │
└─────────────────────────────────────────│───────────────────────────────┘
                                          ▼
                  VYNR recognition server (server/, Node)
                  validation · metadata strip · rate limits · daily budget
                                          │
                                          ▼
                                 Anthropic Messages API
```

## Layers

**Domain (`src/domain`)** is pure TypeScript with no I/O. `applyEncounter(snapshot, input, catalog, config, newId)` takes the current game state and one new sighting and returns everything that must change: the encounter record, XP ledger entries, contract progress, unlocked achievements, manufacturer completions, collection milestones, and the level before and after. Because it is pure, the progression rules are unit tested deterministically with a fixed clock and id factory.

All economy numbers live in `src/domain/config.ts` (`GAME_CONFIG`):

| Rule | Value |
| --- | --- |
| Rarity XP | Common 25, Uncommon 75, Rare 250, Exotic 750, Legendary 1,500 |
| Duplicates | 1st sighting 100%, 2nd 40%, 3rd 20%, then 10% (minimum 1 XP) |
| Duplicate cooldown | Same vehicle within 10 minutes earns 0 XP (stops burst farming) |
| Unknown vehicles (field notes) | 10 XP, at most 5 per day |
| Levels | XP to next level = 100 × level^1.5, capped at level 60 |
| Manufacturer completion | +500 XP for every catalog generation of a make |
| Collection milestones | 10/25/50/75/100% of the catalog: +250/750/2,000/4,000/10,000 XP |
| Contracts | 3 daily, 3 weekly, generated from templates |

Rarity always comes from the curated catalog, never from the AI.

**Contracts** are generated deterministically from a seeded PRNG (FNV-1a hash of player id and period key, then mulberry32). The same player in the same day or ISO week always gets the same contracts, and on a future server the same contracts can be regenerated and verified. Progress is recomputed from encounters in the period rather than incremented, so it can never drift. Only encounters that earned XP count, so cooldown farming does not advance contracts.

**Persistence (`src/db`)** uses SQLite as the source of truth. The schema is versioned with `PRAGMA user_version`, and migrations run on every launch. Tables: `player`, `settings`, `encounters`, `xp_ledger`, `contracts`, `awards`, `recognition_usage`. CHECK constraints reject impossible values (an unknown encounter source, negative XP). XP is an append-only ledger, and total XP is always `SUM(xp_ledger.amount)`, so there is no separate counter to fall out of sync. Each encounter outcome is written in one transaction: either everything is saved or nothing is.

`SqlDriver` is a small interface. Production uses `ExpoSqlDriver` (expo-sqlite, with all calls serialised through a queue so transactions cannot interleave). Tests use `NodeSqlDriver` over Node's built-in `node:sqlite`, so the integration tests run the real migrations and repository against a real SQLite engine.

**State (`src/state`)** has an `AppStore` that loads a snapshot from SQLite, exposes it through `useSyncExternalStore`, and reloads after each write. Screens never write to the database directly. The scan session (photo, recognition result, manual correction) is kept in memory only.

**Recognition (`src/recognition`)**:

- `RecognitionProvider` is the extension point: `recognize(image) → { vehicleDetected, candidates[{make, model, generation, confidence}], notes, provider, simulated }`.
- `parseRecognitionResponse` validates every response, whether it comes from the network or a model. It rejects malformed payloads, out-of-range confidence and wrong types, strips control characters, truncates strings and caps the number of candidates.
- `matchCandidates` maps predictions onto catalog entries using make and model aliases (for example "VW Golf GTI" maps to Volkswagen Golf GTI). When no generation is given, it offers every generation of that model rather than guessing. Predictions that are not in the catalog are shown as such and can be logged as field notes.
- The identify screen separates **VERIFIED CATALOG RECORD** (make, model, generation, years, country, category and rarity from the curated catalog) from **AI PREDICTION** or **SIMULATED PREDICTION** (with confidence). It always shows that trims and exact model years cannot be determined from a photo.
- Mode selection (`config.ts`): development builds default to the simulated provider. Release builds without an endpoint are `unconfigured` and offer manual identification only, and they ignore a request for simulated mode. Remote mode requires https outside development.

**Server (`server/`)** is a dependency-light Node HTTP server (only `@anthropic-ai/sdk`). Node runs the TypeScript directly through type stripping. It shares the JPEG metadata stripper and the response validator with the app through generated copies in `server/src/shared` (`node scripts/sync-shared.mjs`), and a test fails if the copies drift.

Request pipeline for `POST /v1/recognize`:

1. Content type must be JSON. `X-Install-Id` must be 16–64 hex characters.
2. Rate limits: per IP per minute and day, then per install per minute and day. Returns 429 with `Retry-After`.
3. Body size cap (streamed, 413). Strict validation of `{image, width, height}`: base64, JPEG magic bytes, dimension bounds.
4. Metadata is stripped again on the server, so EXIF, GPS and ICC data never reach the AI provider.
5. A concurrency cap and a global daily request budget (503 when spent) bound the cost.
6. Claude call with structured JSON output, low effort, and server-side fallback models. Refusals, truncation and invalid JSON are rejected. The output is validated with the same validator as the app.
7. Responses carry `no-store` and `nosniff`. Logs contain only method, path, status and duration: no ids, IPs or image data.

## Multiplayer readiness

Multiplayer is not implemented, but the data model is ready for it:

- Every record has a stable random id, and encounters carry `source`, `provider` and `confidence`, so a server could weight or audit them.
- XP is an append-only ledger with reasons and references, which can be replayed or reconciled against a server.
- Contracts are deterministic per player and period, so a server can regenerate and verify them.
- The engine is pure and would run unchanged on a server for authoritative scoring.
- The export format (`vynr-export`, versioned) is a ready-made sync payload.

Before adding leaderboards, identification needs server-side verification: today a player can pick any catalog vehicle manually after taking a photo (see Known limitations in PROGRESS.md).

## Design system

Near-black surfaces (`#07080A`) with an electric lime accent (`#C6FF3D`) used sparingly for state and action. Each rarity has its own colour. Type uses Inter Tight for UI text and JetBrains Mono for data readouts. Panels use bracket corners that echo the scanner reticle. Vehicles are shown as typographic emblem tiles rather than photos, so no third-party car imagery is needed. All icons are original SVG paths in `src/components/Icon.tsx`, and the app icon is generated by `scripts/generate-icons.py`.
