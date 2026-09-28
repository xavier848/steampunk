// The underworld: the service shaft from the brass hatch down through sewer, pipe
// gallery and mine tunnel into the vaulted machine hall with the magma river and the
// Great Heart. Moving parts (heart rings, pistons, wall gears, crane, carts, crates,
// chain) are updated as a function of story time.
import * as THREE from 'three';
import { GeoBuilder, P, M, Mseg, mul, pipeRun, gearGeometry } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { worldMaterial, toonMaterial, BLEND_ADD, U } from '../engine/materials.js';
import { LAYER_STATIC_CASTER, LAYER_DYN_CASTER } from '../engine/engine.js';
import { RNG, noise1 } from '../core/rng.js';
import { clamp, smoothstep } from '../core/math.js';
import { CITY } from './layout.js';
import { PAL } from './palette.js';
import { ROOF } from './rooftops.js';

export const HALL = {
  floor: -150, crown: -80, spring: -100, halfW: 70, z0: -58, z1: -292,
  heart: new THREE.Vector3(0, -128, -172), heartR: 8,
  platformY: -118.9,
  catwalkY: -118.0,
  shaft: new THREE.Vector3(CITY.hatch.x, 0, CITY.hatch.z),
  shaftR: ROOF.shaftR,
  ceilingAt: (x) => -80 - 20 * (x / 70) * (x / 70),
  chainBottom: -116.0,
};
// the catwalk from under the shaft to the heart platform
HALL.catA = new THREE.Vector3(HALL.shaft.x, HALL.catwalkY, HALL.shaft.z - 1.2);
HALL.catB = new THREE.Vector3(HALL.heart.x + 8.6, HALL.platformY, HALL.heart.z + 7.2);
// tunnels crossing the shaft (y centre, axis)
export const TUNNELS = [
  { name: 'sewer', y: -6, axis: 'x', r: 2.0 },
  { name: 'pipes', y: -22, axis: 'z', r: 2.6 },
  { name: 'mine', y: -42, axis: 'x', r: 2.2 },
];

const mat = (color, layer, o = {}) => ({ color, layer, scale: 3, spec: 0, emit: 0, id: 0.3, uv: false, ...o });

