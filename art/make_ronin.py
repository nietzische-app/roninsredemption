#!/usr/bin/env python3
"""Hand-authored pixel ronin. Parts are stamped; sword, hakama and legs are drawn."""
import math
import os
from PIL import Image, ImageDraw

OUT = "/tmp/pix"
os.makedirs(OUT, exist_ok=True)

# Castle night palette: moonlight indigo, lantern red, warm skin.
C = {
    "H": (22, 14, 30, 255),
    "M": (42, 30, 58, 255),
    "L": (118, 98, 150, 255),
    "l": (168, 150, 196, 255),
    "S": (250, 216, 188, 255),
    "s": (228, 170, 140, 255),
    "d": (176, 112, 96, 255),
    "n": (132, 70, 68, 255),
    "E": (255, 250, 244, 255),
    "e": (28, 16, 24, 255),
    "w": (255, 255, 255, 255),
    "B": (20, 24, 42, 255),
    "K": (36, 46, 76, 255),
    "k": (64, 82, 124, 255),
    "F": (96, 118, 164, 255),
    "R": (226, 58, 68, 255),
    "r": (168, 28, 44, 255),
    "q": (110, 16, 30, 255),
    "A": (34, 26, 52, 255),
    "a": (52, 40, 78, 255),
    "Z": (78, 64, 112, 255),
    "P": (236, 184, 154, 255),
    "p": (186, 120, 100, 255),
    "G": (244, 206, 112, 255),
    "g": (168, 112, 44, 255),
    "D": (154, 86, 58, 255),
    "x": (78, 40, 32, 255),
    "W": (246, 250, 255, 255),
    "Y": (196, 208, 224, 255),
    "y": (140, 154, 174, 255),
    "C": (120, 228, 242, 255),
    "T": (220, 214, 206, 255),
    "t": (168, 156, 148, 255),
    "f": (132, 78, 54, 255),
    "o": (48, 30, 26, 255),
    "U": (40, 48, 74, 255),
    "u": (62, 74, 108, 255),
    "v": (24, 28, 46, 255),
}

INK = (12, 6, 12, 255)

# Facing right. Spiked mane, brow, pupil, nose, neck.
HEAD = """
.........l.................
........lL.................
.......lLMl.....l..........
......lLMMl....lLl.........
.....lLMMMMl..lLMMl........
....lLMMMMMMllLMMMMl.......
...lLMMMMMMMMMMMMMMl.......
..lLMMMMMMMMMMSSSSMLl......
.lLMMMMMMMMMSSSSssssLl.....
.lLMMMMMMMMSSSdsssssL......
..LMMMMMMSSSSEeWSss........
..LMMMMMSSSSSSnSSs.........
..LMMMMMSSSSSSSSs..........
...LMMMMMMSSSSSsM..........
...lLMMMMMMMMMMMSSM........
....lLMMMMMMMMMMMM.........
......LMMMMMMMMM...........
........sssss..............
.......sssssss.............
.......ssssss..............
""".strip("\n").split("\n")


def parse_width(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, ".") for r in rows], w, len(rows)


HEAD, HEAD_W, HEAD_H = parse_width(HEAD)


