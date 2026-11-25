# Tasks

## Done (MVP)

- [x] Expo SDK 58 + TypeScript strict + Expo Router app with original visual identity
- [x] Game engine: rarity XP, diminishing duplicates with cooldown, levels, 15 achievements, manufacturer completion, collection milestones, daily and weekly contracts
- [x] Curated catalog: 36 makes, 133 generations, 6 countries, 5 rarity tiers, aliases and search
- [x] SQLite schema with migrations, constraints, atomic writes and an append-only ledger
- [x] Recognition provider interface, labelled simulated provider, remote provider, strict validation, catalog matching
- [x] Screens: onboarding (safety, privacy consent, callsign, camera), home, scanner, identify and review, manual correction, field notes, discovery reveal, garage with filters, search and sort, vehicle detail with sighting history, contracts, profile with settings, achievements, export and delete, privacy
- [x] Recognition server: validation, metadata stripping, per-install and per-IP limits, global daily budget, concurrency cap, structured Claude output, no logging of personal data
- [x] Client-side daily recognition cap and consent gate
- [x] Error boundary, loading, empty and failure states, accessibility labels
- [x] Tests: 90 app tests (unit, real-SQLite integration, UI) and 26 server tests
- [x] Original icon, splash and adaptive icons (replaced in phase 2)
- [x] Docs: README, architecture, privacy, data provenance, deployment

## Done (phase 2)

- [x] RESEARCH.md: design references, vision models and cost, spec data licensing, on-device redaction, Expo camera, secure PR review
- [x] "Dusk" design system (pink, violet, blue), aperture logo and icon set, original sounds, scanner as the home tab, floating tab bar
- [x] Immersive scan report: redaction chip, analysis sweep, match band, one-tap "Register discovery", verified specs with sources, street intel
- [x] First-discovery animation, sounds and haptics; vehicle detail shows stored intel
- [x] Street intel engine (simulated, seeded, security-free), stored via migration v2
- [x] Verified specs for 66 generations from Wikipedia with per-record sources; build script and CI freshness check
- [x] On-device face and plate redaction module (iOS Vision, Android ML Kit), fail-closed
- [x] Server: persistent quotas, spend ceilings, duplicate cache, Haiku → Sonnet escalation, cost accounting
- [x] Benchmark harness and protocol (not yet run)
- [x] CI workflow, Claude review workflow with separate approver App, CODEOWNERS, CLAUDE.md review policy
- [x] PR #1 regression fixes with tests

## Needs the owner (external)

- [ ] Build a development build and run the device test script; confirm redaction blurs faces and plates
- [ ] Set up the reviewer GitHub App, secrets and ruleset (docs/PR_REVIEW_SETUP.md)
- [ ] Collect ~300 licensed photos and run the benchmark (docs/BENCHMARK.md)
- [ ] Review the 66 spec records against manufacturer material
- [ ] Create an Anthropic API key, set a workspace spend limit, and deploy `server/` with HTTPS and a persistent volume (docs/DEPLOYMENT.md)
- [ ] Set `EXPO_PUBLIC_RECOGNITION_ENDPOINT` for release builds
- [ ] Apple Developer and Google Play accounts; confirm the bundle id `com.aaravjit.vynr`
- [ ] Run the manual device test script in PROGRESS.md on a real iPhone and Android phone
- [ ] Choose a licence for the repository (none is included yet)
- [ ] Publish a privacy policy based on docs/PRIVACY.md
- [ ] Human review of catalog years and rarity tiers

## Next (post-MVP)

Priority order:

1. **Run the benchmark**, then tune the escalation threshold and decide whether confidence bands can be shown with more precision.
2. **Specs for the remaining 67 generations**, preferably from Wikidata (CC0) with manufacturer figures.
3. **Device attestation** (App Attest, Play Integrity) on recognition requests, replacing the anonymous install id as the abuse boundary.
4. **Shared state store** (Postgres or Redis) so the server can run more than one instance.
5. **Identification integrity for multiplayer**: server-verified sightings before any leaderboard. Today, manual picks are trusted.
6. Expand the catalog (more generations, more makes, regional models), with a review process.
7. Optional cloud backup and sync using the export format.
8. Seasonal events and manufacturer-themed weekly contracts.
9. Localisation.
