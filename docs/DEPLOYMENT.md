# Deployment

There are two parts to ship: the recognition server (optional; without it the app offers manual identification) and the mobile app.

## 1. Recognition server

### What you need

- An Anthropic API key from https://platform.claude.com/. **Set a monthly spend limit in the console** as the outer cost ceiling.
- Any host that runs Node 22.18+ or a Docker container and terminates HTTPS: for example Fly.io, Render, Railway or a small VM behind Caddy.
- **A persistent disk** for one small SQLite file (`STATE_FILE`). It holds rate-limit counters, the daily and monthly spend ledger and a 24-hour result cache, so limits survive restarts and redeploys.

### Configuration

All settings are environment variables. The full list with defaults is in `server/.env.example`. The ones that matter most:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | The server refuses to start without it |
| `RECOGNITION_MODEL` | `claude-haiku-5-5` | Fast first pass |
| `RECOGNITION_ESCALATION_MODEL` | `claude-sonnet-5-5` | Second opinion only when the first answer is unsure or two models are close. `off` disables it |
| `DAILY_SPEND_LIMIT_USD` / `MONTHLY_SPEND_LIMIT_USD` | 2 / 50 | Hard ceilings. Each call reserves its worst-case cost first, then settles the real cost |
| `GLOBAL_DAILY_REQUEST_BUDGET` | 2000 | Hard cap on model calls per UTC day across everyone |
| `RATE_PER_INSTALL_PER_DAY` / `RATE_PER_IP_PER_DAY` | 25 / 300 (40 per install with VYNR Black, `RATE_PER_INSTALL_PER_DAY_BLACK`; see docs/SUBSCRIPTION_ECONOMICS.md) | Per device and per IP, persisted |
| `STATE_FILE` | `./data/vynr-state.sqlite` | Put it on the persistent volume (`/app/data` in Docker) |
| `TRUST_PROXY` | off | Turn on only behind a reverse proxy that appends `X-Forwarded-For`, otherwise clients can spoof their IP |

State is a single SQLite file, so run **one instance** (vertical scaling is plenty at this volume). Moving the store to Postgres or Redis is the step before scaling out.

### Run

```bash
cd server
npm ci --omit=dev
ANTHROPIC_API_KEY=... node src/index.ts
# or
docker build -t vynr-recognition . && docker run -p 8787:8787 -v vynr-data:/app/data -e ANTHROPIC_API_KEY=... vynr-recognition
```

Check it with `curl https://<host>/health`, which returns `{"ok":true,"provider":"anthropic"}`.

The server only answers `GET /health` and `POST /v1/recognize`. Its logs contain method, path, status, duration and, when a spend ceiling is hit, a warning. Never request bodies.

### Cost

Estimates for 1,000 successful scans at the default settings, from published prices (Haiku 5.5 $0.10 / $0.50 and Sonnet 5.5 $2 / $10 per million input / output tokens). Working is in RESEARCH.md, "Cost per 1,000 scans as built".

| Setup | Per 1,000 scans |
| --- | --- |
| Haiku only (`RECOGNITION_ESCALATION_MODEL=off`) | about $0.33 |
| Default, if 10% of scans escalate to Sonnet | about $1.40 |
| Default, if 20% escalate | about $2.47 |

The escalation rate is unknown until the benchmark runs; most of the cost is the escalated calls. If cost matters more than the second opinion, raise the bar for escalating (`ESCALATE_BELOW_CONFIDENCE=0.5`) or turn it off.

Identical photos inside 24 hours are answered from the cache at no cost. These are estimates, not measurements: check the real figure in the Anthropic console after the first week, and keep a workspace spend limit there as the outer ceiling.

## 2. Mobile app

### What you need

- An Expo account (free) for EAS Build.
- An Apple Developer Program membership to install on iPhones outside the simulator and to ship to TestFlight or the App Store.
- A Google Play Console account to ship on Android.
- Change `ios.bundleIdentifier` and `android.package` in `app.json` (currently `com.aaravjit.vynr`) if you want a different id. They must be unique and cannot change after the first store release.

### Configure recognition for the build

Set these as EAS environment variables (or in `.env.local` for local builds). They are public values:

```
EXPO_PUBLIC_RECOGNITION_ENDPOINT=https://<your-server-host>
```

Release builds require `https`. If the endpoint is missing, the release build ships with manual identification only, and simulated recognition cannot be enabled in a release build at all.

### Build

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile preview      # internal install
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios    # TestFlight / App Store
```

### Store listing checklist

- App privacy (iOS) and data safety (Android) forms: photos are sent to a third-party AI service when the user consents, are not linked to identity and are not stored. No location, contacts or tracking. See docs/PRIVACY.md.
- Publish a privacy policy URL based on docs/PRIVACY.md.
- Age rating: no user-generated content is shared and there are no social features.
- Screenshots: take them on a device with the real recognition server configured, so no DEV MODE banner appears.

## Before shipping

1. `npm run verify` passes.
2. `npm run export:check` builds the iOS and Android bundles.
3. Run the full flow on a physical iPhone and an Android phone (see the manual test script in PROGRESS.md).
4. Review the catalog years and rarities (docs/DATA_PROVENANCE.md).
