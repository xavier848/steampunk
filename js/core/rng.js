// Seeded random numbers and value noise. No Math.random anywhere in the film:
// every frame must be reproducible for scrubbing, stills and the video export.

export function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
export const hash01 = (n) => hash32(n | 0) / 4294967296;
export const hash2 = (x, y) => hash01(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));

export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() { const u = Math.max(1e-9, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); }
  weighted(items) { // [[value, weight], ...]
    let sum = 0; for (const it of items) sum += it[1];
    let r = this.next() * sum;
    for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; }
    return items[items.length - 1][0];
  }
}

// Smooth 1D value noise in [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash01(i * 374761393 + seed * 668265263) * 2 - 1;
  const b = hash01((i + 1) * 374761393 + seed * 668265263) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
export function fbm1(x, seed = 0, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise1(x * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const h = (i, j) => hash2(i + seed * 131, j - seed * 71) * 2 - 1;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm2(x, y, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, seed + i * 13); n += a; a *= 0.5; f *= 2.01; }
  return s / n;
}