export function buildUnderworld() {
  const group = new THREE.Group();
  const X = { lamps: [], vents: [], sparks: [], gears: [], beams: [] };
  const stat = new GeoBuilder();   // static hall and shaft
  const r = new RNG(1234);
  const sx = HALL.shaft.x, sz = HALL.shaft.z, R = HALL.shaftR;

  // ================================================================ the shaft
  const top = ROOF.h6 + 1.2;
  const bottom = HALL.ceilingAt(sx);
  const brick = mat(0x8a5040, LAYER.BRICK, { scale: 2.2, id: 0.2 });
  const iron = mat(0x3a3434, LAYER.IRON, { scale: 1.5, spec: 0.4, id: 0.21 });
  const brass = mat(PAL.brass, LAYER.METAL, { scale: 1.2, spec: 0.85, id: 0.22 });
  const copper = mat(PAL.copper, LAYER.METAL, { scale: 1.2, spec: 0.7, id: 0.23 });
  const stone = mat(0x7a6a60, LAYER.STONE, { scale: 3, id: 0.24 });
  const inTunnel = (y) => TUNNELS.find((t) => Math.abs(y - t.y) < t.r + 0.1);
  const segH = 1.5;
  for (let y = bottom; y < top - 0.01; y += segH) {
    const y1 = Math.min(top, y + segH);
    const t = inTunnel((y + y1) / 2);
    const lining = y > 0.5 ? brick : y > -50 ? stone : iron;
    if (!t) {
      // inward facing cylinder section (the lining)
      const g = new THREE.CylinderGeometry(R + 0.02, R + 0.02, y1 - y, 20, 1, true);
      g.scale(-1, 1, 1);
      stat.add(g, M(sx, (y + y1) / 2, sz), lining);
      // outer skin so the shaft reads from the tunnels and the hall
      stat.add(new THREE.CylinderGeometry(R + 0.35, R + 0.35, y1 - y, 16, 1, true), M(sx, (y + y1) / 2, sz), lining);
    } else {
      // opening: only the parts of the lining that are not in the tunnel direction
      for (const [a0, a1] of t.axis === 'x' ? [[0.35, Math.PI - 0.35], [Math.PI + 0.35, Math.PI * 2 - 0.35]] : [[-Math.PI / 2 + 0.35, Math.PI / 2 - 0.35], [Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35]]) {
        const g = new THREE.CylinderGeometry(R + 0.02, R + 0.02, y1 - y, 10, 1, true, a0, a1 - a0);
        g.scale(-1, 1, 1);
        stat.add(g, M(sx, (y + y1) / 2, sz), lining);
      }
    }
  }
  // rings, lamps, ladder, pipes along the shaft
  for (let y = top - 1.2, k = 0; y > bottom + 0.5; y -= 2.6, k++) {
    if (inTunnel(y)) continue;
    stat.add(new THREE.TorusGeometry(R - 0.02, 0.06, 5, 24), M(sx, y, sz, Math.PI / 2, 0, 0), iron);
    if (k % 4 === 1) {
      const a = (k * 1.3) % (Math.PI * 2);
      const lp = new THREE.Vector3(sx + Math.cos(a) * (R - 0.14), y - 0.3, sz + Math.sin(a) * (R - 0.14));
      stat.add(P.sphere(8, 6), M(lp.x, lp.y, lp.z, 0, 0, 0, 0.09), mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.25 }));
      stat.add(P.box(), M(lp.x, lp.y + 0.12, lp.z, 0, -a, 0, 0.2, 0.05, 0.2), iron);
      X.lamps.push({ pos: lp, base: 1, range: 7, power: 0.9, shaft: true });
    }
  }
  // maintenance ladder (rungs) on the north side, and a copper pipe on the west side
  for (let y = top - 1.5; y > bottom + 1; y -= 0.35) {
    if (inTunnel(y)) continue;
    stat.add(P.box(), M(sx, y, sz - R + 0.1, 0, 0, 0, 0.45, 0.035, 0.035), iron);
  }
  for (const dx of [-0.25, 0.25]) stat.add(P.box(), M(sx + dx, (top + bottom) / 2, sz - R + 0.07, 0, 0, 0, 0.04, top - bottom, 0.04), iron);
  stat.set(copper);
  pipeRun(stat, [[sx - R + 0.2, top - 1, sz + 0.2], [sx - R + 0.2, bottom + 1, sz + 0.2]], 0.1, { collarColor: PAL.brass });

  // ---- tunnels crossing the shaft
  for (const t of TUNNELS) {
    const L = 34;
    const T = t.axis === 'x' ? M(sx, t.y, sz, 0, 0, Math.PI / 2) : M(sx, t.y, sz, Math.PI / 2, 0, 0);
    const g = new THREE.CylinderGeometry(t.r, t.r, L, 20, 1, true, 0, Math.PI * 2);
    g.scale(-1, 1, 1);
    stat.add(g, T, t.name === 'mine' ? mat(0x5a4a40, LAYER.STONE, { scale: 2.5, id: 0.26 }) : brick);
    // floor of the tunnel
    const fl = t.axis === 'x' ? M(sx, t.y - t.r * 0.72, sz, 0, 0, 0, L, 0.1, t.r * 1.3) : M(sx, t.y - t.r * 0.72, sz, 0, 0, 0, t.r * 1.3, 0.1, L);
    stat.add(P.box(), fl, t.name === 'sewer' ? mat(0x2a4a5a, LAYER.WATER, { scale: 3, spec: 0.8, id: 0.27 }) : stone);
    // lamps in the tunnel
    for (const d of [-6, 6]) {
      const lp = t.axis === 'x' ? new THREE.Vector3(sx + d, t.y + t.r * 0.6, sz) : new THREE.Vector3(sx, t.y + t.r * 0.6, sz + d);
      stat.add(P.sphere(8, 6), M(lp.x, lp.y, lp.z, 0, 0, 0, 0.12), mat(0xffb060, LAYER.GLASS, { emit: 5, id: 0.25 }));
      X.lamps.push({ pos: lp, base: 1, range: 9, power: 1.0, shaft: true });
    }
    if (t.name === 'pipes') {
      stat.set(copper);
      for (const [ox, oy, rr] of [[-1.4, 0.8, 0.45], [1.3, 0.6, 0.55], [-1.6, -0.6, 0.3], [1.5, -0.8, 0.35]]) pipeRun(stat, [[sx + ox, t.y + oy, sz - L / 2], [sx + ox, t.y + oy, sz + L / 2]], rr, { collarColor: PAL.brass });
      X.vents.push({ pos: new THREE.Vector3(sx + 1.3, t.y + 1.2, sz + 3.5), dir: new THREE.Vector3(-0.3, 0.5, 0.2), seed: 71, small: true, range: 40 });
      X.vents.push({ pos: new THREE.Vector3(sx - 1.4, t.y + 1.3, sz - 4.2), dir: new THREE.Vector3(0.4, 0.4, -0.2), seed: 72, small: true, range: 40 });
    }
    if (t.name === 'mine') {
      for (const s of [-0.6, 0.6]) stat.add(P.box(), M(sx, t.y - t.r * 0.72 + 0.1, sz + s, 0, 0, 0, L, 0.08, 0.07), mat(0x6c6460, LAYER.IRON, { spec: 0.8, id: 0.28 }));
      for (let d = -L / 2 + 1; d < L / 2; d += 3) stat.add(P.box(), M(sx + d, t.y + 0.2, sz, 0, 0, 0, 0.25, t.r * 2 - 0.3, 0.25).premultiply(new THREE.Matrix4()), mat(0x5a3a26, LAYER.WOOD, { id: 0.29 })); // timber props
    }
  }

  // ================================================================ the machine hall
  const H = HALL;
  const wallM = mat(0x8a7466, LAYER.STONE, { scale: 4, id: 0.31 });
  const vaultM = mat(0x6e5c56, LAYER.BRICK, { scale: 3.5, id: 0.32 });
  const floorM = mat(0x5a4c46, LAYER.FLAGSTONE, { scale: 5, id: 0.33 });
  const ironM = mat(0x36302e, LAYER.IRON, { scale: 2, spec: 0.4, id: 0.34 });
  const L = H.z0 - H.z1, zc = (H.z0 + H.z1) / 2;
  // floor (with a hole for the magma pool and channel handled by drawing them on top)
  stat.add(P.box(), M(0, H.floor - 0.5, zc, 0, 0, 0, H.halfW * 2, 1, L), floorM);
  // side walls with buttresses and arched niches
  for (const s of [-1, 1]) {
    stat.add(P.box(), M(s * (H.halfW + 1), (H.floor + H.spring) / 2, zc, 0, 0, 0, 2, H.spring - H.floor, L), wallM);
    for (let z = H.z0 - 6; z > H.z1; z -= 16) {
      stat.add(P.box(), M(s * (H.halfW - 1.2), (H.floor + H.spring) / 2, z, 0, 0, 0, 2.4, H.spring - H.floor, 3), mat(0x9a8474, LAYER.STONE, { scale: 4, id: 0.35 }));
      // lamp on every buttress
      const lp = new THREE.Vector3(s * (H.halfW - 2.8), -128, z);
      stat.add(P.cylB(8), M(lp.x, lp.y - 0.4, lp.z, 0, 0, 0, 0.35, 1.0, 0.35), mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.36 }));
      stat.add(P.cone(8), M(lp.x, lp.y + 0.6, lp.z, 0, 0, 0, 0.5, 0.4, 0.5), ironM);
      X.lamps.push({ pos: lp, base: 0.35, range: 22, power: 1.4, hall: true });
    }
  }
  // end walls
  for (const z of [H.z0 + 1, H.z1 - 1]) stat.add(P.box(), M(0, (H.floor + H.crown) / 2, z, 0, 0, 0, H.halfW * 2 + 4, H.crown - H.floor, 2), wallM);
  // segmental vault: strips across the width, facing down
  const strips = 24;
  for (let i = 0; i < strips; i++) {
    const x0 = -H.halfW + (i / strips) * 2 * H.halfW, x1 = -H.halfW + ((i + 1) / strips) * 2 * H.halfW;
    const y0 = H.ceilingAt(x0), y1 = H.ceilingAt(x1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, H.z0, x1, y1, H.z1, x1, y1, H.z0, x0, y0, H.z0, x0, y0, H.z1, x1, y1, H.z1], 3));
    g.computeVertexNormals();
    // the shaft passes through the vault: leave that strip open around the shaft
    if (x0 <= sx + R && x1 >= sx - R) {
      const a = new THREE.BufferGeometry(), b = new THREE.BufferGeometry();
      const zA = sz + R + 0.3, zB = sz - R - 0.3;
      a.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, H.z0, x1, y1, zA, x1, y1, H.z0, x0, y0, H.z0, x0, y0, zA, x1, y1, zA], 3));
      b.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, zB, x1, y1, H.z1, x1, y1, zB, x0, y0, zB, x0, y0, H.z1, x1, y1, H.z1], 3));
      a.computeVertexNormals(); b.computeVertexNormals();
      stat.add(a, null, vaultM); stat.add(b, null, vaultM);
    } else stat.add(g, null, vaultM);
  }
  // iron ribs of the vault
  for (let z = H.z0 - 12; z > H.z1; z -= 14) {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const x = -H.halfW + (k / 12) * 2 * H.halfW; pts.push(new THREE.Vector3(x, H.ceilingAt(x) - 0.6, z)); }
    for (let k = 0; k < 12; k++) stat.add(P.box(), Mseg(pts[k], pts[k + 1], 0.9, 0.7), ironM);
    for (const s of [-1, 1]) stat.add(P.box(), M(s * (H.halfW - 0.4), (H.floor + H.spring) / 2, z, 0, 0, 0, 0.8, H.spring - H.floor, 0.7), ironM);
  }
  // great pipes along the walls
  stat.set(copper);
  for (const s of [-1, 1]) {
    pipeRun(stat, [[s * 66, -106, H.z0 - 2], [s * 66, -106, H.z1 + 2]], 1.4, { collarColor: PAL.brass });
    pipeRun(stat, [[s * 63, -142, H.z0 - 2], [s * 63, -142, H.z1 + 2]], 0.9, { collarColor: PAL.brass });
  }

  // ---- magma: channel along the west side feeding a pool around the heart
  const magma = new GeoBuilder();
  const ch = { x0: -40, x1: -26 };
  magma.add(P.box(), M((ch.x0 + ch.x1) / 2, H.floor - 0.6, (H.z0 - 4 + H.heart.z) / 2, 0, 0, 0, ch.x1 - ch.x0, 0.2, H.z0 - 4 - H.heart.z), mat(0xff7a20, LAYER.WATER, { id: 0.05 }));
  magma.add(P.box(), M((ch.x0 + ch.x1) / 2, H.floor - 0.6, (H.heart.z + H.z1 + 4) / 2, 0, 0, 0, ch.x1 - ch.x0, 0.2, H.heart.z - H.z1 - 4), mat(0xff7a20, LAYER.WATER, { id: 0.05 }));
  magma.add(new THREE.CylinderGeometry(30, 30, 0.2, 48), M(H.heart.x, H.floor - 0.6, H.heart.z), mat(0xff7a20, LAYER.WATER, { id: 0.05 }));
  // stone rims of channel and pool
  for (const x of [ch.x0 - 0.8, ch.x1 + 0.8]) {
    stat.add(P.box(), M(x, H.floor + 0.2, (H.z0 - 4 + H.heart.z + 28) / 2, 0, 0, 0, 1.6, 1.2, H.z0 - 4 - H.heart.z - 28), mat(0x4a3c38, LAYER.STONE, { scale: 2, id: 0.37 }));
    stat.add(P.box(), M(x, H.floor + 0.2, (H.heart.z - 28 + H.z1 + 4) / 2, 0, 0, 0, 1.6, 1.2, H.heart.z - 28 - H.z1 - 4), mat(0x4a3c38, LAYER.STONE, { scale: 2, id: 0.37 }));
  }
  stat.add(new THREE.TorusGeometry(30.8, 0.9, 6, 64), M(H.heart.x, H.floor + 0.1, H.heart.z, Math.PI / 2, 0, 0), mat(0x4a3c38, LAYER.STONE, { scale: 2, id: 0.37 }));
  const magmaMesh = new THREE.Mesh(magma.build(), magmaMaterial());
  group.add(magmaMesh);
  // embers and steam over the magma
  for (let i = 0; i < 10; i++) X.sparks.push({ kind: 'ember', pos: new THREE.Vector3(r.range(ch.x0, ch.x1), H.floor, r.range(H.z1 + 10, H.z0 - 10)) });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; X.sparks.push({ kind: 'ember', pos: new THREE.Vector3(H.heart.x + Math.cos(a) * 22, H.floor, H.heart.z + Math.sin(a) * 22) }); }

  // ---- the heart's pedestal, platform and catwalk (static parts)
  const hc = H.heart;
  stat.add(P.cylB(24), M(hc.x, H.floor - 1, hc.z, 0, 0, 0, 13, 9, 13), mat(0x5a4a44, LAYER.STONE, { scale: 3, id: 0.4 }));
  stat.add(P.cylB(24), M(hc.x, H.floor + 8, hc.z, 0, 0, 0, 10, 2, 10), mat(PAL.brassDark, LAYER.METAL, { spec: 0.6, id: 0.41 }));
  stat.add(P.lathe('heartcol', [[0, 0], [7, 0], [5.2, 4], [4.2, 10], [5.0, 13.2], [0, 13.2]], 24), M(hc.x, H.floor + 10, hc.z), mat(0x4a3e3a, LAYER.IRON, { scale: 2, spec: 0.3, id: 0.41 }));
  // platform ring around the sphere at the socket height
  const pY = H.platformY;
  stat.add(new THREE.RingGeometry(9.2, 12.6, 48).rotateX(-Math.PI / 2), M(hc.x, pY, hc.z), mat(0x6a5a4a, LAYER.PLANKS, { scale: 2, id: 0.42 }));
  stat.add(new THREE.RingGeometry(9.2, 12.6, 48).rotateX(Math.PI / 2), M(hc.x, pY - 0.12, hc.z), ironM);
  stat.add(new THREE.CylinderGeometry(12.6, 12.6, 1.1, 48, 1, true), M(hc.x, pY + 0.5, hc.z), mat(0x3a3434, LAYER.IRON, { scale: 1.5, spec: 0.4, id: 0.43 }));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; stat.add(P.box(), Mseg(new THREE.Vector3(hc.x + Math.cos(a) * 11, H.floor + 13, hc.z + Math.sin(a) * 11), new THREE.Vector3(hc.x + Math.cos(a) * 11.5, pY - 0.1, hc.z + Math.sin(a) * 11.5), 0.3, 0.3), ironM); }
  // catwalk from under the shaft to the platform (planks, rails, posts down to the floor)
  const A0 = H.catA, B0 = H.catB;
  const dir = B0.clone().sub(A0); const len = dir.length(); dir.normalize();
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  const yaw = Math.atan2(dir.x, dir.z);
  for (let d = -3; d < len + 1.2; d += 0.32) {
    const p = A0.clone().addScaledVector(dir, d);
    p.y = A0.y + (B0.y - A0.y) * clamp(d / len);
    stat.add(P.box(), M(p.x, p.y - 0.04, p.z, 0, yaw, 0, 1.6, 0.07, 0.28), mat(r.pick([0x7a5234, 0x6a4a2e, 0x8a6040]), LAYER.PLANKS, { scale: 1.2, id: 0.44 }));
  }
  for (const s of [-1, 1]) {
    const a = A0.clone().addScaledVector(side, s * 0.85).addScaledVector(dir, -3), b = B0.clone().addScaledVector(side, s * 0.85);
    stat.add(P.box(), Mseg(a.clone().add(new THREE.Vector3(0, 1.05, 0)), b.clone().add(new THREE.Vector3(0, 1.05, 0)), 0.06, 0.06), ironM);
    stat.add(P.box(), Mseg(a.clone().add(new THREE.Vector3(0, 0.5, 0)), b.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.04, 0.04), ironM);
    for (let d = -3; d < len; d += 2.4) {
      const p = A0.clone().addScaledVector(dir, d).addScaledVector(side, s * 0.85);
      p.y = A0.y + (B0.y - A0.y) * clamp(d / len);
      stat.add(P.box(), M(p.x, p.y + 0.52, p.z, 0, 0, 0, 0.06, 1.05, 0.06), ironM);
      if (Math.round(d / 2.4) % 3 === 0) stat.add(P.box(), M(p.x, (p.y + H.floor) / 2, p.z, 0, 0, 0, 0.35, p.y - H.floor, 0.35), ironM);
    }
  }
  // lamps along the catwalk
  for (let d = 4; d < len; d += 9) {
    const p = A0.clone().addScaledVector(dir, d).addScaledVector(side, 0.95);
    p.y = A0.y + (B0.y - A0.y) * clamp(d / len) + 1.5;
    stat.add(P.sphere(8, 6), M(p.x, p.y, p.z, 0, 0, 0, 0.14), mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.45 }));
    X.lamps.push({ pos: p, base: 0.3, range: 10, power: 1.0, hall: true });
  }

  // ---- floor furniture: furnaces, anvils, crates, workbenches
  for (let i = 0; i < 6; i++) {
    const z = H.z0 - 30 - i * 36, x = 38 + r.range(-4, 4);
    stat.add(P.boxB(), M(x, H.floor, z, 0, 0, 0, 8, 7, 8), mat(0x6a4a3a, LAYER.BRICK, { scale: 2.5, id: 0.46 }));
    stat.add(P.cylB(12), M(x, H.floor + 7, z, 0, 0, 0, 1.2, 22, 1.2), mat(0x6a4a3a, LAYER.BRICK, { scale: 2.5, id: 0.46 }));
    stat.add(P.box(), M(x - 4.05, H.floor + 2.2, z, 0, 0, 0, 0.1, 2.4, 3), mat(0xff8a30, LAYER.GLASS, { emit: 4.5, id: 0.47 }));
    X.sparks.push({ kind: 'forge', pos: new THREE.Vector3(x - 4.3, H.floor + 1.8, z) });
    X.vents.push({ pos: new THREE.Vector3(x, H.floor + 29.2, z), dir: new THREE.Vector3(0, 1, 0), seed: 90 + i, big: true, range: 400, hall: true });
  }

  const statMesh = new THREE.Mesh(stat.build(), worldMaterial({ side: THREE.DoubleSide }));
  statMesh.layers.enable(LAYER_STATIC_CASTER);
  group.add(statMesh);

  // ================================================================ moving parts
  const moving = buildMoving(group, X, r);
  // light beams from the ceiling grates (painted shafts)
  const beams = buildBeams([
    { from: new THREE.Vector3(-20, H.ceilingAt(-20), -140), to: new THREE.Vector3(-16, H.floor, -150), r0: 1.5, r1: 7 },
    { from: new THREE.Vector3(25, H.ceilingAt(25), -205), to: new THREE.Vector3(20, H.floor, -214), r0: 1.4, r1: 6 },
    { from: new THREE.Vector3(-35, H.ceilingAt(-35), -240), to: new THREE.Vector3(-30, H.floor, -250), r0: 1.8, r1: 7 },
    { from: new THREE.Vector3(5, H.ceilingAt(5), -95), to: new THREE.Vector3(2, H.floor, -104), r0: 1.2, r1: 6 },
  ]);
  group.add(beams);
  return { group, X, magma: magmaMesh, beams, ...moving };
}

