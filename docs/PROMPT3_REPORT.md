# Prompt 3 report and continuation checkpoint

Branch `integration/prompt3`, draft PR #3. Last updated 25 November 2026. Nothing is merged to `main`, nothing is purchased, and nothing is published.

## 1. What was built

| Priority | Area | State | Verified by |
| --- | --- | --- | --- |
| 1 | **Integration of PR #1 and PR #2** | Done: PR #2 is the base; PR #1's redaction and contrast tests are ported; the uncompiled native module is removed | Tests, bundle build |
| 1 | **Automatic live scanning** (no shutter) | Done in code: frame sampling, ML Kit box proposals, target selection and tracking, sharpness, exposure and stability gates, perceptual-hash duplicate suppression, cooldown, session cap, idle pause, backoff, crop to target, fail-closed redaction, shared consent and allowance checks, result card with alternatives and "try another angle", haptics, reduced-motion aware | 23 unit tests for the policy and loop, UI tests. **Not run on a device** |
| 2 | Vehicle intelligence | Unchanged from PR #2: catalog facts and seeded, labelled fictional street intel. Wikipedia-derived specs are **quarantined** (not shown) pending approval | Tests |
| 3 | Ownership, progression, VC | Server: verified discoveries, collectibles with provenance, ledger, achievements (discovery and ownership tracks), XP | 44 economy tests and HTTP tests |
| 4 | Crates | Server: 8 pools, published odds, pity, idempotent opening, interruption recovery, deterministic showroom | Tests, including a distribution test |
| 5 | Marketplace | Server: list, search and filter, buy, cancel, provenance, sale history, wishlist, watchlist, 5% burned fee, price bounds, trade hold, eligibility, block | Tests, including races across two connections |
| 6 | VYNR Black | Server: entitlement states and store-state mapping; verifiers **refuse** without credentials; cost and margin analysis | Tests. No sandbox purchase was possible |
| 7 | Garage and seasons | Server: cosmetics (6 environments, skins, frames, titles), showcase, "Midnight Japan" season with free and premium tracks (premium is cosmetic only) | Tests |
| 8 | Community | Server: optional public profiles, handles, showcase, report, block. No direct messages, no location | Tests |
| All | **Client screens for crates, market, garage albums, season and paywall** | **Not built.** The server API is ready; screens are Prompt 4 item 1 | n/a |

