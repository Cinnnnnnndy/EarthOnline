import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FAMOUS, famousFor } from "../landmark-famous.ts";
import { KIND } from "../landmark-kinds.ts";
import { FAMOUS_EUROPE } from "./famous-europe.ts";
import { MODELS_EUROPE } from "./europe.ts";
import { WORLD_MODELS } from "./index.ts";

test("名胜总表：id 与模型键全局唯一（北欧那批有意共用 rowHouses / palace，不算）", () => {
  const ids = FAMOUS.map((f) => f.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "重复的 id");
  const models = FAMOUS.filter((f) => f.region !== "nordic" && f.model).map((f) => f.model as string);
  assert.deepEqual(models.filter((m, i) => models.indexOf(m) !== i), [], "重复的模型键");
  for (const k of Object.keys(MODELS_EUROPE)) assert.equal(WORLD_MODELS[k], MODELS_EUROPE[k], `模型键 ${k} 被别的大洲覆盖了`);
});

test("欧洲名胜：中文名、英文名、日文名认得出自己；按坐标认得出自己；类型合法；模型存在", () => {
  assert.ok(FAMOUS_EUROPE.length >= 28);
  for (const f of FAMOUS_EUROPE) {
    assert.equal(f.region, "europe", f.id);
    assert.ok(f.re.test(f.name), `${f.id} 的正则认不出中文名 ${f.name}`);
    assert.ok(f.en && f.re.test(f.en), `${f.id} 的正则认不出英文名 ${f.en}`);
    if (f.ja) assert.ok(f.re.test(f.ja), `${f.id} 的正则认不出日文名 ${f.ja}`);
    assert.equal(famousFor({ name: f.name, category: "sight" })?.id, f.id, `${f.name} 按名字认成了别的`);
    assert.equal(famousFor({ name: "x", category: "sight", lat: f.lat, lng: f.lng })?.id, f.id, `${f.id} 按坐标认不出自己`);
    assert.equal(famousFor({ name: f.name, category: "hotel", lat: f.lat, lng: f.lng }), null, `${f.id}：住处不该认成名胜`);
    assert.ok(KIND[f.kind] && f.kind !== "sight", `${f.id} 的类型 ${f.kind} 不在类型表里`);
    assert.ok(f.model && f.model.startsWith("eu_") && MODELS_EUROPE[f.model], `${f.id} 的模型 ${f.model} 不存在`);
    assert.ok(f.r >= 0.2 && f.r <= 5, `${f.id} 的半径 ${f.r} 公里不合理`);
    assert.ok(f.lat > 34 && f.lat < 72 && f.lng > -25 && f.lng < 45, `${f.id} 的坐标不在欧洲`);
  }
  const used = new Set(FAMOUS_EUROPE.map((f) => f.model));
  for (const k of Object.keys(MODELS_EUROPE)) assert.ok(used.has(k), `模型 ${k} 没有登记`);
});

test("欧洲名胜：名字正则不会认错别的名胜", () => {
  for (const f of FAMOUS_EUROPE) for (const o of FAMOUS) {
    if (o.id === f.id) continue;
    assert.ok(!f.re.test(o.name), `${f.id} 的正则误认了 ${o.name}`);
    if (o.en) assert.ok(!f.re.test(o.en), `${f.id} 的正则误认了 ${o.en}`);
  }
});

