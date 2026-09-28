// Traffic: airships (a big ship-hulled one, blimps, one docked at the mooring mast),
// the steam tram of the Kesselstrasse and steam carriages. All motion = f(S).
import * as THREE from 'three';
import { GeoBuilder, P, M, Mseg, mul } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { worldMaterial } from '../engine/materials.js';
import { LAYER_DYN_CASTER, LAYER_STATIC_CASTER } from '../engine/engine.js';
import { CITY } from '../city/layout.js';
import { PAL } from '../city/palette.js';
import { loft } from './charparts.js';
import { RNG, noise1 } from '../core/rng.js';

const m = (color, layer, extra = {}) => ({ color, layer, scale: 2, spec: 0, emit: 0, id: 0.7, uv: false, ...extra });

// ------------------------------------------------------------------ airships
function envelope(b, len, rad, colors, T) {
  // cigar profile along +z (lathe around y, then rotated)
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = Math.pow(Math.sin(Math.PI * u), 0.62) * (1 - 0.15 * u) * rad;
    pts.push(new THREE.Vector2(Math.max(x, 0.01), (u - 0.5) * len));
  }
  const g = new THREE.LatheGeometry(pts, 20).rotateX(Math.PI / 2);
  // panel stripes follow the lathe's u coordinate
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 20 * 1.4, uv.getY(i) * len);
  b.add(g, T, m(colors[0], LAYER.STRIPES, { scale: 2.8, uv: true, spec: 0.1, id: 0.71 }));
  // brass girth rings
  for (const u of [0.2, 0.4, 0.6, 0.8]) {
    const r = Math.pow(Math.sin(Math.PI * u), 0.62) * (1 - 0.15 * u) * rad * 1.005;
    b.add(new THREE.TorusGeometry(r, 0.18, 6, 32), mul(T, M(0, 0, (u - 0.5) * len)), m(PAL.brass, LAYER.METAL, { spec: 0.8, id: 0.72 }));
  }
  // tail fins
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    b.add(P.box(), mul(T, M(Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55, -len * 0.42, 0, 0, a, 0.25, rad * 0.9, len * 0.14)), m(colors[1], LAYER.CLOTH, { id: 0.73 }));
  }
}

function shipHull(b, len, T) {
  // wooden hull: loft of rings along z, flat deck on top
  const rings = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.5) * 4.2 + 0.2;
    rings.push({ y: (u - 0.5) * len, rx: w, rz: w * 0.62 + 0.3 });
  }
  const g = loft(rings, { sides: 14 });
  g.rotateX(Math.PI / 2); // along z
  b.add(g, T, m(0x7a4a2a, LAYER.PLANKS, { scale: 2, id: 0.74 }));
  // deck cabin with lit windows
  b.add(P.box(), mul(T, M(0, 2.6, -2, 0, 0, 0, 5.4, 2.6, len * 0.42)), m(0x8a5a36, LAYER.WOOD, { id: 0.75 }));
  b.add(P.box(), mul(T, M(0, 4.05, -2, 0, 0, 0, 5.8, 0.3, len * 0.44)), m(PAL.brassDark, LAYER.METAL, { spec: 0.6, id: 0.75 }));
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) b.add(P.box(), mul(T, M(s * 2.71, 2.7, -2 - len * 0.18 + k * len * 0.052, 0, 0, 0, 0.06, 0.8, 0.9)), m(0xffb45a, LAYER.GLASS, { emit: 2.2, id: 0.76 }));
  // bow sprit and brass figurehead
  b.add(P.cone(8), mul(T, M(0, 1.2, len * 0.52, Math.PI / 2, 0, 0, 0.5, 6, 0.5)), m(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.77 }));
  // railings
  for (const s of [-1, 1]) b.add(P.box(), mul(T, M(s * 3.6, 1.9, 0, 0, 0, 0, 0.08, 0.9, len * 0.8)), m(0x4a3020, LAYER.WOOD, { id: 0.75 }));
  // funnel
  b.add(P.cylB(12), mul(T, M(0, 4.2, -len * 0.28, 0, 0, 0, 0.9, 3.2, 0.9)), m(PAL.copper, LAYER.METAL, { spec: 0.7, id: 0.78 }));
}

