// DAMPFSTADT: assembles the world and drives everything from the film time T.
import * as THREE from 'three';
import { U, worldMaterial } from './engine/materials.js';
import { createSky } from './engine/sky.js';
import { applyLook, mixLook, LOOKS } from './engine/looks.js';
import { buildCity } from './city/city.js';
import { buildClocks, buildFarCity } from './city/landmarks.js';
import { createSignAtlas, buildSigns, addHangingBoards } from './city/signs.js';
import { Lamps } from './city/lamps.js';
import { Gears } from './city/gears.js';
import { addWallLamp } from './city/street.js';
import { buildUnderworld, animateUnderworld, rampInt, HALL } from './city/underworld.js';
import { GeoBuilder, P, M } from './engine/geo.js';
import { LAYER } from './engine/textures.js';
import { LAYER_STATIC_CASTER, LAYER_DYN_CASTER } from './engine/engine.js';
import { buildTimeMap, CHAPTERS } from './time.js';
import { buildStory, faceAt } from './story/story.js';
import { buildShots } from './story/shots.js';
import { buildFlyover } from './story/flyover.js';
import { Townsfolk } from './story/townsfolk.js';
import { buildBoy, buildCop, applyPose } from './actors/hero.js';
import { Scarf } from './actors/scarf.js';
import { Crowd, GAIT } from './actors/crowd.js';
import { makePerson } from './actors/people.js';
import { Automatons } from './actors/automatons.js';
import { Airships, Trams } from './actors/traffic.js';
import { Pigeons, Flocks, Cat, FallingHat } from './actors/animals.js';
import { Particles } from './fx/particles.js';
import { createTitleTexture, createCreditsTexture } from './fx/titles.js';
import { hash01, noise1, RNG } from './core/rng.js';
import { clamp, smoothstep, pulse, wrapAngle } from './core/math.js';
import { CITY } from './city/layout.js';
import { ROOF } from './city/rooftops.js';
import { PAL } from './city/palette.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function buildFilm(engine) {
  const scene = new THREE.Scene();
  const t0 = performance.now();
  // ---------------------------------------------------------------- city
  const city = buildCity();
  scene.add(city.group);
  const extra = new GeoBuilder();
  addHangingBoards(extra, city.X);
  const lampAnchors = [...city.market.lampAnchors];
  for (const wl of city.X.lamps) lampAnchors.push({ pos: addWallLamp(extra, wl.matrix), base: 1 });
  const extraMesh = new THREE.Mesh(extra.build(), worldMaterial());
  extraMesh.layers.enable(LAYER_STATIC_CASTER);
  const signs = buildSigns(createSignAtlas(), city.X);
  const gears = new Gears(city.X.gears);
  const lamps = new Lamps(lampAnchors);
  const clocks = buildClocks(city.landmarks.clocks);
  const sky = createSky({ center: [0, -100], clouds: 60, ring: [1400, 5200] });
  const farCity = buildFarCity();
  const cityGroup = new THREE.Group();
  cityGroup.add(city.group, extraMesh, signs, gears.group, lamps.mesh, clocks.group);
  scene.add(cityGroup, sky, farCity);
  // ---------------------------------------------------------------- underworld
  const under = buildUnderworld();
  scene.add(under.group);

  // ---------------------------------------------------------------- story and actors
  const story = buildStory();
  const A = story.A;
  const TIME = buildTimeMap(story.slowMo, 0.9, 1.4, A.filmOffset || 0);
  const boy = buildBoy(), cop = buildCop();
  scene.add(boy.group, cop.group);
  const scarf = new Scarf();
  scene.add(scarf.mesh);
  const crowd = new Crowd();
  scene.add(crowd.group);
  const folk = new Townsfolk(crowd, story, city.market);
  const airships = new Airships();
  const trams = new Trams(story);
  const cityLife = new THREE.Group();
  cityLife.add(crowd.group, airships.group, trams.group);
  scene.add(cityLife);
  // pigeons: flocks named by the story events, plus one on the road Emil runs through
  const passZ = (z) => { let s0 = A.run0, s1 = A.hat; for (let i = 0; i < 40; i++) { const m = (s0 + s1) / 2; if (story.boy.posAt(m).z > z) s0 = m; else s1 = m; } return s0; };
  const flockDefs = story.events.filter((e) => e.type === 'pigeons').map((e) => ({ at: e.at, n: e.n, up: e.s, dir: V(0.5, 0, -1) }));
  flockDefs.push({ at: V(-1.2, 0, 83), n: 8, up: passZ(86), dir: V(-1, 0, -0.3) });
  flockDefs.push({ at: V(-8.0, 12.3, -60), n: 5, up: 1e9 });
  const pigeons = new Pigeons(flockDefs);
  const flocks = new Flocks([
    { center: V(-40, 130, 60), R: 70, n: 26, w: 0.12, phase: 0, scale: 5 },
    { center: V(140, 160, -120), R: 90, n: 22, w: -0.1, phase: 2, scale: 5 },
    { center: V(10, 70, -150), R: 40, n: 18, w: 0.18, phase: 4, scale: 3.5 },
  ]);
  const cat = new Cat(city.rooftops.catChimney);
  const cat2 = new Cat(A.seat.clone().add(V(0.02, 0.62, 0.72)));
  cat2.group.rotation.y = -Math.PI / 2 - 0.4;
  const hatEv = story.events.find((e) => e.type === 'hat');
  const hat = new FallingHat(hatEv.at, hatEv.s);
  cityLife.add(pigeons.mesh, flocks.mesh, cat.group, cat2.group, hat.mesh);

  // ---- the hall: workers and automatons
  const hallCrowd = new Crowd({ worker: 56, gent: 1, lady: 1, market: 6, child: 1 });
  scene.add(hallCrowd.group);
  const workers = buildWorkers(hallCrowd, under.X);
  const autoDefs = [story.auto];
  const hr = new RNG(77);
  for (let i = 0; i < 5; i++) {
    const cx = [-44, 18, 30, -8, 52][i], cz = [-110, -120, -230, -250, -180][i], R = hr.range(4, 9), w = hr.range(0.12, 0.2) * (i % 2 ? -1 : 1), ph = hr.range(0, 6);
    autoDefs.push({ scale: 1.1, at: (S) => { const a = ph + S * w; return { pos: V(cx + Math.cos(a) * R, HALL.floor, cz + Math.sin(a) * R), yaw: Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w)), walk: 1, phase: S * 7 + i, gold: S > A.waveS + (i * 0.4), head: 0.4 * Math.sin(S * 0.7 + i) }; } });
  }
  const autos = new Automatons(autoDefs);
  scene.add(autos.group);
  // the brass core the boy carries into the heart
  const coreB = new GeoBuilder();
  coreB.add(P.sphere(16, 12), M(0, 0, 0, 0, 0, 0, 0.058), { color: 0xffb44a, layer: LAYER.BRUSH, scale: 0.2, spec: 0, emit: 5, id: 0.8, uv: false });
  for (let k = 0; k < 3; k++) coreB.add(new THREE.TorusGeometry(0.066, 0.007, 5, 20), M(0, 0, 0, 0, (k / 3) * Math.PI, 0), { color: PAL.brass, layer: LAYER.METAL, scale: 0.3, spec: 0.9, emit: 0, id: 0.81, uv: false });
  const coreProp = new THREE.Mesh(coreB.build(), worldMaterial());
  coreProp.visible = false;
  scene.add(coreProp);

  // ---- the brass hatch lid (hinged on the far side) and the handwheel on the collar
  const lidDir = V(CITY.hatch.x - 14.25, 0, CITY.hatch.z + 111.05).normalize();
  const lidYaw = Math.atan2(lidDir.x, lidDir.z);
  const RL = HALL.shaftR + 0.24;
  const brassM = { color: PAL.brass, layer: LAYER.METAL, scale: 1, spec: 0.9, emit: 0, id: 0.94, uv: false };
  const ironM = { color: 0x3a3434, layer: LAYER.IRON, scale: 1, spec: 0.4, emit: 0, id: 0.95, uv: false };
  const lidPivot = new THREE.Group();
  lidPivot.position.set(CITY.hatch.x + lidDir.x * RL, ROOF.h6 + 1.27, CITY.hatch.z + lidDir.z * RL);
  const lidB = new GeoBuilder();
  lidB.add(P.cyl(32), M(0, 0.05, -RL, 0, 0, 0, RL, 0.1, RL), { color: 0x8a5a36, layer: LAYER.METAL, scale: 1, spec: 0.6, emit: 0, id: 0.93, uv: false });
  lidB.add(new THREE.TorusGeometry(RL - 0.06, 0.05, 6, 32), M(0, 0.1, -RL, Math.PI / 2, 0, 0), brassM);
  lidB.add(P.cyl(16), M(0, 0.16, -RL, 0, 0, 0, 0.26, 0.12, 0.26), brassM);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; lidB.add(P.box(), M(Math.cos(a) * RL * 0.55, 0.11, -RL + Math.sin(a) * RL * 0.55, 0, -a, 0, RL * 0.8, 0.03, 0.06), brassM); }
  lidB.add(P.cyl(10), M(0, 0.05, 0.02, 0, 0, Math.PI / 2, 0.07, 0.6, 0.07), ironM);
  const lidMesh = new THREE.Mesh(lidB.build(), worldMaterial());
  lidMesh.layers.enable(LAYER_DYN_CASTER);
  lidPivot.add(lidMesh);
  const wheelB = new GeoBuilder();
  wheelB.add(new THREE.TorusGeometry(0.3, 0.032, 6, 24), null, brassM);
  for (let k = 0; k < 3; k++) wheelB.add(P.box(), M(0, 0, 0, 0, 0, (k / 3) * Math.PI, 0.6, 0.035, 0.035), brassM);
  wheelB.add(P.cyl(10), M(0, 0, 0.12, Math.PI / 2, 0, 0, 0.05, 0.28, 0.05), ironM);
  const wheel = new THREE.Mesh(wheelB.build(), worldMaterial());
  wheel.position.set(CITY.hatch.x - lidDir.x * (HALL.shaftR + 0.34), ROOF.h6 + 0.98, CITY.hatch.z - lidDir.z * (HALL.shaftR + 0.34));
  cityGroup.add(lidPivot, wheel);

  // ---------------------------------------------------------------- smoke, steam, sparks
  const fx = new Particles();
  scene.add(fx.group);
  const wind = V(1.1, 0, 0.55);
  for (const st of city.landmarks.factory.stacks) {
    fx.add({ pos: st.pos, interval: 0.55, life: 26, size: st.r * 2.4, growth: 1.9, speed: 3.2, rise: 0.55, spread: 0.5, wind: wind.clone().multiplyScalar(2.2), range: 3000, always: true, bright: 1.05, seed: st.seed });
  }
  city.X.chimneys.forEach((c, i) => {
    if (c.far && i % 4 !== 0) return;
    if (!c.far && i % 2 !== 0 && !c.small) return;
    fx.add({ pos: c.pos, interval: c.small ? 0.5 : 0.8, life: c.small ? 3 : 7, size: c.small ? 0.35 : 0.7, growth: c.small ? 0.35 : 0.55, speed: 0.8, rise: 0.35, spread: 0.2, wind, smoke: c.small ? 0 : 0.75, range: c.far ? 700 : 220, seed: c.seed });
  });
  city.X.vents.forEach((v, i) => {
    const period = 4 + hash01(i * 13) * 5, dur = v.big ? 3 : 1.4, off = hash01(i * 7) * 10;
    fx.add({ pos: v.pos, dir: v.dir, interval: v.big ? 0.12 : 0.1, life: v.big ? 5 : 2.2, size: v.big ? 0.9 : 0.25, growth: v.big ? 1.2 : 0.5, speed: v.big ? 5 : 3, rise: 0.4, spread: 0.25, wind, range: v.big ? 900 : 160, seed: i * 31,
      pulse: (s) => { const ph = ((s + off) % period); return ph < dur ? Math.sin((ph / dur) * Math.PI) : 0; } });
  });
  fx.add({ follow: (s) => { const x = story.tram.frontAt(s); return V(x + 1.5, 5.2, story.tram.z); }, pos: V(0, 0, 0), interval: 0.18, life: 3.5, size: 0.5, growth: 0.7, speed: 1.2, rise: 0.5, spread: 0.2, wind, range: 200, seed: 5 });
  fx.add({ follow: (s) => airships.big.posAt(s).add(airships.big.dirAt(s).multiplyScalar(-10)).add(V(0, 7.5, 0)), pos: V(0, 0, 0), interval: 0.35, life: 8, size: 1.4, growth: 1.1, speed: 1, rise: 0.6, spread: 0.4, wind, smoke: 0.4, range: 2000, seed: 9 });
  // the hatch: a violent burst when the lid opens, a thin plume, and the golden column at the end
  const hatchTop = city.rooftops.hatch.clone();
  fx.add({ pos: hatchTop, interval: 0.035, life: 3.2, size: 0.7, growth: 1.8, speed: 10, drag: 1.6, rise: 0.6, spread: 0.9, wind, window: [A.steam, A.steam + 2.2], range: 400, always: true, seed: 3 });
  fx.add({ pos: hatchTop, interval: 0.4, life: 3.5, size: 0.35, growth: 0.5, speed: 1.2, rise: 0.4, spread: 0.2, wind, window: [A.steam + 2.2, A.lookDown - 1], range: 300, seed: 4 });
  fx.add({ pos: hatchTop, interval: 0.07, life: 6, size: 0.9, growth: 1.6, speed: 7, drag: 0.5, rise: 1.2, spread: 0.4, wind, window: [A.city - 1.5, 1e9], range: 900, always: true, bright: 1.25, seed: 13 });
  // shaft and hall: vents in the pipe gallery, the piston vents when the heart wakes, the catwalk valve
  under.X.vents.forEach((v, i) => {
    if (v.heart) fx.add({ pos: v.pos, dir: v.dir, interval: 0.09, life: 3.5, size: 0.8, growth: 1.3, speed: 6, rise: 0.8, spread: 0.3, wind: V(0.2, 0, 0.1), window: [A.wake + 0.2 + i * 0.03, 1e9], range: 400, seed: 300 + i,
      pulse: (s) => (s < A.wake + 3.5 ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(1.1 * s + 4.0 * rampInt(s, A.wake, 3.5) + i * 0.785))) });
    else fx.add({ pos: v.pos, dir: v.dir, interval: 0.12, life: 2.2, size: 0.25, growth: 0.5, speed: 2.4, rise: 0.3, spread: 0.2, wind: V(0.1, 0, 0), range: 60, seed: 400 + i });
  });
  fx.add({ pos: under.X.catValve, dir: under.X.catSide.clone().negate().add(V(0, 0.25, 0)), interval: 0.03, life: 1.8, size: 0.28, growth: 1.3, speed: 7, drag: 1.2, rise: 0.5, spread: 0.35, wind: V(0, 0, 0), window: [A.valve, A.valve + 2.3], range: 120, always: true, seed: 17 });
  under.X.forges.forEach((f, i) => fx.add({ pos: f.clone().add(V(4.3, 26, 0)), interval: 0.6, life: 6, size: 1.0, growth: 1.1, speed: 1.2, rise: 0.4, spread: 0.3, wind: V(0.3, 0, 0.1), smoke: 0.8, range: 400, seed: 500 + i }));
  // sparks: the hook on the chain, the mine cart wheels, the forges, embers over the glow river
  const handPos = (s) => story.boy.posAt(s).add(V(0, 1.78, -0.1));
  const slideAmt = (b) => (b > A.brake && b < A.cartWait ? 1 : b > A.chainEnd - 1.2 && b < A.chainEnd ? 0.9 : (b > A.slide0 && b < A.chainEnd && !(b > A.cartWait && b < A.slide1)) ? 0.3 : 0);
  fx.addSparks({ pos: handPos, rate: 110, life: 0.55, speed: 3.2, spread: 0.9, dir: V(0, 0.5, 0.3), size: 0.045, gravity: 9, window: [A.slide0, A.chainEnd], range: 80, active: (b) => hash01(Math.floor(b * 1000)) < slideAmt(b), seed: 21 });
  fx.addSparks({ pos: (s) => story.tunnelCart.at(s).pos.clone().add(V(-0.6, 0.25, 0.45)), rate: 70, life: 0.4, speed: 3.5, spread: 0.6, dir: V(-1, 0.4, 0), size: 0.04, gravity: 9, window: [A.cartPass - 3, A.cartPass + 3], range: 60, seed: 22 });
  under.X.forges.forEach((f, i) => fx.addSparks({ pos: f, rate: 40, life: 0.8, speed: 3.2, spread: 0.7, dir: V(-1, 0.9, 0), size: 0.05, gravity: 7, range: 160, active: (b) => ((b * 1.3 + i * 0.37) % 1) < 0.22, seed: 30 + i }));
  under.X.embers.forEach((p, i) => fx.addSparks({ pos: p, rate: 5, life: 3.2, speed: 0.5, spread: 1.2, dir: V(0, 1, 0), size: 0.07, gravity: -0.6, drift: 0.3, range: 260, seed: 60 + i }));
  // the light racing up the shaft: golden sparks rising with it
  fx.addSparks({ pos: (s) => V(HALL.chain.x, -80 + (s - A.upShaft) * 30, HALL.chain.z - 0.4), rate: 60, life: 1.2, speed: 1.5, spread: 1.2, dir: V(0, 1, 0), size: 0.07, gravity: -2, window: [A.upShaft, A.upShaft + 3.2], range: 200, seed: 90 });

  // ---------------------------------------------------------------- titles
  const titleTex = createTitleTexture();
  const creditsTex = createCreditsTexture();

  const shots = buildShots(story, TIME, buildFlyover(airships), { airships });
  const chapters = [];
  for (const sh of shots) if (!chapters.find((c) => c.n === sh.chapter)) chapters.push({ n: sh.chapter, t: sh.t0, title: (CHAPTERS.find((c) => c.n === sh.chapter) || {}).title || '' });
  const duration = shots[shots.length - 1].t1 + 1.5;

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.2, 12000);
  const info = { ...city.info, buildMs: Math.round(performance.now() - t0), lamps: lampAnchors.length, gears: city.X.gears.length, people: folk.count, workers: workers.length, shots: shots.length, end: +duration.toFixed(1) };
  console.log('film world', JSON.stringify(info));

  const debugCam = { on: false, pos: V(0, 0, 0), look: V(0, 0, 0), fov: 45 };
  window.dampfDebugCam = (pos, look, fov = 45) => { debugCam.on = true; debugCam.pos.set(...pos); debugCam.look.set(...look); debugCam.fov = fov; };
  window.dampfDebugCamOff = () => { debugCam.on = false; };

  // clock: 7:00 exactly when the bell starts
  const clockMinutes = (S) => 60 - (A.bell - S) / 60;
  const hatchPos = V(CITY.hatch.x, 0, CITY.hatch.z);
  // city lamps: flicker while the old heart is dying, flare up when it runs again
  const lampGlow = (S) => (i, a) => {
    const f = noise1(S * 7.3 + i * 3.1, 5) * 0.5 + 0.5;
    const flick = 0.25 + 0.75 * smoothstep(0.25, 0.55, f);
    const near = smoothstep(4, 0, Math.abs(S - A.pulse)) * 0.8;
    let g = clamp(1 - near * (1 - flick) - 0.2 * (1 - flick), 0.05, 1.2);
    if (S > A.city - 2) {
      const d = Math.hypot(a.pos.x - hatchPos.x, a.pos.z - hatchPos.z);
      const k = smoothstep(0, 1.2, S - (A.city - 1) - d / 45);
      g = g * (1 - k) + (1.45 + 0.1 * Math.sin(S * 3 + i)) * k;
    }
    return g;
  };
  const shotAt = (T) => { for (const s of shots) if (T < s.t1) return s; return shots[shots.length - 1]; };
  const frameAt = (S) => {
    const st = story.boy.at(S);
    const yaw = st.yaw;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    const right = V(Math.cos(yaw), 0, -Math.sin(yaw));
    const neck = st.pos.clone().add(V(0, 1.17, 0));
    // in the shaft the air rushes upwards
    const w = S > A.slide0 && S < A.catLand ? V(0.1, 2.2, 0.1) : V(0.7, 0.2, 0.4);
    return { neck, fwd, right, up: V(0, 1, 0), bodyR: 0.16, wind: w };
  };
  // point lights from a list of lamp anchors (nearest to the focus)
  const setPointLights = (list, focus, glow) => {
    const cand = list.map((l, i) => [l.pos.distanceToSquared(focus), i]).filter(([, i]) => glow(list[i]) > 0.04).sort((a, b) => a[0] - b[0]);
    const k = Math.min(8, cand.length);
    for (let j = 0; j < 8; j++) {
      if (j < k) {
        const l = list[cand[j][1]], g = glow(l);
        U.uPL.value[j].set(l.pos.x, l.pos.y - 0.1, l.pos.z, l.hall ? (l.forge ? 12 : 20) : 7);
        U.uPLC.value[j].set(1.0, 0.7, 0.42, (l.hall ? 1.8 : 1.3) * g);
      } else { U.uPL.value[j].set(0, -9999, 0, 1); U.uPLC.value[j].set(0, 0, 0, 0); }
    }
    U.uPLN.value = k;
  };
  const _hL = V(0, 0, 0), _hR = V(0, 0, 0), _off = V(0, -0.07, 0.03);
  const post = engine.post;

  return {
    scene, camera, duration, info, chapters, shots, story, TIME,
    update(T) {
      const S = TIME.S(T);
      U.uTime.value = S; U.uFilmTime.value = T;
      // ---- camera
      const sh = shotAt(T);
      const ch = sh.chapter;
      let c;
      if (debugCam.on) c = { pos: debugCam.pos.clone(), look: debugCam.look.clone(), fov: debugCam.fov, roll: 0 };
      else c = sh.fn(T, S, sh);
      camera.position.copy(c.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(c.look);
      if (c.roll) camera.rotateZ(c.roll);
      camera.fov = c.fov;
      camera.near = c.near ?? (c.pos.y > 40 ? 1.0 : 0.12);
      camera.aspect = engine.width / engine.height;
      camera.updateProjectionMatrix();
      sky.userData.dome.position.copy(camera.position);
      // ---- where are we: city, shaft or hall
      const cy = camera.position.y;
      const region = cy < -79 ? 'hall' : cy < -1.5 ? 'shaft' : 'city';
      const nearHatch = Math.hypot(camera.position.x - hatchPos.x, camera.position.z - hatchPos.z) < 40;
      cityGroup.visible = region === 'city' || (region === 'shaft' && cy > -12);
      cityLife.visible = region === 'city';
      farCity.visible = region === 'city';
      sky.visible = region !== 'hall';
      under.group.visible = region !== 'city' || (ch >= 6 && nearHatch && !sh.blank);
      hallCrowd.group.visible = autos.group.visible = region === 'hall';
      const blank = !!sh.blank;
      for (const o of [cityGroup, cityLife, farCity, sky, under.group, boy.group, cop.group, scarf.mesh, fx.group, hallCrowd.group, autos.group, coreProp]) if (blank) o.visible = false;
      if (!blank) { boy.group.visible = scarf.mesh.visible = fx.group.visible = true; cop.group.visible = region === 'city'; }
      // ---- the heart
      const awake = smoothstep(A.wake, A.wake + 3.5, S);
      const awakeInt = rampInt(S, A.wake, 3.5);
      const waveR = S > A.waveS ? (S - A.waveS) * 42 : -1;
      // ---- look
      let look;
      const epi = smoothstep(A.city - 1, A.city + 8, S);
      if (region === 'hall') look = mixLook(LOOKS.hall, LOOKS.hallAwake, awake);
      else if (region === 'shaft') look = mixLook(LOOKS.shaft, LOOKS.hallAwake, 0.6 * smoothstep(A.upShaft, A.upShaft + 2, S));
      else look = epi > 0 ? mixLook(LOOKS.dusk, LOOKS.night, epi) : LOOKS.dusk;
      applyLook(engine, look);
      U.uWindowGlow.value = region === 'city' ? 0.55 + 0.45 * epi : 1;
      // ---- actors
      const bs = story.boy.at(S);
      applyPose(boy, { ...bs.pose, pos: bs.pos, yaw: bs.yaw });
      boy.setFace(faceAt(story.faces, S, 0.3));
      scarf.update(S, frameAt);
      const cs = story.cop.at(S);
      applyPose(cop, { ...cs.pose, pos: cs.pos, yaw: cs.yaw });
      cop.setFace(faceAt(story.copFaces, S, 1.7));
      // the core: glows, pulses at story beats, leaves the satchel and goes into the socket
      const corePulse = Math.max(pulse(S, A.pulse, 0.6), pulse(S, A.glow + 0.3, 1.0), pulse(S, A.autoPulse, 0.5));
      boy.mat.uniforms.uGlow.value = 1 + 1.6 * corePulse;
      boy.mat.uniforms.uCoreHide.value = S >= A.coreOut ? 1 : 0;
      coreProp.visible = !blank && S >= A.coreOut && region !== 'city';
      if (coreProp.visible) {
        if (S < A.click) {
          boy.bones.L_hand.updateWorldMatrix(true, false); boy.bones.R_hand.updateWorldMatrix(true, false);
          _hL.copy(_off).applyMatrix4(boy.bones.L_hand.matrixWorld); _hR.copy(_off).applyMatrix4(boy.bones.R_hand.matrixWorld);
          const k = smoothstep(A.coreOut, A.coreOut + 0.8, S);
          coreProp.position.copy(S < A.hold ? _hR : _hL.lerp(_hR, 0.5).lerp(_hR, 0.5 * (1 - k)));
          if (S > A.insert) coreProp.position.lerp(HALL.socket, smoothstep(A.click - 0.5, A.click, S));
        } else coreProp.position.copy(HALL.socket).addScaledVector(HALL.sockDir, -0.05);
        const cg = S < A.click ? 1.2 + 0.5 * smoothstep(A.hold, A.insert, S) : 1.6 + 2.5 * pulse(S, A.wake, 0.6);
        coreProp.scale.setScalar(S > A.click ? 1.15 : 1.0);
        coreProp.rotation.set(S * 0.7, S * 1.1, 0);
        U.uEmissiveBoost.value = 1;
        coreProp.userData.glow = cg;
      }
      // the dynamic shadow follows Emil (or the constable), people near it cast shadows
      let focus = null;
      if (!blank && ch !== 1) {
        if (sh.focus === 'cop') focus = cs.pos.clone();
        else if (sh.focus !== 'none') focus = bs.pos.clone();
      }
      const shadowRadius = region === 'hall' ? 20 : 16;
      // hatch: the wheel turns while Emil works it, then the lid bursts open
      {
        const lt = S - (A.lid + 0.15);
        const open = lt <= 0 ? 0 : lt < 0.35 ? 1.95 * Math.pow(lt / 0.35, 0.6) : 1.95 + 0.18 * Math.sin((lt - 0.35) * 13) * Math.exp(-(lt - 0.35) * 4.5);
        lidPivot.rotation.set(open, lidYaw, 0, 'YXZ');
        wheel.rotation.set(0, lidYaw, clamp(S - A.wheel - 0.3, 0, A.lid - A.wheel) * 2.4, 'YXZ');
      }
      if (region === 'city') {
        folk.update(S, camera, focus, shadowRadius + 2);
        airships.update(S);
        trams.update(S);
        pigeons.update(S);
        flocks.update(S);
        cat.update(S, bs.pos.clone().add(V(0, 1.2, 0)));
        cat2.group.visible = S > A.city + 20;
        if (cat2.group.visible) cat2.update(S, bs.pos.clone().add(V(0, 1.25, 0)));
        hat.update(S);
        gears.update(S, camera.position);
        city.updateLOD(camera.position);
        lamps.update(lampGlow(S), camera.position, 8);
        clocks.setTime(clockMinutes(S));
      } else if (cityGroup.visible) {
        city.updateLOD(camera.position);
        lamps.update(lampGlow(S), camera.position, 0);
      }
      if (under.group.visible) {
        animateUnderworld(under, S, { awake, awakeInt });
        under.chain.update(S, null);
        const tc = story.tunnelCart.at(S);
        under.tunnelCart.visible = tc.visible;
        under.tunnelCart.position.copy(tc.pos); under.tunnelCart.rotation.y = tc.yaw;
        const w = under.wave;
        w.visible = waveR > 0 && waveR < 260;
        if (w.visible) { w.scale.setScalar(Math.max(0.1, waveR)); w.material.uniforms.uWave.value = (1 - smoothstep(60, 240, waveR)) * 0.9; }
        under.beams.userData.material.uniforms.uBeam.value = region === 'hall' ? 0.8 + 0.4 * awake : 0;
      }
      if (region === 'hall') {
        updateWorkers(workers, hallCrowd, S, A, awake, camera, focus, shadowRadius + 2);
        autos.update(S);
      }
      fx.update(S, camera);
      // ---- local lights
      const focusPt = (sh.focus === 'none' || sh.focus === 'cop') ? camera.position : bs.pos;
      if (region !== 'city') {
        const flick = 0.5 + 0.5 * smoothstep(0.3, 0.6, noise1(S * 5.1, 9) * 0.5 + 0.5);
        const upLit = (l) => (S > A.upShaft && l.pos.y < -80 + (S - A.upShaft) * 30 ? 1.8 : 0);
        setPointLights(under.X.lamps, focusPt, (l) => {
          if (l.shaft) return Math.max(upLit(l), 1);
          const lit = waveR > l.dHeart ? 1.25 : (l.base ?? 0.35) * (awake > 0 ? 1 : flick);
          return Math.max(lit, l.forge ? 0.9 : 0);
        });
        // the heart and the core are lights too once awake
        if (region === 'hall' && S > A.coreOut - 0.5) {
          const j = Math.min(7, U.uPLN.value);
          const cp = S < A.click ? coreProp.position : HALL.socket;
          U.uPL.value[j].set(cp.x + HALL.sockDir.x * 0.6, cp.y, cp.z + HALL.sockDir.z * 0.6, S > A.wake ? 14 : 3.5);
          U.uPLC.value[j].set(1.0, 0.72, 0.35, S > A.wake ? 1.5 + 1.0 * pulse(S, A.wake, 0.8) : 0.7);
          U.uPLN.value = j + 1;
        }
      }
      // ---- titles and fades
      let fade = 1;
      if (T < 2.5) fade = smoothstep(0, 2.5, T);
      if (sh.fadeOut) fade = Math.min(fade, 1 - smoothstep(sh.t1 - sh.fadeOut, sh.t1, T));
      if (blank) fade = 0;
      post.mComp.uniforms.uFade.value = fade;
      const cu = post.mComp.uniforms;
      if (sh.title) {
        const u = (T - sh.t0) / (sh.t1 - sh.t0);
        cu.tTitle.value = titleTex;
        const w = 0.72, h = w * (512 / 2048) * (engine.width / engine.height);
        cu.uTitleRect.value.set(0.5 - w / 2, 0.5 - h * 0.3, w, h);
        cu.uTitleOpacity.value = smoothstep(0.08, 0.25, u) * (1 - smoothstep(0.8, 0.96, u));
      } else if (sh.credits) {
        const u = clamp((T - sh.t0) / (sh.t1 - sh.t0 - 1.0));
        cu.tTitle.value = creditsTex;
        const w = 0.5, h = w * 4 * (engine.width / engine.height), used = creditsTex.userData.used * h;
        // scroll: the used part of the sheet moves from below the frame to above it
        // scroll until the last line ('Ende') rests in the middle of the frame
        cu.uTitleRect.value.set(0.5 - w / 2, -h + clamp(u / 0.9) * (0.45 + used), w, h);
        cu.uTitleOpacity.value = 1;
        post.mComp.uniforms.uFade.value = 0;
      } else cu.uTitleOpacity.value = 0;
      // ---- shadows: static map per region, dynamic map around the action
      const sun = U.uSunDir.value;
      if (region === 'hall') engine.bakeStatic(scene, 'hall', V(0, -120, -175), 150, sun, 500);
      else if (region === 'shaft') { U.uShadowSOn.value = 0; engine.shadowS.key = null; }
      else if (ch === 1 || sh.bake === 'fly' || (ch === 9 && camera.position.y > 30)) engine.bakeStatic(scene, 'fly', V(0, 0, -80), 520, sun, 1200);
      else if (ch <= 4 || (ch === 9 && camera.position.z > -60)) engine.bakeStatic(scene, epi > 0 ? 'streetN' : 'street', V(0, 0, 40), 125, sun, 600);
      else engine.bakeStatic(scene, epi > 0 ? 'roofsN' : 'roofs', V(14, 10, -80), 70, sun, 600);
      if (!focus) U.uShadowDOn.value = 0;
      return { focus, shadowRadius, sunDir: region === 'city' ? sun : null, dynShadow: !!focus, camera, shot: sh.name, S, region };
    },
  };
}

