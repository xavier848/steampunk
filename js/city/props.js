// Street props: barrels, crates, sacks, market stalls with awnings and goods,
// hand carts, newspaper kiosk, food stall with a steam boiler.
import * as THREE from 'three';
import { P, M, Mseg, mul, gableRoof } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { RNG } from '../core/rng.js';
import { PAL } from './palette.js';

const mat = (color, layer, scale = 1, spec = 0, id = 0.5, emit = 0) => ({ color, layer, scale, spec, emit, id, uv: false });

export function barrel(b, T, r = new RNG(1)) {
  const id = r.range(0.4, 0.6);
  const w = mat(r.pick([0x8a5a36, 0x7a4c2e, 0x9a6a40]), LAYER.WOOD, 0.8, 0, id);
  b.add(P.lathe('barrel', [[0, 0], [0.3, 0], [0.34, 0.2], [0.37, 0.45], [0.34, 0.7], [0.3, 0.9], [0, 0.9]], 14), T, w);
  for (const y of [0.12, 0.3, 0.6, 0.78]) b.add(P.torus(4, 14, Math.PI * 2, 0.06), mul(T, M(0, y, 0, Math.PI / 2, 0, 0, y > 0.2 && y < 0.7 ? 0.37 : 0.33)), mat(0x3a3434, LAYER.IRON, 1, 0.4, id));
}
export function crate(b, T, r = new RNG(1), s = 0.7) {
  const id = r.range(0.4, 0.6);
  const w = mat(r.pick([0xb07c4c, 0x9a6a3e, 0xc08a58]), LAYER.PLANKS, 1.2, 0, id);
  b.add(P.box(), mul(T, M(0, s / 2, 0, 0, 0, 0, s, s, s)), w);
  const e = mat(0x6a4428, LAYER.WOOD, 1, 0, id);
  const t = 0.07;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.box(), mul(T, M(x * (s / 2 - t / 2 + 0.01), s / 2, z * (s / 2 - t / 2 + 0.01), 0, 0, 0, t, s + 0.02, t)), e);
  for (const y of [0.04, s - 0.04]) {
    b.add(P.box(), mul(T, M(0, y, s / 2 + 0.005, 0, 0, 0, s + 0.02, t, t)), e);
    b.add(P.box(), mul(T, M(0, y, -s / 2 - 0.005, 0, 0, 0, s + 0.02, t, t)), e);
  }
  b.add(P.box(), mul(T, Mseg(new THREE.Vector3(-s / 2, 0.05, s / 2 + 0.01), new THREE.Vector3(s / 2, s - 0.05, s / 2 + 0.01), 0.06, 0.04)), e);
}
export function sack(b, T, r = new RNG(1)) {
  b.add(P.sphere(10, 8), mul(T, M(0, 0.3, 0, 0, 0, r.range(-0.2, 0.2), 0.3, 0.36, 0.26)), mat(r.pick([0xc2a878, 0xb09868, 0xa88c64]), LAYER.CLOTH, 0.8, 0, 0.45));
  b.add(P.cyl(8), mul(T, M(0, 0.68, 0, 0, 0, 0, 0.08, 0.14, 0.08)), mat(0xb09868, LAYER.CLOTH, 0.8, 0, 0.45));
}

// goods on a counter: fruit, cabbages, bread, fish, bottles
function goods(b, T, w, d, kind, r) {
  const n = Math.floor(w / 0.2) * Math.floor(d / 0.2);
  const cols = {
    fruit: [0xd8402e, 0xe8a030, 0xb8c040, 0xc02a30],
    veg: [0x6a9a3a, 0x8ab04a, 0xd87a30, 0xa04070],
    bread: [0xc88a48, 0xb07438, 0xd8a060],
    fish: [0x9aa8b8, 0x7a8a9a],
    brass: [PAL.brass, PAL.copper, 0xd8b060],
  }[kind];
  for (let i = 0; i < n; i++) {
    const x = r.range(-w / 2 + 0.1, w / 2 - 0.1), z = r.range(-d / 2 + 0.1, d / 2 - 0.1);
    const c = r.pick(cols);
    if (kind === 'bread') b.add(P.sphere(8, 6), mul(T, M(x, 0.07, z, 0, r.range(0, 3), 0, 0.16, 0.08, 0.1)), mat(c, LAYER.BRUSH, 0.5, 0, 0.52));
    else if (kind === 'fish') b.add(P.sphere(8, 6), mul(T, M(x, 0.05, z, 0, r.range(0, 3), 0, 0.2, 0.05, 0.07)), mat(c, LAYER.METAL, 0.5, 0.6, 0.52));
    else if (kind === 'brass') b.add(P.cylB(8), mul(T, M(x, 0, z, 0, 0, 0, 0.06, r.range(0.1, 0.3), 0.06)), mat(c, LAYER.METAL, 0.5, 0.9, 0.52));
    else b.add(P.sphere(8, 6), mul(T, M(x, 0.07, z, 0, 0, 0, r.range(0.07, 0.1))), mat(c, LAYER.BRUSH, 0.5, 0.1, 0.52));
  }
}

