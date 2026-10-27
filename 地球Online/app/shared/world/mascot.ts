/** 人物形态（第八轮末，D86）：小人之外的造型——仓库主人：「不只是人，有其他的一些造型，动物或者比较 Q 版的造型」「还有一些可以考虑自建 IP 的造型」。
 *  这里是用积木（landmark-kit）拼的一批 Q 版角色，和小人（hero.ts）走同一个接口（Character：setAvatar / setVehicle / face / celebrate / update），
 *  某一天的世界、行李箱、实验台都能换着用：
 *  - 动物十一只：狐狸、猫、柴犬、小熊、兔子、企鹅、熊猫、小鸭（圆身、大头、短腿；四条腿的走路摆腿，两条腿的摇摇摆摆），
 *    加仓库主人点名的三只（D89b，「我喜欢海豹还有海獭。还有 capybara。」）：海豹（一身斑点、两只鳍、胡须）、海獭（抱着一只蛤蜊）、水豚（头顶一颗柚子）；
 *  - 自建 IP 三只（不是任何现成的角色）：豆丁（一粒发了芽的豆子，头顶两片叶子）、云团（一朵会飘的小云，没有脚）、石头精（长着一簇青苔的圆石头，苔上一朵小白花）。
 *  帽子（毛线帽 / 草帽）与围巾跟着捏人面板的颜色；潮玩质感（look.ts）；眨眼、呼吸、摇尾巴；坐车 / 坐船 / 坐飞机用积木拼的小载具。 */
import * as THREE from "three";
import { mat, add, box, cyl, cone, ball, type RGB } from "./landmark-kit.ts";
import { lumpySphere } from "./geom.ts";
import { applyToyLook } from "./look.ts";
import { HAT_COLORS, DRESS_COLORS, type Outfit, type Vehicle } from "./hero.ts";
import { AVATAR_FORMS, type Avatar, type AvatarForm } from "../spec/types.ts";

/** 小人之外的形态（契约 AVATAR_FORMS 去掉 human） */
export const MASCOT_FORMS = AVATAR_FORMS.filter((f): f is Exclude<AvatarForm, "human"> => f !== "human");
export type MascotForm = Exclude<AvatarForm, "human">;
export const isMascotForm = (x: unknown): x is MascotForm => typeof x === "string" && (MASCOT_FORMS as readonly string[]).includes(x);

const INK: RGB = [40, 36, 40], WHITE: RGB = [250, 248, 244], PINK: RGB = [244, 170, 170], ORANGE: RGB = [240, 150, 60], CREAM: RGB = [250, 238, 216];
const PI = Math.PI;

