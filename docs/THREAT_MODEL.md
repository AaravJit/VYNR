# Threat model: recognition, economy and marketplace

Scope: the Expo app, the recognition server (`server/src/app.ts`) and the economy service (`server/src/economy/`). This was written alongside the code in PR #3 and has not had an external review.

## Assets

- **Money:** AI spend and, later, subscription revenue.
- **Economy integrity:** VC balances, collectible ownership and odds.
- **Player privacy:** photos, faces, plates and location.
- **Accounts:** bearer tokens.
- **Operator secrets:** the API key and future store credentials.

## Trust boundaries

- The phone is untrusted. Anything the app sends is a request, never a fact. That covers prices, balances, outcomes, ownership, subscription status and which car was seen.
- The AI answer is untrusted. It is validated on the server and on the phone (`validate.ts`), and only catalog vehicles can be claimed.
- Store notifications can be trusted only after signature verification. No verifier is configured yet, so the endpoints refuse every request.

## Threats and controls

| Threat | Control | Where | Residual risk |
| --- | --- | --- | --- |
| Runaway AI spend (bug, loop, abuse) | Live-scan gates (steadiness, sharpness, duplicates, cooldown, session cap). Client daily cap. Per-install, per-IP and global limits. Daily and monthly dollar ceilings with worst-case reservation. Result cache. In-flight coalescing. Concurrency cap | `livePolicy.ts`, `gated.ts`, `app.ts`, `store.ts` | Low; ceilings are hard |
| Faces or plates leaving the phone | Pixelation on the phone before any upload or saved thumbnail. Fails closed when the detector is missing or errors. Shared check in `recognizeWithGates`. Live frames are deleted after measurement | `imageService.ts`, `gated.ts` | Detector recall is unmeasured on real photos (blocker) |
| Precise location | Never collected, never part of a collectible or profile | Schema | None known |
| Plate recognition | Text detection keeps only boxes and discards text immediately | `redaction.ts` | None known |
| Forged discovery (claiming a car never seen) | Claim must cite a server recognition record for the same account, within 30 minutes, used once. The candidates must support the vehicle at plausible confidence | `claimDiscovery`, `candidatesSupport` | A photo of a screen or a stock image still "discovers" a car. Accepted for launch and noted for moderation and anomaly checks |
| VC farming by rescanning one car | Repeat rewards capped (2 per vehicle per day, small amounts). Daily rewarded discoveries capped (25). Repeat minting only for rare and above, once a week. Simulation: farmer earns about 12 VC a day | `config.ts`, `docs/ECONOMY.md` | Low |
| Multi-account farming, VC funnelling | No VC on sign-up. Account creation capped per IP. Trading needs a day of account age and 3 verified discoveries. Price bounds per rarity cap how much VC one sale can move. Fee burned | `tradeEligibility`, `priceBounds` | Medium: determined farmers with many devices. Monitor transfers between new accounts (Prompt 4) |
| Double spend, race between buyers | Every write in one `BEGIN IMMEDIATE` transaction. `CHECK (balance >= 0)`. Unique index allows one active listing per collectible. Tested across two connections to one database | `store.ts`, `db.ts`, tests | Low on one host. Several hosts need Postgres or another single writer (see `docs/BACKEND.md`) |
| Replay and retries charging twice | Idempotency keys per account and operation. Stored response returned on retry. A key reused for another operation is refused | `idempotent()` | Low |
| Client-chosen prices and bait-and-switch | Buyer sends `expectedPrice`. Server compares it to the stored price; listings cannot be edited | `buyListing` | Low |
| Price manipulation, wash trading | Bounds per rarity, fee burned, trade hold, listing caps, sale history public | `config.ts` | Medium; needs operator dashboards |
| Duplicated or orphaned collectibles | One owner column with a check against burned state. Provenance events must agree with the owner. Invariant check in tests and simulation | `checkInvariants` | Low |
| Interrupted crate opening | Charge, draw, mint and record happen in one transaction. Retry returns the same result. Unseen openings can be listed and revealed again | `openCrate`, `unseenOpenings` | Low |
| Predictable or rigged draws | `crypto.randomInt`. Integer weights derived from the published odds table. Odds served from the same config the draw uses | `draw`, `oddsFor` | Low |
| Fake subscription | No client claims accepted. Verifiers refuse without credentials. States follow Apple and Google semantics | `billing.ts` | Verifiers still to be implemented with real credentials |
| Token theft | 256-bit random tokens, stored as SHA-256 only, sent over TLS. Deleting the account revokes them | `createAccount`, `authenticate` | Medium: no rotation or device binding yet (Prompt 4) |
| Abusive handles and harassment | Handle pattern and denylist, report and block, no direct messages, no free-text listings | `updateProfile`, `report`, `block` | Moderation queue tooling is not built yet |
| Enumeration and leaking account ids | Public endpoints show handles of public profiles only, never account ids. Tested | `provenance`, `searchListings` | Low |
| Injection | Parameterised SQL everywhere. Inputs checked against strict patterns. 8 KB body limit for economy requests | `routes.ts` | Low |
| Real vehicle security exposure | Street intel is seeded fiction and labelled simulated. The server stores no security data | `intel.ts` | None known |
| Logging personal data | Request logs hold method, path, status and time only. Audit events hold random ids and amounts | `app.ts` | Low |

## Open items

1. Store verifiers with real credentials (Apple `SignedDataVerifier`, Google `subscriptionsv2.get`), with signature checks on notifications.
2. Anomaly detection: transfers between young accounts, unusual repeat-discovery patterns, many accounts from one IP or install.
3. Token rotation and an optional link to Sign in with Apple or Google for recovery.
4. Moderation tooling for reports, plus an operator VC adjustment with dual control.
5. A professional review of loot-box and consumer law (see `docs/SOURCE_REGISTER.md`).
