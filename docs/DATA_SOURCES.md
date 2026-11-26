# Automotive data licensing register (25 Nov 2026)

## Register

| Dataset | Licence | Status | Gate | Notes |
| --- | --- | --- | --- | --- |
| Curated VYNR catalog (makes, models, generations, years, category, rarity) | Original compilation of facts | **In use** | n/a | See DATA_PROVENANCE.md |
| `src/catalog/specs.data.ts` (66 generations from English Wikipedia, accessed 25 Nov 2026) | CC BY-SA 4.0 | **In use** (owner approved 26 Nov 2026) | `src/catalog/dataSources.ts`: shown only while the entry is `approved` with a recorded approval and attribution | Shown with credit, source links, change note, licence link and a link to the adapted data, which is itself CC BY-SA 4.0 (`data/LICENSE-specs.md`). Transcribed by an AI pass and spot-checked, so the app says it may contain errors |
| AutoDB Car Database | Commercial, see below | **Not purchased** | n/a | Owner approved, then put on hold pending sample, US coverage and written licence confirmation |
| EPA FuelEconomy.gov | US government data | Candidate | n/a | Free; no power, torque or weight |
| Market values | None | **Not available** | Feature flag off | No licensed, current source; VYNR shows no market values |
| Ownership and reliability notes | None | **Not available** | Feature flag off | No licensed source; nothing is shown |

## Original research (25 Nov 2026)

Goal: add verified specifications (power, torque, displacement, weight, dimensions) to the catalog from a source that is accurate, covers VYNR's six markets, and is licensed for use inside a commercial mobile app. Nothing has been purchased. **The catalog still ships with no specifications until a source is chosen and licensed.**

Status (25 Nov 2026, later): the owner approved buying AutoDB, then asked for three checks first: evaluate the free sample, check US-market coverage and accuracy, and confirm the licence covers our architecture. The purchase is on hold until all three are done. See "AutoDB due diligence" below.

## Shortlist

