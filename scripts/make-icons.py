"""Generates the PNG icons in icons/ (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)

def icon(size: int) -> Image.Image:
    scale = 4  # draw large then downsample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=BLUE)
    # three nodes linked together: a nod to "remote procedure calls"
    r = s * 0.11
    pts = [(s * 0.5, s * 0.27), (s * 0.27, s * 0.7), (s * 0.73, s * 0.7)]
    w = max(scale, int(s * 0.07))
    for a, b in [(0, 1), (0, 2), (1, 2)]:
        d.line([pts[a], pts[b]], fill=WHITE, width=w)
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)

OUT.mkdir(exist_ok=True)
for size in (16, 48, 128):
    icon(size).save(OUT / f"icon-{size}.png")
    print(f"icons/icon-{size}.png")