// Market stall: counter, posts, striped awning. Facing +Z (customers at +Z).
export function stall(b, T, r = new RNG(1), { w = 2.6, d = 1.4, kind } = {}) {
  const id = r.range(0.45, 0.6);
  const wood = mat(r.pick([0x7a4c2e, 0x8a5a36, 0x6a4028]), LAYER.PLANKS, 1.2, 0, id);
  const post = mat(0x5a3a24, LAYER.WOOD, 1, 0, id);
  // counter
  b.add(P.box(), mul(T, M(0, 0.45, 0.2, 0, 0, 0, w, 0.9, d * 0.6)), wood);
  b.add(P.box(), mul(T, M(0, 0.93, 0.2, 0, 0, 0, w + 0.1, 0.06, d * 0.6 + 0.12)), post);
  // back shelf
  b.add(P.box(), mul(T, M(0, 0.7, -d / 2 + 0.1, 0, 0, 0, w, 1.4, 0.3)), wood);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
    b.add(P.box(), mul(T, M(x, 1.25, d / 2 - 0.05, 0, 0, 0, 0.08, 2.5, 0.08)), post);
    b.add(P.box(), mul(T, M(x, 1.1, -d / 2 + 0.05, 0, 0, 0, 0.08, 2.2, 0.08)), post);
  }
  // awning: sloped striped cloth with scalloped front valance
  const [c1, c2] = r.pick(PAL.awning);
  const aw = mat(c1, LAYER.STRIPES, w / 4, 0, id);
  const slope = Math.atan2(0.5, d + 0.6);
  b.add(P.box(), mul(T, M(0, 2.35, 0.2, slope, 0, 0, w + 0.3, 0.03, d + 1.0)), aw);
  for (let i = 0; i < Math.round(w / 0.3); i++) {
    const x = -w / 2 - 0.15 + (i + 0.5) * ((w + 0.3) / Math.round(w / 0.3));
    b.add(P.cyl(8), mul(T, M(x, 2.03, 0.2 + (d + 1.0) / 2 - 0.02, 0, 0, Math.PI / 2, 0.13, 0.28, 0.03)), mat(i % 2 ? c1 : c2, LAYER.CLOTH, 1, 0, id));
  }
  const k = kind || r.pick(['fruit', 'veg', 'bread', 'fish', 'brass']);
  goods(b, mul(T, M(0, 0.96, 0.2)), w - 0.2, d * 0.5, k, r);
  // crates and baskets around
  crate(b, mul(T, M(w / 2 + 0.45, 0, 0.1, 0, r.range(-0.3, 0.3), 0)), r, 0.6);
  if (r.chance(0.6)) barrel(b, mul(T, M(-w / 2 - 0.45, 0, -0.1)), r);
  return { top: 2.4, kind: k };
}

export function handcart(b, T, r = new RNG(1), load = 'crates') {
  const id = r.range(0.4, 0.6);
  const wood = mat(0x8a5a36, LAYER.PLANKS, 1, 0, id);
  const dark = mat(0x4a3020, LAYER.WOOD, 1, 0, id);
  b.add(P.box(), mul(T, M(0, 0.75, 0, 0, 0, 0, 1.3, 0.1, 2.0)), wood);
  b.add(P.box(), mul(T, M(0.62, 0.95, 0, 0, 0, 0, 0.06, 0.4, 2.0)), wood);
  b.add(P.box(), mul(T, M(-0.62, 0.95, 0, 0, 0, 0, 0.06, 0.4, 2.0)), wood);
  b.add(P.box(), mul(T, M(0, 0.95, -0.97, 0, 0, 0, 1.3, 0.4, 0.06)), wood);
  for (const s of [-1, 1]) {
    b.add(P.box(), mul(T, Mseg(new THREE.Vector3(s * 0.45, 0.72, 1.0), new THREE.Vector3(s * 0.4, 0.95, 2.1), 0.06, 0.06)), dark);
    // spoked wheel
    const W = mul(T, M(s * 0.72, 0.62, -0.1, 0, 0, Math.PI / 2));
    b.add(P.torus(6, 20, Math.PI * 2, 0.07), mul(W, M(0, 0, 0, Math.PI / 2, 0, 0, 0.6)), dark);
    b.add(P.cyl(8), mul(W, M(0, 0, 0, 0, 0, 0, 0.08, 0.2, 0.08)), dark);
    for (let k = 0; k < 8; k++) b.add(P.box(), mul(W, M(0, 0, 0, 0, (k / 8) * Math.PI, 0, 0.04, 0.04, 1.15)), dark);
  }
  b.add(P.box(), mul(T, M(0, 0.45, 1.3, 0, 0, 0, 0.06, 0.6, 0.06)), dark);
  if (load === 'crates') { crate(b, mul(T, M(-0.3, 0.8, -0.4)), r, 0.55); crate(b, mul(T, M(0.3, 0.8, 0.3, 0, 0.3, 0)), r, 0.5); crate(b, mul(T, M(-0.2, 1.35, -0.3, 0, 0.5, 0)), r, 0.45); }
  else if (load === 'apples') goods(b, mul(T, M(0, 0.8, 0)), 1.1, 1.8, 'fruit', r);
  else if (load === 'barrels') { barrel(b, mul(T, M(-0.3, 0.8, -0.5)), r); barrel(b, mul(T, M(0.3, 0.8, 0.4)), r); }
}

