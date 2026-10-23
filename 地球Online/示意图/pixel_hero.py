#!/usr/bin/env python3
"""像素小人：形象、自定义槽位、四方向行走帧，以及「沿路线走」的动画。
16 × 20 px，大头、极简五官（两点眼 + 腮红）、圆钝轮廓；所有部件是可换色的图层。
不复制任何现有 IP 的造型。

  python3 pixel_hero.py sheet   → 像素小人_设定图.png
  python3 pixel_hero.py walk    → 像素小人_京都路线.gif
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/opentype/unifont/unifont.otf"
W, H = 16, 20

# ---------------- 图层（'.' 透明；字母 = 槽位） ----------------
# S 皮肤  e 眼睛  b 腮红  T 上衣  h 手  P 下装  F 鞋  H 头发  C 帽子  c 帽带  G 眼镜  R 围巾  K 背包  L 相机镜头
BODY = {
"front": [
"................", "................", "................",
"...SSSSSSSSSS...", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "..SSSeSSSSeSSS..",
"..SSSSSSSSSSSS..", "..SbSSSSSSSSbS..", "...SSSSSSSSSS...", "....SSSSSSSS....",
"...TTTTTTTTTT...", "..TTTTTTTTTTTT..", "..TTTTTTTTTTTT..", "..hhTTTTTTTThh..",
"....PPPPPPPP....", "....PPPPPPPP....", "....PPP..PPP....", "....PPP..PPP....", "....FFF..FFF...."],
"back": [
"................", "................", "................",
"...SSSSSSSSSS...", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..",
"..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "...SSSSSSSSSS...", "....SSSSSSSS....",
"...TTTTTTTTTT...", "..TTTTTTTTTTTT..", "..TTTTTTTTTTTT..", "..hhTTTTTTTThh..",
"....PPPPPPPP....", "....PPPPPPPP....", "....PPP..PPP....", "....PPP..PPP....", "....FFF..FFF...."],
"right": [
"................", "................", "................",
"....SSSSSSSSS...", "...SSSSSSSSSSS..", "...SSSSSSSSSSS..", "...SSSSSSSSeSS..",
"...SSSSSSSSSSS..", "...SSSSSSSSSbS..", "....SSSSSSSSS...", ".....SSSSSSS....",
".....TTTTTTT....", "....TTTTTTTT....", "....TTTTTTTT....", "....TTTThhTT....",
".....PPPPPP.....", ".....PPPPPP.....", ".....PPPPPP.....", ".....PPPPPP.....", ".....FFFFFF....."],
}
# 行走帧：只替换腿的三行（17–19），第 2 帧整体上抬 1 px
LEGS = {
"front": [["....PPP..PPP....", "....PPP..PPP....", "....FFF..FFF...."],
          ["...PPP....PPP...", "...PPP....PPP...", "...FFF....FFF..."],
          ["....PPP..PPP....", "....PPP..PPP....", "....FFF..FFF...."],
          ["....PPP..PPP....", "...PPP....PPP...", "...FFF....FFF..."]],
"right": [[".....PPPPPP.....", ".....PPPPPP.....", ".....FFFFFF....."],
          [".....PPPPPP.....", "....PPP..PPP....", "....FFF...FFF..."],
          [".....PPPPPP.....", "......PPPP......", "......FFFF......"],
          [".....PPPPPP.....", "....PPP..PPP....", "...FFF....FFF..."]],
}
LEGS["back"] = LEGS["front"]
BOB = [0, 0, -1, 0]

HAIR = {
"short": {"front": {0: "....HHHHHHHH....", 1: "...HHHHHHHHHH...", 2: "..HHHHHHHHHHHH..", 3: "..HHHHHHHHHHHH..", 4: "..HH........HH.."},
          "back":  {0: "....HHHHHHHH....", 1: "...HHHHHHHHHH...", 2: "..HHHHHHHHHHHH..", 3: "..HHHHHHHHHHHH..", 4: "..HHHHHHHHHHHH..", 5: "..HHHHHHHHHHHH..", 6: "...HHHHHHHHHH..."},
          "right": {0: ".....HHHHHHH....", 1: "....HHHHHHHHH...", 2: "...HHHHHHHHHHH..", 3: "...HHHHHHHHHH...", 4: "...HHH..........", 5: "...HH...........", 6: "...HH..........."}},
"long":  {"front": {0: "....HHHHHHHH....", 1: "...HHHHHHHHHH...", 2: "..HHHHHHHHHHHH..", 3: "..HHHHHHHHHHHH..", 4: "..HH........HH..", 5: "..HH........HH..", 6: "..HH........HH..", 7: "..HH........HH..", 8: "..HH........HH..", 9: "..HH........HH..", 10: "...HH......HH..."},
          "back":  {i: ("....HHHHHHHH...." if i == 0 else "...HHHHHHHHHH..." if i in (1, 10) else "..HHHHHHHHHHHH..") for i in range(0, 11)},
          "right": {0: ".....HHHHHHH....", 1: "....HHHHHHHHH...", 2: "...HHHHHHHHHHH..", 3: "...HHHHHHHHHH...", 4: "..HHHH..........", 5: "..HHH...........", 6: "..HHH...........", 7: "..HHH...........", 8: "..HHH...........", 9: "..HHH...........", 10: "...HH..........."}},
"bun":   {"front": {0: ".HHH........HHH.", 1: ".HHHHHHHHHHHHHH.", 2: "..HHHHHHHHHHHH..", 3: "..HHHHHHHHHHHH..", 4: "..HH........HH.."},
          "back":  {0: ".HHH........HHH.", 1: ".HHHHHHHHHHHHHH.", 2: "..HHHHHHHHHHHH..", 3: "..HHHHHHHHHHHH..", 4: "..HHHHHHHHHHHH..", 5: "..HHHHHHHHHHHH..", 6: "...HHHHHHHHHH..."},
          "right": {0: "..HHH...........", 1: "..HHHHHHHHHHH...", 2: "...HHHHHHHHHHH..", 3: "...HHHHHHHHHH...", 4: "...HHH..........", 5: "...HH..........."}},
"curly": {"front": {0: "...HHHHHHHHHH...", 1: "..HHHHHHHHHHHH..", 2: ".HHHHHHHHHHHHHH.", 3: ".HHHHHHHHHHHHHH.", 4: ".HHH........HHH.", 5: "..HH........HH.."},
          "back":  {0: "...HHHHHHHHHH...", 1: "..HHHHHHHHHHHH..", 2: ".HHHHHHHHHHHHHH.", 3: ".HHHHHHHHHHHHHH.", 4: ".HHHHHHHHHHHHHH.", 5: "..HHHHHHHHHHHH..", 6: "..HHHHHHHHHHHH..", 7: "...HHHHHHHHHH..."},
          "right": {0: "....HHHHHHHHH...", 1: "...HHHHHHHHHHH..", 2: "..HHHHHHHHHHHHH.", 3: "..HHHHHHHHHHHH..", 4: "..HHHH..........", 5: "..HHH...........", 6: "...HH..........."}},
}
HAT = {
"none":   {"front": {}, "back": {}, "right": {}},
"cap":    {"front": {1: "...CCCCCCCCCC...", 2: "..CCCCCCCCCCCC..", 3: ".CCCCCCCCCCCCCC."},
           "back":  {1: "...CCCCCCCCCC...", 2: "..CCCCCCCCCCCC..", 3: "..CCCCCCCCCCCC.."},
           "right": {1: "....CCCCCCCCC...", 2: "...CCCCCCCCCCC..", 3: "...CCCCCCCCCCCCC"}},
"beanie": {"front": {0: "....CCCCCCCC....", 1: "...CCCCCCCCCC...", 2: "..CCCCCCCCCCCC..", 3: "..cccccccccccc.."},
           "back":  {0: "....CCCCCCCC....", 1: "...CCCCCCCCCC...", 2: "..CCCCCCCCCCCC..", 3: "..cccccccccccc.."},
           "right": {0: ".....CCCCCCC....", 1: "....CCCCCCCCC...", 2: "...CCCCCCCCCCC..", 3: "...ccccccccccc.."}},
"straw":  {"front": {1: "....CCCCCCCC....", 2: "....CCCCCCCC....", 3: "CCCCCCCCCCCCCCCC"},
           "back":  {1: "....CCCCCCCC....", 2: "....CCCCCCCC....", 3: "CCCCCCCCCCCCCCCC"},
           "right": {1: ".....CCCCCCC....", 2: ".....CCCCCCC....", 3: ".CCCCCCCCCCCCCCC"}},
}
ACC = {
"none":     {"front": {}, "back": {}, "right": {}},
"glasses":  {"front": {6: "..GGGeGGGGeGGG.."}, "back": {}, "right": {6: "........GGGeGG.."}},
"scarf":    {"front": {10: "...RRRRRRRRRR...", 11: "..RRRRRRRRRRRR..", 12: "....RR..........", 13: "....RR.........."},
             "back":  {10: "...RRRRRRRRRR...", 11: "..RRRRRRRRRRRR.."},
             "right": {10: "....RRRRRRRRR...", 11: "....RRRRRRRRR...", 12: "........RR......", 13: "........RR......"}},
"camera":   {"front": {12: "......KKKK......", 13: "......KLLK......"}, "back": {}, "right": {12: "........KKK.....", 13: "........KLK....."}},
"backpack": {"front": {11: "...K........K...", 12: "...K........K...", 13: "...K........K..."},
             "back":  {11: "....KKKKKKKK....", 12: "...KKKKKKKKKK...", 13: "...KKKKKKKKKK...", 14: "...KKKKKKKKKK...", 15: "....KKKKKKKK...."},
             "right": {11: "..KK............", 12: ".KKK............", 13: ".KKK............", 14: "..KK............"}},
}
# 图层顺序（后画的盖前面的）
ORDER = {
    "front": ["body", "top", "acc", "hair", "hat"],
    "right": ["acc_back", "body", "top", "acc", "hair", "hat"],
    "back":  ["body", "top", "acc", "hair", "hat"],
}

# ---------------- 色板 ----------------
SKIN = [(252, 220, 190), (238, 196, 158), (216, 164, 122), (178, 122, 86), (128, 84, 58)]
HAIRC = [(44, 34, 32), (98, 62, 42), (176, 118, 68), (232, 196, 118), (128, 128, 140), (204, 78, 66), (90, 120, 170)]
TOPC = [(64, 122, 204), (222, 84, 74), (240, 196, 70), (92, 170, 108), (236, 236, 228), (70, 66, 76), (238, 150, 180), (150, 110, 180)]
PANTC = [(44, 54, 84), (98, 74, 56), (200, 190, 170), (60, 60, 64), (120, 150, 180), (150, 60, 60)]
SHOEC = [(50, 40, 40), (236, 236, 228), (150, 90, 50)]
HATC = [(210, 62, 50), (44, 54, 84), (236, 210, 130), (80, 140, 90), (240, 240, 232)]
EYE = (40, 30, 30); BLUSH = (244, 150, 150); GLASS = (50, 44, 54); SCARF = (214, 70, 60); PACK = (110, 80, 52); LENS = (120, 200, 240)

DEFAULT = dict(skin=1, hair="short", hairc=0, top=0, pants=0, shoes=0, hat="none", hatc=0, acc="none")


def colors(cfg):
    hc = HATC[cfg["hatc"]]
    return {"S": SKIN[cfg["skin"]], "h": SKIN[cfg["skin"]], "e": EYE, "b": BLUSH,
            "T": TOPC[cfg["top"]], "P": PANTC[cfg["pants"]], "F": SHOEC[cfg["shoes"]],
            "H": HAIRC[cfg["hairc"]], "C": hc, "c": tuple(max(0, v - 40) for v in hc),
            "G": GLASS, "R": SCARF, "K": PACK, "L": LENS}


def sprite(cfg, direction="front", frame=0):
    """返回 16×20 的 RGBA 图；direction ∈ front/back/right/left（left = right 镜像）"""
    mirror = direction == "left"
    d = "right" if mirror else direction
    col = colors(cfg)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    rows = list(BODY[d])
    for i, r in enumerate(LEGS[d][frame]):
        rows[17 + i] = r
    layers = []
    for name in ORDER[d]:
        if name == "body":
            layers.append({i: r for i, r in enumerate(rows)})
        elif name == "top":
            pass  # 上衣已在 body 行里（T/h/P/F），这里不再单独画
        elif name == "acc":
            layers.append(ACC[cfg["acc"]][d] if cfg["acc"] != "backpack" or d != "right" else {})
        elif name == "acc_back":
            layers.append(ACC[cfg["acc"]][d] if cfg["acc"] == "backpack" else {})
        elif name == "hair":
            layers.append(HAIR[cfg["hair"]][d])
        elif name == "hat":
            layers.append(HAT[cfg["hat"]][d])
    for layer in layers:
        for y, row in layer.items():
            for x, ch in enumerate(row):
                if ch != ".":
                    if ch == "e" and cfg["acc"] == "glasses":
                        px[x, y] = (*col["e"], 255)
                    else:
                        px[x, y] = (*col[ch], 255)
    if BOB[frame]:
        shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shifted.paste(im, (0, BOB[frame]))
        im = shifted
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def text(dr, x, y, s, size=16, col=(46, 38, 40)):
    dr.text((x, y), s, col, font=ImageFont.truetype(FONT, size))


# =====================================================================
# 设定图
# =====================================================================
def sheet():
    K = 4                       # 放大倍率
    SW, SH = W * K, H * K       # 64 × 80
    out = Image.new("RGB", (1500, 1160), (246, 240, 226))
    dr = ImageDraw.Draw(out)
    ink = (52, 44, 46); grey = (110, 100, 96)
    text(dr, 36, 24, "像素小人 · 形象与自定义（v0.1）", 48)
    text(dr, 36, 84, "16 × 20 px；大头、两点眼 + 腮红、圆钝轮廓；每个部件是可换色的图层；不复制任何现有 IP 的造型", 24, grey)

    def paste(im, x, y):
        out.paste(im, (x, y), im)

    # ---- 第一行：四方向 × 四帧 ----
    y0 = 140
    text(dr, 36, y0, "四方向 × 四帧行走（同一套配置）", 28)
    cfg = dict(DEFAULT)
    for di, (d, name) in enumerate([("front", "正面"), ("right", "右"), ("back", "背面"), ("left", "左")]):
        x0 = 36 + di * 350
        text(dr, x0, y0 + 40, name, 24, grey)
        for f in range(4):
            paste(up(sprite(cfg, d, f), K), x0 + f * (SW + 12), y0 + 72)
    # ---- 第二行：槽位 ----
    y1 = 400
    text(dr, 36, y1, "自定义槽位", 28)
    x = 36
    text(dr, x, y1 + 40, "发型 ×4", 24, grey)
    for i, hs in enumerate(["short", "long", "bun", "curly"]):
        c = dict(DEFAULT, hair=hs); paste(up(sprite(c), K), x + i * (SW + 8), y1 + 72)
    x = 36 + 4 * (SW + 8) + 40
    text(dr, x, y1 + 40, "帽子 ×3", 24, grey)
    for i, ht in enumerate(["cap", "beanie", "straw"]):
        c = dict(DEFAULT, hat=ht, hatc=i); paste(up(sprite(c), K), x + i * (SW + 8), y1 + 72)
    x += 3 * (SW + 8) + 40
    text(dr, x, y1 + 40, "配件 ×4", 24, grey)
    for i, ac in enumerate(["glasses", "scarf", "camera", "backpack"]):
        c = dict(DEFAULT, acc=ac); paste(up(sprite(c), K), x + i * (SW + 8), y1 + 72)
    x += 4 * (SW + 8) + 40
    text(dr, x, y1 + 40, "背包（背面 / 侧面）", 24, grey)
    c = dict(DEFAULT, acc="backpack")
    paste(up(sprite(c, "back"), K), x, y1 + 72); paste(up(sprite(c, "right"), K), x + SW + 8, y1 + 72)
    # 色板条
    y2 = y1 + 72 + SH + 24
    for i, (nm, pal) in enumerate([("肤色", SKIN), ("发色", HAIRC), ("上衣", TOPC), ("下装", PANTC), ("鞋", SHOEC), ("帽子", HATC)]):
        xx = 36 + i * 240
        text(dr, xx, y2, nm, 22, grey)
        for j, cc in enumerate(pal):
            dr.rectangle((xx + j * 26, y2 + 30, xx + j * 26 + 22, y2 + 52), cc, outline=ink)
    # ---- 第三行：六个旅行者 ----
    y3 = y2 + 110
    text(dr, 36, y3, "六个旅行者（组合示例）", 28)
    combos = [
        ("默认", dict(DEFAULT)),
        ("背包客", dict(skin=2, hair="short", hairc=1, top=3, pants=1, shoes=2, hat="cap", hatc=1, acc="backpack")),
        ("度假", dict(skin=0, hair="long", hairc=3, top=6, pants=2, shoes=1, hat="straw", hatc=2, acc="none")),
        ("摄影师", dict(skin=1, hair="bun", hairc=0, top=5, pants=3, shoes=0, hat="none", hatc=0, acc="camera")),
        ("冬日", dict(skin=3, hair="curly", hairc=0, top=1, pants=0, shoes=0, hat="beanie", hatc=0, acc="scarf")),
        ("城市漫游", dict(skin=4, hair="short", hairc=4, top=7, pants=4, shoes=1, hat="none", hatc=0, acc="glasses")),
    ]
    for i, (nm, c) in enumerate(combos):
        xx = 36 + i * 240
        paste(up(sprite(c, "front"), K), xx, y3 + 44)
        paste(up(sprite(c, "right", 1), K), xx + SW + 10, y3 + 44)
        text(dr, xx, y3 + 44 + SH + 8, nm, 24, grey)
    text(dr, 36, 1100, "槽位：肤色 5 · 发型 4 × 发色 7 · 上衣 8 色 · 下装 6 色 · 鞋 3 色 · 帽子 3 款 × 5 色 · 配件 4；后续通过旅行解锁新款", 22, grey)
    p = os.path.join(HERE, "像素小人_设定图.png"); out.save(p); print("saved", p, out.size)


# =====================================================================
# 沿路线走的动画
# =====================================================================
def walk():
    sys.path.insert(0, HERE)
    import render_city_scale as city
    city.DRAW_HERO = False
    K = 2
    base = up(city.render_dimetric().convert("RGB"), K)
    pts = [tuple(v * K for v in city.P_B(x + .5, y + .5)) for (x, y) in city.PATH]
    cells = city.PATH
    rails = city.HRAILS | city.VRAILS
    gion_i = cells.index((34, 17))
    sites = {cells.index((33, 26)): "伏见稻荷", cells.index((36, 21)): "清水寺", gion_i: "祇园", len(cells) - 1: "金阁寺"}

    def mode(i):
        if cells[i] in rails:
            return "rail"
        if i > gion_i:
            return "bus"
        return "walk"

    def target(i):
        for j in sorted(sites):
            if j >= i:
                return sites[j]
        return "金阁寺"

    cfg = dict(skin=1, hair="bun", hairc=0, top=0, pants=0, shoes=0, hat="cap", hatc=0, acc="backpack")
    VW, VH = 640, 400
    frames = []
    cam = None
    # 全局调色板：地图 + 小人与 HUD 会用到的所有颜色，所有帧共用，否则 GIF 只认第一帧的调色板
    swatch = [c for pal in (SKIN, HAIRC, TOPC, PANTC, SHOEC, HATC) for c in pal] + \
             [EYE, BLUSH, GLASS, SCARF, PACK, LENS, (250, 246, 236), (46, 38, 40), (96, 104, 116), (92, 160, 100),
              (210, 62, 50), (240, 200, 70), (200, 226, 240), (30, 30, 34), (40, 40, 46)]
    pal_src = Image.new("RGB", (base.width, base.height + 8), (0, 0, 0)); pal_src.paste(base, (0, 0))
    for i, c in enumerate(swatch):
        pal_src.paste(Image.new("RGB", (8, 8), c), (i * 8, base.height))
    PALETTE = pal_src.quantize(colors=255)

    def vehicle(kind):
        im = Image.new("RGBA", (44, 22), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        body = (96, 104, 116) if kind == "rail" else (92, 160, 100)
        d.rectangle((2, 4, 41, 19), body, outline=(40, 40, 46)); d.rectangle((2, 4, 41, 7), (210, 62, 50) if kind == "rail" else (240, 200, 70))
        for k in range(6, 40, 8):
            d.rectangle((k, 9, k + 4, 14), (200, 226, 240))
        d.rectangle((6, 19, 10, 21), (30, 30, 34)); d.rectangle((33, 19, 37, 21), (30, 30, 34))
        return up(im, 1)

    def frame_at(pos, direction, wf, i, hold_text=None):
        nonlocal cam
        cx, cy = pos
        tx = min(max(cx - VW // 2, 0), base.width - VW); ty = min(max(cy - VH // 2 - 40, 0), base.height - VH)
        cam = (tx, ty) if cam is None else (cam[0] + (tx - cam[0]) * 0.25, cam[1] + (ty - cam[1]) * 0.25)
        ox, oy = int(cam[0]), int(cam[1])
        fr = base.crop((ox, oy, ox + VW, oy + VH)).convert("RGBA")
        m = mode(i)
        if m in ("rail", "bus") and hold_text is None:
            v = vehicle(m); fr.paste(v, (int(cx - ox - 22), int(cy - oy - 16)), v)
            sp = up(sprite(cfg, "front", 0), 1)
            fr.paste(sp, (int(cx - ox - 8), int(cy - oy - 34)), sp)
        else:
            sp = up(sprite(cfg, direction, wf), K)
            fr.paste(sp, (int(cx - ox - W), int(cy - oy - H * K + 6)), sp)
        d = ImageDraw.Draw(fr)
        d.rectangle((0, 0, VW - 1, 34), (250, 246, 236)); d.line((0, 34, VW, 34), (46, 38, 40))
        label = {"walk": "步行", "rail": "JR 奈良线", "bus": "巴士"}[m]
        text(d, 12, 6, "京都一日 · 第 1 天    → " + target(i) + "  ·  " + (hold_text or label), 22)
        return fr.convert("RGB").quantize(palette=PALETTE, dither=Image.Dither.NONE)

    wf = 0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        (mx0, my0), (mx1, my1) = cells[i], cells[i + 1]
        dx, dy = mx1 - mx0, my1 - my0
        direction = "right" if dx > 0 else "left" if dx < 0 else "front" if dy > 0 else "back"
        steps = 1 if mode(i) != "walk" else 2
        for s in range(steps):
            t = s / steps
            frames.append(frame_at((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), direction, wf % 4, i))
            wf += 1
        if i + 1 in sites:
            for _ in range(8):
                frames.append(frame_at(pts[i + 1], "front", 0, i + 1, hold_text="打卡 · " + sites[i + 1]))
    p = os.path.join(HERE, "像素小人_京都路线.gif")
    frames[0].save(p, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True)
    print("saved", p, len(frames), "frames", os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "sheet"
    sheet() if what == "sheet" else walk()
