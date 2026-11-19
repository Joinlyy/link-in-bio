"""Builds every logo and app icon from the brand mark in public/icon.png (512x512, mark on black).

    python scripts/make-icons.py

Writes: public/logo.png (site header and pages), public/icons/icon-192.png, icon-512.png, maskable-512.png,
apple-touch-icon.png and app-icon-1024.png (the image uploaded to the Meta app).
public/favicon.png (32x32, tab icon) is supplied by hand and left alone.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
ICONS = PUBLIC / 'icons'
ICONS.mkdir(exist_ok=True)

src = Image.open(PUBLIC / 'icon.png').convert('RGB')
bg = src.getpixel((2, 2))

# Where the mark is: pixels clearly brighter than the background
w, h = src.size
px = src.load()
xs, ys = [], []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        if max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) > 40:
            xs.append(x)
            ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
mark = max(x1 - x0, y1 - y0)
print(f'mark {x1 - x0}x{y1 - y0} at ({cx:.0f},{cy:.0f}) on background {bg}')


def tile(size, fill):
    """The mark centred on the background, filling `fill` of the tile's height"""
    side = mark / fill
    canvas = Image.new('RGB', (round(side), round(side)), bg)
    canvas.paste(src.crop((round(cx - mark / 2), round(cy - mark / 2), round(cx + mark / 2), round(cy + mark / 2))),
                 (round((side - mark) / 2), round((side - mark) / 2)))
    return canvas.resize((size, size), Image.LANCZOS)


tile(256, 0.62).save(PUBLIC / 'logo.png', optimize=True)
tile(192, 0.62).save(ICONS / 'icon-192.png', optimize=True)
tile(512, 0.62).save(ICONS / 'icon-512.png', optimize=True)
tile(180, 0.62).save(ICONS / 'apple-touch-icon.png', optimize=True)
tile(1024, 0.62).save(ICONS / 'app-icon-1024.png', optimize=True)
tile(512, 0.46).save(ICONS / 'maskable-512.png', optimize=True)  # inside the 80% safe zone
print('written')
