// DAMPFSTADT: bootstrap, render loop and the deterministic debug interface window.dampf.
import * as THREE from 'three';
import { Engine } from './engine/engine.js';

const params = new URLSearchParams(location.search);
const headless = params.has('headless');
const sceneName = params.get('scene') || 'film';
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);

const canvas = document.getElementById('film');
if (headless) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; document.body.classList.add('headless'); }

let engine = null;
try { engine = new Engine(canvas, { headless, width: W, height: H }); }
catch (e) { window.dampf = { error: String(e && e.stack || e) }; throw e; }
let world = null;

async function loadWorld() {
  if (sceneName === 'stiltest' || sceneName === 'styletest') {
    const { buildStyleTest } = await import('./scenes/styletest.js');
    return buildStyleTest(engine);
  }
  const { buildFilm } = await import('./film.js');
  return buildFilm(engine);
}

function renderAt(T) {
  const info = world.update(T) || {};
  const cam = info.camera || world.camera;
  if (info.dynShadow !== false && info.focus) engine.dynamicShadow(world.scene, info.focus, info.shadowRadius || 22, (info.sunDir || null) || window.__sunDir || new THREE.Vector3(-0.8, 0.2, -0.3).normalize());
  // sun position on screen for light shafts
  const sun = (info.sunDir || null);
  const p = engine.post.params;
  if (sun) {
    const v = cam.position.clone().addScaledVector(sun, 5000).project(cam);
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).dot(sun);
    p.sunScreen = new THREE.Vector3(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, facing);
  } else p.sunScreen = null;
  engine.renderFrame(world.scene, cam);
  return info;
}

const state = { T: +(params.get('t') || 0), playing: false, last: 0 };

window.dampf = {
  ready: false,
  engine,
  get world() { return world; },
  get T() { return state.T; },
  show(t) { state.T = t; state.playing = false; renderAt(t); return t; },
  snap(t, type = 'image/png', q = 0.95) {
    if (t !== undefined) { state.T = t; renderAt(t); }
    return canvas.toDataURL(type, q);
  },
  renderFrames(t0, t1, fps = 30, type = 'image/jpeg', q = 0.92) {
    const out = [];
    for (let t = t0; t < t1 - 1e-6; t += 1 / fps) { renderAt(t); out.push(canvas.toDataURL(type, q)); }
    return out;
  },
  play() { state.playing = true; state.last = performance.now(); },
  pause() { state.playing = false; },
  seek(t) { state.T = t; renderAt(t); },
  profile(t, n = 3) {
    const post = engine.post;
    renderAt(t);
    post.prof = {};
    for (let i = 0; i < n; i++) { post._t = performance.now(); renderAt(t); post._mark('rest'); }
    const out = {};
    for (const k in post.prof) out[k] = +(post.prof[k] / n).toFixed(1);
    post.prof = null;
    return out;
  },
  setQuality({ kuwaScale, kuwaRadius, samples, kuwaQ } = {}) {
    const post = engine.post;
    if (kuwaScale !== undefined) post.params.kuwaScale = kuwaScale;
    if (kuwaRadius !== undefined) post.params.kuwaRadius = kuwaRadius;
    if (kuwaQ !== undefined) post.params.kuwaQ = kuwaQ;
    if (samples !== undefined) { post.rtMain.samples = samples; post.rtMain.dispose(); }
    post.setSize(post.w, post.h, true);
    return post.params;
  },
  stats() {
    const i = engine.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, pixelRatio: engine.pixelRatio, size: [engine.width, engine.height] };
  },
};

async function main() {
  world = await loadWorld();
  window.dampf.duration = world.duration;
  window.dampf.chapters = world.chapters || [];
  window.dampf.shots = world.shots || [];
  renderAt(state.T);
  window.dampf.ready = true;
  if (!headless) {
    window.addEventListener('resize', () => { engine.resize(); renderAt(state.T); });
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (!state.playing) return;
      const dt = Math.min(0.1, (now - state.last) / 1000);
      state.last = now;
      state.T = Math.min(world.duration, state.T + dt);
      const t0 = performance.now();
      renderAt(state.T);
      engine.adapt(performance.now() - t0 + 1);
      if (state.T >= world.duration) state.playing = false;
      if (window.dampfUI) window.dampfUI.tick(state.T);
    };
    requestAnimationFrame(loop);
    const { initUI } = await import('./ui/ui.js').catch(() => ({ initUI: null }));
    if (initUI) window.dampfUI = initUI(window.dampf, state, world, renderAt);
  }
}
main().catch((e) => { console.error(e); window.dampf.error = String(e && e.stack || e); });
