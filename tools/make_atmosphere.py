#!/usr/bin/env python3
"""Rich room atmospheres for Ronin's Redemption.

Composites the existing palace / hall photos with painted depth, light, fog,
and midground silhouettes so each gate reads as a place — not a flat tint.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BG = ROOT / "art" / "bg"
MID = ROOT / "art" / "mid"
W, H = 1280, 720


def ensure():
    BG.mkdir(parents=True, exist_ok=True)
    MID.mkdir(parents=True, exist_ok=True)


def clamp(v, a=0, b=255):
    return max(a, min(b, int(v)))


def lerp(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def load_photo(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def cover_fit(src: Image.Image, crop=None) -> Image.Image:
    if crop:
        src = src.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    sw, sh = src.size
    scale = max(W / sw, H / sh)
    dw, dh = int(sw * scale), int(sh * scale)
    src = src.resize((dw, dh), Image.Resampling.LANCZOS)
    ox = (dw - W) // 2
    oy = dh - H  # pin bottom (courtyard)
    return src.crop((ox, oy, ox + W, oy + H))


def grade(im: Image.Image, shadows, mids, highlights, sat=0.85, contrast=1.08, dark=0.92):
    px = im.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            if lum < 0.35:
                t = lum / 0.35
                col = lerp(shadows, mids, t)
            else:
                t = (lum - 0.35) / 0.65
                col = lerp(mids, highlights, t)
            # mix with original
            mix = 0.55
            nr = r * (1 - mix) + col[0] * mix
            ng = g * (1 - mix) + col[1] * mix
            nb = b * (1 - mix) + col[2] * mix
            # soft crush
            nr, ng, nb = nr * dark, ng * dark, nb * dark
            px[x, y] = (clamp(nr), clamp(ng), clamp(nb))
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    return im


def vignette(im: Image.Image, strength=0.55, warm=(20, 8, 0)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx, cy = W / 2, H * 0.55
    for i in range(40):
        t = i / 39
        a = int(strength * 220 * (t ** 1.6))
        pad = int(t * 420)
        d.ellipse([cx - W * 0.7 - pad, cy - H * 0.7 - pad, cx + W * 0.7 + pad, cy + H * 0.7 + pad],
                  outline=(warm[0], warm[1], warm[2], a), width=14)
    # fill edges
    edge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    for y in range(H):
        for x in range(0, 50):
            a = int(180 * (1 - x / 50) * strength)
            ed.point((x, y), fill=(0, 0, 0, a))
            ed.point((W - 1 - x, y), fill=(0, 0, 0, a))
    for x in range(W):
        for y in range(0, 60):
            a = int(160 * (1 - y / 60) * strength)
            ed.point((x, y), fill=(0, 0, 0, a))
        for y in range(0, 90):
            a = int(200 * (y / 90) * strength)
            ed.point((x, H - 1 - y), fill=(0, 0, 0, a))
    out = Image.alpha_composite(im.convert("RGBA"), edge)
    return Image.alpha_composite(out, overlay).convert("RGB")


def paint_sky_band(im: Image.Image, top, bot, y0=0, y1=280):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        c = lerp(top, bot, t)
        d.line([(0, y), (W, y)], fill=(*c, 90))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_clouds(im: Image.Image, rng, color=(180, 160, 150), y_band=(40, 220), n=8, alpha=40):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for _ in range(n):
        x = rng.randint(-40, W)
        y = rng.randint(*y_band)
        for k in range(5):
            rx = x + k * 28 + rng.randint(-8, 8)
            ry = y + rng.randint(-10, 10)
            rw = rng.randint(50, 110)
            rh = rng.randint(18, 36)
            d.ellipse([rx, ry, rx + rw, ry + rh], fill=(*color, alpha))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_lanterns(im: Image.Image, positions, glow=(255, 170, 80), body=(60, 30, 20)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for x, y in positions:
        # glow
        for r, a in ((70, 28), (40, 50), (18, 90)):
            d.ellipse([x - r, y - r, x + r, y + r], fill=(*glow, a))
        d.rectangle([x - 5, y - 10, x + 5, y + 8], fill=(*body, 230))
        d.rectangle([x - 7, y - 12, x + 7, y - 8], fill=(90, 50, 30, 240))
        d.line([(x, y - 30), (x, y - 12)], fill=(40, 25, 20, 220), width=2)
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_windows(im: Image.Image, rects, color=(255, 200, 120), alpha=70):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for x, y, w, h in rects:
        d.rectangle([x, y, x + w, y + h], fill=(*color, alpha))
        # soft bloom
        for i in range(3):
            d.rectangle([x - 4 - i * 2, y - 4 - i * 2, x + w + 4 + i * 2, y + h + 4 + i * 2],
                        outline=(*color, max(10, alpha - 20 * i)))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def ground_haze(im: Image.Image, color=(20, 10, 8), height=160, alpha=120):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(height):
        t = i / height
        a = int(alpha * (t ** 1.4))
        d.line([(0, H - height + i), (W, H - height + i)], fill=(*color, a))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def light_shafts(im: Image.Image, shafts, color=(255, 220, 160), alpha=28):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for x0, top_w, bot_w, y0, y1 in shafts:
        pts = [
            (x0 - top_w // 2, y0),
            (x0 + top_w // 2, y0),
            (x0 + bot_w // 2, y1),
            (x0 - bot_w // 2, y1),
        ]
        d.polygon(pts, fill=(*color, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def mist_bands(im: Image.Image, rng, color=(180, 190, 200), bands=4):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(bands):
        y = 380 + i * 55 + rng.randint(-10, 10)
        for k in range(6):
            x = rng.randint(-50, W)
            d.ellipse([x, y, x + rng.randint(180, 320), y + rng.randint(28, 50)],
                      fill=(*color, 18 + i * 4))
    overlay = overlay.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_trees(im: Image.Image, rng, count=10, trunk=(40, 28, 20), leaf=(30, 70, 45)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for _ in range(count):
        x = rng.randint(20, W - 20)
        base = 560 + rng.randint(-20, 40)
        h = rng.randint(120, 260)
        d.rectangle([x - 4, base - h, x + 4, base], fill=(*trunk, 210))
        for _b in range(5):
            cx = x + rng.randint(-50, 50)
            cy = base - h + rng.randint(-20, 60)
            rw = rng.randint(40, 90)
            rh = rng.randint(30, 70)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(*leaf, 160))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_mountains(im: Image.Image, layers):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for col, y0, amp, seed in layers:
        rng = random.Random(seed)
        pts = [(0, H), (0, y0)]
        x = 0
        while x <= W:
            pts.append((x, y0 - rng.randint(0, amp) + rng.randint(-20, 20)))
            x += rng.randint(40, 100)
        pts += [(W, y0), (W, H)]
        d.polygon(pts, fill=(*col, 230))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_moon(im: Image.Image, x, y, r=48, color=(230, 235, 255)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for rr, a in ((r + 40, 20), (r + 18, 40), (r, 220)):
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(*color, a))
    # crater soft
    d.ellipse([x - 10, y - 8, x + 6, y + 6], fill=(200, 205, 220, 60))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_stars(im: Image.Image, rng, n=120):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for _ in range(n):
        x, y = rng.randint(0, W - 1), rng.randint(0, 340)
        a = rng.randint(80, 220)
        s = rng.choice([1, 1, 1, 2])
        d.ellipse([x, y, x + s, y + s], fill=(230, 235, 255, a))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_torii_or_gate(im: Image.Image, x, y, w=160, h=200, col=(90, 30, 30)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    # posts
    d.rectangle([x, y, x + 14, y + h], fill=(*col, 210))
    d.rectangle([x + w - 14, y, x + w, y + h], fill=(*col, 210))
    # beams
    d.rectangle([x - 16, y, x + w + 16, y + 16], fill=(*col, 230))
    d.rectangle([x - 8, y + 36, x + w + 8, y + 48], fill=(*col, 220))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def draw_banner(im: Image.Image, x, y, h=90, col=(140, 40, 40)):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.line([(x, y), (x, y + h)], fill=(40, 30, 25, 220), width=3)
    d.polygon([(x, y + 8), (x + 28, y + 20), (x, y + 40)], fill=(*col, 200))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def pixel_soften(im: Image.Image):
    # slight film grain + keep resolution
    rng = random.Random(7)
    px = im.load()
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            n = rng.randint(-6, 6)
            r, g, b = px[x, y]
            px[x, y] = (clamp(r + n), clamp(g + n), clamp(b + n))
    return im


def make_mid_layer(name, draw_fn):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(im)
    out = MID / f"mid_{name}.png"
    im.save(out, optimize=True)
    print("mid", out.name)
    return out


def build_all():
    ensure()
    palace = load_photo(ROOT / "background.jpg")
    hall = load_photo(ROOT / "background_boss.png")
    castle_crop = (0, 115, 1023, 793)

    # ---- COURTYARD: dusk palace ----
    rng = random.Random(11)
    im = cover_fit(palace, castle_crop)
    im = grade(im, (18, 12, 28), (70, 45, 55), (160, 120, 90), sat=0.75, contrast=1.12, dark=0.88)
    im = paint_sky_band(im, (40, 25, 55), (90, 50, 45), 0, 220)
    im = draw_clouds(im, rng, (120, 90, 90), (30, 180), 7, 35)
    im = light_shafts(im, [(220, 40, 120, 0, 520), (980, 30, 100, 0, 500)], (255, 190, 120), 22)
    im = draw_lanterns(im, [(180, 300), (1100, 310), (640, 250), (420, 360), (860, 360)])
    im = draw_banner(im, 300, 200, 100, (150, 40, 40))
    im = draw_banner(im, 980, 190, 110, (130, 35, 40))
    im = mist_bands(im, rng, (160, 140, 130), 3)
    im = ground_haze(im, (25, 12, 10), 180, 140)
    im = vignette(im, 0.62, (30, 10, 0))
    im = pixel_soften(im)
    im.save(BG / "bg_courtyard.png", optimize=True)
    print("bg_courtyard")

    # ---- GARDEN: green overgrown yard ----
    rng = random.Random(22)
    im = cover_fit(palace, castle_crop)
    im = grade(im, (10, 30, 22), (40, 80, 50), (140, 170, 90), sat=1.05, contrast=1.05, dark=0.9)
    im = paint_sky_band(im, (70, 110, 120), (100, 140, 90), 0, 240)
    im = draw_clouds(im, rng, (200, 210, 190), (40, 200), 6, 40)
    im = draw_trees(im, rng, 14, (45, 35, 25), (25, 90, 50))
    im = draw_torii_or_gate(im, 560, 360, 170, 220, (90, 35, 30))
    im = mist_bands(im, rng, (180, 210, 180), 5)
    im = ground_haze(im, (15, 35, 20), 200, 110)
    im = light_shafts(im, [(700, 50, 160, 0, 560)], (200, 255, 160), 18)
    im = vignette(im, 0.5, (0, 20, 10))
    im = pixel_soften(im)
    im.save(BG / "bg_garden.png", optimize=True)
    print("bg_garden")

    # ---- CRYPT: cold stone hall ----
    rng = random.Random(33)
    im = cover_fit(hall)
    im = grade(im, (8, 10, 22), (30, 40, 60), (90, 110, 140), sat=0.55, contrast=1.15, dark=0.82)
    im = paint_sky_band(im, (5, 8, 18), (20, 28, 45), 0, 200)
    im = draw_windows(im, [(200, 160, 36, 70), (1040, 160, 36, 70), (400, 140, 28, 60), (860, 140, 28, 60)],
                      (140, 190, 255), 55)
    im = light_shafts(im, [(220, 20, 80, 80, 520), (1060, 20, 80, 80, 520)], (160, 200, 255), 20)
    im = mist_bands(im, rng, (140, 160, 190), 4)
    im = ground_haze(im, (5, 8, 16), 220, 150)
    im = vignette(im, 0.72, (0, 0, 20))
    im = pixel_soften(im)
    im.save(BG / "bg_crypt.png", optimize=True)
    print("bg_crypt")

    # ---- RIDGE: golden cliff dusk ----
    rng = random.Random(44)
    im = cover_fit(palace, castle_crop)
    im = grade(im, (40, 20, 15), (120, 70, 35), (220, 150, 70), sat=1.1, contrast=1.1, dark=0.93)
    im = paint_sky_band(im, (255, 140, 70), (80, 40, 50), 0, 300)
    im = draw_clouds(im, rng, (255, 180, 120), (20, 160), 5, 45)
    im = draw_mountains(im, [
        ((70, 40, 35), 420, 160, 1),
        ((95, 55, 40), 480, 120, 2),
        ((55, 30, 25), 540, 80, 3),
    ])
    im = mist_bands(im, rng, (220, 180, 120), 3)
    im = ground_haze(im, (40, 20, 12), 160, 100)
    im = vignette(im, 0.55, (40, 15, 0))
    im = pixel_soften(im)
    im.save(BG / "bg_ridge.png", optimize=True)
    print("bg_ridge")

    # ---- TOWER: violet mage hall ----
    rng = random.Random(55)
    im = cover_fit(hall)
    im = grade(im, (25, 10, 40), (70, 35, 90), (160, 100, 200), sat=1.0, contrast=1.12, dark=0.86)
    im = paint_sky_band(im, (30, 10, 50), (70, 30, 80), 0, 220)
    im = draw_windows(im, [(180, 150, 40, 80), (1060, 150, 40, 80), (500, 120, 50, 90), (740, 120, 50, 90)],
                      (180, 120, 255), 65)
    im = light_shafts(im, [(520, 30, 110, 60, 500), (760, 30, 110, 60, 500)], (200, 140, 255), 24)
    im = draw_lanterns(im, [(260, 280), (1020, 280)], (200, 120, 255), (40, 20, 50))
    im = mist_bands(im, rng, (160, 120, 200), 3)
    im = ground_haze(im, (20, 8, 30), 190, 130)
    im = vignette(im, 0.65, (20, 0, 30))
    im = pixel_soften(im)
    im.save(BG / "bg_tower.png", optimize=True)
    print("bg_tower")

    # ---- NIGHT: moonlit court ----
    rng = random.Random(66)
    im = cover_fit(palace, castle_crop)
    im = grade(im, (5, 8, 22), (25, 35, 70), (70, 90, 140), sat=0.7, contrast=1.18, dark=0.78)
    im = paint_sky_band(im, (5, 10, 30), (15, 25, 55), 0, 280)
    im = draw_stars(im, rng, 140)
    im = draw_moon(im, 1040, 110, 52)
    im = draw_clouds(im, rng, (40, 50, 80), (40, 180), 5, 50)
    im = draw_lanterns(im, [(200, 320), (1080, 320), (640, 280)], (255, 160, 70))
    im = mist_bands(im, rng, (80, 100, 140), 4)
    im = ground_haze(im, (5, 8, 20), 200, 150)
    im = vignette(im, 0.7, (0, 0, 30))
    im = pixel_soften(im)
    im.save(BG / "bg_night.png", optimize=True)
    print("bg_night")

    # ---- THRONE: blood hall ----
    rng = random.Random(77)
    im = cover_fit(hall)
    im = grade(im, (30, 5, 8), (90, 25, 30), (180, 70, 50), sat=1.05, contrast=1.2, dark=0.84)
    im = paint_sky_band(im, (40, 5, 10), (80, 20, 25), 0, 200)
    im = draw_windows(im, [(240, 140, 50, 100), (990, 140, 50, 100), (620, 100, 40, 80)],
                      (255, 80, 60), 50)
    im = light_shafts(im, [(640, 40, 180, 40, 560)], (255, 60, 40), 18)
    im = draw_banner(im, 360, 160, 140, (160, 20, 30))
    im = draw_banner(im, 900, 160, 140, (160, 20, 30))
    im = mist_bands(im, rng, (120, 40, 40), 3)
    im = ground_haze(im, (30, 5, 8), 210, 160)
    im = vignette(im, 0.75, (40, 0, 0))
    im = pixel_soften(im)
    im.save(BG / "bg_throne.png", optimize=True)
    print("bg_throne")

    # Midground silhouettes (transparent, drawn in front of BG, behind actors at depth 2)
    def mid_courtyard(im):
        d = ImageDraw.Draw(im)
        # hanging ropes / incense smoke wisps
        for x in (160, 400, 880, 1120):
            for i in range(50):
                a = 40 - i // 2
                if a > 0:
                    d.ellipse([x - 3 + (i % 5) - 2, 120 + i * 3, x + 3 + (i % 5) - 2, 128 + i * 3],
                              fill=(200, 180, 160, a))

    def mid_garden(im):
        d = ImageDraw.Draw(im)
        rng = random.Random(9)
        for _ in range(40):
            x = rng.randint(0, W)
            y = rng.randint(200, 520)
            d.ellipse([x, y, x + 3, y + 5], fill=(180, 60, 90, 160))  # petals

    def mid_crypt(im):
        d = ImageDraw.Draw(im)
        for x in range(40, W, 90):
            d.rectangle([x, 80, x + 2, 560], fill=(20, 30, 50, 50))

    def mid_ridge(im):
        d = ImageDraw.Draw(im)
        rng = random.Random(3)
        for _ in range(30):
            x = rng.randint(0, W)
            y = rng.randint(100, 400)
            d.ellipse([x, y, x + 2, y + 2], fill=(255, 200, 120, 100))

    def mid_tower(im):
        d = ImageDraw.Draw(im)
        rng = random.Random(4)
        for _ in range(25):
            x = rng.randint(100, W - 100)
            y = rng.randint(80, 400)
            col = rng.choice([(255, 120, 60, 140), (160, 200, 255, 140)])
            d.ellipse([x, y, x + 4, y + 4], fill=col)

    def mid_night(im):
        d = ImageDraw.Draw(im)
        rng = random.Random(5)
        for _ in range(35):
            x = rng.randint(0, W)
            y = rng.randint(250, 580)
            d.ellipse([x, y, x + 2, y + 2], fill=(255, 230, 120, 180))

    def mid_throne(im):
        d = ImageDraw.Draw(im)
        rng = random.Random(6)
        for _ in range(45):
            x = rng.randint(0, W)
            y = rng.randint(80, 500)
            d.ellipse([x, y, x + 2, y + 3], fill=(180, 30, 30, 120))

    for name, fn in [
        ("courtyard", mid_courtyard),
        ("garden", mid_garden),
        ("crypt", mid_crypt),
        ("ridge", mid_ridge),
        ("tower", mid_tower),
        ("night", mid_night),
        ("throne", mid_throne),
    ]:
        make_mid_layer(name, fn)

    (BG / "ATMO_README.txt").write_text(
        "Room backdrops rebuilt from background.jpg / background_boss.png with painted atmosphere.\n"
        "Mid layers (art/mid/) are transparent overlays for depth.\n"
        "Regenerate: python3 tools/make_atmosphere.py\n"
    )
    print("done")


if __name__ == "__main__":
    build_all()
