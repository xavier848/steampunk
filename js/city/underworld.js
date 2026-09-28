// The underworld: the service shaft from the brass hatch down through the sewer, the
// pipe gallery and the mine gallery into the vaulted machine hall with the glow river
// and the Great Heart. Moving parts (heart rings, pistons, wall gears, crane, carts,
// crates, chain) are pure functions of story time.
import * as THREE from 'three';
import { GeoBuilder, P, M, Mseg, pipeRun, gearGeometry } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { worldMaterial, toonMaterial, BLEND_ADD } from '../engine/materials.js';
import { LAYER_STATIC_CASTER, LAYER_DYN_CASTER } from '../engine/engine.js';
import { RNG, noise1 } from '../core/rng.js';
import { smoothstep } from '../core/math.js';
import { CITY } from './layout.js';
import { PAL } from './palette.js';
import { ROOF } from './rooftops.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sx = CITY.hatch.x, sz = CITY.hatch.z;

export const HALL = {
  floor: -150, crown: -80, spring: -100, halfW: 70, z0: -58, z1: -292,
  heart: V(0, -117.7, -172), heartR: 8,
  platformY: -118.9, platR0: 8.6, platR1: 12.6,
  shaft: V(sx, 0, sz), shaftR: ROOF.shaftR,
  ceilingAt: (x) => -80 - 20 * (x / 70) * (x / 70),
  chainTop: ROOF.h6 + 0.95, chainBottom: -115.5,
  chain: V(sx, 0, sz + 0.35),        // the chain hangs off centre, the mine carts pass beside it
  pool: { r0: 21, r1: 30 },
  channel: { x0: -29.5, x1: -21.5 },
  gap: [39.15, 41.5],                // broken planks on the catwalk (distance from catA)
};
HALL.catA = V(sx, HALL.platformY, sz + 0.45);
{
  const d = V(HALL.catA.x - HALL.heart.x, 0, HALL.catA.z - HALL.heart.z).normalize();
  HALL.catDir = d.clone().negate();                       // from the shaft towards the heart
  HALL.catB = HALL.heart.clone().addScaledVector(d, HALL.platR1); HALL.catB.y = HALL.platformY;
  HALL.sockDir = d;                                       // the socket faces the catwalk
  HALL.socket = HALL.heart.clone().addScaledVector(d, HALL.heartR + 0.12);
  HALL.stand = HALL.heart.clone().addScaledVector(d, HALL.platR0 + 0.45); HALL.stand.y = HALL.platformY;
}
// galleries crossing the shaft
export const TUNNELS = [
  { name: 'sewer', y: -6, axis: 'x', r: 2.0, len: 44 },
  { name: 'pipes', y: -22, axis: 'z', r: 2.6, len: 44 },
  { name: 'mine', y: -42, axis: 'x', r: 2.3, len: 60 },
];
export const MINE_RAIL_Z = sz - 0.55;

const mat = (color, layer, o = {}) => ({ color, layer, scale: 3, spec: 0, emit: 0, id: 0.3, uv: false, ...o });

