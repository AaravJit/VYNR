# Generates VYNR's original app icon set: lime reticle brackets around a "V" chevron on near-black.
import sys
from PIL import Image, ImageDraw

BG = (7, 8, 10, 255)
LIME = (198, 255, 61, 255)
out = sys.argv[1]
S = 4  # supersampling

def mark(draw, size, color, scale=1.0, brackets=True):
    c = size / 2
    u = size * scale
    # Chevron "V" as one polygon: outer and inner edges, flat angled tips.
    top, bottom = c - u * 0.19, c + u * 0.20
    half, w = u * 0.23, u * 0.10
    inner_bottom = bottom - w * 1.55
    draw.polygon([
        (c - half, top), (c - half + w, top), (c, inner_bottom),
        (c + half - w, top), (c + half, top), (c, bottom),
    ], fill=color)
    if brackets:
        b, L, t = u * 0.37, u * 0.14, u * 0.034
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = c + sx * b, c + sy * b
                pts = [(x, y), (x - sx * L, y), (x - sx * L, y - sy * t), (x - sx * t, y - sy * t), (x - sx * t, y - sy * L), (x, y - sy * L)]
                draw.polygon(pts, fill=color)
        d = u * 0.024
        y = c - u * 0.285
        draw.rectangle([c - d, y - d, c + d, y + d], fill=color)

def render(size, bg, color, scale=1.0, brackets=True):
    big = size * S
    img = Image.new('RGBA', (big, big), bg)
    mark(ImageDraw.Draw(img), big, color, scale, brackets)
    return img.resize((size, size), Image.LANCZOS)

render(1024, BG, LIME).save(f'{out}/icon.png')
# Android adaptive: foreground content must sit inside the central ~66% safe zone.
render(1024, (0, 0, 0, 0), LIME, scale=0.62).save(f'{out}/android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), BG).save(f'{out}/android-icon-background.png')
render(1024, (0, 0, 0, 0), (255, 255, 255, 255), scale=0.62).save(f'{out}/android-icon-monochrome.png')
render(512, (0, 0, 0, 0), LIME, scale=1.0).save(f'{out}/splash-icon.png')
render(48, BG, LIME).save(f'{out}/favicon.png')