| Source | Cost | Licence for an app | Fields | Coverage | Fit |
| --- | --- | --- | --- | --- | --- |
| **AutoDB Car Database** ([autodb.store](https://autodb.store/en/index.html)) | 149 CHF one-time, free yearly updates | "Commercial License. Use the data in as many apps, websites and client projects as you like. Only reselling or redistributing the raw files is excluded." Full Terms of Sale not yet read | power (kW/hp), torque, displacement, transmission, drive, top speed, CO₂, consumption, curb weight, length/width/height, wheelbase, seats, doors (60+ fields). No 0–100 | Swiss federal type approvals (FEDRO) 1985–today: 195 brands, 15,186 models, 172,666 variants. Covers what was approved for sale in Switzerland, which includes most European, Japanese, Korean and US brands sold in Europe, but not Japan- or US-only models | **Recommended**, subject to the due diligence below |
| Auto-Data.net API ([api.auto-data.net](https://api.auto-data.net/)) | Quote only | Not stated on the site's main page; terms not yet read | 120+ parameters incl. power, torque, displacement, dimensions, weights, acceleration, top speed | 57,000 specs, 10,000 generations. Generation-level, which matches VYNR's catalog. More than half European; Asian and US coverage "in progress" | Best structural fit; needs a quote and licence review |
| CarAPI ([carapi.app](https://carapi.app/pricing/)) | API $199–299/yr (engine data Premium only, $299); data feed $599/yr | Display in your app is allowed. Redistributing the feed "in whole or in part... incorporated into another product" needs written permission ([terms](https://carapi.app/terms-of-use)), so bundling a snapshot in the app is unclear | Trims and specs from 1990 | **US market only** | Poor fit: US-only, and bundling is unclear |
| EPA FuelEconomy.gov ([downloads](https://fueleconomy.gov/feg/download.shtml), [API](https://fueleconomy.gov/feg/ws)) | Free | US government data; no terms stated on the pages read | Cylinders, displacement, drivetrain, transmission, turbo/supercharger, fuel type, MPG. **No horsepower, torque, weight or dimensions** | US-sold models, 1984–2026 | Useful free supplement for US cars only |
| NHTSA vPIC ([FAQ](https://vpic.nhtsa.dot.gov/api/home/index/faq)) | Free, no registration | Licence not stated on the FAQ | VIN decoding | US-registered vehicles, reliable from 1995 | Not a spec catalog; not useful for photo-based spotting |
| Wikidata ([licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)) | Free | CC0 (public domain), no attribution needed | Sparse and inconsistent vehicle specs | Varies by model | Good for stable model identifiers, not for specs |

Not reachable from the research environment: the CarQuery download terms, Teoalida (redirects to databaseatlas.com), and NHTSA's website policies. They were not evaluated.

## AutoDB due diligence

### Licence (Terms and Conditions of Sale, "Last updated: November 2026", read 25 Nov 2026)

Quoted from https://autodb.store/en/cgv.html:

- Section 6, "License of Use": the licence is "Non-exclusive", "Perpetual: No time limitation", "Commercial: Use in commercial projects is authorized" and "Unlimited: No restriction on the number of projects or users". Then: "Resale or redistribution of raw data is prohibited."
- Section 8: "Data is provided "as is". AutoDB.store does not guarantee the completeness or absolute accuracy of the information contained in the databases."
- Section 9: "Annual database updates are provided free of charge to customers who have purchased the product."
- Section 12: "These Terms are governed by Swiss law." Courts of the Canton of Valais.
- Section 13: the terms may be modified at any time. FAQ: no refunds after purchase; downloading waives the right of withdrawal.
- No attribution requirement was found.

**Assessment.** Commercial use in an app is clearly allowed. What the terms do **not** say is whether derived data (for example per-generation power ranges) bundled inside a distributed app binary counts as "redistribution of raw data". Our plan ships only aggregated ranges, never rows, which is the most defensible reading, but it is not confirmed. Because there are no refunds, **get written confirmation from AutoDB before buying.** Suggested question: "We will ship, inside a mobile app, per-model-generation minimum and maximum values (power, torque, curb weight, dimensions) computed from your data, never the raw variant rows. Is that within the licence?"

### Free sample

AutoDB publishes a free car sample (`https://autodb.store/samples/autodb-auto-sample.zip`, 200 real variants in JSON and CSV with a data dictionary, no sign-up). **It could not be evaluated from the build environment:** the network policy refuses connections to autodb.store, and the web reader cannot open ZIP files. Nothing below is based on the sample.

### US-market coverage (not yet verified)

The data comes from Swiss federal type approvals (FEDRO/ASTRA, 1985 onward) plus EU certificates of conformity registered in Switzerland since 2022. A US-only model appears only if it was type-approved or registered in Switzerland. Expect good coverage of global models sold in the US (Tesla, Mustang, Wrangler, many Japanese and Korean cars) and gaps for US-only models (likely Silverado, Ram 1500, most US full-size pickups and some GM/Stellantis models). **This is an inference from the stated source and must be checked against the sample or full file.** VYNR's catalog has 23 US-made generations, so the check is: how many of those 23 have a match.

### Accuracy (not yet verified)

Type-approval values are official homologation figures, which is a strong source for power, torque, displacement, weight and dimensions. The plan is to spot-check 10 catalog generations against manufacturer press specifications once the sample is available.

### Next steps

1. Allow `autodb.store` in the environment's network settings (or the owner downloads the sample and adds it to the project), then run the evaluation: field completeness, US matches for the 23 US generations, 10 spot checks.
2. Email AutoDB the licence question above and keep the written answer.
3. Buy only if both come back clean. Free EPA data can cover US-only models that AutoDB lacks, for the fields it has (no power or weight).

## Recommendation

1. **Buy the AutoDB Car Database (149 CHF, one-time)** once the owner approves, after reading its Terms of Sale to confirm that bundling derived data inside a mobile app is allowed. It is the cheapest option with the right fields, a clear commercial licence and broad coverage of the brands VYNR catalogs.
2. Ask Auto-Data.net for a quote in parallel. Its generation-level data matches the catalog better, and it might be worth it if the price is reasonable and its licence allows bundling.
3. Optionally use EPA data, which is free, to cross-check US models.

## How it would be integrated

- Type-approval data is per variant (trim). VYNR identifies generations from photos and never claims a trim, so specs would be shown as **ranges across a generation's variants** (for example "Power 110–245 kW, from 14 approved variants"), clearly labelled with the source and never presented as the exact car in the photo.
- A build-time script would map dataset rows to catalog ids. Only the derived ranges would ship, never the raw files, which respects "no redistribution of raw files". The source, version and licence would be recorded in `docs/DATA_PROVENANCE.md`.
- Generations with no reliable match would keep showing no specs rather than a guess.
