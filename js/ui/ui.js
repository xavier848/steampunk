// Bedienoberfläche (deutsch): Start, Pause, Zeitleiste mit Kapiteln, freie Kamera,
// Ton, Vollbild und Video speichern. Sichtbare Texte ohne Gedankenstriche.
import * as THREE from 'three';
import { Sound } from '../audio/sound.js';

const fmt = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };

export function initUI(dampf, state, world, renderAt) {
  const root = document.getElementById('ui');
  const sound = new Sound(world);
  root.innerHTML = `
    <div id="intro">
      <div class="intro-box">
        <div class="intro-title">DAMPFSTADT</div>
        <div class="intro-sub">Ein Kurzfilm, der in Echtzeit in deinem Browser gemalt wird</div>
        <button id="b-start" class="big">Start</button>
        <div class="intro-hint">Leertaste: Pause &nbsp; F: Vollbild &nbsp; M: Ton &nbsp; K: freie Kamera &nbsp; Pfeiltasten: spulen</div>
      </div>
    </div>
    <div id="chapter-card"></div>
    <div id="bar">
      <button id="b-play" title="Abspielen oder anhalten (Leertaste)">Start</button>
      <div id="time">0:00 / 0:00</div>
      <div id="timeline"><div id="tl-fill"></div><div id="tl-marks"></div><div id="tl-knob"></div><div id="tl-tip"></div></div>
      <select id="chapters" title="Kapitel wählen"></select>
      <button id="b-cam" title="Freie Kamera (K)">Freie Kamera</button>
      <button id="b-sound" title="Ton an oder aus (M)">Ton an</button>
      <button id="b-full" title="Vollbild (F)">Vollbild</button>
      <button id="b-rec" title="Den Film ab der aktuellen Stelle als Video aufnehmen">Video speichern</button>
    </div>
    <div id="cam-help">Freie Kamera: Maus ziehen zum Umsehen, Mausrad oder W und S zum Fliegen, A und D seitwärts, Q und E hoch und runter</div>`;
  const $ = (id) => document.getElementById(id);
  const dur = world.duration;
  const chapters = world.chapters || [];
  // chapter list and marks
  const sel = $('chapters');
  sel.innerHTML = '<option value="">Kapitel</option>' + chapters.map((c) => `<option value="${c.t}">${c.n}  ${c.title}</option>`).join('');
  $('tl-marks').innerHTML = chapters.map((c) => `<div class="mark" style="left:${(c.t / dur) * 100}%" title="${c.n} ${c.title}"></div>`).join('');

  let soundOn = true;
  const play = async () => {
    if (state.T >= dur - 0.05) state.T = 0;
    state.playing = true; state.last = performance.now();
    if (soundOn) { try { await sound.ensure(); sound.start(state.T); } catch (e) { console.warn(e); } }
    update();
  };
  const pause = () => { state.playing = false; sound.stop(); update(); };
  const seek = (t) => {
    state.T = Math.max(0, Math.min(dur, t));
    renderAt(state.T);
    if (state.playing && soundOn) sound.start(state.T);
    update();
  };
  const update = () => {
    $('b-play').textContent = state.playing ? 'Pause' : 'Start';
    $('time').textContent = `${fmt(state.T)} / ${fmt(dur)}`;
    const f = (state.T / dur) * 100;
    $('tl-fill').style.width = f + '%'; $('tl-knob').style.left = f + '%';
    $('b-sound').textContent = soundOn ? 'Ton an' : 'Ton aus';
    $('b-cam').classList.toggle('on', freeCam.on);
    $('b-rec').textContent = rec ? 'Aufnahme beenden' : 'Video speichern';
  };

  // ---- intro
  $('b-start').onclick = async () => { $('intro').classList.add('gone'); await play(); };
  $('b-play').onclick = () => (state.playing ? pause() : play());
  $('b-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  $('b-sound').onclick = async () => { soundOn = !soundOn; sound.setMuted(!soundOn); if (soundOn && state.playing) { await sound.ensure(); sound.start(state.T); } update(); };
  sel.onchange = () => { if (sel.value !== '') seek(+sel.value + 0.01); sel.value = ''; };

  // ---- timeline scrubbing
  const tl = $('timeline');
  const tAt = (ev) => { const r = tl.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * dur; };
  let drag = false;
  tl.addEventListener('pointerdown', (ev) => { drag = true; tl.setPointerCapture(ev.pointerId); seek(tAt(ev)); });
  tl.addEventListener('pointermove', (ev) => {
    const t = tAt(ev);
    const tip = $('tl-tip');
    const ch = [...chapters].reverse().find((c) => c.t <= t);
    tip.textContent = `${fmt(t)}${ch ? '  ' + ch.title : ''}`;
    tip.style.left = Math.max(0, Math.min(100, (t / dur) * 100)) + '%';
    if (drag) seek(t);
  });
  tl.addEventListener('pointerup', () => { drag = false; });

  // ---- chapter card when a new chapter begins while playing
  let lastCh = -1, cardT = -10;
  const card = $('chapter-card');

  // ---- free camera (fly around the frozen or running scene)
  const freeCam = { on: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, keys: {} };
  const toggleCam = () => {
    freeCam.on = !freeCam.on;
    if (freeCam.on) {
      const c = world.camera;
      freeCam.pos.copy(c.position);
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
      freeCam.yaw = Math.atan2(d.x, d.z); freeCam.pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
      applyCam();
    } else window.dampfDebugCamOff();
    $('cam-help').classList.toggle('show', freeCam.on);
    renderAt(state.T); update();
  };
  const applyCam = () => {
    const d = new THREE.Vector3(Math.sin(freeCam.yaw) * Math.cos(freeCam.pitch), Math.sin(freeCam.pitch), Math.cos(freeCam.yaw) * Math.cos(freeCam.pitch));
    const look = freeCam.pos.clone().add(d);
    window.dampfDebugCam(freeCam.pos.toArray(), look.toArray(), 50);
  };
  $('b-cam').onclick = toggleCam;
  const canvas = document.getElementById('film');
  let look = null;
  canvas.addEventListener('pointerdown', (ev) => { if (freeCam.on) { look = [ev.clientX, ev.clientY]; canvas.setPointerCapture(ev.pointerId); } });
  canvas.addEventListener('pointermove', (ev) => {
    if (!freeCam.on || !look) return;
    freeCam.yaw -= (ev.clientX - look[0]) * 0.004; freeCam.pitch = Math.max(-1.45, Math.min(1.45, freeCam.pitch - (ev.clientY - look[1]) * 0.004));
    look = [ev.clientX, ev.clientY]; applyCam(); if (!state.playing) renderAt(state.T);
  });
  canvas.addEventListener('pointerup', () => { look = null; });
  canvas.addEventListener('wheel', (ev) => { if (!freeCam.on) return; ev.preventDefault(); moveCam(-ev.deltaY * 0.02, 0, 0); }, { passive: false });
  const moveCam = (fw, side, up) => {
    const f = new THREE.Vector3(Math.sin(freeCam.yaw) * Math.cos(freeCam.pitch), Math.sin(freeCam.pitch), Math.cos(freeCam.yaw) * Math.cos(freeCam.pitch));
    const r = new THREE.Vector3(Math.cos(freeCam.yaw), 0, -Math.sin(freeCam.yaw));
    freeCam.pos.addScaledVector(f, fw).addScaledVector(r, -side).add(new THREE.Vector3(0, up, 0));
    applyCam(); if (!state.playing) renderAt(state.T);
  };

  // ---- keyboard
  window.addEventListener('keydown', (ev) => {
    if (ev.target && ev.target.tagName === 'SELECT') return;
    const k = ev.key.toLowerCase();
    if (freeCam.on && 'wasdqe'.includes(k) && k.length === 1) { freeCam.keys[k] = true; return; }
    if (k === ' ') { ev.preventDefault(); if ($('intro').classList.contains('gone')) (state.playing ? pause() : play()); else $('b-start').click(); }
    else if (k === 'f') $('b-full').click();
    else if (k === 'm') $('b-sound').click();
    else if (k === 'k') toggleCam();
    else if (k === 'arrowright') seek(state.T + 5);
    else if (k === 'arrowleft') seek(state.T - 5);
  });
  window.addEventListener('keyup', (ev) => { freeCam.keys[ev.key.toLowerCase()] = false; });

  // ---- video recording (MediaRecorder: canvas plus the live soundtrack)
  let rec = null;
  $('b-rec').onclick = async () => {
    if (rec) { rec.stop(); return; }
    const stream = canvas.captureStream(30);
    try {
      await sound.ensure();
      const dest = sound.ctx.createMediaStreamDestination();
      sound.recordTo = dest;
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      if (state.playing && soundOn) sound.start(state.T);
    } catch (e) { /* no audio */ }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) { alert('Dieser Browser kann leider kein Video aufnehmen. Der Film lässt sich mit tools/render.mjs als MP4 rendern.'); return; }
    const chunks = [];
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'Dampfstadt.' + (mime.includes('mp4') ? 'mp4' : 'webm'); a.click();
      rec = null; sound.recordTo = null; pause(); update();
    };
    rec.start(1000);
    if (!state.playing) await play();
    update();
  };

  // ---- auto hide of the bar
  let idle = 0;
  const wake = () => { idle = performance.now(); document.body.classList.remove('idle'); };
  window.addEventListener('pointermove', wake); window.addEventListener('keydown', wake);

  const api = {
    tick(T) {
      // keys held in free camera mode
      if (freeCam.on) {
        const k = freeCam.keys, sp = 0.25;
        if (k.w || k.s || k.a || k.d || k.q || k.e) moveCam((k.w ? sp : 0) - (k.s ? sp : 0), (k.d ? sp : 0) - (k.a ? sp : 0), (k.e ? sp : 0) - (k.q ? sp : 0));
      }
      const ch = [...chapters].reverse().find((c) => c.t <= T + 0.01);
      if (ch && ch.n !== lastCh) {
        if (lastCh !== -1 && ch.n > 1 && state.playing) { card.innerHTML = `<span>Kapitel ${ch.n}</span>${ch.title}`; card.classList.add('show'); cardT = T; }
        lastCh = ch.n;
      }
      if (T - cardT > 3.5) card.classList.remove('show');
      if (state.playing && performance.now() - idle > 3000 && !drag) document.body.classList.add('idle');
      if (!state.playing && T >= dur - 0.01) { sound.stop(); if (rec) rec.stop(); }
      update();
    },
    sound,
  };
  // a render loop tick also when paused, so held keys fly the free camera
  const idleLoop = () => { requestAnimationFrame(idleLoop); if (!state.playing && freeCam.on) api.tick(state.T); };
  requestAnimationFrame(idleLoop);
  update();
  return api;
}
