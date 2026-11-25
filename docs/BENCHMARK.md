# Recognition benchmark

**Status: the harness is built and tested, but it has not been run.** There are
no accuracy numbers yet. Running it needs an API key and a set of real photos
you have the right to send to a third-party API, and neither was available in
the build environment. Until it runs, VYNR treats the model's confidence as
uncalibrated and shows only a coarse band ("Strong / Possible / Weak match"),
never a percentage.

## What it measures

`server/scripts/benchmark.ts` sends each photo through the exact production
path (same prompt, same Haiku → Sonnet escalation, same image limits) and reports:

- vehicle detected rate
- top-1 make, top-1 make + model, model in top 3
- generation accuracy, for photos labelled with a generation
- **reliability by confidence band**: accuracy of answers the model called
  high, medium and low. This is the check that decides whether bands can ever
  be presented as more than self-reported
- accuracy per tag (modified, night, rear, partial, rebadge, rare…)
- latency p50 and p95, escalation rate, total cost and cost per 1,000
- the first 15 misses, for failure analysis

## Building the photo set

Aim for **at least 300 photos** across the catalog, with deliberate hard cases:

| Tag | Why | Target share |
| --- | --- | --- |
| *(none)* | Clean three-quarter view in daylight | 40% |
| `rear`, `side`, `partial` | Real street framing | 20% |
| `night`, `rain` | Bad light | 10% |
| `modified` | Wheels, wraps, body kits | 10% |
| `similar-gen` | Facelifts and neighbouring generations | 10% |
| `rebadge` | Twins such as GR86 / BRZ | 5% |
| `not-in-catalog` | Should be reported as unmatched, not forced into a catalog car | 5% |

Use your own photos, or photos whose licence allows this use (for example
Wikimedia Commons images under CC0 or CC BY with attribution kept in the
manifest). Blur faces and plates first. Resize to 1024 px on the long edge,
which is what the app sends, for example `sips -Z 1024 *.jpg` on macOS or
`mogrify -resize 1024x1024\> *.jpg` with ImageMagick.

## Manifest

A JSON array next to the photos:

```json
[
  {
    "file": "photos/gr86-01.jpg",
    "width": 1024,
    "height": 683,
    "make": "Toyota",
    "model": "GR86",
    "generation": "ZN8",
    "tags": ["rebadge"],
    "source": "Own photo, 2026-11-20",
    "license": "Owner"
  }
]
```

Use the catalog's make, model and generation names so scores line up with what
the app matches. Set `generation` to `null` when you are not sure.

## Running

```bash
cd server
ANTHROPIC_API_KEY=... node scripts/benchmark.ts ../bench/manifest.json --out ../bench/results.json
# Try a subset first (cost check):
ANTHROPIC_API_KEY=... node scripts/benchmark.ts ../bench/manifest.json --limit 20
# Compare without escalation:
RECOGNITION_ESCALATION_MODEL=off ANTHROPIC_API_KEY=... node scripts/benchmark.ts ../bench/manifest.json
```

At the default settings 300 photos should cost well under $1 (see RESEARCH.md).

## After the first run

1. Paste the summary here with the date, model versions and photo count.
2. If high-band accuracy is not clearly above medium, keep showing bands only.
3. Tune `ESCALATE_BELOW_CONFIDENCE` from the reliability table: escalate the
   band where the fast model's accuracy drops.
4. Add the misses as regression cases and re-run after prompt changes.
