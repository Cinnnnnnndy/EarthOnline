import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { FAMOUS, famousFor, type Famous } from "../landmark-famous.ts";
import { KIND } from "../landmark-kinds.ts";
import { FAMOUS_AFRICA } from "./famous-africa.ts";
import { FAMOUS_OCEANIA } from "./famous-oceania.ts";
import { MODELS_AFRICA } from "./africa.ts";
import { MODELS_OCEANIA } from "./oceania.ts";
import { WORLD_MODELS } from "./index.ts";

const REGIONS: { region: "africa" | "oceania"; prefix: string; list: Famous[]; models: Record<string, unknown>; box: [number, number, number, number] }[] = [
  { region: "africa", prefix: "af_", list: FAMOUS_AFRICA, models: MODELS_AFRICA, box: [-35, 38, -20, 52] },
  { region: "oceania", prefix: "oc_", list: FAMOUS_OCEANIA, models: MODELS_OCEANIA, box: [-48, 0, 110, 180] },
];

test("名胜总表：id 与模型键全局唯一（北欧那批有意共用 rowHouses / palace，不算）", () => {
  const ids = FAMOUS.map((f) => f.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "重复的 id");
  const models = FAMOUS.filter((f) => f.region !== "nordic" && f.model).map((f) => f.model as string);
  assert.deepEqual(models.filter((m, i) => models.indexOf(m) !== i), [], "重复的模型键");
  for (const { models: M } of REGIONS) for (const k of Object.keys(M)) assert.equal(WORLD_MODELS[k], M[k], `模型键 ${k} 被别的大洲覆盖了`);
});

for (const { region, prefix, list, models, box } of REGIONS) {
  test(`${region} 名胜：中文名、英文名、日文名认得出自己；按坐标认得出自己；类型合法；模型存在`, () => {
    assert.ok(list.length >= 6);
    for (const f of list) {
      assert.equal(f.region, region, f.id);
      assert.ok(f.re.test(f.name), `${f.id} 的正则认不出中文名 ${f.name}`);
      assert.ok(f.en && f.re.test(f.en), `${f.id} 的正则认不出英文名 ${f.en}`);
      if (f.ja) assert.ok(f.re.test(f.ja), `${f.id} 的正则认不出日文名 ${f.ja}`);
      assert.equal(famousFor({ name: f.name, category: "sight" })?.id, f.id, `${f.name} 按名字认成了别的`);
      assert.equal(famousFor({ name: "x", category: "sight", lat: f.lat, lng: f.lng })?.id, f.id, `${f.id} 按坐标认不出自己`);
      assert.equal(famousFor({ name: f.name, category: "hotel", lat: f.lat, lng: f.lng }), null, `${f.id}：住处不该认成名胜`);
      assert.ok(KIND[f.kind] && f.kind !== "sight", `${f.id} 的类型 ${f.kind} 不在类型表里`);
      assert.ok(f.model && f.model.startsWith(prefix) && models[f.model], `${f.id} 的模型 ${f.model} 不存在`);
      assert.ok(f.r >= 0.2 && f.r <= 5, `${f.id} 的半径 ${f.r} 公里不合理`);
      const [la0, la1, lo0, lo1] = box; assert.ok(f.lat > la0 && f.lat < la1 && f.lng > lo0 && f.lng < lo1, `${f.id} 的坐标不在${region}`);
    }
    const used = new Set(list.map((f) => f.model));
    for (const k of Object.keys(models)) assert.ok(used.has(k), `模型 ${k} 没有登记`);
  });

  test(`${region} 名胜：名字正则不会认错别的名胜`, () => {
    for (const f of list) for (const o of FAMOUS) {
      if (o.id === f.id) continue;
      assert.ok(!f.re.test(o.name), `${f.id} 的正则误认了 ${o.name}`);
      if (o.en) assert.ok(!f.re.test(o.en), `${f.id} 的正则误认了 ${o.en}`);
    }
  });
}

