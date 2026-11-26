# VYNR Black: cost and contribution margin

Status: estimates from list prices, 25 November 2026. Prices are hypotheses, not decisions. No purchase has been made and billing is not configured (see `docs/SUBSCRIPTIONS.md`).

## What Black is and is not

Black adds a higher daily identification allowance, advanced intel where licensed data exists, generation comparisons, advanced statistics, premium garages and scanner skins, exclusive frames and titles, the premium season track and a larger showcase. The server's list is `BLACK_BENEFITS` in `server/src/economy/billing.ts`, and the paywall shows that list.

Black never gives better crate odds, randomised exclusives, VC grants or marketplace advantages. The server enforces this. The premium season track is validated to contain cosmetics only (`validateEconomy`). Black cosmetics cannot also be sold for VC. Crate draws and market rules never read the entitlement. Nothing is "unlimited".

## Inputs

| Input | Value | Source or reason |
| --- | --- | --- |
| Monthly price | $5.99 | Owner's provisional figure |
| Annual price | $49.99 ($4.17/month) | Owner's provisional figure |
| Store commission | 15% (Apple Small Business Program; Google Play subscriptions). 30% shown as a downside case | [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/), [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en) |
| Cost per cloud identification | $0.00247 blended (Haiku 5.5, 20% escalated to Sonnet 5.5); $0.0110 if every call escalates | `RESEARCH.md`, "Cost per 1,000 scans as built" |
| Server, storage, bandwidth | about $0.05 per subscriber per month | Assumption: one small instance shared by thousands of users |
| Sales tax and VAT | Excluded (US prices exclude tax; EU prices include VAT, which lowers net revenue by about a sixth) | Assumption |

Live scanning makes more cloud calls than verified discoveries. Some answers are "no vehicle", and some need another angle. The usage rows below count cloud calls, not discoveries.

## Contribution margin per subscriber per month

Net revenue is price minus commission. Margin is net revenue minus model cost minus $0.05 infrastructure.

| Plan, commission | Net revenue | 5 calls/day | 15 calls/day | 40 calls/day (Black cap) | 75 calls/day | 100 calls/day |
| --- | --- | --- | --- | --- | --- | --- |
| Monthly, 15% | $5.09 | $4.67 | $3.93 | $2.08 | −$0.52 | −$2.37 |
| Monthly, 30% | $4.19 | $3.77 | $3.03 | $1.18 | −$1.41 | −$3.27 |
| Annual, 15% | $3.54 | $3.12 | $2.38 | $0.53 | −$2.07 | −$3.92 |
| Annual, 30% | $2.92 | $2.50 | $1.75 | −$0.10 | −$2.69 | −$4.54 |

If every call escalated to Sonnet 5.5, a 15-calls-a-day monthly subscriber would earn about $0.08 at 15% commission. A heavy user would lose money. The escalation rate is the biggest unknown, and the benchmark (`docs/BENCHMARK.md`) has to measure it before launch.

## Decisions taken from this table

- **Black allowance: 40 cloud identifications per day** (`RATE_PER_INSTALL_PER_DAY_BLACK`). An allowance of 100 would lose money on every heavy subscriber.
- **Free allowance: 25 per day on the server and 20 on the phone** (`RATE_PER_INSTALL_PER_DAY`, `CLIENT_DAILY_RECOGNITION_LIMIT`), down from 50 and 40. A free player who uses the full 20 costs about $1.48 a month, which free users cannot sustain at scale. Most will use far less.
- **The global spend ceilings stay in charge:** $2 a day by default during development, plus a monthly ceiling. Every call reserves its worst-case cost first.
- The live scanner's own gates keep calls well below these allowances. Each call needs a steady, sharp, well-exposed, new view. There is a 4-second cooldown, a 12-call cap per session, and a backoff after every "no vehicle".

## What has to be measured before prices are final

1. Real escalation rate and cost per call (benchmark on real phone photos).
2. Cloud calls per verified discovery with live scanning, measured in device tests.
3. Share of free players who reach the daily allowance. That share decides whether the higher allowance is a strong enough reason to subscribe.
4. Regional pricing and VAT, and the 30% first-year rate if VYNR does not qualify for the small-business rates.

These allowance changes touch protected spend and quota config. They take effect only once the owner approves PR #3.