export function buildUnderworld() {
  const group = new THREE.Group();
  const X = { lamps: [], vents: [], embers: [], forges: [] };
  const stat = new GeoBuilder();
  const r = new RNG(1234);
  const R = HALL.shaftR;
  const H = HALL;

  // ================================================================ the shaft
  const top = ROOF.h6 + 1.2;
  const bottom = H.ceilingAt(sx) - 0.4;
  const brick = mat(0x8a5040, LAYER.BRICK, { scale: 2.2, id: 0.2 });
  const stone = mat(0x7a6a60, LAYER.STONE, { scale: 3, id: 0.24 });
  const ironM = mat(0x3a3434, LAYER.IRON, { scale: 1.5, spec: 0.4, id: 0.21 });
  const copper = mat(PAL.copper, LAYER.METAL, { scale: 1.2, spec: 0.7, id: 0.23 });
  const lampM = mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.25 });
  const inTunnel = (y) => TUNNELS.find((t) => Math.abs(y - t.y) < t.r + 0.05);
  const segH = 1.5;
  for (let y = bottom; y < top - 0.01; y += segH) {
    const y1 = Math.min(top, y + segH);
    // where a gallery crosses, the shaft simply opens into it
    const t = TUNNELS.find((tt) => y < tt.y + tt.r && y1 > tt.y - tt.r);
    const lining = y > 0 ? brick : y > -50 ? stone : ironM;
    const addRing = (ya, yb) => {
      if (yb - ya < 0.02) return;
      const g = new THREE.CylinderGeometry(R + 0.02, R + 0.02, yb - ya, 20, 1, true);
      g.scale(-1, 1, 1);
      stat.add(g, M(sx, (ya + yb) / 2, sz), lining);
      stat.add(new THREE.CylinderGeometry(R + 0.35, R + 0.35, yb - ya, 16, 1, true), M(sx, (ya + yb) / 2, sz), lining);
    };
    if (!t) addRing(y, y1);
    else { addRing(y, Math.min(y1, t.y - t.r)); addRing(Math.max(y, t.y + t.r), y1); }
  }
  // rings, lamps, ladder rungs, a pipe
  for (let y = top - 1.3, k = 0; y > bottom + 0.5; y -= 2.6, k++) {
    if (inTunnel(y) || inTunnel(y - 0.4)) continue;
    stat.add(new THREE.TorusGeometry(R - 0.02, 0.06, 5, 24), M(sx, y, sz, Math.PI / 2, 0, 0), ironM);
    if (k % 3 === 1) {
      const a = 2.2 + (k % 2) * 1.9;
      const lp = V(sx + Math.cos(a) * (R - 0.14), y - 0.3, sz + Math.sin(a) * (R - 0.14));
      stat.add(P.sphere(8, 6), M(lp.x, lp.y, lp.z, 0, 0, 0, 0.09), lampM);
      stat.add(P.box(), M(lp.x, lp.y + 0.12, lp.z, 0, -a, 0, 0.2, 0.05, 0.2), ironM);
      X.lamps.push({ pos: lp, base: 1, shaft: true });
    }
  }
  for (let y = top - 1.5; y > bottom + 1; y -= 0.35) {
    if (inTunnel(y)) continue;
    stat.add(P.box(), M(sx, y, sz - R + 0.1, 0, 0, 0, 0.45, 0.035, 0.035), ironM);
  }
  for (const dx of [-0.25, 0.25]) {
    let y0 = bottom + 1;
    for (const t of [...TUNNELS].reverse()) { stat.add(P.box(), Mseg(V(sx + dx, y0, sz - R + 0.07), V(sx + dx, t.y - t.r, sz - R + 0.07), 0.04, 0.04), ironM); y0 = t.y + t.r; }
    stat.add(P.box(), Mseg(V(sx + dx, y0, sz - R + 0.07), V(sx + dx, top - 1.2, sz - R + 0.07), 0.04, 0.04), ironM);
  }
  // the beam the chain hangs from, across the hatch collar
  stat.add(P.box(), M(sx, H.chainTop + 0.08, H.chain.z, 0, 0, 0, 1.7, 0.14, 0.12), ironM);
  stat.add(new THREE.TorusGeometry(0.07, 0.02, 4, 10), M(sx, H.chainTop, H.chain.z), ironM);

  // ---- galleries crossing the shaft
  const tunnelLamp = (p) => { stat.add(P.sphere(8, 6), M(p.x, p.y, p.z, 0, 0, 0, 0.12), lampM); stat.add(P.box(), M(p.x, p.y + 0.16, p.z, 0, 0, 0, 0.24, 0.06, 0.24), ironM); X.lamps.push({ pos: p, base: 1, shaft: true }); };
  for (const t of TUNNELS) {
    const L = t.len, gap = R + 0.12;
    const wallM = t.name === 'mine' ? mat(0x5a4a40, LAYER.STONE, { scale: 2.5, id: 0.26 }) : brick;
    // orientation: local cylinder Y along the gallery axis
    const rot = t.axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    const along = (d) => (t.axis === 'x' ? V(sx + d, t.y, sz) : V(sx, t.y, sz + d));
    const piece = (d0, d1, thetaStart = 0, thetaLen = Math.PI * 2) => {
      const g = new THREE.CylinderGeometry(t.r, t.r, d1 - d0, 18, 1, true, thetaStart, thetaLen);
      g.scale(-1, 1, 1);
      const c = along((d0 + d1) / 2);
      stat.add(g, M(c.x, c.y, c.z, ...rot), wallM);
    };
    // the cylinder parameter: for 'x' galleries lateral = r cos(theta), for 'z' lateral = r sin(theta)
    piece(-L / 2, -gap); piece(gap, L / 2);
    const k = Math.min(0.99, (R + 0.12) / t.r);
    if (t.axis === 'x') { const a = Math.acos(k); piece(-gap, gap, -a, 2 * a); piece(-gap, gap, Math.PI - a, 2 * a); }
    else { const a = Math.asin(k); piece(-gap, gap, a, Math.PI - 2 * a); piece(-gap, gap, Math.PI + a, Math.PI - 2 * a); }
    // end walls
    for (const s of [-1, 1]) { const c = along(s * L / 2); stat.add(P.cyl(18), M(c.x, c.y, c.z, ...rot, t.r + 0.1, 0.3, t.r + 0.1), mat(0x2a2220, LAYER.STONE, { id: 0.26 })); }
    // floor (split where the shaft passes)
    const fy = t.y - t.r * 0.72, fw = t.r * 1.34;
    const floorM = t.name === 'sewer' ? mat(0x2a4a5a, LAYER.WATER, { scale: 3, spec: 0.8, id: 0.27 }) : stone;
    for (const s of [-1, 1]) {
      const d0 = s * gap, d1 = s * L / 2, c = along((d0 + d1) / 2), len = Math.abs(d1 - d0);
      stat.add(P.box(), t.axis === 'x' ? M(c.x, fy, c.z, 0, 0, 0, len, 0.12, fw) : M(c.x, fy, c.z, 0, 0, 0, fw, 0.12, len), floorM);
      if (t.name === 'sewer') for (const w of [-1, 1]) stat.add(P.box(), M(c.x, fy + 0.25, c.z + w * (fw / 2 + 0.25), 0, 0, 0, len, 0.5, 0.5), stone); // walkways
    }
    for (const d of [-8, 8, -18, 18]) if (Math.abs(d) < L / 2 - 1) tunnelLamp(t.axis === 'x' ? V(sx + d, t.y + t.r * 0.62, sz + (d > 0 ? 1 : -1) * 0.8) : V(sx + (d > 0 ? 1 : -1) * 0.8, t.y + t.r * 0.62, sz + d));
    if (t.name === 'pipes') {
      stat.set(copper);
      for (const [ox, oy, rr] of [[-1.55, 0.9, 0.42], [1.55, 0.75, 0.5], [-1.7, -0.7, 0.3], [1.7, -0.8, 0.35]]) pipeRun(stat, [[sx + ox, t.y + oy, sz - L / 2], [sx + ox, t.y + oy, sz + L / 2]], rr, { collarColor: PAL.brass });
      X.vents.push({ pos: V(sx + 1.4, t.y + 1.3, sz + 3.5), dir: V(-0.4, 0.3, 0.2), seed: 71 });
      X.vents.push({ pos: V(sx - 1.5, t.y + 1.4, sz - 4.2), dir: V(0.4, 0.3, -0.2), seed: 72 });
    }
    if (t.name === 'mine') {
      // rails (they bridge the shaft on two girders) and timber props
      for (const s of [-0.4, 0.4]) {
        stat.add(P.box(), M(sx, fy + 0.12, MINE_RAIL_Z + s, 0, 0, 0, L, 0.08, 0.07), mat(0x8a8078, LAYER.IRON, { spec: 0.8, id: 0.28 }));
        stat.add(P.box(), M(sx, fy - 0.1, MINE_RAIL_Z + s, 0, 0, 0, gap * 2 + 1, 0.36, 0.12), ironM);
      }
      for (let d = -L / 2 + 1.5; d < L / 2; d += 3) {
        if (Math.abs(d) < gap + 0.5) continue;
        for (const s of [-1, 1]) stat.add(P.box(), M(sx + d, t.y - 0.2, sz + s * (t.r - 0.45), 0, 0, 0, 0.22, t.r * 1.6, 0.22), mat(0x5a3a26, LAYER.WOOD, { id: 0.29 }));
        stat.add(P.box(), M(sx + d, t.y + t.r * 0.62, sz, 0, 0, 0, 0.24, 0.22, t.r * 2 - 0.6), mat(0x5a3a26, LAYER.WOOD, { id: 0.29 }));
      }
    }
  }

  // ================================================================ the machine hall
  const hallWall = mat(0x8a7466, LAYER.STONE, { scale: 4, id: 0.31 });
  const vaultM = mat(0x6e5c56, LAYER.BRICK, { scale: 3.5, id: 0.32 });
  const floorM = mat(0x5a4c46, LAYER.FLAGSTONE, { scale: 5, id: 0.33 });
  const hallIron = mat(0x36302e, LAYER.IRON, { scale: 2, spec: 0.4, id: 0.34 });
  const rimM = mat(0x4a3c38, LAYER.STONE, { scale: 2, id: 0.37 });
  const L = H.z0 - H.z1, zc = (H.z0 + H.z1) / 2;
  stat.add(P.box(), M(0, H.floor - 0.5, zc, 0, 0, 0, H.halfW * 2 + 4, 1, L + 4), floorM);
  // side walls, buttresses with lamps
  for (const s of [-1, 1]) {
    stat.add(P.box(), M(s * (H.halfW + 1), (H.floor + H.spring) / 2, zc, 0, 0, 0, 2, H.spring - H.floor, L), hallWall);
    for (let z = H.z0 - 6; z > H.z1; z -= 16) {
      stat.add(P.box(), M(s * (H.halfW - 1.2), (H.floor + H.spring) / 2, z, 0, 0, 0, 2.4, H.spring - H.floor, 3), mat(0x9a8474, LAYER.STONE, { scale: 4, id: 0.35 }));
      const lp = V(s * (H.halfW - 2.9), -128, z);
      stat.add(P.cylB(8), M(lp.x, lp.y - 0.5, lp.z, 0, 0, 0, 0.35, 1.0, 0.35), mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.36 }));
      stat.add(P.cone(8), M(lp.x, lp.y + 0.5, lp.z, 0, 0, 0, 0.5, 0.4, 0.5), hallIron);
      X.lamps.push({ pos: lp, base: 0.6, hall: true });
    }
  }
  for (const z of [H.z0 + 1, H.z1 - 1]) stat.add(P.box(), M(0, (H.floor + H.crown) / 2 - 1, z, 0, 0, 0, H.halfW * 2 + 4, H.crown - H.floor + 2, 2), hallWall);
  // segmental vault (strips across the width); the shaft strip gets an opening
  const strips = 28;
  const quadStrip = (x0, x1, za, zb) => {
    const y0 = H.ceilingAt(x0), y1 = H.ceilingAt(x1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, za, x1, y1, zb, x1, y1, za, x0, y0, za, x0, y0, zb, x1, y1, zb], 3));
    g.computeVertexNormals();
    stat.add(g, null, vaultM);
  };
  for (let i = 0; i < strips; i++) {
    const x0 = -H.halfW + (i / strips) * 2 * H.halfW, x1 = -H.halfW + ((i + 1) / strips) * 2 * H.halfW;
    if (x0 <= sx + R + 0.3 && x1 >= sx - R - 0.3) {
      const xa = sx - R - 0.3, xb = sx + R + 0.3;
      if (xa > x0) quadStrip(x0, xa, H.z0, H.z1);
      if (xb < x1) quadStrip(xb, x1, H.z0, H.z1);
      quadStrip(Math.max(x0, xa), Math.min(x1, xb), H.z0, sz + R + 0.3);
      quadStrip(Math.max(x0, xa), Math.min(x1, xb), sz - R - 0.3, H.z1);
    } else quadStrip(x0, x1, H.z0, H.z1);
  }
  // collar where the shaft comes through the vault
  stat.add(new THREE.CylinderGeometry(R + 0.5, R + 0.8, 2.2, 20, 1, true), M(sx, H.ceilingAt(sx) - 0.6, sz), hallIron);
  stat.add(new THREE.TorusGeometry(R + 0.75, 0.16, 6, 24), M(sx, H.ceilingAt(sx) - 1.7, sz, Math.PI / 2, 0, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.7, id: 0.38 }));
  // iron ribs of the vault
  for (let z = H.z0 - 12; z > H.z1; z -= 14) {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const x = -H.halfW + (k / 12) * 2 * H.halfW; pts.push(V(x, H.ceilingAt(x) - 0.5, z)); }
    for (let k = 0; k < 12; k++) stat.add(P.box(), Mseg(pts[k], pts[k + 1], 0.9, 0.7), hallIron);
    for (const s of [-1, 1]) stat.add(P.box(), M(s * (H.halfW - 0.4), (H.floor + H.spring) / 2, z, 0, 0, 0, 0.8, H.spring - H.floor, 0.7), hallIron);
  }
  // grates in the vault with painted daylight behind (the light beams start there)
  const grates = [V(-20, 0, -140), V(25, 0, -205), V(-35, 0, -240), V(-8, 0, -96)];
  for (const g of grates) {
    g.y = H.ceilingAt(g.x) + 0.05;
    stat.add(P.box(), M(g.x, g.y + 0.2, g.z, 0, 0, 0, 3.2, 0.1, 3.2), mat(0xffe0b0, LAYER.BRUSH, { emit: 6, id: 0.39 }));
    for (let k = -2; k <= 2; k++) { stat.add(P.box(), M(g.x + k * 0.7, g.y - 0.05, g.z, 0, 0, 0, 0.12, 0.25, 3.4), hallIron); stat.add(P.box(), M(g.x, g.y - 0.05, g.z + k * 0.7, 0, 0, 0, 3.4, 0.25, 0.12), hallIron); }
  }
  // great pipes along the walls
  stat.set(copper);
  for (const s of [-1, 1]) {
    pipeRun(stat, [[s * 66, -106, H.z0 - 2], [s * 66, -106, H.z1 + 2]], 1.4, { collarColor: PAL.brass });
    pipeRun(stat, [[s * 63, -142, H.z0 - 2], [s * 63, -142, H.z1 + 2]], 0.9, { collarColor: PAL.brass });
  }

  // ---- the glow river: a channel along the west side feeding a ring pool around the heart
  const magma = new GeoBuilder();
  const hc = H.heart, C = H.channel, PO = H.pool;
  const lavaY = H.floor + 0.45;
  const lavaM = mat(0xff7a20, LAYER.WATER, { id: 0.05 });
  const zN0 = H.z0 - 4, zN1 = hc.z + 20, zS0 = hc.z - 20, zS1 = H.z1 + 4;
  magma.add(P.box(), M((C.x0 + C.x1) / 2, lavaY, (zN0 + zN1) / 2, 0, 0, 0, C.x1 - C.x0, 0.1, zN0 - zN1), lavaM);
  magma.add(P.box(), M((C.x0 + C.x1) / 2, lavaY, (zS0 + zS1) / 2, 0, 0, 0, C.x1 - C.x0, 0.1, zS0 - zS1), lavaM);
  magma.add(new THREE.RingGeometry(PO.r0, PO.r1, 64, 1).rotateX(-Math.PI / 2), M(hc.x, lavaY + 0.06, hc.z), lavaM);
  for (const x of [C.x0 - 0.8, C.x1 + 0.8]) {
    stat.add(P.box(), M(x, H.floor + 0.3, (zN0 + zN1) / 2, 0, 0, 0, 1.6, 0.7, zN0 - zN1), rimM);
    stat.add(P.box(), M(x, H.floor + 0.3, (zS0 + zS1) / 2, 0, 0, 0, 1.6, 0.7, zS0 - zS1), rimM);
  }
  for (const rr of [PO.r0 - 0.8, PO.r1 + 0.8]) stat.add(new THREE.TorusGeometry(rr, 0.8, 6, 72), M(hc.x, H.floor + 0.1, hc.z, Math.PI / 2, 0, 0, 1, 1, 0.8), rimM);
  const magmaMesh = new THREE.Mesh(magma.build(), magmaMaterial());
  group.add(magmaMesh);
  for (let i = 0; i < 12; i++) X.embers.push(V(r.range(C.x0 + 1, C.x1 - 1), lavaY, i < 6 ? r.range(zN1 + 4, zN0 - 4) : r.range(zS1 + 4, zS0 - 4)));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.3; X.embers.push(V(hc.x + Math.cos(a) * 25.5, lavaY, hc.z + Math.sin(a) * 25.5)); }

  // ---- the heart's column, stone ring, platform and catwalk (static parts)
  const heartBottom = hc.y - H.heartR;
  stat.add(P.cylB(28), M(hc.x, H.floor, hc.z, 0, 0, 0, PO.r0 - 1.6, 1.4, PO.r0 - 1.6), mat(0x6a5a50, LAYER.FLAGSTONE, { scale: 4, id: 0.4 }));
  stat.add(P.lathe('heartcol2', [[0, 0], [9.5, 0], [9.5, 1.5], [7.2, 3], [5.2, 8], [4.2, 16], [4.6, heartBottom - H.floor - 2.5], [6.8, heartBottom - H.floor + 0.6], [0, heartBottom - H.floor + 0.6]], 28), M(hc.x, H.floor, hc.z), mat(0x4a3e3a, LAYER.IRON, { scale: 2, spec: 0.3, id: 0.41 }));
  for (let k = 0; k < 12; k++) { // brass fluting on the column
    const a = (k / 12) * Math.PI * 2;
    stat.add(P.box(), M(hc.x + Math.cos(a) * 4.6, (H.floor + heartBottom) / 2 + 2, hc.z + Math.sin(a) * 4.6, 0, -a, 0, 0.5, heartBottom - H.floor - 9, 0.5), mat(PAL.brassDark, LAYER.METAL, { spec: 0.6, id: 0.41 }));
  }
  const pY = H.platformY;
  stat.add(new THREE.RingGeometry(H.platR0, H.platR1, 56).rotateX(-Math.PI / 2), M(hc.x, pY, hc.z), mat(0x6a5a4a, LAYER.PLANKS, { scale: 2, id: 0.42 }));
  stat.add(new THREE.RingGeometry(H.platR0, H.platR1, 56).rotateX(Math.PI / 2), M(hc.x, pY - 0.15, hc.z), hallIron);
  stat.add(new THREE.CylinderGeometry(H.platR1, H.platR1, 0.15, 56, 1, true), M(hc.x, pY - 0.075, hc.z), hallIron);
  // railing on the outer edge except where the catwalk arrives
  const catAng = Math.atan2(H.sockDir.z, H.sockDir.x);
  for (let k = 0; k < 48; k++) {
    const a0 = (k / 48) * Math.PI * 2, a1 = ((k + 1) / 48) * Math.PI * 2;
    const da = Math.abs(Math.atan2(Math.sin(a0 - catAng + Math.PI / 48), Math.cos(a0 - catAng + Math.PI / 48)));
    if (da < 0.13) continue;
    const p0 = V(hc.x + Math.cos(a0) * (H.platR1 - 0.1), pY, hc.z + Math.sin(a0) * (H.platR1 - 0.1));
    const p1 = V(hc.x + Math.cos(a1) * (H.platR1 - 0.1), pY, hc.z + Math.sin(a1) * (H.platR1 - 0.1));
    stat.add(P.box(), Mseg(p0.clone().setY(pY + 1.05), p1.clone().setY(pY + 1.05), 0.06, 0.06), hallIron);
    stat.add(P.box(), M(p0.x, pY + 0.52, p0.z, 0, 0, 0, 0.06, 1.05, 0.06), hallIron);
  }
  // struts from the column to the platform
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 + 0.1; stat.add(P.box(), Mseg(V(hc.x + Math.cos(a) * 5.5, heartBottom - 5, hc.z + Math.sin(a) * 5.5), V(hc.x + Math.cos(a) * 11.5, pY - 0.2, hc.z + Math.sin(a) * 11.5), 0.3, 0.3), hallIron); }
  // catwalk from under the shaft to the platform
  const A0 = H.catA, B0 = H.catB, dir = H.catDir;
  const len = A0.distanceTo(B0);
  const side = V(dir.z, 0, -dir.x);
  const yaw = Math.atan2(dir.x, dir.z);
  for (let d = -3; d < len + 0.3; d += 0.32) {
    const p = A0.clone().addScaledVector(dir, d);
    if (d > H.gap[0] && d < H.gap[1]) continue; // broken section
    stat.add(P.box(), M(p.x, pY - 0.04, p.z, 0, yaw, 0, 1.6, 0.07, 0.28), mat(r.pick([0x7a5234, 0x6a4a2e, 0x8a6040]), LAYER.PLANKS, { scale: 1.2, id: 0.44 }));
  }
  for (const [d, s, a] of [[H.gap[0] + 0.25, 0.4, 0.9], [H.gap[1] - 0.2, -0.45, -1.1]]) { // planks hanging down at the gap
    const p = A0.clone().addScaledVector(dir, d).addScaledVector(side, s);
    stat.add(P.box(), M(p.x, pY - 0.45, p.z, a, yaw, 0.3 * s, 0.28, 0.07, 0.9).multiply(M(0, 0, 0, Math.PI / 2, 0, 0)), mat(0x6a4a2e, LAYER.PLANKS, { scale: 1.2, id: 0.44 }));
  }
  for (const s of [-1, 1]) {
    const a = A0.clone().addScaledVector(side, s * 0.85).addScaledVector(dir, -3), b = B0.clone().addScaledVector(side, s * 0.85);
    stat.add(P.box(), Mseg(a.clone().setY(pY + 1.05), b.clone().setY(pY + 1.05), 0.06, 0.06), hallIron);
    stat.add(P.box(), Mseg(a.clone().setY(pY + 0.5), b.clone().setY(pY + 0.5), 0.04, 0.04), hallIron);
    stat.add(P.box(), Mseg(a.clone().setY(pY - 0.2), b.clone().setY(pY - 0.2), 0.12, 0.3), hallIron);
    for (let d = -3, i = 0; d < len; d += 2.4, i++) {
      const p = A0.clone().addScaledVector(dir, d).addScaledVector(side, s * 0.85);
      stat.add(P.box(), M(p.x, pY + 0.52, p.z, 0, 0, 0, 0.06, 1.05, 0.06), hallIron);
      if (i % 4 === 1) stat.add(P.box(), M(p.x, (pY + H.floor) / 2, p.z, 0, 0, 0, 0.3, pY - H.floor, 0.3), hallIron);
    }
  }
  // a steam pipe along the catwalk with a valve that bursts (story event)
  const pipeA = A0.clone().addScaledVector(side, 1.05).addScaledVector(dir, 4).setY(pY + 0.3), pipeB = B0.clone().addScaledVector(side, 1.05).addScaledVector(dir, -2).setY(pY + 0.3);
  stat.set(copper); pipeRun(stat, [pipeA, pipeB], 0.14, { collarColor: PAL.brass });
  X.catValve = A0.clone().addScaledVector(dir, 21).addScaledVector(side, 1.05).setY(pY + 0.45);
  X.catSide = side;
  stat.add(P.cyl(10), M(X.catValve.x, X.catValve.y, X.catValve.z, 0, 0, 0, 0.16, 0.3, 0.16), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.45 }));
  stat.add(new THREE.TorusGeometry(0.16, 0.03, 5, 14), M(X.catValve.x, X.catValve.y + 0.22, X.catValve.z, Math.PI / 2, 0, 0), mat(0xa8321e, LAYER.IRON, { id: 0.45 }));
  // lamps along the catwalk
  for (let d = 5; d < len - 2; d += 9) {
    const p = A0.clone().addScaledVector(dir, d).addScaledVector(side, -0.95).setY(pY + 1.5);
    stat.add(P.sphere(8, 6), M(p.x, p.y, p.z, 0, 0, 0, 0.14), mat(0xffc070, LAYER.GLASS, { emit: 5, id: 0.45 }));
    stat.add(P.box(), M(p.x, pY + 0.75, p.z, 0, 0, 0, 0.05, 1.5, 0.05), hallIron);
    X.lamps.push({ pos: p, base: 0.55, hall: true });
  }

  // ---- the floor: furnaces with chimneys, anvils, crates, workbenches
  for (let i = 0; i < 6; i++) {
    const z = H.z0 - 26 - i * 38, x = 38 + (i % 2) * 3;
    stat.add(P.boxB(), M(x, H.floor, z, 0, 0, 0, 8, 7, 8), mat(0x6a4a3a, LAYER.BRICK, { scale: 2.5, id: 0.46 }));
    stat.add(P.cylB(12), M(x, H.floor + 7, z, 0, 0, 0, 1.2, H.ceilingAt(x) - H.floor - 7.5, 1.2), mat(0x6a4a3a, LAYER.BRICK, { scale: 2.5, id: 0.46 }));
    stat.add(P.box(), M(x - 4.05, H.floor + 2.2, z, 0, 0, 0, 0.1, 2.4, 3), mat(0xff8a30, LAYER.GLASS, { emit: 4.5, id: 0.47 }));
    stat.add(P.boxB(), M(x - 6.5, H.floor, z + 2.5, 0, 0.4, 0, 1.2, 0.9, 0.6), hallIron); // anvil
    X.forges.push(V(x - 4.3, H.floor + 1.6, z));
    X.lamps.push({ pos: V(x - 5, H.floor + 2.5, z), base: 0.8, hall: true, forge: true });
  }
  for (let i = 0; i < 40; i++) {
    const x = r.pick([r.range(-60, -36), r.range(-16, 30), r.range(44, 62)]), z = r.range(H.z1 + 8, H.z0 - 8);
    if (Math.hypot(x - hc.x, z - hc.z) < PO.r1 + 3) continue;
    const s = r.range(0.8, 1.4);
    stat.add(P.boxB(), M(x, H.floor, z, 0, r.range(0, 3), 0, s, s, s), mat(r.pick([0x9a6a3e, 0x7a5232, 0x8a7a5a]), LAYER.PLANKS, { scale: 1, id: 0.48 }));
  }
  // conveyor belts on the east side
  for (const x of [52, 58]) {
    stat.add(P.box(), M(x, H.floor + 1.2, zc, 0, 0, 0, 1.8, 0.3, L - 20), mat(0x2a2424, LAYER.IRON, { id: 0.63 }));
    for (let z = H.z0 - 12; z > H.z1 + 12; z -= 4) stat.add(P.box(), M(x, H.floor + 0.55, z, 0, 0, 0, 0.3, 1.1, 0.3), hallIron);
  }
  // mine cart rails on the floor
  for (const lane of [-12, 46]) for (const s of [-0.4, 0.4]) stat.add(P.box(), M(lane + s, H.floor + 0.04, zc, 0, 0, 0, 0.07, 0.08, L - 10), mat(0x8a8078, LAYER.IRON, { spec: 0.8, id: 0.28 }));

  const statMesh = new THREE.Mesh(stat.build(), worldMaterial({ side: THREE.DoubleSide }));
  statMesh.layers.enable(LAYER_STATIC_CASTER);
  group.add(statMesh);

  const moving = buildMoving(group, X, r);
  const beams = buildBeams(grates.map((g, i) => ({ from: g.clone().add(V(0, 0.1, 0)), to: V(g.x + [4, -5, 5, 3][i], H.floor, g.z - [8, 9, 10, 9][i]), r0: 1.3, r1: 6 })));
  group.add(beams);
  // the wave of light when the heart wakes (an expanding painted shell)
  const wave = buildWave();
  group.add(wave);
  // lamps know their distance to the heart (for the wave)
  for (const l of X.lamps) l.dHeart = l.pos.distanceTo(hc);
  return { group, X, magma: magmaMesh, beams, wave, ...moving };
}

