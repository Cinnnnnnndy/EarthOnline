#!/usr/bin/env python3
"""把四座城的底板（无装饰）、地标、七天行程与像素小人的图层定义导出给网页原型：../原型/data.js"""
import os, sys, io, json, base64
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import render_trip_book as rb
import pixel_hero as ph
import render_cg

cities = {}
for key, sc in rb.SCENES.items():
    im = rb.render_scene(sc, decor=False)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    cgs = {}
    for pk in ("sea", "warm", "dusk"):
        imcg = render_cg.render_scene_cg(sc, decor=False, post=False, palette=pk)
        bufcg = io.BytesIO(); imcg.save(bufcg, "JPEG", quality=84, optimize=True)
        cgs[pk] = "data:image/jpeg;base64," + base64.b64encode(bufcg.getvalue()).decode()
    render_cg.set_palette("sea")
    lms = []
    for (kind, ax, ay, name, role) in sc["landmarks"]:
        _, topz = rb.T(kind, ax, ay)
        lms.append(dict(kind=kind, x=ax, y=ay, name=name, role=role, topz=topz))
    cities[key] = dict(name={"osaka": "大阪", "kyoto": "京都", "nara": "奈良", "kobe": "神户"}[key],
                       img="data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), w=im.width, h=im.height,
                       imgCG=cgs,
                       landmarks=lms, labels=[list(l) for l in sc.get("labels", [])])

FALLBACK = {"岚山": (4, 12, "岚山")}
RAIL_WORDS = ("JR", "近铁", "新干线", "南海", "地铁", "新快速", "关空")


def anchor(city, name):
    for lm in cities[city]["landmarks"]:
        if lm["name"] and lm["role"] in ("place", "airport") and (lm["name"] in name or name in lm["name"]):
            return (lm["x"], lm["y"], lm["name"])
    for k, v in FALLBACK.items():
        if k in name:
            return v
    raise KeyError(name)


def nearest_index(path, ax, ay, start):
    best, bi = 1e9, start
    for i in range(start, len(path)):
        d = (path[i][0] + .5 - ax - .5) ** 2 + (path[i][1] + .5 - ay - .5) ** 2
        if d < best:
            best, bi = d, i
    return bi


days = []
for di, d in enumerate(rb.TRIP["days"]):
    city = d["city"]; path = d["path"]
    stops, segments, cur = [], [], 0
    pending = []          # 上一个站点之后的交通条目
    for e in d["entries"]:
        if e[0] == "transport":
            pending.append(e[1])
        elif e[0] == "place":
            ax, ay, lname = anchor(city, e[1])
            idx = nearest_index(path, ax, ay, cur)
            joined = " ".join(pending)
            mode = "bus" if "巴士" in joined else "rail" if any(w in joined for w in RAIL_WORDS) else "walk"
            first = pending[0].split(" · ") if pending else ["步行"]
            segments.append(dict(end=idx, mode=mode, label=first[0], duration=(" · ".join(first[1:]) if len(first) > 1 else ""),
                                 start=cur))
            stops.append(dict(name=e[1], short=lname, x=ax, y=ay, arrive=idx, time=(e[2] if len(e) > 2 else "")))
            cur = idx; pending = []
    lodging = None
    if d["lodging"]:
        lm = next((l for l in cities[city]["landmarks"] if l["role"] == "lodging"), None)
        if lm:
            lodging = dict(name=lm["name"], x=lm["x"], y=lm["y"], arrive=len(path) - 1, offPlate=False)
        else:   # 住在别的城（奈良一日往返，晚上回京都）：不画在底板上
            lodging = dict(name=d["lodging"] + " · 酒店", x=None, y=None, arrive=len(path) - 1, offPlate=True)
    segments.append(dict(end=len(path) - 1, mode="walk", label="步行", duration="", start=cur))
    entries = []
    for e in d["entries"]:
        if e[0] == "transport":
            parts = e[1].split(" · "); entries.append(dict(type="transport", mode=parts[0], duration=" · ".join(parts[1:])))
        else:
            entries.append(dict(type=e[0], name=e[1], time=(e[2] if len(e) > 2 else "")))
    days.append(dict(index=di + 1, date=f"2026-11-{14 + di}", title=d["title"], city=city, entries=entries, path=[list(c) for c in path],
                     stops=stops, lodging=lodging, segments=segments, heroDir=d["hero_dir"]))

book = dict(
    trip=dict(title=rb.TRIP["title"], subtitle=rb.TRIP["subtitle"], dates=rb.TRIP["dates"], theme=rb.TRIP["theme"], days=days),
    cities=cities,
    proj=dict(OX=rb.OX, OY=rb.OY, TW=rb.TW, TH=rb.TH, LZ=rb.LZ, cols=rb.COLS, rows=rb.ROWS),
    sprite=dict(W=ph.W, H=ph.H, BODY=ph.BODY, LEGS=ph.LEGS, BOB=ph.BOB, HAIR=ph.HAIR, HAT=ph.HAT, ACC=ph.ACC, ORDER=ph.ORDER,
                SKIN=ph.SKIN, HAIRC=ph.HAIRC, TOPC=ph.TOPC, PANTC=ph.PANTC, SHOEC=ph.SHOEC, HATC=ph.HATC,
                fixed=dict(e=ph.EYE, b=ph.BLUSH, G=ph.GLASS, R=ph.SCARF, K=ph.PACK, L=ph.LENS), default=ph.DEFAULT),
)
out_dir = os.path.join(HERE, "..", "原型"); os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, "data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.BOOK = "); json.dump(book, f, ensure_ascii=False, separators=(",", ":")); f.write(";\n")
print("saved", out, os.path.getsize(out) // 1024, "KB")
for d in days:
    print(d["index"], d["title"], "stops:", [(s["short"], s["arrive"]) for s in d["stops"]], "segs:", [(s["end"], s["mode"]) for s in d["segments"]])
