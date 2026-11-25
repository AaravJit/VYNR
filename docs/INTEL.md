# Street intel (simulated)

Street intel is game flavour on every scan report: tracker and alarm grades,
street reputation, collector demand, four humorous traits and three one-line
observations. **None of it describes the real car.** It is generated on the
phone by `src/domain/intel.ts`, labelled "SIMULATED · FOR FUN" everywhere, and
stored with the encounter (`encounters.intel`, migration v2) so it never changes
after the player registers the discovery.

## Hard rules

- **Tracker and alarm grades come from the seed alone**, through a random stream
  that never sees the vehicle. Two different cars with the same seed get the
  same grades, and a test enforces this. They are never derived from make,
  model, year, price, rarity or anything about real security.
- Nothing ranks, scores or compares real vehicles by theft difficulty or
  security. No text mentions immobilisers, keys, unlocking, theft or
  vulnerabilities; a test scans every generated line for the whole catalog.
- The app never contacts a vehicle or its electronics.

## How it is generated

- **Seed**: `<scan id>:<vehicle id>` at scan time. Older encounters saved
  before intel existed get one seeded from the encounter id when viewed.
- **Reputation and collector demand** follow the catalog rarity (game data,
  not market data). Legendary cars can roll "Unreasonably high" demand.
- **Traits**: four of nine (owner attachment, financial damage, maintenance
  risk, cold-start disturbance, attention magnet, garage-queen probability,
  main-character energy, street credibility, enthusiast obsession). Each has
  four tongue-in-cheek levels, nudged by body category, era and rarity.
- **Observations**: picked from about 50 hand-written lines. Lines have
  conditions (for example "electric", "pre-2000", "German", "pickup"), and the
  generator prefers specific lines over generic ones. Lines shown in the last
  ten encounters are avoided so reports stay fresh.

## Tone

Joke about cars, ownership and car culture, never about people, nationalities
or groups. A line was removed during review for leaning on a national
stereotype; keep that bar. Add new lines to `QUIPS` with a `when` condition
and run `npm test`.
