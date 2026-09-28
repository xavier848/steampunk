// Landmarks: the clock tower at the end of the market street, the domed clock house,
// the factory district with chimneys and gasometers, the airship mooring mast and
// the painted far city (layered skyline rings with cathedral spires).
import * as THREE from 'three';
import { GeoBuilder, P, M, Mseg, mul, gableRoof, pipeRun, boxUV } from '../engine/geo.js';
import { LAYER, canvasTexture } from '../engine/textures.js';
import { worldMaterial, toonMaterial, U } from '../engine/materials.js';
import { texturedMaterial } from './signs.js';
import { RNG } from '../core/rng.js';
import { CITY } from './layout.js';
import { PAL } from './palette.js';

const stone = (c = PAL.stone[0], id = 0.9) => ({ color: c, layer: LAYER.STONE, scale: 3.2, spec: 0, emit: 0, id, uv: false });
const metal = (c, spec = 0.8, id = 0.9) => ({ color: c, layer: LAYER.METAL, scale: 2, spec, emit: 0, id, uv: false });
const patina = (c = PAL.patina[0], id = 0.9) => ({ color: c, layer: LAYER.PATINA, scale: 4, spec: 0.3, emit: 0, id, uv: false });

export function buildLandmarks(b, X) {
  const clocks = [];
  const out = { clocks };
  clockTower(b, X, clocks);
  domeHouse(b, X, clocks);
  out.factory = factory(b, X);
  out.mast = mast(b);
  return out;
}

