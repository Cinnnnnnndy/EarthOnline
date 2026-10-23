/** 确定性随机：两端结果必须一致，所以不用平台的 Math.random */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export interface Rng { next(): number; int(n: number): number; pick<T>(a: readonly T[]): T; range(a: number, b: number): number }
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)], range: (lo, hi) => lo + next() * (hi - lo) };
}
