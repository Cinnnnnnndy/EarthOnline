import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FAMOUS, famousFor } from "../landmark-famous.ts";
import { KIND } from "../landmark-kinds.ts";
import { FAMOUS_AMERICAS } from "./famous-americas.ts";
import { MODELS_AMERICAS } from "./americas.ts";
import { WORLD_MODELS } from "./index.ts";

test("名胜总表：id 与模型键全局唯一（北欧那批有意共用 rowHouses / palace，不算）；美洲的模型键没被别的大洲覆盖", () => {
  const ids = FAMOUS.map((f) => f.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "重复的 id");
  const models = FAMOUS.filter((f) => f.region !== "nordic" && f.model).map((f) => f.model as string);
  assert.deepEqual(models.filter((m, i) => models.indexOf(m) !== i), [], "重复的模型键");
  for (const k of Object.keys(MODELS_AMERICAS)) assert.equal(WORLD_MODELS[k], MODELS_AMERICAS[k], `模型键 ${k} 被别的大洲覆盖了`);
});

test("美洲名胜：中文名、英文名、日文名认得出自己；按坐标认得出自己；住处不认；类型合法；模型存在", () => {
  assert.ok(FAMOUS_AMERICAS.length >= 16);
  for (const f of FAMOUS_AMERICAS) {
    assert.equal(f.region, "americas", f.id);
    assert.ok(f.re.test(f.name), `${f.id} 的正则认不出中文名 ${f.name}`);
    assert.ok(f.en && f.re.test(f.en), `${f.id} 的正则认不出英文名 ${f.en}`);
    if (f.ja) assert.ok(f.re.test(f.ja), `${f.id} 的正则认不出日文名 ${f.ja}`);
    assert.equal(famousFor({ name: f.name, category: "sight" })?.id, f.id, `${f.name} 按名字认成了别的`);
    assert.equal(famousFor({ name: "x", category: "sight", lat: f.lat, lng: f.lng })?.id, f.id, `${f.id} 按坐标认不出自己`);
    assert.equal(famousFor({ name: f.name, category: "hotel", lat: f.lat, lng: f.lng }), null, `${f.id}：住处不该认成名胜`);
    assert.ok(KIND[f.kind] && f.kind !== "sight", `${f.id} 的类型 ${f.kind} 不在类型表里`);
    assert.ok(f.model && f.model.startsWith("am_") && MODELS_AMERICAS[f.model], `${f.id} 的模型 ${f.model} 不存在`);
    assert.ok(f.r >= 0.2 && f.r <= 5, `${f.id} 的半径 ${f.r} 公里不合理`);
    assert.ok(f.lat > -56 && f.lat < 72 && f.lng > -170 && f.lng < -30, `${f.id} 的坐标不在美洲`);
  }
  const used = new Set(FAMOUS_AMERICAS.map((f) => f.model));
  for (const k of Object.keys(MODELS_AMERICAS)) assert.ok(used.has(k), `模型 ${k} 没有登记`);
});

test("美洲名胜：名字正则不会认错别的名胜", () => {
  for (const f of FAMOUS_AMERICAS) for (const o of FAMOUS) {
    if (o.id === f.id) continue;
    assert.ok(!f.re.test(o.name), `${f.id} 的正则误认了 ${o.name}`);
    if (o.en) assert.ok(!f.re.test(o.en), `${f.id} 的正则误认了 ${o.en}`);
  }
});

