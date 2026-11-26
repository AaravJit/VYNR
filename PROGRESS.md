# Progress

## Prompt 3 (integration branch `integration/prompt3`, draft PR #3), 25 November 2026

- PR #1 and PR #2 reconciled on one branch. Wikipedia-derived specs were quarantined, then released on 26 Nov 2026 after the owner approved them under CC BY-SA 4.0 (credit, licence link, change note and data link shown in the app; tested in `test/specs.test.ts` and `test/ui/vehicleFacts.test.tsx`).
- **Automatic live scanning replaces the shutter.** On-device gates decide when a frame may be sent, and redaction still fails closed.
- **Server-authoritative economy:** accounts, VC ledger, verified discoveries, collectibles with provenance, crates with published odds, VC-only marketplace, achievements, seasons, cosmetics, profiles with report and block, and subscription entitlements. Billing refuses every purchase until store credentials exist.
- Verified: `npm run verify` (267 app tests, 87 server tests), native bundle export, economy simulation with all invariants holding.
- **Not verified:** devices, live API, store sandbox. The client economy screens are not built yet.
- Full report, blockers and next steps: `docs/PROMPT3_REPORT.md`.

---

Status as of 25 November 2026: **Phase 2 (immersion, accuracy, autonomous review) implemented and verified by automated tests and native bundle builds.** Still **not run on a physical device or simulator**, and the live Anthropic API and the new native redaction module have **not** been exercised: the build environment had no iOS or Android runtime and no API key.

## Verification results (phase 2)

| Check | Command | Result |
| --- | --- | --- |
| Type check (app) | `npm run typecheck` | Pass, strict mode |
| Lint | `npm run lint` | Pass, 0 warnings |
| App tests | `npm test` | **184/184 pass** in 13 suites |
| Server type check | `npm --prefix server run typecheck` | Pass |
| Server tests | `npm --prefix server test` | **39/39 pass** |
| Native bundles | `EXPO_OFFLINE=1 npm run export:check` | iOS and Android Hermes bundles build |
| Spec data | `npm run build:specs` | 66 records validated against the catalog and regenerated |
| Native redaction module (Swift/Kotlin) | needs `expo prebuild` + Xcode / Gradle | **Not compiled.** No native toolchain in the build environment |
| Recognition benchmark | `node server/scripts/benchmark.ts` | **Not run.** Harness tested with a fake provider only (docs/BENCHMARK.md) |
| Screenshots | | **None.** No simulator was available, so none are included |

New in phase 2 and covered by tests:

- **Redaction gate**: a photo whose faces and plates were not blurred is never uploaded and never kept; no allowance is used (UI tests for `unavailable`, `failed` and `redacted`).
- **Confidence**: shown as a band ("Strong / Possible / Weak match"), never a percentage (UI test asserts no `%`).
- **Street intel**: deterministic per seed; tracker and alarm grades identical across very different cars with the same seed; no repeated lines; the avoid set works; no security or theft wording anywhere in the catalog (scans every vehicle).
- **Migration v2**: a real v1 database upgrades in place keeping its rows; intel survives a restart; field notes never store intel.
- **Photo cleanup**: a thumbnail saved for an encounter that then fails to record is deleted.
- **Specs**: every record belongs to a catalog generation and cites an https source; generations without a record show nothing.
- **Scanner as home**: camera permission explanation, no capture without permission, shutter disabled until the camera is ready.
- **Server**: persistent rate limits and spend ledger survive a restart; daily and monthly dollar ceilings; worst-case reservation and settlement (including failed, billed calls); duplicate-photo cache and in-flight coalescing; Haiku → Sonnet escalation rules; cost accounting uses the model that actually answered.
- **Benchmark harness**: scoring and error handling.

## Acceptance criteria

| Step | Status |
| --- | --- |
| Launch → onboarding → scanner | Implemented; scanner (now the home tab) UI-tested; onboarding not covered by an automated test |
| Camera permission | Implemented with expo-camera; needs a device to verify |
| Photograph a vehicle | Implemented; needs a device to verify |
| Real identification when configured | Implemented end to end; tested with mocks only, not against the live API |
| Review and correct | Implemented and UI-tested |
| Add to collection, earn XP | Implemented and tested (UI plus real SQLite) |
| Contract and achievement progress | Implemented and tested |
| Close and reopen without losing progress | Tested on real SQLite with a new connection |
| Dev mode with mocked recognition | Implemented, labelled, tested |

## Manual device test script

Run on a physical iPhone and Android phone before release:

1. Fresh install. Go through onboarding: safety rules must be ticked, choose cloud consent, enter a callsign, grant camera permission.
2. The scanner opens first. Photograph a car with a person and a plate in frame: the report's chip must say areas were blurred, and the saved thumbnail (if Keep photos is on) must show them pixelated. Check the AI or SIMULATED label, the match band, the verified specs with source link, and the STREET INTEL panel.
2a. In Expo Go (no redaction module) the report must say "Photo kept on this phone" and nothing is uploaded.
3. Tap "Not right?" and pick another vehicle. Confirm the "IDENTIFIED BY YOU" label.
4. Tap "Register discovery". Check the reveal animation, the sound (rarer cars use a different one), the haptic, XP and level change, contract progress, and that "Continue scanning" returns to the camera.
5. Scan the same car again within 10 minutes: it should show "Logged recently" and +0 XP.
6. Force-quit and reopen. All progress must still be there.
7. Turn off cloud consent in Profile. Scan again: no network request, manual identification is offered.
8. Turn on Keep photos, log a sighting, check the thumbnail. Export data and inspect the JSON. Delete all data and confirm everything resets.
9. Deny camera permission on a fresh install and check the recovery path to Settings.
10. Turn on airplane mode: the game works, and scanning explains the network error and offers manual identification.

## Known limitations

- **Not run on a device or simulator yet.** Layout, camera start-up time, haptics, sounds and performance on real hardware are unverified.
- **Redaction not device-tested.** Detection uses ML Kit face detection and text recognition (bounding boxes only) through maintained Expo modules; pixelation is pure JavaScript and unit-tested. It fails closed (no upload, no thumbnail) when detection is unavailable, but detection quality (small or angled plates, faces in profile) is unmeasured.
- **Live AI not exercised and accuracy unmeasured.** The benchmark has not been run, so confidence bands are self-reported, not calibrated.
- **Specs cover 66 of 133 generations**, transcribed from Wikipedia with AI assistance and spot-checked; they need a human review before release (docs/DATA_PROVENANCE.md).
- **Cost figures are estimates** from published prices, not measured.
- **Automated PR review is not active** until the owner creates the reviewer App, secrets and ruleset (docs/PR_REVIEW_SETUP.md). The workflow has not run yet.
- **Honor system for manual picks.** Fine for single-player; must be solved before leaderboards.
- **The simulated provider ignores the photo.** It exists only to test the loop.
- **The install id is not attestation.** Per-IP, global and spend limits are the real abuse boundary.
- **Server state is one SQLite file**, so run one instance with a persistent volume.
- **Catalog years are approximate** and need a human review.
- **No account or cloud backup.**
- **No repository licence** has been chosen.

## Remaining external configuration

1. Anthropic API key, workspace spend limit, and an HTTPS host with a persistent volume for `server/` (docs/DEPLOYMENT.md).
1a. A development build (`eas build --profile development`) to compile the redaction module; Expo Go cannot load it.
1b. Reviewer GitHub App, `pr-review` environment secrets, `ANTHROPIC_API_KEY` repository secret and the branch ruleset (docs/PR_REVIEW_SETUP.md).
2. `EXPO_PUBLIC_RECOGNITION_ENDPOINT` in the EAS build environment.
3. Expo account; Apple Developer Program and Google Play Console for distribution.
4. Confirm or change the bundle id `com.aaravjit.vynr`.
5. Privacy policy URL, App Store privacy and Play data safety forms.

## Adversarial audit

Reviews during the build and a final audit against the brief found and fixed:

- A failed save sent the identify screen into the recognition-error state, where "Try again" did nothing. Save errors now show inline, keep the identification on screen, and retry cleanly (tested).
- Two taps in the same frame could record a sighting twice, and a double tap could start two captures. Both now use synchronous guards (tested for sightings).
- A corrected simulated result was recorded as `ai_corrected`. Anything derived from simulation is now always recorded as `simulated`.
- The server's upstream timeout equalled the app's client timeout, so slow responses could be paid for and then dropped. The server now times out first (20 s against 25 s).
- The encoder's temporary file was left in the cache after every capture. It is now deleted.
- The field-note copy promised an action that had no button. The button and flow were added.
- The template's MIT licence named Expo's copyright holder. It was removed, and choosing a licence is listed for the owner.
- Template icons, splash colours and web server output were replaced with original VYNR assets and native-only config. Location and microphone permissions are blocked explicitly.

- Owner review: recognition started awaiting work before it could be cancelled, and it read consent from the screen's render. Cancellation now starts first, and consent is re-checked from storage immediately before the photo is sent. An already-cancelled request sends nothing (tested).
- Owner review: an ambiguous generation was pre-selected. The player must now choose the generation explicitly (tested).
- Owner review: release builds could opt into simulated recognition. They no longer can (tested).

Phase 2 (PR #1 review findings, all with regression tests):

- Cancellation now starts before any await and is re-checked before upload; consent is read from storage at each step; pre-aborted signals send nothing.
- Server quotas are persistent and atomic (SQLite, `BEGIN IMMEDIATE`), with global daily and monthly spend ceilings that reserve worst-case cost first.
- Faces and plates are pixelated on device before any upload or retention; failure blocks both.
- A photo saved for an encounter that fails to record is deleted.
- Ambiguous generations still require an explicit choice; confidence is never shown as a percentage.
- Release builds cannot construct the simulated provider even if config resolution were bypassed.
- Missing specs are stated plainly instead of left blank; the old lime visual identity is gone.

Checked and found sound: no secrets in the app bundle or repository; no location collection; no OCR anywhere; mock recognition cannot ship by accident in release builds; every AI response is validated on both client and server; and no vehicle-interaction features exist.