interface AnimalSpec {
  fur: RGB; belly?: RGB; dark?: RGB;
  body: { r: number; sy: number; y: number };
  head: { r: number; y: number; sx?: number; sy?: number };
  ears?: { kind: "point" | "round" | "long" | "flap"; dx: number; y: number; z?: number; s: number; tilt?: number; inner?: RGB; c?: RGB };
  muzzle?: { r: number; y: number; z: number; c: RGB; nose?: RGB; sx?: number };
  beak?: { w: number; y: number; z: number; c: RGB; flat?: boolean };
  eyes: { dx: number; y: number; z: number; r: number; patch?: RGB };
  cheeks?: RGB;
  legs: { n: 4 | 2; r: number; h: number; dx: number; dz: number; c?: RGB; foot?: RGB };
  arms?: { c?: RGB; flipper?: boolean };
  tail?: { kind: "bushy" | "curl" | "stub" | "feather"; c?: RGB; tip?: RGB };
  patches?: boolean;
  /** 背上与头上的斑点（海豹） */
  spots?: { c: RGB; n: number; r: number };
  /** 胡须的颜色（海豹、海獭） */
  whiskers?: RGB;
  /** 抱着 / 顶着的东西：clam 胸前一只蛤蜊（海獭），yuzu 头顶一颗柚子（水豚泡温泉的那个样子） */
  held?: "clam" | "yuzu";
}
const ANIMALS: Record<Exclude<MascotForm, "bean" | "cloud" | "pebble">, AnimalSpec> = {
  fox: { fur: [236, 126, 54], belly: CREAM, body: { r: 0.42, sy: 1.05, y: 0.62 }, head: { r: 0.46, y: 1.2, sy: 0.9 }, ears: { kind: "point", dx: 0.3, y: 0.3, s: 1, inner: CREAM },
    muzzle: { r: 0.2, y: -0.1, z: 0.34, c: CREAM, nose: INK, sx: 1.3 }, eyes: { dx: 0.17, y: 0.06, z: 0.4, r: 0.055 }, cheeks: [240, 160, 120],
    legs: { n: 4, r: 0.1, h: 0.34, dx: 0.22, dz: 0.16, c: [70, 46, 40] }, tail: { kind: "bushy", tip: CREAM } },
  cat: { fur: [238, 168, 92], belly: WHITE, body: { r: 0.4, sy: 1.0, y: 0.58 }, head: { r: 0.46, y: 1.14, sx: 1.05, sy: 0.88 }, ears: { kind: "point", dx: 0.28, y: 0.3, s: 0.8, inner: PINK },
    muzzle: { r: 0.16, y: -0.12, z: 0.36, c: WHITE, nose: PINK, sx: 1.4 }, eyes: { dx: 0.17, y: 0.05, z: 0.4, r: 0.055 }, cheeks: PINK,
    legs: { n: 4, r: 0.09, h: 0.3, dx: 0.2, dz: 0.15 }, tail: { kind: "curl" } },
  shiba: { fur: [226, 164, 92], belly: WHITE, body: { r: 0.42, sy: 1.0, y: 0.6 }, head: { r: 0.46, y: 1.16, sy: 0.9 }, ears: { kind: "point", dx: 0.27, y: 0.32, s: 0.75, inner: PINK },
    muzzle: { r: 0.2, y: -0.1, z: 0.34, c: WHITE, nose: INK, sx: 1.25 }, eyes: { dx: 0.17, y: 0.07, z: 0.4, r: 0.055 }, cheeks: [240, 170, 130],
    legs: { n: 4, r: 0.1, h: 0.32, dx: 0.22, dz: 0.16, c: WHITE }, tail: { kind: "curl", tip: WHITE } },
  bear: { fur: [150, 104, 66], belly: [214, 176, 130], body: { r: 0.46, sy: 1.0, y: 0.62 }, head: { r: 0.46, y: 1.2, sy: 0.92 }, ears: { kind: "round", dx: 0.3, y: 0.3, s: 1, inner: [214, 176, 130] },
    muzzle: { r: 0.2, y: -0.1, z: 0.34, c: [214, 176, 130], nose: INK, sx: 1.2 }, eyes: { dx: 0.17, y: 0.06, z: 0.4, r: 0.055 },
    legs: { n: 4, r: 0.12, h: 0.32, dx: 0.24, dz: 0.16 }, tail: { kind: "stub" } },
  rabbit: { fur: WHITE, belly: [250, 232, 232], body: { r: 0.4, sy: 1.0, y: 0.58 }, head: { r: 0.46, y: 1.14, sy: 0.92 }, ears: { kind: "long", dx: 0.18, y: 0.34, s: 1, inner: PINK },
    muzzle: { r: 0.12, y: -0.12, z: 0.38, c: WHITE, nose: PINK, sx: 1.2 }, eyes: { dx: 0.17, y: 0.05, z: 0.4, r: 0.055 }, cheeks: PINK,
    legs: { n: 4, r: 0.1, h: 0.28, dx: 0.2, dz: 0.15 }, tail: { kind: "stub" } },
  penguin: { fur: [44, 48, 62], belly: WHITE, body: { r: 0.44, sy: 1.15, y: 0.62 }, head: { r: 0.42, y: 1.22, sy: 0.9 }, beak: { w: 0.14, y: -0.06, z: 0.36, c: ORANGE },
    eyes: { dx: 0.15, y: 0.05, z: 0.36, r: 0.055, patch: WHITE }, cheeks: [250, 190, 170],
    legs: { n: 2, r: 0.09, h: 0.16, dx: 0.14, dz: 0.04, c: ORANGE, foot: ORANGE }, arms: { flipper: true } },
  panda: { fur: WHITE, dark: INK, body: { r: 0.46, sy: 1.0, y: 0.62 }, head: { r: 0.48, y: 1.22, sx: 1.06, sy: 0.9 }, ears: { kind: "round", dx: 0.32, y: 0.3, s: 0.95, c: INK },
    muzzle: { r: 0.16, y: -0.14, z: 0.38, c: WHITE, nose: INK, sx: 1.3 }, eyes: { dx: 0.17, y: 0.06, z: 0.4, r: 0.05, patch: INK },
    legs: { n: 4, r: 0.12, h: 0.32, dx: 0.24, dz: 0.16, c: INK }, tail: { kind: "stub" }, patches: true },
  duck: { fur: [246, 206, 70], body: { r: 0.42, sy: 0.95, y: 0.56 }, head: { r: 0.42, y: 1.1, sy: 0.92 }, beak: { w: 0.22, y: -0.08, z: 0.34, c: ORANGE, flat: true },
    eyes: { dx: 0.15, y: 0.06, z: 0.36, r: 0.055 }, cheeks: [250, 170, 120],
    legs: { n: 2, r: 0.07, h: 0.18, dx: 0.14, dz: 0.02, c: ORANGE, foot: ORANGE }, arms: { flipper: true }, tail: { kind: "feather" } },
  // ---- D89b：仓库主人点名的三只
  seal: { fur: [204, 212, 224], belly: [240, 242, 246], body: { r: 0.46, sy: 0.95, y: 0.56 }, head: { r: 0.42, y: 1.08, sy: 0.9 },   // 海豹：银灰、一身斑点、大黑眼睛、两只小鳍，尾巴是后鳍
    muzzle: { r: 0.17, y: -0.09, z: 0.34, c: [228, 232, 238], nose: INK, sx: 1.4 }, eyes: { dx: 0.16, y: 0.06, z: 0.38, r: 0.075 }, cheeks: [236, 196, 196],
    legs: { n: 2, r: 0.07, h: 0.1, dx: 0.14, dz: -0.04 }, arms: { flipper: true }, tail: { kind: "feather" }, spots: { c: [152, 162, 180], n: 9, r: 0.045 }, whiskers: [120, 124, 136] },
  otter: { fur: [128, 88, 58], belly: [206, 176, 140], body: { r: 0.42, sy: 1.15, y: 0.6 }, head: { r: 0.44, y: 1.22, sy: 0.88 }, ears: { kind: "round", dx: 0.34, y: 0.16, s: 0.5 },   // 海獭：深棕、脸和肚子浅、小圆耳、胡须，胸前抱着一只蛤蜊
    muzzle: { r: 0.2, y: -0.1, z: 0.34, c: [222, 196, 160], nose: INK, sx: 1.3 }, eyes: { dx: 0.16, y: 0.08, z: 0.4, r: 0.055 }, cheeks: [236, 180, 160],
    legs: { n: 2, r: 0.08, h: 0.14, dx: 0.15, dz: 0.02, c: [96, 66, 44] }, arms: {}, tail: { kind: "feather" }, whiskers: [244, 236, 226], held: "clam" },
  capybara: { fur: [184, 136, 86], belly: [208, 170, 122], body: { r: 0.48, sy: 0.95, y: 0.58 }, head: { r: 0.42, y: 1.12, sy: 0.9 }, ears: { kind: "round", dx: 0.3, y: 0.3, s: 0.45, c: [150, 108, 66] },   // 水豚：方方的大鼻口、小耳朵、四条短腿，头顶一颗柚子
    muzzle: { r: 0.27, y: -0.1, z: 0.3, c: [168, 122, 74], nose: INK, sx: 1.25 }, eyes: { dx: 0.2, y: 0.08, z: 0.36, r: 0.05 }, cheeks: [214, 160, 120],
    legs: { n: 4, r: 0.1, h: 0.26, dx: 0.24, dz: 0.18, c: [150, 108, 66] }, tail: { kind: "stub", c: [150, 108, 66] }, held: "yuzu" },
};