// ------------------------------------------------------------------ clock tower
function clockTower(b, X, clocks) {
  const { x, z } = CITY.tower;
  const T = M(x, 0, z);
  const L = (m) => mul(T, m);
  const s1 = stone(0xd2b892), s2 = stone(0xc0a07c), s3 = stone(0xe0caa4);
  // base with rustication and gateway
  b.add(P.boxB(), L(M(0, 0, 0, 0, 0, 0, 22, 26, 22)), s1);
  for (let y = 1.2; y < 26; y += 1.6) b.add(P.box(), L(M(0, y, 0, 0, 0, 0, 22.3, 0.12, 22.3)), s2);
  b.add(P.cylB(24), L(M(0, 0, 11.05, Math.PI / 2, 0, 0, 3.6, 0.3, 5.5)), { ...s2, color: 0x3a2a24 });
  b.add(P.torus(6, 24, Math.PI, 0.45), L(M(0, 8, 11.2, 0, 0, 0, 3.8)), s3);
  // corner buttresses
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.boxB(), L(M(cx * 10.4, 0, cz * 10.4, 0, 0, 0, 3.2, 30, 3.2)), s2);
  // shaft with tall arched windows
  b.add(P.boxB(), L(M(0, 26, 0, 0, 0, 0, 17, 27, 17)), s3);
  for (let f = 0; f < 4; f++) {
    const R = M(0, 0, 0, 0, (f * Math.PI) / 2, 0);
    for (const wx of [-4.2, 0, 4.2]) {
      b.add(P.box(), L(mul(R, M(wx, 38, 8.56, 0, 0, 0, 2.0, 10, 0.3))), { ...s2, color: 0x2e3a4c, layer: LAYER.GLASS, spec: 0.3 });
      b.add(P.cyl(16, false), L(mul(R, M(wx, 43, 8.56, Math.PI / 2, 0, 0, 1.0, 0.3, 1.0))), { ...s2, color: 0x2e3a4c, layer: LAYER.GLASS, spec: 0.3 });
      b.add(P.box(), L(mul(R, M(wx, 32.8, 8.7, 0, 0, 0, 2.6, 0.35, 0.6))), s1);
    }
    for (const px of [-7.8, -2.1, 2.1, 7.8]) b.add(P.box(), L(mul(R, M(px, 39.5, 8.6, 0, 0, 0, 0.8, 27, 0.5))), s1);
  }
  // clock stage with four dials
  b.add(P.boxB(), L(M(0, 53, 0, 0, 0, 0, 19, 13, 19)), s1);
  b.add(P.box(), L(M(0, 53.2, 0, 0, 0, 0, 20, 0.5, 20)), s2);
  b.add(P.box(), L(M(0, 66, 0, 0, 0, 0, 20, 0.6, 20)), s2);
  for (let f = 0; f < 4; f++) {
    const ang = (f * Math.PI) / 2;
    const R = M(0, 0, 0, 0, ang, 0);
    b.add(P.cyl(40), L(mul(R, M(0, 59.5, 9.55, Math.PI / 2, 0, 0, 5.4, 0.35, 5.4))), metal(PAL.brass, 0.85));
    b.add(P.torus(6, 48, Math.PI * 2, 0.06), L(mul(R, M(0, 59.5, 9.75, 0, 0, 0, 5.2))), metal(PAL.brassDark, 0.8));
    // decorative gears around the dial
    for (const [gx, gy, gr] of [[-7.2, 55.6, 1.2], [7.3, 55.8, 1.0], [-7.0, 63.8, 0.9], [7.1, 63.5, 1.3]]) {
      const pos = new THREE.Vector3(gx, gy, 9.7).applyMatrix4(L(R));
      const nrm = new THREE.Vector3(0, 0, 1).transformDirection(L(R));
      X.gears.push({ pos, nrm, r: gr, teeth: 12, speed: (gx > 0 ? 1 : -1) * 0.3, color: PAL.brass });
    }
    const faceM = L(mul(R, M(0, 59.5, 9.76)));
    clocks.push({ matrix: faceM, r: 5.0, name: 'tower' + f });
    // corner turrets
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.add(P.cylB(12), L(M(cx * 9.6, 53, cz * 9.6, 0, 0, 0, 1.3, 16, 1.3)), s3);
    b.add(P.cone(12), L(M(cx * 9.6, 69, cz * 9.6, 0, 0, 0, 1.6, 5.5, 1.6)), patina());
    b.add(P.sphere(8, 6), L(M(cx * 9.6, 74.6, cz * 9.6, 0, 0, 0, 0.35)), metal(PAL.gold, 0.9));
  }
  // belfry: open arches with a bell inside
  b.add(P.box(), L(M(0, 66.6, 0, 0, 0, 0, 15, 0.6, 15)), s2);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.boxB(), L(M(cx * 6.6, 66.9, cz * 6.6, 0, 0, 0, 1.8, 9, 1.8)), s3);
  for (let f = 0; f < 4; f++) {
    const R = M(0, 0, 0, 0, (f * Math.PI) / 2, 0);
    b.add(P.torus(6, 20, Math.PI, 0.5), L(mul(R, M(0, 72.6, 6.9, 0, 0, 0, 5.2, 3.2, 1.2))), s3);
    b.add(P.box(), L(mul(R, M(0, 67.5, 6.95, 0, 0, 0, 12, 1.2, 0.6))), s2);
  }
  b.add(P.box(), L(M(0, 76, 0, 0, 0, 0, 15.4, 0.8, 15.4)), s2);
  b.add(P.lathe('bell', [[0, 0], [2.6, 0], [2.4, 0.4], [1.9, 1.6], [1.6, 3.0], [1.1, 3.5], [0.3, 3.8], [0, 3.8]], 18), L(M(0, 68.6, 0)), metal(PAL.brass, 0.9));
  // dome with ribs, lantern and spire
  b.add(P.hemi(28, 12), L(M(0, 76.4, 0, 0, 0, 0, 8.6, 9.5, 8.6)), patina());
  for (let i = 0; i < 12; i++) b.add(P.torus(4, 16, Math.PI / 2, 0.12), L(mul(M(0, 76.4, 0, 0, (i / 12) * Math.PI * 2, 0), M(0, 0, 0, 0, 0, Math.PI / 2, 8.62, 9.52, 8.62))), metal(PAL.brass, 0.8));
  b.add(P.cylB(12), L(M(0, 85.5, 0, 0, 0, 0, 1.8, 4.0, 1.8)), s3);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.add(P.box(), L(M(Math.cos(a) * 1.85, 87.3, Math.sin(a) * 1.85, 0, -a, 0, 0.25, 3.2, 0.5)), s1); }
  b.add(P.cone(12), L(M(0, 89.5, 0, 0, 0, 0, 2.2, 3.0, 2.2)), patina());
  b.add(P.cone(8), L(M(0, 92.3, 0, 0, 0, 0, 0.3, 9, 0.3)), metal(PAL.gold, 0.9));
  b.add(P.sphere(10, 8), L(M(0, 94.5, 0, 0, 0, 0, 0.7)), metal(PAL.gold, 0.9));
  // copper pipes climbing the tower with vents
  b.set(metal(PAL.copper, 0.7));
  pipeRun(b, [[x + 11.3, 0.3, z + 7], [x + 11.3, 52, z + 7], [x + 10.4, 54, z + 7], [x + 10.4, 66, z + 7]], 0.35, { collarColor: PAL.brass });
  pipeRun(b, [[x - 11.3, 0.3, z + 5], [x - 11.3, 48, z + 5]], 0.28, { collarColor: PAL.brass });
  X.vents.push({ pos: new THREE.Vector3(x + 10.4, 66.3, z + 7), dir: new THREE.Vector3(0.3, 1, 0.2), seed: 11, big: true });
  X.vents.push({ pos: new THREE.Vector3(x - 11.3, 48.3, z + 5), dir: new THREE.Vector3(-0.3, 1, 0.1), seed: 12, big: true });
  // lamps on the base
  for (const s of [-1, 1]) X.lamps.push({ pos: new THREE.Vector3(x + s * 5.5, 7.5, z + 11.8), kind: 'wall', matrix: L(M(s * 5.5, 7.2, 11.05)) });
}

