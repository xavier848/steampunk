// The hero rooftop route on the east side of the market street, from the ladder house
// (by the tram crossing) north to the pump house with the brass hatch.
// Lots face the market street (rot = -PI/2: local +z -> world -x, local +x -> world +z).
import * as THREE from 'three';
import { P, M, Mseg, mul, gableRoof, pipeRun } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { addBuilding } from './buildings.js';
import { CITY } from './layout.js';
import { PAL } from './palette.js';
import { crate, barrel } from './props.js';
import { RNG } from '../core/rng.js';
import { CURB_H } from './street.js';

const FX = CITY.facadeX;
const D = 14;
const X0 = FX + D / 2; // lot centre x
const G = 4.4, F = 3.4;
const H3 = G + 3 * F; // 14.6
const H4 = G + 4 * F; // 18.0

// z extents (north = more negative)
export const HERO_LOTS = [
  { name: 'H1', z0: -48, z1: -38.5, floors: 3, roof: 'flat', style: 'stone', parapet: 0.5, tank: false, chimneys: 2, chimneyPos: [[3.2, -5.2], [-3.4, -5.6]], sides: ['front', 'right'], gear: false, pipes: true },
  { name: 'H2', z0: -58, z1: -48, floors: 3, roof: 'gableSide', roofH: 1.9, style: 'timber', tile: 0x6f7c8f, chimneys: 1, gear: true, gearR: 1.4 },
  { name: 'H3', z0: -73, z1: -62.5, floors: 3, roof: 'flat', style: 'brick', parapet: 0.5, tank: true, tankPos: [-3.0, -5.2], chimneys: 1, chimneyPos: [[3.4, -5.6]], gear: false },
  { name: 'H4', z0: -85, z1: -73, floors: 3, roof: 'custom', style: 'plaster', chimneys: 0, gear: true, gearR: 1.2 },
  { name: 'H5', z0: -97, z1: -85, floors: 4, roof: 'flat', style: 'stone', parapet: 0.5, tank: false, chimneys: 2, chimneyPos: [[-3.0, -5.4], [2.5, -5.8]], gear: false, sides: ['front', 'left'] },
  { name: 'H6', z0: -116, z1: -103, floors: 3, roof: 'flat', style: 'brick', parapet: 0.5, tank: false, chimneys: 1, chimneyPos: [[5.0, -5.8]], gear: false, sides: ['front', 'right'] },
  { name: 'H7', z0: -128, z1: -116, floors: 5, roof: 'gableStreet', style: 'timber', chimneys: 2, gear: true },
].map((h) => ({ ...h, x: X0, z: (h.z0 + h.z1) / 2, w: h.z1 - h.z0, d: D }));

// route anchors used by the story (world coordinates)
export const ROOF = {
  h1: H3 + 0.06, h2eave: H3 + 0.05, h2ridge: H3 + 0.05 + 1.9, walkY: H3 + 0.35, h3: H3 + 0.06, h4: H3 + 0.06, h5: H4 + 0.06, h6: H3 + 0.06,
  ladderTop: H3 + 0.6,
  hatch: new THREE.Vector3(CITY.hatch.x, H3 + 1.25, CITY.hatch.z),
  shaftR: 1.05,
};

