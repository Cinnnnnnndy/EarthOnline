#!/usr/bin/env python3
"""七天行程 · 关西七日：一本书的总览。
数据驱动的城市尺度渲染器（二等角积木），四座城（大阪 / 京都 / 奈良 / 神户）各一块底板，
七天各一页，加封面拼成一张「翻开的书」。同时把行程数据按 spec 写成 JSON。
运行：python3 render_trip_book.py → 关西七日_一本书.png 与 ../示例数据/关西七日.json
"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixel_hero import sprite, up

FONT = "/usr/share/fonts/opentype/unifont/unifont.otf"
COLS, ROWS = 36, 24
TW, TH, LZ, M = 32, 16, 10, 16
OX = (ROWS - 1) * (TW // 2) + M
OY = M + 6 * LZ
PW = (COLS + ROWS) * (TW // 2) + M * 2          # 底板画布宽 992
PH = (COLS + ROWS) * (TH // 2) + OY + M + 8     # 底板画布高

C = dict(
    urban=(232, 222, 200), urban2=(214, 202, 178), farm=(184, 204, 132), farm2=(164, 186, 116), hill=(150, 196, 110),
    forest=(104, 156, 84), mtn=(90, 128, 78), mtn2=(120, 122, 104), mtn3=(236, 236, 228),
    water=(96, 158, 206), water2=(150, 202, 236), sea=(74, 132, 186), sea2=(120, 176, 220),
    road=(248, 244, 232), rail=(70, 66, 70), rail2=(150, 140, 130), subway=(232, 132, 40), plank=(176, 134, 92),
    ink=(46, 38, 40), path=(255, 214, 40), house=(238, 226, 206), houseroof=(178, 108, 84),
    canopy=(66, 138, 72), canopy2=(98, 176, 96), trunk=(110, 74, 44), wood=(150, 96, 62), wood2=(110, 70, 46),
    dark=(62, 62, 74), white=(244, 240, 232), red=(210, 62, 50), gold=(238, 196, 84), gray=(176, 184, 194),
    bamboo=(120, 176, 92), sand=(236, 230, 210), stone=(150, 150, 140), green=(70, 120, 90), blue=(70, 120, 190),
    glass=(170, 210, 230), deer=(190, 140, 90), hotel=(90, 120, 170),
)
FLAG = dict(place=(210, 62, 50), lodging=(86, 140, 220), airport=(90, 90, 100))


def shade(c, d):
    return tuple(max(0, min(255, v + d)) for v in c)


def P(u, v, z=0.0):
    return (OX + (u - v) * (TW // 2), OY + (u + v) * (TH // 2) - z * LZ)


def text(dr, x, y, s, size=16, col=(46, 38, 40), stroke=True):
    f = ImageFont.truetype(FONT, size)
    if stroke:
        dr.text((x, y), s, col, font=f, stroke_width=1, stroke_fill=(250, 246, 236))
    else:
        dr.text((x, y), s, col, font=f)


# ---------------- 场景构造工具 ----------------
def blank(fill="U"):
    return [[fill] * COLS for _ in range(ROWS)]


def rect(g, cls, x0, y0, x1, y1):
    for y in range(max(0, y0), min(ROWS, y1 + 1)):
        for x in range(max(0, x0), min(COLS, x1 + 1)):
            g[y][x] = cls


def line_cells(x0, y0, x1, y1):
    cells = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    x, y = x0, y0
    while True:
        cells.append((x, y))
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x += sx
        if e2 <= dx:
            err += dx; y += sy
    return cells


def paint(g, cells, cls):
    for (x, y) in cells:
        if 0 <= x < COLS and 0 <= y < ROWS:
            g[y][x] = cls


# ---------------- 地标模板：返回 (boxes, top_z) ----------------
def T(kind, ax, ay):
    b = []
    K = lambda v: ax + v
    Y = lambda v: ay + v
    if kind == "station":
        b += [(ax, ay, ax + 4, ay + 2, 0, 1.5, C["gray"], None), (ax - .15, ay - .15, ax + 4.15, ay + 2.15, 1.5, 1.8, C["dark"], None)]
        return b, 1.8
    if kind == "smallstation":
        b += [(ax, ay, ax + 2.5, ay + 1.5, 0, 1.1, C["gray"], None), (ax - .1, ay - .1, ax + 2.6, ay + 1.6, 1.1, 1.35, C["dark"], None)]
        return b, 1.35
    if kind == "airport":
        b += [(ax, ay, ax + 4, ay + 1.2, 0, 1.0, C["white"], None), (ax - .1, ay - .1, ax + 4.1, ay + 1.3, 1.0, 1.2, C["glass"], None),
              (ax + 3.3, ay + 1.6, ax + 3.7, ay + 2.0, 0, 3.2, C["white"], None), (ax + 3.1, ay + 1.4, ax + 3.9, ay + 2.2, 3.2, 3.5, C["dark"], None),
              (ax + .4, ay + 2.0, ax + 2.4, ay + 2.4, .6, 1.0, C["white"], None), (ax + 1.1, ay + 1.5, ax + 1.6, ay + 2.9, .8, .95, C["white"], None),
              (ax + 2.2, ay + 2.0, ax + 2.4, ay + 2.4, 1.0, 1.5, C["red"], None)]
        return b, 3.5
    if kind == "hotel":
        b += [(ax, ay, ax + 1.4, ay + 1.2, 0, 2.6, C["white"], None), (ax - .1, ay - .1, ax + 1.5, ay + 1.3, 2.6, 2.8, C["hotel"], None),
              (ax + .4, ay + 1.2, ax + 1.0, ay + 1.3, 1.6, 2.2, C["hotel"], None)]
        return b, 2.8
    if kind == "torii":
        for i in range(3):
            x = ax + i * 1.2
            b += [(x + .1, ay + .05, x + .35, ay + .3, 0, 2.2, C["red"], None), (x + .1, ay + 1.0, x + .35, ay + 1.25, 0, 2.2, C["red"], None),
                  (x - .05, ay - .1, x + .5, ay + 1.4, 2.2, 2.5, shade(C["red"], -40), C["red"])]
        return b, 2.5
    if kind == "pagoda":
        k = 1.6
        Kk = lambda v: ax + v * k; Yk = lambda v: ay + v * k
        b += [(Kk(0), Yk(0), Kk(1), Yk(1), 0, 1.2, C["wood"], None), (Kk(-.25), Yk(-.25), Kk(1.25), Yk(1.25), 1.2, 1.5, C["dark"], None),
              (Kk(.15), Yk(.15), Kk(.85), Yk(.85), 1.5, 2.6, C["wood"], None), (Kk(-.1), Yk(-.1), Kk(1.1), Yk(1.1), 2.6, 2.9, C["dark"], None),
              (Kk(.3), Yk(.3), Kk(.7), Yk(.7), 2.9, 3.8, C["wood"], None), (Kk(.05), Yk(.05), Kk(.95), Yk(.95), 3.8, 4.1, C["dark"], None),
              (Kk(.45), Yk(.45), Kk(.55), Yk(.55), 4.1, 5.0, C["gold"], None)]
        return b, 5.0
    if kind == "machiya":
        for i in range(3):
            x = ax + i * .66
            b += [(x + .03, ay, x + .63, ay + 1.3, 0, 1.1, C["wood2"], None), (x - .02, ay - .1, x + .68, ay + 1.4, 1.1, 1.4, C["dark"], None),
                  (x + .25, ay + 1.3, x + .41, ay + 1.45, .4, .75, C["red"], None)]
        return b, 1.4
    if kind == "castle":       # 二条城式：白墙围院 + 中央殿
        w = .18
        b += [(ax, ay, ax + 3, ay + w, 0, .6, C["white"], C["dark"]), (ax, ay + 3 - w, ax + 3, ay + 3, 0, .6, C["white"], C["dark"]),
              (ax, ay, ax + w, ay + 3, 0, .6, C["white"], C["dark"]), (ax + 3 - w, ay, ax + 3, ay + 3, 0, .6, C["white"], C["dark"]),
              (ax + 1, ay + 1, ax + 2, ay + 2, 0, 1.4, C["white"], None), (ax + .8, ay + .8, ax + 2.2, ay + 2.2, 1.4, 1.7, C["dark"], None),
              (ax + 1.25, ay + 1.25, ax + 1.75, ay + 1.75, 1.7, 2.6, C["white"], None), (ax + 1.1, ay + 1.1, ax + 1.9, ay + 1.9, 2.6, 2.85, C["dark"], None)]
        return b, 2.85
    if kind == "bigcastle":    # 大阪城式：石垣 + 天守
        b += [(ax, ay, ax + 3, ay + 3, 0, 1.2, C["stone"], None),
              (ax + .6, ay + .6, ax + 2.4, ay + 2.4, 1.2, 2.4, C["white"], None), (ax + .4, ay + .4, ax + 2.6, ay + 2.6, 2.4, 2.7, C["green"], None),
              (ax + .9, ay + .9, ax + 2.1, ay + 2.1, 2.7, 3.7, C["white"], None), (ax + .7, ay + .7, ax + 2.3, ay + 2.3, 3.7, 4.0, C["green"], None),
              (ax + 1.2, ay + 1.2, ax + 1.8, ay + 1.8, 4.0, 4.8, C["white"], None), (ax + 1.0, ay + 1.0, ax + 2.0, ay + 2.0, 4.8, 5.1, C["green"], None),
              (ax + 1.4, ay + 1.4, ax + 1.6, ay + 1.6, 5.1, 5.6, C["gold"], None)]
        return b, 5.6
    if kind == "goldpavilion":
        k = 1.6
        Kk = lambda v: ax + v * k; Yk = lambda v: ay + v * k
        b += [(Kk(0), Yk(0), Kk(1.2), Yk(1), 0, 1.1, C["white"], None), (Kk(-.2), Yk(-.2), Kk(1.4), Yk(1.2), 1.1, 1.35, C["dark"], None),
              (Kk(.15), Yk(.1), Kk(1.05), Yk(.9), 1.35, 2.4, C["gold"], None), (Kk(0), Yk(-.05), Kk(1.2), Yk(1.05), 2.4, 2.65, C["dark"], None),
              (Kk(.3), Yk(.25), Kk(.9), Yk(.75), 2.65, 3.6, C["gold"], None), (Kk(.15), Yk(.1), Kk(1.05), Yk(.9), 3.6, 3.85, C["dark"], None)]
        return b, 3.85
    if kind == "palace":
        b += [(ax, ay, ax + 3, ay + 1.4, 0, .9, C["white"], None), (ax - .15, ay - .15, ax + 3.15, ay + 1.55, .9, 1.15, C["dark"], None)]
        return b, 1.15
    if kind == "bighall":      # 东大寺大佛殿
        b += [(ax, ay, ax + 3.2, ay + 2, 0, 1.8, C["wood2"], None), (ax - .4, ay - .4, ax + 3.6, ay + 2.4, 1.8, 2.3, C["dark"], None),
              (ax + .5, ay + .5, ax + 2.7, ay + 1.5, 2.3, 3.1, C["wood2"], None), (ax + .2, ay + .2, ax + 3.0, ay + 1.8, 3.1, 3.5, C["dark"], None),
              (ax + 1.0, ay + .9, ax + 1.3, ay + 1.1, 3.5, 4.0, C["gold"], None), (ax + 1.9, ay + .9, ax + 2.2, ay + 1.1, 3.5, 4.0, C["gold"], None)]
        return b, 4.0
    if kind == "shrine":       # 春日大社：朱红殿 + 石灯笼
        b += [(ax, ay, ax + 1.6, ay + 1.2, 0, 1.1, C["red"], None), (ax - .2, ay - .2, ax + 1.8, ay + 1.4, 1.1, 1.4, C["dark"], None)]
        for i in range(4):
            b.append((ax - 1.4 + i * .45, ay + 1.5, ax - 1.25 + i * .45, ay + 1.65, 0, .7, C["stone"], None))
        return b, 1.4
    if kind == "skygarden":    # 梅田空中庭园：双塔 + 顶部连桥
        b += [(ax, ay, ax + .7, ay + .7, 0, 5.0, C["glass"], None), (ax + 1.3, ay, ax + 2.0, ay + .7, 0, 5.0, C["glass"], None),
              (ax - .1, ay - .1, ax + 2.1, ay + .8, 5.0, 5.5, C["dark"], None)]
        return b, 5.5
    if kind == "tower":        # 通天阁 / 港塔
        b += [(ax + .2, ay + .2, ax + .8, ay + .8, 0, .6, C["stone"], None), (ax + .35, ay + .35, ax + .65, ay + .65, .6, 4.2, C["red"], None),
              (ax + .1, ay + .1, ax + .9, ay + .9, 4.2, 4.8, C["red"], C["white"]), (ax + .4, ay + .4, ax + .6, ay + .6, 4.8, 5.4, C["red"], None)]
        return b, 5.4
    if kind == "signs":        # 道顿堀：运河边的招牌
        cols = [C["red"], C["gold"], C["blue"], C["green"]]
        for i in range(4):
            x = ax + i * .7
            b += [(x, ay, x + .5, ay + .5, 0, 1.2, C["white"], None), (x - .05, ay - .15, x + .55, ay + .1, .6, 2.0 + (i % 2) * .5, cols[i], None)]
        return b, 2.5
    if kind == "arcade":       # 心斋桥筋：带玻璃顶的长廊（沿 y）
        b += [(ax, ay, ax + .8, ay + 4, 0, .9, C["white"], None), (ax - .1, ay - .1, ax + .9, ay + 4.1, .9, 1.1, C["glass"], None)]
        return b, 1.1
    if kind == "aquarium":     # 海游馆
        b += [(ax, ay, ax + 2.4, ay + 2, 0, 2.2, C["blue"], None), (ax, ay, ax + 2.4, ay + 2, 2.2, 2.6, C["red"], None),
              (ax + .4, ay + .4, ax + 2.0, ay + 1.6, 2.6, 3.0, C["glass"], None)]
        return b, 3.0
    if kind == "westernhouse":
        b += [(ax, ay, ax + 1.4, ay + 1.1, 0, 1.4, C["white"], None), (ax - .15, ay - .15, ax + 1.55, ay + 1.25, 1.4, 1.7, C["green"], None),
              (ax + 1.0, ay + .1, ax + 1.35, ay + .45, 1.7, 2.4, C["white"], None), (ax + .95, ay + .05, ax + 1.4, ay + .5, 2.4, 2.7, C["green"], None)]
        return b, 2.7
    if kind == "chinagate":
        b += [(ax, ay + .1, ax + .25, ay + .35, 0, 1.8, C["red"], None), (ax + 1.4, ay + .1, ax + 1.65, ay + .35, 0, 1.8, C["red"], None),
              (ax - .1, ay - .1, ax + 1.75, ay + .55, 1.8, 2.1, C["red"], C["gold"]), (ax + .3, ay, ax + 1.35, ay + .45, 2.1, 2.4, C["green"], None)]
        return b, 2.4
    if kind == "ship":
        b += [(ax, ay, ax + 1.6, ay + .6, 0, .4, C["white"], None), (ax + .3, ay + .1, ax + 1.0, ay + .5, .4, .9, C["white"], C["red"])]
        return b, .9
    if kind == "hillgrass":    # 若草山
        b += [(ax, ay, ax + 2, ay + 2, 0, .7, C["hill"], shade(C["hill"], 18)), (ax + .4, ay + .4, ax + 1.6, ay + 1.6, .7, 1.3, C["hill"], shade(C["hill"], 30))]
        return b, 1.3
    return b, 0


# ---------------- 底板渲染 ----------------
def render_scene(scene, path=(), hero=None, hero_cfg=None, hero_dir="front", decor=True):
    """decor=False 时只画地面、骨架与地标本体，不画路径 / 旗 / 标签 / 小人（网页原型自己叠）"""
    g = scene["ground"]
    hroads, vroads = scene.get("hroads", set()), scene.get("vroads", set())
    hrails, vrails = scene.get("hrails", set()), scene.get("vrails", set())
    subway = scene.get("subway", set())
    im = Image.new("RGB", (PW, PH), (240, 234, 216))
    dr = ImageDraw.Draw(im)

    def quad(x0, y0, x1, y1, z, col):
        dr.polygon([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], col)

    def box(x0, y0, x1, y1, z0, z1, base, top=None):
        dr.polygon([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], base)
        dr.polygon([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], shade(base, -38))
        dr.polygon([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top if top else shade(base, 28))

    GC = dict(U=C["urban"], G=C["farm"], F=C["forest"], Z=C["forest"], M=C["mtn"], W=C["water"], O=C["sea"], P=C["farm"], S=C["sand"], Y=C["hill"])
    for s in range(COLS + ROWS - 1):
        for x in range(COLS):
            y = s - x
            if not (0 <= y < ROWS):
                continue
            t = g[y][x]
            quad(x, y, x + 1, y + 1, 0, GC[t])
            cx, cy = P(x + .5, y + .5)
            if t == "U":
                dr.point((cx + 5, cy - 2), C["urban2"]); dr.point((cx - 7, cy + 2), C["urban2"])
            elif t == "G":
                dr.line((cx - 8, cy, cx + 8, cy), C["farm2"])
            elif t in "WO":
                off = (x * 3 + y * 5) % 6
                dr.line((cx - 8 + off, cy - 2, cx - 4 + off, cy - 2), C["water2"] if t == "W" else C["sea2"])
    water = lambda x, y: g[y][x] in "WO"
    for (x, y) in hroads:
        quad(x, y + .3, x + 1, y + .7, 0, C["plank"] if water(x, y) else C["road"])
    for (x, y) in vroads:
        quad(x + .3, y, x + .7, y + 1, 0, C["plank"] if water(x, y) else C["road"])
    for (x, y) in hrails:
        quad(x, y + .42, x + 1, y + .58, 0, C["rail"])
        for k in (.2, .5, .8):
            quad(x + k - .04, y + .36, x + k + .04, y + .64, 0, C["rail2"])
    for (x, y) in vrails:
        quad(x + .42, y, x + .58, y + 1, 0, C["rail"])
    for (x, y) in subway:
        if y % 2 == 0:
            quad(x + .46, y + .1, x + .54, y + .6, 0, C["subway"])
    for (x, y) in (path if decor else ()):
        cx, cy = P(x + .5, y + .5)
        dr.rectangle((cx - 3, cy - 2, cx + 2, cy + 2), C["ink"]); dr.rectangle((cx - 2, cy - 1, cx + 1, cy + 1), C["path"])

    objs = []

    def add(boxes, key=None):
        if boxes or key is not None:
            objs.append((key if key is not None else max(b[2] + b[3] for b in boxes), boxes))

    for y in range(ROWS):
        for x in range(COLS):
            t = g[y][x]
            if t == "M":
                h = 1 + (x * 3 + y * 5) % 3
                bs = [(x, y, x + 1, y + 1, 0, .8, C["mtn"], shade(C["mtn"], 18))]
                if h >= 2:
                    bs.append((x + .2, y + .2, x + .8, y + .8, .8, 1.6, C["mtn"], shade(C["mtn"], 30)))
                if h >= 3:
                    bs.append((x + .38, y + .38, x + .62, y + .62, 1.6, 2.3, C["mtn2"], C["mtn3"] if (x + y) % 4 == 0 else shade(C["mtn2"], 30)))
                add(bs)
            elif t == "F" and (x * 5 + y * 3) % 2 == 0:
                add([(x + .42, y + .42, x + .58, y + .58, 0, .5, C["trunk"], None), (x + .2, y + .2, x + .8, y + .8, .5, 1.2, C["canopy"], C["canopy2"]),
                     (x + .35, y + .35, x + .65, y + .65, 1.2, 1.6, C["canopy"], C["canopy2"])])
            elif t == "Z":
                add([(x + u, y + v, x + u + .08, y + v + .08, 0, hh, C["bamboo"], shade(C["bamboo"], 40)) for (u, v, hh) in ((.2, .3, 2.4), (.6, .15, 2.8), (.45, .7, 2.2), (.8, .6, 2.6))])
            elif t == "U" and (x * 7 + y * 13) % 5 == 0 and (x, y) not in hroads and (x, y) not in vroads and (x, y) not in scene.get("nohouse", set()):
                add([(x + .3, y + .3, x + .7, y + .7, 0, .45, C["house"], C["houseroof"])])
            elif t == "P" and (x * 7 + y * 13) % 4 == 0:
                add([(x + .4, y + .4, x + .6, y + .6, 0, .4, C["trunk"], None), (x + .25, y + .25, x + .75, y + .75, .4, 1.0, C["canopy"], C["canopy2"])])
            elif t == "P" and (x * 7 + y * 13) % 4 == 2 and scene.get("deer"):
                add([(x + .4, y + .45, x + .75, y + .6, .0, .3, C["deer"], None), (x + .68, y + .42, x + .8, y + .63, .3, .5, C["deer"], None)])
    for (kind, ax, ay, name, role) in scene["landmarks"]:
        boxes, _ = T(kind, ax, ay)
        add(boxes)
    if hero and decor:
        add([], key=hero[0] + hero[1] + 1.99)
    objs.sort(key=lambda o: o[0])
    for key, boxes in objs:
        for (x0, y0, x1, y1, z0, z1, base, top) in sorted(boxes, key=lambda b: (b[2] + b[3], b[4])):
            box(x0, y0, x1, y1, z0, z1, base, top)
        if not boxes and hero:
            cx, cy = P(hero[0] + .5, hero[1] + .5)
            sp = up(sprite(hero_cfg, hero_dir, 1), 2)
            im.paste(sp, (int(cx - 16), int(cy - 38)), sp)
    for (kind, ax, ay, name, role) in (scene["landmarks"] if decor else []):
        _, top_z = T(kind, ax, ay)
        cx, cy = P(ax + .5, ay + .5, top_z)
        if role in FLAG:
            dr.line((cx, cy - 12, cx, cy - 1), C["ink"])
            dr.polygon([(cx + 1, cy - 12), (cx + 8, cy - 10), (cx + 1, cy - 8)], FLAG[role])
        if name:
            text(dr, cx + 10, cy - 20, name)
    for (x, y, s, col) in (scene.get("labels", []) if decor else []):
        text(dr, *P(x, y), s, col=col)
    return im


# =====================================================================
# 四座城
# =====================================================================
def osaka():
    g = blank()
    rect(g, "O", 0, 0, 3, 9); rect(g, "O", 0, 10, 5, 23)
    rect(g, "U", 1, 20, 4, 22)                                  # 机场人工岛
    rect(g, "O", 5, 20, 5, 22); rect(g, "O", 1, 19, 4, 19); rect(g, "O", 1, 23, 4, 23)
    paint(g, line_cells(35, 2, 22, 7) + line_cells(22, 7, 6, 9), "W")   # 淀川
    rect(g, "W", 17, 14, 25, 14)                                # 道顿堀川
    for (x, y) in [(x, y) for x in range(26, 33) for y in range(4, 11) if x in (26, 32) or y in (4, 10)]:
        g[y][x] = "W"                                           # 大阪城护城河
    rect(g, "P", 27, 5, 31, 9)
    hroads = {(x, y) for y in (6, 11, 15, 19) for x in range(6, 36)}
    vroads = {(x, y) for x in (10, 16, 22, 28, 33) for y in range(1, 23)}
    hrails = {(x, 21) for x in range(5, 22)}
    vrails = {(21, y) for y in range(18, 21)}
    subway = {(22, y) for y in range(2, 21)}
    landmarks = [("airport", 1, 20, "关西机场", "airport"), ("hotel", 16, 17, "难波 · 酒店", "lodging"), ("signs", 19, 15, "道顿堀", "place"),
                 ("arcade", 23, 9, "心斋桥", "place"), ("bigcastle", 28, 6, "大阪城", "place"), ("skygarden", 17, 3, "梅田空中庭园", "place"),
                 ("tower", 23, 19, "通天阁", "place"), ("aquarium", 6, 13, "海游馆", "place"), ("ship", 2, 6, "", None), ("ship", 2, 15, "", None)]
    labels = [(0.5, 2, "大阪湾", (60, 100, 150)), (30, 1.5, "淀川", (60, 100, 150))]
    return dict(ground=g, hroads=hroads, vroads=vroads, hrails=hrails, vrails=vrails, subway=subway, landmarks=landmarks, labels=labels,
                nohouse={(x, y) for x in range(1, 5) for y in range(20, 23)})


def kyoto():
    g = blank()
    rect(g, "M", 33, 0, 35, 23); rect(g, "M", 0, 0, 35, 1); rect(g, "M", 0, 0, 1, 23)
    rect(g, "F", 32, 2, 32, 23); rect(g, "F", 2, 2, 32, 2); rect(g, "F", 2, 2, 2, 23)
    rect(g, "F", 29, 16, 32, 22); rect(g, "F", 27, 21, 31, 23); rect(g, "G", 3, 22, 12, 23)
    rect(g, "Z", 3, 11, 5, 14)
    rect(g, "P", 18, 6, 23, 9)
    for y in range(ROWS):
        g[y][26 if y >= 6 else 26 + (6 - y) // 3] = "W"          # 鸭川
        if y >= 9:
            g[y][5 + (y - 9) * 5 // 14] = "W"                      # 桂川
    rect(g, "W", 6, 4, 8, 5)                                    # 金阁寺池
    for (x, y) in [(x, y) for x in range(12, 17) for y in range(9, 14) if x in (12, 16) or y in (9, 13)]:
        g[y][x] = "W"                                           # 二条城护城河
    hroads = {(x, y) for y in (6, 11, 16, 20) for x in range(3, 32)}
    vroads = {(x, y) for x in (11, 16, 21, 28) for y in range(3, 22)} | {(8, y) for y in range(4, 12)}
    hrails = {(x, 22) for x in range(9, 28)}
    vrails = {(27, y) for y in range(20, 22)}
    subway = {(16, y) for y in range(3, 22)}
    landmarks = [("station", 14, 19, "京都站", "place"), ("hotel", 20, 18, "京都站前 · 酒店", "lodging"), ("torii", 29, 21, "伏见稻荷", "place"),
                 ("pagoda", 31, 16, "清水寺", "place"), ("machiya", 27, 13, "祇园", "place"), ("castle", 13, 10, "二条城", "place"),
                 ("goldpavilion", 7, 3, "金阁寺", "place"), ("palace", 20, 7, "御所", None)]
    labels = [(27, 3, "鸭川", (60, 100, 150)), (33.5, 12, "东山", (70, 90, 70)), (3, 10, "岚山", (70, 90, 70))]
    return dict(ground=g, hroads=hroads, vroads=vroads, hrails=hrails, vrails=vrails, subway=subway, landmarks=landmarks, labels=labels)


def nara():
    g = blank()
    rect(g, "M", 32, 0, 35, 23); rect(g, "M", 0, 0, 35, 1); rect(g, "F", 28, 2, 31, 23); rect(g, "F", 0, 2, 35, 2)
    rect(g, "P", 15, 5, 27, 18); rect(g, "Y", 28, 6, 31, 10); rect(g, "G", 0, 19, 14, 23)
    rect(g, "W", 14, 11, 15, 12)                                # 猿泽池
    rect(g, "W", 18, 15, 20, 16)
    hroads = {(x, y) for y in (8, 12, 16) for x in range(2, 30)}
    vroads = {(x, y) for x in (7, 13, 18, 24) for y in range(3, 20)}
    hrails = {(x, 13) for x in range(0, 12)} | {(x, 19) for x in range(0, 7)}
    landmarks = [("station", 3, 17, "JR 奈良", None), ("smallstation", 11, 11, "近铁奈良", "place"), ("bighall", 19, 5, "东大寺", "place"),
                 ("pagoda", 15, 9, "兴福寺", "place"), ("shrine", 26, 13, "春日大社", "place"), ("hillgrass", 29, 7, "若草山", None)]
    labels = [(20, 14, "奈良公园 · 鹿", (70, 90, 70))]
    return dict(ground=g, hroads=hroads, vroads=vroads, hrails=hrails, vrails=set(), subway=set(), landmarks=landmarks, labels=labels, deer=True)


def kobe():
    g = blank()
    rect(g, "M", 0, 0, 35, 2); rect(g, "F", 0, 3, 35, 4); rect(g, "O", 0, 19, 35, 23)
    rect(g, "U", 16, 19, 23, 21); rect(g, "U", 27, 19, 31, 20)  # 港区填海地
    rect(g, "P", 18, 6, 21, 7)
    hroads = {(x, y) for y in (7, 11, 14, 17) for x in range(1, 35)}
    vroads = {(x, y) for x in (6, 12, 18, 24, 30) for y in range(5, 19)} | {(20, y) for y in range(18, 22)}
    hrails = {(x, 9) for x in range(0, 36)}
    landmarks = [("station", 16, 8, "三宫", "place"), ("hotel", 24, 12, "三宫 · 酒店", "lodging"), ("westernhouse", 19, 4, "北野异人馆", "place"),
                 ("westernhouse", 22, 5, "", None), ("chinagate", 15, 13, "南京町", "place"), ("tower", 19, 19, "神户港塔", "place"),
                 ("ship", 25, 21, "", None), ("ship", 8, 21, "", None), ("ship", 12, 22, "", None)]
    labels = [(2, 1, "六甲山", (70, 90, 70)), (28, 22, "神户港", (60, 100, 150))]
    return dict(ground=g, hroads=hroads, vroads=vroads, hrails=hrails, vrails=set(), subway=set(), landmarks=landmarks, labels=labels,
                nohouse={(x, y) for x in range(16, 24) for y in range(19, 22)})


SCENES = dict(osaka=osaka(), kyoto=kyoto(), nara=nara(), kobe=kobe())


def path_of(*segs):
    out = []
    for seg in segs:
        for c in seg:
            if not out or out[-1] != c:
                out.append(c)
    return out


H = lambda y, x0, x1: [(x, y) for x in (range(x0, x1 + 1) if x0 <= x1 else range(x0, x1 - 1, -1))]
V = lambda x, y0, y1: [(x, y) for y in (range(y0, y1 + 1) if y0 <= y1 else range(y0, y1 - 1, -1))]

# =====================================================================
# 七天行程
# =====================================================================
TRIP = dict(title="关西七日", subtitle="大阪 · 京都 · 奈良 · 神户", dates="2026.11.14 – 11.20", theme="红叶古都", days=[
    dict(city="osaka", title="大阪 · 抵达", entries=[
        ("place", "关西机场", "13:30"), ("transport", "JR 关空快速 · 50 分钟"), ("lodging", "难波 · 酒店 check-in"),
        ("transport", "步行 · 8 分钟"), ("place", "道顿堀", "17:00"), ("transport", "步行 · 10 分钟"), ("place", "心斋桥", "18:30")],
        path=path_of(H(21, 5, 21), V(21, 20, 18), H(18, 20, 17), H(18, 18, 21), V(21, 17, 16), H(16, 21, 22), V(22, 15, 12), [(23, 12)]),
        hero=(21, 19), hero_dir="back", lodging="难波"),
    dict(city="osaka", title="大阪 · 城与塔", entries=[
        ("transport", "地铁 · 20 分钟"), ("place", "大阪城", "09:30"), ("transport", "地铁 · 15 分钟"), ("place", "梅田空中庭园", "13:00"),
        ("transport", "地铁御堂筋线 · 20 分钟"), ("place", "新世界 · 通天阁", "16:30")],
        path=path_of(H(18, 17, 22), V(22, 17, 11), H(11, 23, 28), V(28, 10, 7), [(27, 7)], V(28, 8, 11), H(11, 27, 22), V(22, 10, 6), H(6, 21, 18), [(18, 5), (18, 4)],
                     [(18, 5), (18, 6)], H(6, 19, 22), V(22, 7, 19), [(23, 19)]),
        hero=(28, 9), hero_dir="back", lodging="难波"),
    dict(city="kyoto", title="京都 · 东山", entries=[
        ("transport", "JR 京都线新快速 · 30 分钟"), ("place", "京都站 · 寄存行李", "09:00"), ("transport", "JR 奈良线 · 5 分钟"), ("place", "伏见稻荷", "09:40"),
        ("transport", "JR + 步行 · 25 分钟"), ("place", "清水寺", "12:00"), ("transport", "步行 · 20 分钟"), ("place", "祇园", "15:00"), ("lodging", "京都站前 · 酒店")],
        path=path_of(H(22, 16, 27), [(28, 21)], [(27, 22)], H(22, 26, 21), V(21, 21, 16), H(16, 22, 30), H(16, 29, 28), V(28, 15, 14),
                     V(28, 15, 20), H(20, 27, 21), [(21, 19)]),
        hero=(24, 16), hero_dir="right", lodging="京都站前"),
    dict(city="kyoto", title="京都 · 洛西", entries=[
        ("transport", "巴士 205 路 · 40 分钟"), ("place", "金阁寺", "09:30"), ("transport", "巴士 · 30 分钟"), ("place", "岚山竹林 · 渡月桥", "11:30"),
        ("transport", "JR 嵯峨野线 · 15 分钟"), ("place", "二条城", "15:00"), ("lodging", "京都站前 · 酒店")],
        path=path_of(H(20, 21, 16), V(16, 19, 6), H(6, 15, 8), V(8, 5, 4), [(8, 5)], V(8, 6, 11), H(11, 7, 4), [(4, 12), (4, 13)], [(4, 12)], H(11, 5, 13),
                     [(13, 12), (14, 12)], H(11, 14, 16), V(16, 12, 20), H(20, 17, 21), [(21, 19)]),
        hero=(8, 8), hero_dir="back", lodging="京都站前"),
    dict(city="nara", title="奈良 · 一日往返", entries=[
        ("transport", "近铁京都线 · 45 分钟"), ("place", "近铁奈良", "09:30"), ("transport", "步行 · 10 分钟"), ("place", "兴福寺", "09:50"),
        ("transport", "步行 · 20 分钟"), ("place", "东大寺", "10:40"), ("transport", "步行 · 穿过奈良公园 · 25 分钟"), ("place", "春日大社", "13:00"),
        ("transport", "近铁 · 45 分钟回京都"), ("lodging", "京都站前 · 酒店")],
        path=path_of(H(13, 0, 11), [(12, 12), (13, 12)], V(13, 11, 8), H(8, 14, 15), [(15, 9)], H(8, 16, 18), V(18, 7, 6), [(19, 6)], V(18, 7, 12),
                     H(12, 19, 24), [(24, 13), (25, 13)], H(12, 24, 13), [(13, 13)]),
        hero=(18, 10), hero_dir="front", lodging="京都站前"),
    dict(city="kobe", title="神户 · 港与山手", entries=[
        ("transport", "JR 神户线新快速 · 50 分钟"), ("place", "三宫", "10:00"), ("transport", "步行上坡 · 15 分钟"), ("place", "北野异人馆", "10:30"),
        ("transport", "步行 · 20 分钟"), ("place", "南京町", "12:30"), ("transport", "步行 · 15 分钟"), ("place", "神户港塔 · 美利坚公园", "15:00"), ("lodging", "三宫 · 酒店")],
        path=path_of(H(9, 0, 18), V(18, 8, 7), V(18, 6, 5), [(19, 5)], V(18, 6, 11), H(11, 17, 12), V(12, 12, 14), H(14, 13, 15), [(15, 14)],
                     H(14, 16, 20), V(20, 15, 19), [(19, 19)], V(20, 18, 14), H(14, 21, 24), [(24, 13)]),
        hero=(18, 6), hero_dir="back", lodging="三宫"),
    dict(city="osaka", title="大阪 · 返程", entries=[
        ("transport", "JR 神户线 · 25 分钟"), ("transport", "地铁中央线 · 20 分钟"), ("place", "海游馆", "09:30"),
        ("transport", "南海空港线 · 45 分钟"), ("place", "关西机场 ✈", "14:00")],
        path=path_of(H(15, 22, 8), [(8, 14), (7, 14)], [(8, 15)], H(15, 9, 21), V(21, 16, 21), H(21, 20, 5)),
        hero=(12, 15), hero_dir="left", lodging=None),
])
HERO_CFG = dict(skin=1, hair="bun", hairc=0, top=0, pants=0, shoes=0, hat="cap", hatc=0, acc="backpack")


def day_panel(i, day):
    plate = render_scene(SCENES[day["city"]], path=day["path"], hero=day["hero"], hero_cfg=HERO_CFG, hero_dir=day["hero_dir"])
    W_, H_ = plate.width, plate.height + 40 + 64
    im = Image.new("RGB", (W_, H_), (250, 246, 236))
    dr = ImageDraw.Draw(im)
    dr.rectangle((0, 0, W_ - 1, 39), (250, 246, 236)); dr.line((0, 39, W_, 39), (46, 38, 40))
    text(dr, 14, 8, f"第 {i + 1} 天 · {day['title']}", 24, stroke=False)
    places = [e[1] for e in day["entries"] if e[0] == "place"]
    trans = [e[1].split(" · ")[0] for e in day["entries"] if e[0] == "transport"]
    text(dr, W_ - 14 - 16 * (len(day["title"]) + 12), 10, f"{len(places)} 站 · {len(trans)} 段交通", 16, (110, 100, 96), stroke=False)
    im.paste(plate, (0, 40))
    y = 40 + plate.height
    dr.rectangle((0, y, W_ - 1, H_ - 1), (246, 240, 226)); dr.line((0, y, W_, y), (200, 190, 176))
    line1 = "  →  ".join(places)
    text(dr, 14, y + 8, line1, 16, stroke=False)
    lodg = f"住 · {day['lodging']}" if day["lodging"] else "回程 · 合上书"
    text(dr, 14, y + 34, f"交通：{' / '.join(trans)}    {lodg}", 16, (110, 100, 96), stroke=False)
    return im


def cover_panel(size):
    W_, H_ = size
    im = Image.new("RGB", (W_, H_), (168, 78, 66))
    dr = ImageDraw.Draw(im)
    dr.rectangle((24, 24, W_ - 25, H_ - 25), outline=(238, 196, 84), width=4)
    dr.rectangle((40, 40, W_ - 41, H_ - 41), outline=(238, 196, 84), width=2)
    for k in range(0, H_, 6):
        dr.line((0, k, 14, k), (120, 50, 44))
    f = ImageFont.truetype(FONT, 80); f2 = ImageFont.truetype(FONT, 32); f3 = ImageFont.truetype(FONT, 24)
    dr.text((W_ // 2 - 160, 110), TRIP["title"], (246, 236, 214), font=f)
    dr.text((W_ // 2 - 16 * len(TRIP["subtitle"]), 220), TRIP["subtitle"], (238, 196, 84), font=f2)
    dr.text((W_ // 2 - 8 * len(TRIP["dates"]) - 8, 270), TRIP["dates"], (246, 236, 214), font=f3)
    sp = up(sprite(HERO_CFG, "front", 0), 8)
    im.paste(sp, (W_ // 2 - 64, 330), sp)
    n_place = sum(1 for d in TRIP["days"] for e in d["entries"] if e[0] == "place")
    n_trans = sum(1 for d in TRIP["days"] for e in d["entries"] if e[0] == "transport")
    n_lodg = len({d["lodging"] for d in TRIP["days"] if d["lodging"]})
    lines = [f"世界主题 · {TRIP['theme']}", f"7 天 · 4 座城 · {n_place} 站 · {n_trans} 段交通 · {n_lodg} 家住宿", "翻开这本书，进入这一周 →"]
    for j, s in enumerate(lines):
        dr.text((W_ // 2 - 8 * len(s) - 12 * sum(1 for ch in s if ord(ch) > 255) // 2, 520 + j * 40), s, (246, 236, 214) if j != 2 else (238, 196, 84), font=f3)
    return im


def compose():
    panels = [day_panel(i, d) for i, d in enumerate(TRIP["days"])]
    pw, ph = panels[0].size
    cover = cover_panel((pw, ph))
    tiles = [cover] + panels
    gap, pad, top = 28, 36, 130
    W_ = pad * 2 + pw * 4 + gap * 3
    H_ = top + ph * 2 + gap + pad
    im = Image.new("RGB", (W_, H_), (246, 240, 226))
    dr = ImageDraw.Draw(im)
    text(dr, pad, 24, "关西七日 · 一本书的样子（一页 = 一天，一块底板 = 一座城的一天）", 44, stroke=False)
    text(dr, pad, 84, "四座城各一块城市尺度的底板（36 × 24 格），七天各一页；旗：红 = 站点，蓝 = 住宿；黄点 = 当天路线；小人停在当天的某一站。", 22, (110, 100, 96), stroke=False)
    for k, t in enumerate(tiles):
        x = pad + (k % 4) * (pw + gap); y = top + (k // 4) * (ph + gap)
        dr.rectangle((x - 4, y - 4, x + pw + 3, y + ph + 3), outline=(46, 38, 40), width=3)
        im.paste(t, (x, y))
    out = os.path.join(HERE, "关西七日_一本书.png"); im.save(out); print("saved", out, im.size)


def write_json():
    days = []
    for i, d in enumerate(TRIP["days"]):
        entries = []
        for j, e in enumerate(d["entries"]):
            if e[0] == "place":
                entries.append(dict(type="place", order=j, name=e[1], category="sight", plannedStart=(e[2] if len(e) > 2 else None)))
            elif e[0] == "transport":
                parts = e[1].split(" · ")
                entries.append(dict(type="transport", order=j, mode=parts[0], durationText=parts[-1] if len(parts) > 1 else None))
            else:
                entries.append(dict(type="lodging", order=j, name=e[1]))
        days.append(dict(index=i + 1, date=f"2026-11-{14 + i}", title=d["title"], city=d["city"], entries=entries, lodging=d["lodging"]))
    trip = dict(schemaVersion="0.1", title=TRIP["title"], destination=dict(country="日本", region="关西"), startDate="2026-11-14", endDate="2026-11-20",
                theme=TRIP["theme"], seed="kansai-7d-demo", status="planning", days=days)
    os.makedirs(os.path.join(HERE, "..", "示例数据"), exist_ok=True)
    p = os.path.join(HERE, "..", "示例数据", "关西七日.json")
    json.dump(trip, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("saved", p)


if __name__ == "__main__":
    compose(); write_json()