// ------------------------------------------------------------------ moving machinery
function buildMoving(group, X, r) {
  const H = HALL, hc = H.heart;
  const wm = worldMaterial();
  const mk = (b) => { const m = new THREE.Mesh(b.build(), wm); m.layers.enable(LAYER_DYN_CASTER); group.add(m); return m; };
  // heart sphere with the socket (glowing glass window around the socket)
  const hb = new GeoBuilder();
  hb.add(P.sphere(32, 20), M(0, 0, 0, 0, 0, 0, H.heartR), mat(PAL.brass, LAYER.METAL, { scale: 3, spec: 0.8, id: 0.5 }));
  for (let k = 0; k < 12; k++) hb.add(new THREE.TorusGeometry(H.heartR * 1.002, 0.08, 4, 40), M(0, 0, 0, 0, (k / 12) * Math.PI, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.5 }));
  for (let k = -3; k <= 3; k++) { const yy = k * H.heartR * 0.28; const rr = Math.sqrt(H.heartR * H.heartR - yy * yy) * 1.003; hb.add(new THREE.TorusGeometry(rr, 0.07, 4, 40), M(0, yy, 0, Math.PI / 2, 0, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.5 })); }
  // glass windows around the equator: show the inner glow
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; hb.add(P.sphere(12, 8), M(Math.cos(a) * H.heartR * 0.93, 0.5, Math.sin(a) * H.heartR * 0.93, 0, 0, 0, 1.2, 1.5, 1.2), mat(0xffb040, LAYER.GLASS, { emit: 4, id: 0.51 })); }
  const heart = mk(hb);
  heart.position.copy(hc);
  // the socket faces the catwalk
  const sockDir = H.catB.clone().sub(hc); sockDir.y = 0; sockDir.normalize();
  const socket = hc.clone().addScaledVector(sockDir, H.heartR + 0.15); socket.y = H.platformY + 1.15;
  const sb = new GeoBuilder();
  sb.add(new THREE.TorusGeometry(0.42, 0.1, 8, 24), M(0, 0, 0), mat(PAL.gold, LAYER.METAL, { spec: 0.95, id: 0.52 }));
  sb.add(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 20, 1, true).rotateX(Math.PI / 2), M(0, 0, -0.2), mat(0x2a2020, LAYER.IRON, { id: 0.52 }));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; sb.add(P.box(), M(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.02, 0, 0, a, 0.3, 0.1, 0.12), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.52 })); }
  const socketMesh = mk(sb);
  socketMesh.position.copy(socket);
  socketMesh.lookAt(socket.clone().add(sockDir));
  // the old, cracked core (dark) and the slot for the new one
  const oldCore = mk((() => { const b = new GeoBuilder(); b.add(P.sphere(12, 8), M(0, 0, 0, 0, 0, 0, 0.3), mat(0x3a2a24, LAYER.GLASS, { spec: 0.4, id: 0.53, emit: 0.4 })); return b; })());
  oldCore.position.copy(socket.clone().addScaledVector(sockDir, 0.05));
  // armillary rings
  const rings = [];
  for (const [rad, tilt, col] of [[11.2, 0.35, PAL.brass], [13.2, -0.6, PAL.copper], [15.2, 1.1, PAL.gold]]) {
    const b = new GeoBuilder();
    b.add(new THREE.TorusGeometry(rad, 0.42, 8, 64), M(), mat(col, LAYER.METAL, { spec: 0.85, id: 0.54 }));
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; b.add(P.box(), M(Math.cos(a) * rad, Math.sin(a) * rad, 0, 0, 0, a, 0.9, 0.3, 1.0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.54 })); }
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; b.add(P.sphere(10, 8), M(Math.cos(a) * rad, Math.sin(a) * rad, 0, 0, 0, 0, 0.7), mat(0xffb040, LAYER.GLASS, { emit: 3.5, id: 0.55 })); }
    const m = mk(b);
    m.position.copy(hc);
    rings.push({ mesh: m, tilt, rad });
  }
  // pistons around the pedestal
  const pistons = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const px = hc.x + Math.cos(a) * 17, pz = hc.z + Math.sin(a) * 17;
    const cyl = new GeoBuilder();
    cyl.add(P.cylB(16), M(0, 0, 0, 0, 0, 0, 1.4, 12, 1.4), mat(PAL.copper, LAYER.METAL, { spec: 0.7, id: 0.56 }));
    for (const y of [1, 6, 11]) cyl.add(new THREE.TorusGeometry(1.45, 0.14, 6, 20), M(0, y, 0, Math.PI / 2, 0, 0), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.56 }));
    const c = mk(cyl); c.position.set(px, H.floor, pz);
    const rod = new GeoBuilder();
    rod.add(P.cylB(10), M(0, 0, 0, 0, 0, 0, 0.45, 9, 0.45), mat(0xb8b0a8, LAYER.METAL, { spec: 0.95, id: 0.57 }));
    rod.add(P.box(), M(0, 9.2, 0, 0, 0, 0, 2.2, 0.8, 1.2), mat(0x3a3434, LAYER.IRON, { spec: 0.4, id: 0.57 }));
    const rm = mk(rod); rm.position.set(px, H.floor + 11, pz); rm.rotation.y = -a;
    pistons.push({ rod: rm, base: H.floor + 11, phase: k * 0.785 });
    X.vents.push({ pos: new THREE.Vector3(px, H.floor + 12.3, pz), dir: new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)), seed: 200 + k, big: true, range: 500, hall: true, heart: true });
  }
  // wall gears (big, slow) on both side walls and the north end wall
  const gears = [];
  const gearGeo = (teeth, spokes) => { const b = new GeoBuilder(); b.add(gearGeometry(teeth, 0.86, 0.18, spokes, 0.12), null, mat(PAL.brassDark, LAYER.METAL, { scale: 4, spec: 0.7, id: 0.58 })); b.add(P.cyl(16), M(0, 0, 0.1, Math.PI / 2, 0, 0, 0.14, 0.3, 0.14), mat(0x3a3434, LAYER.IRON, { id: 0.58 })); return b; };
  const gDefs = [[-68.6, -118, -110, 14, 1], [-68.6, -130, -150, 9, -1], [68.6, -112, -135, 16, 1], [68.6, -134, -175, 10, -1], [-68.6, -115, -215, 13, -1], [68.6, -118, -240, 12, 1], [0, -112, -290.4, 18, 1], [26, -128, -290.4, 9, -1], [-24, -130, -290.4, 8, 1]];
  for (const [gx, gy, gz, rad, sgn] of gDefs) {
    const m = mk(gearGeo(Math.round(rad * 1.7), 6));
    m.position.set(gx, gy, gz);
    m.scale.setScalar(rad);
    const face = gz < -289 ? new THREE.Euler(0, 0, 0) : new THREE.Euler(0, gx < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    gears.push({ mesh: m, face, speed: (0.04 / rad) * 8 * sgn });
  }
  // bridge crane running along the hall
  const cb = new GeoBuilder();
  cb.add(P.box(), M(0, 0, 0, 0, 0, 0, 138, 2.2, 3.2), mat(0x5a3a2a, LAYER.IRON, { scale: 2, spec: 0.3, id: 0.59 }));
  for (let x = -66; x <= 66; x += 6) cb.add(P.box(), M(x, -1.6, 0, 0, 0, 0, 0.3, 1.2, 3.0), mat(0x4a3024, LAYER.IRON, { id: 0.59 }));
  cb.add(P.box(), M(8, -2.5, 0, 0, 0, 0, 4, 2.4, 4), mat(0xa8421e, LAYER.IRON, { spec: 0.3, id: 0.6 }));
  cb.add(P.box(), M(8, -14, 0, 0, 0, 0, 0.12, 20, 0.12), mat(0x2a2626, LAYER.IRON, { id: 0.6 }));
  cb.add(P.torus(6, 16, Math.PI * 1.5, 0.25), M(8, -24.5, 0, 0, 0, 0, 1.0), mat(0x2a2626, LAYER.IRON, { spec: 0.4, id: 0.6 }));
  cb.add(P.cylB(16), M(8, -30, 0, 0, 0, 0, 3.5, 4.5, 3.5), mat(0x6a5a50, LAYER.IRON, { scale: 2, id: 0.6 }));
  const crane = mk(cb);
  crane.position.set(0, -97, -150);
  // mine carts looping on the floor, crates on two conveyors
  const cartB = new GeoBuilder();
  cartB.add(P.box(), M(0, 0.8, 0, 0, 0, 0, 1.4, 1.0, 2.2), mat(0x5a4a40, LAYER.IRON, { spec: 0.3, id: 0.61 }));
  cartB.add(P.box(), M(0, 1.35, 0, 0, 0, 0, 1.2, 0.3, 2.0), mat(0x3a2a24, LAYER.STONE, { id: 0.61 }));
  for (const [x, z] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.7], [0.6, 0.7]]) cartB.add(P.cyl(10), M(x, 0.3, z, 0, 0, Math.PI / 2, 0.3, 0.12, 0.3), mat(0x2a2626, LAYER.IRON, { id: 0.61 }));
  const cartGeo = cartB.build();
  const carts = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cartGeo, wm); m.layers.enable(LAYER_DYN_CASTER); group.add(m); carts.push({ mesh: m, offset: i * 40, lane: i % 2 }); }
  // one cart in the mine tunnel of the shaft (it rolls past as Emil slides by)
  const tunnelCart = new THREE.Mesh(cartGeo, wm); group.add(tunnelCart);
  const crateB = new GeoBuilder();
  crateB.add(P.box(), M(0, 0.45, 0, 0, 0, 0, 0.9, 0.9, 0.9), mat(0x9a6a3e, LAYER.PLANKS, { scale: 1, id: 0.62 }));
  const crateGeo = crateB.build();
  const conveyor = new THREE.InstancedMesh(crateGeo, wm, 40);
  group.add(conveyor);
  const beltB = new GeoBuilder();
  for (const x of [52, 58]) {
    beltB.add(P.box(), M(x, H.floor + 1.2, (H.z0 + H.z1) / 2, 0, 0, 0, 1.8, 0.3, H.z0 - H.z1 - 20), mat(0x2a2424, LAYER.IRON, { id: 0.63 }));
    for (let z = H.z0 - 12; z > H.z1 + 12; z -= 4) beltB.add(P.box(), M(x, H.floor + 0.55, z, 0, 0, 0, 0.3, 1.1, 0.3), mat(0x3a3434, LAYER.IRON, { id: 0.63 }));
  }
  mk(beltB);
  return { heart, rings, pistons, gears, crane, carts, conveyor, tunnelCart, socket, sockDir, oldCore, socketMesh };
}