// ------------------------------------------------------------------ moving machinery
function buildMoving(group, X, r) {
  const H = HALL, hc = H.heart;
  const wm = worldMaterial();
  const mk = (b, caster = true) => { const m = new THREE.Mesh(b.build(), wm); if (caster) m.layers.enable(LAYER_DYN_CASTER); group.add(m); return m; };
  // heart sphere with brass bands
  const hb = new GeoBuilder();
  hb.add(P.sphere(40, 24), M(0, 0, 0, 0, 0, 0, H.heartR), mat(0x9a6a34, LAYER.METAL, { scale: 3, spec: 0.6, id: 0.5 }));
  for (let k = 0; k < 12; k++) hb.add(new THREE.TorusGeometry(H.heartR * 1.004, 0.09, 4, 48), M(0, 0, 0, 0, (k / 12) * Math.PI, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.5 }));
  for (let k = -3; k <= 3; k++) { const yy = k * H.heartR * 0.27; const rr = Math.sqrt(H.heartR * H.heartR - yy * yy) * 1.005; hb.add(new THREE.TorusGeometry(rr, 0.08, 4, 48), M(0, yy, 0, Math.PI / 2, 0, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.5 })); }
  const heart = mk(hb);
  heart.position.copy(hc);
  // glass windows: a separate mesh so their glow can pulse
  const wb = new GeoBuilder();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.35; for (const yy of [-2.6, 2.6]) { const rr = Math.sqrt(H.heartR ** 2 - yy * yy) * 0.97; wb.add(P.sphere(12, 8), M(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0, 0, 0, 0.9, 1.1, 0.9), mat(0xffb040, LAYER.GLASS, { emit: 8, id: 0.51 })); } }
  const windows = new THREE.Mesh(wb.build(), glowMaterial());
  windows.position.copy(hc);
  group.add(windows);
  // the socket facing the catwalk
  const sb = new GeoBuilder();
  sb.add(new THREE.TorusGeometry(0.34, 0.09, 8, 24), M(0, 0, 0), mat(PAL.gold, LAYER.METAL, { spec: 0.95, id: 0.52 }));
  sb.add(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 20, 1, true).rotateX(Math.PI / 2), M(0, 0, -0.2), mat(0x1a1414, LAYER.IRON, { id: 0.52 }));
  sb.add(P.cyl(20), M(0, 0, -0.44, Math.PI / 2, 0, 0, 0.27, 0.04, 0.27), mat(0x140e0c, LAYER.IRON, { id: 0.52 }));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sb.add(P.box(), M(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.02, 0, 0, a, 0.3, 0.09, 0.12), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.52 })); }
  sb.add(new THREE.TorusGeometry(0.72, 0.06, 6, 32), M(0, 0, -0.02), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.52 }));
  const socketMesh = mk(sb, false);
  socketMesh.position.copy(H.socket);
  socketMesh.lookAt(H.socket.clone().add(H.sockDir));
  // the old burnt out core lies on the platform next to the socket
  const oc = new GeoBuilder();
  oc.add(P.sphere(12, 8), M(0, 0, 0, 0, 0, 0, 0.12), mat(0x5a2a1a, LAYER.GLASS, { spec: 0.3, emit: 0.8, id: 0.53 }));
  for (let k = 0; k < 3; k++) oc.add(new THREE.TorusGeometry(0.13, 0.012, 5, 18), M(0, 0, 0, 0.3, (k / 3) * Math.PI, 0.2), mat(0x6a5236, LAYER.METAL, { spec: 0.5, id: 0.53 }));
  const oldCore = mk(oc, false);
  const ocSide = V(H.sockDir.z, 0, -H.sockDir.x);
  oldCore.position.copy(H.stand).addScaledVector(ocSide, 1.3).addScaledVector(H.sockDir, -0.2).setY(H.platformY + 0.12);
  // armillary rings above and below the platform (they never cross the catwalk)
  const rings = [];
  for (const [rad, cy, tilt, col, speed] of [[11.2, 6.0, 0.28, PAL.brass, 0.35], [13.6, 7.2, -0.22, PAL.copper, -0.25], [12.4, -7.0, 0.2, PAL.gold, 0.3]]) {
    const b = new GeoBuilder();
    b.add(new THREE.TorusGeometry(rad, 0.42, 8, 72), M(0, 0, 0, Math.PI / 2, 0, 0), mat(col, LAYER.METAL, { spec: 0.85, id: 0.54 }));
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; b.add(P.box(), M(Math.cos(a) * rad, 0, Math.sin(a) * rad, 0, -a, 0, 1.0, 0.9, 0.3), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.54 })); }
    const m = mk(b);
    const lb = new GeoBuilder();
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.4; lb.add(P.sphere(10, 8), M(Math.cos(a) * rad, 0.1, Math.sin(a) * rad, 0, 0, 0, 0.6), mat(0xffb040, LAYER.GLASS, { emit: 8, id: 0.55 })); }
    const lights = new THREE.Mesh(lb.build(), glowMaterial());
    m.add(lights);
    rings.push({ mesh: m, cy, tilt, speed, rad });
  }
  // pistons on the stone ring around the column
  const pistons = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const px = hc.x + Math.cos(a) * 15.5, pz = hc.z + Math.sin(a) * 15.5;
    const cyl = new GeoBuilder();
    cyl.add(P.cylB(16), M(0, 0, 0, 0, 0, 0, 1.3, 11, 1.3), mat(PAL.copper, LAYER.METAL, { spec: 0.7, id: 0.56 }));
    for (const y of [1, 5.5, 10]) cyl.add(new THREE.TorusGeometry(1.35, 0.14, 6, 20), M(0, y, 0, Math.PI / 2, 0, 0), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.56 }));
    const c = mk(cyl); c.position.set(px, H.floor + 1.4, pz);
    const rod = new GeoBuilder();
    rod.add(P.cylB(10), M(0, -6, 0, 0, 0, 0, 0.42, 14, 0.42), mat(0xb8b0a8, LAYER.METAL, { spec: 0.95, id: 0.57 }));
    rod.add(P.box(), M(0, 8.2, 0, 0, 0, 0, 2.0, 0.8, 1.1), mat(0x3a3434, LAYER.IRON, { spec: 0.4, id: 0.57 }));
    const rm = mk(rod); rm.position.set(px, H.floor + 12.4, pz); rm.rotation.y = -a;
    pistons.push({ rod: rm, base: H.floor + 12.4, phase: k * 0.785 });
    X.vents.push({ pos: V(px, H.floor + 12.6, pz), dir: V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), seed: 200 + k, heart: true });
  }
  // wall gears (big, slow)
  const gears = [];
  const gearGeo = (teeth, spokes) => { const b = new GeoBuilder(); b.add(gearGeometry(teeth, 0.86, 0.18, spokes, 0.12), null, mat(PAL.brassDark, LAYER.METAL, { scale: 4, spec: 0.7, id: 0.58 })); b.add(P.cyl(16), M(0, 0, 0.1, Math.PI / 2, 0, 0, 0.14, 0.3, 0.14), mat(0x3a3434, LAYER.IRON, { id: 0.58 })); return b; };
  const gDefs = [[-68.4, -118, -100, 14, 1], [-68.4, -131, -123, 9.5, -1], [68.4, -114, -135, 16, 1], [68.4, -134, -161, 10, -1], [-68.4, -116, -215, 13, -1], [68.4, -118, -240, 12, 1], [0, -110, -290.2, 18, 1], [26.5, -128, -290.2, 9, -1], [-24.5, -130, -290.2, 8, 1], [-20, -112, -59.8, 12, -1], [8, -126, -59.8, 8, 1]];
  for (const [gx, gy, gz, rad, sgn] of gDefs) {
    const m = mk(gearGeo(Math.round(rad * 1.8), 6));
    m.position.set(gx, gy, gz);
    m.scale.setScalar(rad);
    const face = Math.abs(gz) > 289 || Math.abs(gz) < 60 ? (gz < -100 ? 0 : Math.PI) : (gx < 0 ? Math.PI / 2 : -Math.PI / 2);
    gears.push({ mesh: m, face, speed: (0.3 / rad) * sgn });
  }
  // bridge crane running along the hall with a load (a spare gear)
  const cb = new GeoBuilder();
  cb.add(P.box(), M(0, 0, 0, 0, 0, 0, 138, 2.2, 3.2), mat(0x5a3a2a, LAYER.IRON, { scale: 2, spec: 0.3, id: 0.59 }));
  for (let x = -66; x <= 66; x += 6) cb.add(P.box(), M(x, -1.6, 0, 0, 0, 0, 0.3, 1.2, 3.0), mat(0x4a3024, LAYER.IRON, { id: 0.59 }));
  cb.add(P.box(), M(22, -2.5, 0, 0, 0, 0, 4, 2.4, 4), mat(0xa8421e, LAYER.IRON, { spec: 0.3, id: 0.6 }));
  for (const dz of [-0.8, 0.8]) cb.add(P.box(), M(22, -6.5, dz, 0, 0, 0, 0.1, 6, 0.1), mat(0x2a2626, LAYER.IRON, { id: 0.6 }));
  cb.add(gearGeometry(20, 0.8, 0.2, 5, 0.25), M(22, -13.5, 0, 0, 0, 0, 3.8, 3.8, 3.8), mat(PAL.copper, LAYER.METAL, { spec: 0.7, id: 0.6 }));
  const crane = mk(cb);
  crane.position.set(0, -97.2, -150);
  // mine carts looping on the floor and one in the mine gallery
  const cartB = new GeoBuilder();
  cartB.add(P.box(), M(0, 0.75, 0, 0, 0, 0, 1.1, 0.9, 2.0), mat(0x5a4a40, LAYER.IRON, { spec: 0.3, id: 0.61 }));
  cartB.add(P.box(), M(0, 1.22, 0, 0, 0, 0, 0.95, 0.25, 1.8), mat(0x2a2220, LAYER.STONE, { id: 0.61 }));
  for (let k = 0; k < 5; k++) cartB.add(P.sphere(6, 4), M(-0.3 + (k % 3) * 0.3, 1.36, -0.6 + k * 0.3, 0, 0, 0, 0.18), mat(0xff9a40, LAYER.GLASS, { emit: 3, id: 0.61 }));
  for (const [x, z] of [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.65], [0.5, 0.65]]) cartB.add(P.cyl(10), M(x, 0.28, z, 0, 0, Math.PI / 2, 0.28, 0.1, 0.28), mat(0x2a2626, LAYER.IRON, { id: 0.61 }));
  const cartGeo = cartB.build();
  const carts = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cartGeo, wm); m.layers.enable(LAYER_DYN_CASTER); group.add(m); carts.push({ mesh: m, offset: i * 76, lane: i % 2 }); }
  const tunnelCart = new THREE.Mesh(cartGeo, wm);
  group.add(tunnelCart);
  // crates on the conveyors
  const crateB = new GeoBuilder();
  crateB.add(P.box(), M(0, 0.45, 0, 0, 0, 0, 0.9, 0.9, 0.9), mat(0x9a6a3e, LAYER.PLANKS, { scale: 1, id: 0.62 }));
  const conveyor = new THREE.InstancedMesh(crateB.build(), wm, 40);
  conveyor.frustumCulled = false;
  group.add(conveyor);
  // the chain
  const chain = new Chain(H.chainTop, H.chainBottom, H.chain.x, H.chain.z);
  group.add(chain.mesh);
  return { heart, windows, rings, pistons, gears, crane, carts, conveyor, tunnelCart, socketMesh, oldCore, chain };
}