test("非洲、大洋洲名胜：泛称和别处的同名地方不认；常见写法认得出", () => {
  const mine = [...FAMOUS_AFRICA, ...FAMOUS_OCEANIA];
  const no = [
    "金字塔", "Pyramid", "卢浮宫金字塔", "Great Pyramid of Cholula", "卢克索狮身人面像大道", "Avenue of Sphinxes", "Sphinx Observatory", "スフィンクス展望台", "Great Sphinx of Tanis",
    "桌子山岩画", "乌海桌山", "Table Mountain Casino", "North Table Mountain Park", "大教堂", "塔", "桥", "城堡", "Cathedral", "Tower", "Bridge",
    "Kilimanjaro International Airport", "乞力马扎罗国际机场", "Kilimanjaro Coffee", "Kibo", "Hassan Tower", "哈桑塔", "Hassan II Stadium",
    "歌剧院", "Opera House", "Harbour Bridge", "海港大桥", "Great Barrier Island", "大堡岛", "Ayers Rock Resort", "Ayers Rock Airport",
    "Twelve Apostles Hotel", "Church of the Twelve Apostles", "Cape Town Twelve Apostles", "Twelve Apostles Mountain", "十二门徒", "Great Ocean Road", "大洋路",
    "Milford Track", "Victoria Falls Airport", "Mara River", "Maasai Market",
    "蓝色小镇", "Blue City", "Jodhpur", "霍比特人", "The Hobbit", "Matamata",
  ];
  for (const name of no) { const hit = mine.find((f) => f.re.test(name)); assert.ok(!hit, `「${name}」被误认成 ${hit?.id}`); }
  const yes: [string, string][] = [
    ["吉萨金字塔", "giza-pyramids"], ["胡夫金字塔", "giza-pyramids"], ["狮身人面像", "giza-pyramids"], ["Pyramids of Giza", "giza-pyramids"], ["Great Sphinx of Giza", "giza-pyramids"], ["ギザのピラミッド", "giza-pyramids"],
    ["桌山缆车", "table-mountain"], ["Table Mountain Aerial Cableway", "table-mountain"], ["Tafelberg", "table-mountain"],
    ["维多利亚瀑布（津巴布韦一侧）", "victoria-falls"], ["Mosi-oa-Tunya", "victoria-falls"], ["Victoria Falls Bridge", "victoria-falls"],
    ["乞力马扎罗山", "kilimanjaro"], ["Mt. Kilimanjaro", "kilimanjaro"], ["Uhuru Peak", "kilimanjaro"],
    ["哈桑二世大清真寺", "hassan-ii-mosque"], ["Mosquée Hassan II", "hassan-ii-mosque"],
    ["阿布辛拜勒神庙", "abu-simbel"], ["Abu Simbel", "abu-simbel"],
    ["马赛马拉", "masai-mara"], ["Masai Mara", "masai-mara"], ["Maasai Mara National Reserve", "masai-mara"],
    ["悉尼歌剧院", "sydney-opera-house"], ["Sydney Opera House", "sydney-opera-house"],
    ["悉尼海港大桥", "sydney-harbour-bridge"], ["Sydney Harbor Bridge", "sydney-harbour-bridge"], ["BridgeClimb Sydney", "sydney-harbour-bridge"],
    ["乌鲁鲁", "uluru"], ["艾尔斯岩", "uluru"], ["Ayers Rock", "uluru"], ["Uluru-Kata Tjuta National Park", "uluru"],
    ["大堡礁", "great-barrier-reef"], ["Heart Reef", "great-barrier-reef"],
    ["米尔福德峡湾游船", "milford-sound"], ["Milford Sound", "milford-sound"], ["Mitre Peak", "milford-sound"],
    ["舍夫沙万", "chefchaouen"], ["Chefchaouen medina", "chefchaouen"], ["霍比特人村", "hobbiton"], ["Hobbiton Movie Set Tours", "hobbiton"],
    ["十二使徒岩", "twelve-apostles"], ["大洋路十二门徒", "twelve-apostles"], ["The Twelve Apostles", "twelve-apostles"], ["12 Apostles", "twelve-apostles"],
  ];
  for (const [name, id] of yes) assert.equal(famousFor({ name, category: "sight" })?.id, id, name);
});

/** 一个模型用到的颜色（贴图里的颜色都算），相差很小的同一色只算一次 */
function coloursOf(g: THREE.Object3D): number {
  const cols: number[][] = [];
  const put = (c: number[]) => { if (!cols.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) < 10)) cols.push(c); };
  g.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; const m = mesh.material as THREE.MeshStandardMaterial;
    if (m.map) { const d = (m.map.image as { data: Uint8Array }).data; for (let i = 0; i < d.length; i += 4) put([d[i], d[i + 1], d[i + 2]]); }
    else if (m.userData.base) put(m.userData.base as number[]);   // mat() 记下的设计原色（D89 之后 color 是提过饱和的）
    else { const c = m.color.clone().convertLinearToSRGB(); put([c.r * 255, c.g * 255, c.b * 255]); }
  });
  return cols.length;
}

test("非洲、大洋洲名胜模型：在 Node 里能建出来，尺寸、网格数、颜色数在约定范围内", () => {
  const bb = new THREE.Box3();
  for (const [key, make] of [...Object.entries(MODELS_AFRICA), ...Object.entries(MODELS_OCEANIA)]) {
    const lm = make(7);
    let meshes = 0;
    lm.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    bb.setFromObject(lm.group);
    assert.ok(lm.top > 0 && lm.footprint > 0, `${key}: top / footprint`);
    assert.ok(meshes > 0 && meshes <= 100, `${key}: 网格 ${meshes} 个`);
    const colours = coloursOf(lm.group); assert.ok(colours <= 5, `${key}: 用了 ${colours} 种颜色`);
    assert.ok(lm.top >= bb.max.y && lm.top <= bb.max.y + 0.6, `${key}: 标签高度 ${lm.top} 与最高点 ${bb.max.y.toFixed(2)} 不符`);
    assert.ok(bb.max.y >= 1.2 && bb.max.y <= 5.6, `${key}: 高度 ${bb.max.y.toFixed(2)} 不在 1.2～5.6`);
    assert.ok(Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z) <= 2.6, `${key}: 占地超出格子`);
    assert.ok(bb.min.y >= -0.05, `${key}: 有东西埋到地面以下 ${bb.min.y.toFixed(2)}`);
    lm.update?.(1.5); lm.update?.(9);
  }
});