interface Parts { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; tail: THREE.Group | null; ears: THREE.Group[]; eyes: THREE.Mesh[]; headR: number; neckY: number; hover: boolean; hop: boolean }

function eyesOn(head: THREE.Group, e: AnimalSpec["eyes"], out: THREE.Mesh[]) {
  for (const s of [-1, 1]) {
    if (e.patch) add(head, ball(e.r * 2.2), mat(e.patch, 0.8), s * e.dx, e.y, e.z - 0.02).scale.set(1, 1.25, 0.6);
    const eye = add(head, ball(e.r), mat(INK, 0.25), s * e.dx, e.y, e.z); eye.userData.base = 1; out.push(eye);
    const hl = new THREE.Mesh(ball(e.r * 0.38), mat(WHITE, 0.3)); hl.position.set(-s * e.r * 0.35, e.r * 0.35, e.r * 0.75); eye.add(hl);   // 高光
  }
}

function animal(sp: AnimalSpec): Parts {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const fur = mat(sp.fur, 0.85), belly = mat(sp.belly ?? sp.fur, 0.9);
  add(body, ball(sp.body.r), fur, 0, sp.body.y, 0).scale.set(1, sp.body.sy, 0.9);
  if (sp.belly) add(body, ball(sp.body.r * 0.8), belly, 0, sp.body.y - sp.body.r * 0.08, sp.body.r * 0.36).scale.set(0.82, sp.body.sy * 0.88, 0.5);
  const head = new THREE.Group(); head.position.set(0, sp.head.y, 0.02); body.add(head);
  add(head, ball(sp.head.r), fur, 0, 0, 0).scale.set(sp.head.sx ?? 1, sp.head.sy ?? 0.92, 1);
  const ears: THREE.Group[] = []; const eyes: THREE.Mesh[] = [];
  if (sp.ears) {
    const e = sp.ears; const earMat = mat(e.c ?? sp.fur, 0.85);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * e.dx, e.y, e.z ?? -0.02); g.rotation.z = -s * (e.tilt ?? 0.25); head.add(g); ears.push(g);
      if (e.kind === "point") { add(g, cone(0.15 * e.s, 0.32 * e.s, 8), earMat, 0, 0.14 * e.s, 0); if (e.inner) add(g, cone(0.08 * e.s, 0.2 * e.s, 8), mat(e.inner, 0.9), 0, 0.12 * e.s, 0.06 * e.s); }
      else if (e.kind === "round") { add(g, ball(0.15 * e.s), earMat, 0, 0.08 * e.s, 0); if (e.inner) add(g, ball(0.08 * e.s), mat(e.inner, 0.9), 0, 0.08 * e.s, 0.1 * e.s).scale.set(1, 1, 0.5); }
      else if (e.kind === "long") { add(g, ball(0.1 * e.s), earMat, 0, 0.28 * e.s, 0).scale.set(1, 3.2, 0.7); if (e.inner) add(g, ball(0.06 * e.s), mat(e.inner, 0.9), 0, 0.3 * e.s, 0.06 * e.s).scale.set(1, 3.4, 0.5); }
      else { add(g, ball(0.12 * e.s), earMat, 0, -0.05 * e.s, 0).scale.set(0.8, 1.6, 0.6); }
    }
  }
  if (sp.muzzle) { const m = sp.muzzle; add(head, ball(m.r), mat(m.c, 0.9), 0, m.y, m.z).scale.set(m.sx ?? 1, 0.8, 0.8); if (m.nose) add(head, ball(m.r * 0.38), mat(m.nose, 0.3), 0, m.y + m.r * 0.3, m.z + m.r * 0.62).scale.set(1.3, 0.8, 0.8); }
  if (sp.beak) { const b = sp.beak; if (b.flat) add(head, box(b.w * 2, 0.07, b.w * 1.2, 0.03), mat(b.c, 0.5), 0, b.y, b.z + b.w * 0.4); else add(head, cone(b.w, b.w * 2.2, 10), mat(b.c, 0.5), 0, b.y, b.z + b.w * 0.8).rotation.x = PI / 2; }
  eyesOn(head, sp.eyes, eyes);
  if (sp.cheeks) for (const s of [-1, 1]) add(head, ball(0.07), mat(sp.cheeks, 0.9), s * 0.3, -0.06, 0.32).scale.set(1, 0.7, 0.5);
  if (sp.patches) for (const s of [-1, 1]) add(body, ball(0.18), mat(INK, 0.85), s * 0.36, sp.body.y + 0.12, 0.16).scale.set(0.7, 1.2, 0.7);   // 熊猫：肩上两块黑
  if (sp.whiskers && sp.muzzle) { const m = sp.muzzle, wm = mat(sp.whiskers, 0.6); for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const w = add(head, cyl(0.006, 0.006, 0.2, 4), wm, s * (m.r * (m.sx ?? 1) + 0.08), m.y + 0.03 - k * 0.05, m.z + 0.02); w.rotation.z = PI / 2 + s * (0.12 + k * 0.22); w.castShadow = false; } }   // 胡须：每边两根，一根平一根垂
  if (sp.spots) {   // 斑点：贴在身子后半与头顶，扁圆片，法线朝外
    const sm = mat(sp.spots.c, 0.9); const B = sp.body, cB = new THREE.Vector3(0, B.y, 0);
    for (let i = 0; i < sp.spots.n; i++) {
      const th = PI * 0.55 + (i / sp.spots.n) * PI * 0.9 + (i % 2) * 0.17, ph = 0.35 + ((i * 7) % 5) * 0.2;   // 背后半圈，高低错开
      const p = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * B.r, Math.cos(ph) * B.r * B.sy, Math.sin(ph) * Math.sin(th) * B.r * 0.9).add(cB);
      const d = add(body, ball(sp.spots.r * (0.8 + (i % 3) * 0.2)), sm, p.x, p.y, p.z); d.lookAt(cB); d.scale.set(1, 1, 0.35); d.castShadow = false;
    }
    for (const s of [-1, 1]) { const d = add(head, ball(sp.spots.r * 0.9), sm, s * 0.22, 0.26, -0.12); d.lookAt(0, 0, 0); d.scale.set(1, 1, 0.35); d.castShadow = false; }
  }
  if (sp.held === "yuzu") {   // 头顶一颗柚子：橙黄的球、一小截蒂、一片叶
    const top = sp.head.r * (sp.head.sy ?? 0.92); const g = new THREE.Group(); head.add(g); head.userData.yuzu = g;   // 戴帽子时整颗挪到帽顶（setAvatar）
    const yz = add(g, ball(0.13), mat([246, 192, 64], 0.6), 0.05, top + 0.08, 0.0); yz.scale.set(1, 0.88, 1);
    add(g, cyl(0.012, 0.012, 0.05, 6), mat([120, 90, 60], 0.8), 0.05, top + 0.21, 0.0); const leaf = add(g, box(0.1, 0.02, 0.05, 0.01), mat([110, 170, 90], 0.8), 0.1, top + 0.22, 0.0); leaf.rotation.z = 0.3;
  }
  if (sp.held === "clam") {   // 胸前抱着一只蛤蜊：两片壳，露一点珍珠
    const c = new THREE.Group(); c.position.set(0, sp.body.y + sp.body.r * 0.1, sp.body.r * 0.86); body.add(c);
    const top = add(c, ball(0.13), mat([230, 204, 172], 0.7), 0, 0.05, -0.02); top.scale.set(1.15, 0.5, 1); top.rotation.x = -0.55;
    const bot = add(c, ball(0.13), mat([206, 176, 146], 0.7), 0, -0.03, 0); bot.scale.set(1.15, 0.45, 1); bot.rotation.x = 0.15;
    add(c, ball(0.04), mat([250, 246, 240], 0.2), 0, 0.03, 0.04);
  }
  // 腿：髋部一个 Group，转它就是摆腿
  const legs: THREE.Group[] = []; const L = sp.legs; const legMat = mat(L.c ?? sp.fur, 0.85), footMat = mat(L.foot ?? L.c ?? sp.fur, 0.8);
  const hipY = sp.body.y - sp.body.r * sp.body.sy * 0.55;
  const spots: [number, number][] = L.n === 4 ? [[-L.dx, L.dz], [L.dx, L.dz], [-L.dx, -L.dz], [L.dx, -L.dz]] : [[-L.dx, L.dz], [L.dx, L.dz]];
  for (const [x, z] of spots) {
    const g = new THREE.Group(); g.position.set(x, hipY, z); body.add(g); legs.push(g);
    add(g, cyl(L.r, L.r * 1.1, L.h, 10), legMat, 0, -L.h / 2 + 0.04, 0);
    const f = add(g, ball(L.r * 1.25), footMat, 0, -L.h + 0.05, L.r * 0.4); f.scale.set(1, 0.55, 1.4);
  }
  const arms: THREE.Group[] = [];
  if (sp.arms) for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * sp.body.r * (sp.held === "clam" ? 0.8 : 0.95), sp.body.y + sp.body.r * 0.25, sp.held === "clam" ? 0.2 : 0.05); body.add(g); arms.push(g);   // 抱东西的手臂往前、往里收
    const a = add(g, ball(0.1), mat(sp.arms.c ?? sp.fur, 0.85), s * 0.04, -0.18, 0); a.scale.set(sp.arms.flipper ? 0.5 : 0.8, 2.2, 1); a.rotation.z = -s * 0.5;
  }
  let tail: THREE.Group | null = null;
  if (sp.tail) {
    tail = new THREE.Group(); tail.position.set(0, sp.body.y - 0.05, -sp.body.r * 0.85); body.add(tail); const t = sp.tail; const tm = mat(t.c ?? sp.fur, 0.9);
    if (t.kind === "bushy") { add(tail, ball(0.2), tm, 0, 0.12, -0.26).scale.set(1, 1.1, 1.8); add(tail, ball(0.14), mat(t.tip ?? WHITE, 0.9), 0, 0.3, -0.5); }
    else if (t.kind === "curl") { const r = new THREE.TorusGeometry(0.16, 0.07, 8, 16, PI * 1.5); add(tail, r, tm, 0, 0.3, -0.05).rotation.set(0.2, PI / 2, 0); if (t.tip) add(tail, ball(0.07), mat(t.tip, 0.9), 0, 0.14, 0.02); }
    else if (t.kind === "feather") { const f = add(tail, ball(0.1), tm, 0, 0.1, -0.1); f.scale.set(1.2, 0.6, 1.6); f.rotation.x = -0.6; }
    else add(tail, ball(0.1), mat(t.tip ?? sp.fur, 0.95), 0, 0.05, -0.06);
  }
  return { root, body, head, legs, arms, tail, ears, eyes, headR: sp.head.r, neckY: sp.head.y - sp.head.r * (sp.head.sy ?? 0.92) * 0.9, hover: false, hop: false };
}

