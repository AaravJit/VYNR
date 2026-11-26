# VYNR economy: design, numbers and simulation

All values live in `server/src/economy/config.ts` and are first drafts. Re-run the simulation after any change:

```bash
cd server && node scripts/simulate-economy.ts 90 240 1   # days, players, seed; writes docs/economy-simulation.json
```

## Principles

- **Vehicles are the assets.** A collectible is an instance of a curated catalog generation. Each one carries a serial number, a cosmetic colour, an edition, its original acquisition (discovered, unboxed or showroom) and full provenance.
- **Discovery is separate from ownership.** Verified discoveries are kept in their own history. Only they count toward spotting stats and discovery achievements. Selling or scrapping a collectible never removes a discovery.
- **VC is a closed loop.** It is earned in the game only: discoveries, achievements, the free season track, market sales and scrapping. It is spent on crates, the showroom, the market and cosmetics. It is never sold, withdrawn, converted or granted by a subscription.
- **Rarity comes from the catalog,** set by the curation rules in `docs/DATA_PROVENANCE.md` (production volume, market, history). The AI and the price never set it.
- **No pressure mechanics.** Every crate shows its full odds and its pity rule before purchase. There are no countdown offers and no near-miss reveals. The reveal is skippable. A deterministic showroom lets players buy the exact car they want.

## Numbers (draft)

| | Common | Uncommon | Rare | Exotic | Legendary |
| --- | --- | --- | --- | --- | --- |
| First discovery (VC) | 25 | 45 | 90 | 180 | 350 |
| Repeat discovery (VC, max 2 per vehicle per day) | 4 | 6 | 12 | 25 | 50 |
| Showroom price | 180 | 360 | 900 | 2,600 | 7,500 |
| Scrap refund | 10 | 20 | 50 | 150 | 400 |
| Market price bounds | 20–600 | 40–1,200 | 100–3,000 | 300–9,000 | 800–25,000 |

- Rewarded discoveries are capped at 25 a day.
- Repeat sightings mint another collectible only for rare and above, and at most once a week per vehicle.
- The market fee is 5%, charged to the seller and burned.
- Listings have a 24-hour trade hold, at most 25 active listings, and at most 20 new listings a day.
- Trading needs an account at least a day old and 3 verified discoveries.

Crates and published odds (`GET /v1/config`):

| Crate | Price | Pool | Rarity weights | Pity |
| --- | --- | --- | --- | --- |
| Street | 240 | Everyday body styles, common to rare | 70 / 25 / 5 | Rare within 15 |
| Performance | 820 | Sports cars, coupes, convertibles | U 55, R 33, E 10, L 2 | Exotic within 10 |
| JDM Legends | 940 | Japan, performance body styles, uncommon and above | U 50, R 35, E 12, L 3 | Exotic within 10 |
| Autobahn | 940 | Germany, performance and GT | U 50, R 35, E 12, L 3 | Exotic within 10 |
| American Muscle | 880 | US coupes, sports cars, supercars, trucks | U 55, R 32, E 10, L 3 | Exotic within 10 |
| Heritage | 1,050 | Generations ended by 2010 | C 30, U 35, R 22, E 10, L 3 | Exotic within 10 |
| Exotic | 3,000 | Exotic and legendary | E 85, L 15 | Legendary within 8 |
| Unicorn | 7,000 | Legendary only | L 100 | none |

Weights are renormalised over the rarities present in the pool. Each vehicle within a rarity is equally likely. The served odds table lists every vehicle's probability. Crate prices are set so the expected showroom value is about 1.1 times the price. That way a crate is neither a trap nor clearly better than choosing. Manufacturer, regional and seasonal crates are config entries (pool filter plus availability window and edition).

## Simulation results (90 days, 240 players, seed 1)

Run on 25 November 2026 with the real `EconomyStore`. Full output is in `docs/economy-simulation.json`.

| Player type | Players | Avg balance | Avg collectibles | Avg distinct vehicles discovered | Catalog owned |
| --- | --- | --- | --- | --- | --- |
| New (first week only) | 39 | 225 | 20.9 | 15.2 | 14.9% |
| Casual (plays 30% of days, 3 finds) | 85 | 227 | 75.8 | 55.0 | 46.6% |
| Active (85% of days, 8 finds) | 68 | 221 | 198.7 | 110.6 | 83.3% |
| Subscriber (same behaviour as active) | 37 | 236 | 196.8 | 109.6 | 82.6% |
| Farmer (same common car 40 times a day) | 11 | 1,345 | 1 | 1 | 0.8% |

- **Invariants:** all hold. Every balance equals its ledger, there are no negative balances, every owner agrees with provenance, and no listing is stale.
- **Inflation:** 1.89M VC minted and 1.82M spent (96%). Fees burned 5,708. In circulation 66,660, about 280 per player. Balances stay flat because simulated players spend surpluses at once.
- **Supply:** 28,067 collectibles in circulation (12,253 common, 6,548 uncommon, 6,464 rare, 2,420 exotic, 382 legendary). Legendaries stay scarce: about 1.6 per player after 90 days.
- **Market:** 4,764 listings and 626 sales. Average prices were common 78, uncommon 155, rare 356 and exotic 1,048. That is roughly 40% of showroom, which is where sellers listed.
- **Subscribers vs free:** no measurable difference in VC, collectibles or completion. This is by design.
- **Farming:** the farmer averaged 8 VC a day (maximum 33). The first run, before the caps were tuned, showed why they are needed.

Tuning history: the first run minted a collectible on every daily repeat sighting and priced crates at about a third of their value. Active players reached 645 collectibles and 84% of the catalog in 90 days, with 44,602 common copies in circulation. Repeat minting was then limited to rare and above, crate prices were raised to about 0.9 of expected value, and discovery rewards were cut by about 40%.

## Limits of the simulation

- Sightings are drawn from an assumed mix (62% common to 0.5% legendary), uniform within each rarity. Real streets in the US show far fewer exotics and many more of a few common models. So real completion will be slower than "distinct vehicles discovered" suggests, and active players' 83% catalog completion is an upper bound.
- Players are greedy spenders with fixed preferences. Hoarders, collectors chasing sets and speculators are not modelled.
- The catalog has 133 generations. Completion figures scale with catalog growth.
- Long-term completion: as the catalog grows and seasons add editions, a 90-day season should leave active players short of full completion. Re-run when the catalog changes.
