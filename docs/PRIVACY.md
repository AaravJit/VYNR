# Privacy, security and safety

This describes what the code does today. Before publishing, turn it into a user-facing privacy policy reviewed by someone qualified for your jurisdictions.

## Data on the device

| Data | Where | Notes |
| --- | --- | --- |
| Callsign (username), random player id | SQLite | No email, phone, name or account |
| Sightings: vehicle id or a short field-note label, source, confidence, time | SQLite | **No location is ever recorded** |
| XP ledger, contracts, achievements, settings | SQLite | |
| Photos | Not kept by default | If the player turns on **Keep photos**, a 640 px metadata-free thumbnail is stored in the app's private documents folder |
| Daily recognition count | SQLite | For the client-side request cap |

The app asks for camera permission only. It has no location permission (location and microphone permissions are blocked in `app.json`), no analytics, no advertising SDKs and no crash-reporting SDK.

## What happens to a photo

1. The camera capture is resized to at most 1024 px on the longest edge and re-encoded as JPEG at quality 0.7. This keeps enough detail to recognise a car's shape while making small text much harder to read.
2. EXIF, GPS, XMP, ICC and comment segments are stripped by `stripJpegMetadata` as a second safeguard after the re-encode.
3. The original full-resolution capture and the encoder's temporary file are deleted immediately.
4. The prepared image stays in memory for the current scan only.
5. It is sent to the recognition server **only** when the build is configured for real recognition **and** the player has given cloud consent. Without consent the app offers manual identification.
6. The server strips metadata again, sends the image to the AI provider, returns the result and keeps nothing. It never writes images to disk or logs them.
7. After the sighting is saved, the image is discarded unless Keep photos is on.

The AI provider (Anthropic) processes the image under its API terms. Check its current data retention terms and reflect them in your privacy policy.

## Licence plates, people and places

- The app never performs licence plate recognition. No OCR runs on the device or the server.
- The server's instructions tell the model to identify make, model and generation only, and never to read, transcribe or mention plates, people, faces, addresses or locations. Text in the image is treated as scene content, not instructions.
- Recognition responses are validated against a fixed schema, so free text can only appear in the short, length-capped `notes` field.
- **Limitation:** plates and faces are not blurred before upload. Reliable on-device redaction needs a detection model, which is out of scope for this MVP. The mitigations are downscaling, no retention anywhere, and the model instructions. Adding on-device plate and face blurring is the top privacy item in TASKS.md.

## Credentials and abuse protection

- The app contains no secrets. `EXPO_PUBLIC_*` values (recognition mode and endpoint) are public by design.
- The Anthropic API key exists only in the server's environment.
- Requests carry an anonymous install id: the first 32 hex characters of SHA-256(`vynr-rate-limit:` + random player id). It cannot be linked back to the player and is used only for rate limiting.
- Cost controls stack: 40 automatic identifications per device per day in the app; per-install and per-IP minute and day limits on the server; a concurrency cap; a global daily request budget; and a monthly spend limit you set in the Anthropic console.
- Every request and response is validated on both sides. The client treats the server as untrusted, and the server treats the model as untrusted.
- **Limitation:** the install id is not device attestation. A determined attacker can rotate ids, which is why the per-IP and global limits exist. For a public launch, add App Attest (iOS) or Play Integrity (Android). See TASKS.md.

## Player controls

- **Cloud recognition consent**: asked during onboarding with an explanation, off by default, and can be changed any time in Profile.
- **Keep photos**: off by default.
- **Export my data**: a JSON file through the share sheet. It contains every record, and photos are flagged as present but their device paths are left out.
- **Delete all data**: wipes the database and every stored photo, then starts a fresh profile with consent reset to off. It asks for confirmation first.
- The full in-app explanation is on the Privacy screen.

## Safety rules

Onboarding requires the player to acknowledge these rules before continuing, and the scanner repeats the key ones:

- Never scan while driving. Use VYNR only as a pedestrian or a parked passenger.
- Stay on public ground. Never trespass or enter restricted areas.
- Never touch, lean on or approach a vehicle closely to get a shot. Respect owners who ask you not to photograph their car.
- No feature rewards proximity, location, speed or access, and nothing in the game asks the player to approach a vehicle.
- VYNR never interacts with vehicle locks, keys, electronics or security systems. It only processes photos.