// ------------------------------------------------------------------ dome house with clock
function domeHouse(b, X, clocks) {
  const { x, z } = CITY.domeHouse;
  const T = M(x, 0, z);
  const L = (m) => mul(T, m);
  const R0 = 15;
  b.add(P.cylB(36), L(M(0, 0, 0, 0, 0, 0, R0, 5, R0)), stone(0xb89a7a));
  b.add(P.cylB(36), L(M(0, 5, 0, 0, 0, 0, R0 - 0.5, 16, R0 - 0.5)), stone(0xe2cfaa));
  // columns and arched windows around the drum
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const cx = Math.cos(a) * (R0 - 0.1), cz = Math.sin(a) * (R0 - 0.1);
    b.add(P.cylB(10), L(M(cx, 5, cz, 0, 0, 0, 0.45, 15, 0.45)), stone(0xf0dcb6));
    if (i % 2 === 0) {
      const wa = a + Math.PI / 24;
      b.add(P.box(), L(M(Math.cos(wa) * (R0 - 0.45), 12.5, Math.sin(wa) * (R0 - 0.45), 0, -wa + Math.PI / 2, 0, 2.2, 7, 0.3)), { color: 0x2e3a4c, layer: LAYER.GLASS, scale: 1.5, spec: 0.3, emit: 0, id: 0.93, uv: false });
    }
  }
  b.add(P.cylB(36), L(M(0, 20.5, 0, 0, 0, 0, R0 + 0.6, 1.0, R0 + 0.6)), stone(0xc8ae88));
  b.add(P.cylB(36), L(M(0, 21.5, 0, 0, 0, 0, R0 - 1.5, 3.0, R0 - 1.5)), stone(0xe2cfaa));
  // golden dome with ribs
  b.add(P.hemi(36, 14), L(M(0, 24.4, 0, 0, 0, 0, R0 - 1.4, 11, R0 - 1.4)), metal(PAL.gold, 0.9));
  for (let i = 0; i < 16; i++) b.add(P.torus(4, 18, Math.PI / 2, 0.14), L(mul(M(0, 24.4, 0, 0, (i / 16) * Math.PI * 2, 0), M(0, 0, 0, 0, 0, Math.PI / 2, R0 - 1.38, 11.02, R0 - 1.38))), metal(PAL.brassDark, 0.8));
  b.add(P.cylB(12), L(M(0, 35, 0, 0, 0, 0, 2.2, 4, 2.2)), stone(0xf0dcb6));
  b.add(P.hemi(12, 6), L(M(0, 39, 0, 0, 0, 0, 2.4, 2.2, 2.4)), patina());
  b.add(P.cone(8), L(M(0, 41, 0, 0, 0, 0, 0.25, 5, 0.25)), metal(PAL.gold, 0.9));
  // clock on the drum facing the square (east)
  const cm = L(M(R0 - 0.05, 16, 0, 0, Math.PI / 2, 0));
  b.add(P.cyl(32), mul(cm, M(0, 0, -0.1, Math.PI / 2, 0, 0, 3.4, 0.4, 3.4)), metal(PAL.brass, 0.85));
  clocks.push({ matrix: mul(cm, M(0, 0, 0.12)), r: 3.1, name: 'dome' });
  // entrance portico facing the square
  const P0 = L(M(R0 + 2.5, 0, 0, 0, Math.PI / 2, 0));
  b.add(P.boxB(), mul(P0, M(0, 0, 0, 0, 0, 0, 10, 1.2, 5)), stone(0xb89a7a));
  for (const cx of [-4, -1.35, 1.35, 4]) b.add(P.cylB(12), mul(P0, M(cx, 1.2, 1.8, 0, 0, 0, 0.55, 9, 0.55)), stone(0xf0dcb6));
  b.add(gableRoof(11, 6, 2.2, 0.3, { ends: true }), mul(P0, M(0, 10.2, 0.5, 0, 0, 0)), { ...stone(0xe2cfaa), uv: false });
}

