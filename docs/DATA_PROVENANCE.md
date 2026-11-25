# Data provenance and licensing

## Vehicle catalog

**Contents.** 36 manufacturers and 133 model generations across Japan (32), Germany (29), the United States (23), Italy (19), the United Kingdom (17) and South Korea (13). By rarity: 42 Common, 32 Uncommon, 20 Rare, 24 Exotic and 15 Legendary.

**Fields stored** (enforced by a test, `test/catalog.test.ts`): id, manufacturer, model name, generation or chassis designation, approximate production start and end year, body category, curated rarity, electric flag and search aliases. Nothing else.

**What is deliberately not stored in the catalog:** no trims or option packages, no prices, no images, logos or brand artwork, and no text copied from any database, encyclopedia or manufacturer website.

**Source.** The catalog was compiled by hand for this project from widely published, factual public knowledge: manufacturer names and home countries, model names, generation designations and approximate production periods. These are facts rather than creative expression, and the catalog does not copy the selection, arrangement or wording of any particular source. No third-party database, scraped data or licensed dataset is included.

**Accuracy.** Production years are shown everywhere as estimates (for example "2019–present"). Generation boundaries and years differ by market, so treat each range as approximate. **Before a public release, a human should review every entry against manufacturer press materials.** The catalog is versioned (`CATALOG_VERSION`), and ids are permanent so corrections never break saved progress.

**Trademarks.** Manufacturer and model names are trademarks of their owners. They are used only to identify vehicles (nominative use). VYNR is not affiliated with or endorsed by any manufacturer. The app shows plain text names and generated monogram tiles, never manufacturer logos.

## Technical specifications

**Coverage.** 66 of the 133 generations have a specification record (`data/specs.json`, compiled into `src/catalog/specs.data.ts` by `npm run build:specs`). The other 67 show "not verified yet" instead of figures. The 67 missing ids and why are listed under `skipped` in the JSON: 63 were not researched yet, and 4 were researched but the source did not state the figures for that generation.

**Fields.** Chassis code, body styles, layout, drivetrains, the engines offered (configuration, displacement, aspiration, power in hp and kW, torque in Nm), transmissions offered, and factory performance figures with the variant they apply to. Every field is optional and left empty when the source did not state it. Nothing is estimated, converted or averaged: where a source gives PS or lb-ft only, that figure is kept in the engine's note rather than converted.

**Options, not a guess.** Engines, drivetrains and transmissions are the options offered for the whole generation. The app says so and never claims which one the photographed car has.

**Source and licence.** Each record cites the English Wikipedia article it was taken from, accessed 25 November 2026, and the app shows that link under the figures. Wikipedia text is licensed CC BY-SA 4.0. The records restate individual facts (figures, names of options) rather than copying prose, and each is attributed with a link, which is how we meet the attribution requirement. If the project ever copies descriptive text from Wikipedia, that text must carry the same licence.

**Known limits of this data.**
- Values were transcribed from the articles by an AI-assisted research pass and spot-checked, not reviewed line by line. Review each record against manufacturer press material before a public release.
- Drivetrain labels follow each article's wording, so some AWD systems appear as "4WD".
- A chassis code is shown only where the article named one, even if the catalog generation name implies it.
- A few articles cover a whole model line (for example Toyota Supra, BMW M3); only the target generation's figures were taken, and model-wide items are marked as such.
- Where an article contradicted itself, the figure was noted or left empty.

**Why Wikipedia for this pass?** See RESEARCH.md. Wikidata (CC0) and the EPA fuel-economy data (US public domain, US-market trims only) are the preferred sources for bulk expansion, but neither was reachable from the build environment. NHTSA vPIC covers VIN decoding only, and CarQuery's licence is unstated, so neither was used. Commercial spec feeds were not used because their licences restrict redistribution.

**Adding or fixing a record.** Edit `data/specs.json` (include a `sources` entry with an https URL and title), run `npm run build:specs`, then `npm test`. The build script refuses records without a source or with an id that is not in the catalog, and CI fails if the generated file is stale.

## Rarity curation rules

Rarity reflects how hard a car usually is to find on public roads in the target markets. It never reflects price or desirability on its own, and it never comes from the AI.

| Tier | Guideline | Examples |
| --- | --- | --- |
| Common | Mass-market, current or recent, seen daily in most places | Toyota Corolla, Volkswagen Golf, Ford F-150, Hyundai Tucson |
| Uncommon | Enthusiast or premium models that are regularly seen but not everywhere | Mazda MX-5, Volkswagen Golf GTI, Ford Mustang, Kia EV6 |
| Rare | Low-volume performance or luxury models | Honda Civic Type R, BMW M3 (G80), Porsche 911 (992), Toyota GR Supra |
| Exotic | Supercars, track specials and scarce classic icons | Lamborghini Huracán, McLaren 720S, Porsche 911 GT3, BMW M3 (E30) |
| Legendary | Hypercars, historic icons and very low production numbers | Ferrari F40, McLaren F1, Porsche Carrera GT |

When a model's rarity differs by market, use the more common tier, so collections are not inflated. Any change to a vehicle's rarity is a balance change: note it in the changelog and bump `CATALOG_VERSION`.

## Unknown vehicles

When a car is not in the catalog (or the AI predicts something not in the catalog), the player can log a **field note** with a short label. Field notes earn a small, capped amount of XP and never count toward collection completion.

## Adding vehicles

1. Add the manufacturer to `src/catalog/manufacturers.ts` if it is new (id, name, home country, aliases).
2. Add the generation to `src/catalog/vehicles.ts` with the `v(...)` helper, following the rules above.
3. Run `npm test`. The catalog tests check unique URL-safe ids, valid enums, sane year ranges, no duplicate generations and no extra fields.

## Other assets

| Asset | Source | Licence |
| --- | --- | --- |
| Inter Tight font | `@expo-google-fonts/inter-tight` (Google Fonts) | SIL Open Font License 1.1 |
| App icon, splash, adaptive icons | Generated by `scripts/generate-icons.py` for this project | Original work |
| UI icons | Hand-written SVG paths in `src/components/Icon.tsx` | Original work |
| Shutter and discovery sounds | Synthesised by `scripts/generate-sounds.py` for this project | Original work |

The visual identity (Dusk palette, aperture logo, emblem tiles, typography) is original and does not reuse any other game's branding, art, sounds or assets.
