// Camera toolkit for the shot list. Every helper is a pure function of time, so the
// camera is as deterministic as the rest of the film.
import * as THREE from 'three';
import { noise1, fbm1 } from '../core/rng.js';
import { clamp, smoothstep, lerp, easeInOutSine } from '../core/math.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// a camera state: position, look-at target, vertical fov, roll, near plane
export function cam(pos, look, fov = 45, extra = {}) { return { pos: pos.clone(), look: look.clone(), fov, roll: 0, ...extra }; }

// smooth interpolation along keyframes [[u, Vector3], ...] with Catmull-Rom
export function spline(points, u) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return c.getPoint(clamp(u));
}
const _curveCache = new Map();
export function splineCached(key, points, u) {
  let c = _curveCache.get(key);
  if (!c) { c = new THREE.CatmullRomCurve3(points, false, 'centripetal'); _curveCache.set(key, c); }
  return c.getPoint(clamp(u));
}

// position of a track averaged over a short past window (removes step bob and jitter)
export function smoothPos(track, S, win = 0.35, n = 5) {
  const p = V(0, 0, 0);
  for (let i = 0; i < n; i++) p.add(track.posAt(S - (win * i) / (n - 1)));
  return p.multiplyScalar(1 / n);
}
// smoothed heading (unit vector on the ground plane) from the track velocity
export function heading(track, S, win = 0.6) {
  const a = track.posAt(S - win), b = track.posAt(S + 0.05);
  const d = b.sub(a); d.y = 0;
  if (d.lengthSq() < 1e-6) return null;
  return d.normalize();
}
export function yawDir(yaw) { return V(Math.sin(yaw), 0, Math.cos(yaw)); }

// camera behind (back > 0) or in front (back < 0) of a moving character
export function follow(track, S, { back = 3.2, side = 0.6, up = 1.7, lookUp = 1.2, lookAhead = 2.0, win = 0.5, dir = null } = {}) {
  const p = smoothPos(track, S, win);
  let f = dir || heading(track, S) || yawDir(track.at(S).yaw);
  const r = V(f.z, 0, -f.x); // right hand side of the heading
  const pos = p.clone().addScaledVector(f, -back).addScaledVector(r, side);
  pos.y = p.y + up;
  const look = p.clone().addScaledVector(f, lookAhead * Math.sign(back || 1));
  look.y = p.y + lookUp;
  return { pos, look };
}

// handheld shake: small, smooth, deterministic
export function handheld(c, T, amp = 1) {
  const a = amp;
  c.pos.x += fbm1(T * 1.3, 11) * 0.06 * a;
  c.pos.y += fbm1(T * 1.7, 12) * 0.05 * a;
  c.pos.z += fbm1(T * 1.1, 13) * 0.06 * a;
  c.look.x += fbm1(T * 2.1, 14) * 0.09 * a;
  c.look.y += fbm1(T * 2.3, 15) * 0.07 * a;
  c.roll = (c.roll || 0) + fbm1(T * 0.9, 16) * 0.012 * a;
  return c;
}

// orbit around a centre: angle in radians, radius, height offset
export function orbit(center, angle, radius, height) {
  return V(center.x + Math.sin(angle) * radius, center.y + height, center.z + Math.cos(angle) * radius);
}

// dolly zoom: keep the subject size constant while the fov changes
// returns distance for a given fov, given reference distance d0 at fov0
export function dollyDist(d0, fov0, fov) { return d0 * Math.tan((fov0 * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360); }

export function ease(u) { return easeInOutSine(clamp(u)); }
export function mixCam(a, b, u) {
  return { ...a, pos: a.pos.clone().lerp(b.pos, u), look: a.look.clone().lerp(b.look, u), fov: lerp(a.fov, b.fov, u), roll: lerp(a.roll || 0, b.roll || 0, u) };
}