// ------------------------------------------------------------------ factory district
function factory(b, X) {
  const r = new RNG(5151);
  const F = CITY.factory;
  const stacks = [];
  const brick = (c) => ({ color: c ?? r.pick(PAL.brick), layer: LAYER.BRICK, scale: 2.8, spec: 0, emit: 0, id: 0.94, uv: false });
  // halls with sawtooth roofs
  for (let i = 0; i < 9; i++) {
    const cx = r.range(F.x0 + 30, F.x1 - 30), cz = r.range(F.z0 + 30, F.z1 - 30);
    const w = r.range(40, 70), d = r.range(24, 36), h = r.range(12, 18);
    const rot = r.chance(0.5) ? 0 : Math.PI / 2;
    const T = M(cx, 0, cz, 0, rot, 0);
    b.add(boxUV(w, h, d), mul(T, M(0, h / 2, 0)), { color: r.pick(PAL.brick), layer: LAYER.FACADE, scale: 12, spec: 0, emit: 0, id: 0.94, uv: true });
    const n = Math.floor(w / 7);
    for (let k = 0; k < n; k++) {
      const x0 = -w / 2 + k * (w / n);
      const g = new THREE.BufferGeometry();
      const x1 = x0 + w / n, yb = h, yt = h + 3.2;
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        x0, yb, d / 2, x1, yb, d / 2, x0, yt, d / 2,  x0, yt, -d / 2, x1, yb, -d / 2, x0, yb, -d / 2,
        x0, yb, d / 2, x0, yt, -d / 2, x0, yb, -d / 2, x0, yb, d / 2, x0, yt, d / 2, x0, yt, -d / 2,
        x0, yt, d / 2, x1, yb, -d / 2, x0, yt, -d / 2, x0, yt, d / 2, x1, yb, d / 2, x1, yb, -d / 2,
      ], 3));
      g.computeVertexNormals();
      b.add(g, T, { color: r.pick(PAL.slate.concat(PAL.zinc)), layer: LAYER.SLATE, scale: 2.5, spec: 0.1, emit: 0, id: 0.94, uv: false });
      // north light glazing (glowing a little)
      b.add(P.box(), mul(T, M(x0 + 0.05, (yb + yt) / 2, 0, 0, 0, 0, 0.1, 2.8, d - 1)), { color: 0xffb060, layer: LAYER.GLASS, scale: 2, spec: 0.3, emit: 1.2, id: 0.94, uv: false });
    }
  }
  // gasometers
  for (let i = 0; i < 3; i++) {
    const cx = F.x0 + 60 + i * 80, cz = F.z0 + r.range(20, 60);
    const R = r.range(16, 22), h = r.range(20, 30);
    b.add(P.cylB(28), M(cx, 0, cz, 0, 0, 0, R, h, R), metal(r.pick([0x6a7a6a, 0x7a6a5a, 0x5a6a7a]), 0.3, 0.95));
    b.add(P.hemi(28, 6), M(cx, h, cz, 0, 0, 0, R, 3, R), metal(0x6a6a6a, 0.3, 0.95));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      b.add(P.box(), M(cx + Math.cos(a) * (R + 1.2), (h + 6) / 2, cz + Math.sin(a) * (R + 1.2), 0, -a, 0, 0.6, h + 6, 0.6), metal(0x3a3432, 0.3, 0.95));
    }
    for (const y of [h * 0.5, h + 5]) b.add(P.torus(4, 36, Math.PI * 2, 0.25), M(cx, y, cz, Math.PI / 2, 0, 0, R + 1.2), metal(0x3a3432, 0.3, 0.95));
  }
  // tall chimneys with bands; their tops emit white steam columns
  const spots = [[200, -120], [238, -40], [262, 60], [300, -150], [330, 10], [360, 110], [395, -80], [410, 40], [220, 130], [350, -40]];
  for (const [cx, cz] of spots) {
    const h = r.range(42, 78), r0 = r.range(2.2, 3.2);
    b.add(P.lathe('stack' + Math.round(h), [[0, 0], [r0 + 0.8, 0], [r0 + 0.8, 3], [r0, 3.4], [r0 * 0.72, h], [r0 * 0.9, h + 0.3], [r0 * 0.9, h + 1.4], [r0 * 0.66, h + 1.6], [0, h + 1.6]], 14), M(cx, 0, cz), brick(r.pick(PAL.brick)));
    for (let k = 1; k < 4; k++) b.add(P.torus(4, 18, Math.PI * 2, 0.18), M(cx, h * k * 0.24, cz, Math.PI / 2, 0, 0, r0 * (1 - k * 0.07) + 0.05), metal(0x3a3432, 0.3, 0.94));
    stacks.push({ pos: new THREE.Vector3(cx, h + 1.8, cz), r: r0 * 0.66, seed: r.int(0, 9999) });
  }
  // conveyor bridge between two halls
  b.add(P.box(), M(260, 24, -80, 0, 0.4, 0, 70, 2.2, 3), metal(0x4a3a32, 0.3, 0.94));
  return { stacks };
}