// ------------------------------------------------------------------ shaders
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
  // painted lava: dark crust plates drifting over hot seams
  vec2 p = vWP.xz * 0.07 + vec2(0.0, uTime * 0.03);
  vec4 a = texture(uBrush, vec3(p, 17.0));
  vec4 b = texture(uBrush, vec3(p * 1.7 + vec2(uTime * 0.018, 0.3), 14.0));
  float seam = smoothstep(0.52, 0.7, a.r * 0.6 + b.r * 0.55);
  float hot = clamp(smoothstep(0.35, 0.6, b.a) * 0.45 + seam, 0.0, 1.0);
  vec3 crust = vec3(0.16, 0.045, 0.03);
  vec3 glow = mix(vec3(3.4, 0.9, 0.18), vec3(5.0, 2.8, 1.0), seam);
  vec3 col = mix(crust, glow, hot) * uHeat;
  col = applyFog(col, vWP);
  writeOut(col, normalize(vVN), vDepth, 0.05);
}`;
function magmaMaterial() { return toonMaterial({ vertex: MAGMA_VERT, fragment: MAGMA_FRAG, uniforms: { uHeat: { value: 1 } } }); }

// emissive parts whose brightness is animated (heart windows, ring lights)
const GLOW_VERT = /* glsl */ `
attribute vec4 aCol;
out vec3 vWP; out float vDepth; out vec3 vVN; out vec3 vCol;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vCol = aCol.rgb;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = /* glsl */ `
uniform float uGlowAmt;
in vec3 vWP; in float vDepth; in vec3 vVN; in vec3 vCol;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 c = pow(vCol, vec3(2.2));
  float f = 0.6 + 0.4 * abs(normalize(vVN).z);
  vec3 col = mix(c * 0.12, c * 4.0 * f, clamp(uGlowAmt, 0.0, 1.0)) * max(1.0, uGlowAmt);
  writeOut(applyFog(col, vWP), normalize(vVN), vDepth, 0.51);
}`;
function glowMaterial() { return toonMaterial({ vertex: GLOW_VERT, fragment: GLOW_FRAG, uniforms: { uGlowAmt: { value: 0.2 } } }); }

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
  float a = edge * (1.0 - smoothstep(0.5, 1.0, vT)) * smoothstep(0.0, 0.08, vT) * uBeam;
  vec4 st = texture(uBrush, vec3(vec2(atan(vN.x, vN.z) * 1.2, vT * 0.8), 14.0));
  a *= 0.55 + 0.45 * smoothstep(0.4, 0.6, st.r);
  oColor = vec4(uBeamColor * a * 0.5, 0.0);
  oNormal = vec4(0.0);
}`;
function buildBeams(list) {
  const group = new THREE.Group();
  const mt = toonMaterial({ vertex: BEAM_VERT, fragment: BEAM_FRAG, transparent: true, depthWrite: false, blending: BLEND_ADD, side: THREE.DoubleSide,
    uniforms: { uBeamColor: { value: new THREE.Color(1.0, 0.72, 0.45) }, uBeam: { value: 1 } } });
  for (const bm of list) {
    const len = bm.from.distanceTo(bm.to);
    const g = new THREE.CylinderGeometry(bm.r0, bm.r1, len, 20, 6, true);
    const P0 = g.attributes.position; const t = new Float32Array(P0.count);
    for (let i = 0; i < P0.count; i++) t[i] = 0.5 - P0.getY(i) / len;
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    const m = new THREE.Mesh(g, mt);
    m.position.copy(bm.from).lerp(bm.to, 0.5);
    m.quaternion.setFromUnitVectors(V(0, -1, 0), bm.to.clone().sub(bm.from).normalize());
    m.renderOrder = 29;
    m.frustumCulled = false;
    group.add(m);
  }
  group.userData.material = mt;
  return group;
}

const WAVE_VERT = /* glsl */ `
out vec3 vN; out vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WAVE_FRAG = /* glsl */ `
uniform float uWave;
in vec3 vN; in vec3 vWP;
void main() {
  if (uPass == 1) discard;
  vec3 V = normalize(uCamPos - vWP);
  float rim = 1.0 - abs(dot(normalize(vN), V));
  float a = smoothstep(0.25, 0.95, rim) * uWave;
  vec4 st = texture(uBrush, vec3(vWP.xz * 0.02 + vWP.y * 0.01, 14.0));
  a *= 0.6 + 0.4 * smoothstep(0.35, 0.65, st.r);
  oColor = vec4(vec3(1.0, 0.72, 0.36) * a * 1.6, 0.0);
  oNormal = vec4(0.0);
}`;
function buildWave() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), toonMaterial({ vertex: WAVE_VERT, fragment: WAVE_FRAG, transparent: true, depthWrite: false, blending: BLEND_ADD, side: THREE.DoubleSide, uniforms: { uWave: { value: 0 } } }));
  m.position.copy(HALL.heart);
  m.renderOrder = 30;
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

