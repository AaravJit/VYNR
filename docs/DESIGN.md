# VYNR design: research and system (25 Nov 2026)

## Brief

The owner asked for a full redesign in a pink, violet and blue identity, informed by visual research into the GTA VI phone and its WAiNK car-scanning app, but **not** a reproduction of Rockstar's interface. This document records what was studied, which principles were taken, how they were applied, and what was deliberately left out.

## What was studied

Public write-ups of the GTA VI trailers and phone (no game files, no screenshots copied into the project):

- AllThingsHow, "GTA 6 phone explained: Snapmatic, WAiNK and wanted levels" and "GTA 6's in-game phone social media feed explained"
- GTA Intel, "GTA 6's phone is a real object now"
- The Games Wiki, "In-game phone and apps" (states its articles are AI-assisted; treated as low confidence)
- PC Gamer trailer takeaways (little phone detail)

Not reachable: Kotaku's piece on fans calling the UI "too simple". Typeface, palette and motion specifics are **not** described by any readable source, so nothing below copies Rockstar's type, colours or layouts. Much of the reporting is secondary or leak-based.

## Principles found, and how VYNR applies them

| Principle observed | Evidence (sources above) | VYNR's own application |
| --- | --- | --- |
| The phone is a physical object you raise into view | Camera moves to the hand when raised | The scanner now slides up from the bottom like a device being raised, instead of a flat fade |
| One-step access to the scanning app | Holding a button opens WAiNK directly | The scan orb sits in the centre of the tab bar, on Home as the largest element, and on every empty state |
| A scan returns only a few decision-relevant fields | WAiNK shows a short list of facts | The identify screen leads with name, generation, rarity and reward; the full verified record sits below it |
| A daily digest pulls everything new into one place | "Reminders" digest of messages, news and posts | Home is a digest: level, scanner, collection and sightings, today's contracts, recent discoveries, categories |
| Colour codes the destination | Each app has its own icon colour; red dot for unread | Each tab owns one hue of the signal gradient (Home pink, Garage violet, Contracts blue); rarity keeps its own colour scale |
| Feeds are vertical and card-based | Snapmatic vertical feed | Garage and contracts are vertical card feeds; featured categories scroll horizontally |
| Restraint: few apps, low density | "A handful of standard apps" | Four tabs plus the scanner; one primary action per screen |

## Deliberately not adopted

- **WAiNK's vehicle-security fields.** Reporting describes WAiNK showing lock, alarm and tracker status. VYNR never shows or infers anything about locks, alarms, trackers, keys or security systems, and never shows price or registration cost. This is a product rule in `CLAUDE.md`.
- Rockstar's typefaces, logos, icon shapes, layouts, app names, sounds or colour values. VYNR's palette, wordmark, icons and components are original.
- Any social posting or location features.

## The "neon dusk" system

- **Canvas:** deep ink-violet `#0B0716`, glass cards `rgba(40,28,68,0.62)` with a 1px `#2E2448` edge.
- **Signal gradient:** hot pink `#FF4FA3` → violet `#A66BFF` → electric blue `#4DB8FF`. Used for the primary action, progress, the level ring, the scanner reticle and the wordmark. Text on the gradient uses ink `#16051A`.
- **Type:** Unbounded (display, wide geometric, OFL) for headings and numbers; Inter Tight for body; JetBrains Mono for labels and readouts.
- **Shape:** 22–30 px rounded cards, pill buttons and chips, a floating pill tab bar, rounded gradient viewfinder corners.
- **Light:** soft radial pink and violet glows at the top of each screen; a glow shadow under primary actions.
- **Accessibility:** every text colour meets WCAG AA (4.5:1) on all three background levels, and ink meets 4.5:1 on every gradient stop. `test/theme/contrast.test.ts` enforces this.

## Verification

The redesign was checked by exporting the web build and taking screenshots with Playwright at 390×844 (onboarding, Home, Garage, Contracts, Profile). Two web rendering bugs found this way were fixed (icons hidden behind gradient fills; the wordmark gradient). It has **not** yet been seen on a physical iPhone or Android phone.
