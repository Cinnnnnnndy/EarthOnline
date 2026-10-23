/** 城市底板 → three.js 场景：地面格、路网、轨道、水、丘、树、竹、民居、地标积木、当天路线丝带与站点图钉 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CityPlate, Landmark } from "../algo/city.ts";
import type { Route } from "../algo/route.ts";
import type { WorldSpec } from "../spec/types.ts";
import { mulberry32 } from "../algo/prng.ts";
import { lumpySphere } from "./geom.ts";
import { LZ, col, toneOf, LANTERN, type WorldStyle, type RGB } from "./style.ts";
import type { NightSpots } from "./night.ts";

export interface PlateBuild {
  group: THREE.Group;
  landmarks: Map<string, THREE.Group>;
  pins: Map<string, THREE.Group>;
  ribbon: THREE.Mesh | null;
  /** 夜里可以放灯、蘑菇、萤火的地方（D85；白天也算好，不贵） */
  nightSpots: NightSpots;
  dispose(): void;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function inst(geo: THREE.BufferGeometry, mat: THREE.Material, items: { p: [number, number, number]; s?: [number, number, number]; ry?: number }[], shadow = true): THREE.InstancedMesh | null {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => { _p.set(...it.p); _s.set(...(it.s ?? [1, 1, 1])); _q.setFromEuler(_e.set(0, it.ry ?? 0, 0)); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); });
  im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; return im;
}

export function canopyColors(style: WorldStyle, season: WorldSpec["season"]): RGB[] {
  const T = toneOf(style);                                   // 夜里连红叶、樱花也压暗
  if (season === "autumn") return [...style.canopy.slice(0, 2), ...([[214, 96, 60], [232, 150, 60], [196, 70, 50]] as RGB[]).map(T)];
  if (season === "spring") return [...style.canopy.slice(0, 2), ...([[244, 170, 196], [255, 200, 216]] as RGB[]).map(T)];
  if (season === "winter") return ([[120, 150, 120], [150, 170, 150], [236, 240, 244]] as RGB[]).map(T);
  return style.canopy;
}

