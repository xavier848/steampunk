// Market street furniture: stalls, kiosk, food stall with boiler, carts, lamps,
// the set pieces of the chase (cart, low awning, hiding spot) and the bridges
// that span the street canyon.
import * as THREE from 'three';
import { P, M, Mseg, mul, pipeRun } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { RNG } from '../core/rng.js';
import { CITY } from './layout.js';
import { PAL } from './palette.js';
import { addLampPost, CURB_H } from './street.js';
import { stall, barrel, crate, sack, handcart, kiosk, foodStall } from './props.js';

export function buildMarket(chunkOf, X, r0) {
  const r = new RNG(4242);
  const out = { lampAnchors: [], stalls: [], boilers: [] };
  const B = (x, z) => chunkOf(x, z, 'm');
  // ---------------------------------------------------------------- stalls along both pavements
  const kinds = ['fruit', 'veg', 'bread', 'fish', 'brass', 'fruit', 'veg'];
  const skip = (z) => (z > -40 && z < -20) || Math.abs(z - CITY.kiosk.z) < 5 || Math.abs(z - CITY.awning.z) < 5 || Math.abs(z - CITY.hide.z) < 4;
  for (const side of [-1, 1]) {
    for (let z = 112; z > -16; z -= r.range(7.5, 10)) {
      if (skip(z)) continue;
      const x = side * 6.55;
      const w = r.range(2.3, 3.0);
      const T = M(x, CURB_H, z, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      const info = stall(B(x, z), T, r, { w, d: 1.4, kind: r.pick(kinds) });
      out.stalls.push({ pos: new THREE.Vector3(x, CURB_H, z), side, w, kind: info.kind });
    }
  }
  // the brass goods stall where the film finds Emil
  {
    const x = -6.55, z = 122.6;
    stall(B(x, z), M(x, CURB_H, z, 0, Math.PI / 2, 0), r, { w: 2.8, d: 1.4, kind: 'brass' });
    out.stalls.push({ pos: new THREE.Vector3(x, CURB_H, z), side: -1, w: 2.8, kind: 'brass', special: true });
  }
  // kiosk (newspapers) where the constable stands
  kiosk(B(CITY.kiosk.x, CITY.kiosk.z), M(CITY.kiosk.x, CURB_H, CITY.kiosk.z, 0, -Math.PI / 2, 0), r);
  // food stalls with steam boilers
  for (const [x, z, rot] of [[-6.4, 92, Math.PI / 2], [6.4, 38, -Math.PI / 2], [-6.4, 18, Math.PI / 2]]) {
    const fs = foodStall(B(x, z), M(x, CURB_H, z, 0, rot, 0), r);
    out.boilers.push(fs);
    X.vents.push({ pos: fs.valve, dir: new THREE.Vector3(0, 1, 0), seed: r.int(0, 999), small: true });
    X.chimneys.push({ pos: fs.chimney, seed: r.int(0, 999), strength: 0.5, small: true });
  }
  // ---------------------------------------------------------------- set pieces of the chase
  // the apple cart Emil jumps over
  handcart(B(CITY.cart.x, CITY.cart.z), M(CITY.cart.x, 0, CITY.cart.z, 0, 0.12, 0), r, 'apples');
  // low awning (a draper's stall with a deep, low valance) on the east pavement
  const aw = M(CITY.awning.x, CURB_H, CITY.awning.z, 0, -Math.PI / 2, 0);
  lowAwning(B(CITY.awning.x, CITY.awning.z), aw, r);
  // hiding spot: stacked barrels and crates in front of a recessed doorway (west pavement)
  const hx = CITY.hide.x, hz = CITY.hide.z;
  for (let i = 0; i < 4; i++) barrel(B(hx, hz), M(hx + 0.9 + (i % 2) * 0.1, CURB_H, hz - 1.4 + i * 0.75), r);
  barrel(B(hx, hz), M(hx + 0.95, CURB_H + 0.9, hz - 0.9), r);
  crate(B(hx, hz), M(hx + 0.8, CURB_H, hz + 1.8, 0, 0.2, 0), r, 0.8);
  crate(B(hx, hz), M(hx + 0.8, CURB_H + 0.8, hz + 1.7, 0, -0.1, 0), r, 0.7);
  // more carts and sacks as set dressing
  handcart(B(3.2, 60), M(3.2, 0, 60, 0, -0.3, 0), r, 'crates');
  handcart(B(-3.0, -8), M(-3.0, 0, -8, 0, 0.5, 0), r, 'barrels');
  handcart(B(2.6, 96), M(2.6, 0, 96, 0, 2.8, 0), r, 'apples');
  for (let i = 0; i < 12; i++) {
    const side = r.sign(); const z = r.range(-15, 110);
    if (skip(z)) continue;
    const x = side * r.range(7.4, 7.9);
    if (r.chance(0.5)) barrel(B(x, z), M(x, CURB_H, z), r); else sack(B(x, z), M(x, CURB_H, z, 0, r.range(0, 3), 0), r);
  }
  // ---------------------------------------------------------------- lamps
  for (let z = 118, k = 0; z > -150; z -= 17, k++) {
    if (z > -40 && z < -20) continue;
    const side = k % 2 ? 1 : -1;
    const x = side * 5.35;
    for (const p of addLampPost(B(x, z), x, z, 0)) out.lampAnchors.push({ pos: p, base: 1 });
  }
  // cross street lamps
  for (let x = -90; x <= 90; x += 20) {
    if (Math.abs(x) < 12) continue;
    for (const p of addLampPost(B(x, -30), x, -30 + 6.4 * (x > 0 ? 1 : -1), Math.PI / 2)) out.lampAnchors.push({ pos: p, base: 1 });
  }
  // ---------------------------------------------------------------- bridges over the street canyon
  const mIron = { color: 0x3a3232, layer: LAYER.IRON, scale: 1.2, spec: 0.45, emit: 0, id: 0.84, uv: false };
  const mBrass = { color: PAL.brass, layer: LAYER.METAL, scale: 1.2, spec: 0.85, emit: 0, id: 0.84, uv: false };
  const mCopper = { color: PAL.copper, layer: LAYER.METAL, scale: 1.2, spec: 0.7, emit: 0, id: 0.85, uv: false };
  // iron footbridge at z = -76, 11.5 m up, with a lattice truss and a little roof
  {
    const b = B(0, -76);
    const y = 11.6, z = -76, L = 17.4;
    b.add(P.box(), M(0, y, z, 0, 0, 0, L, 0.2, 2.2), { ...mIron, color: 0x5a4a3a, layer: LAYER.PLANKS });
    for (const s of [-1, 1]) {
      b.add(P.box(), M(0, y + 1.1, z + s * 1.05, 0, 0, 0, L, 0.1, 0.1), mIron);
      b.add(P.box(), M(0, y + 0.1, z + s * 1.05, 0, 0, 0, L, 0.14, 0.14), mIron);
      for (let x = -L / 2; x < L / 2 - 0.5; x += 1.45) {
        b.add(P.box(), Mseg(new THREE.Vector3(x, y + 0.1, z + s * 1.05), new THREE.Vector3(x + 1.45, y + 1.1, z + s * 1.05), 0.06, 0.06), mIron);
        b.add(P.box(), M(x, y + 0.6, z + s * 1.05, 0, 0, 0, 0.06, 1.0, 0.06), mIron);
      }
      b.add(P.box(), M(0, y + 2.4, z + s * 0.6, s * 0.5, 0, 0, L, 0.05, 1.4), { ...mCopper, color: PAL.patina[0], layer: LAYER.PATINA });
    }
    for (let x = -L / 2 + 1; x < L / 2; x += 3) b.add(P.box(), M(x, y + 1.7, z, 0, 0, 0, 0.08, 1.4, 0.08), mIron);
    // arched brackets under the deck
    for (const s of [-1, 1]) b.add(P.torus(6, 20, Math.PI / 2, 0.12), M(s * (L / 2 - 2.2), y - 0.1, z, 0, 0, s > 0 ? 0 : Math.PI / 2, 2.2), mIron);
    for (const s of [-1, 1]) for (const p of addLampPost(b, s * 3, z + 1.2, 0, { y: y + 0.1, double: false, h: 1.6 })) out.lampAnchors.push({ pos: p, base: 1 });
  }
  // pipe bridge at z = +16: two fat copper pipes and a service catwalk
  {
    const b = B(0, 16);
    const y = 15.2, z = 16;
    b.set(mCopper);
    pipeRun(b, [[-8.6, y, z - 0.5], [8.6, y, z - 0.5]], 0.45, { collarColor: PAL.brassDark });
    pipeRun(b, [[-8.6, y + 0.2, z + 0.6], [8.6, y + 0.2, z + 0.6]], 0.32, { collarColor: PAL.brassDark });
    b.add(P.box(), M(0, y - 0.7, z, 0, 0, 0, 17.2, 0.12, 1.8), { ...mIron, layer: LAYER.METAL });
    for (let x = -8; x <= 8; x += 2) b.add(P.box(), M(x, y - 0.25, z + 0.95, 0, 0, 0, 0.05, 0.9, 0.05), mIron);
    // a big valve wheel in the middle
    b.add(P.torus(6, 20, Math.PI * 2, 0.1), M(0, y + 1.0, z - 0.5, 0, 0, 0, 0.55), { ...mIron, color: 0x8a2a22 });
    b.add(P.cyl(10), M(0, y + 0.6, z - 0.5, 0, 0, 0, 0.08, 0.8, 0.08), mIron);
    X.vents.push({ pos: new THREE.Vector3(2.2, y + 0.45, z - 0.5), dir: new THREE.Vector3(0.2, -0.2, 1), seed: 31, small: true });
  }
  // ---------------------------------------------------------------- facade elevator (caged lift) on the west side at z = +46
  {
    const b = B(-8, 46);
    const x = -7.2, z = 46, top = 19;
    for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) b.add(P.box(), M(x + dx, top / 2, z + dz, 0, 0, 0, 0.12, top, 0.12), mIron);
    for (let y = 2; y < top; y += 2.4) for (const dz of [-0.9, 0.9]) b.add(P.box(), Mseg(new THREE.Vector3(x - 0.9, y, z + dz), new THREE.Vector3(x + 0.9, y + 2.4, z + dz), 0.05, 0.05), mIron);
    b.add(P.box(), M(x, top + 0.3, z, 0, 0, 0, 2.2, 0.6, 2.2), mIron);
    b.add(P.cyl(16), M(x, top + 0.8, z, Math.PI / 2, 0, 0, 0.5, 0.2, 0.5), mBrass);
    out.elevator = { x, z, top };
  }
  return out;
}

