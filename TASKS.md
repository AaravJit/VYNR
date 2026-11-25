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
- [x] Original icon, splash and adaptive icons
- [x] Docs: README, architecture, privacy, data provenance, deployment

## Needs the owner (external)

- [ ] Create an Anthropic API key, set a monthly spend limit, and deploy `server/` with HTTPS (docs/DEPLOYMENT.md)
- [ ] Set `EXPO_PUBLIC_RECOGNITION_ENDPOINT` for release builds
- [ ] Apple Developer and Google Play accounts; confirm the bundle id `com.aaravjit.vynr`
- [ ] Run the manual device test script in PROGRESS.md on a real iPhone and Android phone
- [ ] Choose a licence for the repository (none is included yet)
- [ ] Publish a privacy policy based on docs/PRIVACY.md
- [ ] Human review of catalog years and rarity tiers

## Next (post-MVP)

Priority order:

1. **On-device plate and face blurring** before upload (for example a small detection model through a native module). Highest privacy value.
2. **Device attestation** (App Attest, Play Integrity) on recognition requests, replacing the anonymous install id as the abuse boundary.
3. **Shared rate-limit store** (Redis or similar) so the server can run more than one instance.
4. **Identification integrity for multiplayer**: server-verified sightings before any leaderboard. Today, manual picks are trusted.
5. Expand the catalog (more generations, more makes, regional models), with a review process.
6. Optional cloud backup and sync using the export format.
7. Seasonal events and manufacturer-themed weekly contracts.
8. Localisation.
