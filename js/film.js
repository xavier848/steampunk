// DAMPFSTADT: assembles the world and drives everything from the film time T.
import * as THREE from 'three';
import { U } from './engine/materials.js';
import { createSky } from './engine/sky.js';
import { applyLook, LOOKS } from './engine/looks.js';
import { buildCity } from './city/city.js';
import { buildClocks, buildFarCity } from './city/landmarks.js';
import { createSignAtlas, buildSigns, addHangingBoards } from './city/signs.js';
import { Lamps } from './city/lamps.js';
import { Gears } from './city/gears.js';
import { addWallLamp } from './city/street.js';
import { GeoBuilder } from './engine/geo.js';
import { worldMaterial } from './engine/materials.js';
import { LAYER_STATIC_CASTER } from './engine/engine.js';
import { buildTimeMap, CHAPTERS, DURATION } from './time.js';
import { buildStory, faceAt } from './story/story.js';
import { buildShots } from './story/shots.js';
import { buildFlyover } from './story/flyover.js';
import { Townsfolk } from './story/townsfolk.js';
import { buildBoy, buildCop, applyPose } from './actors/hero.js';
import { Scarf } from './actors/scarf.js';
import { Crowd } from './actors/crowd.js';
import { Airships, Trams } from './actors/traffic.js';
import { Pigeons, Flocks, Cat, FallingHat } from './actors/animals.js';
import { Particles } from './fx/particles.js';
import { hash01 } from './core/rng.js';
import { clamp, smoothstep } from './core/math.js';
import { noise1 } from './core/rng.js';
import { CITY } from './city/layout.js';

