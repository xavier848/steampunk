// Small math toolkit shared by every module. Everything here is pure and deterministic.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a0, a1, b0, b1) => lerp(b0, b1, clamp(invLerp(a0, a1, x)));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const pulse = (x, c, w) => { const d = Math.abs(x - c) / w; return d >= 1 ? 0 : 1 - d * d * (3 - 2 * d); };
export const fract = (x) => x - Math.floor(x);
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

// Critically damped spring evaluated in closed form is not needed; we use explicit curves.

// Keyframe track: keys = [[t, value, ease?], ...]; value may be number or array.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i];
  const [t1, v1, ease] = keys[i + 1];
  let u = (t - t0) / (t1 - t0);
  u = ease === 'lin' ? u : ease === 'in' ? easeIn(u) : ease === 'out' ? easeOut(u) : ease === 'step' ? 0 : easeInOutSine(u);
  if (typeof v0 === 'number') return v0 + (v1 - v0) * u;
  return v0.map((a, k) => a + (v1[k] - a) * u);
}

// Catmull-Rom path with arc-length parametrisation.
export class Path {
  constructor(points, { closed = false, samples = 24, tension = 0.5 } = {}) {
    this.points = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    this.closed = closed;
    const curve = new THREE.CatmullRomCurve3(this.points, closed, 'centripetal', tension);
    const n = Math.max(2, (this.points.length - (closed ? 0 : 1)) * samples);
    this.pts = curve.getPoints(n);
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  _seg(d) {
    const L = this.length;
    if (this.closed) { d = ((d % L) + L) % L; } else d = clamp(d, 0, L);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= d) lo = m; else hi = m; }
    const span = this.cum[hi] - this.cum[lo] || 1;
    return [lo, hi, (d - this.cum[lo]) / span];
  }
  pointAt(d, out = new THREE.Vector3()) {
    const [a, b, t] = this._seg(d);
    return out.copy(this.pts[a]).lerp(this.pts[b], t);
  }
  tangentAt(d, out = new THREE.Vector3()) {
    const [a, b] = this._seg(d);
    return out.copy(this.pts[b]).sub(this.pts[a]).normalize();
  }
}

// Straight polyline (no smoothing) with arc length, handy for paths along streets.
export class Polyline {
  constructor(points, closed = false) {
    this.pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    if (closed) this.pts.push(this.pts[0].clone());
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
    this.closed = closed;
  }
  pointAt(d, out = new THREE.Vector3()) {
    const L = this.length;
    d = this.closed ? ((d % L) + L) % L : clamp(d, 0, L);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const t = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1);
    return out.copy(this.pts[i - 1]).lerp(this.pts[i], t);
  }
  tangentAt(d, out = new THREE.Vector3()) {
    const L = this.length;
    d = this.closed ? ((d % L) + L) % L : clamp(d, 0, L);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    return out.copy(this.pts[i]).sub(this.pts[i - 1]).normalize();
  }
}

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
