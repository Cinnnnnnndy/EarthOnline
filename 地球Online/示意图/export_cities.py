#!/usr/bin/env python3
"""把四座城的底板定义（地面分类、路网、轨道、地标积木模板、标签）导出为 JSON，给 app/shared/rules/cities/ 用。
运行：python3 export_cities.py
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import render_trip_book as rb

NAMES = {"osaka": "大阪", "kyoto": "京都", "nara": "奈良", "kobe": "神户"}
OUT = os.path.join(HERE, "..", "app", "shared", "rules", "cities")
os.makedirs(OUT, exist_ok=True)
cells = lambda s: sorted([list(c) for c in s])
for key, sc in rb.SCENES.items():
    lms = []
    for (kind, ax, ay, name, role) in sc["landmarks"]:
        boxes, topz = rb.T(kind, ax, ay)
        lms.append(dict(kind=kind, x=ax, y=ay, name=name, role=role, topz=topz,
                        boxes=[[round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3), round(z0, 3), round(z1, 3), list(base), (list(top) if top else None)]
                               for (x0, y0, x1, y1, z0, z1, base, top) in boxes]))
    data = dict(schemaVersion="0.2", id=key, name=NAMES[key], cols=rb.COLS, rows=rb.ROWS, cellMeters=250,
                ground=["".join(row) for row in sc["ground"]],
                hroads=cells(sc.get("hroads", set())), vroads=cells(sc.get("vroads", set())),
                hrails=cells(sc.get("hrails", set())), vrails=cells(sc.get("vrails", set())), subway=cells(sc.get("subway", set())),
                nohouse=cells(sc.get("nohouse", set())), deer=bool(sc.get("deer", False)),
                landmarks=lms, labels=[[l[0], l[1], l[2], list(l[3])] for l in sc.get("labels", [])])
    p = os.path.join(OUT, key + ".json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print("saved", p, os.path.getsize(p) // 1024, "KB", len(lms), "landmarks")