// draper's stall with a deep awning whose valance hangs low (1.3 m): Emil slides under it
function lowAwning(b, T, r) {
  const mWood = { color: 0x6a4028, layer: LAYER.WOOD, scale: 1, spec: 0, emit: 0, id: 0.56, uv: false };
  const [c1, c2] = [0x7a2a4a, 0xe6d8b8];
  b.add(P.box(), mul(T, M(0, 0.45, -0.6, 0, 0, 0, 3.4, 0.9, 0.8)), { ...mWood, layer: LAYER.PLANKS });
  for (const x of [-1.6, 1.6]) b.add(P.box(), mul(T, M(x, 1.0, 1.55, 0, 0, 0, 0.08, 2.0, 0.08)), mWood);
  b.add(P.box(), mul(T, M(0, 2.25, 0.2, -0.55, 0, 0, 3.6, 0.03, 3.4)), { color: c1, layer: LAYER.STRIPES, scale: 0.9, spec: 0, emit: 0, id: 0.57, uv: false });
  // deep valance with tassels
  b.add(P.box(), mul(T, M(0, 1.55, 1.62, 0, 0, 0, 3.6, 0.5, 0.03)), { color: c1, layer: LAYER.STRIPES, scale: 0.9, spec: 0, emit: 0, id: 0.57, uv: false });
  for (let i = 0; i < 12; i++) b.add(P.cone(5), mul(T, M(-1.65 + i * 0.3, 1.18, 1.64, Math.PI, 0, 0, 0.05, 0.14, 0.05)), { color: 0xd8b04a, layer: LAYER.BRUSH, scale: 0.4, spec: 0.2, emit: 0, id: 0.57, uv: false });
  // bolts of cloth on the counter
  for (let i = 0; i < 6; i++) b.add(P.cyl(10), mul(T, M(-1.3 + i * 0.5, 0.98, -0.6, 0, 0, Math.PI / 2, 0.12, 0.7, 0.12)), { color: r.pick([0x8a3a5a, 0x3a6a7a, 0xd8b890, 0x5a4a8a, 0xa85a3a]), layer: LAYER.CLOTH, scale: 0.3, spec: 0, emit: 0, id: 0.58, uv: false });
}
