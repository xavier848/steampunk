// The whole city of Dampfstadt. Buildings are generated per block and merged into
// chunked meshes (one draw call each, sorted front to back by three, frustum culled).
import * as THREE from 'three';
import { GeoBuilder, P, M, Mseg, mul, boxUV } from '../engine/geo.js';
import { worldMaterial } from '../engine/materials.js';
import { LAYER } from '../engine/textures.js';
import { RNG } from '../core/rng.js';
import { addBuilding, addSimpleBuilding, newCollector } from './buildings.js';
import { addStreet, addLampPost, addWallLamp, addBollard, CURB_H } from './street.js';
import { CITY, NS_STREETS, EW_STREETS, streetHalf } from './layout.js';
import { PAL } from './palette.js';
import { LAYER_STATIC_CASTER } from '../engine/engine.js';
import { buildLandmarks } from './landmarks.js';
import { buildMarket } from './market.js';
import { buildRooftops, HERO_LOTS } from './rooftops.js';

const STYLES = ['timber', 'timber', 'stone', 'brick', 'plaster'];

export function buildCity() {
  const X = newCollector();
  const chunks = new Map(); // key -> GeoBuilder
  const CH = 80;
  const chunkOf = (x, z, tag = '') => {
    const key = `${Math.floor(x / CH)}_${Math.floor(z / CH)}${tag}`;
    if (!chunks.has(key)) chunks.set(key, new GeoBuilder());
    return chunks.get(key);
  };
  // far versions of the detailed chunks (swapped in by distance)
  const lodChunks = new Map();
  const lodOf = (x, z) => {
    const key = `${Math.floor(x / CH)}_${Math.floor(z / CH)}a`;
    if (!lodChunks.has(key)) lodChunks.set(key, new GeoBuilder());
    return lodChunks.get(key);
  };
  const r = new RNG(2024);

  // ---------------------------------------------------------------- streets
  const streets = new GeoBuilder();
  addStreet(streets, { axis: 'z', a0: CITY.market.z0, a1: -38.5, road: 10, walk: 3.4, rails: [0] });
  addStreet(streets, { axis: 'z', a0: -21.5, a1: CITY.market.z1, road: 10, walk: 3.4, rails: [0] });
  addStreet(streets, { axis: 'x', a0: -380, a1: 380, c: -30, road: 11, walk: 3.0, rails: [0] });
  // secondary streets (plain), skipping the market street and the squares
  for (const x of NS_STREETS) {
    if (x === 0) continue;
    addStreet(streets, { axis: 'z', a0: -460, a1: 380, c: x, road: 8, walk: 2.6 });
  }
  for (const z of EW_STREETS) {
    if (z === -30 || z === -152 || z === -214) continue;
    if (z === -100) { addStreet(streets, { axis: 'x', a0: 8.4, a1: 47.4, c: z, road: 6, walk: 0, walkL: false, walkR: false }); continue; }
    addStreet(streets, { axis: 'x', a0: -380, a1: 380, c: z, road: z === 128 ? 14 : 8, walk: 2.6 });
  }
  // clock tower square paving and a south square
  streets.add(P.box(), M(0, -0.2, (CITY.square.z0 + CITY.square.z1) / 2, 0, 0, 0, CITY.square.x1 - CITY.square.x0, 0.4, CITY.square.z1 - CITY.square.z0), { color: 0xa39482, layer: LAYER.FLAGSTONE, scale: 5, spec: 0, emit: 0, id: 0.02, uv: false });
  // ground plane under everything (dark courtyards)
  {
    // with a square hole where the shaft goes down (x0..x1, z0..z1)
    const gm = { color: 0x6a5a50, layer: LAYER.COBBLE, scale: 4, spec: 0, emit: 0, id: 0.01, uv: false };
    const hx0 = CITY.hatch.x - 1.3, hx1 = CITY.hatch.x + 1.3, hz0 = CITY.hatch.z - 1.3, hz1 = CITY.hatch.z + 1.3, E = 1150;
    const slab = (x0, x1, z0, z1) => streets.add(P.box(), M((x0 + x1) / 2, -0.45, (z0 + z1) / 2, 0, 0, 0, x1 - x0, 0.5, z1 - z0), gm);
    slab(-E, E, -E, hz0); slab(-E, E, hz1, E); slab(-E, hx0, hz0, hz1); slab(hx1, E, hz0, hz1);
  }

  // ---------------------------------------------------------------- blocks
  const heroSkip = (x, z) => HERO_LOTS.some((h) => Math.abs(x - h.x) < h.d / 2 + 0.5 && Math.abs(z - h.z) < h.w / 2 + 0.5);
  const lots = [];
  for (let i = 0; i < NS_STREETS.length - 1; i++) {
    for (let j = 0; j < EW_STREETS.length - 1; j++) {
      const xa = NS_STREETS[i], xb = NS_STREETS[i + 1];
      const za = EW_STREETS[j], zb = EW_STREETS[j + 1];
      const bx0 = xa + streetHalf('ns', xa), bx1 = xb - streetHalf('ns', xb);
      const bz0 = za + streetHalf('ew', za), bz1 = zb - streetHalf('ew', zb);
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      // the clock tower square is open
      if (za >= -214 && zb <= -152 && bx0 < 72 && bx1 > -72) continue;
      // alley only exists east of the market street
      if (za === -100 && xa < 0) continue;
      const dist = Math.hypot(cx, cz * 0.8);
      if (dist > 520) continue;
      const onMarket = Math.abs(bx0 - 8.4) < 0.1 || Math.abs(bx1 + 8.4) < 0.1;
      const level = onMarket ? 2 : dist < 200 ? 1 : 0;
      fillBlock({ bx0, bx1, bz0, bz1, level, onMarket }, r, lots, heroSkip);
    }
  }
  // west block between cross street and square spans the alley line (no alley west)
  const G = 4.4, F = 3.4;
  for (const lot of lots) {
    if (lot.level === 2) {
      const res = addBuilding(chunkOf(lot.x, lot.z, 'a'), { ...lot, detail: 2 }, X);
      // matching low detail stand in for distant views
      const roofMap = { gableStreet: 'gable', gableSide: 'gableX', mansard: 'mansard', flat: 'flat', custom: 'flat' };
      addSimpleBuilding(lodOf(lot.x, lot.z), { ...lot, h: res.H, roof: roofMap[lot.roof] || 'flat', gear: false }, null);
    } else {
      const floors = lot.floors ?? 3;
      addSimpleBuilding(chunkOf(lot.x, lot.z), { ...lot, h: lot.h ?? (G + floors * F), gear: lot.level === 1 && lot.seed % 5 === 0 }, X);
    }
  }

  // ---------------------------------------------------------------- outskirts (only seen from the air)
  // simple blocks from the edge of the town out to the painted far city ring, so the
  // city reaches the horizon in the flight instead of ending on an empty plain
  const outTiles = new Map();
  const outOf = (x, z) => { const k = `${Math.floor(x / 220)},${Math.floor(z / 220)}`; if (!outTiles.has(k)) outTiles.set(k, new GeoBuilder()); return outTiles.get(k); };
  {
    const ro = new RNG(4711);
    const ns = [], ew = [];
    for (let x = -932; x <= 934; x += 80) ns.push(NS_STREETS.includes(x) ? x : x);
    for (let z = -1092; z <= 848; z += 80) ew.push(z);
    for (let i = 0; i < ns.length - 1; i++) for (let j = 0; j < ew.length - 1; j++) {
      const bx0 = ns[i] + 4.5, bx1 = ns[i + 1] - 4.5, bz0 = ew[j] + 4.5, bz1 = ew[j + 1] - 4.5;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      const inCore = cx > NS_STREETS[0] && cx < NS_STREETS[NS_STREETS.length - 1] && cz > EW_STREETS[0] && cz < EW_STREETS[EW_STREETS.length - 1] && Math.hypot(cx, cz * 0.8) <= 520 + 40;
      if (inCore) continue;
      const dr = Math.hypot(cx, cz + 120);
      if (dr > 790) continue;
      const oLots = [];
      fillBlock({ bx0, bx1, bz0, bz1, level: 0, onMarket: false }, ro, oLots, () => false);
      for (const lot of oLots) {
        lot.h = ro.range(8, 17) * (1 - 0.3 * Math.min(1, (dr - 500) / 300));
        lot.roof = ro.pick(['gable', 'gable', 'gableX', 'flat', 'mansard']);
        addSimpleBuilding(outOf(lot.x, lot.z), lot, null);
      }
    }
  }

  // ---------------------------------------------------------------- hero rooftops, market, landmarks
  const hero = new GeoBuilder();
  const rooftops = buildRooftops(hero, X);
  const market = buildMarket(chunkOf, X, r);
  const land = new GeoBuilder();
  const landmarks = buildLandmarks(land, X);

  // ---------------------------------------------------------------- meshes
  const group = new THREE.Group();
  const mat = worldMaterial();
  const addMesh = (b, name) => {
    if (b.empty) return null;
    const m = new THREE.Mesh(b.build(), mat);
    m.name = name;
    m.layers.enable(LAYER_STATIC_CASTER);
    group.add(m);
    return m;
  };
  const streetMesh = addMesh(streets, 'streets');
  streetMesh.renderOrder = 5; // big ground planes last among opaques: most pixels are covered already
  const lod = [];
  for (const [k, b] of chunks) {
    const m = addMesh(b, 'chunk_' + k);
    if (!m) continue;
    if (k.endsWith('a') && lodChunks.has(k)) {
      const far = addMesh(lodChunks.get(k), 'lod_' + k);
      far.visible = false;
      lod.push({ near: m, far, center: m.geometry.boundingSphere.center.clone(), dist: 170 });
    } else if (k.endsWith('m')) {
      lod.push({ near: m, far: null, center: m.geometry.boundingSphere.center.clone(), dist: 230 });
    }
  }
  addMesh(hero, 'hero');
  addMesh(land, 'landmarks');
  let tris = 0;
  group.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
  const updateLOD = (cam) => {
    for (const l of lod) {
      const d = l.center.distanceTo(cam);
      const near = d < l.dist;
      l.near.visible = near;
      if (l.far) l.far.visible = !near;
    }
  };
  const outskirts = new THREE.Group();
  let outTris = 0;
  for (const b of outTiles.values()) { if (b.empty) continue; const m = new THREE.Mesh(b.build(), mat); m.layers.enable(LAYER_STATIC_CASTER); outTris += m.geometry.index.count / 3; outskirts.add(m); }
  group.add(outskirts);
  return { group, X, rooftops, market, landmarks, lots, updateLOD, outskirts, info: { outskirtsTris: Math.round(outTris), tris: Math.round(tris), meshes: group.children.length, lots: lots.length, lodChunks: lod.length } };
}