test("欧洲名胜：泛称和别处的同名地方不认", () => {
  const no = [
    "某某大教堂", "圣母院", "巴黎某某塔", "金字塔", "某某城堡", "大桥", "Cathedral", "Tower", "Bridge", "Castle",
    "平壤凯旋门", "小凯旋门", "巴塞罗那凯旋门", "Arc de Triomphe du Carrousel", "阿布扎比卢浮宫", "Louvre Abu Dhabi", "Louvre-Lens",
    "日内瓦圣彼得大教堂", "圣彼得教堂", "波茨坦勃兰登堡门", "惠州哈尔施塔特", "五矿哈施塔特", "大不里士蓝色清真寺", "Tabriz Blue Mosque",
    "Caesars Colosseum", "Matterhorn Bobsleds", "Alhambra Theatre", "Nashville Parthenon", "Lindos Acropolis", "St Michael's Mount",
    "Notre-Dame de Montréal", "Reims Cathedral", "罗马", "威尼斯人", "Venetian Macao",
  ];
  for (const name of no) { const hit = FAMOUS_EUROPE.find((f) => f.re.test(name)); assert.ok(!hit, `「${name}」被误认成 ${hit?.id}`); }
  const yes: [string, string][] = [
    ["巴黎凯旋门", "arc-de-triomphe"], ["卢浮宫博物馆", "louvre"], ["The Louvre", "louvre"], ["梵蒂冈圣彼得大教堂", "st-peters-basilica"], ["圣彼得广场", "st-peters-basilica"],
    ["Sagrada Familia", "sagrada-familia"], ["新天鹅堡 Neuschwanstein", "neuschwanstein"], ["Kölner Dom", "cologne-cathedral"], ["The Acropolis", "parthenon"],
    ["莫斯科红场", "st-basils"], ["Karlův most", "charles-bridge"], ["马特洪冰川天堂", "matterhorn"], ["Sultanahmet Camii", "blue-mosque"], ["Duomo di Milano", "milan-cathedral"],
    ["Hallstatt", "hallstatt"], ["Mont St Michel", "mont-saint-michel"], ["Palace of Westminster", "big-ben"], ["Tour Eiffel", "eiffel-tower"],
  ];
  for (const [name, id] of yes) assert.equal(famousFor({ name, category: "sight" })?.id, id, name);
});

/** 一个模型用到的颜色（贴图、顶点色里的颜色都算），相差很小的同一色只算一次 */
function coloursOf(g: THREE.Object3D): number {
  const cols: number[][] = [];
  const put = (c: number[]) => { if (!cols.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) < 10)) cols.push(c); };
  g.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; const m = mesh.material as THREE.MeshStandardMaterial;
    if (m.map) { const d = (m.map.image as { data: Uint8Array }).data; for (let i = 0; i < d.length; i += 4) put([d[i], d[i + 1], d[i + 2]]); }
    else if (m.vertexColors) { const a = mesh.geometry.getAttribute("color"); for (let i = 0; i < a.count; i += 3) { const c = new THREE.Color(a.getX(i), a.getY(i), a.getZ(i)).convertLinearToSRGB(); put([c.r * 255, c.g * 255, c.b * 255]); } }
    else if (m.userData.base) put(m.userData.base as number[]);   // mat() 记下的设计原色（D89 之后 color 是提过饱和的）
    else { const c = m.color.clone().convertLinearToSRGB(); put([c.r * 255, c.g * 255, c.b * 255]); }
  });
  return cols.length;
}

test("欧洲名胜模型：在 Node 里能建出来，尺寸、网格数、颜色数在约定范围内", () => {
  const box = new THREE.Box3();
  for (const [key, make] of Object.entries(MODELS_EUROPE)) {
    const lm = make(7);
    let meshes = 0;
    lm.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    box.setFromObject(lm.group);
    assert.ok(lm.top > 0 && lm.footprint > 0, `${key}: top / footprint`);
    assert.ok(meshes > 0 && meshes <= 100, `${key}: 网格 ${meshes} 个`);
    const colours = coloursOf(lm.group); assert.ok(colours <= 5, `${key}: 用了 ${colours} 种颜色`);
    assert.ok(lm.top >= box.max.y && lm.top <= box.max.y + 0.6, `${key}: 标签高度 ${lm.top} 与最高点 ${box.max.y.toFixed(2)} 不符`);
    assert.ok(box.max.y >= 1.2 && box.max.y <= 5.8, `${key}: 高度 ${box.max.y.toFixed(2)} 不在 1.2～5.8`);
    assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= 2.6, `${key}: 占地超出格子`);
    assert.ok(box.min.y >= -0.05, `${key}: 有东西埋到地面以下 ${box.min.y.toFixed(2)}`);
    lm.update?.(1.5); lm.update?.(9);
  }
});