// Newspaper kiosk: octagonal booth with a domed brass roof and poster panels.
export function kiosk(b, T, r = new RNG(3)) {
  const id = 0.61;
  b.add(P.cylB(8), mul(T, M(0, 0, 0, 0, Math.PI / 8, 0, 1.1, 2.6, 1.1)), mat(0x2d5a47, LAYER.WOOD, 1.5, 0, id));
  b.add(P.cylB(8), mul(T, M(0, 0, 0, 0, Math.PI / 8, 0, 1.16, 0.4, 1.16)), mat(0x1f3a30, LAYER.WOOD, 1.5, 0, id));
  b.add(P.cylB(8), mul(T, M(0, 2.6, 0, 0, Math.PI / 8, 0, 1.4, 0.2, 1.4)), mat(0x1f3a30, LAYER.WOOD, 1.5, 0, id));
  b.add(P.hemi(12, 6), mul(T, M(0, 2.78, 0, 0, 0, 0, 1.3, 0.9, 1.3)), mat(PAL.patina[0], LAYER.PATINA, 2, 0.3, id));
  b.add(P.cone(8), mul(T, M(0, 3.6, 0, 0, 0, 0, 0.12, 0.7, 0.12)), mat(PAL.brass, LAYER.METAL, 1, 0.9, id));
  // counter window
  b.add(P.box(), mul(T, M(0, 1.5, 1.02, 0, 0, 0, 1.0, 0.8, 0.12)), mat(PAL.glassWarm, LAYER.GLASS, 1, 0.2, id, 1.6));
  b.add(P.box(), mul(T, M(0, 1.05, 1.15, 0, 0, 0, 1.3, 0.08, 0.4)), mat(0x5a3a24, LAYER.WOOD, 1, 0, id));
  // newspaper stacks
  for (let i = 0; i < 3; i++) b.add(P.box(), mul(T, M(-0.4 + i * 0.4, 1.14, 1.2, 0, r.range(-0.1, 0.1), 0, 0.3, 0.1 + i * 0.03, 0.22)), mat(0xe8dcc0, LAYER.BRUSH, 0.3, 0, id));
}

// Food stall with a steam boiler: copper kettle drum, chimney, sausages on a grill.
export function foodStall(b, T, r = new RNG(9)) {
  const id = 0.63;
  stall(b, T, r, { w: 2.4, d: 1.4, kind: 'bread' });
  const K = mul(T, M(1.9, 0, 0.4));
  b.add(P.cylB(14), mul(K, M(0, 0, 0, 0, 0, 0, 0.5, 0.35, 0.5)), mat(0x3a3434, LAYER.IRON, 1, 0.3, id));
  b.add(P.lathe('kettle', [[0, 0], [0.48, 0], [0.55, 0.3], [0.55, 0.9], [0.45, 1.1], [0.2, 1.2], [0, 1.2]], 14), mul(K, M(0, 0.35, 0)), mat(PAL.copper, LAYER.METAL, 1, 0.8, id));
  for (const y of [0.55, 1.05]) b.add(P.torus(4, 14, Math.PI * 2, 0.05), mul(K, M(0, y, 0, Math.PI / 2, 0, 0, 0.56)), mat(PAL.brass, LAYER.METAL, 1, 0.8, id));
  b.add(P.cylB(8), mul(K, M(0, 1.5, 0, 0, 0, 0, 0.09, 1.6, 0.09)), mat(0x2f2b2c, LAYER.IRON, 1, 0.4, id));
  b.add(P.cone(8), mul(K, M(0, 3.05, 0, 0, 0, 0, 0.22, 0.2, 0.22)), mat(0x2f2b2c, LAYER.IRON, 1, 0.4, id));
  // gauge
  b.add(P.cyl(14), mul(K, M(0.4, 0.9, 0.3, Math.PI / 2, 0, -0.8, 0.13, 0.06, 0.13)), mat(PAL.brass, LAYER.METAL, 1, 0.9, id));
  b.add(P.cyl(14), mul(K, M(0.43, 0.92, 0.33, Math.PI / 2, 0, -0.8, 0.1, 0.02, 0.1)), mat(0xf0e4c4, LAYER.BRUSH, 1, 0, id));
  return { chimney: new THREE.Vector3(0, 3.2, 0).applyMatrix4(K), valve: new THREE.Vector3(0.5, 1.2, 0.3).applyMatrix4(K) };
}