// ------------------------------------------------------------------ the chain in the shaft
export class Chain {
  constructor(topY, bottomY, x, z) {
    const n = Math.floor((topY - bottomY) / 0.13);
    const b = new GeoBuilder();
    b.add(new THREE.TorusGeometry(0.055, 0.017, 4, 8), M(0, 0, 0, 0, 0, 0, 1, 1.55, 1), mat(0x5c5452, LAYER.IRON, { scale: 1, spec: 0.6, id: 0.64 }));
    this.mesh = new THREE.InstancedMesh(b.build(), worldMaterial(), n);
    this.mesh.frustumCulled = false;
    this.mesh.layers.enable(LAYER_DYN_CASTER);
    this.n = n; this.topY = topY; this.x = x; this.z = z;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.update(0, null);
  }
  // off(y) -> horizontal offset {x, z} of the chain at height y
  update(S, off) {
    for (let i = 0; i < this.n; i++) {
      const y = this.topY - i * 0.13;
      const o = off ? off(y) : null;
      this._e.set(0, (i % 2) * Math.PI / 2, 0);
      this._q.setFromEuler(this._e);
      this._p.set(this.x + (o ? o.x : 0), y, this.z + (o ? o.z : 0));
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ per frame animation
// st.awake: 0 dying heart .. 1 fully running; st.awakeInt: its integral over story time
export function animateUnderworld(u, S, st) {
  const H = HALL;
  const { awake, awakeInt } = st;
  const flick = 0.55 + 0.45 * smoothstep(0.25, 0.6, noise1(S * 2.7, 7) * 0.5 + 0.5);
  u.rings.forEach((rg, i) => {
    const sgn = i % 2 ? -1 : 1;
    rg.mesh.position.set(H.heart.x, H.heart.y + rg.cy, H.heart.z);
    rg.mesh.rotation.set(rg.tilt + Math.sin(S * 0.2 + i) * 0.02 * awake, sgn * (0.02 * S + Math.abs(rg.speed) * 2.2 * awakeInt) + i, 0, 'YXZ');
  });
  u.heart.rotation.y = 0.01 * S + 0.12 * awakeInt;
  u.windows.rotation.y = u.heart.rotation.y;
  const glow = awake > 0.02 ? 0.3 + 1.5 * awake : 0.22 * flick;
  u.windows.material.uniforms.uGlowAmt.value = glow;
  u.rings.forEach((rg) => { rg.mesh.children[0].material.uniforms.uGlowAmt.value = awake > 0.02 ? 0.2 + 1.2 * awake : 0.12 * flick; });
  u.pistons.forEach((p) => { p.rod.position.y = p.base + (0.3 + 2.3 * awake) * (0.5 + 0.5 * Math.sin(1.1 * S + 4.0 * awakeInt + p.phase)); });
  u.gears.forEach((g) => { g.mesh.rotation.set(0, g.face, g.speed * (0.25 * S + 1.6 * awakeInt)); });
  u.crane.position.z = -150 + Math.sin(S * 0.035 + 0.8) * 62;
  u.carts.forEach((c) => {
    const d = ((S * 3.2 + c.offset) % 460 + 460) % 460;
    const lane = c.lane ? 46 : -12;
    const z = d < 230 ? H.z0 - 5 - d : H.z1 + 5 + (d - 230);
    c.mesh.position.set(lane, H.floor + 0.05, z);
    c.mesh.rotation.y = d < 230 ? Math.PI : 0;
  });
  const _m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) {
    const L = H.z0 - H.z1 - 24;
    const d = ((S * 1.6 + i * (L / 20)) % L + L) % L;
    _m.makeTranslation(i % 2 ? 52 : 58, H.floor + 1.35, H.z0 - 12 - d);
    u.conveyor.setMatrixAt(i, _m);
  }
  u.conveyor.instanceMatrix.needsUpdate = true;
  u.magma.material.uniforms.uHeat.value = (0.8 + 0.45 * awake) * (awake > 0.3 ? 1 : 0.9 + 0.1 * flick);
  return flick;
}

// integral of smoothstep(a, a + w, s) from -inf to S (for phases that speed up smoothly)
export function rampInt(S, a, w) {
  if (S <= a) return 0;
  if (S >= a + w) return S - a - w / 2;
  const u = (S - a) / w;
  return w * (u * u * u - 0.5 * u * u * u * u);
}
