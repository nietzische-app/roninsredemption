#!/usr/bin/env python3
"""8-bit cast for a mobile samurai. One grid, one palette, feet on a shared line.

Frames are 64x48. The foot pixel is (26, 44). Scale by an integer in the game
so the blocks stay square.
"""
import os
from PIL import Image

W, H = 64, 48
AX, AY = 26, 44  # foot line, body center

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = "/tmp/pix"
os.makedirs(PRE, exist_ok=True)

# Shared night palette. Each fighter only wears a few of these.
C = {
    "k": (10, 6, 14, 255),
    "h": (18, 14, 28, 255),
    "H": (54, 46, 72, 255),
    "s": (236, 196, 158, 255),
    "d": (176, 112, 86, 255),
    "e": (248, 248, 252, 255),
    "p": (16, 10, 18, 255),
    "i": (42, 54, 112, 255),
    "I": (96, 128, 188, 255),
    "a": (24, 28, 52, 255),
    "A": (48, 58, 96, 255),
    "r": (176, 32, 48, 255),
    "R": (232, 72, 64, 255),
    "b": (236, 240, 248, 255),
    "c": (80, 220, 228, 255),
    "g": (232, 184, 56, 255),
    "w": (112, 68, 36, 255),
    "W": (164, 108, 60, 255),
    "n": (232, 232, 236, 255),
    "o": (168, 40, 36, 255),
    "O": (224, 88, 64, 255),
    "f": (32, 88, 52, 255),
    "F": (64, 148, 80, 255),
    "m": (132, 140, 156, 255),
    "M": (216, 220, 230, 255),
    "u": (14, 16, 26, 255),
    "U": (56, 200, 188, 255),
    "t": (196, 176, 140, 255),
    "y": (92, 64, 40, 255),
}


def new():
    return {}


def put(im, x, y, col):
    if col and 0 <= x < W and 0 <= y < H:
        im[(x, y)] = C[col]


def rect(im, x, y, w, h, col):
    for yy in range(h):
        for xx in range(w):
            put(im, x + xx, y + yy, col)


def paste(im, x, y, rows):
    for yy, row in enumerate(rows):
        for xx, ch in enumerate(row):
            if ch != ".":
                put(im, x + xx, y + yy, ch)


def stroke(im, x0, y0, x1, y1, col, rad=1):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx - dy
    x, y = x0, y0
    while True:
        for oy in range(-rad, rad + 1):
            for ox in range(-rad, rad + 1):
                if abs(ox) + abs(oy) <= rad:
                    put(im, x + ox, y + oy, col)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x += sx
        if e2 < dx:
            err += dx
            y += sy


def outline(im):
    add = {}
    for (x, y) in im:
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + ox, y + oy)
            if q not in im and 0 <= q[0] < W and 0 <= q[1] < H:
                add[q] = C["k"]
    im.update(add)


def bake(im):
    outline(im)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for (x, y), col in im.items():
        img.putpixel((x, y), col)
    return img


def boot(im, x, y, col):
    rect(im, x - 2, y - 5, 4, 4, col)
    rect(im, x - 3, y - 1, 6, 2, "t")


def leg(im, hip, knee, foot, cloth, bootcol):
    stroke(im, hip[0], hip[1], knee[0], knee[1], cloth, 1)
    stroke(im, knee[0], knee[1], foot[0], foot[1] - 4, bootcol, 1)
    boot(im, foot[0], foot[1], bootcol)


def hakama(im, hx, hy, col, hi):
    # Wide split skirt. The gap is what makes the legs read as hakama.
    rect(im, hx - 6, hy, 14, 3, col)
    rect(im, hx - 7, hy + 3, 6, 5, col)
    rect(im, hx + 2, hy + 3, 6, 5, hi)
    for i in range(5):
        put(im, hx - 7, hy + 3 + i, "k")
        put(im, hx + 7, hy + 3 + i, "k")


