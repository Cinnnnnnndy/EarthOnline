#!/usr/bin/env python3
"""城市尺度的示意图：京都一日（车站 → 伏见稻荷 → 清水寺 → 祇园 → 金阁寺）
一格 ≈ 250 m，44 × 30 格覆盖京都核心区。地标按旅游手绘地图的做法放大，
普通街区只画肌理（零星小房子），山、河、主干道、铁路、地铁线是骨架。
A. 3/4 俯视（RPG 大地图式）   B. 2:1 二等角积木（微缩模型式）
运行：python3 render_city_scale.py → 输出 城市尺度_京都一日.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "城市尺度_京都一日.png")
SCALE = 2
COLS, ROWS = 44, 30

# ---------------- 色板 ----------------
C = dict(
    urban=(232, 222, 200), urban2=(214, 202, 178),
    farm=(184, 204, 132), farm2=(164, 186, 116),
    forest=(104, 156, 84), forest2=(84, 132, 70),
    mtn=(90, 128, 78), mtn2=(120, 122, 104), mtn3=(236, 236, 228),
    water=(96, 158, 206), water2=(150, 202, 236),
    road=(248, 244, 232), road2=(200, 190, 170),
    rail=(70, 66, 70), rail2=(150, 140, 130),
    subway=(232, 132, 40),
    plank=(176, 134, 92),
    ink=(46, 38, 40), path=(255, 214, 40),
    house=(238, 226, 206), houseroof=(178, 108, 84),
    canopy=(66, 138, 72), canopy2=(98, 176, 96), trunk=(110, 74, 44),
    wood=(150, 96, 62), wood2=(110, 70, 46), dark=(62, 62, 74), white=(244, 240, 232),
    red=(210, 62, 50), gold=(238, 196, 84), gray=(176, 184, 194), bamboo=(120, 176, 92),
    sand=(236, 230, 210),
)
FLAG = dict(station=(86, 140, 220), inari=(210, 62, 50), kiyomizu=(210, 62, 50),
            gion=(240, 200, 70), kinkaku=(240, 200, 70))

# ---------------- 地面 ----------------
grid = [["U"] * COLS for _ in range(ROWS)]
for y in range(ROWS):
    for x in range(COLS):
        if x >= 40 or y <= 1 or x <= 2:
            grid[y][x] = "M"
        elif x == 39 or y == 2 or x == 3:
            grid[y][x] = "F"
        elif y >= 27 and x < 16:
            grid[y][x] = "G"
# 东山：清水寺、稻荷所在的山脚林地
for (x, y) in [(35, 19), (36, 19), (37, 19), (35, 20), (37, 20), (35, 21), (36, 21), (37, 21), (38, 20), (38, 21), (38, 19),
               (36, 22), (37, 22), (38, 22), (36, 23), (37, 23), (38, 23), (36, 24), (37, 24), (38, 24), (35, 22), (35, 23), (34, 27), (35, 27), (36, 27), (34, 28), (36, 28), (34, 29), (35, 29), (36, 29),
               (37, 27), (37, 28), (37, 29), (38, 27), (38, 28), (38, 29), (37, 8), (38, 8), (37, 9), (38, 9), (38, 7), (37, 7)]:
    grid[y][x] = "F"
# 岚山竹林
for y in range(13, 18):
    for x in range(3, 6):
        grid[y][x] = "Z"
# 御所
for y in range(9, 14):
    for x in range(23, 29):
        grid[y][x] = "P"


def kamo_x(y):   # 鸭川：北段略向东偏
    return 31 if y >= 8 else 31 + (8 - y) // 3


def kat_x(y):    # 桂川：从岚山斜向东南
    return 6 + (y - 12) * 6 // 17


for y in range(ROWS):
    grid[y][kamo_x(y)] = "W"
    if y >= 12:
        grid[y][kat_x(y)] = "W"
# 金阁寺池、二条城护城河
for (x, y) in [(8, 6), (9, 6), (10, 6), (8, 7), (9, 7), (10, 7)]:
    grid[y][x] = "W"
for y in range(13, 18):
    for x in range(15, 20):
        if y in (13, 17) or x in (15, 19):
            grid[y][x] = "W"
grid[6][38] = "S"  # 银阁寺沙庭
grid[6][12] = "P"

# 骨架：主干道、铁路、地铁（叠在地面上的线）
HROADS = {(x, y) for y in (8, 14, 20, 26) for x in range(4, 39)}
VROADS = {(x, y) for x in (14, 20, 26, 34) for y in range(3, 29)}
VROADS |= {(10, y) for y in range(5, 15)}          # 通往金阁寺的西大路
HRAILS = {(x, 28) for x in range(12, 34)}          # JR 奈良线 / 东海道
VRAILS = {(33, y) for y in range(26, 29)}
SUBWAY = {(20, y) for y in range(4, 28)}           # 乌丸线（虚线）
BRIDGES = {(kamo_x(y), y) for y in (8, 14, 20, 26)} | {(kat_x(14), 14), (kat_x(26), 26), (kamo_x(28), 28)}

# 地标（锚点格 = 左上角）
LANDMARKS = [
    ("station", 18, 24, "京都站"),
    ("inari", 34, 25, "伏见稻荷"),
    ("kiyomizu", 37, 22, "清水寺"),
    ("gion", 32, 16, "祇园"),
    ("nijo", 16, 14, "二条城"),
    ("kinkaku", 9, 5, "金阁寺"),
    ("ginkaku", 37, 6, "银阁寺"),
    ("palace", 25, 10, "御所"),
    ("arashi", 4, 15, "岚山"),
]
SITES = ("station", "inari", "kiyomizu", "gion", "kinkaku")   # 今天要去的站点（有旗）

# 小人路径：车站 →(JR)→ 稻荷 →(JR)→ 四条 → 清水寺 → 祇园 →(巴士)→ 金阁寺
PATH = ([(x, 26) for x in range(21, 27)] + [(26, 27), (26, 28)] + [(x, 28) for x in range(27, 34)] +
        [(33, 27), (33, 26)] +                                        # 稻荷
        [(x, 28) for x in range(32, 25, -1)] + [(26, y) for y in range(27, 19, -1)] +
        [(x, 20) for x in range(27, 36)] + [(35, 21), (36, 21)] +     # 清水寺脚下
        [(35, 20), (34, 20), (34, 19), (34, 18), (34, 17)] +          # 祇园
        [(34, y) for y in range(16, 13, -1)] + [(x, 14) for x in range(33, 13, -1)] +
        [(14, y) for y in range(13, 7, -1)] + [(x, 8) for x in range(13, 10, -1)] + [(11, 7)])
HERO = (30, 20)  # 四条大桥上
DRAW_HERO = True  # 动画脚本会关掉它，自己画会动的小人

# 二等角投影参数（模块级，供 pixel_hero.py 复用）
TW, TH, LZ, MB = 32, 16, 10, 16
OXB = (ROWS - 1) * (TW // 2) + MB
OYB = MB + 6 * LZ


def P_B(u, v, z=0.0):
    """地图坐标 (u, v, z) → 二等角画布上的像素坐标（1×）"""
    return (OXB + (u - v) * (TW // 2), OYB + (u + v) * (TH // 2) - z * LZ)


def shade(c, d):
    return tuple(max(0, min(255, v + d)) for v in c)


SPRITE = ["..hhhh..", ".hhhhhh.", ".hffffh.", ".hfeefh.", "..ffff..", ".ssssss.",
          "fssssssf", "fssssssf", "..ssss..", "..pppp..", "..p..p..", ".bb..bb."]
SPC = dict(h=(60, 40, 30), f=(250, 210, 170), e=(40, 30, 30), s=(64, 122, 204), p=(44, 54, 84), b=(50, 40, 40))


def draw_sprite(dr, x, y):
    for j, row in enumerate(SPRITE):
        for i, ch in enumerate(row):
            if ch != ".":
                dr.point((x + i, y + j), SPC[ch])


FONT = "/usr/share/fonts/opentype/unifont/unifont.otf"


def label(dr, x, y, text, size=16, col=(46, 38, 40)):
    f = ImageFont.truetype(FONT, size)
    dr.text((x, y), text, col, font=f, stroke_width=1, stroke_fill=(250, 246, 236))


# =====================================================================
# B. 二等角积木（微缩模型式）
# =====================================================================
def render_dimetric():
    M = MB
    W = (COLS + ROWS) * (TW // 2) + M * 2
    H = (COLS + ROWS) * (TH // 2) + OYB + M + 8
    im = Image.new("RGB", (W, H), (240, 234, 216))
    dr = ImageDraw.Draw(im)
    P = P_B

    def quad(x0, y0, x1, y1, z, col):
        dr.polygon([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], col)

    def box(x0, y0, x1, y1, z0, z1, base, top=None):
        dr.polygon([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], base)             # 朝 +y
        dr.polygon([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], shade(base, -38))  # 朝 +x
        dr.polygon([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top if top else shade(base, 28))

    # ---- 第一遍：地面与平面骨架 ----
    for s in range(COLS + ROWS - 1):
        for x in range(COLS):
            y = s - x
            if not (0 <= y < ROWS):
                continue
            t = grid[y][x]
            col = dict(U=C["urban"], G=C["farm"], F=C["forest"], Z=C["forest"], M=C["mtn"], W=C["water"],
                       P=C["farm"], S=C["sand"])[t]
            quad(x, y, x + 1, y + 1, 0, col)
            cx, cy = P(x + 0.5, y + 0.5)
            if t == "U":
                dr.point((cx + 5, cy - 2), C["urban2"]); dr.point((cx - 7, cy + 2), C["urban2"])
            elif t == "G":
                dr.line((cx - 8, cy, cx + 8, cy), C["farm2"])
            elif t == "W":
                off = (x * 3 + y * 5) % 6
                dr.line((cx - 8 + off, cy - 2, cx - 4 + off, cy - 2), C["water2"])
    # 主干道、铁路、地铁、桥、路径（平面）
    for (x, y) in HROADS:
        if grid[y][x] != "W":
            quad(x, y + 0.3, x + 1, y + 0.7, 0, C["road"])
    for (x, y) in VROADS:
        if grid[y][x] != "W":
            quad(x + 0.3, y, x + 0.7, y + 1, 0, C["road"])
    for (x, y) in BRIDGES:
        quad(x, y + 0.25, x + 1, y + 0.75, 0, C["plank"]) if (x, y) in HROADS or (x, y) in HRAILS else quad(x + 0.25, y, x + 0.75, y + 1, 0, C["plank"])
    for (x, y) in HRAILS:
        quad(x, y + 0.42, x + 1, y + 0.58, 0, C["rail"])
        for k in (0.2, 0.5, 0.8):
            quad(x + k - 0.04, y + 0.36, x + k + 0.04, y + 0.64, 0, C["rail2"])
    for (x, y) in VRAILS:
        quad(x + 0.42, y, x + 0.58, y + 1, 0, C["rail"])
    for (x, y) in SUBWAY:
        if y % 2 == 0:
            quad(x + 0.46, y + 0.1, x + 0.54, y + 0.6, 0, C["subway"])
    for (x, y) in PATH:
        cx, cy = P(x + 0.5, y + 0.5)
        dr.rectangle((cx - 2, cy - 1, cx + 1, cy + 1), C["ink"])
        dr.rectangle((cx - 1, cy - 1, cx + 1, cy), C["path"])

    # ---- 第二遍：立体物件（按前沿角 x1+y1 排序，画家算法） ----
    objs = []  # (sortkey, [boxes...]) ；box = (x0,y0,x1,y1,z0,z1,base,top)

    def add(boxes, key=None):
        if key is None:
            key = max(b[2] + b[3] for b in boxes)
        objs.append((key, boxes))

    for y in range(ROWS):
        for x in range(COLS):
            t = grid[y][x]
            if t == "M":
                h = 1 + (x * 3 + y * 5) % 3
                bs = [(x, y, x + 1, y + 1, 0, 0.8, C["mtn"], shade(C["mtn"], 18))]
                if h >= 2:
                    bs.append((x + .2, y + .2, x + .8, y + .8, 0.8, 1.6, C["mtn"], shade(C["mtn"], 30)))
                if h >= 3:
                    bs.append((x + .38, y + .38, x + .62, y + .62, 1.6, 2.3, C["mtn2"], C["mtn3"] if (x + y) % 4 == 0 else shade(C["mtn2"], 30)))
                add(bs)
            elif t == "F" and (x * 5 + y * 3) % 2 == 0:
                add([(x + .42, y + .42, x + .58, y + .58, 0, .5, C["trunk"], None),
                     (x + .2, y + .2, x + .8, y + .8, .5, 1.2, C["canopy"], C["canopy2"]),
                     (x + .35, y + .35, x + .65, y + .65, 1.2, 1.6, C["canopy"], C["canopy2"])])
            elif t == "Z":
                bs = []
                for (u, v, hh) in ((.2, .3, 2.4), (.6, .15, 2.8), (.45, .7, 2.2), (.8, .6, 2.6)):
                    bs.append((x + u, y + v, x + u + .08, y + v + .08, 0, hh, C["bamboo"], shade(C["bamboo"], 40)))
                add(bs)
            elif t == "U" and (x * 7 + y * 13) % 5 == 0 and (x, y) not in HROADS and (x, y) not in VROADS:
                add([(x + .3, y + .3, x + .7, y + .7, 0, .45, C["house"], C["houseroof"])])
            elif t == "P" and (x * 7 + y * 13) % 4 == 0:
                add([(x + .4, y + .4, x + .6, y + .6, 0, .4, C["trunk"], None),
                     (x + .25, y + .25, x + .75, y + .75, .4, 1.0, C["canopy"], C["canopy2"])])

    for (kind, ax, ay, name) in LANDMARKS:
        b = []
        if kind == "station":
            b += [(ax, ay, ax + 5, ay + 2, 0, 1.5, C["gray"], None), (ax - .15, ay - .15, ax + 5.15, ay + 2.15, 1.5, 1.8, C["dark"], None),
                  (ax + 5.4, ay + .6, ax + 5.8, ay + 1.0, 0, 5.2, C["white"], None), (ax + 5.3, ay + .5, ax + 5.9, ay + 1.1, 5.2, 5.5, C["red"], None)]
        elif kind == "inari":
            for i in range(3):
                x = ax + i * 1.2
                b += [(x + .1, ay + .05, x + .35, ay + .3, 0, 2.2, C["red"], None), (x + .1, ay + 1.0, x + .35, ay + 1.25, 0, 2.2, C["red"], None),
                      (x - .05, ay - .1, x + .5, ay + 1.4, 2.2, 2.5, shade(C["red"], -40), C["red"])]
        elif kind == "kiyomizu":
            k = 1.7   # 放大倍率
            def K(v): return ax + v * k
            def Y(v): return ay + v * k
            b += [(K(0), Y(0), K(1), Y(1), 0, 1.2, C["wood"], None), (K(-.25), Y(-.25), K(1.25), Y(1.25), 1.2, 1.5, C["dark"], None),
                  (K(.15), Y(.15), K(.85), Y(.85), 1.5, 2.6, C["wood"], None), (K(-.1), Y(-.1), K(1.1), Y(1.1), 2.6, 2.9, C["dark"], None),
                  (K(.3), Y(.3), K(.7), Y(.7), 2.9, 3.8, C["wood"], None), (K(.05), Y(.05), K(.95), Y(.95), 3.8, 4.1, C["dark"], None),
                  (K(.45), Y(.45), K(.55), Y(.55), 4.1, 5.2, C["gold"], None),
                  (K(-1.1), Y(.1), K(0), Y(.9), 1.0, 1.25, C["wood2"], C["wood"])]   # 清水舞台
        elif kind == "gion":
            for i in range(3):
                x = ax + i * .66
                b += [(x + .03, ay, x + .63, ay + 1.3, 0, 1.1, C["wood2"], None), (x - .02, ay - .1, x + .68, ay + 1.4, 1.1, 1.4, C["dark"], None),
                      (x + .25, ay + 1.3, x + .41, ay + 1.45, .4, .75, C["red"], None)]
        elif kind == "nijo":
            w = .18
            b += [(ax, ay, ax + 3, ay + w, 0, .6, C["white"], C["dark"]), (ax, ay + 3 - w, ax + 3, ay + 3, 0, .6, C["white"], C["dark"]),
                  (ax, ay, ax + w, ay + 3, 0, .6, C["white"], C["dark"]), (ax + 3 - w, ay, ax + 3, ay + 3, 0, .6, C["white"], C["dark"]),
                  (ax + 1, ay + 1, ax + 2, ay + 2, 0, 1.4, C["white"], None), (ax + .8, ay + .8, ax + 2.2, ay + 2.2, 1.4, 1.7, C["dark"], None),
                  (ax + 1.25, ay + 1.25, ax + 1.75, ay + 1.75, 1.7, 2.6, C["white"], None), (ax + 1.1, ay + 1.1, ax + 1.9, ay + 1.9, 2.6, 2.85, C["dark"], None),
                  (ax + 1.45, ay + 1.45, ax + 1.55, ay + 1.55, 2.85, 3.2, C["gold"], None)]
        elif kind == "kinkaku":
            k = 1.7
            def K(v): return ax + v * k
            def Y(v): return ay + v * k
            b += [(K(0), Y(0), K(1.2), Y(1), 0, 1.1, C["white"], None), (K(-.2), Y(-.2), K(1.4), Y(1.2), 1.1, 1.35, C["dark"], None),
                  (K(.15), Y(.1), K(1.05), Y(.9), 1.35, 2.4, C["gold"], None), (K(0), Y(-.05), K(1.2), Y(1.05), 2.4, 2.65, C["dark"], None),
                  (K(.3), Y(.25), K(.9), Y(.75), 2.65, 3.6, C["gold"], None), (K(.15), Y(.1), K(1.05), Y(.9), 3.6, 3.85, C["dark"], None),
                  (K(.55), Y(.45), K(.65), Y(.55), 3.85, 4.5, C["gold"], None)]
        elif kind == "ginkaku":
            b += [(ax, ay, ax + 1.5, ay + 1.2, 0, 1.0, C["wood2"], None), (ax - .2, ay - .2, ax + 1.7, ay + 1.4, 1.0, 1.25, C["dark"], None),
                  (ax + .3, ay + .25, ax + 1.2, ay + .95, 1.25, 2.2, C["wood2"], None), (ax + .1, ay + .05, ax + 1.4, ay + 1.15, 2.2, 2.45, C["dark"], None)]
        elif kind == "palace":
            b += [(ax, ay, ax + 3, ay + 1.4, 0, .9, C["white"], None), (ax - .15, ay - .15, ax + 3.15, ay + 1.55, .9, 1.15, C["dark"], None)]
        elif kind == "arashi":
            continue
        add(b)
    # 小人当作一个物件
    if DRAW_HERO:
        add([], key=HERO[0] + HERO[1] + 1.99)

    objs.sort(key=lambda o: o[0])
    for key, boxes in objs:
        if not boxes:
            cx, cy = P(HERO[0] + .5, HERO[1] + .5)
            draw_sprite(dr, cx - 4, cy - 10)
            continue
        for (x0, y0, x1, y1, z0, z1, base, top) in sorted(boxes, key=lambda b: (b[2] + b[3], b[4])):
            box(x0, y0, x1, y1, z0, z1, base, top)

    # 旗与标签（最后画）
    for (kind, ax, ay, name) in LANDMARKS:
        top_z = dict(station=1.8, inari=2.5, kiyomizu=5.2, gion=1.4, nijo=3.2, kinkaku=4.5, ginkaku=2.45, palace=1.15, arashi=2.8)[kind]
        cx, cy = P(ax + .5, ay + .5, top_z)
        if kind in SITES:
            dr.line((cx, cy - 12, cx, cy - 1), C["ink"])
            dr.polygon([(cx + 1, cy - 12), (cx + 8, cy - 10), (cx + 1, cy - 8)], FLAG[kind])
        label(dr, cx + 10, cy - 20, name)
    label(dr, *P(31.5, 3.5), "鸭川", col=(60, 100, 150))
    label(dr, *P(41, 15), "东山", col=(70, 90, 70))
    lx, ly = P(2, 28)
    label(dr, lx, ly + 12, "1 格 ≈ 250 m", col=(110, 100, 96))
    return im


# =====================================================================
# A. 3/4 俯视（RPG 大地图式）
# =====================================================================
def render_topdown():
    CELL, M = 16, 12
    W, H = COLS * CELL + M * 2, ROWS * CELL + M * 2 + 8
    im = Image.new("RGB", (W, H), (240, 234, 216))
    dr = ImageDraw.Draw(im)
    ox, oy = M, M + 8

    def cxy(x, y):
        return ox + x * CELL, oy + y * CELL

    for y in range(ROWS):
        for x in range(COLS):
            t = grid[y][x]
            cx, cy = cxy(x, y)
            col = dict(U=C["urban"], G=C["farm"], F=C["forest"], Z=C["forest"], M=C["mtn"], W=C["water"], P=C["farm"], S=C["sand"])[t]
            dr.rectangle((cx, cy, cx + 15, cy + 15), col)
            if t == "U":
                dr.point((cx + 4, cy + 6), C["urban2"]); dr.point((cx + 11, cy + 12), C["urban2"])
            elif t == "G":
                dr.line((cx + 2, cy + 8, cx + 13, cy + 8), C["farm2"])
            elif t == "W":
                off = (y * 5 + x * 3) % 8
                dr.line((cx + off, cy + 5, cx + off + 3, cy + 5), C["water2"])
                dr.line((cx + (off + 5) % 12, cy + 12, cx + (off + 5) % 12 + 3, cy + 12), C["water2"])
    for (x, y) in HROADS:
        if grid[y][x] != "W":
            cx, cy = cxy(x, y); dr.rectangle((cx, cy + 5, cx + 15, cy + 10), C["road"])
    for (x, y) in VROADS:
        if grid[y][x] != "W":
            cx, cy = cxy(x, y); dr.rectangle((cx + 5, cy, cx + 10, cy + 15), C["road"])
    for (x, y) in BRIDGES:
        cx, cy = cxy(x, y)
        if (x, y) in HROADS or (x, y) in HRAILS:
            dr.rectangle((cx, cy + 4, cx + 15, cy + 11), C["plank"])
        else:
            dr.rectangle((cx + 4, cy, cx + 11, cy + 15), C["plank"])
    for (x, y) in HRAILS:
        cx, cy = cxy(x, y); dr.rectangle((cx, cy + 7, cx + 15, cy + 8), C["rail"])
        for k in (2, 7, 12):
            dr.rectangle((cx + k, cy + 5, cx + k + 1, cy + 10), C["rail2"])
    for (x, y) in VRAILS:
        cx, cy = cxy(x, y); dr.rectangle((cx + 7, cy, cx + 8, cy + 15), C["rail"])
    for (x, y) in SUBWAY:
        if y % 2 == 0:
            cx, cy = cxy(x, y); dr.rectangle((cx + 7, cy + 2, cx + 8, cy + 9), C["subway"])
    for (x, y) in PATH:
        cx, cy = cxy(x, y); dr.rectangle((cx + 6, cy + 6, cx + 9, cy + 9), C["ink"]); dr.rectangle((cx + 7, cy + 7, cx + 8, cy + 8), C["path"])

    # 物件按 y 排序
    items = []
    for y in range(ROWS):
        for x in range(COLS):
            t = grid[y][x]
            if t in "MFZUP":
                items.append((y, t, x))
    for (kind, ax, ay, name) in LANDMARKS:
        items.append((ay + 2, "L", (kind, ax, ay)))
    items.append((HERO[1] + 0.5, "H", HERO))
    items.sort(key=lambda i: i[0])
    for (_, t, obj) in items:
        if t == "M":
            x = obj; cx, cy = cxy(x, _)
            h = 2 + (x * 3 + _ * 5) % 3
            dr.polygon([(cx + 8, cy - 2 * h), (cx + 15, cy + 14), (cx + 1, cy + 14)], C["mtn2"] if h >= 3 else C["mtn"], outline=shade(C["mtn"], -40))
            if h >= 4:
                dr.polygon([(cx + 8, cy - 8), (cx + 10, cy - 3), (cx + 6, cy - 3)], C["mtn3"])
        elif t == "F":
            x = obj
            if (x * 5 + _ * 3) % 2 == 0:
                cx, cy = cxy(x, _)
                dr.rectangle((cx + 7, cy + 10, cx + 8, cy + 14), C["trunk"])
                dr.ellipse((cx + 3, cy + 1, cx + 12, cy + 10), C["canopy"], outline=shade(C["canopy"], -40))
        elif t == "Z":
            x = obj; cx, cy = cxy(x, _)
            for k in (2, 6, 10, 13):
                dr.line((cx + k, cy + 2, cx + k, cy + 14), C["bamboo"])
        elif t == "U":
            x = obj
            if (x * 7 + _ * 13) % 5 == 0 and (x, _) not in HROADS and (x, _) not in VROADS:
                cx, cy = cxy(x, _)
                dr.rectangle((cx + 5, cy + 6, cx + 10, cy + 11), C["house"])
                dr.rectangle((cx + 4, cy + 4, cx + 11, cy + 6), C["houseroof"])
        elif t == "P":
            x = obj
            if (x * 7 + _ * 13) % 4 == 0:
                cx, cy = cxy(x, _)
                dr.ellipse((cx + 4, cy + 3, cx + 11, cy + 10), C["canopy"]); dr.rectangle((cx + 7, cy + 10, cx + 8, cy + 13), C["trunk"])
        elif t == "H":
            cx, cy = cxy(*obj); draw_sprite(dr, cx + 4, cy + 2)
        elif t == "L":
            kind, ax, ay = obj
            cx, cy = cxy(ax, ay)
            if kind == "station":
                dr.rectangle((cx, cy - 6, cx + 79, cy + 31), C["gray"], outline=C["ink"])
                dr.rectangle((cx, cy - 6, cx + 79, cy + 6), C["dark"])
                dr.rectangle((cx + 86, cy - 40, cx + 92, cy + 31), C["white"], outline=C["ink"]); dr.rectangle((cx + 84, cy - 44, cx + 94, cy - 40), C["red"])
            elif kind == "inari":
                for i in range(3):
                    x0 = cx + i * 16
                    dr.rectangle((x0 + 2, cy - 4, x0 + 13, cy - 2), C["red"]); dr.rectangle((x0 + 1, cy - 8, x0 + 14, cy - 6), shade(C["red"], -40))
                    dr.rectangle((x0 + 3, cy - 6, x0 + 4, cy + 12), C["red"]); dr.rectangle((x0 + 11, cy - 6, x0 + 12, cy + 12), C["red"])
            elif kind == "kiyomizu":
                for (w, top, hh, colr) in ((20, -42, 7, C["dark"]), (14, -35, 10, C["wood"]), (26, -25, 5, C["dark"]), (20, -20, 12, C["wood"]), (32, -8, 5, C["dark"]), (26, -3, 18, C["wood"])):
                    dr.rectangle((cx + 12 - w // 2, cy + top, cx + 12 + w // 2, cy + top + hh), colr, outline=C["ink"])
                dr.rectangle((cx + 11, cy - 52, cx + 13, cy - 42), C["gold"])
                dr.rectangle((cx - 22, cy + 3, cx - 2, cy + 14), C["wood2"], outline=C["ink"])
            elif kind == "gion":
                for i in range(3):
                    x0 = cx + i * 11
                    dr.rectangle((x0 + 1, cy - 4, x0 + 9, cy + 12), C["wood2"], outline=C["ink"]); dr.rectangle((x0, cy - 8, x0 + 10, cy - 4), C["dark"])
                    dr.rectangle((x0 + 4, cy + 2, x0 + 6, cy + 5), C["red"])
            elif kind == "nijo":
                dr.rectangle((cx + 1, cy + 1, cx + 46, cy + 46), C["white"], outline=C["dark"], width=3)
                dr.rectangle((cx + 16, cy + 6, cx + 31, cy + 30), C["white"], outline=C["ink"])
                dr.rectangle((cx + 13, cy + 4, cx + 34, cy + 8), C["dark"]); dr.rectangle((cx + 15, cy + 12, cx + 32, cy + 15), C["dark"])
            elif kind == "kinkaku":
                dr.rectangle((cx + 2, cy + 6, cx + 25, cy + 20), C["white"], outline=C["ink"])
                dr.rectangle((cx + 4, cy - 16, cx + 23, cy + 6), C["gold"], outline=C["ink"])
                dr.rectangle((cx, cy - 19, cx + 27, cy - 15), C["dark"]); dr.rectangle((cx + 1, cy - 6, cx + 26, cy - 2), C["dark"]); dr.rectangle((cx, cy + 3, cx + 27, cy + 6), C["dark"])
            elif kind == "ginkaku":
                dr.rectangle((cx + 2, cy - 6, cx + 14, cy + 12), C["wood2"], outline=C["ink"]); dr.rectangle((cx, cy - 9, cx + 16, cy - 6), C["dark"]); dr.rectangle((cx + 1, cy + 1, cx + 15, cy + 3), C["dark"])
            elif kind == "palace":
                dr.rectangle((cx, cy + 2, cx + 39, cy + 14), C["white"], outline=C["ink"]); dr.rectangle((cx - 1, cy - 2, cx + 40, cy + 3), C["dark"])
    for (kind, ax, ay, name) in LANDMARKS:
        cx, cy = cxy(ax, ay)
        if kind in SITES:
            px = cx + 8
            dr.line((px, cy - 46, px, cy - 36), C["ink"]); dr.polygon([(px + 1, cy - 46), (px + 8, cy - 44), (px + 1, cy - 42)], FLAG[kind])
        label(dr, cx + 18, cy - 50 if kind in SITES else cy - 22, name)
    label(dr, *cxy(31, 3), "鸭川", col=(60, 100, 150))
    label(dr, *cxy(40, 14), "东山", col=(70, 90, 70))
    label(dr, *cxy(1, 28), "1 格 ≈ 250 m", col=(110, 100, 96))
    return im


def compose():
    a = render_topdown(); b = render_dimetric()
    a = a.resize((a.width * SCALE, a.height * SCALE), Image.NEAREST)
    b = b.resize((b.width * SCALE, b.height * SCALE), Image.NEAREST)
    f_title = ImageFont.truetype(FONT, 48); f_label = ImageFont.truetype(FONT, 32); f_note = ImageFont.truetype(FONT, 32)
    gap, pad, top = 48, 36, 150
    W = pad + a.width + gap + b.width + pad
    H = top + max(a.height, b.height) + 150
    im = Image.new("RGB", (W, H), (246, 240, 226)); dr = ImageDraw.Draw(im); ink = (52, 44, 46)
    dr.text((pad, 24), "城市尺度 · 京都一日（示意）", ink, font=f_title)
    dr.text((pad, 84), "44 × 30 格，1 格 ≈ 250 m。车站 →(JR)→ 伏见稻荷 → 清水寺 → 祇园 →(巴士)→ 金阁寺；黄点为路径，旗为今日站点。地标按手绘旅游地图的做法放大，街区只画肌理。", (110, 100, 96), font=f_note)
    ya = top + (max(a.height, b.height) - a.height) // 2; yb = top + (max(a.height, b.height) - b.height) // 2
    xa, xb = pad, pad + a.width + gap
    for (x, y, img) in ((xa, ya, a), (xb, yb, b)):
        dr.rectangle((x - 6, y - 6, x + img.width + 5, y + img.height + 5), outline=ink, width=3); im.paste(img, (x, y))
    yl = top + max(a.height, b.height) + 24
    dr.text((xa, yl), "A · 3/4 俯视（RPG 大地图式）", ink, font=f_label)
    dr.text((xa, yl + 40), "山用三角、地标用图标、街区用小房子肌理：像塞尔达 / 宝可梦的城镇地图", (110, 100, 96), font=f_note)
    dr.text((xb, yl), "B · 2:1 二等角积木（微缩模型式，俯仰 26.6°）", ink, font=f_label)
    dr.text((xb, yl + 40), "山是积木堆、地标有高度、街区是零星小砖：像摆在桌上的整座京都", (110, 100, 96), font=f_note)
    im.save(OUT); print("saved", OUT, im.size)


if __name__ == "__main__":
    compose()