// ------------------------------------------------------------------ magma shader
const MAGMA_VERT = /* glsl */ `
out vec3 vWP; out float vDepth; out vec3 vVN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * mv;
}`;
const MAGMA_FRAG = /* glsl */ `
uniform float uHeat;
in vec3 vWP; in float vDepth; in vec3 vVN;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  // painted lava: crust plates drifting over hot seams
  vec2 p = vWP.xz * 0.06 + vec2(0.0, uTime * 0.035);
  vec4 a = texture(uBrush, vec3(p, 17.0));
  vec4 b = texture(uBrush, vec3(p * 1.9 + vec2(uTime * 0.02, 0.3), 14.0));
  float seam = smoothstep(0.55, 0.72, a.r * 0.6 + b.r * 0.55);
  float hot = smoothstep(0.35, 0.6, b.a) * 0.5 + seam;
  vec3 crust = vec3(0.18, 0.05, 0.03);
  vec3 glow = mix(vec3(2.6, 0.7, 0.15), vec3(4.0, 2.2, 0.8), seam);
  vec3 col = mix(crust, glow, clamp(hot, 0.0, 1.0)) * uHeat;
  col = applyFog(col, vWP);
  writeOut(col, normalize(vVN), vDepth, 0.05);
}`;
function magmaMaterial() {
  return toonMaterial({ vertex: MAGMA_VERT, fragment: MAGMA_FRAG, uniforms: { uHeat: { value: 1 } } });
}