test("美洲名胜：泛称、别处的同名地方和复制品不认", () => {
  const no = [
    "金字塔", "某某金字塔", "大峡谷", "东非大裂谷", "雅鲁藏布大峡谷", "太鲁阁大峡谷", "恩施大峡谷", "黄石大峡谷", "Grand Canyon of the Yellowstone",
    "台场自由女神像", "お台場の自由の女神像", "巴黎自由女神像", "金门", "金门岛", "Golden Gate Park", "Empire State Plaza",
    "Cristo Rei", "里斯本大基督像", "Christ the Redeemer of the Andes", "Niagara-on-the-Lake", "尼亚加拉湖滨小镇", "Old Faithful Geyser of California",
    "Puerto Iguazú", "Foz do Iguaçu", "伊瓜苏港", "伊瓜苏市", "乌尤尼镇", "乌尤尼火车墓地", "茶卡盐湖天空之镜", "天空之镜",
    "塔", "大桥", "瀑布", "Tower", "Bridge", "Cathedral", "Falls", "Pyramid", "某某电视塔", "Blvd. Kukulcán", "Casablanca",
  ];
  for (const name of no) { const hit = FAMOUS_AMERICAS.find((f) => f.re.test(name)); assert.ok(!hit, `「${name}」被误认成 ${hit?.id}`); }
  const yes: [string, string][] = [
    ["自由女神", "statue-of-liberty"], ["Liberty Island", "statue-of-liberty"], ["帝国大厦观景台", "empire-state-building"], ["Golden Gate Bridge Vista Point", "golden-gate-bridge"],
    ["大峡谷国家公园", "grand-canyon"], ["Grand Canyon South Rim", "grand-canyon"], ["Mather Point", "grand-canyon"], ["尼亚加拉大瀑布", "niagara-falls"], ["Niagara Falls State Park", "niagara-falls"],
    ["拉什莫尔山国家纪念公园", "mount-rushmore"], ["Space Needle", "space-needle"], ["CN Tower", "cn-tower"], ["加拿大国家电视塔", "cn-tower"], ["老忠实泉", "old-faithful"],
    ["耶稣山", "christ-the-redeemer"], ["Cristo Redentor", "christ-the-redeemer"], ["Corcovado", "christ-the-redeemer"], ["马丘比丘古城", "machu-picchu"],
    ["Chichen Itza", "chichen-itza"], ["El Castillo (Chichén Itzá)", "chichen-itza"], ["Temple of Kukulcán", "chichen-itza"], ["Ahu Tongariki", "easter-island-moai"], ["Rapa Nui", "easter-island-moai"],
    ["Garganta del Diablo", "iguazu-falls"], ["Cataratas del Iguazú", "iguazu-falls"], ["Cataratas do Iguaçu", "iguazu-falls"], ["乌尤尼盐湖", "salar-de-uyuni"], ["Isla Incahuasi", "salar-de-uyuni"],
    ["蒂卡尔国家公园", "tikal"], ["The White House", "white-house"], ["Monument Valley Navajo Tribal Park", "monument-valley"], ["好莱坞标志", "hollywood-sign"],
  ];
  for (const [name, id] of yes) assert.equal(famousFor({ name, category: "sight" })?.id, id, name);
});

test("美洲名胜模型：在 Node 里能建出来；尺寸、网格数、颜色数在约定范围内；动画能跑", () => {
  const box = new THREE.Box3();
  for (const [key, make] of Object.entries(MODELS_AMERICAS)) {
    const lm = make(7);
    let meshes = 0; const colors = new Set<string>();
    lm.group.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return; meshes++;
      const ma = m.material as THREE.MeshStandardMaterial; colors.add(ma.map ? "map" : ma.color.getHexString());
    });
    box.setFromObject(lm.group);
    assert.ok(lm.top > 0 && lm.footprint > 0, `${key}: top / footprint`);
    assert.ok(meshes > 0 && meshes <= 100, `${key}: 网格 ${meshes} 个`);
    assert.ok(colors.size <= 6, `${key}: ${colors.size} 种颜色 ${[...colors].join(" ")}`);
    assert.ok(lm.top >= box.max.y - 0.01 && lm.top <= box.max.y + 0.6, `${key}: 标签高度 ${lm.top} 与最高点 ${box.max.y.toFixed(2)} 不符`);
    assert.ok(box.max.y >= 1.4 && box.max.y <= 5.6, `${key}: 高度 ${box.max.y.toFixed(2)} 不在 1.4～5.6`);
    assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= 2.7, `${key}: 占地超出格子 ${JSON.stringify([box.min.x, box.max.x, box.min.z, box.max.z].map((v) => +v.toFixed(2)))}`);
    lm.update?.(1.5); lm.update?.(40);
  }
});
