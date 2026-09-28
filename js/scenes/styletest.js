// Style test: one street corner of Dampfstadt at sunset. Used to tune the Arcane look
// before the whole city is built (?scene=stiltest).
import * as THREE from 'three';
import { GeoBuilder, P, M } from '../engine/geo.js';
import { worldMaterial, U } from '../engine/materials.js';
import { LAYER } from '../engine/textures.js';
import { createSky, SKY } from '../engine/sky.js';
import { addBuilding, newCollector } from '../city/buildings.js';
import { addStreet, addLampPost, addWallLamp, addBollard, CURB_H } from '../city/street.js';
import { Lamps } from '../city/lamps.js';
import { Gears } from '../city/gears.js';
import { createSignAtlas, buildSigns, addHangingBoards } from '../city/signs.js';
import { stall, barrel, crate, handcart, kiosk, foodStall, sack } from '../city/props.js';
import { RNG } from '../core/rng.js';
import { LAYER_MAIN, LAYER_STATIC_CASTER, LAYER_DYN_CASTER } from '../engine/engine.js';
import { applyLook, LOOKS } from '../engine/looks.js';

export function buildStyleTest(engine) {
  const scene = new THREE.Scene();
  const X = newCollector();
  const b = new GeoBuilder();
  const r = new RNG(11);

  // market street along z, cross street along x at z = -4
  addStreet(b, { axis: 'z', a0: -120, a1: -11, road: 9, walk: 3.4, rails: [0] });
  addStreet(b, { axis: 'z', a0: 3, a1: 40, road: 9, walk: 3.4, rails: [0] });
  addStreet(b, { axis: 'x', a0: -60, a1: 60, c: -4, road: 11, walk: 0.0, rails: [0], walkL: false, walkR: false });
  // corner plaza paving
  b.add(P.box(), M(0, -0.2, -4, 0, 0, 0, 16, 0.38, 14), { color: 0x9d8f80, layer: LAYER.FLAGSTONE, scale: 4.5, spec: 0, emit: 0, id: 0.02, uv: false });

  const W0 = 4.5 + 3.4; // facade line
  const lots = [];
  // west side (facades face +x): rot = +pi/2 means local +z -> world +x
  let z = 40;
  const west = [
    { w: 9, style: 'timber', floors: 3, roof: 'gableStreet' },
    { w: 8, style: 'plaster', floors: 4, roof: 'mansard' },
    { w: 10, style: 'stone', floors: 4, roof: 'flat', gear: true },
  ];
  for (const L of west) { lots.push({ ...L, x: -W0 - 6.5, z: z - L.w / 2, d: 13, rot: Math.PI / 2, seed: 100 + lots.length }); z -= L.w; }
  z = -11;
  const west2 = [
    { w: 9, style: 'brick', floors: 4, roof: 'gableSide' },
    { w: 8, style: 'timber', floors: 3, roof: 'gableStreet' },
    { w: 11, style: 'stone', floors: 5, roof: 'dome', domeColor: 0x5aa596 },
    { w: 9, style: 'timber', floors: 4, roof: 'gableStreet' },
    { w: 10, style: 'plaster', floors: 5, roof: 'mansard' },
    { w: 9, style: 'brick', floors: 4, roof: 'flat' },
    { w: 10, style: 'timber', floors: 3, roof: 'gableStreet' },
    { w: 12, style: 'stone', floors: 5, roof: 'mansard' },
    { w: 10, style: 'plaster', floors: 4, roof: 'gableSide' },
  ];
  for (const L of west2) { lots.push({ ...L, x: -W0 - 6.5, z: z - L.w / 2, d: 13, rot: Math.PI / 2, seed: 200 + lots.length }); z -= L.w; }
  // east side (facades face -x)
  z = 40;
  const east = [
    { w: 10, style: 'stone', floors: 4, roof: 'mansard', gear: true },
    { w: 9, style: 'timber', floors: 3, roof: 'gableStreet' },
    { w: 11, style: 'brick', floors: 4, roof: 'gableSide', sides: ['front', 'right'] },
  ];
  for (const L of east) { lots.push({ ...L, x: W0 + 6.5, z: z - L.w / 2, d: 13, rot: -Math.PI / 2, seed: 300 + lots.length }); z -= L.w; }
  z = -11;
  const east2 = [
    { w: 11, style: 'timber', floors: 4, roof: 'gableStreet', sides: ['front', 'left'] },
    { w: 9, style: 'plaster', floors: 5, roof: 'mansard' },
    { w: 10, style: 'stone', floors: 5, roof: 'flat', gear: true },
    { w: 9, style: 'timber', floors: 3, roof: 'gableStreet' },
    { w: 11, style: 'brick', floors: 5, roof: 'gableSide' },
    { w: 10, style: 'timber', floors: 4, roof: 'gableStreet' },
    { w: 12, style: 'stone', floors: 5, roof: 'dome', domeColor: 0xcf9b48 },
    { w: 10, style: 'plaster', floors: 4, roof: 'mansard' },
  ];
  for (const L of east2) { lots.push({ ...L, x: W0 + 6.5, z: z - L.w / 2, d: 13, rot: -Math.PI / 2, seed: 400 + lots.length }); z -= L.w; }
  // cross street buildings (facing the cross street)
  for (let i = 0; i < 4; i++) {
    lots.push({ w: 10, d: 12, x: -W0 - 16 - i * 10.5, z: -4 - 5.5 - 6, rot: 0, style: r.pick(['timber', 'stone', 'plaster']), floors: r.int(3, 5), roof: r.pick(['gableStreet', 'mansard']), seed: 500 + i });
    lots.push({ w: 10, d: 12, x: -W0 - 16 - i * 10.5, z: -4 + 5.5 + 6, rot: Math.PI, style: r.pick(['timber', 'stone', 'brick']), floors: r.int(3, 5), roof: r.pick(['gableStreet', 'flat']), seed: 520 + i });
    lots.push({ w: 10, d: 12, x: W0 + 16 + i * 10.5, z: -4 - 5.5 - 6, rot: 0, style: r.pick(['timber', 'stone', 'plaster']), floors: r.int(3, 5), roof: r.pick(['gableStreet', 'mansard']), seed: 540 + i });
    lots.push({ w: 10, d: 12, x: W0 + 16 + i * 10.5, z: -4 + 5.5 + 6, rot: Math.PI, style: r.pick(['timber', 'stone', 'brick']), floors: r.int(3, 5), roof: r.pick(['gableStreet', 'flat']), seed: 560 + i });
  }
  for (const lot of lots) addBuilding(b, lot, X);

  // clock tower at the end of the street
  const tb = b;
  const tz = -150;
  tb.add(P.boxB(), M(0, 0, tz, 0, 0, 0, 16, 34, 16), { color: 0xcdb28c, layer: LAYER.STONE, scale: 3.2, spec: 0, emit: 0, id: 0.9, uv: false });
  tb.add(P.boxB(), M(0, 34, tz, 0, 0, 0, 12, 14, 12), { color: 0xd8c29e, layer: LAYER.STONE, scale: 3.2, spec: 0, emit: 0, id: 0.9, uv: false });
  tb.add(P.cyl(32), M(0, 41, tz + 6.1, Math.PI / 2, 0, 0, 4.6, 0.4, 4.6), { color: 0xcf9b48, layer: LAYER.METAL, scale: 2, spec: 0.8, emit: 0, id: 0.9, uv: false });
  tb.add(P.cyl(32), M(0, 41, tz + 6.3, Math.PI / 2, 0, 0, 4.0, 0.2, 4.0), { color: 0xf2e6c4, layer: LAYER.BRUSH, scale: 2, spec: 0, emit: 0.6, id: 0.9, uv: false });
  tb.add(P.hemi(24, 10), M(0, 48, tz, 0, 0, 0, 7.5, 9, 7.5), { color: 0x5aa596, layer: LAYER.PATINA, scale: 4, spec: 0.3, emit: 0, id: 0.9, uv: false });
  tb.add(P.cone(12), M(0, 56, tz, 0, 0, 0, 1.2, 9, 1.2), { color: 0xcf9b48, layer: LAYER.METAL, scale: 2, spec: 0.8, emit: 0, id: 0.9, uv: false });

  // street furniture
  const lampAnchors = [];
  for (let zz = 34; zz > -110; zz -= 14) {
    if (Math.abs(zz + 4) < 8) continue;
    for (const s of [-1, 1]) {
      const a = addLampPost(b, s * (4.5 + 0.7), zz + (s > 0 ? 7 : 0), 0);
      for (const p of a) lampAnchors.push({ pos: p, base: 1 });
    }
  }
  for (const wl of X.lamps) lampAnchors.push({ pos: addWallLamp(b, wl.matrix), base: 1 });
  for (let zz = 30; zz > -100; zz -= 5) { if (Math.abs(zz + 4) > 9) { addBollard(b, -4.5 - 0.5, zz + 2.5); } }

  // market stuff near the camera
  stall(b, M(-6.3, CURB_H, 18, 0, Math.PI / 2, 0), r, { w: 2.8, kind: 'fruit' });
  stall(b, M(-6.3, CURB_H, 12, 0, Math.PI / 2, 0), r, { w: 2.6, kind: 'veg' });
  stall(b, M(6.3, CURB_H, 24, 0, -Math.PI / 2, 0), r, { w: 2.8, kind: 'brass' });
  const fs = foodStall(b, M(6.3, CURB_H, 15, 0, -Math.PI / 2, 0), r);
  kiosk(b, M(5.8, CURB_H, 2.5, 0, -Math.PI / 2, 0), r);
  for (let i = 0; i < 5; i++) barrel(b, M(-7.0 + r.range(-0.3, 0.3), CURB_H, 26 + i * 0.8), r);
  for (let i = 0; i < 4; i++) crate(b, M(6.9, CURB_H + (i > 2 ? 0.7 : 0), 8 + (i % 3) * 0.75, 0, r.range(-0.2, 0.2), 0), r);
  sack(b, M(-5.2, CURB_H, 20.5), r); sack(b, M(-5.5, CURB_H, 21.1), r);
  handcart(b, M(2.6, 0, 6, 0, 0.4, 0), r, 'apples');

  addHangingBoards(b, X);
  const geo = b.build();
  const city = new THREE.Mesh(geo, worldMaterial());
  city.layers.enable(LAYER_STATIC_CASTER);
  scene.add(city);
  scene.add(buildSigns(createSignAtlas(), X));
  const gears = new Gears(X.gears);
  scene.add(gears.group);
  const lamps = new Lamps(lampAnchors);
  scene.add(lamps.mesh);
  const sky = createSky({ center: [0, -60] });
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.15, 12000);
  const info = { tris: geo.index.count / 3, lots: lots.length, gears: X.gears.length, lamps: lampAnchors.length, chimneys: X.chimneys.length };
  console.log('styletest', info);

  const shots = [
    { pos: [2.2, 1.7, 30], look: [-1.5, 6.5, -40], fov: 45 },
    { pos: [-3, 1.5, 20], look: [4, 5.5, -10], fov: 50 },
    { pos: [5.5, 9, 4], look: [-8, 4, -30], fov: 50 },
    { pos: [0, 30, 45], look: [0, 6, -40], fov: 50 },
  ];

  return {
    scene, camera, duration: 40, info,
    update(T) {
      const S = T;
      U.uTime.value = S;
      const shot = shots[Math.min(shots.length - 1, Math.floor(T / 10))];
      camera.position.set(...shot.pos);
      camera.lookAt(new THREE.Vector3(...shot.look));
      camera.fov = shot.fov; camera.aspect = engine.width / engine.height; camera.updateProjectionMatrix();
      applyLook(engine, LOOKS.dusk);
      sky.userData.dome.position.copy(camera.position);
      gears.update(S);
      lamps.update(() => 1, camera.position, 8);
      engine.bakeStatic(scene, 'styletest', new THREE.Vector3(0, 0, -30), 110, U.uSunDir.value);
      return { focus: new THREE.Vector3(0, 0, 10), sunDir: U.uSunDir.value, dynShadow: false };
    },
  };
}