class Pix:
    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def put(self, x, y, col):
        x = int(round(x))
        y = int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h and col is not None and col[3]:
            self.px[x, y] = col

    def stamp(self, rows, x, y, skip=""):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == "." or ch in skip:
                    continue
                self.put(x + i, y + j, C[ch])

    def fill_poly(self, pts, col):
        ys = [p[1] for p in pts]
        y0, y1 = int(math.floor(min(ys))), int(math.ceil(max(ys)))
        for y in range(y0, y1 + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                x1, yy1 = pts[i]
                x2, yy2 = pts[(i + 1) % n]
                if (yy1 <= y < yy2) or (yy2 <= y < yy1):
                    if yy2 != yy1:
                        t = (y - yy1) / (yy2 - yy1)
                        xs.append(x1 + (x2 - x1) * t)
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                a, b = int(math.ceil(xs[i])), int(math.floor(xs[i + 1]))
                for x in range(a, b + 1):
                    self.put(x, y, col)

    def line(self, x0, y0, x1, y1, dia, col):
        steps = max(int(max(abs(x1 - x0), abs(y1 - y0)) * 2), 1)
        r2 = (dia / 2) ** 2 + 0.6
        rad = int(dia / 2) + 1
        for i in range(steps + 1):
            t = i / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for yy in range(-rad, rad + 1):
                for xx in range(-rad, rad + 1):
                    if xx * xx + yy * yy <= r2:
                        self.put(cx + xx, cy + yy, col)

    def shaded_line(self, x0, y0, x1, y1, dia, base, hi, lo):
        self.line(x0, y0, x1, y1, dia, base)
        # Highlight the upper-left edge, shadow the lower-right.
        self.line(x0 - 0.6, y0 - 0.8, x1 - 0.6, y1 - 0.8, max(1, dia - 2), hi)
        self.line(x0 + 0.7, y0 + 0.9, x1 + 0.7, y1 + 0.9, max(1, dia - 2), lo)

    def outline(self):
        w, h = self.w, self.h
        add = []
        for y in range(h):
            for x in range(w):
                if self.px[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and self.px[nx, ny][3]:
                            add.append((x, y))
                            break
        for x, y in add:
            self.px[x, y] = INK


def draw_eye(p, cx, hip):
    """2px eye, dark brow, nose. Placed over the head stamp so the face reads at game size."""
    ex, ey = int(round(cx + 1)), int(round(hip - 22))
    for i in range(5):
        p.put(ex + i, ey - 1, C["H"])
    for i in range(4):
        p.put(ex + i, ey, C["E"])
    p.put(ex + 2, ey, C["e"])
    p.put(ex + 3, ey, C["w"])
    p.put(ex + 1, ey + 1, C["s"])
    p.put(ex + 2, ey + 1, C["e"])
    p.put(ex + 3, ey + 1, C["s"])
    p.put(ex + 5, ey, C["S"])
    p.put(ex + 6, ey + 1, C["n"])
    p.put(ex + 5, ey + 1, C["d"])
    p.put(ex + 4, ey + 2, C["d"])


def draw_kimono(p, cx, hip):
    """Torso from the collar down onto the hakama, with the obi at the waist."""
    top = hip - 20
    p.fill_poly([
        (cx - 9, top + 2),
        (cx - 6, top),
        (cx + 7, top),
        (cx + 10, top + 3),
        (cx + 8, hip + 3),
        (cx - 8, hip + 3),
    ], C["K"])
    # Moonlit shoulder and a collar edge.
    p.line(cx - 6, top, cx + 5, top, 1, C["k"])
    p.line(cx - 7, top + 1, cx - 5, top + 1, 1, C["F"])
    p.line(cx + 3, top + 2, cx + 6, hip - 4, 1, C["F"])
    p.line(cx - 2, top + 4, cx - 1, hip - 1, 1, C["B"])
    # Obi, only as wide as the waist. Knot sits on the back.
    for x in range(int(cx) - 7, int(cx) + 8):
        p.put(x, hip, C["R"])
        p.put(x, hip + 1, C["r"])
    p.put(cx - 8, hip, C["R"])
    p.put(cx - 9, hip, C["q"])
    p.put(cx - 8, hip + 1, C["r"])
    p.put(cx - 9, hip + 1, C["q"])


def draw_hakama(p, cx, hip, skew, hem_drop=13):
    # Two panels with a split, wide hem. y grows downward.
    hem = hip + hem_drop
    mid = hip + max(5, hem_drop // 2)
    left = [
        (cx - 13, hip + 1),
        (cx - 1, hip + 1),
        (cx - 2, mid),
        (cx - 5 + skew, hem),
        (cx - 18 + skew, hem),
    ]
    right = [
        (cx + 1, hip + 1),
        (cx + 12, hip + 1),
        (cx + 18 + skew, hem),
        (cx + 4 + skew, hem),
        (cx + 2, mid),
    ]
    p.fill_poly(left, C["A"])
    p.fill_poly(right, C["A"])
    # Pleat lights and a darker inner edge so the split reads.
    for panel, sign in ((left, -1), (right, 1)):
        x0 = (panel[0][0] + panel[1][0]) * 0.5
        x1 = (panel[3][0] + panel[4][0]) * 0.5
        p.line(x0, hip + 2, x1, hem - 1, 1, C["a"])
    # Moonlight on the left hem, shadow on the right hem.
    p.line(left[4][0] + 1, hip + 3, left[4][0] + 2, hem - 1, 1, C["Z"])
    p.line(right[2][0] - 1, hip + 4, right[2][0] - 2, hem - 1, 1, C["B"])
    # Hem stripe.
    p.line(left[4][0], hem, left[3][0], hem, 1, C["Z"])
    p.line(right[3][0], hem, right[2][0], hem, 1, C["Z"])


def draw_foot(p, ankle_x, ankle_y, raised):
    """Sandal + tabi. ankle_y is the top of the foot. Toes point right."""
    ax, ay = int(round(ankle_x)), int(round(ankle_y))
    if raised < 3:
        # Planted: long sole on the ground.
        for i in range(-3, 8):
            p.put(ax + i, ay + 3, C["o"])
            p.put(ax + i, ay + 2, C["f"] if i % 3 else C["o"])
        for i in range(-1, 6):
            p.put(ax + i, ay + 1, C["t"])
            p.put(ax + i, ay, C["T"])
        # Thong between the toes and a strap over the instep.
        p.put(ax + 5, ay, C["f"])
        p.put(ax + 5, ay + 1, C["f"])
        p.put(ax + 1, ay, C["f"])
        p.put(ax + 2, ay - 1, C["U"])
    else:
        # Lifted: toes up, shorter sole, so the stride reads.
        toe = -min(6, raised // 2)
        for i in range(-2, 6):
            yy = ay + 2 + (toe if i > 3 else 0)
            p.put(ax + i, yy, C["o"])
            p.put(ax + i, yy - 1, C["f"])
        for i in range(-1, 5):
            yy = ay + (toe if i > 3 else 0)
            p.put(ax + i, yy, C["T"])
            p.put(ax + i, yy - 1, C["t"])
        p.put(ax + 2, ay - 1, C["f"])


def draw_leg(p, hip, knee, ankle, front):
    base = C["U"] if front else C["v"]
    hi = C["u"] if front else C["U"]
    lo = C["v"] if front else C["B"]
    p.shaded_line(hip[0], hip[1], knee[0], knee[1], 5 if front else 4, base, hi, lo)
    p.shaded_line(knee[0], knee[1], ankle[0], ankle[1], 4 if front else 3, base, hi, lo)
    raised = max(0, int(round(hip[1] + 26 - ankle[1])))  # placeholder, overwritten
    # caller passes raised via ankle marker: we compute from a ground later


def draw_sword(p, hx, hy, ang, length, wind=False):
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy, dx
    # Short wrapped handle. Stops at the rear hand so it cannot hang into the skirt.
    for t in range(1, 5):
        x = hx - dx * t
        y = hy - dy * t
        for o, col in ((-1, C["x"]), (0, C["D"] if t % 2 == 0 else C["x"]), (1, C["D"])):
            p.put(x + px * o, y + py * o, col)
    p.put(hx - dx * 5, hy - dy * 5, C["g"])
    # Guard sits just in front of the hands.
    gx, gy = hx + dx * 2, hy + dy * 2
    for o in range(-3, 4):
        col = C["G"] if abs(o) < 3 else C["g"]
        p.put(gx + px * o, gy + py * o, col)
        if abs(o) < 2:
            p.put(gx + px * o - dx, gy + py * o - dy, C["g"])
    # Tapered blade. The hamon rides the cutting edge.
    for t in range(4, length + 1):
        k = (t - 4) / max(1, length - 4)
        x = hx + dx * t
        y = hy + dy * t
        p.put(x, y, C["W"])
        p.put(x - px, y - py, C["Y"] if k < 0.75 else C["W"])
        if k < 0.55:
            p.put(x - px * 2, y - py * 2, C["y"])
        if 0.08 < k < 0.9 and int(t) % 2 == 0:
            p.put(x + px, y + py, C["C"])
        elif k < 0.7:
            p.put(x + px, y + py, C["W"])
    p.put(hx + dx * (length + 1), hy + dy * (length + 1), C["W"])


def draw_hand(p, x, y, ang):
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy, dx
    for i in range(-1, 2):
        for o in (-1, 0, 1):
            col = C["P"] if o < 1 else C["p"]
            p.put(x - dx * i + px * o, y - dy * i + py * o, col)
    p.put(x, y, C["d"])
    p.put(x - px, y - py, C["s"])


def draw_arm(p, shoulder, hand, bend):
    sx, sy = shoulder
    hx, hy = hand
    mx, my = (sx + hx) / 2, (sy + hy) / 2
    dx, dy = hx - sx, hy - sy
    L = math.hypot(dx, dy) or 1
    # Bend perpendicular so the elbow bows away from the blade.
    ex, ey = mx + (-dy / L) * bend, my + (dx / L) * bend
    p.shaded_line(sx, sy, ex, ey, 5, C["K"], C["k"], C["B"])
    p.shaded_line(ex, ey, hx, hy, 4, C["K"], C["F"], C["B"])


def render_pose(spec, scratch=(180, 150), anchor=(78, 124)):
    p = Pix(*scratch)
    ax, ay = anchor
    cx = ax + spec.get("lean", 0)
    hip = ay + spec.get("hip", -28)
    skew = spec.get("skew", 0)
    feet = spec["feet"]
    knees = spec["knees"]
    # y in the spec is an offset from the ground anchor (0 on the ground, negative up).
    def pt(pair):
        return (cx + pair[0], ay + pair[1])

    order = [0, 1]
    # Draw the rear foot first (smaller x is behind when facing right).
    if feet[1][0] < feet[0][0]:
        order = [1, 0]
    for i in order:
        hip_pt = (cx + (-2 if i == 0 else 2), hip + 2)
        knee = pt(knees[i])
        ankle = pt(feet[i])
        front = i == order[-1]
        base = C["U"] if front else C["v"]
        hi = C["u"] if front else C["U"]
        lo = C["B"]
        p.shaded_line(hip_pt[0], hip_pt[1], knee[0], knee[1], 6, base, hi, lo)
        p.shaded_line(knee[0], knee[1], ankle[0], ankle[1] - 2, 5, base, hi, lo)
        # Legging band so the shin is not a stick under the skirt.
        p.line(ankle[0] - 2, ankle[1] - 6, ankle[0] + 2, ankle[1] - 6, 2, C["u"])
        raised = max(0, int(round(-feet[i][1])))
        draw_foot(p, ankle[0], ankle[1] - 3, raised)

    if not spec.get("no_hakama"):
        draw_hakama(p, cx, hip, skew, spec.get("hem", 12))

    grip = (cx + spec["grip"][0], hip + spec["grip"][1])
    shoulder = (cx + spec.get("shx", 0), hip - 16)
    behind = spec.get("behind", False)
    ang = spec["ang"]

    def sword():
        draw_sword(p, grip[0], grip[1], ang, spec.get("length", 30))

    if behind:
        sword()

    draw_kimono(p, cx, hip)
    # Neck of the head overlaps the collar.
    p.stamp(HEAD, cx - 11, hip - 18 - HEAD_H + 6)
    draw_eye(p, cx, hip)

    if not behind:
        sword()

    dx, dy = math.cos(ang), math.sin(ang)
    # Lead hand sits on the guard; the other hand is behind it on the wrap.
    lead = (grip[0] - dx * 1, grip[1] - dy * 1)
    rear = (grip[0] - dx * 5, grip[1] - dy * 5)
    draw_arm(p, shoulder, lead, spec.get("bend", 4))
    if spec.get("two", True):
        draw_hand(p, rear[0], rear[1], ang)
    draw_hand(p, lead[0], lead[1], ang)
    p.outline()
    return p.im, anchor


def crop_sheet(frames):
    """Uniform frames. Anchor stays on the foot point; origin need not be centered."""
    boxes = []
    for im, (ax, ay) in frames:
        px = im.load()
        xs, ys = [], []
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][3]:
                    xs.append(x - ax)
                    ys.append(y - ay)
        boxes.append((min(xs), max(xs), min(ys), max(ys)))
    minx = min(b[0] for b in boxes) - 1
    maxx = max(b[1] for b in boxes) + 1
    miny = min(b[2] for b in boxes) - 1
    maxy = max(b[3] for b in boxes) + 1
    fw, fh = maxx - minx + 1, maxy - miny + 1
    ox, oy = -minx, -miny
    sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    crops = []
    for i, (im, (ax, ay)) in enumerate(frames):
        crop = im.crop((ax + minx, ay + miny, ax + maxx + 1, ay + maxy + 1))
        sheet.paste(crop, (i * fw, 0))
        crops.append(crop)
    return sheet, crops, fw, fh, ox, oy


# y offsets: 0 is the ground under the sandals. Negative is up.
# Feet tuples are (x, y) from body center / ground.
POSES = {}

def P(**kw):
    base = dict(lean=0, hip=-28, skew=0, grip=(14, -2), ang=-1.05, length=34,
                bend=6, two=True, behind=False, tail=0, shx=2,
                feet=[(-10, -1), (8, -1)],
                knees=[(-8, -14), (6, -14)])
    base.update(kw)
    return base

POSES["idle"] = P(hem=13)
POSES["idle2"] = P(hip=-29, grip=(14, -3), hem=13)

# Run cycle. Big strides; the skirt swings the other way from the lead foot.
POSES["run0"] = P(lean=3, hip=-26, skew=5, grip=(12, 0), ang=-0.55, bend=3, hem=12,
                  feet=[(-18, -2), (16, -1)], knees=[(-12, -15), (9, -12)])
POSES["run1"] = P(lean=4, hip=-25, skew=2, grip=(13, 1), ang=-0.8, bend=4, hem=13,
                  feet=[(-10, -1), (4, -1)], knees=[(-6, -11), (2, -11)])
POSES["run2"] = P(lean=3, hip=-28, skew=-2, grip=(12, -2), ang=-1.0, bend=5, hem=12,
                  feet=[(-2, -14), (8, -1)], knees=[(2, -18), (5, -13)])
POSES["run3"] = P(lean=2, hip=-31, skew=-4, grip=(10, -5), ang=-1.25, bend=6, hem=11,
                  feet=[(-14, -20), (12, -8)], knees=[(-6, -24), (8, -16)])
POSES["run4"] = P(lean=3, hip=-26, skew=-5, grip=(12, 0), ang=-0.5, bend=3, hem=12,
                  feet=[(15, -1), (-18, -2)], knees=[(8, -12), (-12, -15)])
POSES["run5"] = P(lean=4, hip=-27, skew=-1, grip=(13, -1), ang=-0.9, bend=5, hem=12,
                  feet=[(6, -1), (-6, -13)], knees=[(3, -12), (-2, -18)])

POSES["jump"] = P(lean=3, hip=-38, skew=-4, grip=(-2, -2), ang=-2.5, length=30, bend=4,
                  behind=True, hem=10,
                  feet=[(-8, -20), (6, -18)], knees=[(-1, -26), (4, -24)])
POSES["fall"] = P(lean=1, hip=-33, skew=3, grip=(14, -1), ang=-0.25, bend=2, hem=12,
                  feet=[(-6, -14), (12, -10)], knees=[(-2, -22), (7, -18)])
POSES["wall"] = P(lean=-3, hip=-27, skew=0, grip=(6, -10), ang=-1.5, bend=6, hem=12,
                  feet=[(-2, -1), (1, -12)], knees=[(-1, -13), (0, -18)])
POSES["dash"] = P(lean=7, hip=-25, skew=6, grip=(2, -4), ang=-2.5, length=30, bend=3,
                  behind=True, hem=11,
                  feet=[(-16, -2), (16, -5)], knees=[(-8, -13), (8, -14)])
POSES["parry"] = P(lean=-2, hip=-28, grip=(8, -12), ang=-1.57, length=28, bend=2, hem=13,
                   feet=[(-13, -1), (11, -1)], knees=[(-8, -14), (7, -14)])
POSES["death"] = P(lean=10, hip=-14, skew=2, grip=(18, 4), ang=0.7, length=26, bend=1,
                   two=False, hem=8,
                   feet=[(-6, -1), (14, -1)], knees=[(0, -6), (10, -5)])

# Attacks: 0 windup, 1 the readable hit pose.
POSES["jab0"] = P(lean=-2, grip=(4, -6), ang=-2.1, bend=6, behind=True, hem=13)
POSES["jab1"] = P(lean=6, hip=-27, grip=(22, -5), ang=-0.05, length=34, bend=0, two=False, hem=12,
                  feet=[(-14, -1), (14, -1)], knees=[(-8, -14), (9, -13)])
POSES["cross0"] = P(lean=-3, grip=(2, -10), ang=-2.2, bend=6, behind=True, hem=13)
POSES["cross1"] = P(lean=6, hip=-26, skew=4, grip=(16, 2), ang=0.75, length=34, bend=1, hem=12,
                    feet=[(-16, -1), (13, -2)], knees=[(-9, -13), (7, -12)])
POSES["hook0"] = P(lean=-1, grip=(4, -2), ang=-0.9, bend=7, hem=13)
POSES["hook1"] = P(lean=4, skew=-3, grip=(20, -2), ang=0.15, length=32, bend=1, hem=12,
                   feet=[(-14, -1), (15, -1)], knees=[(-7, -14), (9, -12)])
POSES["upper0"] = P(lean=3, grip=(14, 4), ang=0.7, bend=5, hem=12,
                    feet=[(-8, -1), (5, -1)], knees=[(-5, -12), (3, -9)])
POSES["upper1"] = P(lean=-4, hip=-32, grip=(14, -12), ang=-1.52, length=32, bend=1, hem=11,
                    feet=[(-5, -1), (7, -12)], knees=[(-3, -14), (3, -18)])
POSES["heavy0"] = P(lean=-5, hip=-30, grip=(-2, -14), ang=-2.7, length=34, bend=5, behind=True, hem=12)
POSES["heavy1"] = P(lean=7, hip=-24, skew=5, grip=(18, 4), ang=1.05, length=36, bend=0, hem=11,
                    feet=[(-18, -1), (14, -2)], knees=[(-10, -12), (8, -11)])
POSES["runattack"] = P(lean=7, hip=-24, skew=5, grip=(20, 2), ang=-0.05, length=34, bend=0, hem=11,
                       feet=[(-18, -2), (16, -2)], knees=[(-10, -12), (10, -12)])
POSES["airattack"] = P(lean=5, hip=-36, skew=3, grip=(14, -2), ang=0.95, length=32, bend=1, hem=10,
                       feet=[(-5, -16), (11, -12)], knees=[(1, -24), (8, -20)])

ORDER = [
    "idle", "idle2",
    "run0", "run1", "run2", "run3", "run4", "run5",
    "jump", "fall", "wall", "dash", "parry", "death",
    "jab0", "jab1", "cross0", "cross1", "hook0", "hook1",
    "upper0", "upper1", "heavy0", "heavy1", "runattack", "airattack",
]


def scale_nn(im, n):
    return im.resize((im.width * n, im.height * n), Image.NEAREST)


def on_bg(im, n, bg):
    big = scale_nn(im, n)
    canvas = Image.new("RGB", big.size, bg)
    canvas.paste(big, (0, 0), big)
    return canvas


def main():
    frames = []
    for name in ORDER:
        im, anchor = render_pose(POSES[name])
        frames.append((im, anchor))
    sheet, crops, fw, fh, ox, oy = crop_sheet(frames)
    sheet.save(f"{OUT}/sheet.png")
    print(f"frame {fw}x{fh} origin {ox},{oy} count {len(ORDER)}")
    bg = (48, 22, 36)
    # Contact strip groups.
    groups = {
        "idle": ["idle", "idle2"],
        "run": [f"run{i}" for i in range(6)],
        "air": ["jump", "fall", "wall", "dash", "parry", "death"],
        "atk": ["jab0", "jab1", "cross0", "cross1", "hook0", "hook1",
                "upper0", "upper1", "heavy0", "heavy1", "runattack", "airattack"],
    }
    index = {n: i for i, n in enumerate(ORDER)}
    for gname, names in groups.items():
        tiles = [on_bg(crops[index[n]], 4, bg) for n in names]
        tw, th = tiles[0].size
        cols = min(6, len(tiles))
        rows = (len(tiles) + cols - 1) // cols
        plate = Image.new("RGB", (cols * tw, rows * th), (20, 10, 16))
        for i, t in enumerate(tiles):
            plate.paste(t, ((i % cols) * tw, (i // cols) * th))
        plate.save(f"{OUT}/{gname}.png")
    # Large idle for inspection.
    on_bg(crops[0], 6, bg).save(f"{OUT}/idle_big.png")
    on_bg(crops[index["jab1"]], 6, bg).save(f"{OUT}/jab_big.png")
    on_bg(crops[index["heavy1"]], 6, bg).save(f"{OUT}/heavy_big.png")
    on_bg(crops[index["jump"]], 6, bg).save(f"{OUT}/jump_big.png")
    on_bg(crops[index["run0"]], 6, bg).save(f"{OUT}/run0_big.png")
    # meta
    with open(f"{OUT}/meta.txt", "w") as f:
        f.write(f"{fw} {fh} {ox} {oy}\n")
        f.write(" ".join(ORDER) + "\n")


if __name__ == "__main__":
    main()