// ------------------------------------------------------------------ airship mooring mast
function mast(b) {
  const { x, z } = CITY.mast;
  const H = 58;
  const mI = metal(0x3a3432, 0.4, 0.95);
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const base = 9, top = 2.2;
  for (const [a, c] of legs) b.add(P.box(), Mseg(new THREE.Vector3(x + a * base, 0, z + c * base), new THREE.Vector3(x + a * top, H, z + c * top), 0.5, 0.5), mI);
  for (let k = 0; k < 8; k++) {
    const y0 = (k / 8) * H, y1 = ((k + 1) / 8) * H;
    const s0 = base + (top - base) * (k / 8), s1 = base + (top - base) * ((k + 1) / 8);
    for (let i = 0; i < 4; i++) {
      const [a0, c0] = legs[i], [a1, c1] = legs[(i + 1) % 4];
      b.add(P.box(), Mseg(new THREE.Vector3(x + a0 * s0, y0, z + c0 * s0), new THREE.Vector3(x + a1 * s1, y1, z + c1 * s1), 0.18, 0.18), mI);
      b.add(P.box(), Mseg(new THREE.Vector3(x + a0 * s1, y1, z + c0 * s1), new THREE.Vector3(x + a1 * s1, y1, z + c1 * s1), 0.2, 0.2), mI);
    }
  }
  b.add(P.cylB(16), M(x, H, z, 0, 0, 0, 4.2, 0.8, 4.2), metal(PAL.brassDark, 0.6, 0.95));
  b.add(P.cone(12), M(x, H + 0.8, z, 0, 0, 0, 1.5, 5.5, 1.5), metal(PAL.brass, 0.8, 0.95));
  b.add(P.cylB(10), M(x, H + 6.2, z, 0, 0, 0, 0.35, 2.5, 0.35), metal(PAL.brass, 0.8, 0.95));
  return { top: new THREE.Vector3(x, H + 8.7, z) };
}