/** 豆丁：一粒竖着的豆子，脸长在身上，头顶两片叶子，短手短脚 */
function bean(): Parts {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const skin = mat([200, 228, 176], 0.8), leaf = mat([110, 176, 96], 0.8);
  add(body, new THREE.CapsuleGeometry(0.42, 0.5, 6, 16), skin, 0, 0.78, 0).scale.set(1, 1, 0.92);
  const head = new THREE.Group(); head.position.set(0, 1.0, 0.02); body.add(head);      // 「头」就是豆子的上半，眼睛挂在这里
  const eyes: THREE.Mesh[] = []; eyesOn(head, { dx: 0.15, y: 0.02, z: 0.4, r: 0.055 }, eyes);
  for (const s of [-1, 1]) add(head, ball(0.07), mat(PINK, 0.9), s * 0.27, -0.1, 0.33).scale.set(1, 0.7, 0.5);
  add(head, new THREE.TorusGeometry(0.06, 0.018, 6, 12, PI), mat([120, 90, 80], 0.6), 0, -0.14, 0.42).rotation.set(0, 0, PI);   // 小嘴
  const sprout = new THREE.Group(); sprout.position.set(0, 0.46, 0); head.add(sprout);
  add(sprout, cyl(0.025, 0.03, 0.18, 6), leaf, 0, 0.09, 0);
  for (const s of [-1, 1]) { const l = add(sprout, ball(0.1), leaf, s * 0.12, 0.2, 0); l.scale.set(1.6, 0.35, 0.8); l.rotation.z = s * 0.5; }
  const legs: THREE.Group[] = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.16, 0.32, 0.05); body.add(g); legs.push(g); add(g, ball(0.11), skin, 0, -0.1, 0.02).scale.set(1, 0.6, 1.3); }
  const arms: THREE.Group[] = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.4, 0.78, 0.06); body.add(g); arms.push(g); const a = add(g, ball(0.09), skin, s * 0.05, -0.12, 0); a.scale.set(0.7, 1.8, 0.8); a.rotation.z = -s * 0.4; }
  return { root, body, head, legs, arms, tail: null, ears: [sprout], eyes, headR: 0.42, neckY: 0.62, hover: false, hop: true };
}
/** 云团：几团蓬松的球叠成一朵云，没有脚，飘着；底下一团淡蓝的影 */
function cloud(): Parts {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const puff = mat([250, 250, 255], 0.95), shade = mat([214, 226, 246], 0.95);
  const head = new THREE.Group(); head.position.set(0, 0.82, 0); body.add(head);
  const lumps: [number, number, number, number][] = [[0, 0, 0, 0.42], [-0.34, -0.06, 0.1, 0.3], [0.36, -0.04, 0.08, 0.3], [0.1, 0.26, -0.1, 0.28], [-0.14, 0.22, 0.12, 0.26], [0, -0.14, -0.22, 0.3], [0.2, -0.2, 0.2, 0.22], [-0.24, -0.18, -0.16, 0.24]];
  lumps.forEach(([x, y, z, r], i) => add(head, lumpySphere(r, 11 + i, 0.08), i > 4 ? shade : puff, x, y, z));
  const eyes: THREE.Mesh[] = []; eyesOn(head, { dx: 0.14, y: 0.0, z: 0.4, r: 0.05 }, eyes);
  for (const s of [-1, 1]) add(head, ball(0.06), mat(PINK, 0.9), s * 0.26, -0.1, 0.36).scale.set(1, 0.7, 0.5);
  add(head, new THREE.TorusGeometry(0.05, 0.016, 6, 12, PI), mat([120, 100, 110], 0.6), 0, -0.13, 0.43).rotation.set(0, 0, PI);
  return { root, body, head, legs: [], arms: [], tail: null, ears: [], eyes, headR: 0.5, neckY: 0.5, hover: true, hop: false };
}
/** 石头精：一块圆石头，顶上一簇青苔当头发，苔上一朵小白花，两只小石头脚 */
function pebble(): Parts {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const stone = mat([178, 180, 190], 0.95), moss = mat([128, 180, 98], 0.9);
  const head = new THREE.Group(); head.position.set(0, 0.72, 0); body.add(head);
  add(head, lumpySphere(0.5, 5, 0.06), stone, 0, 0, 0).scale.set(1.05, 0.9, 0.95);
  const cap = add(head, lumpySphere(0.36, 9, 0.12), moss, 0.02, 0.3, -0.04); cap.scale.set(1.15, 0.55, 1.1);
  for (let i = 0; i < 5; i++) add(head, ball(0.06), moss, Math.sin(i * 2.3) * 0.34, 0.26 + Math.cos(i * 1.7) * 0.08, Math.cos(i * 2.3) * 0.3);
  const flower = new THREE.Group(); flower.position.set(0.16, 0.5, 0.12); head.add(flower);
  add(flower, cyl(0.012, 0.012, 0.14, 5), moss, 0, 0.07, 0); for (let i = 0; i < 5; i++) add(flower, ball(0.035), mat(WHITE, 0.9), Math.sin((i / 5) * PI * 2) * 0.05, 0.15, Math.cos((i / 5) * PI * 2) * 0.05).scale.set(1, 0.5, 1); add(flower, ball(0.025), mat([240, 196, 80], 0.8), 0, 0.17, 0);
  const eyes: THREE.Mesh[] = []; eyesOn(head, { dx: 0.15, y: -0.02, z: 0.45, r: 0.05 }, eyes);
  for (const s of [-1, 1]) add(head, ball(0.06), mat([230, 170, 160], 0.9), s * 0.28, -0.12, 0.4).scale.set(1, 0.7, 0.5);
  const legs: THREE.Group[] = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.18, 0.26, 0.04); body.add(g); legs.push(g); add(g, ball(0.11), stone, 0, -0.1, 0.03).scale.set(1, 0.6, 1.3); }
  return { root, body, head, legs, arms: [], tail: null, ears: [flower], eyes, headR: 0.5, neckY: 0.3, hover: false, hop: true };
}

