# Progress

Status as of 25 November 2026: **MVP feature-complete and verified in automated tests and native bundle builds. Not yet run on a physical device or simulator** (the build environment had no iOS or Android runtime). Real AI identification is implemented and unit-tested against a mocked API, but has **not** been exercised against the live Anthropic API because no key was available.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Type check (app) | `npm run typecheck` | Pass, strict mode |
| Lint | `npm run lint` | Pass, 0 warnings |
| App tests | `npm test` | **99/99 pass** in 9 suites |
| Server type check | `npm --prefix server run typecheck` | Pass |
| Server tests | `npm --prefix server test` | **26/26 pass** |
| Native bundles | `npm run export:check` | iOS and Android Hermes bundles build |
| Server smoke test | start with and without a key, call `/health` and `/v1/recognize` | Refuses to start without a key; health and validation respond correctly |

What the app tests cover:

- **Domain** (deterministic, fixed clock): XP per rarity, duplicate decay and cooldown, level curve, contract generation and progress, achievements, manufacturer completion, milestones, unknown-vehicle cap, ledger totals.
- **Catalog**: unique ids, valid enums and years, no duplicate generations, no spec fields, coverage of every country and rarity, search with aliases and diacritics.
- **Recognition**: strict response validation (malformed, out-of-range, injected control characters), alias matching, generation disambiguation, mock determinism, remote client HTTP error mapping, timeouts, release-build mode resolution.
- **Image privacy**: EXIF, GPS, ICC and comment stripping with image data preserved.
- **Integration on real SQLite**: migrations and constraints, atomic rollback on failure, state identical after closing and reopening, the full acceptance flow through the store, export without device paths, delete-all including photos, database failure shown as an error state.
- **UI**: home, the identify flow with simulated recognition, manual correction, save failure and retry, double-tap protection, expired scans, the consent gate (no network call without consent), and the daily cap.

Server tests cover request validation, metadata stripping before the provider, per-install and per-IP limits, the global budget and its UTC reset, the concurrency cap, timeouts, error mapping without leaking details, proxy-header trust, log hygiene, the Claude request shape, refusal and invalid output handling, and drift between shared code copies.

## Acceptance criteria

| Step | Status |
| --- | --- |
| Launch → onboarding | Implemented, UI-tested for home; onboarding not covered by an automated test |
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
2. Open the scanner, photograph a car, check the AI or SIMULATED label, confidence and catalog record.
3. Tap "Not right?" and pick another vehicle. Confirm the "IDENTIFIED BY YOU" label.
4. Confirm. Check the discovery reveal, XP and level change, and contract progress.
5. Scan the same car again within 10 minutes: it should show "Logged recently" and +0 XP.
6. Force-quit and reopen. All progress must still be there.
7. Turn off cloud consent in Profile. Scan again: no network request, manual identification is offered.
8. Turn on Keep photos, log a sighting, check the thumbnail. Export data and inspect the JSON. Delete all data and confirm everything resets.
9. Deny camera permission on a fresh install and check the recovery path to Settings.
10. Turn on airplane mode: the game works, and scanning explains the network error and offers manual identification.

## Known limitations

- **Not run on a device or simulator yet.** Layout, camera behaviour, haptics and performance on real hardware are unverified.
- **Live AI not exercised.** The Claude integration is tested with a fake client. The first live run may need prompt or schema tuning.
- **No plate or face blurring before upload.** Mitigated by downscaling, zero retention and model instructions. See docs/PRIVACY.md.
- **Honor system for manual picks.** A player can photograph anything and choose any catalog vehicle. Duplicate decay, the cooldown and a finite catalog bound the impact. Fine for single-player; must be solved before leaderboards.
- **The simulated provider ignores the photo.** It exists only to test the loop.
- **The install id is not attestation.** Per-IP and global limits are the real abuse boundary.
- **Server limits are in memory.** Single instance only; counters reset on restart.
- **Catalog years are approximate** and need a human review.
- **No account or cloud backup.** Uninstalling the app loses progress unless the player exported it.
- **No repository licence** has been chosen.

## Remaining external configuration

1. Anthropic API key, monthly spend limit, and an HTTPS host for `server/` (docs/DEPLOYMENT.md).
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

Checked and found sound: no secrets in the app bundle or repository; no location collection; no OCR anywhere; mock recognition cannot ship by accident in release builds; every AI response is validated on both client and server; and no vehicle-interaction features exist.
