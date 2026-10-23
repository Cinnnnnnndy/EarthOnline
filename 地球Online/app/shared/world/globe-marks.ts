/** 地球上的小物件：足迹小旗、家的小房子、落地时的涟漪。
 *  都是「单位高度 = 1」的模型，由地球视图按屏幕像素缩放；颜色只用界面的两色：金（去过）与靛蓝 / 墨色。 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const GOLD = 0xf0b43c, POLE = 0xf6f2ea, INK = 0x1d2842, ACCENT = 0x1d2842, WALL = 0xf3ead8;   // 第八轮：门也是墨色，不再有蓝

/** 旗面：一块细分的平面，挥动时逐帧改顶点（所有旗共用两块几何体，相位错开） */
function pennantGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.62, 0.36, 12, 3); g.translate(0.31 + 0.035, 0.78, 0);
  // 燕尾：右端中间往里收
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const u = (x - 0.035) / 0.62; const v = Math.abs(y - 0.78) / 0.18; if (u > 0.78) p.setX(i, x - (1 - v) * (u - 0.78) * 0.5); }
  g.userData.base = Float32Array.from(p.array as Float32Array); return g;
}

export class FlagKit {
  readonly pennants = [pennantGeometry(), pennantGeometry()];
  readonly pole = new THREE.CylinderGeometry(0.028, 0.034, 1.0, 10).translate(0, 0.5, 0);
  readonly ball = new THREE.SphereGeometry(0.06, 14, 10).translate(0, 1.02, 0);
  readonly mound = new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1);
  readonly mPole = new THREE.MeshStandardMaterial({ color: POLE, roughness: 0.45 });
  readonly mGold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.1, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.12 });
  readonly mFlag = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.18 });
  readonly mMound = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  readonly ringGeo = new THREE.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2);

  make(i: number): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.pole, this.mPole), new THREE.Mesh(this.ball, this.mGold), new THREE.Mesh(this.pennants[i % 2], this.mFlag), new THREE.Mesh(this.mound, this.mMound));
    return g;
  }
  ring(): THREE.Mesh { return new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); }
  /** 旗面随风：离旗杆越远摆得越大 */
  wave(t: number) {
    this.pennants.forEach((g, k) => {
      const p = g.attributes.position as THREE.BufferAttribute; const b = g.userData.base as Float32Array;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; const u = Math.max(0, (x - 0.035) / 0.62); p.setZ(i, Math.sin(u * 5.2 - t * 5.5 + k * 1.9) * 0.07 * u + Math.sin(y * 9 + t * 3) * 0.01 * u); p.setY(i, y - u * u * 0.05); }
      p.needsUpdate = true; g.computeVertexNormals();
    });
  }
  dispose() { for (const g of [...this.pennants, this.pole, this.ball, this.mound, this.ringGeo]) g.dispose(); for (const m of [this.mPole, this.mGold, this.mFlag, this.mMound]) m.dispose(); }
}

/** 家：奶油色墙、墨蓝屋顶、一扇亮着的窗、烟囱；底下一圈淡淡的光 */
export function makeHouse(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: WALL, roughness: 0.7 });
  const roofM = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.46, 0.5, 3, 0.05), wall); body.position.y = 0.23; g.add(body);
  const roofGeo = new THREE.ConeGeometry(0.56, 0.36, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.scale(1.12, 1, 0.95);
  const roof = new THREE.Mesh(roofGeo, roofM); roof.position.y = 0.46 + 0.17; g.add(roof);
  const chim = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.2, 0.1, 2, 0.02), roofM); chim.position.set(0.16, 0.72, -0.06); g.add(chim);
  const win = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.14, 0.02, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: new THREE.Color(0xffc15c), emissiveIntensity: 0.9 })); win.position.set(0.14, 0.27, 0.255); g.add(win);
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.24, 0.02, 2, 0.02), new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5 })); door.position.set(-0.14, 0.12, 0.255); g.add(door);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })); pad.position.y = 0.005; g.add(pad);
  return g;
}