export async function buildFilm(engine) {
  const scene = new THREE.Scene();
  const t0 = performance.now();
  // ---------------------------------------------------------------- world
  const city = buildCity();
  scene.add(city.group);
  const extra = new GeoBuilder();
  addHangingBoards(extra, city.X);
  const lampAnchors = [...city.market.lampAnchors];
  for (const wl of city.X.lamps) lampAnchors.push({ pos: addWallLamp(extra, wl.matrix), base: 1 });
  const extraMesh = new THREE.Mesh(extra.build(), worldMaterial());
  extraMesh.layers.enable(LAYER_STATIC_CASTER);
  scene.add(extraMesh);
  scene.add(buildSigns(createSignAtlas(), city.X));
  const gears = new Gears(city.X.gears);
  scene.add(gears.group);
  const lamps = new Lamps(lampAnchors);
  scene.add(lamps.mesh);
  const clocks = buildClocks(city.landmarks.clocks);
  scene.add(clocks.group);
  const sky = createSky({ center: [0, -100], clouds: 60, ring: [1400, 5200] });
  scene.add(sky);
  scene.add(buildFarCity());

  // ---------------------------------------------------------------- story and actors
  const story = buildStory();
  const A = story.A;
  const TIME = buildTimeMap(story.slowMo);
  const boy = buildBoy(), cop = buildCop();
  scene.add(boy.group, cop.group);
  const scarf = new Scarf();
  scene.add(scarf.mesh);
  const crowd = new Crowd();
  scene.add(crowd.group);
  const folk = new Townsfolk(crowd, story, city.market);
  const airships = new Airships();
  scene.add(airships.group);
  const trams = new Trams(story);
  scene.add(trams.group);
  // pigeons: flocks named by the story events, plus one on the road Emil runs through
  const passZ = (z) => { let s0 = story.A.run0, s1 = story.A.hat; for (let i = 0; i < 40; i++) { const m = (s0 + s1) / 2; if (story.boy.posAt(m).z > z) s0 = m; else s1 = m; } return s0; };
  const flockDefs = story.events.filter((e) => e.type === 'pigeons').map((e) => ({ at: e.at, n: e.n, up: e.s, dir: new THREE.Vector3(0.5, 0, -1) }));
  flockDefs.push({ at: new THREE.Vector3(-1.2, 0, 83), n: 8, up: passZ(86), dir: new THREE.Vector3(-1, 0, -0.3) });
  flockDefs.push({ at: new THREE.Vector3(-8.0, 12.3, -60), n: 5, up: 1e9 }); // on the footbridge roof, stay
  const pigeons = new Pigeons(flockDefs);
  scene.add(pigeons.mesh);
  const flocks = new Flocks([
    { center: new THREE.Vector3(-40, 130, 60), R: 70, n: 26, w: 0.12, phase: 0, scale: 5 },
    { center: new THREE.Vector3(140, 160, -120), R: 90, n: 22, w: -0.1, phase: 2, scale: 5 },
    { center: new THREE.Vector3(10, 70, -150), R: 40, n: 18, w: 0.18, phase: 4, scale: 3.5 },
  ]);
  scene.add(flocks.mesh);
  const cat = new Cat(city.rooftops.catChimney);
  scene.add(cat.group);
  const hatEv = story.events.find((e) => e.type === 'hat');
  const hat = new FallingHat(hatEv.at, hatEv.s);
  scene.add(hat.mesh);
  // ---------------------------------------------------------------- smoke and steam
  const fx = new Particles();
  scene.add(fx.group);
  const wind = new THREE.Vector3(1.1, 0, 0.55);
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
  // the tram funnel and the big airship's funnel (particles keep their birth position)
  fx.add({ follow: (s) => { const x = story.tram.frontAt(s); return new THREE.Vector3(x + 1.5, 5.2, story.tram.z); }, pos: new THREE.Vector3(), interval: 0.18, life: 3.5, size: 0.5, growth: 0.7, speed: 1.2, rise: 0.5, spread: 0.2, wind, range: 200, seed: 5 });
  fx.add({ follow: (s) => airships.big.posAt(s).add(airships.big.dirAt(s).multiplyScalar(-10)).add(new THREE.Vector3(0, 7.5, 0)), pos: new THREE.Vector3(), interval: 0.35, life: 8, size: 1.4, growth: 1.1, speed: 1, rise: 0.6, spread: 0.4, wind, smoke: 0.4, range: 2000, seed: 9 });
  // the hatch: a violent burst when the lid opens, then a steady plume
  const hatchTop = city.rooftops.hatch.clone();
  fx.add({ pos: hatchTop, interval: 0.035, life: 3.2, size: 0.7, growth: 1.8, speed: 10, drag: 1.6, rise: 0.6, spread: 0.9, wind, window: [A.steam, A.steam + 2.2], range: 400, always: true, seed: 3 });
  fx.add({ pos: hatchTop, interval: 0.25, life: 4.5, size: 0.5, growth: 0.8, speed: 1.5, rise: 0.5, spread: 0.3, wind, window: [A.steam + 2.2, 1e9], range: 300, seed: 4 });
  const shots = buildShots(story, TIME, buildFlyover(airships));
  const chapters = [];
  for (const sh of shots) if (!chapters.find((c) => c.n === sh.chapter)) chapters.push({ n: sh.chapter, t: sh.t0, title: (CHAPTERS.find((c) => c.n === sh.chapter) || {}).title || '' });

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.2, 12000);
  const info = { ...city.info, buildMs: Math.round(performance.now() - t0), lamps: lampAnchors.length, gears: city.X.gears.length, people: folk.count, shots: shots.length, end: +shots[shots.length - 1].t1.toFixed(1) };
  console.log('film world', JSON.stringify(info));

  const debugCam = { on: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 45 };
  window.dampfDebugCam = (pos, look, fov = 45) => { debugCam.on = true; debugCam.pos.set(...pos); debugCam.look.set(...look); debugCam.fov = fov; };
  window.dampfDebugCamOff = () => { debugCam.on = false; };

  // clock: 7:00 exactly when the bell starts
  const clockMinutes = (S) => 60 - (A.bell - S) / 60;
  // lamps flicker while the old heart is dying (strongest around the core pulse)
  const lampGlow = (S) => (i, a) => {
    const f = noise1(S * 7.3 + i * 3.1, 5) * 0.5 + 0.5;
    const flick = 0.25 + 0.75 * smoothstep(0.25, 0.55, f);
    const near = smoothstep(4, 0, Math.abs(S - A.pulse)) * 0.8;
    return clamp(1 - near * (1 - flick) - 0.2 * (1 - flick), 0.05, 1.2);
  };
  const shotAt = (T) => { for (const s of shots) if (T < s.t1) return s; return shots[shots.length - 1]; };
  const frameAt = (S) => {
    const st = story.boy.at(S);
    const yaw = st.yaw;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const neck = st.pos.clone().add(new THREE.Vector3(0, 1.17, 0));
    return { neck, fwd, right, up: new THREE.Vector3(0, 1, 0), bodyR: 0.16, wind: new THREE.Vector3(0.7, 0.2, 0.4) };
  };
  const _look = new THREE.Vector3();

  return {
    scene, camera, duration: DURATION, info, chapters, shots, story, TIME,
    update(T) {
      const S = TIME.S(T);
      U.uTime.value = S; U.uFilmTime.value = T;
      applyLook(engine, LOOKS.dusk);
      // ---- camera
      const sh = shotAt(T);
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
      // ---- actors
      const bs = story.boy.at(S);
      applyPose(boy, { ...bs.pose, pos: bs.pos, yaw: bs.yaw });
      boy.setFace(faceAt(story.faces, S, 0.3));
      scarf.update(S, frameAt);
      const cs = story.cop.at(S);
      applyPose(cop, { ...cs.pose, pos: cs.pos, yaw: cs.yaw });
      cop.setFace(faceAt(story.copFaces, S, 1.7));
      folk.update(S, camera.position);
      airships.update(S);
      trams.update(S);
      pigeons.update(S);
      flocks.update(S);
      cat.update(S, bs.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
      hat.update(S);
      fx.update(S, camera);
      // ---- city life
      gears.update(S, camera.position);
      city.updateLOD(camera.position);
      lamps.update(lampGlow(S), camera.position, 8);
      clocks.setTime(clockMinutes(S));
      // ---- shadows: static map per region, dynamic map around the action
      const ch = sh.chapter;
      if (ch === 1) engine.bakeStatic(scene, 'fly', new THREE.Vector3(0, 0, -80), 520, U.uSunDir.value, 1200);
      else if (ch <= 4) engine.bakeStatic(scene, 'street', new THREE.Vector3(0, 0, 40), 125, U.uSunDir.value, 600);
      else engine.bakeStatic(scene, 'roofs', new THREE.Vector3(14, 10, -80), 70, U.uSunDir.value, 600);
      const focus = ch === 1 ? null : bs.pos.clone();
      return { focus, shadowRadius: 16, sunDir: U.uSunDir.value, dynShadow: ch !== 1, camera, shot: sh.name, S };
    },
  };
}
