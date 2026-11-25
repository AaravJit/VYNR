# VYNR design system: "Dusk"

VYNR should feel like a phone app that could exist inside a modern open-world
game: a quiet, confident tool you pull out on the street, not a dashboard and
not a hacker terminal. Tokens live in `src/theme/tokens.ts`; shared components
in `src/components/ui.tsx`, `Brand.tsx`, `ScanOverlay.tsx`, `Intel.tsx`.

## References and what we took from them

- **GTA VI phone UI / WAiNK** (public trailers and Rockstar's site only). No
  source we found documents WAiNK's actual colours, type or layout, so nothing
  is copied from it. What we take is the *idea*: in-universe software that
  scans a car and returns a punchy dossier with a little attitude. All art,
  logos, sounds and names here are original. See RESEARCH.md for the evidence
  and its gaps.
- **Cal AI**: the camera is the home screen; one tap to capture; an analysing
  state over the photo; a result you can log in one more tap; correction is
  available but secondary.

## Principles

1. **Camera first.** The scanner is the first tab and the landing screen after
   onboarding. Two taps from launch to a registered discovery.
2. **One loud thing per screen.** Brand gradient appears only on the logo, the
   shutter ring, scan sweeps and first-discovery moments. Everything else is
   neutral.
3. **Facts and fiction never blur.** Verified catalog data is headed in blue
   ("VERIFIED CATALOG RECORD") with sources; AI predictions say "AI
   PREDICTION" with a match band; simulated intel is violet and tagged
   "SIMULATED · FOR FUN".
4. **Thumb reach.** Primary actions sit low and full-width; the floating tab
   bar stays out of the camera's way.
5. **Calm by default.** No glows, scanlines or monospace "terminal" text. Small
   caps labels, generous spacing, compact headings.

## Tokens

| Group | Values |
| --- | --- |
| Canvas | `bg #0B0A12`, `surface #14121E`, `surfaceRaised #1B1828`, borders `#272238` / `#3A3352` |
| Glass (over camera) | `rgba(16,14,26,0.66)` and `0.86`, hairline `rgba(255,255,255,0.10)` |
| Text | `#F6F4FB`, muted `#ADA7C2`, faint `#8A83A3` (all ≥ 4.5:1 on bg and surface) |
| Brand | pink `#FF5FA8` (primary), violet `#A07BFF` (simulated intel), blue `#55AEFF` (verified data) |
| Status | danger `#FF6170`, warning `#FFB84D`, success `#5BE3B5` |
| Radius | 8, 14, 20, 28, pill |
| Type | Inter Tight only. Display 30, h1 24, h2 19, h3 16, body 15, small 13, label 11 small caps; tabular numbers for stats |
| Motion | 140 / 220 / 420 ms; every loop stops under Reduce Motion |

## Key moments

- **Scanner**: full-bleed camera, glass header with the aperture lockup, four
  rounded corner marks that breathe when ready and turn violet while busy,
  gradient shutter ring, collection count, one safety line.
- **Scan report**: photo with an analysis sweep and a redaction chip, then the
  identity, match band, reward, a single "Register discovery" button, verified
  facts and specs, then street intel.
- **Discovery**: the emblem scales in, the gradient ring sweeps around it on a
  first discovery, XP fades up; distinct sounds for normal and rare finds, plus
  a success haptic.

## Sound and haptics

Four original synthesised sounds (`scripts/generate-sounds.py`): shutter,
identified, discovery, rare discovery. They mix with the player's music, obey
the silent switch and can be turned off in Profile. Haptics: selection for
toggles, impact for the shutter, success and error for outcomes.

## Icon

The app icon (`scripts/generate-icons.py`) is the six-blade aperture mark in
the brand gradient on the Dusk canvas, readable down to 48 px.
