# Vehicle specification data sources (research, 25 Nov 2026)

Goal: add verified specifications (power, torque, displacement, weight, dimensions) to the catalog from a source that is accurate, covers VYNR's six markets, and is licensed for use inside a commercial mobile app. Nothing has been purchased. **The catalog still ships with no specifications until a source is chosen and licensed.**

## Shortlist

| Source | Cost | Licence for an app | Fields | Coverage | Fit |
| --- | --- | --- | --- | --- | --- |
| **AutoDB Car Database** ([autodb.store](https://autodb.store/en/index.html)) | 149 CHF one-time, free yearly updates | "Commercial License. Use the data in as many apps, websites and client projects as you like. Only reselling or redistributing the raw files is excluded." Full Terms of Sale not yet read | power (kW/hp), torque, displacement, transmission, drive, top speed, CO₂, consumption, curb weight, length/width/height, wheelbase, seats, doors (60+ fields). No 0–100 | Swiss federal type approvals (FEDRO) 1985–today: 195 brands, 15,186 models, 172,666 variants. Covers what was approved for sale in Switzerland, which includes most European, Japanese, Korean and US brands sold in Europe, but not Japan- or US-only models | **Recommended**, subject to reading the Terms of Sale |
| Auto-Data.net API ([api.auto-data.net](https://api.auto-data.net/)) | Quote only | Not stated on the site's main page; terms not yet read | 120+ parameters incl. power, torque, displacement, dimensions, weights, acceleration, top speed | 57,000 specs, 10,000 generations. Generation-level, which matches VYNR's catalog. More than half European; Asian and US coverage "in progress" | Best structural fit; needs a quote and licence review |
| CarAPI ([carapi.app](https://carapi.app/pricing/)) | API $199–299/yr (engine data Premium only, $299); data feed $599/yr | Display in your app is allowed. Redistributing the feed "in whole or in part... incorporated into another product" needs written permission ([terms](https://carapi.app/terms-of-use)), so bundling a snapshot in the app is unclear | Trims and specs from 1990 | **US market only** | Poor fit: US-only, and bundling is unclear |
| EPA FuelEconomy.gov ([downloads](https://fueleconomy.gov/feg/download.shtml), [API](https://fueleconomy.gov/feg/ws)) | Free | US government data; no terms stated on the pages read | Cylinders, displacement, drivetrain, transmission, turbo/supercharger, fuel type, MPG. **No horsepower, torque, weight or dimensions** | US-sold models, 1984–2026 | Useful free supplement for US cars only |
| NHTSA vPIC ([FAQ](https://vpic.nhtsa.dot.gov/api/home/index/faq)) | Free, no registration | Licence not stated on the FAQ | VIN decoding | US-registered vehicles, reliable from 1995 | Not a spec catalog; not useful for photo-based spotting |
| Wikidata ([licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)) | Free | CC0 (public domain), no attribution needed | Sparse and inconsistent vehicle specs | Varies by model | Good for stable model identifiers, not for specs |

Not reachable from the research environment: the CarQuery download terms, Teoalida (redirects to databaseatlas.com), and NHTSA's website policies. They were not evaluated.

## Recommendation

1. **Buy the AutoDB Car Database (149 CHF, one-time)** once the owner approves, after reading its Terms of Sale to confirm that bundling derived data inside a mobile app is allowed. It is the cheapest option with the right fields, a clear commercial licence and broad coverage of the brands VYNR catalogs.
2. Ask Auto-Data.net for a quote in parallel. Its generation-level data matches the catalog better, and it might be worth it if the price is reasonable and its licence allows bundling.
3. Optionally use EPA data, which is free, to cross-check US models.

## How it would be integrated

- Type-approval data is per variant (trim). VYNR identifies generations from photos and never claims a trim, so specs would be shown as **ranges across a generation's variants** (for example "Power 110–245 kW, from 14 approved variants"), clearly labelled with the source and never presented as the exact car in the photo.
- A build-time script would map dataset rows to catalog ids. Only the derived ranges would ship, never the raw files, which respects "no redistribution of raw files". The source, version and licence would be recorded in `docs/DATA_PROVENANCE.md`.
- Generations with no reliable match would keep showing no specs rather than a guess.