export function buildPlate(plate: CityPlate, spec: WorldSpec, style: WorldStyle, route: Route | null): PlateBuild {
  const g = new THREE.Group(); g.name = "plate";
  const rng = mulberry32(spec.seed ^ 0x9e3779b9);
  const mats: THREE.Material[] = []; const geos: THREE.BufferGeometry[] = [];
  const M = (c: RGB, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => { const m = new THREE.MeshStandardMaterial({ color: col(c), roughness: rough, ...extra }); mats.push(m); return m; };
  const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const add = (o: THREE.Object3D | null) => { if (o) g.add(o); };
  const { cols, rows } = plate; const T = toneOf(style);
  const spots: NightSpots = { ground: [], lamps: [], houses: [], fire: null, cols, rows };

  // 展示台座
  const base = new THREE.Mesh(G(new RoundedBoxGeometry(cols + 1.4, 0.7, rows + 1.4, 3, 0.16)), M(style.base, 0.55));
  base.position.set(cols / 2, -0.16 - 0.35, rows / 2); base.receiveShadow = true; g.add(base);

  // 地面：按类别实例化
  const perClass: Record<string, [number, number, number][]> = {};
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const c = plate.cell(x, y); (perClass[c] ??= []).push([x + 0.5, 0, y + 0.5]); }
  const cellGeo = G(new THREE.BoxGeometry(1, 0.16, 1)), waterGeo = G(new THREE.BoxGeometry(1, 0.13, 1));
  for (const cls in perClass) {
    const water = cls === "W" || cls === "O";
    const mat = water ? M(cls === "O" ? style.deepWater : style.water, 0.14, { metalness: 0.05, envMapIntensity: 1.2 }) : M(style.ground[cls] ?? style.ground.U, 0.92);
    add(inst(water ? waterGeo : cellGeo, mat, perClass[cls].map((p) => ({ p: [p[0], water ? -0.095 : -0.08, p[2]] as [number, number, number] })), false));
  }

  // 路网与轨道
  const roadMat = M(style.road, 0.8), bridgeMat = M(style.bridge, 0.7), railMat = M(style.rail, 0.5), tieMat = M(style.tie, 0.8);
  const hGeo = G(new THREE.BoxGeometry(1, 0.05, 0.44)), vGeo = G(new THREE.BoxGeometry(0.44, 0.06, 1));
  const cellsOf = (set: Set<number>) => [...set].map((k) => [k % cols, Math.floor(k / cols)] as [number, number]);
  const hr = cellsOf(plate.hroads), vr = cellsOf(plate.vroads);
  add(inst(hGeo, roadMat, hr.filter((c) => !plate.isWater(...c)).map((c) => ({ p: [c[0] + 0.5, 0.025, c[1] + 0.5] as [number, number, number] })), false));
  add(inst(hGeo, bridgeMat, hr.filter((c) => plate.isWater(...c)).map((c) => ({ p: [c[0] + 0.5, 0.025, c[1] + 0.5] as [number, number, number] })), false));
  add(inst(vGeo, roadMat, vr.filter((c) => !plate.isWater(...c)).map((c) => ({ p: [c[0] + 0.5, 0.03, c[1] + 0.5] as [number, number, number] })), false));
  add(inst(vGeo, bridgeMat, vr.filter((c) => plate.isWater(...c)).map((c) => ({ p: [c[0] + 0.5, 0.03, c[1] + 0.5] as [number, number, number] })), false));
  const railH = G(new THREE.BoxGeometry(1, 0.05, 0.03)), railV = G(new THREE.BoxGeometry(0.03, 0.05, 1)), tieH = G(new THREE.BoxGeometry(0.08, 0.03, 0.26)), tieV = G(new THREE.BoxGeometry(0.26, 0.03, 0.08));
  const hrl = cellsOf(plate.hrails), vrl = cellsOf(plate.vrails);
  add(inst(railH, railMat, hrl.flatMap((c) => [0.44, 0.56].map((k) => ({ p: [c[0] + 0.5, 0.045, c[1] + k] as [number, number, number] }))), false));
  add(inst(tieH, tieMat, hrl.flatMap((c) => [0.17, 0.5, 0.83].map((k) => ({ p: [c[0] + k, 0.015, c[1] + 0.5] as [number, number, number] }))), false));
  add(inst(railV, railMat, vrl.flatMap((c) => [0.44, 0.56].map((k) => ({ p: [c[0] + k, 0.045, c[1] + 0.5] as [number, number, number] }))), false));
  add(inst(tieV, tieMat, vrl.flatMap((c) => [0.17, 0.5, 0.83].map((k) => ({ p: [c[0] + 0.5, 0.015, c[1] + k] as [number, number, number] }))), false));

  // 丘、树、竹、民居、公园
  const canopyCols = canopyColors(style, spec.season);
  const canopyMats = canopyCols.map((c) => M(c, 0.75));
  const canopyGeos = [0, 1, 2].map((i) => G(lumpySphere(1, spec.seed + i, 0.3)));
  const trunkGeo = G(new THREE.CylinderGeometry(0.06, 0.08, 1, 8)), trunkMat = M(style.trunk, 0.9);
  const hillGeo = G(new THREE.SphereGeometry(1, 20, 12)), hillMats = style.hill.map((c) => M(c, 0.9));
  const bambooGeo = G(new THREE.CylinderGeometry(0.03, 0.035, 1, 6)), bambooMat = M(style.bamboo, 0.6);
  const houseGeo = G(new RoundedBoxGeometry(0.4, 0.45 * LZ, 0.4, 2, 0.03)), roofGeo = G(new RoundedBoxGeometry(0.48, 0.15 * LZ, 0.48, 2, 0.02));
  const houseMat = M(style.house, 0.8), roofMat = M(style.roof, 0.7);
  const trunks: { p: [number, number, number]; s: [number, number, number] }[] = [];
  const canopies: { p: [number, number, number]; s: [number, number, number]; ry: number; mat: number; geo: number }[][] = canopyMats.map(() => []);
  const hills: { p: [number, number, number]; s: [number, number, number] }[][] = hillMats.map(() => []);
  const bamboos: { p: [number, number, number]; s: [number, number, number] }[] = [];
  const houses: { p: [number, number, number] }[] = [], roofs: { p: [number, number, number] }[] = [];
  const tree = (x: number, y: number, k: number, lobes = 3) => {
    trunks.push({ p: [x, 0.3 * k, y], s: [k, 0.6 * k, k] });
    const mi = rng.int(canopyMats.length);
    const spots: [number, number, number, number][] = [[0, 0.72, 0, 0.36], [-0.18, 0.88, -0.12, 0.26], [0.16, 0.96, 0.12, 0.24]];
    for (let i = 0; i < lobes; i++) { const [dx, dy, dz, r] = spots[i]; canopies[mi].push({ p: [x + dx * k, dy * k, y + dz * k], s: [r * k, r * k, r * k], ry: rng.next() * 6.28, mat: mi, geo: rng.int(3) }); }
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = plate.cell(x, y); const cx = x + 0.5, cy = y + 0.5; const k = plate.key(x, y);
    if (t === "M") {
      const h = 1 + ((x * 3 + y * 5) % 3); hills[h - 1].push({ p: [cx, -0.05, cy], s: [1.2, 0.95 * (0.32 + 0.22 * h), 1.2] });
      if ((x * 5 + y * 3) % 3 === 0) { const mi = rng.int(canopyMats.length); canopies[mi].push({ p: [cx, 0.62 + 0.2 * h, cy], s: [0.22, 0.22, 0.22], ry: rng.next() * 6, mat: mi, geo: rng.int(3) }); }
    } else if (t === "F" && (x * 5 + y * 3) % 2 === 0) tree(cx, cy, 0.85 + rng.next() * 0.35);
    else if (t === "Z") for (const [u, v, hh] of [[0.2, 0.3, 1.4], [0.6, 0.15, 1.7], [0.45, 0.7, 1.3], [0.8, 0.6, 1.55]] as const) bamboos.push({ p: [x + u, hh / 2, y + v], s: [1, hh, 1] });
    else if (t === "U" && (x * 7 + y * 13) % 5 === 0 && !plate.hroads.has(k) && !plate.vroads.has(k) && !plate.nohouse.has(k) && rng.next() < 0.35 + spec.decorDensity * 0.65) { houses.push({ p: [cx, 0.225 * LZ, cy] }); roofs.push({ p: [cx, 0.525 * LZ, cy] }); }
    else if (t === "P" && (x * 7 + y * 13) % 4 === 0 && rng.next() < 0.3 + spec.decorDensity * 0.7) tree(cx, cy, 0.75, 1);
    // 夜里：草地、树林、公园、竹林里可以放蘑菇、起萤火
    if ((t === "G" || t === "F" || t === "P" || t === "Z") && !plate.hroads.has(k) && !plate.vroads.has(k)) spots.ground.push([cx + (rng.next() - 0.5) * 0.5, 0, cy + (rng.next() - 0.5) * 0.5]);
  }
  for (const h of houses) spots.houses.push({ x: h.p[0], y: h.p[1], z: h.p[2] });
  add(inst(trunkGeo, trunkMat, trunks));
  canopies.forEach((list, mi) => { for (let gi = 0; gi < 3; gi++) add(inst(canopyGeos[gi], canopyMats[mi], list.filter((c) => c.geo === gi))); });
  hills.forEach((list, hi) => add(inst(hillGeo, hillMats[hi], list)));
  add(inst(bambooGeo, bambooMat, bamboos));
  add(inst(houseGeo, houseMat, houses)); add(inst(roofGeo, roofMat, roofs));

  // 地标积木：每个地标一个 Group（可点、可点亮），盒子按颜色合并
  const landmarks = new Map<string, THREE.Group>();
  const lmMat = new Map<string, THREE.MeshStandardMaterial>();
  const matFor = (c: RGB) => { const key = c.join(","); let m = lmMat.get(key); if (!m) { m = M(c, 0.6); lmMat.set(key, m); } return m; };
  plate.landmarks.forEach((lm: Landmark, li) => {
    const grp = new THREE.Group(); grp.name = lm.name || lm.kind; grp.userData = { landmark: lm.name, kind: lm.kind, index: li };
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    for (const b of lm.boxes) {
      const w = b.x1 - b.x0, d = b.y1 - b.y0, h = (b.z1 - b.z0) * LZ;
      const bg = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, w / 3, d / 3, h / 3)); bg.translate((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 * LZ, (b.y0 + b.y1) / 2);
      (byColor.get(b.base.join(",")) ?? byColor.set(b.base.join(","), []).get(b.base.join(","))!).push(bg);
      if (b.top) { const tg = new RoundedBoxGeometry(w * 0.96, 0.02, d * 0.96, 1, 0.005); tg.translate((b.x0 + b.x1) / 2, b.z1 * LZ + 0.01, (b.y0 + b.y1) / 2); (byColor.get(b.top.join(",")) ?? byColor.set(b.top.join(","), []).get(b.top.join(","))!).push(tg); }
    }
    for (const [key, list] of byColor) {
      const merged = mergeGeometries(list, false); list.forEach((x) => x.dispose()); if (!merged) continue; G(merged);
      const mesh = new THREE.Mesh(merged, matFor(T(key.split(",").map(Number) as RGB))); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = grp.userData; grp.add(mesh);
    }
    g.add(grp); if (lm.name) landmarks.set(lm.name, grp);
  });

  // 当天路线丝带 + 站点图钉
  let ribbon: THREE.Mesh | null = null; const pins = new Map<string, THREE.Group>();
  if (route) {
    const segs: THREE.BufferGeometry[] = [];
    for (let i = 1; i < route.path.length; i++) {
      const a = route.path[i - 1], b = route.path[i]; const vert = a[0] === b[0];
      const bg = new THREE.BoxGeometry(vert ? 0.2 : 1.05, 0.03, vert ? 1.05 : 0.2); bg.translate((a[0] + b[0]) / 2 + 0.5, 0.085, (a[1] + b[1]) / 2 + 0.5); segs.push(bg);
    }
    if (segs.length) { const merged = mergeGeometries(segs, false); segs.forEach((x) => x.dispose()); if (merged) { ribbon = new THREE.Mesh(G(merged), M(style.pathRibbon, 0.6, { transparent: true, opacity: 0.85 })); ribbon.receiveShadow = true; g.add(ribbon); } }
    const pinGeo = G(new THREE.ConeGeometry(0.16, 0.5, 12)), headGeo = G(new THREE.SphereGeometry(0.2, 16, 12));
    const mkPin = (id: string, x: number, z: number, topz: number, c: RGB, data: Record<string, unknown>) => {
      const p = new THREE.Group(); const mat = M(c, 0.35, { emissive: col(c), emissiveIntensity: 0.15 });
      const cone = new THREE.Mesh(pinGeo, mat); cone.rotation.x = Math.PI; cone.position.y = 0.25; const ball = new THREE.Mesh(headGeo, mat); ball.position.y = 0.58;
      cone.castShadow = ball.castShadow = true; p.add(cone, ball); p.position.set(x, topz * LZ + 0.12, z); p.userData = { ...data, baseY: p.position.y, mat }; g.add(p); pins.set(id, p);
      spots.lamps.push([x, p.position.y + 0.58, z]); return p;
    };
    const pinColor = style.night ? LANTERN : style.accent;   // 夜里图钉是灯
    route.stops.forEach((s, i) => { const lm = plate.landmarks.find((l) => l.name === s.landmark); mkPin(s.entryId, s.center[0], s.center[1], lm?.topz ?? 0.3, s.visited ? style.gold : pinColor, { stopIndex: i, entryId: s.entryId, landmark: s.landmark }); });
    if (route.lodging && !route.lodging.offPlate && route.lodging.center) { const lm = plate.landmarks.find((l) => l.name === route.lodging!.landmark); mkPin("lodging", route.lodging.center[0], route.lodging.center[1], lm?.topz ?? 0.3, style.night ? LANTERN : style.accent2, { lodging: true, landmark: route.lodging.landmark }); }
  }

  return { group: g, landmarks, pins, ribbon, nightSpots: spots, dispose: () => { mats.forEach((m) => m.dispose()); geos.forEach((x) => x.dispose()); } };
}
