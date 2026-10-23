/** 相机：轻透视、跟随 / 全景、俯仰 30° / 90° 两档、方位四档、三级缩放；所有切换带缓动 */
import * as THREE from "three";
import type { ViewPitch } from "../spec/types.ts";

const FOLLOW_DIST = [12, 17, 24];
const AZ0 = 35;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(24, 1, 0.1, 500);
  follow = true; pitch: ViewPitch = 30; azimuthStep = 0; zoomIndex = 1;
  /** 拖拽带来的连续偏移（方位角、俯仰）与滚轮缩放倍率 */
  azOffset = 0; pitchOffset = 0; distMul = 1;
  /** 地形遮挡时自动抬高的俯仰（度），由世界层每帧给 */
  lift = 0; private curLift = 0;
  /** 相机 → 目标连线上的采样点（世界层用来检测地形遮挡） */
  get lookTarget() { return this.cur; }
  plate = { cols: 36, rows: 24 };
  private target = new THREE.Vector3(18, 0, 12);
  private cur = new THREE.Vector3(18, 0, 12);
  private curPitch = 30; private curAz = AZ0; private curDist = 9.5; private aspect = 1;
  private snap = true;

  setAspect(a: number) { this.aspect = a; this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
  setPlate(cols: number, rows: number) { this.plate = { cols, rows }; this.snap = true; }
  rotate(dir: 1 | -1) { this.azimuthStep = (this.azimuthStep + dir + 4) % 4; }
  zoom(dir: 1 | -1) { this.zoomIndex = Math.max(0, Math.min(FOLLOW_DIST.length - 1, this.zoomIndex + dir)); }

  private wantAz() { return AZ0 + this.azimuthStep * 90 + this.azOffset; }
  dragBy(dx: number, dy: number) { this.azOffset -= dx * 0.25; this.pitchOffset = Math.max(-18, Math.min(40, this.pitchOffset + dy * 0.15)); }
  zoomBy(f: number) { this.distMul = Math.max(0.45, Math.min(2.6, this.distMul * f)); }
  /** 开场：从高空俯视往下落到跟随视角 */
  intro(height = 3.2) { this.curDist = this.wantDist() * height; this.curPitch = 78; this.snap = false; }
  private wantDist() {
    if (this.follow) return FOLLOW_DIST[this.zoomIndex] * this.distMul;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.aspect);
    const w = this.plate.cols + 2, h = this.plate.rows + 2;
    const dW = (Math.max(w, h * 0.9) / 2) / Math.tan(fovH / 2), dH = (Math.max(h, w * 0.75) * (this.pitch > 60 ? 1 : 0.62) / 2) / Math.tan(fovV / 2);
    return Math.max(dW, dH) * 1.08 * this.distMul;
  }

  update(dt: number, heroPos: THREE.Vector3 | null) {
    const want = this.follow && heroPos ? heroPos : new THREE.Vector3(this.plate.cols / 2, 0, this.plate.rows / 2);
    this.target.copy(want);
    const k = this.snap ? 1 : Math.min(1, dt * 4.5);
    this.cur.lerp(this.target, k);
    this.curLift += (this.lift - this.curLift) * Math.min(1, dt * 2);
    const wp = this.pitch === 90 ? 89 : Math.max(12, Math.min(84, this.pitch + this.pitchOffset + this.curLift));
    this.curPitch += (wp - this.curPitch) * (this.snap ? 1 : Math.min(1, dt * 4));
    let dAz = ((this.wantAz() - this.curAz) % 360 + 540) % 360 - 180; this.curAz += dAz * (this.snap ? 1 : Math.min(1, dt * 4));
    this.curDist += (this.wantDist() - this.curDist) * (this.snap ? 1 : Math.min(1, dt * 2.2));
    this.snap = false;
    const p = THREE.MathUtils.degToRad(this.curPitch), a = THREE.MathUtils.degToRad(this.curAz);
    const off = new THREE.Vector3(Math.sin(a) * Math.cos(p), Math.sin(p), Math.cos(a) * Math.cos(p)).multiplyScalar(this.curDist);
    const look = this.cur.clone(); look.y += this.follow ? 0.6 : 0;
    this.camera.position.copy(look).add(off); this.camera.up.set(0, 1, 0); this.camera.lookAt(look);
  }

  /** 世界坐标 → 屏幕像素；front=false 表示在相机背后 */
  project(p: THREE.Vector3, w: number, h: number): { x: number; y: number; depth: number; front: boolean } {
    const v = p.clone().project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, depth: v.z, front: v.z < 1 && v.z > -1 };
  }
  get position() { return this.camera.position; }
}