function makeAirship(kind, seed) {
  const b = new GeoBuilder();
  const r = new RNG(seed);
  const props = [];
  if (kind === 'big') {
    const len = 72, rad = 10.5;
    envelope(b, len, rad, [0xd8b890, 0x9a3a32], M(0, 16, 0));
    shipHull(b, 36, M(0, 0, 0));
    // rigging struts from hull to envelope
    for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) b.add(P.box(), Mseg(new THREE.Vector3(s * 3.4, 2.4, k * 4.2), new THREE.Vector3(s * 6.5, 9.0, k * 5.2), 0.14, 0.14), m(0x3a2a22, LAYER.IRON, { id: 0.79 }));
    // engine pods with propellers
    for (const s of [-1, 1]) {
      b.add(P.cyl(12), M(s * 9, 3, -12, Math.PI / 2, 0, 0, 1.2, 5, 1.2), m(PAL.brass, LAYER.METAL, { spec: 0.8, id: 0.8 }));
      b.add(P.box(), M(s * 6, 3, -12, 0, 0, 0, 6, 0.3, 0.6), m(0x3a2a22, LAYER.IRON, { id: 0.79 }));
      props.push({ pos: new THREE.Vector3(s * 9, 3, -14.8), r: 3.2 });
    }
    props.push({ pos: new THREE.Vector3(0, 16, -37.5), r: 4.2 });
  } else {
    const len = r.range(34, 46), rad = len * 0.16;
    const col = r.pick([[0xc8a878, 0x3a5a7a], [0xb87a5a, 0x2f5a48], [0xd8c8a8, 0x7a2a3a]]);
    envelope(b, len, rad, col, M(0, rad + 2.2, 0));
    b.add(P.box(), M(0, 0, 0, 0, 0, 0, 2.6, 2.0, len * 0.3), m(0x6a4a30, LAYER.WOOD, { id: 0.74 }));
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) b.add(P.box(), M(s * 1.32, 0.2, -len * 0.12 + k * len * 0.06, 0, 0, 0, 0.05, 0.6, 0.8), m(0xffb45a, LAYER.GLASS, { emit: 2.0, id: 0.76 }));
    for (const s of [-1, 1]) b.add(P.box(), Mseg(new THREE.Vector3(s * 1.2, 1.0, 0), new THREE.Vector3(s * rad * 0.5, rad + 1.0, 0), 0.1, 0.1), m(0x3a2a22, LAYER.IRON, { id: 0.79 }));
    props.push({ pos: new THREE.Vector3(0, 0.2, -len * 0.17), r: 1.6 });
  }
  const mesh = new THREE.Mesh(b.build(), worldMaterial());
  mesh.layers.enable(LAYER_DYN_CASTER);
  const group = new THREE.Group();
  group.add(mesh);
  // propellers: 3 blades each
  const pb = new GeoBuilder();
  for (let k = 0; k < 3; k++) pb.add(P.box(), M(0, 0, 0, 0, 0, (k / 3) * Math.PI * 2, 0.35, 1, 0.08).multiply(new THREE.Matrix4().makeTranslation(0, 0.5, 0)), m(0x5a3a26, LAYER.WOOD, { id: 0.81 }));
  pb.add(P.cyl(8), M(0, 0, 0, Math.PI / 2, 0, 0, 0.25, 0.6, 0.25), m(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.81 }));
  const pgeo = pb.build();
  const propMeshes = props.map((p) => { const pm = new THREE.Mesh(pgeo, mesh.material); pm.position.copy(p.pos); pm.scale.setScalar(p.r); group.add(pm); return pm; });
  return { group, propMeshes };
}

export class Airships {
  constructor() {
    this.group = new THREE.Group();
    this.list = [];
    // the big airship crosses the city from the south west toward the north east
    const big = makeAirship('big', 1);
    this.group.add(big.group);
    const bigPath = { from: new THREE.Vector3(-330, 178, 420), dir: new THREE.Vector3(0.52, 0, -0.85).normalize(), speed: 6.5 };
    this.big = {
      ...big, path: bigPath,
      posAt: (S) => bigPath.from.clone().addScaledVector(bigPath.dir, bigPath.speed * S).add(new THREE.Vector3(0, Math.sin(S * 0.15) * 1.5, 0)),
      dirAt: () => bigPath.dir.clone(),
    };
    this.list.push(this.big);
    // blimps circling
    const r = new RNG(9);
    for (let i = 0; i < 4; i++) {
      const a = makeAirship('blimp', 10 + i);
      this.group.add(a.group);
      const c = new THREE.Vector3(r.range(-200, 200), r.range(110, 230), r.range(-350, 150));
      const R = r.range(260, 420), w = r.range(0.012, 0.02) * r.sign(), ph = r.range(0, 6.28);
      this.list.push({ ...a, posAt: (S) => new THREE.Vector3(c.x + Math.cos(ph + w * S) * R, c.y + Math.sin(S * 0.2 + i) * 2, c.z + Math.sin(ph + w * S) * R), dirAt: (S) => new THREE.Vector3(-Math.sin(ph + w * S) * Math.sign(w), 0, Math.cos(ph + w * S) * Math.sign(w)) });
    }
    // one blimp moored at the mast (gently swinging in the wind)
    const moored = makeAirship('blimp', 42);
    this.group.add(moored.group);
    const mt = new THREE.Vector3(CITY.mast.x, 60, CITY.mast.z);
    this.list.push({ ...moored, moored: true, posAt: (S) => mt.clone().add(new THREE.Vector3(Math.sin(S * 0.1) * 2, -4, 22 + Math.cos(S * 0.13))), dirAt: (S) => new THREE.Vector3(Math.sin(0.1 + Math.sin(S * 0.1) * 0.08), 0, -1).normalize() });
    // a low airship that crosses over the rooftops during the chase (its shadow sweeps over Emil)
    const low = makeAirship('blimp', 77);
    this.group.add(low.group);
    this.low = { ...low, posAt: (S) => new THREE.Vector3(120 - (S - 200) * 5.0, 58, -140 + (S - 200) * 3.0), dirAt: () => new THREE.Vector3(-5, 0, 3).normalize() };
    this.list.push(this.low);
  }
  update(S) {
    for (const a of this.list) {
      const p = a.posAt(S), d = a.dirAt(S);
      a.group.position.copy(p);
      a.group.rotation.set(0, Math.atan2(d.x, d.z), Math.sin(S * 0.3 + p.x) * 0.02);
      a.propMeshes.forEach((pm, i) => pm.rotation.set(0, 0, S * (a.moored ? 1.5 : 7) + i));
    }
  }
}