def blade(im, x0, y0, x1, y1):
    stroke(im, x0, y0, x1, y1, "b", 0)
    # A one-pixel hamon sitting beside the steel.
    dx, dy = x1 - x0, y1 - y0
    if abs(dx) >= abs(dy):
        stroke(im, x0, y0 + 1, x1, y1 + 1, "c", 0)
    else:
        stroke(im, x0 + 1, y0, x1 + 1, y1, "c", 0)
    rect(im, x0 - 1, y0 - 1, 3, 3, "g")
    # Hilt back toward the body, two pixels.
    hx, hy = x0 - (1 if x1 >= x0 else -1), y0 + (1 if y1 <= y0 else -1)
    put(im, hx, hy, "w")
    put(im, hx - (1 if x1 >= x0 else -1), hy, "w")


def head_ronin(im, x, y, blink=False):
    paste(im, x, y, [
        "...hh....",
        "..hhhh...",
        ".hhhhhh..",
        "hhhhhhhh.",
        "hhsssssh.",
        "hhspessh." if not blink else "hhsssssh.",
        ".ssssss..",
        "..dddd...",
    ])


def head_oni(im, x, y, blink=False):
    paste(im, x, y, [
        "h......h.",
        "hh....hh.",
        "h.hhhh.h.",
        ".hoooohh.",
        "hooooohh.",
        "hopOeOhh." if not blink else "hoooooOhh.",
        ".oOOOOo..",
        "..oooo...",
    ])


def head_archer(im, x, y, blink=False):
    paste(im, x, y, [
        ".yyyyyy..",
        "yyyyyyyy.",
        "yyssssyy.",
        "yyspessy." if not blink else "yysssssy.",
        ".yssssy..",
        "..dddd...",
    ])


def head_assassin(im, x, y, blink=False):
    paste(im, x, y, [
        "...uu....",
        "..uuuu...",
        ".uuuuuu..",
        "uuuuuuuu.",
        "uuuUuuuu." if not blink else "uuuuuuuu.",
        ".uuuuuu..",
        "..uuuu...",
    ])


def katana(im, hand, tip):
    blade(im, hand[0], hand[1], tip[0], tip[1])
    rect(im, hand[0] - 1, hand[1] - 1, 3, 3, "s")


def club(im, hand, tip):
    stroke(im, hand[0], hand[1], tip[0], tip[1], "y", 1)
    rect(im, tip[0] - 3, tip[1] - 3, 7, 6, "w")
    rect(im, tip[0] - 2, tip[1] - 2, 5, 4, "W")
    rect(im, hand[0] - 1, hand[1] - 1, 3, 3, "O")


def bow(im, x, y, drawn=False):
    pts = [(1, -11), (-2, -7), (-4, -3), (-4, 3), (-2, 7), (1, 11)]
    for i in range(len(pts) - 1):
        stroke(im, x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], "W", 0)
    pull = -7 if drawn else -1
    stroke(im, x + 1, y - 11, x + pull, y, "t", 0)
    stroke(im, x + pull, y, x + 1, y + 11, "t", 0)
    if drawn:
        stroke(im, x + pull, y, x + 12, y, "w", 0)
        put(im, x + 13, y, "M")
        put(im, x + 14, y - 1, "M")
        put(im, x + 14, y + 1, "M")
    else:
        rect(im, x - 8, y - 3, 3, 7, "y")


def kite(im, x, y, stagger=False):
    ox = 4 if stagger else 0
    rect(im, x + ox, y, 14, 18, "y")
    rect(im, x + ox + 1, y + 1, 12, 16, "W")
    rect(im, x + ox + 5, y + 6, 4, 5, "m")
    rect(im, x + ox + 6, y + 7, 2, 3, "g")
    for i in range(18):
        put(im, x + ox, y + i, "y")
        put(im, x + ox + 13, y + i, "y")


def torso(im, x, y, fill, hi, belt):
    rect(im, x, y, 10, 9, fill)
    for i in range(8):
        put(im, x + 8, y + i, hi)
    rect(im, x, y + 7, 10, 2, belt)