// ------------------------------------------------------------------ light beams
const BEAM_VERT = /* glsl */ `
attribute float aT;
out float vT; out vec3 vN; out vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vT = aT; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uBeamColor; uniform float uBeam;
in float vT; in vec3 vN; in vec3 vWP;
void main() {
  if (uPass == 1) discard;
  vec3 V = normalize(uCamPos - vWP);
  float edge = pow(abs(dot(normalize(vN), V)) + 1e-4, 1.5);
  float a = edge * (1.0 - smoothstep(0.55, 1.0, vT)) * smoothstep(0.0, 0.08, vT) * uBeam;
  // painted streaks along the beam
  vec4 st = texture(uBrush, vec3(vec2(atan(vN.x, vN.z) * 1.2, vT * 0.8), 14.0));
  a *= 0.55 + 0.45 * smoothstep(0.4, 0.6, st.r);
  oColor = vec4(uBeamColor * a * 0.55, a);
  oNormal = vec4(0.0);
}`;
function buildBeams(list) {
  const group = new THREE.Group();
  const mt = toonMaterial({ vertex: BEAM_VERT, fragment: BEAM_FRAG, transparent: true, depthWrite: false, blending: BLEND_ADD, side: THREE.DoubleSide,
    uniforms: { uBeamColor: { value: new THREE.Color(1.0, 0.7, 0.4) }, uBeam: { value: 1 } } });
  for (const bm of list) {
    const len = bm.from.distanceTo(bm.to);
    const g = new THREE.CylinderGeometry(bm.r0, bm.r1, len, 20, 6, true);
    const P0 = g.attributes.position; const t = new Float32Array(P0.count);
    for (let i = 0; i < P0.count; i++) t[i] = 0.5 - P0.getY(i) / len;
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    const m = new THREE.Mesh(g, mt);
    m.position.copy(bm.from).lerp(bm.to, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), bm.to.clone().sub(bm.from).normalize());
    m.renderOrder = 29;
    m.frustumCulled = false;
    group.add(m);
  }
  group.userData.material = mt;
  return group;
}