## 2. Decision register

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| PR #2 as the integration base | PR #1 as base | Camera-first home, quieter design closer to Prompt 3's "Cal AI simplicity", persistent quota store and model tiering already there |
| PR #1's redaction (ML Kit modules plus JS pixelation) | PR #2's custom Swift/Kotlin module | Maintained modules, tested pixelation; the custom module had never compiled |
| Quarantine Wikipedia specs | Ship them with attribution | CC BY-SA share-alike obligations and the owner's directive; needs an owner decision |
| Live scanning with periodic silent stills | Vision Camera frame processors | No new native dependency, works with expo-camera; 0.7 s cadence is enough for parked cars |
| ML Kit default detector as a class-agnostic box proposer | ML Kit image labeling base model (has "Car") | The maintained Expo labeling module only loads custom models; vehicle confirmation stays in the cloud answer |
| Cloud gate: steady target, sharp, exposed, new view, 4 s cooldown, 12 per session | Every N seconds | "Do not continuously transmit every camera frame" |
| SQLite (node:sqlite) for the economy | Postgres now | Same stack as the existing server; single-writer transactions give strict integrity; Postgres port documented for scaling out |
| Anonymous device accounts with bearer tokens | Sign in with Apple or Google at launch | No registration needed for identification; Apple 4.8 needs Sign in with Apple only if third-party login is added |
| Discoveries must cite a server recognition record | Trust the client | Prompt 3: never trust client ownership or outcome claims |
| Crates priced at about 0.9 of expected value, plus a showroom | Cheaper crates | Simulation showed oversupply; the showroom is the deterministic alternative |
| No VC for subscribers, cosmetic-only premium track | VC stipend | Prompt 3 prohibition; validated in config |
| Allowances: free 25/day on the server and 20 on the phone; Black 40/day | 50 free and 100 Black | Margin table in `SUBSCRIPTION_ECONOMICS.md` |
| $2/day development spend default | $5 (PR #2) | Owner's standing rule |

## 3. Test report

Run on 25 November 2026 in the cloud build environment (no device, no simulator, no API key).

| Check | Command | Result |
| --- | --- | --- |
| App type check, lint and tests | `npm run verify` (app part) | Pass. **267/267 tests** in 19 suites |
| Server type check and tests | `npm run verify` (server part) | Pass. **87/87 tests** |
| Native bundles | `EXPO_OFFLINE=1 npm run export:check` | iOS and Android Hermes bundles built |
| Economy simulation | `node server/scripts/simulate-economy.ts 90 240 1` | All invariants hold (see `ECONOMY.md`) |

What the tests prove (all against mocks or in-memory databases, **not** devices or live services):

- **Live scanning:** blurred, dark, far or moving views never reach the cloud. Duplicates are suppressed. The cooldown and session cap hold. Unused frames are deleted. Cancelling discards a late answer. Repeated failures stop the loop.
- **Recognition gates:** nothing is uploaded without redaction (unavailable, failed or missing), consent (rechecked just before upload), or allowance.
- **Currency and inventory integrity:** balance equals ledger. Database rejects negative balances. Failures roll back. 3,000 random mixed operations keep every invariant.
- **Concurrency:** two buyers racing for one listing through two connections: exactly one wins. One buyer spending the same VC twice through two connections: one fails.
- **Crates:** published odds sum to 1. 6,000 draws match the odds within 4 standard deviations. Pity holds over 200 openings. A retry with the same key never charges twice.
- **Entitlements:** grace keeps access; hold, expiry, refund and revocation remove it. Billing refuses without credentials.
- **Auth:** tokens are stored only as hashes. Deleted accounts lose access. Write rate limits and account-creation limits work.
- **Privacy:** provenance and listings never expose account ids. Export and deletion work.

**Not verified:** anything on a physical device (camera sampling, ML Kit detectors, haptics, thermal and battery behaviour, layouts on real screens), the live Anthropic API, store sandbox purchases. There are no new screenshots, because the scanner needs a real camera and the web preview has none.

## 4. Device test instructions

1. `npx expo prebuild` and build a development client for iOS and Android (`npx expo run:ios`, `npx expo run:android`). The ML Kit modules do not run in Expo Go.
2. Start the server with `ANTHROPIC_API_KEY` set (owner credential) and point `EXPO_PUBLIC_RECOGNITION_ENDPOINT` at it.
3. Outdoors, from the sidewalk, point at a parked car. Expected: hint pill moves from "Point at a car" to "Hold steady", target brackets appear, "Identifying…", then a result card. Check that no request is sent while panning, in the dark, or when pointing at the same car again (watch the server log).
4. Point at two cars: the brackets should follow the larger, central one, and the uploaded photo should be cropped to it.
5. Turn off cloud consent in Profile: the scanner should stop and offer manual identification.
6. Leave the scanner idle for 45 s: it should pause. Background the app: the camera should stop.
7. Record cloud calls per verified discovery, and device temperature after 10 minutes of scanning. These feed `SUBSCRIPTION_ECONOMICS.md`.

## 5. Blockers (need the owner)

| Blocker | What is needed |
| --- | --- |
| Device testing | A development build on a real iPhone and Android phone (instructions above) |
| Anthropic API key on a server | Owner credential, for live recognition and the accuracy benchmark |
| Wikipedia spec data | Approve or reject use under CC BY-SA 4.0 (quarantined until then) |
| AutoDB | Network allowlist for autodb.store, or upload the free sample. Then written licence confirmation before any purchase |
| VYNR Black | App Store Connect and Play Console products, App Store Server API key, Google service account, sandbox testers |
| Legal review | Loot-box rules for earned-only crates (PEGI, UK ASA), consumer and subscription disclosure, privacy policy, age rating |
| Spend and quota changes | PR #3 lowers allowances and restores the $2/day default; these are protected config and need your approval |

## 6. Launch checklist

- [ ] Device tests pass on iOS and Android. Redaction recall checked on real photos of plates and faces.
- [ ] Benchmark run on real photos. Escalation rate and cost per call measured.
- [ ] Spec source approved, or the specs remain hidden.
- [ ] Store products configured; verifiers implemented with credentials; sandbox purchase, renewal, grace, refund and restore tested.
- [ ] Client screens for crates (odds visible before Open), market, garage, season and paywall, with disclosures.
- [ ] Privacy policy and in-app account deletion reviewed. Store privacy labels filled in.
- [ ] Store listing states "contains random item crates (earned currency only)". Age rating questionnaire answered after legal review.
- [ ] Backups scheduled and a restore tested. Invariant health check and spend alerts wired.
- [ ] Owner approves and merges.

## 7. Corrections for Prompts 4 and 5

**Prompt 4 (in priority order)**

1. Client economy screens on the existing API: wallet and ledger, crate list with full odds and pity, skippable accessible reveal with recovery of unseen openings, showroom, market (search, list, buy, watch, wishlist, provenance), garage albums and environments, season track, paywall listing `BLACK_BENEFITS`.
2. Account bootstrap in the app (create on first economy action, token in SecureStore) and the discovery claim from the identify screen (send `recognitionId`).
3. Read `recognitionId` in the remote provider (the validator currently drops unknown fields by design).
4. Implement the Apple and Google verifiers with credentials, and verify notification signatures.
5. Raise the client daily allowance for Black accounts to match the server.
6. Device-test live scanning and tune `DEFAULT_LIVE_SCAN_CONFIG` from measurements.
7. On-device vehicle classifier (Apache-2.0) or a small native wrapper for the ML Kit base labeler, to stop non-car objects earlier.
8. Anomaly detection and operator tooling (moderation queue, invariant dashboard).

**Prompt 5**

1. Postgres port of `EconomyStore` before running more than one instance.
2. Token rotation, optional Sign in with Apple or Google for recovery.
3. Seasonal and manufacturer crates through remote config, with availability windows.
4. Shareable profile links and public showcases on the web.
5. Accessibility audit on device (VoiceOver and TalkBack across the new screens), plus outdoor readability checks.

## 8. Where to pick up

- Code: `src/scanner/` (live scanning), `src/recognition/gated.ts`, `server/src/economy/`.
- Docs: `SOURCE_REGISTER.md`, `DATA_SOURCES.md`, `ECONOMY.md`, `SUBSCRIPTION_ECONOMICS.md`, `THREAT_MODEL.md`, `BACKEND.md`.
- Next action: Prompt 4 item 1, starting with the crate screen (odds already served by `GET /v1/config`).
