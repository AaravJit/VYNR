# Deployment

There are two parts to ship: the recognition server (optional; without it the app offers manual identification) and the mobile app.

## 1. Recognition server

### What you need

- An Anthropic API key from https://platform.claude.com/. **Set a monthly spend limit in the console** as the outer cost ceiling.
- Any host that runs Node 22.18+ or a Docker container and terminates HTTPS: for example Fly.io, Render, Railway, Google Cloud Run or a small VM behind Caddy. The server is stateless and needs no database.

### Configuration

All settings are environment variables. The full list with defaults is in `server/.env.example`. The ones that matter most:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | The server refuses to start without it |
| `RECOGNITION_MODEL` | `claude-opus-5-5` | Vision model. Requests also enable server-side fallback models |
| `GLOBAL_DAILY_REQUEST_BUDGET` | 2000 | Hard cap on AI calls per UTC day across everyone. Size it to your budget |
| `RATE_PER_INSTALL_PER_DAY` | 50 | Per device |
| `RATE_PER_IP_PER_DAY` | 300 | Per IP address |
| `TRUST_PROXY` | off | Turn on only behind a reverse proxy that appends `X-Forwarded-For`, otherwise clients can spoof their IP |

Limits are kept in memory per instance and the daily budget resets on restart. Run a **single instance**, or move the counters to a shared store such as Redis before scaling out.

### Run

```bash
cd server
npm ci --omit=dev
ANTHROPIC_API_KEY=... node src/index.ts
# or
docker build -t vynr-recognition . && docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... vynr-recognition
```

Check it with `curl https://<host>/health`, which returns `{"ok":true,"provider":"anthropic"}`.

The server only answers `GET /health` and `POST /v1/recognize`. Its logs contain method, path, status and duration only.

### Cost

Each identification is one Messages API call with one image of up to 1024 px (roughly 1,000–1,500 input tokens) and a short structured answer at low effort. Multiply by `GLOBAL_DAILY_REQUEST_BUDGET` with current pricing to get your worst-case daily spend.

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

Release builds require `https`. If the endpoint is missing, the release build ships with manual identification only, and simulated recognition can never be switched on by accident.

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