// ------------------------------------------------------------------ clock faces and hands
function clockTexture() {
  return canvasTexture(1024, 1024, (ctx, W) => {
    const c = W / 2;
    const g = ctx.createRadialGradient(c, c, 40, c, c, c);
    g.addColorStop(0, '#fbf2dc'); g.addColorStop(0.85, '#eadcb8'); g.addColorStop(1, '#c9a060');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(c, c, c * 0.9, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c, c, c * 0.62, 0, Math.PI * 2); ctx.stroke();
    // minute ticks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r0 = c * (i % 5 ? 0.86 : 0.82), r1 = c * 0.9;
      ctx.lineWidth = i % 5 ? 4 : 10;
      ctx.beginPath(); ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); ctx.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); ctx.stroke();
    }
    const RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.fillStyle = '#2a1a12';
    ctx.font = `bold ${Math.round(W * 0.085)}px "DejaVu Serif", Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    RN.forEach((t, i) => {
      const a = (i / 12) * Math.PI * 2;
      ctx.save(); ctx.translate(c + Math.sin(a) * c * 0.72, c - Math.cos(a) * c * 0.72); ctx.rotate(a);
      ctx.fillText(t, 0, 0); ctx.restore();
    });
    // decorative gear in the centre
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; const rr = c * (i % 2 ? 0.2 : 0.24); ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); }
    ctx.stroke();
  });
}

const HAND_FRAG = null;

export function buildClocks(clockList) {
  const group = new THREE.Group();
  const tex = clockTexture();
  const mat = texturedMaterial(tex, { polygonOffset: true });
  mat.uniforms.uGlowClock = { value: 0 };
  const hands = [];
  const handMat = worldMaterial();
  const hourGeo = handGeometry(0.55, 0.09);
  const minGeo = handGeometry(0.82, 0.06);
  for (const c of clockList) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(c.r, 48), mat);
    face.matrixAutoUpdate = false;
    face.matrix.copy(c.matrix);
    group.add(face);
    const hh = new THREE.Mesh(hourGeo, handMat), mh = new THREE.Mesh(minGeo, handMat);
    for (const h of [hh, mh]) { h.matrixAutoUpdate = false; group.add(h); }
    hands.push({ c, hh, mh });
  }
  const _r = new THREE.Matrix4(), _s = new THREE.Matrix4();
  return {
    group,
    faceMat: mat,
    // minutes since 6 pm (e.g. 55 = 6:55)
    setTime(minutes) {
      const hourAng = -((6 + minutes / 60) / 12) * Math.PI * 2;
      const minAng = -(minutes / 60) * Math.PI * 2;
      for (const { c, hh, mh } of hands) {
        _s.makeScale(c.r, c.r, c.r);
        hh.matrix.copy(c.matrix).multiply(_r.makeTranslation(0, 0, 0.08)).multiply(_s).multiply(new THREE.Matrix4().makeRotationZ(hourAng));
        mh.matrix.copy(c.matrix).multiply(_r.makeTranslation(0, 0, 0.14)).multiply(_s).multiply(new THREE.Matrix4().makeRotationZ(minAng));
      }
    },
  };
}
function handGeometry(len, w) {
  const b = new GeoBuilder();
  const m = { color: 0x1e1614, layer: LAYER.IRON, scale: 1, spec: 0.5, emit: 0, id: 0.95, uv: false };
  b.add(P.box(), M(0, len / 2 - 0.08, 0, 0, 0, 0, w, len, 0.03), m);
  b.add(P.box(), M(0, len - 0.04, 0, 0, 0, Math.PI / 4, w * 1.6, w * 1.6, 0.03), m);
  b.add(P.cyl(12), M(0, 0, 0, Math.PI / 2, 0, 0, w * 1.2, 0.05, w * 1.2), { ...m, color: PAL.brass, layer: LAYER.METAL, spec: 0.9 });
  return b.build();
}

// ------------------------------------------------------------------ far city: painted skyline rings
const FAR_VERT = /* glsl */ `
out vec2 vUv; out vec3 vWP; out float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vUv = uv;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FAR_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uLayer; uniform vec3 uTintA; uniform vec3 uTintB; uniform float uLights;
in vec2 vUv; in vec3 vWP; in float vDepth;
void main() {
  if (uPass == 1) discard;
  vec4 t = texture(uMap, vUv);
  if (t.a < 0.5) discard;
  // silhouettes: two tone (lit side / shade) mixed into the haze
  vec3 dir = normalize(vWP - uCamPos);
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0) + 1e-4, 3.0);
  vec3 base = mix(uTintA, uTintB, t.r);
  vec3 haze = mix(uFogColor, uFogSunColor, clamp(sunAmt, 0.0, 1.0));
  vec3 col = mix(base, haze, 0.35 + 0.18 * uLayer);
  // lit windows as tiny warm dots
  col += vec3(1.0, 0.6, 0.25) * t.g * uLights * (1.2 - 0.3 * uLayer);
  oColor = vec4(col, 0.0);
  oNormal = vec4(0.0, 0.0, 0.0, 30000.0 + uLayer * 1000.0);
}`;

function skylineTexture(seed, { towers = 0.2, domes = 0.1, spires = 0.05, cathedral = false } = {}) {
  const r = new RNG(seed);
  return canvasTexture(4096, 256, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    // R = shade tone, G = window lights, A = coverage
    const put = (x, y, w, h, shade) => {
      ctx.fillStyle = `rgb(${shade},0,0)`;
      ctx.fillRect(x, H - y - h, w, h);
    };
    let x = 0;
    while (x < W) {
      const w = r.range(18, 60), h = r.range(40, 110);
      const shade = r.int(20, 140);
      put(x, 0, w, h, shade);
      // roofs
      ctx.fillStyle = `rgb(${Math.max(0, shade - 30)},0,0)`;
      if (r.chance(0.6)) { ctx.beginPath(); ctx.moveTo(x, H - h); ctx.lineTo(x + w / 2, H - h - r.range(10, 30)); ctx.lineTo(x + w, H - h); ctx.fill(); }
      if (r.chance(towers)) put(x + w * 0.3, h, w * 0.4, r.range(30, 80), shade + 20);
      if (r.chance(domes)) { ctx.beginPath(); ctx.arc(x + w / 2, H - h, w * 0.45, Math.PI, 0); ctx.fill(); }
      if (r.chance(spires)) { ctx.beginPath(); ctx.moveTo(x + w * 0.4, H - h); ctx.lineTo(x + w * 0.5, H - h - r.range(60, 120)); ctx.lineTo(x + w * 0.6, H - h); ctx.fill(); }
      if (r.chance(0.3)) put(x + r.range(0, w - 6), h, 5, r.range(20, 60), 60); // chimney
      // windows
      for (let k = 0; k < w * h / 120; k++) {
        if (!r.chance(0.35)) continue;
        ctx.fillStyle = `rgb(${shade},255,0)`;
        ctx.fillRect(x + r.range(2, w - 4), H - r.range(4, h - 4), 2, 3);
      }
      x += w + r.range(-4, 6);
    }
    if (cathedral) {
      const cx = W * 0.62;
      ctx.fillStyle = 'rgb(60,0,0)';
      ctx.fillRect(cx - 120, H - 150, 240, 150);
      for (const [dx, hh, ww] of [[-100, 230, 40], [100, 230, 40], [0, 200, 60], [-40, 150, 20], [40, 150, 20]]) {
        ctx.fillRect(cx + dx - ww / 2, H - hh, ww, hh);
        ctx.beginPath(); ctx.moveTo(cx + dx - ww / 2, H - hh); ctx.lineTo(cx + dx, H - hh - ww * 2.6); ctx.lineTo(cx + dx + ww / 2, H - hh); ctx.fill();
      }
    }
    // alpha from red+green channel usage
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const covered = img.data[i] > 0 || img.data[i + 1] > 0 || img.data[i + 3] > 0;
      img.data[i + 3] = covered ? 255 : 0;
      if (covered && img.data[i] === 0) img.data[i] = 40;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false, mip: true });
}

export function buildFarCity() {
  const group = new THREE.Group();
  const layers = [
    { R: 820, h: 70, seed: 1, cathedral: false, tintA: 0x4a3a58, tintB: 0x8a6a78 },
    { R: 1300, h: 110, seed: 2, cathedral: true, tintA: 0x5a4a6a, tintB: 0x9a8090 },
    { R: 2100, h: 150, seed: 3, cathedral: false, tintA: 0x6a5a7a, tintB: 0xa894a0 },
  ];
  layers.forEach((L, i) => {
    const tex = skylineTexture(L.seed * 97, { cathedral: L.cathedral, spires: 0.06 + i * 0.03 });
    tex.wrapS = THREE.RepeatWrapping;
    const g = new THREE.CylinderGeometry(L.R, L.R, L.h, 96, 1, true);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 3.0);
    g.translate(0, L.h / 2 - 8, 0);
    const mat = toonMaterial({ vertex: FAR_VERT, fragment: FAR_FRAG, side: THREE.BackSide, uniforms: {
      uMap: { value: tex }, uLayer: { value: i }, uTintA: { value: new THREE.Color(L.tintA) }, uTintB: { value: new THREE.Color(L.tintB) }, uLights: { value: 0.4 } } });
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, 0, -120);
    m.frustumCulled = false;
    m.renderOrder = 18;
    group.add(m);
  });
  return group;
}