def fighter(kind, pose):
    im = new()
    lean = pose.get("lean", 0)
    bob = pose.get("bob", 0)
    hx, hy = AX + lean, AY - 15 + bob
    skin = {"oni": "O", "assassin": "u"}.get(kind, "s")
    cloth = {"oni": "o", "archer": "f", "assassin": "u", "shield": "a"}.get(kind, "i")
    cloth_hi = {"oni": "O", "archer": "F", "assassin": "u", "shield": "A"}.get(kind, "I")
    skirt = {"oni": "o", "archer": "f", "assassin": "u", "shield": "a"}.get(kind, "a")
    belt = {"archer": "y", "assassin": "U", "oni": "g", "shield": "m"}.get(kind, "r")
    feet = pose.get("feet", ((-4, 0), (5, 0)))
    knees = pose.get("knees", ((-3, 7), (4, 7)))
    order = (1, 0) if pose.get("front", 0) == 0 else (0, 1)
    bootcol = {"oni": "o", "archer": "f", "assassin": "u", "shield": "a"}.get(kind, "A")
    if pose.get("weapon_back"):
        hand = (hx + pose["hand"][0], hy + pose["hand"][1])
        tip = (hx + pose["tip"][0], hy + pose["tip"][1])
        if kind == "oni":
            club(im, hand, tip)
        elif kind not in ("archer", "shield"):
            katana(im, hand, tip)

    def knee_at(i):
        return (hx + knees[i][0], hy + abs(knees[i][1]))

    leg(im, (hx - 1, hy + 2), knee_at(order[0]),
        (hx + feet[order[0]][0], AY + feet[order[0]][1] + bob), skirt, bootcol)
    leg(im, (hx + 2, hy + 2), knee_at(order[1]),
        (hx + feet[order[1]][0], AY + feet[order[1]][1] + bob), skirt, bootcol)
    wide = 14 if kind == "oni" else 10
    torso(im, hx - wide // 2 + 1, hy - 9, cloth, cloth_hi, belt)
    if kind in ("ronin", "shield"):
        hakama(im, hx, hy, "a", "A")
    elif kind == "oni":
        rect(im, hx - 5, hy, 12, 3, "g")
    elif kind == "archer":
        rect(im, hx - 5, hy, 11, 4, "f")
        rect(im, hx - 8, hy - 2, 3, 6, "y")
    else:
        rect(im, hx - 4, hy, 9, 3, "u")
    if kind == "shield":
        kite(im, hx + 1, hy - 14, pose.get("stagger"))
    heads = {
        "ronin": head_ronin,
        "oni": head_oni,
        "archer": head_archer,
        "assassin": head_assassin,
        "shield": head_ronin,
    }
    heads[kind](im, hx - 4, hy - 20, pose.get("blink"))
    if kind == "archer":
        bow(im, hx + 12, hy - 4, pose.get("drawn"))
    if not pose.get("weapon_back") and kind != "archer":
        if "hand" in pose:
            hand = (hx + pose["hand"][0], hy + pose["hand"][1])
            tip = (hx + pose["tip"][0], hy + pose["tip"][1])
            if kind == "oni":
                club(im, hand, tip)
            elif kind == "shield":
                # Short spear past the shield.
                stroke(im, hand[0], hand[1], tip[0], tip[1], "m", 0)
                put(im, tip[0], tip[1], "M")
            else:
                katana(im, hand, tip)
    if kind == "assassin" and pose.get("vanish"):
        # Knock out a few torso pixels so the silhouette breaks up.
        for dx, dy in ((0, -4), (2, -2), (-2, -6), (3, -7)):
            im.pop((hx + dx, hy + dy), None)
    return bake(im)


def sheet(frames):
    img = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        img.paste(fr, (i * W, 0))
    return img


# Feet offsets are from the hip, y positive downward in the last component
# stored as an extra drop (0 = planted on AY). Knees are (dx, up).

READY = dict(hand=(8, -2), tip=(18, -14))
HELD = dict(hand=(8, 0), tip=(16, 8), weapon_back=False)

def P(**kw):
    base = dict(READY)
    base.update(kw)
    return base


RONIN = [
    P(),                                  # idle
    P(blink=True),                        # idle2
    P(lean=1, feet=((-6, 0), (7, -1)), knees=((-5, 6), (6, 7)), hand=(7, 0), tip=(16, 5)),
    P(lean=0, feet=((-2, -2), (3, 0)), knees=((-1, 8), (2, 6)), hand=(7, -1), tip=(15, 3)),
    P(lean=-1, feet=((6, 0), (-7, -1)), knees=((5, 7), (-6, 6)), hand=(6, 0), tip=(15, 5)),
    P(lean=1, feet=((7, -1), (-6, 0)), knees=((6, 7), (-5, 6)), hand=(7, -1), tip=(16, 3)),
    P(lean=0, feet=((3, 0), (-2, -2)), knees=((2, 6), (-1, 8)), hand=(6, 0), tip=(15, 5)),
    P(lean=-1, feet=((-7, -1), (6, 0)), knees=((-6, 6), (5, 7)), hand=(7, -1), tip=(16, 3)),
    P(lean=2, bob=-6, feet=((-3, -8), (4, -7)), knees=((-1, 4), (2, 4)), hand=(7, -6), tip=(16, -16)),
    P(lean=1, bob=-2, feet=((-4, -4), (5, -3)), knees=((-2, 5), (3, 5)), hand=(8, 2), tip=(18, 12)),
    P(lean=-3, feet=((-2, 0), (2, -2)), knees=((-2, 6), (1, 8)), hand=(3, -4), tip=(8, -16)),
    P(lean=4, feet=((2, -1), (8, 0)), knees=((2, 7), (6, 6)), hand=(6, -2), tip=(-4, -12), weapon_back=True),
    P(lean=-2, hand=(2, -8), tip=(6, -20)),
    P(lean=6, bob=3, feet=((4, 3), (9, 3)), knees=((3, 3), (7, 2)), hand=(8, 4), tip=(16, 10), blink=True),
    P(hand=(2, -6), tip=(-8, -12), weapon_back=True),
    P(lean=3, hand=(11, -2), tip=(26, -2)),
    P(hand=(1, -8), tip=(-8, -6), weapon_back=True),
    P(lean=3, hand=(11, 0), tip=(24, 10)),
    P(hand=(-1, -2), tip=(-10, 4), weapon_back=True),
    P(lean=4, hand=(12, -3), tip=(24, -12)),
    P(lean=-2, hand=(6, 4), tip=(14, 12)),
    P(lean=-3, bob=-3, hand=(4, -10), tip=(6, -22)),
    P(lean=-4, hand=(0, -10), tip=(-10, -18), weapon_back=True),
    P(lean=5, hand=(12, 2), tip=(26, 12)),
    P(lean=4, feet=((8, 0), (-2, -1)), knees=((6, 6), (0, 7)), hand=(12, 2), tip=(26, 8)),
    P(lean=2, bob=-4, feet=((-2, -6), (5, -5)), knees=((0, 4), (3, 4)), hand=(10, 4), tip=(22, 14)),
]

def cycle(kind, idle_hand, attack_poses, walk_lean=1):
    """16 frames: idle x4, walk x4, attack x4, special x4."""
    idle = [P(**idle_hand), P(**idle_hand, blink=True), P(**idle_hand), P(**idle_hand, blink=True)]
    walk = [
        P(**idle_hand, lean=walk_lean, feet=((-6, 0), (7, -1)), knees=((-4, 6), (5, 8))),
        P(**idle_hand, feet=((-2, -2), (3, 0)), knees=((0, 8), (2, 6))),
        P(**idle_hand, lean=-walk_lean, feet=((6, 0), (-7, -1)), knees=((4, 8), (-5, 6))),
        P(**idle_hand, feet=((3, 0), (-2, -2)), knees=((2, 6), (0, 8))),
    ]
    return [fighter(kind, p) for p in idle + walk + attack_poses]


def main():
    ronin = sheet([fighter("ronin", p) for p in RONIN])
    ronin.save(os.path.join(OUT, "ronin_sheet.png"))
    ronin.save(os.path.join(PRE, "ronin_sheet.png"))

    oni_atk = [
        P(hand=(4, -6), tip=(-6, -12), weapon_back=True),
        P(hand=(6, -8), tip=(2, -16)),
        P(lean=2, hand=(12, -2), tip=(20, 2)),
        P(lean=3, hand=(14, 2), tip=(22, 8)),
    ]
    oni_spec = [
        P(bob=-1, hand=(8, -4), tip=(14, -12)),
        P(bob=-2, hand=(10, -6), tip=(16, -14)),
        P(hand=(8, 0), tip=(16, 6)),
        P(hand=(8, -2), tip=(18, -10)),
    ]
    oni = sheet(cycle("oni", dict(hand=(8, -2), tip=(16, -8)), oni_atk + oni_spec))
    oni.save(os.path.join(OUT, "oni_sheet.png"))

    arch_idle = dict(hand=(8, 0), tip=(8, 0))
    arch_shoot = [
        P(drawn=False),
        P(drawn=True, lean=-1),
        P(drawn=True, lean=-2),
        P(drawn=False, lean=1),
    ]
    arch_flee = [
        P(lean=2, feet=((-7, 0), (8, -1)), knees=((-5, 6), (6, 8))),
        P(lean=2, feet=((-2, -3), (4, 0)), knees=((0, 8), (3, 6))),
        P(lean=1, feet=((8, 0), (-7, -1)), knees=((6, 8), (-5, 6))),
        P(lean=2, feet=((4, 0), (-2, -3)), knees=((3, 6), (0, 8))),
    ]
    archer = sheet(cycle("archer", arch_idle, arch_shoot + arch_flee, walk_lean=1))
    archer.save(os.path.join(OUT, "archer_sheet.png"))

    sh_idle = dict(hand=(14, -2), tip=(22, -8))
    sh_block = [
        P(**sh_idle),
        P(**sh_idle, lean=-1),
        P(**sh_idle, lean=-2),
        P(**sh_idle, lean=-1),
    ]
    sh_stag = [
        P(**sh_idle, stagger=True, lean=3),
        P(**sh_idle, stagger=True, lean=4, blink=True),
        P(**sh_idle, stagger=True, lean=2),
        P(**sh_idle),
    ]
    shield = sheet(cycle("shield", sh_idle, sh_block + sh_stag))
    shield.save(os.path.join(OUT, "shield_sheet.png"))

    as_idle = dict(hand=(8, 0), tip=(16, 6))
    as_atk = [
        P(hand=(2, -4), tip=(-4, -8), weapon_back=True),
        P(lean=2, hand=(10, -1), tip=(20, 2)),
        P(lean=3, hand=(12, 1), tip=(22, 6)),
        P(hand=(8, 0), tip=(14, 8)),
    ]
    as_van = [
        P(**as_idle, vanish=True),
        P(**as_idle, vanish=True, bob=-1),
        P(**as_idle, vanish=True, lean=1),
        P(**as_idle, vanish=True, blink=True),
    ]
    assassin = sheet(cycle("assassin", as_idle, as_atk + as_van))
    assassin.save(os.path.join(OUT, "assassin_sheet.png"))

    # Contact sheet at 3x, nearest neighbor: the size the phone will show.
    names = ["idle", "run", "jump", "jab", "heavy"]
    picks = [ronin.crop((i * W, 0, (i + 1) * W, H)) for i in (0, 2, 8, 15, 23)]
    picks += [
        oni.crop((0, 0, W, H)),
        oni.crop((10 * W, 0, 11 * W, H)),
        archer.crop((0, 0, W, H)),
        archer.crop((9 * W, 0, 10 * W, H)),
        shield.crop((0, 0, W, H)),
        assassin.crop((0, 0, W, H)),
        assassin.crop((9 * W, 0, 10 * W, H)),
    ]
    scale = 3
    pad = 4
    cols = 6
    rows = (len(picks) + cols - 1) // cols
    board = Image.new("RGBA", (cols * (W * scale + pad) + pad, rows * (H * scale + pad) + pad), (18, 14, 28, 255))
    for i, fr in enumerate(picks):
        big = fr.resize((W * scale, H * scale), Image.NEAREST)
        r, c = divmod(i, cols)
        board.paste(big, (pad + c * (W * scale + pad), pad + r * (H * scale + pad)), big)
    board.save(os.path.join(PRE, "cast_x3.png"))
    print("frames", W, H, "origin", AX, AY, "ronin", len(RONIN))


if __name__ == "__main__":
    main()
