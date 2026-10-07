#!/usr/bin/env python3
"""Build polish assets: cast extras from zip, room BGs, VFX, UI, BGM loops.

SFX are copied from Kenney CC0 packs (impact / rpg / interface).
Backgrounds and VFX are generated to match the side-scroller palette.
"""
from __future__ import annotations

import io
import math
import os
import random
import shutil
import struct
import wave
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "hazır assetler.zip"
CAST = ROOT / "art" / "cast"
BG = ROOT / "art" / "bg"
VFX = ROOT / "art" / "vfx"
UI = ROOT / "art" / "ui"
AUDIO = ROOT / "audio"
SFX_SRC = Path("/tmp/kenney_sfx")

# zip path (endswith Idle match) -> cast id + optional extra sheets
EXTRACT = {
    "hazır assetler/Fighter/": "fighter",
    "hazır assetler/Shinobi/": "shinobi",
    "hazır assetler/Samurai_Commander/": "commander",
    "hazır assetler/Samurai_Archer/": "sarcher",
    "hazır assetler/Gorgon_1/": "gorgon1",
    "hazır assetler/Gorgon_2/": "gorgon2",
    "hazır assetler/Gorgon_3/": "gorgon3",
    "hazır assetler/Yeni klasör (2)/Satyr_1/": "satyr1",
    "hazır assetler/Yeni klasör (2)/Satyr_2/": "satyr2",
    "hazır assetler/Yeni klasör (2)/Satyr_3/": "satyr3",
    "hazır assetler/Yeni klasör (4)/Skeleton_Warrior/": "skelwar",
    "hazır assetler/Yeni klasör (4)/Skeleton_Spearman/": "skelspear",
    "hazır assetler/Yeni klasör (4)/Skeleton_Archer/": "skelarch",
    "hazır assetler/Yeni klasör (5)/Fire Wizard/": "fire",
    "hazır assetler/Yeni klasör (5)/Lightning Mage/": "light",
    "hazır assetler/Yeni klasör (5)/Wanderer Magican/": "wanderer",
    "hazır assetler/Yeni klasör (6)/Kunoichi/": "kunoichi",
    "hazır assetler/Samurai_Archer/Vampire_Girl/": "vgirl",
    "hazır assetler/Samurai_Archer/Converted_Vampire/": "converted",
    "hazır assetler/Samurai_Archer/Countess_Vampire/": "countess",
}

EXTRA_NAMES = {
    "Hurt.png": "hurt",
    "Jump.png": "jump",
    "Shield.png": "shield",
    "Special.png": "special",
    "Protect.png": "shield",
    "Protection.png": "shield",
    "Charge.png": "special",
    "Evasion.png": "jump",
}


def ensure_dirs():
    for p in (CAST, BG, VFX, UI, AUDIO):
        p.mkdir(parents=True, exist_ok=True)


