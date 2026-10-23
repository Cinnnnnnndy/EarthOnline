#!/usr/bin/env python3
"""风格化 3D CG（《潜水员戴夫》新画风那一路）的示意渲染：同一份场景数据，不做像素化，
改为超采样抗锯齿、软投影、面上渐变、球形树、圆润小人、绘画质感后期（暖色分级、移轴景深、暗角、纸纹）。
纯 Pillow，先 3× 超采样再缩回，边缘就平滑了。

  python3 render_cg.py            → 画风对比_像素_vs_3DCG.png（经典像素 / 现代像素 / 风格化 3D CG）
  from render_cg import render_scene_cg, modernize
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import render_trip_book as rb
from pixel_hero import sprite as px_sprite, up, SKIN, HAIRC, TOPC, PANTC, SHOEC, HATC

S = 3                    # 超采样倍率
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
C = rb.C


def sh(c, d):
    return tuple(max(0, min(255, v + d)) for v in c)


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


# ---- 色调（整体基调）：清朗海天（默认，参照《潜水员戴夫》新画风的海天）/ 暖阳纸张 / 暮色琥珀 ----
PALETTES = {
    "sea": dict(name="清朗海天", bg=((226, 240, 250), (186, 220, 242)),
                ground=dict(U=(230, 231, 226), G=(180, 214, 118), F=(84, 176, 104), Z=(84, 176, 104), M=(78, 140, 124), W=(56, 178, 232), O=(30, 138, 214),
                            P=(160, 208, 116), S=(246, 236, 196), Y=(140, 206, 108)),
                road=(252, 252, 250), bridge=(214, 178, 132), rail=(86, 92, 104), tie=(180, 184, 190), subway=(255, 150, 60),
                tint=(0.99, 1.0, 1.02), contrast=1.05, warm=((255, 236, 200), 0.05), cool=((30, 90, 160), 0.12), vignette=((24, 56, 90), 0.24),
                noise=0.035, sky=True),
    "warm": dict(name="暖阳纸张", bg=((244, 238, 226), (226, 216, 200)),
                 ground=dict(U=(226, 214, 192), G=(190, 208, 132), F=(108, 164, 96), Z=(108, 164, 96), M=(98, 138, 96), W=(72, 160, 224), O=(48, 132, 210),
                             P=(168, 204, 120), S=(238, 230, 210), Y=(150, 204, 110)),
                 road=(246, 242, 232), bridge=(200, 168, 130), rail=(98, 92, 96), tie=(170, 160, 150), subway=(236, 150, 70),
                 tint=(1.02, 1.0, 0.98), contrast=1.06, warm=((255, 200, 140), 0.10), cool=((60, 90, 160), 0.10), vignette=((60, 40, 26), 0.32),
                 noise=0.045, sky=False),
    "dusk": dict(name="暮色琥珀", bg=((252, 226, 204), (214, 178, 206)),
                 ground=dict(U=(232, 214, 200), G=(196, 196, 120), F=(96, 150, 104), Z=(96, 150, 104), M=(110, 118, 130), W=(96, 140, 214), O=(70, 110, 196),
                             P=(176, 190, 120), S=(244, 226, 196), Y=(160, 196, 110)),
                 road=(252, 240, 226), bridge=(204, 160, 120), rail=(96, 84, 100), tie=(176, 158, 160), subway=(255, 160, 80),
                 tint=(1.04, 0.99, 0.96), contrast=1.06, warm=((255, 180, 110), 0.14), cool=((90, 60, 140), 0.14), vignette=((70, 30, 60), 0.34),
                 noise=0.045, sky=False),
}
_PAL = PALETTES["sea"]


def set_palette(key):
    global _PAL
    _PAL = PALETTES[key]


# CG 色板：饱和度略提、对比略提，再按色调偏色
def cg(c):
    """电影色：饱和度略提、对比略提、高光偏暖（参照《潜水员戴夫》新画风）"""
    r, g, b = c
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    r, g, b = [lum + (v - lum) * 1.12 for v in (r, g, b)]
    r, g, b = [(v - 128) * 1.06 + 128 for v in (r, g, b)]
    tr, tg, tb = _PAL["tint"]
    return tuple(max(0, min(255, int(v))) for v in (r * tr + 3, g * tg + 2, b * tb))


def render_scene_cg(scene, path=(), hero=None, hero_cfg=None, hero_dir="front", decor=True, stops=(), lodging=None, post=True, palette=None):
    if palette:
        set_palette(palette)
    PAL = _PAL
    g = scene["ground"]; COLS, ROWS = rb.COLS, rb.ROWS
    W, H = rb.PW * S, rb.PH * S
    im = Image.new("RGB", (W, H), (236, 228, 214))
    dr = ImageDraw.Draw(im)
    # 背景：色调决定的渐变（清朗海天是天空，暖阳是纸）
    for y in range(H):
        t = y / H; dr.line((0, y, W, y), mix(PAL["bg"][0], PAL["bg"][1], t))

    def Pq(u, v, z=0.0):
        x, y = rb.P(u, v, z); return (x * S, y * S)

    def quad(x0, y0, x1, y1, z, col):
        dr.polygon([Pq(x0, y0, z), Pq(x1, y0, z), Pq(x1, y1, z), Pq(x0, y1, z)], col)

    GC = PAL["ground"]
    for s in range(COLS + ROWS - 1):
        for x in range(COLS):
            y = s - x
            if not (0 <= y < ROWS):
                continue
            t = g[y][x]
            quad(x, y, x + 1, y + 1, 0, GC[t])
    # 水面：柔和高光带
    for y in range(ROWS):
        for x in range(COLS):
            if g[y][x] in "WO":
                cx, cy = Pq(x + .5, y + .5)
                dr.ellipse((cx - 10 * S, cy - 2 * S, cx - 2 * S, cy), sh(GC[g[y][x]], 26))
    hroads, vroads = scene.get("hroads", set()), scene.get("vroads", set())
    water = lambda x, y: g[y][x] in "WO"
    for (x, y) in hroads:
        quad(x, y + .28, x + 1, y + .72, 0, PAL["bridge"] if water(x, y) else PAL["road"])
    for (x, y) in vroads:
        quad(x + .28, y, x + .72, y + 1, 0, PAL["bridge"] if water(x, y) else PAL["road"])
    for (x, y) in scene.get("hrails", set()):
        quad(x, y + .44, x + 1, y + .56, 0, PAL["rail"])
        for k in (.2, .5, .8):
            quad(x + k - .04, y + .38, x + k + .04, y + .62, 0, PAL["tie"])
    for (x, y) in scene.get("vrails", set()):
        quad(x + .44, y, x + .56, y + 1, 0, PAL["rail"])
    for (x, y) in scene.get("subway", set()):
        if y % 2 == 0:
            quad(x + .47, y + .1, x + .53, y + .6, 0, PAL["subway"])

    # ---- 物件：先收集，再画软投影，再画本体 ----
    objs = []   # (key, kind, data)
    def add(key, kind, data): objs.append((key, kind, data))
    for y in range(ROWS):
        for x in range(COLS):
            t = g[y][x]
            if t == "M":
                h = 1 + (x * 3 + y * 5) % 3
                add(x + y + 2, "hill", (x, y, h))
            elif t == "F" and (x * 5 + y * 3) % 2 == 0:
                add(x + y + 1.6, "tree", (x + .5, y + .5, 1.0 + ((x * 7 + y) % 3) * .15))
            elif t == "Z":
                add(x + y + 1.5, "bamboo", (x, y))
            elif t == "U" and (x * 7 + y * 13) % 5 == 0 and (x, y) not in hroads and (x, y) not in vroads and (x, y) not in scene.get("nohouse", set()):
                add(x + y + 1.4, "box", [(x + .3, y + .3, x + .7, y + .7, 0, .45, C["house"], C["houseroof"])])
            elif t == "P" and (x * 7 + y * 13) % 4 == 0:
                add(x + y + 1.5, "tree", (x + .5, y + .5, .8))
    for (kind, ax, ay, name, role) in scene["landmarks"]:
        boxes, _ = rb.T(kind, ax, ay)
        if boxes:
            add(max(b[2] + b[3] for b in boxes), "box", boxes)
    if hero and decor:
        add(hero[0] + hero[1] + 1.99, "hero", hero)
    objs.sort(key=lambda o: o[0])

    # 软投影层：光从左上前方来，影子落向 +x +y
    shadow = Image.new("L", (W, H), 0); sd = ImageDraw.Draw(shadow)
    K = .22
    def shadow_box(x0, y0, x1, y1, z1):
        base = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]; top = [(u + K * z1, v + K * z1) for (u, v) in base]
        pts = [Pq(*p) for p in base] + [Pq(*p) for p in top]
        hull = [Pq(x0, y0), Pq(x1, y0), Pq(x1 + K * z1, y0 + K * z1), Pq(x1 + K * z1, y1 + K * z1), Pq(x0 + K * z1, y1 + K * z1), Pq(x0, y1)]
        sd.polygon(hull, 255)
    for key, kind, data in objs:
        if kind == "box":
            for (x0, y0, x1, y1, z0, z1, base, top) in data:
                shadow_box(x0, y0, x1, y1, z1)
        elif kind == "tree":
            x, y, k = data; sd.ellipse((Pq(x + .25, y + .25)[0] - 9 * S * k, Pq(x + .25, y + .25)[1] - 4 * S * k, Pq(x + .25, y + .25)[0] + 9 * S * k, Pq(x + .25, y + .25)[1] + 4 * S * k), 255)
        elif kind == "hill":
            x, y, h = data; shadow_box(x, y, x + 1, y + 1, h * .9)
    shadow = shadow.filter(ImageFilter.GaussianBlur(5 * S))
    dark = Image.new("RGB", (W, H), (70, 52, 40))
    im = Image.composite(dark, im, shadow.point(lambda v: int(v * .30)))
    dr = ImageDraw.Draw(im)

    def face(pts, col, grad=0):
        """带纵向渐变的面：切 4 条横带，上亮下暗"""
        if not grad:
            dr.polygon(pts, col); return
        ys = [p[1] for p in pts]; y0, y1 = min(ys), max(ys)
        dr.polygon(pts, col)
        n = 4
        for i in range(n):
            a, b = y0 + (y1 - y0) * i / n, y0 + (y1 - y0) * (i + 1) / n
            band = [(p[0], p[1]) for p in pts]
            # 用裁剪矩形近似：画一条同色偏暗的横带（多边形与矩形的交集用 mask 近似）
        # 简化：在面的下缘叠一条暗带、上缘叠一条亮带
        dr.line([pts[0], pts[1]], sh(col, 22), width=max(1, S))
    def box(x0, y0, x1, y1, z0, z1, base, top=None):
        base = cg(base); topc = cg(top) if top else sh(base, 30)
        L = [Pq(x0, y1, z1), Pq(x1, y1, z1), Pq(x1, y1, z0), Pq(x0, y1, z0)]
        R = [Pq(x1, y0, z1), Pq(x1, y1, z1), Pq(x1, y1, z0), Pq(x1, y0, z0)]
        T = [Pq(x0, y0, z1), Pq(x1, y0, z1), Pq(x1, y1, z1), Pq(x0, y1, z1)]
        # 侧面：上亮下暗（三段）
        for pts, col in ((L, base), (R, sh(base, -34))):
            dr.polygon(pts, col)
            n = 3
            for i in range(1, n + 1):
                t = i / n
                a = [(pts[0][0] + (pts[3][0] - pts[0][0]) * (i - 1) / n, pts[0][1] + (pts[3][1] - pts[0][1]) * (i - 1) / n), (pts[1][0] + (pts[2][0] - pts[1][0]) * (i - 1) / n, pts[1][1] + (pts[2][1] - pts[1][1]) * (i - 1) / n),
                     (pts[1][0] + (pts[2][0] - pts[1][0]) * t, pts[1][1] + (pts[2][1] - pts[1][1]) * t), (pts[0][0] + (pts[3][0] - pts[0][0]) * t, pts[0][1] + (pts[3][1] - pts[0][1]) * t)]
                dr.polygon(a, sh(col, int(10 - 22 * (i - 1) / (n - 1))))
        dr.polygon(T, topc)
        dr.line([T[3], T[0], T[1]], sh(topc, 48), width=max(1, int(1.4 * S)))     # 顶面受光边（轮廓光）
        dr.line([T[1], T[2]], sh(topc, -10), width=max(1, S // 2))
        dr.line([L[0], L[3]], sh(base, 40), width=max(1, S // 2))                  # 左面近光的竖边
    def tree(x, y, k):
        cx, cy = Pq(x, y)
        dr.rounded_rectangle((cx - 2 * S * k, cy - 14 * S * k, cx + 2 * S * k, cy + 1 * S), radius=2 * S, fill=cg(C["trunk"]))
        base_f = PAL["ground"]["F"]
        for (dx, dy, r, d) in ((0, -18, 11, -22), (-5, -22, 8, 0), (4, -26, 7, 18), (-3, -30, 5, 44)):
            col = sh(base_f, d)
            dr.ellipse((cx + (dx - r) * S * k, cy + (dy - r * .85) * S * k, cx + (dx + r) * S * k, cy + (dy + r * .85) * S * k), col)
    def hill(x, y, h):
        cx, cy = Pq(x + .5, y + .5)
        base_m = PAL["ground"]["M"]
        for i, (r, col) in enumerate(((18, sh(base_m, 6)), (13, sh(base_m, 26)), (8, sh(base_m, 50)))):
            if i >= h + 0: break
            dr.ellipse((cx - r * S, cy - (6 + i * 9) * S - r * .55 * S, cx + r * S, cy - (6 + i * 9) * S + r * .55 * S + 4 * S), col)
        if h >= 3 and (x + y) % 4 == 0:
            dr.ellipse((cx - 4 * S, cy - 30 * S, cx + 4 * S, cy - 26 * S), (236, 236, 228))
    def bamboo(x, y):
        for (u, v, hh) in ((.2, .3, 2.4), (.6, .15, 2.8), (.45, .7, 2.2), (.8, .6, 2.6)):
            bx, by = Pq(x + u, y + v)
            dr.line((bx, by, bx, by - hh * 10 * S), fill=(150, 196, 120), width=max(1, int(1.6 * S)))
            dr.ellipse((bx - 3 * S, by - hh * 10 * S - 3 * S, bx + 3 * S, by - hh * 10 * S + 2 * S), (168, 208, 132))
    def hero_cg(hx, hy, cfg, direction):
        cx, cy = Pq(hx + .5, hy + .5)
        skin, hair, top, pants, shoe = cg(SKIN[cfg["skin"]]), cg(HAIRC[cfg["hairc"]]), cg(TOPC[cfg["top"]]), cg(PANTC[cfg["pants"]]), cg(SHOEC[cfg["shoes"]])
        u = S * 0.8
        sh_layer = Image.new("RGBA", (int(40 * u), int(16 * u)), (0, 0, 0, 0)); ImageDraw.Draw(sh_layer).ellipse((4 * u, 3 * u, 36 * u, 13 * u), (40, 28, 18, 90))
        sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(2 * u)); im.paste(sh_layer, (int(cx - 20 * u), int(cy - 6 * u)), sh_layer)
        # 腿
        for dx in (-4.5, 4.5):
            dr.rounded_rectangle((cx + (dx - 3) * u, cy - 12 * u, cx + (dx + 3) * u, cy - 1 * u), radius=3 * u, fill=pants)
            dr.ellipse((cx + (dx - 3.6) * u, cy - 4 * u, cx + (dx + 3.6) * u, cy + 1 * u), shoe)
        # 身体 + 手臂
        dr.rounded_rectangle((cx - 11.5 * u, cy - 26 * u, cx + 11.5 * u, cy - 9 * u), radius=7 * u, fill=top)
        dr.rounded_rectangle((cx - 10 * u, cy - 26 * u, cx + 10 * u, cy - 20 * u), radius=6 * u, fill=sh(top, 18))
        for dx in (-12.5, 12.5):
            dr.rounded_rectangle((cx + (dx - 2.5) * u, cy - 24 * u, cx + (dx + 2.5) * u, cy - 12 * u), radius=2.5 * u, fill=top)
            dr.ellipse((cx + (dx - 2.5) * u, cy - 14 * u, cx + (dx + 2.5) * u, cy - 9 * u), skin)
        if cfg.get("acc") == "backpack":
            dr.rounded_rectangle((cx - 13 * u, cy - 25 * u, cx - 7 * u, cy - 13 * u), radius=3 * u, fill=cg((110, 80, 52)))
        # 头
        r = 15 * u; hc = cy - 34 * u
        dr.ellipse((cx - r, hc - r, cx + r, hc + r), skin)
        # 头发：上半圆 + 刘海
        dr.pieslice((cx - r * 1.05, hc - r * 1.1, cx + r * 1.05, hc + r * .9), 180, 360, fill=hair)
        for dx in (-9, -3, 3, 9):
            dr.ellipse((cx + (dx - 4) * u, hc - 12 * u, cx + (dx + 4) * u, hc - 2 * u), hair)
        if cfg.get("hair") == "bun":
            for dx in (-13, 13):
                dr.ellipse((cx + (dx - 4.5) * u, hc - 17 * u, cx + (dx + 4.5) * u, hc - 8 * u), hair)
        if cfg.get("hair") == "long":
            dr.rounded_rectangle((cx - r * 1.02, hc - 2 * u, cx - r * .55, hc + 14 * u), radius=4 * u, fill=hair)
            dr.rounded_rectangle((cx + r * .55, hc - 2 * u, cx + r * 1.02, hc + 14 * u), radius=4 * u, fill=hair)
        # 帽子
        if cfg.get("hat") == "cap":
            hat = cg(HATC[cfg["hatc"]])
            dr.pieslice((cx - r * 1.08, hc - r * 1.18, cx + r * 1.08, hc + r * .6), 180, 360, fill=hat)
            dr.rounded_rectangle((cx - r * .2, hc - r * .34, cx + r * 1.35, hc - r * .08), radius=3 * u, fill=sh(hat, -20))
        elif cfg.get("hat") == "beanie":
            hat = cg(HATC[cfg["hatc"]]); dr.pieslice((cx - r * 1.08, hc - r * 1.2, cx + r * 1.08, hc + r * .7), 180, 360, fill=hat); dr.rounded_rectangle((cx - r * 1.06, hc - r * .4, cx + r * 1.06, hc - r * .1), radius=2 * u, fill=sh(hat, -25))
        elif cfg.get("hat") == "straw":
            hat = cg(HATC[cfg["hatc"]]); dr.ellipse((cx - r * 1.7, hc - r * .55, cx + r * 1.7, hc - r * .05), hat); dr.pieslice((cx - r * .95, hc - r * 1.25, cx + r * .95, hc + r * .2), 180, 360, fill=sh(hat, 10))
        # 脸
        for dx in (-5.5, 5.5):
            dr.ellipse((cx + (dx - 2.6) * u, hc - 1.5 * u, cx + (dx + 2.6) * u, hc + 4.5 * u), (255, 255, 255))     # 眼白
            dr.ellipse((cx + (dx - 1.4) * u, hc + 0 * u, cx + (dx + 1.4) * u, hc + 4 * u), (44, 34, 32))              # 瞳孔
            dr.arc((cx + (dx - 3.2) * u, hc - 5.5 * u, cx + (dx + 3.2) * u, hc - 1.5 * u), 200, 340, fill=sh(hair, -10), width=max(1, int(1.1 * u)))  # 眉毛
            dr.ellipse((cx + (dx * 1.9 - 3) * u, hc + 5 * u, cx + (dx * 1.9 + 3) * u, hc + 8.5 * u), (240, 150, 150))
        dr.chord((cx - 4.5 * u, hc + 4 * u, cx + 4.5 * u, hc + 10 * u), 10, 170, fill=(150, 60, 62))                  # 张嘴笑
        dr.chord((cx - 3.2 * u, hc + 4.5 * u, cx + 3.2 * u, hc + 7 * u), 10, 170, fill=(255, 250, 244))                # 牙
        dr.ellipse((cx - 8 * u, hc - 12 * u, cx - 2 * u, hc - 8 * u), (255, 255, 255))   # 高光
        dr.arc((cx - r, hc - r, cx + r, hc + r), 300, 30, fill=(255, 236, 200), width=max(1, int(1.3 * u)))            # 轮廓光
        if cfg.get("acc") == "glasses":
            dr.rounded_rectangle((cx - 11 * u, hc - 1 * u, cx + 11 * u, hc + 5 * u), radius=3 * u, fill=(50, 44, 54))
        if cfg.get("acc") == "scarf":
            dr.rounded_rectangle((cx - 11 * u, cy - 29 * u, cx + 11 * u, cy - 23 * u), radius=3 * u, fill=cg((214, 70, 60)))

    for key, kind, data in objs:
        if kind == "box":
            for (x0, y0, x1, y1, z0, z1, base, top) in sorted(data, key=lambda b: (b[2] + b[3], b[4])):
                box(x0, y0, x1, y1, z0, z1, base, top)
        elif kind == "tree":
            tree(*data)
        elif kind == "hill":
            hill(*data)
        elif kind == "bamboo":
            bamboo(*data)
        elif kind == "hero":
            hero_cg(data[0], data[1], hero_cfg, hero_dir)
    # 地标旗（站点红、住宿蓝），供七天总览
    if decor:
        FLAGC = dict(place=(217, 99, 79), lodging=(77, 127, 192), airport=(120, 120, 130))
        for (kind, ax, ay, name, role) in scene["landmarks"]:
            if role in FLAGC:
                _, tz = rb.T(kind, ax, ay); fx, fy = Pq(ax + .5, ay + .5, tz)
                dr.line((fx, fy - 14 * S, fx, fy), fill=(74, 60, 52), width=max(1, S))
                dr.polygon([(fx + S, fy - 14 * S), (fx + 9 * S, fy - 11.5 * S), (fx + S, fy - 9 * S)], FLAGC[role])
    # 路线：柔和的点线
    if decor:
        for (x, y) in path:
            cx, cy = Pq(x + .5, y + .5)
            dr.ellipse((cx - 2.2 * S, cy - 1.6 * S, cx + 2.2 * S, cy + 1.6 * S), (255, 255, 255))
            dr.ellipse((cx - 1.5 * S, cy - 1.0 * S, cx + 1.5 * S, cy + 1.0 * S), (236, 172, 60))

    # ---- 缩回 1×，再做后期 ----
    out = im.resize((rb.PW, rb.PH), Image.LANCZOS)
    out = ImageEnhance.Contrast(out).enhance(PAL["contrast"])
    # 分级：高光偏某色、阴影偏某色（用亮度做 mask 混两层）
    lum = out.convert("L")
    warm = Image.blend(out, Image.new("RGB", out.size, PAL["warm"][0]), PAL["warm"][1])
    cool = Image.blend(out, Image.new("RGB", out.size, PAL["cool"][0]), PAL["cool"][1])
    out = Image.composite(warm, cool, lum.point(lambda v: min(255, int(v * 1.4))))
    # 纸纹 / 绘画质感
    rnd = random.Random(7); noise = Image.effect_noise(out.size, 18).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.blend(out, Image.merge("RGB", (noise, noise, noise)), PAL["noise"])
    if not post:
        return out
    # 移轴景深
    blur = out.filter(ImageFilter.GaussianBlur(2.2))
    mask = Image.new("L", out.size, 0); md = ImageDraw.Draw(mask)
    for y in range(out.height):
        t = y / out.height; a = 0
        if t < .26: a = int(255 * (1 - t / .26) ** 1.6)
        elif t > .74: a = int(255 * ((t - .74) / .26) ** 1.6)
        md.line((0, y, out.width, y), a)
    out = Image.composite(blur, out, mask)
    # 暗角
    vig = Image.new("L", out.size, 0); vd = ImageDraw.Draw(vig)
    vd.ellipse((-out.width * .25, -out.height * .35, out.width * 1.25, out.height * 1.35), 255)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    out = Image.composite(out, Image.blend(out, Image.new("RGB", out.size, PAL["vignette"][0]), PAL["vignette"][1]), vig)
    # 站点标牌（现代卡片）
    if decor and stops:
        d2 = ImageDraw.Draw(out); f = ImageFont.truetype(FONT, 13); fb = ImageFont.truetype(FONT, 13)
        lmz = {}
        for (kind, ax, ay, name, role) in scene["landmarks"]:
            lmz[(ax, ay)] = rb.T(kind, ax, ay)[1]
        for i, st in enumerate(stops):
            x, y = rb.P(st["x"] + .5, st["y"] + .5, lmz.get((st["x"], st["y"]), 0))
            txt = f"{i + 1}  {st.get('time', '')}  {st['short']}"; w = d2.textlength(txt, font=f) + 16
            x0, y0 = int(x - w / 2 + 6), int(y - 40)
            shadow2 = Image.new("RGBA", out.size, (0, 0, 0, 0)); ImageDraw.Draw(shadow2).rounded_rectangle((x0, y0 + 3, x0 + w, y0 + 25), radius=11, fill=(40, 28, 18, 70))
            out.paste(Image.alpha_composite(Image.new("RGBA", out.size, (0, 0, 0, 0)), shadow2.filter(ImageFilter.GaussianBlur(4))).convert("RGB"), (0, 0), shadow2.filter(ImageFilter.GaussianBlur(4)))
            d2 = ImageDraw.Draw(out)
            d2.rounded_rectangle((x0, y0, x0 + w, y0 + 22), radius=11, fill=(255, 252, 247))
            d2.ellipse((x0 + 4, y0 + 3, x0 + 20, y0 + 19), fill=(217, 99, 79)); d2.text((x0 + 9, y0 + 3), str(i + 1), (255, 255, 255), font=fb)
            d2.text((x0 + 26, y0 + 3), f"{st.get('time', '')}  {st['short']}", (43, 38, 36), font=f)
    return out


def modernize(im):
    """现代像素：对经典像素图做分级、纸纹、移轴、暗角、红叶（对应原型里的「现代」开关）"""
    out = ImageEnhance.Color(im).enhance(0.84); out = ImageEnhance.Contrast(out).enhance(0.94); out = ImageEnhance.Brightness(out).enhance(1.04)
    out = Image.blend(out, Image.new("RGB", out.size, (255, 190, 130)), 0.08)
    blur = out.filter(ImageFilter.GaussianBlur(2.0)); mask = Image.new("L", out.size, 0); md = ImageDraw.Draw(mask)
    for y in range(out.height):
        t = y / out.height; a = 0
        if t < .26: a = int(255 * (1 - t / .26) ** 1.6)
        elif t > .74: a = int(255 * ((t - .74) / .26) ** 1.6)
        md.line((0, y, out.width, y), a)
    out = Image.composite(blur, out, mask)
    vig = Image.new("L", out.size, 0); ImageDraw.Draw(vig).ellipse((-out.width * .25, -out.height * .35, out.width * 1.25, out.height * 1.35), 255); vig = vig.filter(ImageFilter.GaussianBlur(120))
    out = Image.composite(out, Image.blend(out, Image.new("RGB", out.size, (60, 40, 26)), 0.30), vig)
    d = ImageDraw.Draw(out); rnd = random.Random(3)
    for _ in range(40):
        x, y = rnd.randrange(out.width), rnd.randrange(out.height); s = rnd.choice((2, 3, 3, 4))
        d.rectangle((x, y, x + s, y + s - 1), rnd.choice(((217, 99, 79), (224, 138, 74), (201, 75, 60), (240, 178, 90))))
    return out


def hero_card(kind, cfg, size=(200, 230)):
    """三种画风的小人卡片"""
    im = Image.new("RGB", size, (246, 240, 226)); dr = ImageDraw.Draw(im)
    if kind in ("pixel", "modern"):
        sp = up(px_sprite(cfg, "front", 0), 8)
        if kind == "modern":
            sh_layer = Image.new("RGBA", size, (0, 0, 0, 0)); ImageDraw.Draw(sh_layer).ellipse((50, 180, 150, 200), (40, 28, 18, 70)); sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(5)); im.paste(sh_layer, (0, 0), sh_layer)
        im.paste(sp, ((size[0] - sp.width) // 2, 24), sp)
        if kind == "modern":
            im = Image.blend(im, Image.new("RGB", size, (255, 190, 130)), 0.06)
    else:
        big = Image.new("RGB", (size[0] * S, size[1] * S), (246, 240, 226))
        # 借用 render_scene_cg 的小人画法：临时构造一个只画小人的场景很绕，这里直接复刻
        drb = ImageDraw.Draw(big); u = S * 2.6; cx, cy = size[0] * S // 2, size[1] * S - 22 * S
        skin, hair, top, pants, shoe = cg(SKIN[cfg["skin"]]), cg(HAIRC[cfg["hairc"]]), cg(TOPC[cfg["top"]]), cg(PANTC[cfg["pants"]]), cg(SHOEC[cfg["shoes"]])
        shl = Image.new("RGBA", big.size, (0, 0, 0, 0)); ImageDraw.Draw(shl).ellipse((cx - 22 * u, cy - 5 * u, cx + 22 * u, cy + 5 * u), (40, 28, 18, 80)); shl = shl.filter(ImageFilter.GaussianBlur(3 * u)); big.paste(shl, (0, 0), shl); drb = ImageDraw.Draw(big)
        for dx in (-4.5, 4.5):
            drb.rounded_rectangle((cx + (dx - 3) * u, cy - 12 * u, cx + (dx + 3) * u, cy - 1 * u), radius=3 * u, fill=pants)
            drb.ellipse((cx + (dx - 3.6) * u, cy - 4 * u, cx + (dx + 3.6) * u, cy + 1 * u), shoe)
        drb.rounded_rectangle((cx - 11.5 * u, cy - 26 * u, cx + 11.5 * u, cy - 9 * u), radius=7 * u, fill=top)
        drb.rounded_rectangle((cx - 10 * u, cy - 26 * u, cx + 10 * u, cy - 20 * u), radius=6 * u, fill=sh(top, 18))
        for dx in (-12.5, 12.5):
            drb.rounded_rectangle((cx + (dx - 2.5) * u, cy - 24 * u, cx + (dx + 2.5) * u, cy - 12 * u), radius=2.5 * u, fill=top)
            drb.ellipse((cx + (dx - 2.5) * u, cy - 14 * u, cx + (dx + 2.5) * u, cy - 9 * u), skin)
        if cfg.get("acc") == "backpack":
            drb.rounded_rectangle((cx - 13.5 * u, cy - 25 * u, cx - 8 * u, cy - 13 * u), radius=3 * u, fill=cg((110, 80, 52)))
        r = 15 * u; hc = cy - 34 * u
        drb.ellipse((cx - r, hc - r, cx + r, hc + r), skin)
        drb.pieslice((cx - r * 1.05, hc - r * 1.1, cx + r * 1.05, hc + r * .9), 180, 360, fill=hair)
        for dx in (-9, -3, 3, 9):
            drb.ellipse((cx + (dx - 4) * u, hc - 12 * u, cx + (dx + 4) * u, hc - 2 * u), hair)
        if cfg.get("hair") == "bun":
            for dx in (-13, 13):
                drb.ellipse((cx + (dx - 4.5) * u, hc - 17 * u, cx + (dx + 4.5) * u, hc - 8 * u), hair)
        if cfg.get("hat") == "cap":
            hat = cg(HATC[cfg["hatc"]]); drb.pieslice((cx - r * 1.08, hc - r * 1.18, cx + r * 1.08, hc + r * .6), 180, 360, fill=hat); drb.rounded_rectangle((cx - r * .2, hc - r * .34, cx + r * 1.35, hc - r * .08), radius=3 * u, fill=sh(hat, -20))
        for dx in (-5.5, 5.5):
            drb.ellipse((cx + (dx - 2.6) * u, hc - 1.5 * u, cx + (dx + 2.6) * u, hc + 4.5 * u), (255, 255, 255))     # 眼白
            drb.ellipse((cx + (dx - 1.4) * u, hc + 0 * u, cx + (dx + 1.4) * u, hc + 4 * u), (44, 34, 32))              # 瞳孔
            drb.arc((cx + (dx - 3.2) * u, hc - 5.5 * u, cx + (dx + 3.2) * u, hc - 1.5 * u), 200, 340, fill=sh(hair, -10), width=max(1, int(1.1 * u)))  # 眉毛
            drb.ellipse((cx + (dx * 1.9 - 3) * u, hc + 5 * u, cx + (dx * 1.9 + 3) * u, hc + 8.5 * u), (240, 150, 150))
        drb.chord((cx - 4.5 * u, hc + 4 * u, cx + 4.5 * u, hc + 10 * u), 10, 170, fill=(150, 60, 62))                  # 张嘴笑
        drb.chord((cx - 3.2 * u, hc + 4.5 * u, cx + 3.2 * u, hc + 7 * u), 10, 170, fill=(255, 250, 244))                # 牙
        drb.ellipse((cx - 8 * u, hc - 12 * u, cx - 2 * u, hc - 8 * u), (255, 255, 255))   # 高光
        drb.arc((cx - r, hc - r, cx + r, hc + r), 300, 30, fill=(255, 236, 200), width=max(1, int(1.3 * u)))            # 轮廓光
        im = big.resize(size, Image.LANCZOS)
        im = Image.blend(im, Image.new("RGB", size, (255, 196, 140)), 0.05)
    return im


def compare():
    sc = rb.SCENES["kyoto"]; d = rb.TRIP["days"][2]
    cfg = dict(skin=1, hair="bun", hairc=0, top=0, pants=0, shoes=0, hat="cap", hatc=0, acc="backpack")
    # 站点（给 CG 图挂标牌）
    stops = []
    for e in d["entries"]:
        if e[0] == "place":
            for (kind, ax, ay, name, role) in sc["landmarks"]:
                if name and role in ("place", "airport") and (name in e[1] or e[1] in name):
                    stops.append(dict(short=name, x=ax, y=ay, time=e[2] if len(e) > 2 else "")); break
    A = rb.render_scene(sc, path=d["path"], hero=d["hero"], hero_cfg=cfg, hero_dir=d["hero_dir"])
    B = modernize(A)
    Cc = render_scene_cg(sc, path=d["path"], hero=d["hero"], hero_cfg=cfg, hero_dir=d["hero_dir"], stops=stops)
    f_t = ImageFont.truetype(FONT, 40); f_l = ImageFont.truetype(FONT, 26); f_n = ImageFont.truetype(FONT, 20)
    pad, gap, top = 36, 30, 130
    pw, ph = A.size; W = pad * 2 + pw * 3 + gap * 2; H = top + ph + 40 + 90 + 240 + pad
    out = Image.new("RGB", (W, H), (246, 240, 226)); dr = ImageDraw.Draw(out); ink = (52, 44, 46); grey = (110, 100, 96)
    dr.text((pad, 24), "同一块底板 · 三种画风（京都 · 东山一日）", ink, font=f_t)
    dr.text((pad, 80), "A 经典像素：高饱和、硬边、点阵；B 现代像素：同一套素材 + 暖色分级、移轴景深、暗角、粒子、圆角标牌；C 风格化 3D CG：抗锯齿、软投影、面上受光、球形树、圆润小人、绘画质感", grey, font=f_n)
    labels = [("A · 经典像素", "8 / 16 位机的味道；游戏感强，年代感也强"), ("B · 现代像素", "像素只当笔触；hi-bit 治愈系 + HD-2D 的路线"), ("C · 风格化 3D CG", "《潜水员戴夫》新画风那一路；玩具模型、动画电影质感")]
    heroes = ["pixel", "modern", "cg"]
    for i, img in enumerate((A, B, Cc)):
        x = pad + i * (pw + gap); y = top
        dr.rounded_rectangle((x - 4, y - 4, x + pw + 3, y + ph + 3), radius=8, outline=ink, width=2)
        out.paste(img, (x, y))
        dr.text((x, y + ph + 16), labels[i][0], ink, font=f_l)
        dr.text((x, y + ph + 52), labels[i][1], grey, font=f_n)
        hc = hero_card(heroes[i], cfg)
        out.paste(hc, (x, y + ph + 96))
        dr.text((x + 216, y + ph + 110), "小人", grey, font=f_n)
        dr.text((x + 216, y + ph + 140), {"pixel": "16 × 20 px 精灵", "modern": "同一精灵 + 软阴影 + 暖调", "cg": "圆润卡通比例，软阴影，无描边"}[heroes[i]], grey, font=f_n)
    p = os.path.join(HERE, "画风对比_像素_vs_3DCG.png"); out.save(p); print("saved", p, out.size)


if __name__ == "__main__":
    compare()


def book_cg():
    """用 CG 渲染器出七天一本书（复用 render_trip_book 的面板与封面排版）"""
    orig = rb.render_scene
    rb.render_scene = lambda scene, path=(), hero=None, hero_cfg=None, hero_dir="front", decor=True: render_scene_cg(scene, path=path, hero=hero, hero_cfg=hero_cfg, hero_dir=hero_dir, decor=decor)
    try:
        panels = [rb.day_panel(i, d) for i, d in enumerate(rb.TRIP["days"])]
    finally:
        rb.render_scene = orig
    pw, ph = panels[0].size
    cover = rb.cover_panel((pw, ph))
    # 封面小人换成 CG 版
    hc = hero_card("cg", rb.HERO_CFG, size=(200, 230)); cover.paste(hc.crop((40, 20, 160, 210)), (pw // 2 - 60, 300))
    tiles = [cover] + panels
    gap, pad, top = 28, 36, 130
    W = pad * 2 + pw * 4 + gap * 3; H = top + ph * 2 + gap + pad
    im = Image.new("RGB", (W, H), (246, 240, 226)); dr = ImageDraw.Draw(im)
    f_t = ImageFont.truetype(FONT, 44); f_n = ImageFont.truetype(FONT, 22)
    dr.text((pad, 24), "关西七日 · 一本书的样子（世界风 CG · 参照《潜水员戴夫》新画风）", (52, 44, 46), font=f_t)
    dr.text((pad, 84), "同一份行程数据，渲染换成风格化 3D CG：抗锯齿、软投影、面上受光与轮廓光、球形树、电影感分级、移轴景深。旗：红 = 站点，蓝 = 住宿；黄点 = 路线；小人停在当天某一站。", (110, 100, 96), font=f_n)
    for k, t in enumerate(tiles):
        x = pad + (k % 4) * (pw + gap); y = top + (k // 4) * (ph + gap)
        dr.rounded_rectangle((x - 4, y - 4, x + pw + 3, y + ph + 3), radius=10, outline=(52, 44, 46), width=2)
        im.paste(t, (x, y))
    p = os.path.join(HERE, "关西七日_一本书_CG.png"); im.save(p); print("saved", p, im.size)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "book":
    book_cg()


def palette_compare():
    """同一块底板三种色调并排"""
    sc = rb.SCENES["kyoto"]; d = rb.TRIP["days"][2]
    cfg = dict(skin=1, hair="bun", hairc=0, top=0, pants=0, shoes=0, hat="cap", hatc=0, acc="backpack")
    panels = []
    for key in ("sea", "warm", "dusk"):
        panels.append((key, render_scene_cg(sc, path=d["path"], hero=d["hero"], hero_cfg=cfg, hero_dir=d["hero_dir"], palette=key)))
    set_palette("sea")
    f_t = ImageFont.truetype(FONT, 40); f_l = ImageFont.truetype(FONT, 26); f_n = ImageFont.truetype(FONT, 20)
    pad, gap, top = 36, 30, 120
    pw, ph = panels[0][1].size; W = pad * 2 + pw * 3 + gap * 2; H = top + ph + 110
    out = Image.new("RGB", (W, H), (240, 244, 248)); dr = ImageDraw.Draw(out)
    dr.text((pad, 24), "整体色调 · 三选一（同一块京都底板，世界风 CG）", (31, 42, 55), font=f_t)
    dr.text((pad, 76), "清朗海天：天蓝背景、青绿水面、鲜绿植被、白色路网，参照《潜水员戴夫》新画风的海天；暖阳纸张：之前的暖黄调；暮色琥珀：黄昏的橙紫。", (91, 107, 124), font=f_n)
    notes = {"sea": ("A · 清朗海天（新默认）", "冷调底 + 暖色点缀，干净、精神；高光偏暖、阴影偏蓝"), "warm": ("B · 暖阳纸张（原来的）", "纸张感、偏复古；你不喜欢的这一版留作对照"), "dusk": ("C · 暮色琥珀", "黄昏氛围，适合夜景与日记回顾页")}
    for i, (key, img) in enumerate(panels):
        x = pad + i * (pw + gap); y = top
        dr.rounded_rectangle((x - 4, y - 4, x + pw + 3, y + ph + 3), radius=10, outline=(31, 42, 55), width=2)
        out.paste(img, (x, y))
        dr.text((x, y + ph + 14), notes[key][0], (31, 42, 55), font=f_l)
        dr.text((x, y + ph + 50), notes[key][1], (91, 107, 124), font=f_n)
    p = os.path.join(HERE, "色调对比.png"); out.save(p); print("saved", p, out.size)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "palette":
    palette_compare()