// ------------------------------------------------------------------ steam tram
function tramGeo() {
  const b = new GeoBuilder();
  const L = 13.5, Wd = 2.5, H = 3.3;
  const body = m(0x8a2a24, LAYER.WOOD, { id: 0.6, scale: 1.6 });
  const cream = m(0xe6d6b0, LAYER.PLASTER, { id: 0.6, scale: 2 });
  b.add(P.box(), M(0, 0.9, 0, 0, 0, 0, Wd, 1.2, L), body);
  b.add(P.box(), M(0, 2.2, 0, 0, 0, 0, Wd - 0.05, 1.4, L - 0.4), cream);
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) {
    b.add(P.box(), M(s * (Wd / 2 - 0.01), 2.25, -L / 2 + 1.2 + k * 1.3, 0, 0, 0, 0.05, 1.0, 1.0), m(0xffb65a, LAYER.GLASS, { emit: 1.6, id: 0.61, spec: 0.2 }));
  }
  b.add(P.box(), M(0, 3.05, 0, 0, 0, 0, Wd + 0.2, 0.25, L + 0.3), body);
  b.add(P.cyl(16), M(0, 3.25, 0, 0, 0, Math.PI / 2, 1.2, L - 0.5, 0.35).premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), m(0x3a2a24, LAYER.WOOD, { id: 0.6 }));
  // brass trim and boiler dome with chimney at the front
  b.add(P.box(), M(0, 1.52, 0, 0, 0, 0, Wd + 0.06, 0.08, L + 0.05), m(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.62 }));
  b.add(P.cyl(14), M(0, 3.6, L / 2 - 1.5, 0, 0, 0, 0.55, 0.9, 0.55), m(PAL.copper, LAYER.METAL, { spec: 0.8, id: 0.63 }));
  b.add(P.cylB(10), M(0, 3.9, L / 2 - 1.5, 0, 0, 0, 0.18, 1.4, 0.18), m(0x2a2626, LAYER.IRON, { id: 0.63 }));
  // headlamp
  b.add(P.cyl(12), M(0, 1.6, L / 2 + 0.05, Math.PI / 2, 0, 0, 0.28, 0.2, 0.28), m(0xffe0a0, LAYER.GLASS, { emit: 4.0, id: 0.64 }));
  // wheels and cowcatcher
  for (const z of [-L / 2 + 2, L / 2 - 2]) for (const s of [-1, 1]) b.add(P.cyl(14), M(s * 0.72, 0.42, z, 0, 0, Math.PI / 2, 0.42, 0.12, 0.42), m(0x2a2626, LAYER.IRON, { spec: 0.5, id: 0.65 }));
  b.add(P.box(), M(0, 0.35, L / 2 + 0.25, 0.5, 0, 0, Wd - 0.3, 0.7, 0.1), m(0x2a2626, LAYER.IRON, { id: 0.65 }));
  // line number board
  b.add(P.box(), M(0, 3.3, L / 2 + 0.02, 0, 0, 0, 0.9, 0.35, 0.05), m(0xf0e0b0, LAYER.BRUSH, { emit: 1.0, id: 0.66 }));
  return b.build();
}

export class Trams {
  constructor(story) {
    this.group = new THREE.Group();
    const geo = tramGeo();
    this.main = new THREE.Mesh(geo, worldMaterial());
    this.main.layers.enable(LAYER_DYN_CASTER);
    this.group.add(this.main);
    this.second = new THREE.Mesh(geo, this.main.material);
    this.second.layers.enable(LAYER_DYN_CASTER);
    this.group.add(this.second);
    this.tram = story.tram;
    this.funnel = new THREE.Vector3();
  }
  update(S) {
    // the chase tram runs west (-x) along the Kesselstrasse; its front at frontAt(S)
    const fx = this.tram.frontAt(S);
    this.main.position.set(fx + this.tram.len / 2, 0.0, this.tram.z);
    this.main.rotation.set(0, -Math.PI / 2, 0);
    this.main.visible = fx > -260 && fx < 260;
    // the second tram runs east on a loop further away
    const x2 = ((S * 6 + 400) % 800) - 400;
    this.second.position.set(x2, 0, this.tram.z + 0.0);
    this.second.rotation.set(0, Math.PI / 2, 0);
    this.second.visible = Math.abs(x2 - this.main.position.x) > 30 && Math.abs(x2) > 40;
    this.funnel.set(fx + 1.5, 5.2, this.tram.z);
  }
}
