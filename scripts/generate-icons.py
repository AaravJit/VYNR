# Generates VYNR's original "neon dusk" icon set: a gradient "V" chevron inside
# rounded viewfinder corners, lit pink -> violet -> blue on deep ink-violet.
import sys
from PIL import Image, ImageDraw, ImageFilter

BG = (11, 7, 22, 255)
STOPS = [(255, 79, 163), (166, 107, 255), (77, 184, 255)]
out = sys.argv[1]
S = 4  # supersampling


def gradient(size):
    """Diagonal pink -> violet -> blue gradient (drawn small, then smoothly upscaled)."""
    full, size = size, 256
    img = Image.new('RGBA', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            seg = min(int(t * 2), 1)
            local = t * 2 - seg
            a, b = STOPS[seg], STOPS[seg + 1]
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * local) for i in range(3)) + (255,)
    return img.resize((full, full), Image.BICUBIC)


def shape_mask(size, scale=1.0, corners=True):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    c = size / 2
    u = size * scale
    top, bottom = c - u * 0.19, c + u * 0.20
    half, w = u * 0.23, u * 0.10
    inner_bottom = bottom - w * 1.55
    d.polygon([
        (c - half, top), (c - half + w, top), (c, inner_bottom),
        (c + half - w, top), (c + half, top), (c, bottom),
    ], fill=255)
    if corners:
        # Rounded viewfinder: a rounded-square outline with the middle of each side cut away.
        b, t = u * 0.37, max(1, int(u * 0.034))
        d.rounded_rectangle([c - b, c - b, c + b, c + b], radius=u * 0.11, outline=255, width=t)
        gap = b - u * 0.19
        d.rectangle([c - gap, c - b - t, c + gap, c - b + t], fill=0)
        d.rectangle([c - gap, c + b - t, c + gap, c + b + t], fill=0)
        d.rectangle([c - b - t, c - gap, c - b + t, c + gap], fill=0)
        d.rectangle([c + b - t, c - gap, c + b + t, c + gap], fill=0)
        # Re-draw the chevron in case a cut touched it.
        d.polygon([
            (c - half, top), (c - half + w, top), (c, inner_bottom),
            (c + half - w, top), (c + half, top), (c, bottom),
        ], fill=255)
    return m


def render(size, bg, mono=None, scale=1.0, corners=True, glow=True):
    big = size * S
    img = Image.new('RGBA', (big, big), bg)
    mask = shape_mask(big, scale, corners)
    if glow and bg[3] > 0:
        halo = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        r = big * 0.42
        hd.ellipse([big / 2 - r, big / 2 - r, big / 2 + r, big / 2 + r], fill=(166, 107, 255, 70))
        img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(big * 0.12)))
        soft = mask.filter(ImageFilter.GaussianBlur(big * 0.02))
        tint = Image.new('RGBA', (big, big), (255, 79, 163, 0))
        tint.putalpha(soft.point(lambda v: int(v * 0.55)))
        img = Image.alpha_composite(img, tint)
    fill = Image.new('RGBA', (big, big), mono + (255,)) if mono else gradient(big)
    img.paste(fill, (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)


render(1024, BG).save(f'{out}/icon.png')
# Android adaptive: foreground content must sit inside the central ~66% safe zone.
render(1024, (0, 0, 0, 0), scale=0.62).save(f'{out}/android-icon-foreground.png')
bgimg = render(1024, BG, scale=0.0001, corners=False)
bgimg.save(f'{out}/android-icon-background.png')
render(1024, (0, 0, 0, 0), mono=(255, 255, 255), scale=0.62).save(f'{out}/android-icon-monochrome.png')
render(512, (0, 0, 0, 0), scale=1.0).save(f'{out}/splash-icon.png')
render(48, BG).save(f'{out}/favicon.png')
