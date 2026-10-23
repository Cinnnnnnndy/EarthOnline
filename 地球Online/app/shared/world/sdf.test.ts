import { test } from "node:test";
import assert from "node:assert/strict";
import { sphere, union, polygonize, roundCone } from "./sdf.ts";

test("Surface Nets：球面网格的顶点都在半径附近，法线朝外，三角形闭合", () => {
  const m = polygonize(sphere([0, 0, 0], 1), [-1.3, -1.3, -1.3], [1.3, 1.3, 1.3], 0.08);
  assert.ok(m.positions.length / 3 > 500);
  for (let i = 0; i < m.positions.length; i += 3) {
    const r = Math.hypot(m.positions[i], m.positions[i + 1], m.positions[i + 2]); assert.ok(Math.abs(r - 1) < 0.01, `r=${r}`);
    const d = m.positions[i] * m.normals[i] + m.positions[i + 1] * m.normals[i + 1] + m.positions[i + 2] * m.normals[i + 2]; assert.ok(d > 0.9);
  }
  // 每个三角形的几何法线朝外
  let bad = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const P = (q: number) => [m.positions[q * 3], m.positions[q * 3 + 1], m.positions[q * 3 + 2]];
    const [a, b, c] = [P(m.indices[t]), P(m.indices[t + 1]), P(m.indices[t + 2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * a[0] + n[1] * a[1] + n[2] * a[2] <= 0) bad++;
  }
  assert.equal(bad, 0);
});

test("平滑并集把两块捏成一体（中间没有凹缝）", () => {
  const f = union(0.4, sphere([-0.6, 0, 0], 0.5), sphere([0.6, 0, 0], 0.5));
  assert.ok(f(0, 0, 0) < 0.05, "腰部被平滑填上");
  const c = roundCone([0, 0, 0], [0, 2, 0], 0.5, 0.2); assert.ok(Math.abs(c(0.5, 0, 0)) < 1e-6 && Math.abs(c(0, 2.2, 0)) < 1e-6);
});
