// Streets: cobbled roadway, flagstone pavements with curbs, tram rails, gutters,
// and cast iron street furniture (double lanterns, bollards, hydrants).
import * as THREE from 'three';
import { P, M, Mseg, mul } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { PAL } from './palette.js';

export const CURB_H = 0.16;

// Street segment along an axis. a0..a1 = extent along the axis, c = centre line (other axis),
// road = roadway width, walk = pavement width each side.
export function addStreet(b, { axis = 'z', a0, a1, c = 0, road = 9, walk = 3.2, rails = [], y = 0, id = 0.02, walkL = true, walkR = true }) {
  const len = a1 - a0, mid = (a0 + a1) / 2;
  const place = (u, v, w, dl, h, yy, m) => {
    // u = offset across, v = along; w = width across, dl = length along
    if (axis === 'z') b.add(P.box(), M(c + u, yy, v, 0, 0, 0, w, h, dl), m);
    else b.add(P.box(), M(v, yy, c + u, 0, 0, 0, dl, h, w), m);
  };
  const mRoad = { color: PAL.cobble, layer: LAYER.COBBLE, scale: 3.2, spec: 0.05, emit: 0, id, uv: false };
  const mWalk = { color: PAL.flag, layer: LAYER.FLAGSTONE, scale: 4.5, spec: 0, emit: 0, id, uv: false };
  const mCurb = { color: PAL.curb, layer: LAYER.STONE, scale: 2.0, spec: 0, emit: 0, id, uv: false };
  const mRail = { color: 0x6c6460, layer: LAYER.IRON, scale: 1.2, spec: 0.9, emit: 0, id, uv: false };
  place(0, mid, road, len, 0.4, y - 0.2, mRoad);
  for (const s of [-1, 1]) {
    if ((s < 0 && !walkL) || (s > 0 && !walkR)) continue;
    place(s * (road / 2 + 0.14), mid, 0.28, len, 0.4 + CURB_H + 0.02, y - 0.2 + (CURB_H + 0.02) / 2, mCurb);
    place(s * (road / 2 + 0.28 + (walk - 0.28) / 2), mid, walk - 0.28, len, 0.4 + CURB_H, y - 0.2 + CURB_H / 2, mWalk);
    // gutter line
    place(s * (road / 2 - 0.18), mid, 0.3, len, 0.03, y + 0.0, { ...mRoad, color: 0x6f6660, layer: LAYER.STONE, scale: 1.2 });
  }
  for (const rc of rails) {
    for (const g of [-0.72, 0.72]) {
      place(rc + g, mid, 0.08, len, 0.06, y + 0.02, mRail);
    }
    // sett band between the rails
    place(rc, mid, 1.3, len, 0.02, y + 0.005, { ...mRoad, color: 0x7d736c, layer: LAYER.FLAGSTONE, scale: 1.5 });
  }
}

// Double lantern lamp post; returns light anchors (glass centres).
export function addLampPost(b, x, z, rot = 0, { y = CURB_H, double = true, h = 4.4 } = {}) {
  const T = M(x, y, z, 0, rot, 0);
  const L = (m) => mul(T, m);
  const mIron = { color: 0x2f2b2c, layer: LAYER.IRON, scale: 1.0, spec: 0.45, emit: 0, id: 0.31, uv: false };
  const mBrass = { color: PAL.brass, layer: LAYER.METAL, scale: 1.0, spec: 0.8, emit: 0, id: 0.31, uv: false };
  b.add(P.lathe('lampbase', [[0.0, 0], [0.26, 0], [0.26, 0.12], [0.2, 0.2], [0.2, 0.55], [0.14, 0.7], [0.1, 0.9], [0.0, 0.9]], 12), L(M()), mIron);
  b.add(P.cylB(10), L(M(0, 0.85, 0, 0, 0, 0, 0.065, h - 0.8, 0.065)), mIron);
  for (const yy of [1.2, h * 0.62]) b.add(P.cyl(10), L(M(0, yy, 0, 0, 0, 0, 0.1, 0.12, 0.1)), mBrass);
  const anchors = [];
  if (double) {
    b.add(P.box(), L(M(0, h - 0.1, 0, 0, 0, 0, 1.5, 0.07, 0.07)), mIron);
    for (const s of [-1, 1]) {
      // scroll under the arm
      b.add(P.torus(5, 10, Math.PI, 0.09), L(M(s * 0.4, h - 0.36, 0, 0, 0, s > 0 ? 0 : 0, 0.3, 0.26, 0.3)), mIron);
      anchors.push(new THREE.Vector3(s * 0.72, h + 0.28, 0).applyMatrix4(T));
      lantern(b, L(M(s * 0.72, h - 0.04, 0)), mIron, mBrass);
    }
    b.add(P.sphere(8, 6), L(M(0, h + 0.05, 0, 0, 0, 0, 0.1)), mBrass);
  } else {
    anchors.push(new THREE.Vector3(0, h + 0.32, 0).applyMatrix4(T));
    lantern(b, L(M(0, h, 0)), mIron, mBrass);
  }
  return anchors;
}

// lantern body with its base at the local origin; the glass itself is instanced separately
export function lantern(b, T, mIron, mBrass) {
  const L = (m) => mul(T, m);
  b.add(P.cylB(6), L(M(0, 0, 0, 0, 0, 0, 0.16, 0.08, 0.16)), mIron);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(P.box(), L(M(Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17, 0, -a, 0, 0.025, 0.46, 0.025)), mIron);
  }
  b.add(P.cone(6), L(M(0, 0.54, 0, 0, 0, 0, 0.26, 0.22, 0.26)), mIron);
  b.add(P.cylB(6), L(M(0, 0.74, 0, 0, 0, 0, 0.05, 0.12, 0.05)), mBrass);
  b.add(P.sphere(6, 4), L(M(0, 0.9, 0, 0, 0, 0, 0.06)), mBrass);
}

export function addWallLamp(b, matrix) {
  const L = (m) => mul(matrix, m);
  const mIron = { color: 0x2f2b2c, layer: LAYER.IRON, scale: 1.0, spec: 0.45, emit: 0, id: 0.33, uv: false };
  const mBrass = { color: PAL.brass, layer: LAYER.METAL, scale: 1.0, spec: 0.8, emit: 0, id: 0.33, uv: false };
  b.add(P.box(), L(M(0, 0, 0.05, 0, 0, 0, 0.2, 0.3, 0.1)), mIron);
  b.add(P.box(), L(M(0, 0.05, 0.35, 0, 0, 0, 0.05, 0.05, 0.6)), mIron);
  b.add(P.torus(4, 10, Math.PI / 2, 0.08), L(M(0, -0.1, 0.25, 0, Math.PI / 2, 0, 0.25)), mIron);
  lantern(b, L(M(0, -0.25, 0.65)), mIron, mBrass);
  return new THREE.Vector3(0, 0.07, 0.65).applyMatrix4(matrix);
}

export function addBollard(b, x, z, y = CURB_H) {
  b.add(P.lathe('bollard', [[0, 0], [0.16, 0], [0.16, 0.08], [0.12, 0.12], [0.11, 0.7], [0.14, 0.76], [0.1, 0.86], [0.0, 0.9]], 10), M(x, y, z), { color: 0x2f2b2c, layer: LAYER.IRON, scale: 1, spec: 0.4, emit: 0, id: 0.34, uv: false });
}