// ------------------------------------------------------------------ the chain in the shaft
export class Chain {
  constructor(topY, bottomY, x, z) {
    const n = Math.floor((topY - bottomY) / 0.13);
    const link = new THREE.TorusGeometry(0.06, 0.016, 4, 8).scale(1, 1.6, 1);
    this.mesh = new THREE.InstancedMesh(link, worldMaterial(), n);
    // colour/material attributes for the world shader
    const vc = link.attributes.position.count;
    link.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(vc * 4).map((_, i) => [0.36, 0.33, 0.32, 0.64][i % 4]), 4));
    link.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(vc * 4).map((_, i) => [LAYER.IRON, 20, 150, 0][i % 4]), 4));
    this.n = n; this.topY = topY; this.x = x; this.z = z;
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
  }
  // swing(y) -> horizontal offset of the chain at height y (the boy pulls it)
  update(S, swing) {
    for (let i = 0; i < this.n; i++) {
      const y = this.topY - i * 0.13;
      const off = swing ? swing(y) : { x: 0, z: 0 };
      this._e.set(0, (i % 2) * Math.PI / 2, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(new THREE.Vector3(this.x + off.x, y, this.z + off.z), this._q, new THREE.Vector3(1, 1, 1));
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ per frame animation
export function animateUnderworld(u, S, awake) {
  const H = HALL;
  // awake: 0 dying heart .. 1 fully running (from the story)
  const flick = awake < 0.05 ? 0.55 + 0.45 * smoothstep(0.3, 0.6, noise1(S * 3.1, 7) * 0.5 + 0.5) : 1;
  u.rings.forEach((rg, i) => {
    const spd = (0.02 + awake * (0.35 + i * 0.12)) * (i % 2 ? -1 : 1);
    rg.mesh.rotation.set(rg.tilt + Math.sin(S * 0.05) * 0.02, S * spd * 0.3 + i, S * spd);
  });
  u.heart.rotation.y = S * (0.01 + awake * 0.15);
  u.pistons.forEach((p) => { p.rod.position.y = p.base + (0.4 + 2.6 * awake) * (0.5 + 0.5 * Math.sin(S * (1.5 + awake * 3.5) + p.phase)); });
  u.gears.forEach((g) => { g.mesh.rotation.set(g.face.x, g.face.y, S * g.speed * (0.25 + awake * 1.5)); });
  u.crane.position.z = -150 + Math.sin(S * 0.03) * 60;
  u.carts.forEach((c) => {
    const d = ((S * 3 + c.offset) % 460 + 460) % 460;
    const lane = c.lane ? 46 : -12;
    const z = d < 230 ? H.z0 - 5 - d : H.z1 + 5 + (d - 230);
    c.mesh.position.set(lane, H.floor, z);
    c.mesh.rotation.y = d < 230 ? Math.PI : 0;
  });
  for (let i = 0; i < 40; i++) {
    const L = H.z0 - H.z1 - 24;
    const d = ((S * 1.6 + i * (L / 20)) % L + L) % L;
    const x = i % 2 ? 52 : 58;
    u.conveyor.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, H.floor + 1.35, H.z0 - 12 - d));
  }
  u.conveyor.instanceMatrix.needsUpdate = true;
  u.magma.material.uniforms.uHeat.value = (0.85 + 0.35 * awake) * (0.9 + 0.1 * flick);
  return flick;
}
