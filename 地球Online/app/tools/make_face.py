#!/usr/bin/env python3
"""小人 v4 的脸部贴图（贴花）：只画眉、嘴、腮红（眼睛是三维的，不画雀斑）。原 v3 说明：：参照《潜水员戴夫》的圆脸——椭圆大眼（深棕虹膜 + 两点高光）、细上眼线、短而圆的眉、
腮红、雀斑、小小的张嘴笑。坐标系 u, v ∈ [-1, 1]（v 向上），对应头部正面 1.9 × 1.9 的贴花盒。
  python3 tools/make_face.py → web/public/assets/hero_face.png"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops
N, SS = 1024, 2
W = N * SS
X = lambda u: (u * 0.5 + 0.5) * W
Y = lambda v: (1 - (v * 0.5 + 0.5)) * W
box = lambda cx, cy, rx, ry: [X(cx - rx), Y(cy + ry), X(cx + rx), Y(cy - ry)]
def layer(): return Image.new("RGBA", (W, W), (0, 0, 0, 0))
im = layer()
# 腮红：只模糊透明度，颜色整张铺满粉色（直接模糊 RGBA 会把透明黑底混进边缘，出一圈暗影）
mask = Image.new("L", (W, W), 0); dmask = ImageDraw.Draw(mask)
for s in (-1, 1): dmask.ellipse(box(s * 0.5, -0.36, 0.17, 0.1), fill=150)
mask = mask.filter(ImageFilter.GaussianBlur(W * 0.024))
b = Image.new("RGBA", (W, W), (255, 146, 150, 0)); b.putalpha(mask)
im.alpha_composite(b)
# 不画雀斑（第五轮：细节从简）
# 眼睛：v4 起是三维眼球 + 眼睑 + 睫毛（hero.ts），脸上不再画
# 眉毛：短、圆头、略微上扬
d = ImageDraw.Draw(im)
for s in (-1, 1):
    x0, x1, y0 = s * 0.27, s * 0.4, 0.13
    for i in range(24):
        t = i / 23; x = x0 + (x1 - x0) * t; y = y0 + 0.035 * math.sin(math.pi * t) - 0.012 * t; r = 0.026 - 0.008 * t
        d.ellipse(box(x, y, r * 0.75, r * 0.6), fill=(140, 100, 80, 230))
# 嘴：一道小小的弯（潮玩的脸不画张开的嘴）
m = layer(); dm = ImageDraw.Draw(m)
pts = [(X(-0.045 + 0.09 * i / 30), Y(-0.43 - 0.022 * math.sin(math.pi * i / 30))) for i in range(31)]
dm.line(pts, fill=(120, 60, 64, 255), width=int(W * 0.011), joint="curve")
for p0 in (pts[0], pts[-1]): dm.ellipse([p0[0] - W * 0.0055, p0[1] - W * 0.0055, p0[0] + W * 0.0055, p0[1] + W * 0.0055], fill=(120, 60, 64, 255))
im.alpha_composite(m.filter(ImageFilter.GaussianBlur(0.6)))
out = os.path.join(os.path.dirname(__file__), "..", "web", "public", "assets", "hero_face.png")
# 缩小时按预乘透明度算，再把完全透明处的颜色填成邻近的腮红色 / 肤色，贴图过滤时边缘不会混进黑色
small = im.convert("RGBa").resize((N, N), Image.LANCZOS).convert("RGBA")
bg = Image.new("RGBA", (N, N), (238, 196, 180, 0)); px, pb = small.load(), bg.load()
for y in range(N):
    for x in range(N):
        r, g, b_, a = px[x, y]
        if a == 0: px[x, y] = pb[x, y]
small.save(out); print("saved", out)
