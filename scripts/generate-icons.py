# Generates VYNR's original app icon set: the six-blade aperture mark from
# src/components/Brand.tsx, filled with the pink -> violet -> blue brand gradient
# on the "Dusk" near-black background. Usage: python3 scripts/generate-icons.py assets/images
import math
import sys

from PIL import Image, ImageDraw

BG = (11, 10, 18, 255)
STOPS = [(0.0, (255, 95, 168)), (0.55, (160, 123, 255)), (1.0, (85, 174, 255))]
WHITE = (246, 244, 251, 255)
out = sys.argv[1]
S = 4  # supersampling


def bezier(p0, p1, p2, p3, n=40):
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
        yield (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def mark_mask(size, scale):
    """Alpha mask of the mark in a 100x100 design space, centred and scaled."""
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    k = size * scale / 100
    off = size * (1 - scale) / 2
    tx = lambda x, y: (off + x * k, off + y * k)  # noqa: E731
    # Ring: r=46, stroke 7.
    r_out, r_in = 49.5 * k, 42.5 * k
    c = size / 2
    d.ellipse([c - r_out, c - r_out, c + r_out, c + r_out], fill=255)
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], fill=0)
    # Six blades: "M50 12 C66 14 78 24 84 38 L58 46 Z" rotated in 60 degree steps.
    blade = list(bezier((50, 12), (66, 14), (78, 24), (84, 38))) + [(58, 46)]
    for i in range(6):
        a = math.radians(i * 60)
        pts = []
        for x, y in blade:
            dx, dy = x - 50, y - 50
            pts.append(tx(50 + dx * math.cos(a) - dy * math.sin(a), 50 + dx * math.sin(a) + dy * math.cos(a)))
        d.polygon(pts, fill=235)
    return m


def gradient(size):
    # Smooth, so it is computed small and upscaled.
    small = 256
    g = Image.new('RGBA', (small, small))
    px = g.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            for (o0, c0), (o1, c1) in zip(STOPS, STOPS[1:]):
                if o0 <= t <= o1:
                    f = (t - o0) / (o1 - o0)
                    px[x, y] = tuple(int(c0[j] + (c1[j] - c0[j]) * f) for j in range(3)) + (255,)
                    break
    return g.resize((size, size), Image.BICUBIC)


def render(size, bg, scale=0.72, mono=None):
    big = size * S
    mask = mark_mask(big, scale)
    fill = Image.new('RGBA', (big, big), mono) if mono else gradient(big)
    img = Image.new('RGBA', (big, big), bg)
    img.paste(fill, (0, 0), mask)
    # Centre point (r=6), white on the colour mark.
    k = big * scale / 100
    c, r = big / 2, 6 * k
    dot = mono or WHITE
    ImageDraw.Draw(img).ellipse([c - r, c - r, c + r, c + r], fill=dot)
    return img.resize((size, size), Image.LANCZOS)


render(1024, BG).save(f'{out}/icon.png')
# Android adaptive: foreground must sit inside the central ~66% safe zone.
render(1024, (0, 0, 0, 0), scale=0.5).save(f'{out}/android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), BG).save(f'{out}/android-icon-background.png')
render(1024, (0, 0, 0, 0), scale=0.5, mono=(255, 255, 255, 255)).save(f'{out}/android-icon-monochrome.png')
render(512, (0, 0, 0, 0), scale=0.9).save(f'{out}/splash-icon.png')
render(48, BG, scale=0.86).save(f'{out}/favicon.png')