def count_frames(im: Image.Image, cell=128) -> int:
    w, h = im.size
    if h != cell and h not in (96, 128):
        # pad/resize height to 128 keeping aspect per frame approx
        pass
    n = max(1, w // cell)
    return n


def normalize_sheet(im: Image.Image, cell=128) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    if h == cell:
        return im
    # scale height to cell, keep frame proportions
    scale = cell / h
    nw = max(cell, int(round(w * scale)))
    # snap width to cell multiples
    frames = max(1, round(w / h))
    out = Image.new("RGBA", (frames * cell, cell), (0, 0, 0, 0))
    for i in range(frames):
        src = im.crop((int(i * w / frames), 0, int((i + 1) * w / frames), h))
        src = src.resize((cell, cell), Image.Resampling.NEAREST)
        out.paste(src, (i * cell, 0))
    return out


def extract_cast_extras():
    z = zipfile.ZipFile(ZIP)
    names = z.namelist()
    written = []
    for prefix, cast_id in EXTRACT.items():
        for zip_name, anim in EXTRA_NAMES.items():
            path = prefix + zip_name
            if path not in names:
                continue
            im = Image.open(io.BytesIO(z.read(path)))
            sheet = normalize_sheet(im)
            out = CAST / f"{cast_id}_{anim}.png"
            sheet.save(out)
            n = sheet.width // 128
            written.append((cast_id, anim, n, out.name))
    # write manifest for script wiring
    man = CAST / "EXTRA_FRAMES.txt"
    with man.open("w") as f:
        f.write("# cast_id anim frame_count\n")
        for cast_id, anim, n, name in written:
            f.write(f"{cast_id} {anim} {n} {name}\n")
    print(f"cast extras: {len(written)} sheets")
    return written


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_bg(name, top, mid, bot, accents, props="hills"):
    """1280x720 atmospheric backdrop, soft pixel look."""
    W, H = 1280, 720
    im = Image.new("RGB", (W, H), bot)
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        if t < 0.45:
            c = lerp(top, mid, t / 0.45)
        else:
            c = lerp(mid, bot, (t - 0.45) / 0.55)
        # subtle banding
        band = (y // 3) % 2
        c = tuple(max(0, min(255, ch - band * 3)) for ch in c)
        for x in range(W):
            noise = ((x * 17 + y * 31) % 13) - 6
            px[x, y] = tuple(max(0, min(255, ch + noise // 3)) for ch in c)

    d = ImageDraw.Draw(im)
    # distant silhouettes
    rng = random.Random(hash(name) & 0xFFFFFFFF)
    if props == "hills":
        for layer, col, y0 in [
            (0, accents[0], 420),
            (1, accents[1], 480),
            (2, accents[2], 540),
        ]:
            pts = [(0, H), (0, y0)]
            x = 0
            while x <= W:
                h = y0 + rng.randint(-40 - layer * 10, 50 + layer * 8)
                pts.append((x, h))
                x += rng.randint(60, 140)
            pts += [(W, y0), (W, H)]
            d.polygon(pts, fill=col)
    elif props == "pillars":
        for i in range(8):
            x = 80 + i * 150 + rng.randint(-20, 20)
            w = rng.randint(28, 48)
            d.rectangle([x, 180, x + w, 620], fill=accents[1])
            d.rectangle([x - 8, 160, x + w + 8, 190], fill=accents[0])
        d.rectangle([0, 600, W, H], fill=accents[2])
    elif props == "ridge":
        for i in range(12):
            x = i * 120
            peak = 260 + rng.randint(-40, 80)
            d.polygon([(x, 620), (x + 60, peak), (x + 140, 620)], fill=accents[i % 3])
        d.rectangle([0, 600, W, H], fill=accents[2])
    elif props == "garden":
        d.rectangle([0, 520, W, H], fill=accents[2])
        for i in range(18):
            x = rng.randint(0, W)
            h = rng.randint(80, 220)
            d.ellipse([x - 40, 520 - h, x + 40, 540], fill=accents[0])
            d.rectangle([x - 6, 520 - h // 3, x + 6, 560], fill=accents[1])
    elif props == "night":
        for _ in range(90):
            x, y = rng.randint(0, W - 1), rng.randint(0, 360)
            d.point((x, y), fill=(220, 220, 255))
        d.ellipse([980, 40, 1120, 180], fill=accents[0])
        d.rectangle([0, 560, W, H], fill=accents[2])
        for i in range(6):
            x = 100 + i * 200
            d.rectangle([x, 300, x + 70, 600], fill=accents[1])
    elif props == "throne":
        d.rectangle([0, 560, W, H], fill=accents[2])
        d.polygon([(540, 560), (640, 220), (740, 560)], fill=accents[0])
        d.rectangle([580, 360, 700, 560], fill=accents[1])
        for i in range(5):
            x = 80 + i * 280
            d.rectangle([x, 200, x + 36, 560], fill=accents[1])

    # floor haze strip
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(40):
        a = int(40 * (i / 40))
        od.rectangle([0, 620 + i, W, 621 + i], fill=(0, 0, 0, a))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    # slight pixelation feel
    small = im.resize((W // 2, H // 2), Image.Resampling.BILINEAR)
    im = small.resize((W, H), Image.Resampling.NEAREST)
    out = BG / f"{name}.png"
    im.save(out, optimize=True)
    print("bg", out.name)
    return out


def make_backgrounds():
    make_bg(
        "bg_courtyard",
        (28, 24, 40),
        (70, 55, 70),
        (40, 28, 36),
        [(45, 35, 50), (55, 40, 48), (30, 22, 28)],
        "pillars",
    )
    make_bg(
        "bg_garden",
        (40, 70, 80),
        (50, 100, 70),
        (30, 50, 40),
        [(20, 70, 40), (40, 90, 50), (25, 45, 30)],
        "garden",
    )
    make_bg(
        "bg_crypt",
        (10, 14, 28),
        (30, 36, 55),
        (18, 20, 30),
        [(40, 45, 70), (25, 28, 42), (12, 14, 22)],
        "pillars",
    )
    make_bg(
        "bg_ridge",
        (120, 90, 60),
        (160, 110, 70),
        (80, 55, 40),
        [(90, 70, 45), (110, 80, 50), (60, 40, 30)],
        "ridge",
    )
    make_bg(
        "bg_tower",
        (50, 30, 70),
        (80, 50, 100),
        (30, 20, 45),
        [(70, 40, 90), (45, 30, 60), (25, 15, 35)],
        "pillars",
    )
    make_bg(
        "bg_night",
        (8, 12, 30),
        (20, 30, 60),
        (12, 16, 28),
        [(180, 190, 220), (25, 30, 50), (10, 12, 22)],
        "night",
    )
    make_bg(
        "bg_throne",
        (50, 20, 25),
        (90, 35, 40),
        (35, 15, 20),
        [(120, 40, 50), (70, 25, 35), (25, 10, 15)],
        "throne",
    )


def sheet_frames(draw_fn, n, size=32):
    im = Image.new("RGBA", (n * size, size), (0, 0, 0, 0))
    for i in range(n):
        cell = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(cell), i, n, size)
        im.paste(cell, (i * size, 0))
    return im


def make_vfx():
    def spark(d, i, n, s):
        cx = cy = s // 2
        r = max(1, int((1 - i / n) * (s // 2 - 2)))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 220, 120, 220 - i * 30))
        d.ellipse([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2], fill=(255, 255, 240, 255))

    def slash(d, i, n, s):
        t = i / max(1, n - 1)
        y0 = int(4 + t * 20)
        y1 = int(s - 4 - t * 8)
        x0 = int(4 + t * 8)
        x1 = int(s - 4)
        for w, col in [(5, (255, 240, 180, 90)), (3, (255, 220, 100, 180)), (1, (255, 255, 255, 240))]:
            d.line([(x0, y0), (x1, y1)], fill=col, width=w)

    def dash(d, i, n, s):
        a = 200 - i * 35
        for k in range(4):
            x = 4 + k * 6 + i
            d.ellipse([x, 10 + k, x + 8, 22 + k], fill=(160, 190, 255, max(0, a - k * 30)))

    def hit(d, i, n, s):
        cx = cy = s // 2
        arms = 6
        for a in range(arms):
            ang = (a / arms) * math.pi * 2 + i * 0.2
            r = 6 + i * 3
            x = cx + math.cos(ang) * r
            y = cy + math.sin(ang) * r
            d.line([(cx, cy), (x, y)], fill=(255, 80, 60, 220 - i * 40), width=2)
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(255, 200, 180, 255))

    sheet_frames(spark, 6).save(VFX / "spark.png")
    sheet_frames(slash, 5).save(VFX / "slash.png")
    sheet_frames(dash, 5).save(VFX / "dash_dust.png")
    sheet_frames(hit, 5).save(VFX / "hit_burst.png")
    print("vfx sheets ok")


def make_ui():
    # gate icon 32x32
    gate = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(gate)
    d.rounded_rectangle([4, 6, 28, 30], radius=4, fill=(60, 40, 90, 230), outline=(200, 140, 255, 255), width=2)
    d.ellipse([11, 12, 21, 22], outline=(220, 180, 255, 255), width=2)
    d.point((16, 17), fill=(255, 255, 255, 255))
    gate.save(UI / "gate.png")

    heart = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(heart)
    d.polygon([(8, 14), (2, 7), (4, 3), (8, 5), (12, 3), (14, 7)], fill=(220, 60, 70, 255))
    heart.save(UI / "heart.png")

    special = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(special)
    d.polygon([(8, 1), (10, 6), (15, 6), (11, 9), (13, 14), (8, 11), (3, 14), (5, 9), (1, 6), (6, 6)], fill=(255, 200, 80, 255))
    special.save(UI / "special.png")
    print("ui icons ok")


def write_wav(path: Path, samples, rate=22050):
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        w.writeframes(frames)


def synth_loop(path: Path, freqs, seconds=8.0, rate=22050):
    n = int(rate * seconds)
    samples = []
    for i in range(n):
        t = i / rate
        # fade edges for seamless-ish loop
        env = 1.0
        edge = 0.4
        if t < edge:
            env = t / edge
        elif t > seconds - edge:
            env = (seconds - t) / edge
        v = 0.0
        for j, f in enumerate(freqs):
            amp = 0.12 / (j + 1)
            v += amp * math.sin(2 * math.pi * f * t)
            v += amp * 0.35 * math.sin(2 * math.pi * (f * 1.5) * t + 0.3)
        # soft noise bed
        v += (random.random() * 2 - 1) * 0.015
        samples.append(v * env * 0.55)
    wav = path.with_suffix(".wav")
    write_wav(wav, samples, rate)
    # convert to ogg
    ogg = path.with_suffix(".ogg")
    os.system(f'ffmpeg -y -loglevel error -i "{wav}" -c:a libvorbis -q:a 4 "{ogg}"')
    wav.unlink(missing_ok=True)
    print("bgm", ogg.name)


def make_bgm():
    synth_loop(AUDIO / "bgm_courtyard", [110, 165, 220])
    synth_loop(AUDIO / "bgm_garden", [98, 147, 196])
    synth_loop(AUDIO / "bgm_crypt", [82, 123, 164])
    synth_loop(AUDIO / "bgm_ridge", [130, 174, 220])
    synth_loop(AUDIO / "bgm_tower", [92, 138, 207])
    synth_loop(AUDIO / "bgm_night", [73, 110, 146])
    synth_loop(AUDIO / "bgm_throne", [65, 98, 130])


def copy_sfx():
    mapping = {
        "sfx_slash.ogg": "knifeSlice.ogg",
        "sfx_slash2.ogg": "knifeSlice2.ogg",
        "sfx_slash3.ogg": "drawKnife1.ogg",
        "sfx_hit.ogg": "impactMetal_medium_000.ogg",
        "sfx_hit2.ogg": "impactMetal_medium_001.ogg",
        "sfx_hit_heavy.ogg": "impactMetal_heavy_000.ogg",
        "sfx_hurt.ogg": "impactPunch_medium_000.ogg",
        "sfx_dash.ogg": "cloth2.ogg",
        "sfx_parry.ogg": "impactPlate_light_000.ogg",
        "sfx_block.ogg": "metalClick.ogg",
        "sfx_arrow.ogg": "impactSoft_medium_000.ogg",
        "sfx_portal.ogg": "doorOpen_1.ogg",
        "sfx_upgrade.ogg": "handleCoins.ogg",
        "sfx_death.ogg": "impactBell_heavy_000.ogg",
        "sfx_slam.ogg": "impactPunch_heavy_000.ogg",
        "sfx_ui.ogg": "confirmation_001.ogg",
        "sfx_ui2.ogg": "confirmation_002.ogg",
        "sfx_special.ogg": "maximize_006.ogg",
        "sfx_foot.ogg": "footstep_concrete_000.ogg",
    }
    for dest, src in mapping.items():
        src_p = SFX_SRC / src
        if not src_p.exists():
            print("missing sfx", src)
            continue
        shutil.copy2(src_p, AUDIO / dest)
    # license note
    (AUDIO / "LICENSE.txt").write_text(
        "SFX: Kenney.nl Impact Sounds, RPG Audio, Interface Sounds — CC0 1.0\n"
        "https://kenney.nl/assets\n"
        "BGM: short synthesized loops generated for this game (public domain).\n"
    )
    print("sfx copied")


def main():
    ensure_dirs()
    extract_cast_extras()
    make_backgrounds()
    make_vfx()
    make_ui()
    copy_sfx()
    make_bgm()
    print("done")


if __name__ == "__main__":
    main()
