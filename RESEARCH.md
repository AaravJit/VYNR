# Build VYNR on structure, not borrowed style

VYNR's best practical path combines five decisions. Copy the information structure of GTA VI's WAiNK scanner and Cal AI's camera-first flow, but not their look. Run Claude Haiku 5.5 for recognition and escalate to Sonnet 5.5 only on low confidence, for about **$0.27–$1.32 per 1,000 scans**. Hand-curate a per-generation spec catalog from CC0 Wikidata, public-domain EPA data and manufacturer press figures. Redact faces and plate-like text regions on the device in a small local Expo module before any upload, and fail closed if that step fails. Let Claude review PRs but never approve them itself: a deterministic job, signed as a separate GitHub App, submits the approval bound to the exact head SHA. The evidence is strong on licensing, pricing, Expo APIs and GitHub security mechanics. It is weak in three places that matter. No source describes WAiNK's visual design. No benchmark covers current models (Claude 5.x, GPT-6, Gemini 3.x) on car recognition or measures their single-image latency. No verified on-device plate-detector benchmark exists. Each of those gaps needs an in-house test before launch, and the sections below flag every place the evidence ran out.

## WAiNK supplies a pattern to copy; Cal AI supplies the flow and the mistakes to avoid

WAiNK is real and shipped in GTA VI, which released on **19 November 2026** on PS5 and Xbox Series X|S. It was first shown in Rockstar's Extended Look on 27 August 2026 ([Wikipedia](https://en.wikipedia.org/wiki/Grand_Theft_Auto_6)). How it works is well documented. The player scans a parked car and sees whether it is locked, whether it has an alarm or tracker, which entry tool it needs, its Pay 'n' Spray or fence value, and the cost to register it ([ConsolePulse](https://consolepulse.com/multiplatform/gta/news/gta-6-car-theft-security-tiers-waink-scanner-tools)). Rockstar presents it as "a new app built specifically for car theft" ([AllThings.How](https://allthings.how/gta-6-phone-explained-snapmatic-waink-and-wanted-levels/)). A post-launch guide describes the result layout: **make and model first, then a vehicle group (type, era, seats, storage, condition), then an access, security and tracker group** ([GTABoss](https://www.gtaboss.gg/gta-6/guides/gta-6-phone-apps)). According to IGN, it also scans landmarks and sculptures ([Digit](https://www.digit.in/news/gaming/gta-6-gameplay-9-cool-things-you-can-do-on-jasons-ifruit-phone-in-grand-theft-auto-vi.html)). Some commentators read the name as a sexual double meaning ([GadgetReview](https://www.gadgetreview.com/grand-theft-auto-vi-turns-silicon-valley-satire-into-functional-in-game-smartphone-apps)), which is one more reason VYNR should not echo it. The wider phone is the iFruit, an Apple parody, with round app icons and apps such as WhatUp, RydeMe, BuckMe and Snapmatic ([GTABoss](https://www.gtaboss.gg/gta-6/guides/gta-6-phone-apps)). It is also diegetic: the character pulls the phone out and the camera moves in close, unlike GTA V's flat overlay ([NeonSect](https://neonsect.com/gta-6/gta-6-phone-apps/); [AllThings.How](https://allthings.how/gta-6-phone-explained-snapmatic-waink-and-wanted-levels/)). Snapmatic is a feed you can scroll but cannot post to ([Wikipedia](https://en.wikipedia.org/wiki/Grand_Theft_Auto_6)).

**Evidence not found:** none of the twelve sources describes WAiNK's colours, typography, layout, iconography, translucency or scan animation. No source documents GTA VI's palette or typefaces either. The common impression of pink, orange and violet dusk gradients with a teal counterpoint comes from general knowledge, not from cited evidence. Trailer coverage adds nothing on phone UI ([PC Gamer](https://www.pcgamer.com/games/grand-theft-auto/all-the-takeaways-and-little-details-from-grand-theft-auto-6s-new-trailer)), and the only sourced art-direction facts concern murals and fashion ([Wikipedia](https://en.wikipedia.org/wiki/Grand_Theft_Auto_6)). Footage from the 2026 leaks should be treated as unofficial ([Game Informer](https://gameinformer.com/2026/08/26/rockstar-games-responds-to-heartbreaking-grand-theft-auto-vi-leaks)). Any visual decision that cites WAiNK has to come from a designer watching Rockstar's official footage first-hand, and only as reference.

Cal AI is the evidence-backed model for the flow. It has **4.8 stars from 377K ratings**, and users praise "Point and click and it logs it" ([App Store](https://apps.apple.com/us/app/-/id6480417616)). It opens on a camera with Scan Food, Barcode and Food Label modes plus voice. Results are editable, and badges collect in a Milestones "trophy room" ([ScreensDesign](https://screensdesign.com/showcase/cal-ai-calorie-tracker)). The sources are just as clear about its weaknesses. Correcting a result takes "several steps" ([ScreensDesign](https://screensdesign.com/showcase/cal-ai-calorie-tracker)). App Store reviews say that "sometimes it takes a very long time to load" ([App Store](https://apps.apple.com/us/app/-/id6480417616)). One review says it offers "less transparency and fewer correction tools" ([Macaron](https://macaron.im/playbook/cal-ai-review)). Monetisation is aggressive and heavily optimised:

- a **28-step onboarding quiz** before a 3-day trial ([ScreensDesign](https://screensdesign.com/showcase/cal-ai-calorie-tracker))
- **61 paywall experiments**, 46 trigger points and a spin-the-wheel discount ([Superwall](https://superwall.com/case-studies/cal-ai))
- about 87% of new users see a paywall ([Superwall](https://superwall.com/case-studies/cal-ai))
- a $0.99 "Streak Restore" purchase, with scan results behind a subscription ([App Store](https://apps.apple.com/us/app/-/id6480417616))

**Evidence not found:** there are no measured tap counts, no scan latency figures, and no description of Cal AI's analysing animation or result-card styling.

The two references disagree on one design question: should a scan result be a new page or a layer over the camera? Cal AI's result screen works, but WAiNK's in-world phone suggests a stronger answer. The result can be a card that rises over the frozen frame, so the scan feels like an object in the scene rather than a navigation step. The legal line runs between pattern and expression. The WAiNK and Cal AI sources document a functional pattern (identify, group attributes, show a value) that no one owns ([ConsolePulse](https://consolepulse.com/multiplatform/gta/news/gta-6-car-theft-security-tiers-waink-scanner-tools); [GTABoss](https://www.gtaboss.gg/gta-6/guides/gta-6-phone-apps); [ScreensDesign](https://screensdesign.com/showcase/cal-ai-calorie-tracker)). Rockstar's names (WAiNK, iFruit, Vice City, Leonida), its "VI" logo and its screen art are protected. **Evidence not found:** no GTA-specific case law or Rockstar fan-content policy was researched.

**Recommendation.**

- **Layout:** open straight into the camera with one shutter and a few modes. Show the result as a card over the frozen frame: make, model and generation in the header, then grouped spec sections, then a rarity or "value" figure.
- **Logging and correction:** log the scan by default, with undo. Show the top three candidates as a confidence signal, and make "Not right?" a one-tap correction. Show analysing progress in stages, because slow loading is Cal AI's most common complaint.
- **Look:** use near-black, high-contrast surfaces. Keep your own warm-to-cool dusk gradient for hero moments, rarity tiers and the shutter glow, with original hues and typefaces.
- **Collection:** put badges in a separate trophy-room screen.
- **Monetisation:** no paywall before the first successful scan, no wheel discounts, no paid streak restore, and never gate the core scan result.
- **Legal:** use real car makes only as factual text, never as logos. Keep GTA screenshots and "GTA-style" wording out of store copy, and run a trademark search on "VYNR".

## Price stopped being the constraint: Haiku 5.5 costs about $0.32 per 1,000 scans

The pricing evidence is current, retrieved on 25 November 2026. **Claude Haiku 5.5 costs $0.10 input and $0.50 output per million tokens, one-tenth the price of Haiku 4.5** ($1/$5). Sonnet 5.5 costs $2/$10 and Opus 5.5 $4/$20. Batch processing is 50% off every model ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)). All current models accept images. Anthropic labels Haiku 5.5 "Fastest", Sonnet 5.5 "Fast" and Opus 5.5 "Moderate" ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)).

Images are billed at one token per 28×28 patch, so **a 1024×768 photo costs 1,036 tokens**. Claude 4.7 and later models use a high-resolution tier of up to 2,576 px and 4,784 tokens, so a 1024 px image is never downscaled ([Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). The 5.5 models can cache prompts as short as 512 tokens, so VYNR's 600-token system prompt qualifies. Haiku 4.5 needs at least 4,096 tokens to cache ([Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)). Structured JSON outputs are generally available on all models. The first use of a new schema adds a compile delay, and the compiled schema is then cached for 24 hours ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).

The table models one scan as 1,700 input tokens and 300 output tokens, with thinking turned off. Competitor rows assume the same image token count, which **was not verified** for OpenAI or Gemini, so treat them as illustrative.

| Model | $/MTok in/out | $/1k scans | $/1k with cached prompt | Source |
|---|---|---|---|---|
| Claude Haiku 5.5 | 0.10 / 0.50 | **$0.32** | **$0.27** | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| OpenAI gpt-6-luna | 0.10 / 0.50 | $0.32 | $0.27 | [OpenAI (md)](https://developers.openai.com/api/docs/pricing.md) |
| Plate Recognizer + MMC | per lookup | $0.75–$1.50 | n/a | [Plate Recognizer](https://platerecognizer.com/pricing/) |
| Gemini 3.1 Flash-Lite | 0.25 / 1.50 | $0.88 | $0.74 + storage | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.5 Flash-Lite | 0.30 / 2.50 | $1.26 | $1.10 | [Artificial Analysis](https://artificialanalysis.ai/models/comparisons/claude-haiku-5-5-vs-gemini-3-5-flash-lite) |
| Gemini 3 Flash preview | 0.50 / 3.00 | $1.75 | $1.48 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Claude Haiku 4.5 / gpt-6.1-terra | 1 / 5 | $3.20 | not cacheable / $2.63 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 3.5 Flash | 1.50 / 9 | $5.25 | $4.44 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Claude Sonnet 5.5 / gpt-6.2-sol | 2 / 10 | $6.40 | $5.26 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 3.1 Pro preview | 2 / 12 | $7.00 | $5.92 | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| Claude Opus 5.5 | 4 / 20 | $12.80 | $10.52 | [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) |
| OpenAI gpt-6.2-astra | 8 / 40 | $25.60 | $21.04 | [OpenAI (md)](https://developers.openai.com/api/docs/pricing.md) |

Three source conflicts remain open:

- OpenAI's [HTML pricing page](https://developers.openai.com/api/docs/pricing) once showed gpt-6.1-terra at $0.50/$2.50. The markdown version labels that as the batch price.
- Artificial Analysis lists a "Gemini 3.5 Flash-Lite" that does not appear in the part of Google's page that was read.
- Plate Recognizer charges for every image, including images with no plate. **Evidence not found:** no source says whether its make-and-model output includes generation or year. Pricing for the dedicated vendors listed on [Capterra](https://www.capterra.com/p/10035870/Make-and-Model-Recognition-MMR/) and [AWS Marketplace](https://aws.amazon.com/marketplace/pp/B08V73HTPB) (Carnet.ai, Sighthound, Car.ai and API4AI) was not retrieved.

Even Sonnet 5.5 costs under one cent per scan, so accuracy should decide the model. That is where the evidence is weakest:

- **Stanford Cars (2023):** GPT-4V scored **62.7% top-1** zero-shot, against 94.2% for a dedicated EVA ViT-E model ([arXiv 2311.15732](https://arxiv.org/pdf/2311.15732)).
- **FINER (2024):** LLaVA-1.5-7B managed 25–30% ([arXiv 2402.16315](https://arxiv.org/pdf/2402.16315)).
- **Make, model and generation all correct (May 2026):** **Gemini Pro 2.5 scored 98.1%, Gemini Flash 2.5 96.7% and Claude Sonnet 4 88.4%** ([arXiv 2605.21747](https://arxiv.org/html/2605.21747)). These images come from a proprietary driving dataset, not phone photos, so treat the result as directional only. It suggests Google's Flash tier led on this task in that generation.
- **Car models launched after 2023 (October 2025):** a CLIP baseline scored 21% and retrieval-augmented LLMs reached only 37–39% ([arXiv 2510.18502](https://arxiv.org/html/2510.18502v1)). This points to a reference catalog in the prompt mattering as much as the choice of model.

**Evidence not found:** there is no published accuracy for Haiku, Sonnet or Opus 5.5, GPT-6 or Gemini 3.x on cars, and no study of modified cars. Latency is the other gap. Artificial Analysis measured Haiku 5.5 only with reasoning on (6.93 s to first token, 26.88 s end to end, at 219 tokens/s) and Gemini 3.5 Flash-Lite at 4.72 s and 13.33 s ([Artificial Analysis](https://artificialanalysis.ai/models/comparisons/claude-haiku-5-5-vs-gemini-3-5-flash-lite)). Neither figure reflects a short, non-reasoning, single-image call. Generating 300 tokens at about 220 tokens/s takes roughly 1.4 s plus time to first token, but that is an estimate, not a measurement.

**Recommendation.**

- **Default model:** call Haiku 5.5 with thinking off. Send a 1024 px JPEG, cache the system prompt, request strict JSON output (make, model, generation, the top three candidates, a confidence score) and set `max_tokens` to about 400. Retry when output is cut off at the token limit ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). Set `"oversized_image": "error"` so an oversized photo is rejected rather than silently downscaled ([Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)).
- **Cost control:** skip repeat scans of the same image by hashing it first. Escalate to Sonnet 5.5 only when confidence is low or the top three are close. At an assumed 20% escalation rate this totals about **$1.32 per 1,000 scans**.
- **Before committing:** build a labelled set of 300–500 real phone photos and test Haiku 5.5, Sonnet 5.5, Gemini 3.1 Flash-Lite and gpt-6-luna on it, measuring accuracy and time to first token. The 2025–2026 papers suggest Gemini could win on accuracy. Insert candidate generations from VYNR's own catalog into the prompt, since retrieval is what closes the new-model gap.

## Free, legal spec data exists, but only as a hand-curated catalog

VYNR needs facts for each generation: chassis code, years, body styles, engines, power, torque, drivetrain, 0–100 and top speed. These facts must be legal to bundle inside a free app.

The US legal position is favourable. Under *Feist* (1991), individual facts such as "2,998 cc, 382 hp" are not copyrightable. Only an original selection and arrangement is protected ([Wikipedia: Compilation copyright](https://en.wikipedia.org/wiki/Compilation_copyright); [Feist opinion](https://cyber.harvard.edu/people/tfisher/IP/1991_Feist.pdf)). The EU adds a sui generis database right. It lasts 15 years and bars extracting "all or a substantial part" of a database that took substantial investment, even by repeated small extractions. "No database right exists in the United States" ([Wikipedia: Database right](https://en.wikipedia.org/wiki/Database_right); [Directive 96/9/EC](https://www.legislation.gov.uk/eudr/1996/9/data.pdf)). The practical rule: restating facts in your own schema is safe, but mirroring one source in bulk is not.

The sources compare as follows.

**Wikidata** is the cleanest licence. Its structured data is CC0 with no attribution requirement ([Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)). It is weak as a spec source. A mirror shows P2109 as a general "nominal power capacity" property ([citygraph mirror](https://citygraph.abudhabi.nyu.edu/wiki/Property:P2109)). **Evidence not found:** wikidata.org was unreachable, so the property IDs for car specs and coverage at generation level are unverified.

**Wikipedia infoboxes** carry engine, power, torque and production years, as the DBpedia mapping shows, but not transmission, body style or layout ([DBpedia mapping](https://mappings.dbpedia.org/index.php/Mapping_en:Table/Automobile)). Bulk-copying them risks CC BY-SA obligations and EU extraction claims.

**US government data** has no licence text and is the strongest free structured source:

- **EPA/DOE fueleconomy.gov** offers displacement, cylinders, drive and transmission for **model years 1984 to 2026** in CSV, XML or JSON. The page carries no licence text, and its footer credits Oak Ridge National Laboratory for DOE and EPA ([Web services](https://www.fueleconomy.gov/feg/ws/index.shtml); [Downloads](https://fueleconomy.gov/feg/download.shtml)).
- **NHTSA vPIC** is listed as "public" on data.gov ([data.gov](https://catalog.data.gov/dataset/nhtsa-product-information-catalog-and-vehicle-listing-vpic)). Its downloadable databases cover VIN decoding only ([vPIC Downloads](https://vpic.nhtsa.dot.gov/Downloads)).
- Neither source has horsepower, 0–100, chassis codes or models sold outside the US.

**Commercial data** almost always blocks bundling:

- **cars-data.com** prohibits redistribution outright: "Offering the Data … as a dataset is redistribution". Display in a public app costs **2× the internal-use price** and requires "Data by cars-data.com" on every screen ([terms](https://cars-data.com/en/api/terms)).
- **CarAPI.app** costs $199–$299 a year, but its caching question goes unanswered and its terms were not read ([pricing](https://carapi.app/pricing)).
- **CarsXE** limits data retention to 7–14 days ([pricing](https://carsxe.com/pricing)).
- **CarQuery** offers a database download, but its licence is unstated, and a support thread raises questions about lawful use ([CarQuery](https://www.carqueryapi.com/); [thread](https://remarpro.com/support/topic/are-you-illegally-using-he-carquery-api)).
- **Teoalida** sells broad US, EU and JDM databases cheaply, but its licence page was not read ([Database Atlas](https://www.databaseatlas.com/)).
- **JATO** is an enterprise subscription ([JATO T&Cs](https://www.jato.com/jato-legal/global-terms-and-conditions-for-jato-subscription-services)).

Manufacturer spec pages are the primary source for performance figures ([Volvo example](https://www.volvocars.com/ie/support/car/xc60/article/0ed816eed33d98cac0a8cc377bc12bc7-6bfdac4b4abcdd12c0a8b08066d6eafa-8664b2fa77a7e089c0a8296870d1a409)). **Evidence not found:** press-site terms, the auto-data.net terms, the status of the Edmunds API, DataOne and Chrome Data pricing, and US case law specific to vehicle-spec databases.

**Recommendation.** Build a curated catalog in VYNR's own schema. Each generation stores its chassis code, years, body styles and origin. Each generation also holds a list of engines, and every field records its market and a `source_url`. Show ranges, never one trim's figure presented as "the" generation spec. Build it in four steps:

1. Export make, model and generation items with their years from Wikidata (CC0).
2. Join the EPA all-years CSV to get US engine and transmission options.
3. Fill in horsepower, torque, 0–100 and top speed from manufacturer press material, restated in your own words.
4. Use Wikipedia only to find primary citations.

Credit "U.S. DOE/EPA fueleconomy.gov" and Wikidata voluntarily. Pay for a commercial display licence only if catalog breadth outgrows manual curation. Data fees come to about $0. The real cost is curation time, estimated at 15–30 minutes per generation.

## Redact before upload with a local Expo module, and fail closed

The face-detection options on Expo SDK 58 have narrowed, and that changes the build-versus-buy answer:

- **expo-face-detector is gone.** Versioned docs stop at v52, and the SDK 58 index does not list the module ([v52 FaceDetector](https://docs.expo.dev/versions/v52.0.0/sdk/facedetector); [v58 index](https://docs.expo.dev/versions/v58.0.0.md)). It was also removed from Expo Go ([expo/fyi](https://github.com/expo/fyi/blob/main/face-detector-removed.md)).
- **CameraView dropped face detection** when it was introduced in SDK 50 ([Expo blog](https://expo.dev/blog/expo-camera-next.md)).
- **Infinite Red's ML Kit wrapper** offers a clean still-image hook, `useFacesInPhoto(localUri)` ([docs](https://docs.infinite.red/react-native-mlkit/face-detection/getting-started/)). But its compatibility table stops at **SDK 56**, and it does not mention New Architecture ([GitHub](https://github.com/infinitered/react-native-mlkit)). That matters because SDK 58 makes New Architecture mandatory and needs Xcode 26.4+ ([buildmvpfast](https://www.buildmvpfast.com/blog/expo-sdk-58-ios-27-react-native-088-breaking-changes-2026)).
- **Other wrappers:** the a7medev ML Kit wrapper's SDK 58 status is unconfirmed ([npm](https://www.npmjs.com/package/@react-native-ml-kit/face-detection)). VisionCamera face plugins only help if you switch camera libraries ([luicfrr](https://github.com/luicfrr/react-native-vision-camera-face-detector)). VisionCamera v5's metadata face output works on iOS only ([Margelo](https://margelo.com/blog/whats-new-in-visioncamera-v5/llms.txt)).
- **Apple's own API**, `DetectFaceRectanglesRequest`, is a direct native option ([Apple](https://developer.apple.com/documentation/vision/detectfacerectanglesrequest.md)).

Neither platform has a first-party plate detector, so the choice is between a proxy and a custom model:

- **Text regions on iOS:** `DetectTextRectanglesRequest` (iOS 18+) returns text regions *without recognising the characters* ([Apple](https://developer.apple.com/documentation/vision/detecttextrectanglesrequest.md)). That fits a "never read plates" rule well. It over-redacts signs and logos, which is a safe direction for privacy errors.
- **Text regions on Android:** ML Kit text recognition always runs full OCR ([npm](https://www.npmjs.com/package/@react-native-ml-kit/text-recognition)). The text would have to be thrown away inside native code before anything reaches JavaScript.
- **A custom model:** a YOLO plate detector via `react-native-fast-tflite`, which has an Expo config plugin and Core ML and GPU delegates ([npm](https://npmjs.com/package/react-native-fast-tflite)), would cut false positives. It brings model sourcing, accuracy testing and AGPL licence questions for Ultralytics weights.
- **OpenALPR wrappers** read plate text, which breaks the no-OCR rule ([npm](https://www.npmjs.com/package/react-native-openalpr)).

**Evidence not found:** there are no verified accuracy or latency benchmarks for any on-device plate detector, and no confirmation of a detection-only mode in ML Kit.

Applying the redaction also needs native code or Skia:

- **expo-image-manipulator can't do it.** Its SDK 58 methods are crop, extent, flip, resize and rotate, with no blur or drawing ([ImageManipulator v58](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator.md)).
- **Skia can,** through offscreen surfaces and `encodeToBytes()` ([Skia offscreen](https://www.mintlify.com/shopify/react-native-skia/canvas/offscreen)), at a higher memory cost on full-resolution photos.
- **View-shot is fragile** because it captures at screen resolution ([react-native-view-shot](https://github.com/bubble-dev/react-native-view-shot)).

Server-side redaction still sends raw faces and plates over the network, so it fails a "redact before upload" requirement. No source supports a heuristic fallback such as blurring the lower-centre band, and it misses faces entirely.

On the camera itself, keep expo-camera. Versions 57.0.1 to 57.0.3 added iOS fast-capture prioritisation "for lower shutter lag", configure the session fully before start (fixing dark frames at launch), process photos off the main thread, and fix a capture promise that hung on iOS 17+. Orientation is now saved as **EXIF rather than by rotating pixels**, so redaction boxes must account for it ([expo-camera CHANGELOG](https://unpkg.com/expo-camera@57.0.3/CHANGELOG.md)). The SDK 58 docs cover the relevant options: `quality`, `skipProcessing`, `shutterSound`, `pictureRef`, `onPictureSaved`, the iOS-only `active` prop and `onCameraReady` ([Camera v58](https://docs.expo.dev/versions/v58.0.0/sdk/camera.md)). SDK 58 also adds `scanDocumentAsync`, builds against iOS 27, and makes iPhone apps resizable ([SDK 58 changelog](https://expo.dev/changelog/sdk-58.md)). On iOS 27, `ScreenOrientation.lockAsync` may do nothing while the app is resizable ([buildmvpfast](https://www.buildmvpfast.com/blog/expo-sdk-58-ios-27-react-native-088-breaking-changes-2026)). VisionCamera v5, now at 5.2.0, is rebuilt on Nitro and claims "much more responsive" capture, but its benchmarks are "coming soon" and it says nothing about Expo support ([Margelo](https://margelo.com/blog/whats-new-in-visioncamera-v5/llms.txt); [newreleases](https://newreleases.io/project/yarn/react-native-vision-camera/release/5.2.0)). **Evidence not found:** there are no measured startup or shutter-lag figures for either camera library.

One easily missed trap affects game feel. **On iOS, haptics do nothing while the camera is active**, in Low Power Mode, or during dictation ([Haptics v58](https://docs.expo.dev/versions/v58.0.0/sdk/haptics.md)). Fire the "discovery" haptic only after `active={false}` or on the result card. For sound effects, call `Audio.preload` at module scope and use the `mixWithOthers` audio mode ([Audio v58](https://docs.expo.dev/versions/v58.0.0/sdk/audio.md)). SDK 56 added web haptics and `useAudioStream` ([SDK 56](https://expo.dev/changelog/sdk-56.md)).

**Recommendation.**

1. Build a local Expo module (`create-expo-module --local`) that exposes `redact(uri) -> uri`.
2. On iOS, use Vision face rectangles plus text rectangles. On Android, use ML Kit face detection plus text recognition, keeping only the region frames and discarding the text natively.
3. Pixelate each region with 20–30% padding, using large blocks or a solid fill rather than a light blur. Write a JPEG and delete the original.
4. Capture with expo-camera at a `quality` of about 0.8, with `skipProcessing: false` and base64 off, and only after `onCameraReady`. Then resize and compress with ImageManipulator and upload.
5. If detection fails, block the upload and let the user add redaction boxes by hand.
6. Treat a YOLO plate model as a phase-3 upgrade, after recall tests on real photos.

## Claude reviews, a deterministic job approves, and the approval is bound to one SHA

`anthropics/claude-code-action@v1` gives Claude only the tools listed in `claude_args --allowedTools`. With a plain prompt, "Claude has no shell or GitHub API access until you grant the tools" ([GitHub Actions docs](https://code.claude.com/docs/en/github-actions)). It can authenticate with an API key, an OAuth token, or keyless workload identity federation (which needs `id-token: write`). The official review recipes only post comments. One uses `pull_request` with `--allowedTools` restricted to inline comments and `gh pr diff`/`view`/`comment` ([solutions.md](https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md)). The other runs the `code-review` plugin with read-only `pull-requests: read` ([docs](https://code.claude.com/docs/en/github-actions)). The `use_sticky_comment` and `track_progress` inputs shape how comments are delivered ([usage.md](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)). The [Claude GitHub App](https://github.com/apps/claude) has a broad permission set that cannot be reduced, so the docs recommend a custom App for least privilege. The managed [Code Review](https://code.claude.com/docs/en/code-review.md) product exists but was not researched. **Evidence not found:** no Anthropic document or example shows the action submitting an APPROVE review ([security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)).

The 2026 incident record explains why the model should not hold approval power:

- **CVE-2026-47751**, before v1.0.74: the action loaded an attacker PR's `.mcp.json`, allowing remote code execution and secret theft ([Rapid7](https://www.rapid7.com/db/vulnerabilities/cve-2026-47751/)).
- **RyotaK's finding**, fixed in **v1.0.94**: an injection through an issue body made Claude read `/proc/self/environ` and leak OIDC credentials that could be exchanged for a write token ([The Hacker News](https://thehackernews.com/2026/06/claude-code-github-action-flaw-let-one.html?m=1)).
- **Microsoft's report:** the Read tool exposed `ANTHROPIC_API_KEY` until Claude Code 2.1.128. Microsoft recommends the "Agents Rule of Two": never combine untrusted input, access to secrets, and tools that communicate externally or change state ([Microsoft Security Blog](https://microsoft.com/en-us/security/blog/2026/06/05/securing-ci-cd-in-agentic-world-claude-code-github-action-case)).
- **Cline:** an injected issue title led to npm token theft and an unauthorised package publish ([The Hacker News](https://thehackernews.com/2026/06/claude-code-github-action-flaw-let-one.html?m=1)).
- **Further write-ups** were seen but not fetched: [CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/), [GHSL-2025-093](https://securitylab.github.com/advisories/GHSL-2025-093_PraisonAI/) and ["Comment and Control"](https://dev.to/clampd_dev/comment-and-control-a-github-comment-hijacks-claude-code-in-ci-28jo).

The action strips hidden HTML and invisible characters from input but warns that "new bypass techniques may emerge" ([security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)). Granting `Bash(gh pr review:*)` would hand approval authority to a model that reads text an attacker controls.

Which identity approves matters as much as the tooling. Rulesets accept approvals from accounts with write access or from code owners ([rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)). In personal repositories, workflows may not approve PRs by default ([Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository); [changelog](https://github.blog/changelog/2022-05-03-github-actions-prevent-github-actions-from-creating-and-approving-pull-requests/)). Community reports say `github-actions[bot]` approvals do not satisfy required reviews ([community #181487](https://github.com/orgs/community/discussions/181487)). CodeRabbit confirms that a GitHub App's approval "counts as one approving review". It also warns that an approval count alone does not say *who* must approve, so it advises CODEOWNERS plus stale-approval dismissal ([CodeRabbit](https://docs.coderabbit.ai/pr-reviews/approval-policies)). **Evidence not found:** no official GitHub document confirms either point. That an author cannot approve their own PR is well established, but the page that states it ([approving with required reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews)) was not fetched.

The choice of trigger is the remaining design fork. `pull_request` gives no secrets to fork PRs, but a PR can edit the workflow it runs under. `pull_request_target` runs the default branch's workflow with secrets, which is safe only if PR code is never run. GitHub's pwn-request guidance warns against exactly that, and GitHub begins enforcing a default policy on **2 December 2026** ([pull_request_target guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target); [Security Lab](https://securitylab.github.com/research/github-actions-preventing-pwn-requests)). The REST reviews endpoint accepts `commit_id`, which ties an approval to a specific SHA ([REST reviews](https://docs.github.com/en/rest/pulls/reviews)). Turning on last-push approval without stale dismissal is "less safe" ([protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).

**Recommendation.** Split the work into three workflows and lock down the repository settings.

1. **`ci.yml`** runs on `pull_request` with `contents: read` and no secrets. It is a required status check.
2. **`claude-review.yml`** runs on `workflow_run` after CI, from the default branch, with two jobs:
   - **Job A** pins claude-code-action to the full commit SHA of v1.0.94 or later. It checks out the base branch only, puts the PR head read-only in `pr-head/` (or fetches the diff for the exact `HEAD_SHA`), and never installs or builds. Its permissions are `contents: read`, `pull-requests: read` and `id-token: write`, and its tools are limited to `Read`, `Grep`, `Glob`, `gh pr diff` and `gh pr view`, with no web fetch. The prompt says PR content is untrusted. The job writes JSON with the head SHA, a verdict and findings by path, line, severity and category (security, functionality, architecture, privacy, performance, visual consistency).
   - **Job B** uses no LLM. It mints a token for a dedicated `vynr-reviewer` App with only `pull-requests: write`. It checks that CI is green for `HEAD_SHA`, that the head has not moved, that no `.github/**`, `CLAUDE.md`, `.claude/**`, `.mcp.json` or `CODEOWNERS` files changed, and that there are no blocking findings. Only then does it post APPROVE or REQUEST_CHANGES with `commit_id: HEAD_SHA`. It runs with per-PR `concurrency` and `cancel-in-progress`.
3. **The ruleset on `main`** requires:
   - 1 approval
   - stale-approval dismissal and last-push approval
   - Code Owner review, with the human owner listed for the policy files and the reviewer App not a code owner
   - CI and claude-review as required checks
   - conversation resolution
   - an empty bypass list

   Leave "Allow GitHub Actions to create and approve pull requests" and auto-merge **off**. Keep the identity that authors PRs separate from the reviewer App. Use a dedicated Anthropic key with a spending cap, or OIDC federation.

Before relying on this, confirm on a test PR that the App's approval satisfies the ruleset. Check whether the repository is public, given the 2 December policy change.

## Conclusion

The five areas share a lesson: the hard problems are trust boundaries, not capability. Recognition is cheap enough to ignore, and expo-camera is fast enough. The risks sit at the edges: Rockstar's trade dress, a data vendor's redistribution clause, a raw photo leaving the phone, and an LLM holding approval power. In each case the winning design puts a deterministic, auditable layer between something powerful and something irreversible. That layer is an original visual language over a borrowed structure, a source URL on every spec field, a native redaction step that fails closed, and a non-LLM job that approves one exact SHA.

The biggest unknown is not cost but accuracy at generation level on real phone photos. The 2026 literature hints that Google's Flash tier may beat Claude there, and that retrieval from VYNR's own catalog may matter more than the choice of model. So the curated catalog does double duty, as the game's content and as the recogniser's reference. A small in-house evaluation set is therefore the highest-value next deliverable. Three other open questions also need first-hand checks before they harden into decisions: WAiNK's actual visuals, plate-detection recall, and whether a GitHub App's approval counts.
