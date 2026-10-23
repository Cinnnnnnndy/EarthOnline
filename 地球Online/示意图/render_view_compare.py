#!/usr/bin/env python3
"""同一块底板、两种视角的示意图：
A. 3/4 俯视（星露谷式 2D tile）   B. 2:1 二等角积木（俯仰 26.6°，3D 体素）
纯 Pillow 绘制，1× 像素画后整数倍放大，不做任何平滑。
运行：python3 render_view_compare.py  → 输出 视角对比.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "视角对比.png")
SCALE = 3

# ---------------- 场景：20 列 × 13 行的一块底板 ----------------
MAP = [
    "WWGGGGGGGGGGGGGGGGGG",
    "WWGRRRRRRRRRRRRRRRRG",
    "WWGRGGGGRGGGGRGGGGRG",
    "WWGRGGGGRGGGGRGGGGRG",
    "BBRRRRRRRRRRRRRRRRRG",
    "WWGRGGGGRPPPPRGGGGRG",
    "WWGRGGGGRPPPPRGGGGRG",
    "WWGRGGGGRPPPPRGGGGRG",
    "WWGRRRRRRRRRRRRRRRRG",
    "WWGRGGGGRGGGGRGGGGRG",
    "WWGRGGGGRGGGGRGGGGRG",
    "WWGRRRRRRRRRRRRRRRRG",
    "WWGGGGGGGGGGGGGGGGGG",
]
COLS, ROWS = len(MAP[0]), len(MAP)

# (x, y, w, h, 层数, 类型)   类型：generic / temple / hotel / cafe / station
BUILDINGS = [
    (4, 2, 2, 2, 2, "generic"),
    (9, 2, 4, 2, 3, "temple"),     # 站点 2：寺庙
    (14, 2, 4, 2, 3, "generic"),
    (4, 5, 3, 3, 3, "hotel"),      # 住宿
    (14, 6, 2, 2, 1, "cafe"),      # 站点 3：咖啡馆
    (16, 5, 2, 3, 2, "generic"),
    (4, 9, 4, 2, 2, "station"),    # 站点 1：车站
    (9, 9, 4, 2, 2, "generic"),
    (14, 9, 2, 2, 1, "generic"),
    (16, 9, 2, 2, 2, "generic"),
]
TREES = [(9, 5), (11, 5), (10, 6), (12, 6), (9, 7), (11, 7), (2, 2), (2, 6), (2, 10), (18, 3), (18, 7)]
# 小人路径：车站门口 → 寺庙门口 → 咖啡馆门口，全部走在道路格上
PATH = ([(x, 11) for x in range(6, 9)] + [(8, y) for y in range(10, 3, -1)] +
        [(x, 4) for x in range(9, 14)] + [(13, y) for y in range(5, 9)] + [(14, 8), (15, 8)])
FLAGS = {"station": (86, 140, 220), "temple": (220, 70, 60), "cafe": (240, 200, 70)}
HERO = (8, 11)  # 小人所在格（在路径上，前方无遮挡）

# ---------------- 色板（有限色，像素画） ----------------
C = dict(
    grass=(118, 176, 86), grass2=(100, 156, 72),
    road=(206, 196, 176), road2=(184, 172, 150),
    water=(92, 156, 204), water2=(146, 200, 234),
    plank=(176, 134, 92), plank2=(140, 104, 70),
    canopy=(60, 132, 68), canopy2=(92, 170, 92), trunk=(110, 74, 44),
    ink=(46, 38, 40), path=(252, 220, 84), studs=(255, 255, 255),
)
KIND = {
    "generic": dict(wall=(226, 202, 166), roof=(176, 86, 72), roof2=(150, 70, 58), win=(74, 92, 124)),
    "temple":  dict(wall=(198, 72, 58), roof=(72, 74, 90), roof2=(56, 58, 72), win=(60, 30, 26), gold=(236, 198, 92)),
    "hotel":   dict(wall=(238, 228, 206), roof=(98, 126, 170), roof2=(80, 106, 148), win=(84, 110, 150)),
    "cafe":    dict(wall=(244, 210, 136), roof=(184, 92, 72), roof2=(156, 76, 60), win=(90, 70, 50), awn=(222, 78, 74), awn2=(248, 246, 236)),
    "station": dict(wall=(188, 198, 208), roof=(108, 116, 128), roof2=(90, 98, 110), win=(62, 78, 100)),
}
SPRITE = [  # 8×12 小人，'.'透明
    "..hhhh..", ".hhhhhh.", ".hffffh.", ".hfeefh.", "..ffff..", ".ssssss.",
    "fssssssf", "fssssssf", "..ssss..", "..pppp..", "..p..p..", ".bb..bb.",
]
SPC = dict(h=(60, 40, 30), f=(250, 210, 170), e=(40, 30, 30), s=(64, 122, 204), p=(44, 54, 84), b=(50, 40, 40))


def shade(c, d):
    return tuple(max(0, min(255, v + d)) for v in c)


def draw_sprite(dr, x, y):
    for j, row in enumerate(SPRITE):
        for i, ch in enumerate(row):
            if ch != ".":
                dr.point((x + i, y + j), SPC[ch])


def in_building(bx, by):
    for (x, y, w, h, z, k) in BUILDINGS:
        if x <= bx < x + w and y <= by < y + h:
            return (x, y, w, h, z, k)
    return None


# =====================================================================
# A. 3/4 俯视（星露谷式）
# =====================================================================
def render_topdown():
    CELL, M = 16, 8
    W, H = COLS * CELL + M * 2, ROWS * CELL + M * 2 + 16
    im = Image.new("RGB", (W, H), (236, 228, 208))
    dr = ImageDraw.Draw(im)
    ox, oy = M, M + 16

    def cell_xy(x, y):
        return ox + x * CELL, oy + y * CELL

    # 地面
    for y in range(ROWS):
        for x in range(COLS):
            t = MAP[y][x]
            cx, cy = cell_xy(x, y)
            box = (cx, cy, cx + CELL - 1, cy + CELL - 1)
            if t in "GP":
                dr.rectangle(box, C["grass"])
                for (dx, dy) in ((3, 5), (11, 9), (7, 13), (13, 2)):
                    dr.point((cx + dx, cy + dy), C["grass2"]); dr.point((cx + dx, cy + dy - 1), C["grass2"])
            elif t == "R":
                dr.rectangle(box, C["road"])
                # 与非道路相邻的边画一条路牙
                for (nx, ny, line) in ((x, y - 1, (cx, cy, cx + 15, cy)), (x, y + 1, (cx, cy + 15, cx + 15, cy + 15)),
                                       (x - 1, y, (cx, cy, cx, cy + 15)), (x + 1, y, (cx + 15, cy, cx + 15, cy + 15))):
                    if 0 <= nx < COLS and 0 <= ny < ROWS and MAP[ny][nx] not in "RB":
                        dr.line(line, C["road2"])
            elif t == "W":
                dr.rectangle(box, C["water"])
                off = (y * 5 + x * 3) % 8
                dr.line((cx + off, cy + 4, cx + off + 3, cy + 4), C["water2"])
                dr.line((cx + (off + 5) % 12, cy + 11, cx + (off + 5) % 12 + 3, cy + 11), C["water2"])
            elif t == "B":
                dr.rectangle(box, C["plank"])
                for k in range(0, 16, 4):
                    dr.line((cx + k, cy, cx + k, cy + 15), C["plank2"])
                dr.line((cx, cy, cx + 15, cy), C["ink"]); dr.line((cx, cy + 15, cx + 15, cy + 15), C["ink"])

    # 路径点
    for (x, y) in PATH:
        cx, cy = cell_xy(x, y)
        dr.rectangle((cx + 7, cy + 7, cx + 8, cy + 8), C["path"])

    # 树与建筑按 y 排序后画（画家算法）
    items = [("tree", (x, y)) for (x, y) in TREES] + [("bld", b) for b in BUILDINGS]

    def sort_key(it):
        if it[0] == "tree":
            return it[1][1] + 1
        b = it[1]
        return b[1] + b[3]
    items.sort(key=sort_key)

    for kind, obj in items:
        if kind == "tree":
            x, y = obj
            cx, cy = cell_xy(x, y)
            dr.rectangle((cx + 7, cy + 10, cx + 8, cy + 14), C["trunk"])
            dr.ellipse((cx + 2, cy, cx + 13, cy + 11), C["canopy"], outline=shade(C["canopy"], -40))
            dr.ellipse((cx + 4, cy + 2, cx + 8, cy + 6), C["canopy2"])
        else:
            x, y, w, h, z, k = obj
            P = KIND[k]
            fx, fy = cell_xy(x, y)
            fw, fh = w * CELL, h * CELL
            wall_h = 8 + 4 * z
            rise = z * 5
            roof = (fx, fy - rise, fx + fw - 1, fy + fh - wall_h - 1)
            wall = (fx, fy + fh - wall_h, fx + fw - 1, fy + fh - 1)
            # 屋顶：瓦片条纹
            dr.rectangle(roof, P["roof"])
            for yy in range(roof[1] + 1, roof[3], 3):
                dr.line((roof[0] + 1, yy, roof[2] - 1, yy), P["roof2"])
            if k == "temple":
                dr.line((roof[0] - 1, roof[1], roof[2] + 1, roof[1]), P["gold"])
                dr.line((roof[0] - 1, roof[1] + 1, roof[2] + 1, roof[1] + 1), P["gold"])
            # 墙
            dr.rectangle(wall, P["wall"])
            dr.line((wall[0], wall[1], wall[2], wall[1]), shade(P["wall"], -50))  # 屋檐阴影
            # 窗：每层一排
            for floor in range(z):
                wy = wall[1] + 3 + floor * 4
                if wy + 3 > wall[3] - 8:
                    break
                for wx in range(wall[0] + 3, wall[2] - 3, 6):
                    dr.rectangle((wx, wy, wx + 2, wy + 2), P["win"])
            # 门
            dx = fx + fw // 2 - 2
            dr.rectangle((dx, wall[3] - 6, dx + 4, wall[3]), shade(P["wall"], -90))
            if k == "cafe":  # 遮阳棚
                for i, xx in enumerate(range(wall[0], wall[2] + 1, 3)):
                    dr.rectangle((xx, wall[1], min(xx + 2, wall[2]), wall[1] + 3), P["awn"] if i % 2 == 0 else P["awn2"])
            if k == "station":
                dr.rectangle((dx - 4, wall[3] - 8, dx + 8, wall[3]), shade(P["wall"], -90))
            # 轮廓
            dr.rectangle((fx, fy - rise, fx + fw - 1, fy + fh - 1), outline=C["ink"])
            dr.line((wall[0], wall[1], wall[2], wall[1]), C["ink"])
            # 站点旗
            if k in FLAGS:
                px, py = fx + fw // 2, fy - rise
                dr.line((px, py - 9, px, py - 1), C["ink"])
                dr.polygon([(px + 1, py - 9), (px + 7, py - 7), (px + 1, py - 5)], FLAGS[k])

    # 小人
    hx, hy = cell_xy(*HERO)
    draw_sprite(dr, hx + 4, hy + 2)
    return im


# =====================================================================
# B. 2:1 二等角积木（俯仰 26.6°）
# =====================================================================
def render_dimetric():
    TW, TH, LZ = 32, 16, 10           # 菱形宽/高，一层积木的高度
    M = 12
    ox = (ROWS - 1) * (TW // 2) + M
    oy = M + 6 * LZ + 8
    W = (COLS + ROWS) * (TW // 2) + M * 2
    H = (COLS + ROWS) * (TH // 2) + oy + M
    im = Image.new("RGB", (W, H), (236, 228, 208))
    dr = ImageDraw.Draw(im)

    def center(x, y, z=0.0):
        return ox + (x - y) * (TW // 2), oy + (x + y) * (TH // 2) - z * LZ

    def diamond(x, y, z, s=1.0):
        cx, cy = center(x, y, z)
        hw, hh = (TW // 2) * s, (TH // 2) * s
        return [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]

    def cube(x, y, z, base, s=1.0, top=None, faces=True, outline=None):
        """一块积木：占据 z..z+1 层；s 为在格内的缩放（树、装饰用）"""
        t = diamond(x, y, z + 1, s)
        b = diamond(x, y, z, s)
        if faces:
            dr.polygon([t[3], t[2], b[2], b[3]], shade(base, 0))      # 左面（朝 +y）
            dr.polygon([t[2], t[1], b[1], b[2]], shade(base, -38))    # 右面（朝 +x）
        dr.polygon(t, top if top else shade(base, 28))
        if outline:
            dr.line([t[3], t[2], t[1]], outline)
        return t, b

    def ground(x, y, t):
        d = diamond(x, y, 0)
        cx, cy = center(x, y)
        if t in "GP":
            dr.polygon(d, C["grass"])
            for (dx, dy) in ((-6, 0), (5, -2), (0, 4), (9, 2), (-10, 2)):
                dr.point((cx + dx, cy + dy), C["grass2"])
        elif t == "R":
            dr.polygon(d, C["road"])
            for (nx, ny, a, b) in ((x, y - 1, 0, 1), (x + 1, y, 1, 2), (x, y + 1, 2, 3), (x - 1, y, 3, 0)):
                if 0 <= nx < COLS and 0 <= ny < ROWS and MAP[ny][nx] not in "RB":
                    dr.line([d[a], d[b]], C["road2"])
        elif t == "W":
            dr.polygon(d, C["water"])
            off = (x * 3 + y * 5) % 6
            dr.line((cx - 8 + off, cy - 2, cx - 4 + off, cy - 2), C["water2"])
            dr.line((cx + 2 - off, cy + 3, cx + 6 - off, cy + 3), C["water2"])
        elif t == "B":
            dr.polygon(d, C["plank"])
            for k in range(-12, 13, 4):
                dr.line((cx + k, cy - 6 + abs(k) // 2, cx + k, cy + 6 - abs(k) // 2), C["plank2"])
            dr.line([d[0], d[1]], C["ink"]); dr.line([d[3], d[2]], C["ink"])

    def studs(x, y, z, col):
        cx, cy = center(x, y, z)
        for (dx, dy) in ((-8, 0), (8, 0), (0, -4), (0, 4)):
            dr.rectangle((cx + dx - 1, cy + dy - 1, cx + dx + 1, cy + dy), shade(col, 40))

    def building_cell(x, y, b):
        bx, by, bw, bh, z, k = b
        P = KIND[k]
        front = (y == by + bh - 1)      # 朝 +y 的外立面
        side = (x == bx + bw - 1)       # 朝 +x 的外立面
        for lv in range(z):
            top_col = P["roof"] if lv == z - 1 else None
            t, bo = cube(x, y, lv, P["wall"], top=top_col)
            cx, _ = center(x, y)
            # 窗：只画在外立面上
            if front:
                fy0 = center(x, y, lv + 1)[1] + 2
                for wx in (cx - 12, cx - 6):
                    dr.rectangle((wx, fy0 + 1, wx + 2, fy0 + 4), P["win"])
            if side:
                fy0 = center(x, y, lv + 1)[1] + 2
                for wx in (cx + 5, cx + 11):
                    dr.rectangle((wx, fy0 + 1, wx + 2, fy0 + 4), shade(P["win"], -30))
            if k == "cafe" and front and lv == z - 1:  # 遮阳棚条纹，沿前立面顶边
                fy0 = center(x, y, lv + 1)[1]
                for i, wx in enumerate(range(cx - 16, cx, 2)):
                    y0 = fy0 + (wx - (cx - 16)) // 2
                    dr.rectangle((wx, y0, wx + 1, y0 + 3), P["awn"] if i % 2 == 0 else P["awn2"])
        # 门：在前立面中间那一格底层
        if front and x == bx + bw // 2:
            cx, cy = center(x, y, 0)
            dr.rectangle((cx - 9, cy - 4, cx - 6, cy + 2), shade(P["wall"], -90))
        # 屋顶
        if k == "temple":
            cube(x, y, z, P["roof2"], s=1.0, top=P["roof"], faces=True)
            if bx < x < bx + bw - 1:                      # 第二级屋顶只盖中间两格
                cube(x, y, z + 1, P["roof2"], s=0.7, top=P["roof"], faces=True)
            if x == bx + bw // 2 and y == by:
                cube(x, y, z + 2, P["gold"], s=0.3)
        else:
            studs(x, y, z, P["roof"])
        # 站点旗
        if k in FLAGS and x == bx + bw - 1 and y == by:
            cx, cy = center(x, y, z + (2 if k == "temple" else 0))
            dr.line((cx, cy - 12, cx, cy - 1), C["ink"])
            dr.polygon([(cx + 1, cy - 12), (cx + 8, cy - 10), (cx + 1, cy - 8)], FLAGS[k])

    def tree(x, y):
        cube(x, y, 0, C["trunk"], s=0.25)
        cube(x, y, 1, C["canopy"], s=0.8, top=C["canopy2"])
        cube(x, y, 2, C["canopy"], s=0.5, top=C["canopy2"])

    path_set = set(PATH)
    for s in range(COLS + ROWS - 1):          # 画家算法：按 x+y 从后往前
        for x in range(COLS):
            y = s - x
            if not (0 <= y < ROWS):
                continue
            ground(x, y, MAP[y][x])
            if (x, y) in path_set:
                cx, cy = center(x, y)
                dr.rectangle((cx - 1, cy - 1, cx + 1, cy), C["path"])
            b = in_building(x, y)
            if b:
                building_cell(x, y, b)
            if (x, y) in TREES:
                tree(x, y)
            if (x, y) == HERO:
                cx, cy = center(x, y)
                draw_sprite(dr, cx - 4, cy - 10)
    return im


# =====================================================================
# 拼版
# =====================================================================
def compose():
    a = render_topdown()
    b = render_dimetric()
    a = a.resize((a.width * SCALE, a.height * SCALE), Image.NEAREST)
    b = b.resize((b.width * SCALE, b.height * SCALE), Image.NEAREST)

    font_path = "/usr/share/fonts/opentype/unifont/unifont.otf"
    f_title = ImageFont.truetype(font_path, 16 * 3)
    f_label = ImageFont.truetype(font_path, 16 * 2)
    f_note = ImageFont.truetype(font_path, 16 * 2)

    gap, pad, top = 48, 36, 150
    W = pad + a.width + gap + b.width + pad
    H = top + max(a.height, b.height) + 140
    im = Image.new("RGB", (W, H), (246, 240, 226))
    dr = ImageDraw.Draw(im)
    ink = (52, 44, 46)

    dr.text((pad, 24), "同一块底板 · 两种视角", ink, font=f_title)
    dr.text((pad, 80), "车站 → 寺庙 → 咖啡馆；黄点为小人路径；旗为站点；左下为住宿", (110, 100, 96), font=f_note)

    ya = top + (max(a.height, b.height) - a.height) // 2
    yb = top + (max(a.height, b.height) - b.height) // 2
    xa, xb = pad, pad + a.width + gap
    for (x, y, img) in ((xa, ya, a), (xb, yb, b)):
        dr.rectangle((x - 6, y - 6, x + img.width + 5, y + img.height + 5), outline=ink, width=3)
        im.paste(img, (x, y))

    yl = top + max(a.height, b.height) + 24
    dr.text((xa, yl), "A · 3/4 俯视（星露谷式，2D tile，不能旋转）", ink, font=f_label)
    dr.text((xa, yl + 40), "地面正俯视、建筑画出正面：最像「像素画」，但看不到侧面与高度", (110, 100, 96), font=f_note)
    dr.text((xb, yl), "B · 2:1 二等角积木（俯仰 26.6°，3D 体素，4 方位档）", ink, font=f_label)
    dr.text((xb, yl + 40), "屋顶、正面、侧面三面可见，高度与积木可搭；前排会遮后排", (110, 100, 96), font=f_note)
    im.save(OUT)
    print("saved", OUT, im.size)


if __name__ == "__main__":
    compose()
