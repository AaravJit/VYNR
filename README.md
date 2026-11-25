# VYNR

VYNR is a mobile car-spotting collection game. Photograph a car you see in public, get it identified, review or correct the result, and add it to your garage. Every vehicle has a rarity from a curated catalog, and finding new ones earns XP, levels, achievements and daily and weekly contracts.

It is built with Expo (SDK 58), React Native, TypeScript, Expo Router and SQLite. It works offline-first: all progress lives on the device. Real identification uses a small server (in `server/`) that holds the AI credentials, so the app never contains any secret.

## Quick start

Requirements: Node 22.18 or newer, and either the iOS Simulator (Xcode), an Android emulator, or a physical phone.

```bash
npm install
npm --prefix server install
npm run verify          # typecheck, lint, app tests, server typecheck and tests
npx expo start          # then press i (iOS) or a (Android)
```

If Expo Go's bundled native modules do not match this SDK, build the app locally instead (needs Xcode or Android Studio):

```bash
npx expo run:ios        # or: npx expo run:android
```

To install on a phone without a local toolchain, use an EAS internal build: `npx eas-cli@latest build --profile preview`.

### Dev mode (simulated recognition)

With no configuration, development builds use a simulated recognition provider. It does not look at the photo: it picks a plausible catalog vehicle so you can exercise the whole loop (capture, review, correct, add, XP, contracts). Everything it produces is labelled **DEV MODE · SIMULATED RECOGNITION** in the UI, and the scanner shows a **SIM** button that lets you run a scan without a camera (useful in the simulator).

Release builds never fall back to simulation. With no server configured they offer manual identification from the catalog instead.

### Real recognition

1. Start the server with an Anthropic API key (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)):
   ```bash
   cd server && cp .env.example .env   # add ANTHROPIC_API_KEY
   node --env-file=.env src/index.ts
   ```
2. Point the app at it (copy `.env.example` to `.env.local`):
   ```
   EXPO_PUBLIC_RECOGNITION_ENDPOINT=http://<your-computer-LAN-IP>:8787
   ```
   Plain `http` is accepted only in development builds. Release builds require `https`.
3. Restart `npx expo start`. On first launch, the onboarding privacy step asks for consent before any photo is sent. You can change it later in Profile.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/app/` | Expo Router screens (onboarding, tabs, scanner, identify, discovery, vehicle, privacy) |
| `src/domain/` | Pure game engine: XP, levels, duplicates, contracts, achievements, stats |
| `src/catalog/` | Curated vehicle catalog (36 makes, 133 generations) and search |
| `src/db/` | SQLite schema, migrations and repository |
| `src/recognition/` | Recognition provider interface, simulated and remote providers, response validation, catalog matching |
| `src/services/` | Game service, image preparation and metadata stripping, data export |
| `src/state/` | App store (SQLite-backed) and scan session |
| `src/components/`, `src/theme/` | UI kit and design tokens |
| `server/` | Recognition server (Node, no framework) |
| `test/` | Unit, integration (real SQLite) and UI tests |
| `docs/` | Architecture, privacy, data provenance, deployment |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app, engine, storage and recognition fit together
- [docs/PRIVACY.md](docs/PRIVACY.md): what data is collected, sent and kept, and the safety rules
- [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md): where the catalog comes from and how rarity is assigned
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploying the server and shipping the app
- [IMPLEMENTATION.md](IMPLEMENTATION.md), [TASKS.md](TASKS.md), [PROGRESS.md](PROGRESS.md): build plan, task list and status, including test results and known limitations

## Safety

VYNR is for spotting cars from public places. Never use it while driving, never enter private property or restricted areas, and never touch or approach a vehicle to photograph it. The app does not read licence plates and never interacts with any vehicle's locks, keys, electronics or security systems.