// Perimeter block: houses along each edge facing outward, courtyard inside.
function fillBlock({ bx0, bx1, bz0, bz1, level, onMarket }, r, lots, heroSkip) {
  const W = bx1 - bx0, D = bz1 - bz0;
  if (W < 8 || D < 8) return;
  const depth = (lvl) => (lvl === 0 ? r.range(11, 15) : r.range(12, 14));
  const sides = [
    { edge: 'n', a0: bx0, a1: bx1, fixed: bz0, rot: Math.PI, along: 'x' },  // faces -z (north)
    { edge: 's', a0: bx0, a1: bx1, fixed: bz1, rot: 0, along: 'x' },        // faces +z (south)
    { edge: 'w', a0: bz0, a1: bz1, fixed: bx0, rot: -Math.PI / 2, along: 'z' }, // faces -x
    { edge: 'e', a0: bz0, a1: bz1, fixed: bx1, rot: Math.PI / 2, along: 'z' },  // faces +x
  ];
  const dN = depth(level), dS = depth(level);
  for (const s of sides) {
    // market street faces get the highest detail; other faces one level lower
    const faceMarket = onMarket && ((s.edge === 'w' && Math.abs(bx0 - 8.4) < 0.1) || (s.edge === 'e' && Math.abs(bx1 + 8.4) < 0.1));
    const lvl = faceMarket ? 2 : Math.min(level, 1);
    let a0 = s.a0, a1 = s.a1;
    if (s.along === 'z') { a0 += dN; a1 -= dS; } // corners belong to the north/south rows
    const len = a1 - a0;
    if (len < 6) continue;
    const d = s.along === 'x' ? (s.edge === 'n' ? dN : dS) : Math.min(depth(lvl), W / 2 - 2);
    if (d < 6) continue;
    let pos = a0;
    let guard = 0;
    while (pos < a1 - 5 && guard++ < 40) {
      let w = lvl === 2 ? r.range(8, 12) : r.range(9, 15);
      if (a1 - pos - w < 6) w = a1 - pos;
      const mid = pos + w / 2;
      let x, z;
      if (s.along === 'x') { x = mid; z = s.edge === 'n' ? s.fixed + d / 2 : s.fixed - d / 2; }
      else { z = mid; x = s.edge === 'w' ? s.fixed + d / 2 : s.fixed - d / 2; }
      pos += w;
      if (heroSkip(x, z)) continue;
      const corner = s.along === 'x' && (mid - w / 2 <= s.a0 + 0.1 || mid + w / 2 >= s.a1 - 0.1);
      const lot = {
        x, z, w, d, rot: s.rot, seed: r.int(1, 1e9), level: lvl,
        style: r.pick(STYLES),
        floors: lvl === 2 ? r.int(3, 5) : r.int(2, 5),
        h: lvl === 0 ? r.range(12, 26) : undefined,
      };
      if (lvl === 2) {
        lot.roof = r.pick(['gableStreet', 'gableStreet', 'gableSide', 'mansard', 'flat', 'mansard']);
        lot.shop = true;
      } else if (lvl === 1) {
        lot.roof = r.pick(['gableStreet', 'gableSide', 'mansard', 'flat']);
        lot.shop = r.chance(0.4);
      }
      if (corner && lvl > 0) lot.sides = mid - w / 2 <= s.a0 + 0.1 ? ['front', s.edge === 'n' ? 'right' : 'left'] : ['front', s.edge === 'n' ? 'left' : 'right'];
      lots.push(lot);
    }
  }
}