export function buildRooftops(b, X) {
  const r = new RNG(707);
  for (const h of HERO_LOTS) {
    const lot = { ...h, rot: -Math.PI / 2, seed: 9000 + h.z0 | 0, detail: 2, shop: h.name !== 'H6', lit: 0.3, groundH: G, floorH: F };
    if (h.name === 'H6') lot.hole = { x: CITY.hatch.z - h.z, z: X0 - CITY.hatch.x, r: ROOF.shaftR };
    addBuilding(b, lot, X);
  }
  const mIron = { color: 0x2f2b2c, layer: LAYER.IRON, scale: 1, spec: 0.4, emit: 0, id: 0.86, uv: false };
  const mWood = { color: 0x7a5234, layer: LAYER.PLANKS, scale: 1.2, spec: 0, emit: 0, id: 0.87, uv: false };
  const mBrass = { color: PAL.brass, layer: LAYER.METAL, scale: 1, spec: 0.9, emit: 0, id: 0.88, uv: false };
  const mCopper = { color: PAL.copper, layer: LAYER.METAL, scale: 1.2, spec: 0.7, emit: 0, id: 0.88, uv: false };

  // ---- ladder on the H1 facade (in front of the facade, which faces -x)
  const lz = CITY.ladder.z, lx = FX - 0.32;
  for (const s of [-1, 1]) b.add(P.box(), M(lx, (1.6 + ROOF.ladderTop + 0.9) / 2, lz + s * 0.26, 0, 0, 0, 0.06, ROOF.ladderTop + 0.9 - 1.6, 0.06), mIron);
  for (let y = 1.8; y < ROOF.ladderTop + 0.8; y += 0.3) b.add(P.box(), M(lx, y, lz, 0, 0, 0, 0.04, 0.04, 0.5), mIron);
  for (let y = 3; y < ROOF.ladderTop; y += 3) b.add(P.box(), M(lx + 0.16, y, lz, 0, 0, 0, 0.32, 0.05, 0.05), mIron); // wall brackets
  // crates at the ladder foot
  const cx = CITY.crates.x, cz = CITY.crates.z;
  crate(b, M(cx, CURB_H, cz + 0.9, 0, 0.15, 0), r, 0.72);
  crate(b, M(cx - 0.1, CURB_H, cz, 0, -0.1, 0), r, 0.8);
  crate(b, M(cx - 0.05, CURB_H + 0.8, cz + 0.1, 0, 0.3, 0), r, 0.7);
  crate(b, M(cx + 0.1, CURB_H, cz - 0.9, 0, 0.2, 0), r, 0.72);
  barrel(b, M(cx - 0.8, CURB_H, cz + 1.8), r);
  barrel(b, M(cx + 0.2, CURB_H, cz + 1.9), r);

  // ---- walkway over the light well between H2 and H3 (z -58 .. -62.5)
  const wy = ROOF.walkY;
  for (let z = -57.6; z >= -62.9; z -= 0.26) b.add(P.box(), M(X0 + 1.0, wy, z, 0, 0, 0, 1.3, 0.06, 0.22), { ...mWood, color: r.pick([0x7a5234, 0x8a6040, 0x6a4a2e]) });
  for (const s of [-1, 1]) {
    b.add(P.box(), M(X0 + 1.0 + s * 0.68, wy - 0.12, -60.25, 0, 0, 0, 0.1, 0.16, 5.4), mWood);
    b.add(P.box(), M(X0 + 1.0 + s * 0.7, wy + 0.95, -60.25, 0, 0, 0, 0.05, 0.05, 5.0), mIron);
    for (let z = -57.8; z >= -62.8; z -= 1.25) b.add(P.box(), M(X0 + 1.0 + s * 0.7, wy + 0.5, z, 0, 0, 0, 0.04, 0.95, 0.04), mIron);
  }
  // light well walls are the side walls of H2 and H3 (already solid); add a drain pipe and a clothes line across it
  pipeRun(b, [[X0 + 5.5, 0.2, -58.3], [X0 + 5.5, H3 + 0.4, -58.3]], 0.09, { collarColor: PAL.brassDark });

  // ---- H3 roof: laundry lines on poles
  const lineY = ROOF.h3 + 1.75;
  const poles = [[X0 - 3.5, -64], [X0 - 3.5, -71.5], [X0 + 2.5, -64], [X0 + 2.5, -71.5]];
  for (const [x, z] of poles) b.add(P.cylB(6), M(x, ROOF.h3, z, 0, 0, 0, 0.04, 1.9, 0.04), mWood);
  const laundry = [];
  // lines (3 cm so they never break into dashes): two across the roof, two along it
  for (const x of [X0 - 3.5, X0 + 2.5]) b.add(P.box(), M(x, lineY, -67.75, 0, 0, 0, 0.03, 0.03, 7.5), { ...mIron, color: 0xd8d0c0 });
  for (const z of [-64, -71.5]) b.add(P.box(), M(X0 - 0.5, lineY, z, 0, 0, 0, 6.0, 0.03, 0.03), { ...mIron, color: 0xd8d0c0 });
  const cloths = [0xf0e8d8, 0xc84a3a, 0x3a6a8a, 0xe8d6a0, 0x6a8a5a, 0xf2eee4, 0xa05a8a];
  for (let i = 0; i < 9; i++) {
    const x = i < 5 ? X0 - 3.5 : X0 + 2.5;
    const z = -64.6 - (i % 5) * 1.4;
    laundry.push({ pos: new THREE.Vector3(x, lineY, z), w: r.range(0.6, 1.1), h: r.range(0.6, 1.1), color: r.pick(cloths), rot: Math.PI / 2, seed: i, along: 'z' });
  }
  // sheets on the cross lines (Emil ducks under these)
  for (const [x, z] of [[X0 - 2.0, -64], [X0 + 0.9, -64], [X0 - 1.2, -71.5], [X0 + 1.6, -71.5]]) {
    laundry.push({ pos: new THREE.Vector3(x, lineY, z), w: r.range(1.0, 1.4), h: r.range(0.9, 1.2), color: r.pick(cloths), seed: 20 + laundry.length, along: 'x' });
  }
  for (const l of laundry) {
    const alongX = l.along === 'x';
    b.add(P.box(), M(l.pos.x, l.pos.y - l.h / 2 - 0.02, l.pos.z, 0, 0, (r.next() - 0.5) * 0.08, alongX ? l.w : 0.02, l.h, alongX ? 0.02 : l.w), { color: l.color, layer: LAYER.CLOTH, scale: 0.6, spec: 0, emit: 0, id: 0.6 + (l.seed % 30) * 0.01, uv: false });
    for (const d of [-l.w / 2 + 0.05, l.w / 2 - 0.05]) b.add(P.box(), M(l.pos.x + (alongX ? d : 0), l.pos.y + 0.01, l.pos.z + (alongX ? 0 : d), 0, 0, 0, 0.04, 0.08, 0.04), { color: 0xc8b89a, layer: LAYER.WOOD, scale: 1, spec: 0, emit: 0, id: 0.6, uv: false });
  }
  // cat chimney (the cat sits here)
  const catChim = new THREE.Vector3(X0 + 4.0, ROOF.h3, -66.2);
  b.add(P.boxB(), M(catChim.x, catChim.y - 0.2, catChim.z, 0, 0, 0, 0.9, 1.6, 0.8), { color: PAL.brick[1], layer: LAYER.BRICK, scale: 2.2, spec: 0, emit: 0, id: 0.89, uv: false });
  b.add(P.boxB(), M(catChim.x, catChim.y + 1.35, catChim.z, 0, 0, 0, 1.04, 0.14, 0.94), { color: PAL.stone[2], layer: LAYER.STONE, scale: 2, spec: 0, emit: 0, id: 0.89, uv: false });

  // ---- H4 glass atelier roof: sawtooth glazing with iron frames and a plank catwalk
  const h4 = HERO_LOTS[3];
  const zA = h4.z0, zB = h4.z1;
  b.add(P.box(), M(X0, H3 + 0.12, (zA + zB) / 2, 0, 0, 0, D + 0.3, 0.24, zB - zA + 0.3), { color: PAL.stone[0], layer: LAYER.STONE, scale: 2.5, spec: 0, emit: 0, id: 0.9, uv: false });
  const teeth = 3;
  const tw = (zB - zA) / teeth;
  for (let i = 0; i < teeth; i++) {
    const z0 = zA + i * tw, z1 = z0 + tw;
    // glass slope facing north (toward -z): from low at z1 to high at z0
    const glass = new THREE.BufferGeometry();
    const yL = H3 + 0.24, yH = H3 + 2.1;
    const x0 = FX + 0.6, x1 = FX + D - 0.6;
    glass.setAttribute('position', new THREE.Float32BufferAttribute([x0, yL, z1 - 0.05, x1, yL, z1 - 0.05, x1, yH, z0 + 0.05, x0, yL, z1 - 0.05, x1, yH, z0 + 0.05, x0, yH, z0 + 0.05], 3));
    glass.computeVertexNormals();
    b.add(glass, null, { color: 0x7fb0c0, layer: LAYER.GLASS, scale: 1.5, spec: 0.9, emit: 0.35, id: 0.91, uv: false });
    // back wall of the tooth (opaque, plaster)
    b.add(P.box(), M((x0 + x1) / 2, (yL + yH) / 2, z0 + 0.02, 0, 0, 0, x1 - x0, yH - yL, 0.12), { color: PAL.plaster[0], layer: LAYER.PLASTER, scale: 3, spec: 0, emit: 0, id: 0.9, uv: false });
    // end triangles
    for (const xe of [x0, x1]) {
      const tri = new THREE.BufferGeometry();
      const pts = xe === x0 ? [xe, yL, z1, xe, yH, z0, xe, yL, z0] : [xe, yL, z0, xe, yH, z0, xe, yL, z1];
      tri.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      tri.computeVertexNormals();
      b.add(tri, null, { color: PAL.plaster[0], layer: LAYER.PLASTER, scale: 3, spec: 0, emit: 0, id: 0.9, uv: false });
    }
    // iron mullions on the glass
    for (let k = 0; k <= 8; k++) {
      const x = x0 + (k / 8) * (x1 - x0);
      b.add(P.box(), Mseg(new THREE.Vector3(x, yL + 0.03, z1 - 0.05), new THREE.Vector3(x, yH + 0.03, z0 + 0.05), 0.05, 0.05), mIron);
    }
    b.add(P.box(), M((x0 + x1) / 2, yH + 0.05, z0 + 0.06, 0, 0, 0, x1 - x0, 0.08, 0.12), mIron);
  }
  // plank catwalk along the valleys (x near the street edge)
  for (let z = zA + 0.2; z < zB - 0.1; z += 0.28) b.add(P.box(), M(FX + 0.35, H3 + 0.3, z, 0, 0, 0, 0.6, 0.05, 0.24), mWood);

  // ---- firewall ladder on H5's south wall (above the H4 roof)
  const lz5 = HERO_LOTS[4].z1 + 0.34; // just south of H5
  for (const s of [-1, 1]) b.add(P.box(), M(FX + 1.1 + s * 0.26, (H3 + H4 + 1.0) / 2, lz5, 0, 0, 0, 0.06, H4 - H3 + 1.0, 0.06), mIron);
  for (let y = H3 + 0.4; y < H4 + 0.9; y += 0.3) b.add(P.box(), M(FX + 1.1, y, lz5, 0, 0, 0, 0.5, 0.04, 0.04), mIron);

  // ---- pump house and brass hatch on H6
  const hx = CITY.hatch.x, hz = CITY.hatch.z, hy = ROOF.h6;
  const R = ROOF.shaftR;
  // hatch collar (open cylinder, so the shaft is really open) and flange
  b.add(new THREE.CylinderGeometry(R + 0.12, R + 0.18, 1.2, 28, 1, true), M(hx, hy + 0.6, hz), { ...mCopper, color: 0x8a5a36 });
  b.add(new THREE.CylinderGeometry(R, R, 1.2, 28, 1, true).scale(-1, 1, 1), M(hx, hy + 0.6, hz), { ...mIron, color: 0x4a3a32 });
  b.add(new THREE.TorusGeometry(R + 0.15, 0.09, 8, 32), M(hx, hy + 1.2, hz, Math.PI / 2, 0, 0), mBrass);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    b.add(P.sphere(6, 4), M(hx + Math.cos(a) * (R + 0.15), hy + 1.27, hz + Math.sin(a) * (R + 0.15), 0, 0, 0, 0.045), mBrass);
  }
  // pump house: brick box with a copper roof, gauges and a big valve pipe
  const ph = new THREE.Vector3(hx + 1.2, hy, hz - 4.2);
  b.add(P.boxB(), M(ph.x, ph.y, ph.z, 0, 0, 0, 4.2, 3.0, 3.2), { color: PAL.brick[0], layer: LAYER.BRICK, scale: 2.2, spec: 0, emit: 0, id: 0.92, uv: false });
  b.add(gableRoof(4.2, 3.2, 1.2, 0.25, { ends: true }), M(ph.x, ph.y + 3.05, ph.z), { color: PAL.patina[0], layer: LAYER.PATINA, scale: 2, spec: 0.3, emit: 0, id: 0.92, uv: true });
  b.add(P.box(), M(ph.x - 2.12, ph.y + 1.1, ph.z + 0.6, 0, 0, 0, 0.1, 2.0, 1.0), { color: 0x4a3024, layer: LAYER.WOOD, scale: 1, spec: 0, emit: 0, id: 0.92, uv: false });
  for (let k = 0; k < 3; k++) {
    b.add(P.cyl(16), M(ph.x - 2.13, ph.y + 1.3 + k * 0.45, ph.z - 0.8, 0, 0, Math.PI / 2, 0.16, 0.08, 0.16), mBrass);
    b.add(P.cyl(16), M(ph.x - 2.18, ph.y + 1.3 + k * 0.45, ph.z - 0.8, 0, 0, Math.PI / 2, 0.13, 0.02, 0.13), { color: 0xf0e6ca, layer: LAYER.BRUSH, scale: 1, spec: 0, emit: 0.4, id: 0.92, uv: false });
  }
  // pipes from the pump house into the hatch collar
  b.set(mCopper);
  pipeRun(b, [[ph.x - 1.0, ph.y + 0.5, ph.z + 1.6], [ph.x - 1.0, ph.y + 0.5, hz - R - 0.3], [hx - 0.2, hy + 0.5, hz - R - 0.2]], 0.14, { collarColor: PAL.brass });
  pipeRun(b, [[ph.x + 1.2, ph.y + 3.2, ph.z], [ph.x + 1.2, ph.y + 5.0, ph.z]], 0.2, { collarColor: PAL.brass });
  // exhaust pipe with a steam vent
  X.vents.push({ pos: new THREE.Vector3(ph.x + 1.2, ph.y + 5.1, ph.z), dir: new THREE.Vector3(0, 1, 0), seed: 77, big: true });

  // the cat's position and the laundry for the animated systems
  return { laundry, catChimney: catChim.clone().add(new THREE.Vector3(0, 1.42, 0)), pumpHouse: ph, hatch: new THREE.Vector3(hx, hy + 1.2, hz) };
}
