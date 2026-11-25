# Source register (Prompt 3)

Each row records a source, what it says, its licence or status, and the engineering decision it drove. Earlier research is in `RESEARCH.md` (models, pricing, WAiNK and Cal AI patterns, spec licensing) and `docs/DATA_SOURCES.md` (automotive data). Read on 25 Nov 2026 unless stated. Quotes are short; Google pages are paraphrased.

## Platform rules

| Source | Finding | Decision |
| --- | --- | --- |
| [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 3.1.1 | Loot boxes "must disclose the odds of receiving each type of item to customers prior to purchase." | Every crate shows its full odds table on the crate screen before the Open button, from the same server config that draws the result |
| Same, 3.1.1 | Purchased "credits or in-game currencies… may not expire"; apps "may not use their own mechanisms to unlock content". | VC is earned only (never sold), never expires. Any future paid unlock must go through StoreKit/Play Billing |
| Same, 3.1.1 | Gifts of IAP-eligible items "may not be exchanged"; no general rule on player trading was found. | The marketplace trades only earned collectibles for earned VC. No real-money item is ever tradeable. Flagged for professional review |
| Same, 3.1.2(a), (c) | Subscriptions must give "ongoing value" for at least seven days and say what the user gets before subscribing. | VYNR Black paywall lists every benefit, price, period and renewal terms; monthly and annual only |
| Same, 1.2 | UGC needs "a mechanism to report offensive content" and "the ability to block abusive users". | Public profiles and listing titles get report and block. No free-text messaging |
| Same, 5.1.1(v) (summary read) | Apps with account creation must offer in-app account deletion. | `DELETE /v1/account` plus an in-app button; server deletes or anonymises the account |
| Same, 4.8 (summary read) | Third-party login requires an equivalent privacy-focused option. | Launch uses an anonymous device account (no third-party login). Sign in with Apple is a Prompt 5 item if added |
| [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) | Digital goods and virtual currency use Play Billing; currency only usable in the app; randomized items must show odds before and near the purchase. | Same as Apple: odds table next to the Open button; VC stays inside VYNR |
| [Google Play subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533) | Disclose price, billing frequency and auto-renewal; provide sustained value; offer an easy online cancel path. | Paywall shows price, cadence and renewal; Profile links to the store's subscription management |
| [Google Play real-money gambling](https://support.google.com/googleplay/android-developer/answer/9877032) | Real-money wagering needs a licence and cannot use Play Billing. | VC can never be bought or cashed out; crates cost earned VC only |
| [App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-v2.md), [@apple/app-store-server-library](https://npmjs.com/package/@apple/app-store-server-library) | Respond 200–206; signed payloads verified with `SignedDataVerifier` and Apple root certificates; production needs the app's Apple ID. | Server has an entitlement state machine and a verifier interface. Without Apple credentials and root certificates the endpoint refuses (no simulated success) |
| [Play RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference), [subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions) | RTDN only signals a change; `purchases.subscriptionsv2.get` is the source of truth; acknowledge new purchases within 3 days or they are refunded; keep benefits in grace period; block during account hold. | Entitlement states: active, grace (benefits on), on_hold (off), expired, revoked/refunded (off). Google verifier needs service-account credentials |

## Randomised rewards and consumer protection

| Source | Finding | Decision |
| --- | --- | --- |
| [Osborne Clarke, May 2026](https://www.osborneclarke.com/insights/games-loot-boxes-get-16-plus-age-rating-europe-under-pegi-overhaul); [Greenberg Traurig, Mar 2026](https://www.gtlaw.com/de/insights/2026/3/pegi-updates-eu-video-game-age-rating-system) | PEGI rates games with **paid** random items 16 by default from June 2026; time-limited offers PEGI 12; daily login rewards PEGI 7. Earned-only currency is not addressed. | Crates use earned-only VC and no countdown offers. **Professional review needed** on rating impact before launch |
| [UK ASA enforcement notice, Feb 2026](https://www.asa.org.uk/resource/enforcement-notice-disclosure-of-loot-boxes-in-app-stores.html) | Store listings for games with loot boxes buyable with money (or with currency only obtainable by paying) must say "contains loot boxes" prominently. | Earned-only crates appear outside the text, but the store listing will say "Contains random item crates (earned currency only)" anyway |

## Recognition on the device

| Source | Finding | Decision |
| --- | --- | --- |
| [ML Kit object detection](https://developers.google.com/ml-kit/vision/object-detection) | Coarse categories are home goods, fashion, food, plants and places only; up to five objects; tracking IDs only in stream mode. | The default detector is used as a **class-agnostic box proposer** for target selection and framing, not as a car classifier |
| [ML Kit image labeling label map](https://developers.google.com/ml-kit/vision/image-labeling/label-map) | Base model includes Car, Vehicle, Wheel and Tire. | Would be the ideal on-device vehicle gate, but the maintained Expo module (`@infinitered/react-native-mlkit-image-labeling` 5.0.0) only loads custom models. Vehicle confirmation therefore stays in the cloud answer, behind on-device gates. Prompt 4: bundle an Apache-2.0 classifier or write a small module for the base labeler |
| `expo-camera` types (`node_modules/expo-camera/build/Camera.types.d.ts`) | `takePictureAsync` supports `shutterSound: false`, `quality`, `scale`. | Frames are sampled as silent low-quality captures, no frame processor dependency |