export function buildMascotParts(form: MascotForm): Parts {
  return form === "bean" ? bean() : form === "cloud" ? cloud() : form === "pebble" ? pebble() : animal(ANIMALS[form]);
}

/** 影子：一团柔和的灰，和小人一样 */
let shadowTex: THREE.CanvasTexture | null = null;
function shadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(20,30,40,0.9)"); g.addColorStop(1, "rgba(20,30,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c); return shadowTex;
}

export class Mascot {
  readonly group = new THREE.Group();
  readonly form: MascotForm;
  /** 和小人一样的钩子：显示前先编着色器；这里的材质简单，直接调用一次就行 */
  beforeShow: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
  private rig = new THREE.Group(); private parts!: Parts; private wear = new THREE.Group(); private vehicleRoot = new THREE.Group(); private shadow: THREE.Mesh;
  private outfit: Outfit = "puffer"; private avatar: Avatar | null = null; private vehicle: Vehicle = null;
  private t = 0; private phase = 0; private walk = 0; private celebrateT = 0; private blinkAt = 2 + Math.random() * 3; private baseScale: number;

  /** S 与小人同义（小人的 0.36 ≈ 1.75 高）；这里的角色天然 1.5 高，按比例换算 */
  constructor(form: MascotForm, S = 0.36) {
    this.form = form; this.baseScale = (S / 0.36) * 1.0; this.group.add(this.rig); this.rig.scale.setScalar(this.baseScale);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.3 }));
    this.shadow.rotation.x = -PI / 2; this.shadow.position.y = 0.015; this.shadow.renderOrder = 1; this.rig.add(this.shadow);
    this.rig.add(this.vehicleRoot);
    this.build();
  }
  private build() {
    if (this.parts) { this.parts.root.removeFromParent(); disposeTree(this.parts.root); }
    this.parts = buildMascotParts(this.form); this.rig.add(this.parts.root);
    this.parts.body.add(this.wear);
    this.parts.root.updateMatrixWorld(true); applyToyLook(this.parts.root);
    void this.beforeShow?.(this.rig).catch(() => {});
  }

  setAvatar(av: Avatar, outfit?: Outfit) {
    this.avatar = av; this.outfit = outfit ?? this.outfit;
    disposeTree(this.wear); this.wear.clear();
    const p = this.parts; const hc = HAT_COLORS[av.hatColor % HAT_COLORS.length]; const dc = DRESS_COLORS[av.dress % DRESS_COLORS.length];
    const headTop = p.head.position.y + p.headR * 0.85, r = p.headR;
    const yuzu = p.head.userData.yuzu as THREE.Group | undefined; if (yuzu) yuzu.position.y = av.hat === "cap" ? r * 0.62 : av.hat === "straw" ? r * 0.5 : 0;   // 水豚的柚子：戴帽子就顶在帽子上
    const W = new THREE.Group(); this.wear.add(W);
    if (av.hat === "cap") {
      add(W, ball(r * 0.98), mat(hc, 0.95), 0, headTop - r * 0.5, 0).scale.set(1, 0.75, 1);
      add(W, new THREE.TorusGeometry(r * 0.92, r * 0.12, 8, 24), mat(hc, 0.95), 0, headTop - r * 0.32, 0).rotation.x = PI / 2;
      add(W, ball(r * 0.22), mat([250, 246, 236], 1), 0, headTop + r * 0.3, 0);
    } else if (av.hat === "straw") {
      add(W, cyl(r * 1.7, r * 1.8, 0.05, 28), mat([236, 208, 140], 0.85), 0, headTop - r * 0.15, 0);
      add(W, cyl(r * 0.8, r * 0.95, r * 0.5, 24), mat([236, 208, 140], 0.85), 0, headTop + r * 0.1, 0);
      add(W, cyl(r * 0.97, r * 0.97, r * 0.12, 24), mat(hc, 0.7), 0, headTop - r * 0.06, 0);
    }
    // 围巾：脖子那一圈（云团没有脖子就不系）；外套色给一个小背包
    if (!p.hover) { const sc = add(W, new THREE.TorusGeometry(r * 0.72, r * 0.16, 8, 24), mat(hc, 0.95), 0, p.neckY + 0.02, 0.02); sc.rotation.x = PI / 2; sc.scale.set(1, 1, 0.8); add(W, box(r * 0.3, r * 0.5, r * 0.12, 0.03), mat(hc, 0.95), r * 0.35, p.neckY - r * 0.22, r * 0.55); }
    if (!p.hover) add(W, box(r * 0.7, r * 0.8, r * 0.4, 0.06), mat(dc, 0.8), 0, p.neckY - r * 0.35, -r * 0.95);
    W.updateMatrixWorld(true); applyToyLook(W);
  }
  setOutfit(o: Outfit) { if (o !== this.outfit && this.avatar) this.setAvatar(this.avatar, o); }
  /** 脚下那团假影子（物件图标里用真影子，关掉它） */
  showShadow(v: boolean) { if (v) { if (!this.shadow.parent) this.rig.add(this.shadow); } else this.shadow.removeFromParent(); }   // 摘下来而不是藏起来：包围盒会把藏起来的也算进去
  get currentOutfit() { return this.outfit; }

  /** 载具：和小人一样坐车 / 坐船 / 坐飞机，积木拼的小载具 */
  setVehicle(v: Vehicle) {
    if (v === this.vehicle) return; this.vehicle = v; disposeTree(this.vehicleRoot); this.vehicleRoot.clear();
    const r = this.vehicleRoot;
    if (v === "car" || v === "train") {
      add(r, box(1.1, 0.42, 1.7, 0.1), mat([218, 168, 86], 0.4), 0, 0.42, 0); add(r, box(0.95, 0.36, 0.8, 0.08), mat([236, 230, 220], 0.4), 0, 0.78, -0.15);
      for (const [x, z] of [[-0.52, 0.55], [0.52, 0.55], [-0.52, -0.55], [0.52, -0.55]]) add(r, cyl(0.17, 0.17, 0.12, 14), mat([48, 46, 52], 0.8), x, 0.19, z).rotation.z = PI / 2;
    } else if (v === "boat") {
      const hull = add(r, new THREE.CapsuleGeometry(0.5, 1.2, 4, 12), mat([250, 248, 242], 0.4), 0, 0.2, 0); hull.rotation.x = PI / 2; hull.scale.set(1, 0.5, 1);
      add(r, box(0.9, 0.18, 1.6, 0.05), mat([112, 80, 62], 0.6), 0, 0.42, 0);
    } else if (v === "plane") {
      const f = add(r, new THREE.CapsuleGeometry(0.34, 1.4, 4, 12), mat([245, 245, 250], 0.35), 0, 0.5, 0); f.rotation.x = PI / 2;
      add(r, box(2.2, 0.06, 0.5, 0.02), mat([218, 168, 86], 0.5), 0, 0.5, 0.1); add(r, box(0.08, 0.5, 0.4, 0.02), mat([218, 168, 86], 0.5), 0, 0.8, -0.85);
    }
    r.updateMatrixWorld(true); applyToyLook(r);
    const seated = v === "car" || v === "train" || v === "plane";
    this.parts.body.position.set(0, seated ? (v === "plane" ? 0.25 : 0.12) : v === "boat" ? 0.3 : 0, seated ? -0.1 : 0);
    this.parts.legs.forEach((l) => (l.visible = !seated)); this.shadow.visible = !v || v === "car" || v === "train";
  }

  face(dx: number, dz: number) { if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.group.rotation.y = Math.atan2(dx, dz); }
  celebrate(seconds = 1.2) { this.celebrateT = seconds; }

  update(dt: number, speed: number) {
    this.t += dt; const p = this.parts; const riding = !!this.vehicle;
    const target = speed > 0.01 && !riding ? 1 : 0; this.walk += (target - this.walk) * Math.min(1, dt * 8);
    this.phase += dt * (7 + Math.min(speed, 3) * 2.2) * (speed > 0.01 ? 1 : 0.35);
    const s = Math.sin(this.phase), w = this.walk;
    // 腿：四条的对角摆，两条的交替摆；跳着走的（豆丁、石头精）腿不摆，身子一蹦一蹦
    p.legs.forEach((l, i) => (l.rotation.x = p.hop ? 0 : (i % 2 ? -1 : 1) * (i < 2 ? 1 : -1) * s * 0.7 * w));
    p.arms.forEach((a, i) => { a.rotation.x = (i ? 1 : -1) * s * 0.5 * w; a.rotation.z = (i ? -1 : 1) * (0.1 + Math.abs(s) * 0.25 * w); });
    const base = this.vehicle === "boat" ? 0.3 : this.vehicle === "plane" ? 0.25 : this.vehicle ? 0.12 : 0;
    let bob = p.hover ? Math.sin(this.t * 2.0) * 0.08 + 0.25 : p.hop ? Math.max(0, Math.sin(this.phase * 0.5)) * 0.22 * w + (1 - w) * Math.sin(this.t * 2.2) * 0.015 : Math.abs(s) * 0.05 * w + (1 - w) * Math.sin(this.t * 2.2) * 0.015;
    if (this.celebrateT > 0) { this.celebrateT -= dt; const u = 1 - Math.max(0, this.celebrateT) / 1.2; bob += Math.sin(Math.min(1, u * 1.6) * PI) * 0.5; p.body.rotation.y = u < 0.7 ? u / 0.7 * PI * 2 : 0; } else p.body.rotation.y = 0;
    p.body.position.y = base + bob + (riding ? Math.sin(this.t * 9) * 0.015 : 0);
    p.body.rotation.z = (p.legs.length === 2 && !p.hop ? s * 0.12 : s * 0.03) * w;   // 两条腿的摇摇摆摆
    p.head.rotation.z = -s * 0.05 * w; p.head.rotation.x = (1 - w) * Math.sin(this.t * 1.3) * 0.04 - 0.03 * w;
    if (p.tail) { p.tail.rotation.y = Math.sin(this.t * (w > 0.5 ? 9 : 3)) * 0.35; }
    p.ears.forEach((e, i) => { e.rotation.x = Math.sin(this.t * 1.7 + i) * 0.06; });
    if (this.t > this.blinkAt) { const u = (this.t - this.blinkAt) / 0.14; const k = u < 1 ? 1 - Math.sin(PI * u) * 0.9 : 1; for (const e of p.eyes) e.scale.y = k; if (u >= 1) this.blinkAt = this.t + 2 + Math.random() * 3; }
    if (this.vehicle === "boat") this.vehicleRoot.rotation.z = Math.sin(this.t * 1.6) * 0.05;
    this.shadow.scale.setScalar(p.hover ? 0.7 : 1 - bob * 0.3);
  }

  dispose() { disposeTree(this.rig); (this.shadow.material as THREE.Material).dispose(); }
}

/** 扔掉一棵子树的几何体与 look.ts 新建的材质（积木缓存里的 mat() 留着） */
function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => { if (x instanceof THREE.Mesh) { x.geometry.dispose(); const m = x.material as THREE.Material; if (m.userData?.look || (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) m.dispose(); } });
}