// ------------------------------------------------------------------ hall workers
function buildWorkers(crowd, X) {
  const r = new RNG(4242);
  const list = [];
  const add = (spec, kind = 'worker') => { const p = crowd.add(makePerson(r, kind)); if (!p) return; Object.assign(p, spec); p.phase0 = r.next(); list.push(p); };
  const F = HALL.floor, hc = HALL.heart;
  // smiths at the forges (hammering), porters along the conveyors, watchers at the glow river
  X.forges.forEach((f, i) => {
    for (let k = 0; k < 2; k++) add({ type: 'stand', x: f.x - 2.2 - k * 1.3, z: f.z + (k ? 2.2 : -1.2), yaw: Math.PI / 2 + (k ? 0.6 : -0.3), gait: GAIT.haggle });
  });
  for (let i = 0; i < 10; i++) add({ type: 'walk', x: 55, za: HALL.z0 - 20 - i * 18, len: r.range(20, 40), speed: r.range(0.8, 1.1), carry: true });
  for (let i = 0; i < 8; i++) { const side = i % 2 ? HALL.channel.x0 - 2.2 : HALL.channel.x1 + 2.2; add({ type: 'stand', x: side, z: HALL.z0 - 14 - i * 11, yaw: i % 2 ? Math.PI / 2 : -Math.PI / 2, gait: r.chance(0.5) ? GAIT.talk : GAIT.stand }); }
  for (let i = 0; i < 10; i++) add({ type: 'walk', x: r.range(-60, 30), za: r.range(HALL.z1 + 20, HALL.z0 - 60), len: r.range(25, 60), speed: r.range(0.9, 1.3), axisX: r.chance(0.4) });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.2; add({ type: 'stand', x: hc.x + Math.cos(a) * 19.2, z: hc.z + Math.sin(a) * 19.2, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), gait: GAIT.stand, watcher: true }, r.chance(0.3) ? 'market' : 'worker'); }
  for (const p of list) p.y = F;
  return list;
}
function updateWorkers(list, crowd, S, A, awake, camera, focus, radius) {
  const hc = HALL.heart;
  for (const p of list) {
    let x = p.x, z = p.z, yaw = p.yaw, gait = p.gait, phase = p.phase0 + S * 0.8;
    if (p.type === 'walk') {
      const d = S * p.speed + p.phase0 * 50, k = Math.floor(d / p.len), f = d - k * p.len, fwd = k % 2 === 0;
      if (p.axisX) { x = p.x + (fwd ? f : p.len - f); z = p.za; yaw = (fwd ? Math.PI / 2 : -Math.PI / 2) + smoothstep(p.len - 0.9, p.len, f) * Math.PI; }
      else { x = p.x; z = p.za - (fwd ? f : p.len - f); yaw = (fwd ? Math.PI : 0) + smoothstep(p.len - 0.9, p.len, f) * Math.PI; }
      gait = p.carry ? GAIT.carry : GAIT.walk; phase = p.phase0 + d * 0.9;
    }
    // when the heart wakes everybody stops and looks up at it, some throw up their arms
    let headYaw = 0, headPitch = 0, startle = 0;
    const lookK = smoothstep(A.wake + 0.5, A.wake + 2.0, S) * (1 - smoothstep(A.wake + 22, A.wake + 26, S));
    const watchK = p.watcher ? Math.max(lookK, 0.6) : lookK;
    if (watchK > 0) {
      const want = wrapAngle(Math.atan2(hc.x - x, hc.z - z) - yaw);
      headYaw = Math.max(-1.1, Math.min(1.1, want)) * watchK;
      headPitch = -0.55 * watchK;
      if (lookK > 0.5 && gait === GAIT.walk) gait = GAIT.stand;
      startle = lookK * (hash01(Math.floor(p.phase0 * 1000)) < 0.5 ? pulse(S, A.waveS + 1.5 + p.phase0 * 2, 1.4) : 0);
    }
    crowd.set(p, x, p.y, z, yaw, phase, gait, 1, startle, headYaw, headPitch, 0);
  }
  crowd.commit(camera, focus, radius);
}
