import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FAMOUS, famousFor } from "../landmark-famous.ts";
import { KIND } from "../landmark-kinds.ts";
import { FAMOUS_ASIA } from "./famous-asia.ts";
import { MODELS_ASIA } from "./asia.ts";
import { MODELS_EUROPE } from "./europe.ts";
import { MODELS_AFRICA } from "./africa.ts";
import { MODELS_AMERICAS } from "./americas.ts";
import { MODELS_OCEANIA } from "./oceania.ts";

test("名胜总表：id 全局唯一；各大洲的专门模型键不重复（北欧那批有意共用 rowHouses / palace）", () => {
  const ids = FAMOUS.map((f) => f.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "重复的 id");
  const models = FAMOUS.filter((f) => f.region !== "nordic" && f.model).map((f) => f.model as string);
  assert.deepEqual(models.filter((m, i) => models.indexOf(m) !== i), [], "重复的模型键");
  const others = { ...MODELS_EUROPE, ...MODELS_AFRICA, ...MODELS_AMERICAS, ...MODELS_OCEANIA };
  for (const k of Object.keys(MODELS_ASIA)) assert.ok(!(k in others), `模型键 ${k} 和别的大洲撞了`);
});

test("亚洲名胜：名字、英文名能认出自己；按坐标能认出自己；类型合法；模型存在", () => {
  assert.ok(FAMOUS_ASIA.length >= 32);
  for (const f of FAMOUS_ASIA) {
    assert.equal(f.region, "asia", f.id);
    assert.ok(f.re.test(f.name), `${f.id} 的正则认不出中文名 ${f.name}`);
    assert.ok(f.en && f.re.test(f.en), `${f.id} 的正则认不出英文名 ${f.en}`);
    if (f.ja) assert.ok(f.re.test(f.ja) || f.ja === f.name, `${f.id} 的正则认不出日文名 ${f.ja}`);
    assert.equal(famousFor({ name: f.name, category: "sight" })?.id, f.id, `${f.name} 按名字认成了别的`);
    assert.equal(famousFor({ name: "x", category: "sight", lat: f.lat, lng: f.lng })?.id, f.id, `${f.id} 按坐标认不出自己`);
    assert.ok(KIND[f.kind] && f.kind !== "sight", `${f.id} 的类型 ${f.kind} 不在类型表里`);
    assert.ok(f.model && f.model.startsWith("as_") && MODELS_ASIA[f.model], `${f.id} 的模型 ${f.model} 不存在`);
    assert.ok(f.r >= 0.2 && f.r <= 5, `${f.id} 的半径 ${f.r} 公里不合理`);
    assert.ok(Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180);
  }
  const used = new Set(FAMOUS_ASIA.map((f) => f.model));
  for (const k of Object.keys(MODELS_ASIA)) assert.ok(used.has(k), `模型 ${k} 没有登记`);
});

test("亚洲名胜：名字正则不会认错别的名胜", () => {
  for (const f of FAMOUS_ASIA) for (const o of FAMOUS) {
    if (o.id === f.id) continue;
    assert.ok(!f.re.test(o.name), `${f.id} 的正则误认了 ${o.name}`);
    if (o.en) assert.ok(!f.re.test(o.en), `${f.id} 的正则误认了 ${o.en}`);
  }
});

test("亚洲名胜：不该认的普通地方不认", () => {
  const no = ["台北故宫博物院", "國立故宮博物院", "沈阳故宫", "瘦西湖", "惠州西湖", "黄山北站", "黄山市屯溪老街", "双子塔", "金沙", "某某塔", "某某寺", "Taj Mahal Palace", "Petrarca", "大桥", "West Point", "景山万春亭看故宫全景", "西湖醋鱼", "西湖龙井茶"];
  for (const name of no) assert.ok(!FAMOUS_ASIA.some((f) => f.re.test(name)), `「${name}」被误认成名胜`);
  const yes: [string, string][] = [["北京故宫", "forbidden-city"], ["八达岭长城", "great-wall"], ["杭州西湖断桥", "leifeng-pagoda"], ["黄山风景区", "huangshan"], ["宫岛", "itsukushima"], ["Fushimi Inari Shrine", "fushimi-inari"], ["东京天空树", "tokyo-skytree"], ["Petra", "petra-khazneh"], ["珠峰大本营", "everest"], ["国家体育场鸟巢", "birds-nest"], ["鳥の巣", "birds-nest"], ["Merlion Park", "merlion"]];
  for (const [name, id] of yes) assert.equal(famousFor({ name, category: "sight" })?.id, id, name);
});

test("亚洲名胜：示例行程里偏移过的坐标（差 500 米上下）也能按坐标认出来", () => {
  const pts: [number, number, string][] = [[30.2311, 120.1487, "leifeng-pagoda"], [39.9929, 116.3965, "birds-nest"], [39.9163, 116.3972, "forbidden-city"], [39.8822, 116.4066, "temple-of-heaven"]];
  for (const [lat, lng, id] of pts) assert.equal(famousFor({ name: "x", category: "sight", lat, lng })?.id, id, `${lat}, ${lng}`);
});

test("亚洲名胜模型：在 Node 里能建出来，尺寸与网格数在约定范围内", () => {
  const box = new THREE.Box3();
  for (const [key, make] of Object.entries(MODELS_ASIA)) {
    const lm = make(7);
    let meshes = 0; lm.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    box.setFromObject(lm.group);
    assert.ok(lm.top > 0 && lm.footprint > 0, `${key}: top / footprint`);
    assert.ok(meshes > 0 && meshes <= 120, `${key}: 网格 ${meshes} 个`);
    assert.ok(lm.top >= box.max.y && lm.top <= box.max.y + 0.6, `${key}: 标签高度 ${lm.top} 与最高点 ${box.max.y.toFixed(2)} 不符`);
    assert.ok(box.max.y <= 5.8, `${key}: 太高 ${box.max.y.toFixed(2)}`);
    assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= 2.7, `${key}: 占地超出格子`);
    lm.update?.(1.5);
  }
});
