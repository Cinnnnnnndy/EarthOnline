/** 有向距离场（SDF）建模 + Surface Nets 网格化：用平滑并集把球、椭球、圆锥胶囊「捏」成一体，
 *  得到圆润、没有接缝和突出部件的造型（《潜水员戴夫》那种胖乎乎的卡通体量）。纯数学，Node 与浏览器都能跑。 */
export type Vec3 = [number, number, number];
export type SDF = (x: number, y: number, z: number) => number;

// ---------------- 基本体
export const sphere = (c: Vec3, r: number): SDF => (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
/** 椭球（近似距离，够平滑建模用） */
export const ellipsoid = (c: Vec3, r: Vec3): SDF => (x, y, z) => {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz); const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
};
/** 两端半径不同的圆锥胶囊（四肢、手指、袖子） */
export const roundCone = (a: Vec3, b: Vec3, ra: number, rb: number): SDF => {
  const ba: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2; const rr = ra - rb; const a2 = l2 - rr * rr; const il2 = 1 / l2;
  return (x, y, z) => {
    const pa: Vec3 = [x - a[0], y - a[1], z - a[2]];
    const yy = pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]; const zz = yy - l2;
    const xv: Vec3 = [pa[0] * l2 - ba[0] * yy, pa[1] * l2 - ba[1] * yy, pa[2] * l2 - ba[2] * yy];
    const x2 = xv[0] ** 2 + xv[1] ** 2 + xv[2] ** 2; const y2 = yy * yy * l2; const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  };
};
export const capsule = (a: Vec3, b: Vec3, r: number): SDF => roundCone(a, b, r, r);
/** 圆角盒（可绕 Y 转） */
export const roundBox = (c: Vec3, h: Vec3, r: number, rotY = 0): SDF => {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  return (x, y, z) => {
    let px = x - c[0], pz = z - c[2]; const py = y - c[1]; const tx = px * cs - pz * sn; pz = px * sn + pz * cs; px = tx;
    const qx = Math.abs(px) - h[0] + r, qy = Math.abs(py) - h[1] + r, qz = Math.abs(pz) - h[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
};
/** 圆环（轴 = Y；tilt 绕 X 倾斜） */
export const torus = (c: Vec3, R: number, r: number, tiltX = 0): SDF => {
  const cs = Math.cos(tiltX), sn = Math.sin(tiltX);
  return (x, y, z) => { const px = x - c[0]; let py = y - c[1], pz = z - c[2]; const ty = py * cs - pz * sn; pz = py * sn + pz * cs; py = ty; return Math.hypot(Math.hypot(px, pz) - R, py) - r; };
};
export const plane = (n: Vec3, d: number): SDF => (x, y, z) => x * n[0] + y * n[1] + z * n[2] - d;

// ---------------- 组合
export const smin = (a: number, b: number, k: number) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const union = (k: number, ...fs: SDF[]): SDF => (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k); return d; };
export const subtract = (k: number, a: SDF, b: SDF): SDF => (x, y, z) => -smin(-a(x, y, z), b(x, y, z), k);
export const intersect = (k: number, a: SDF, b: SDF): SDF => (x, y, z) => -smin(-a(x, y, z), -b(x, y, z), k);
export const offset = (f: SDF, g: (x: number, y: number, z: number) => number): SDF => (x, y, z) => f(x, y, z) + g(x, y, z);
export const mirrorX = (f: SDF): SDF => (x, y, z) => f(Math.abs(x), y, z);

/** 平滑噪声（值噪声），给绒球、针织、树冠一点起伏 */
export function noise3(x: number, y: number, z: number): number {
  const h = (i: number, j: number, k: number) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}

export interface MeshData { positions: Float32Array; normals: Float32Array; indices: Uint32Array }

/** Naive Surface Nets：每个穿过零面的格子放一个顶点（边交点平均 + 沿梯度投影回曲面），每条穿过零面的格边连一个四边形 */
export function polygonize(f: SDF, lo: Vec3, hi: Vec3, cell: number): MeshData {
  const nx = Math.max(2, Math.ceil((hi[0] - lo[0]) / cell) + 1), ny = Math.max(2, Math.ceil((hi[1] - lo[1]) / cell) + 1), nz = Math.max(2, Math.ceil((hi[2] - lo[2]) / cell) + 1);
  const val = new Float32Array(nx * ny * nz); const gi = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  // 窄带求值：先按 B 格一跳算粗网格；整块离表面都远（|f| 大于块对角线 × 余量）的格点只需要符号，直接抄粗值，
  // 只有表面附近的块才逐点精确求值。距离场近似 1-Lipschitz，余量 1.6 给平滑并集 / 置换留足空间。
  const B = 4; const bx = Math.ceil((nx - 1) / B) + 1, by = Math.ceil((ny - 1) / B) + 1, bz = Math.ceil((nz - 1) / B) + 1;
  const coarse = new Float32Array(bx * by * bz); const bi = (i: number, j: number, k: number) => (k * by + j) * bx + i;
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) coarse[bi(i, j, k)] = f(lo[0] + i * B * cell, lo[1] + j * B * cell, lo[2] + k * B * cell);
  const far = cell * B * Math.sqrt(3) * 1.6;
  for (let K = 0; K < bz - 1; K++) for (let J = 0; J < by - 1; J++) for (let I = 0; I < bx - 1; I++) {
    let mn = Infinity; let sample = 0;
    for (let c = 0; c < 8; c++) { const v = coarse[bi(I + (c & 1), J + ((c >> 1) & 1), K + ((c >> 2) & 1))]; if (Math.abs(v) < mn) { mn = Math.abs(v); sample = v; } }
    const i0 = I * B, j0 = J * B, k0 = K * B, i1 = Math.min(nx - 1, i0 + B), j1 = Math.min(ny - 1, j0 + B), k1 = Math.min(nz - 1, k0 + B);
    if (mn > far) { for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) val[gi(i, j, k)] = sample; continue; }
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) val[gi(i, j, k)] = f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1; const ci = (i: number, j: number, k: number) => (k * cy + j) * cx + i;
  const vid = new Int32Array(cx * cy * cz).fill(-1); const pos: number[] = []; const nrm: number[] = [];
  const e = cell * 0.5;
  // 四面体差分求梯度：4 次求值（比中心差分的 6 次省三分之一），顺带给出该点的距离值
  const grad4 = (x: number, y: number, z: number): [number, number, number, number] => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d; const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l, (a + b + c + d) / 4];
  };
  const corners: Vec3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = corners[c]; cv[c] = val[gi(i + a, j + b, k + d)]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb); const A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    let x = lo[0] + (i + sx / n) * cell, y = lo[1] + (j + sy / n) * cell, z = lo[2] + (k + sz / n) * cell;
    { const g0 = grad4(x, y, z); const d = g0[3]; x -= g0[0] * d; y -= g0[1] * d; z -= g0[2] * d; }   // 沿梯度投影回曲面（一步够了：格点已经在一个格子以内）
    const g = grad4(x, y, z);
    vid[ci(i, j, k)] = pos.length / 3; pos.push(x, y, z); nrm.push(g[0], g[1], g[2]);
  }
  const idx: number[] = [];
  const P = (q: number) => [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]];
  const tri = (a: number, b: number, c: number, outward: Vec3) => {
    const pa = P(a), pb = P(b), pc = P(c);
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2], vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * fx + fy * fy + fz * fz < 1e-14) return;                 // 退化三角形不要
    // 朝向以该处的曲面法线为准（比格边方向更可靠）
    const nx_ = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], ny_ = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], nz_ = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    const ref = nx_ * nx_ + ny_ * ny_ + nz_ * nz_ > 1e-6 ? [nx_, ny_, nz_] : outward;
    if (fx * ref[0] + fy * ref[1] + fz * ref[2] < 0) idx.push(a, c, b); else idx.push(a, b, c);
  };
  const quad = (a: number, b: number, c: number, d: number, outward: Vec3) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const pa = P(a), pb = P(b), pc = P(c), pd = P(d);
    const dac = (pa[0] - pc[0]) ** 2 + (pa[1] - pc[1]) ** 2 + (pa[2] - pc[2]) ** 2, dbd = (pb[0] - pd[0]) ** 2 + (pb[1] - pd[1]) ** 2 + (pb[2] - pd[2]) ** 2;
    if (dac <= dbd) { tri(a, b, c, outward); tri(a, c, d, outward); } else { tri(a, b, d, outward); tri(b, c, d, outward); }
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = val[gi(i, j, k)];
    if (i < nx - 1 && j > 0 && k > 0 && j < cy + 0 && k < cz + 0) { const v1 = val[gi(i + 1, j, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vid[ci(i, j - 1, k - 1)], vid[ci(i, j, k - 1)], vid[ci(i, j, k)], vid[ci(i, j - 1, k)], [v0 < 0 ? 1 : -1, 0, 0]); }
    if (j < ny - 1 && i > 0 && k > 0 && i < cx && k < cz) { const v1 = val[gi(i, j + 1, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vid[ci(i - 1, j, k - 1)], vid[ci(i, j, k - 1)], vid[ci(i, j, k)], vid[ci(i - 1, j, k)], [0, v0 < 0 ? 1 : -1, 0]); }
    if (k < nz - 1 && i > 0 && j > 0 && i < cx && j < cy) { const v1 = val[gi(i, j, k + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(vid[ci(i - 1, j - 1, k)], vid[ci(i, j - 1, k)], vid[ci(i, j, k)], vid[ci(i - 1, j, k)], [0, 0, v0 < 0 ? 1 : -1]); }
  }
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(idx) };
}
