// Procedural sound for DAMPFSTADT: score, effects and ambience are synthesised with the
// Web Audio API from a list of timed events (film time). The same list drives live
// playback (scheduled a little ahead) and the deterministic offline render for the
// video export (rendered in chunks with a pre-roll so reverb tails and long sounds
// continue across chunk borders).
import { RNG, hash01 } from '../core/rng.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
// chord symbol -> midi notes around a register
function chord(sym, base = 50) {
  const m = sym.match(/^([A-G][#b]?)(m?)(7|9|sus)?$/);
  const root = NOTE[m[1]], minor = m[2] === 'm';
  let r = base + ((root - base) % 12 + 12) % 12;
  const iv = minor ? [0, 3, 7] : [0, 4, 7];
  if (m[3] === '7') iv.push(minor ? 10 : 10);
  if (m[3] === '9') iv.push(14);
  if (m[3] === 'sus') iv[1] = 5;
  return { root: r, notes: iv.map((i) => r + i) };
}
const MAXLEN = 12;           // longest single event (s); chunks get this much pre-roll

// ------------------------------------------------------------------ the score
// Emil's theme (beats) in D major, and a minor variant
const THEME = [[74, 1], [78, 0.5], [81, 0.5], [83, 1], [81, 1], [78, 1], [76, 0.5], [74, 0.5], [76, 2],
  [78, 1], [81, 0.5], [86, 0.5], [85, 1], [83, 1], [81, 1], [78, 0.5], [76, 0.5], [74, 2]];
const THEME_MIN = THEME.map(([n, d]) => [n === 78 ? 77 : n === 83 ? 82 : n === 85 ? 84 : n, d]);

function buildScore(W) {
  const A = W.A, T = W.T, ev = [];
  const note = (t, inst, midi, dur, vel = 0.5, extra = {}) => ev.push({ t, type: 'note', inst, midi, dur, vel, ...extra });
  const r = new RNG(2024);
  // a section: chords per bar, bpm, instrument patterns
  const section = (t0, t1, { bpm, chords, bar = 4, pad = 0, bass = 0, arp = 0, pluck = 0, box = 0, drums = 0, tick = 0, stab = 0, choir = 0, theme = null, themeInst = 'box', themeOct = 0, fadeIn = 0, fadeOut = 0 }) => {
    const beat = 60 / bpm;
    const barLen = beat * bar;
    const nBars = Math.floor((t1 - t0) / barLen + 1e-6);
    const g = (t) => Math.min(1, fadeIn ? (t - t0) / fadeIn : 1, fadeOut ? (t1 - t) / fadeOut : 1);
    for (let b = 0; b < nBars; b++) {
      const tb = t0 + b * barLen;
      const c = chord(chords[b % chords.length], 50);
      const gv = g(tb);
      if (pad) for (const n of c.notes) note(tb, 'pad', n, barLen * 1.02, pad * gv);
      if (choir) for (const n of c.notes) note(tb, 'choir', n + 12, barLen * 1.02, choir * gv);
      if (bass) {
        if (bass > 0.6) for (let k = 0; k < bar * 2; k++) note(tb + k * beat / 2, 'bass', c.root - 12 + (k % 4 === 3 ? 7 : 0), beat * 0.45, bass * gv * (k % 2 ? 0.7 : 1));
        else note(tb, 'bassLong', c.root - 12, barLen, bass * gv);
      }
      if (arp) for (let k = 0; k < bar * 2; k++) { const n = c.notes[(k + b) % c.notes.length] + 12 + (k >= bar ? 12 : 0); note(tb + k * beat / 2, 'pluck', n, beat * 0.9, arp * gv * (0.8 + 0.2 * hash01(k + b * 7))); }
      if (pluck) for (let k = 0; k < bar; k++) if (k % 2 === 0 || hash01(b * 13 + k) > 0.5) note(tb + k * beat, 'pluck', c.notes[k % 3] + 12, beat * 0.8, pluck * gv);
      if (box) for (let k = 0; k < bar; k++) if (hash01(b * 31 + k) > 0.35) note(tb + k * beat + (hash01(b * 3 + k) > 0.7 ? beat / 2 : 0), 'box', c.notes[(k * 2 + b) % 3] + 24, 1.6, box * gv);
      if (stab) for (let k = 0; k < bar; k++) if (k % 2 === 1) for (const n of c.notes) note(tb + k * beat + beat / 2, 'stab', n + 12, beat * 0.3, stab * gv);
      if (drums) for (let k = 0; k < bar * 4; k++) {
        const tt = tb + k * beat / 4;
        if (k % 8 === 0) ev.push({ t: tt, type: 'drum', kind: 'kick', vel: drums * gv });
        if (k % 8 === 4) ev.push({ t: tt, type: 'drum', kind: 'snare', vel: drums * 0.7 * gv });
        if (k % 2 === 0) ev.push({ t: tt, type: 'drum', kind: 'hat', vel: drums * (k % 4 === 2 ? 0.5 : 0.3) * gv });
      }
      if (tick) for (let k = 0; k < bar; k++) ev.push({ t: tb + k * beat, type: 'drum', kind: 'tick', vel: tick * gv * (k === 0 ? 1 : 0.6) });
    }
    if (theme) { let tt = t0 + (theme.at || 0) * beat; const rep = theme.rep || 1; for (let q = 0; q < rep; q++) for (const [n, d] of theme.notes) { if (tt > t1 - 0.3) break; note(tt, themeInst, n + themeOct, d * beat * 1.05, (theme.vel || 0.5) * g(tt)); tt += d * beat; } }
  };
  // ---- 1 the flight
  const tTitle = W.shotT('1.3');
  section(0.5, tTitle.t0, { bpm: 66, chords: ['D', 'Bm', 'G', 'A'], pad: 0.22, bassLong: 0, bass: 0.25, box: 0.12, fadeIn: 6 });
  section(tTitle.t0, W.chapter(2) - 0.5, { bpm: 66, chords: ['D', 'G', 'Bm', 'A', 'G', 'D', 'A', 'D'], pad: 0.28, bass: 0.3, choir: 0.1, theme: { notes: THEME, vel: 0.42 }, themeInst: 'brassSoft', themeOct: -12, fadeOut: 3 });
  ev.push({ t: tTitle.t0 + 1.8, type: 'hit', vel: 0.55 });
  // ---- 2 the market street: playful
  section(W.chapter(2), T(A.halt), { bpm: 100, chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'A'], pad: 0.08, bass: 0.35, pluck: 0.22, box: 0.1, theme: { notes: THEME, vel: 0.3, at: 16 }, themeInst: 'box', fadeIn: 2, fadeOut: 1 });
  // ---- 3 the chase (and the hiding place, and the tram)
  section(T(A.run0) - 0.1, T(A.hide), { bpm: 138, chords: ['Bm', 'G', 'A', 'F#'], bass: 0.8, stab: 0.16, drums: 0.5, theme: { notes: THEME_MIN, vel: 0.35, rep: 3 }, themeInst: 'brass', themeOct: -12 });
  ev.push({ t: T(A.run0) - 0.1, type: 'hit', vel: 0.6 });
  section(T(A.hide), T(A.bolt), { bpm: 60, chords: ['Bm', 'Bm', 'G', 'F#'], pad: 0.14, tick: 0.35, bass: 0.2 });
  section(T(A.bolt), T(A.across) + 0.5, { bpm: 144, chords: ['Bm', 'G', 'A', 'F#'], bass: 0.85, stab: 0.2, drums: 0.6 });
  section(T(A.across) + 0.5, T(A.crates), { bpm: 100, chords: ['D', 'A', 'G', 'D'], pluck: 0.25, bass: 0.3, box: 0.15, fadeIn: 0.5 });
  // ---- 4 the ladder: climbing, then the golden light on the roof
  section(T(A.crates), T(A.onRoof), { bpm: 96, chords: ['G', 'A', 'Bm', 'A', 'G', 'A', 'F#m', 'A'], arp: 0.2, pad: 0.12, bass: 0.25, fadeIn: 2 });
  section(T(A.onRoof), T(A.roofRun), { bpm: 70, chords: ['D9', 'G'], pad: 0.3, choir: 0.16, box: 0.15, bass: 0.3 });
  ev.push({ t: T(A.onRoof), type: 'hit', vel: 0.4, soft: true });
  // ---- 5 over the roofs: adventure
  section(T(A.roofRun), T(A.alleyJump) - 1.2, { bpm: 120, chords: ['G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'A'], bass: 0.7, arp: 0.18, drums: 0.35, theme: { notes: THEME, vel: 0.45, rep: 2 }, themeInst: 'brass', themeOct: -12 });
  section(T(A.alleyJump) - 1.2, T(A.alleyLand) + 0.2, { bpm: 60, chords: ['Asus'], pad: 0.3, choir: 0.2 });
  section(T(A.alleyLand) + 0.2, T(A.toHatch), { bpm: 100, chords: ['D', 'G', 'A', 'D'], pluck: 0.2, bass: 0.3, fadeOut: 2 });
  ev.push({ t: T(A.alleyLand), type: 'hit', vel: 0.5 });
  // ---- 6 the hatch: mystery, the clock strikes seven
  section(T(A.toHatch), T(A.chain0), { bpm: 56, chords: ['Dm', 'Bb', 'Gm', 'A'], pad: 0.16, bass: 0.22, tick: 0.12, box: 0.06, fadeIn: 3 });
  // ---- 7 the shaft: falling
  section(T(A.chain0), T(A.breakthrough), { bpm: 150, chords: ['Dm', 'Bb', 'C', 'A'], arp: 0.24, bass: 0.8, drums: 0.4, stab: 0.12 });
  section(T(A.breakthrough), T(A.catLand) + 1, { bpm: 60, chords: ['Bb', 'F'], pad: 0.34, choir: 0.24, bass: 0.35 });
  ev.push({ t: T(A.breakthrough) + 0.2, type: 'hit', vel: 0.6 });
  // ---- 8 the machine hall
  section(T(A.catLand) + 1, T(A.meet), { bpm: 84, chords: ['F', 'Dm', 'Bb', 'C'], pad: 0.2, choir: 0.12, bass: 0.35, tick: 0.15, fadeIn: 2 });
  section(T(A.meet), T(A.pass) + 3, { bpm: 92, chords: ['F', 'C', 'Bb', 'C'], box: 0.18, pad: 0.1, theme: { notes: THEME, vel: 0.3, at: 4 }, themeInst: 'box', themeOct: -2 });
  section(T(A.pass) + 3, T(A.heart0), { bpm: 112, chords: ['Dm', 'Bb', 'C', 'A'], arp: 0.2, bass: 0.6, drums: 0.3, fadeOut: 3 });
  // ---- 9 the heart
  section(T(A.heart0), T(A.take), { bpm: 50, chords: ['Dm', 'Gm', 'Dm', 'A'], pad: 0.18, bass: 0.2, fadeIn: 3 });
  section(T(A.take), T(A.click), { bpm: 64, chords: ['D', 'Bm', 'G', 'A'], box: 0.2, pad: 0.12, theme: { notes: THEME, vel: 0.35 }, themeInst: 'box' });
  section(T(A.wake), T(A.city), { bpm: 90, chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'], pad: 0.3, choir: 0.22, bass: 0.8, arp: 0.18, drums: 0.45, theme: { notes: THEME, vel: 0.55, rep: 2 }, themeInst: 'brass', themeOct: -12 });
  ev.push({ t: T(A.wake), type: 'hit', vel: 1.0 });
  // ---- epilogue and credits
  const tEnd = W.duration;
  section(T(A.city), T(A.epilogueEnd), { bpm: 76, chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D'], pad: 0.24, bass: 0.3, choir: 0.1, box: 0.1, theme: { notes: THEME, vel: 0.4, rep: 2, at: 4 }, themeInst: 'box', fadeOut: 4 });
  section(T(A.epilogueEnd) - 1, tEnd - 1, { bpm: 72, bar: 3, chords: ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D'], pad: 0.18, bass: 0.25, pluck: 0.14, theme: { notes: THEME, vel: 0.35, rep: 3 }, themeInst: 'box', fadeIn: 3, fadeOut: 6 });
  return ev;
}

// ------------------------------------------------------------------ effects from the story
function buildEffects(W) {
  const A = W.A, T = W.T, ev = [];
  const fx = (s, type, extra = {}) => ev.push({ t: T(s), type, ...extra });
  for (const e of W.events) {
    const s = e.s;
    switch (e.type) {
      case 'whistle': fx(s, 'whistle', { dur: e.dur || 1.5 }); break;
      case 'pigeons': fx(s, 'flutter', { dur: 1.4 }); break;
      case 'hat': fx(s, 'thud', { vel: 0.4 }); break;
      case 'jump': fx(s, 'whoosh', { vel: e.big ? 0.7 : 0.4 }); break;
      case 'land': fx(s, e.metal ? 'clang' : 'thud', { vel: e.big ? 0.8 : 0.55 }); break;
      case 'slide': fx(s, e.dur ? 'chainSlide' : 'scrape', { dur: e.dur || 0.9, open: !!e.open }); break;
      case 'crate': fx(s, 'knock', { vel: 0.6 }); break;
      case 'rung': fx(s, 'tink', { vel: 0.25 }); break;
      case 'creak': fx(s, 'creak'); break;
      case 'tramBell': fx(s, 'tramBell'); break;
      case 'tram': fx(s, 'rumble', { dur: e.dur || 6 }); break;
      case 'corePulse': case 'coreFlare': case 'coreOut': fx(s, 'shimmer', { vel: e.type === 'coreFlare' ? 0.8 : 0.5 }); break;
      case 'airship': fx(s, 'horn'); break;
      case 'wheel': fx(s, 'ratchet', { dur: e.dur || 4 }); break;
      case 'hatchOpen': fx(s, 'clang', { vel: 0.9 }); break;
      case 'steamBurst': fx(s, 'hiss', { dur: 3.2, vel: 1 }); break;
      case 'bell': fx(s, 'bell', { vel: 0.9 }); break;
      case 'chainGrab': fx(s, 'rattle', { dur: 0.8 }); break;
      case 'brake': fx(s, 'screech', { dur: e.dur || 1.5 }); break;
      case 'cart': fx(s, 'cart', { dur: e.dur || 2 }); break;
      case 'valve': fx(s, 'hiss', { dur: e.dur || 2, vel: 0.8 }); break;
      case 'beep': fx(s, 'beep'); break;
      case 'autoGold': fx(s, 'chime'); break;
      case 'heartbeat': for (let k = 0; k * 1.6 < (e.dur || 10); k++) fx(s + k * (1.5 + 0.1 * k), 'heartbeat', { vel: 0.35 + 0.02 * k }); break;
      case 'click': fx(s, 'click'); break;
      case 'wake': fx(s, 'boom', { vel: 1 }); fx(s + 0.3, 'hiss', { dur: 4, vel: 0.7 }); for (let k = 0; k < 10; k++) fx(s + 0.5 + k * 0.8, 'heartbeat', { vel: 0.8, fast: true }); break;
      case 'wave': fx(s, 'whooshBig'); break;
      case 'cheer': fx(s, 'cheer', { dur: 4 }); break;
      case 'rush': fx(s, 'whooshBig', { up: true }); break;
      case 'cityGlow': fx(s, 'chime', { big: true }); fx(s + 0.4, 'bell', { vel: 0.5 }); break;
      default: break;
    }
  }
  // footsteps from the tracks (steps at every stride; surface from the height)
  for (const [track, who] of [[W.boy, 'boy'], [W.cop, 'cop']]) {
    for (const seg of track.segs) {
      if (seg.type !== 'path' || seg.gait === 'stand') continue;
      const stride = seg.gait === 'run' ? track.stride : seg.gait === 'jog' ? (track.stride + track.walkStride) / 2 : track.walkStride;
      const first = Math.ceil(seg.d0 / stride) * stride;
      for (let d = first; d < seg.d0 + seg.len; d += stride) {
        const s = seg.s0 + ((d - seg.d0) / seg.len) * (seg.s1 - seg.s0);
        const p = seg.path.pointAt(d - seg.d0);
        const surf = p.y < -100 ? 'metal' : p.y > 8 ? 'roof' : 'cobble';
        ev.push({ t: T(s), type: 'step', surf, who, vel: (seg.gait === 'run' ? 0.5 : 0.3) * (who === 'cop' ? 0.8 : 1), heavy: who === 'cop' });
      }
    }
  }
  // ambience beds (overlapping grains, so they survive seeking and chunked rendering)
  const bed = (t0, t1, kind, vel) => { for (let t = t0; t < t1; t += 2.5) ev.push({ t, type: 'bed', kind, dur: 4.2, vel: vel * Math.min(1, (t - t0) / 2 + 0.2, (t1 - t) / 2 + 0.2) }); };
  bed(0, W.chapter(2), 'wind', 0.25);
  bed(W.chapter(2), T(A.crates), 'city', 0.5);
  bed(T(A.crates), T(A.chain0), 'roofwind', 0.3);
  bed(T(A.chain0), T(A.breakthrough), 'shaft', 0.45);
  bed(T(A.breakthrough), T(A.wake), 'hall', 0.45);
  bed(T(A.wake), T(A.city), 'hallAwake', 0.6);
  bed(T(A.city), T(A.epilogueEnd), 'night', 0.35);
  // the city clock ticks and a distant factory whistle in the flight
  ev.push({ t: 20, type: 'factory' }, { t: 52, type: 'factory' });
  return ev;
}

// ------------------------------------------------------------------ synthesis
class Synth {
  constructor(ctx, out, seed = 1) {
    this.ctx = ctx; this.out = out;
    // deterministic noise and impulse responses
    const r = new RNG(seed);
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = r.next() * 2 - 1;
    this.music = ctx.createGain(); this.music.gain.value = 0.55;
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.85;
    this.beds = ctx.createGain(); this.beds.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    const master = ctx.createGain(); master.gain.value = 0.85;
    this.music.connect(comp); this.sfx.connect(comp); this.beds.connect(comp);
    comp.connect(master); master.connect(out);
    this.master = master;
    // reverbs
    this.rev = this.reverb(2.2, 11, r); this.rev.connect(comp);
    this.big = this.reverb(5.0, 12, r); this.big.connect(comp);
  }
  reverb(sec, seed, r) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r.next() * 2 - 1) * Math.pow(1 - i / n, 3) * 0.6; }
    const conv = ctx.createConvolver(); conv.buffer = b;
    const g = ctx.createGain(); g.gain.value = 1; conv.connect(g);
    const input = ctx.createGain(); input.connect(conv);
    return { input, connect: (d) => g.connect(d) };
  }
  // helpers
  env(g, t, a, peak, dcy, sus = 0, rel = 0.1, hold = 0) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) { g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak * sus + 1e-4), t + a + hold + dcy); }
    else g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak * sus + 1e-4), t + a + dcy);
    return g;
  }
  bus(dest, pan = 0, send = 0.15, big = false) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(dest);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(big ? this.big.input : this.rev.input); }
    return g;
  }
  osc(type, f, t, stop, dest, detune = 0) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune; o.connect(dest); o.start(t); o.stop(stop); return o; }
  noiseSrc(t, stop, dest, rate = 1, off = 0) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = rate; s.connect(dest); s.start(t, off % 2.9); s.stop(stop); return s; }
  filter(type, f, q = 1, dest) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; }

  // ------------------------------------------------ instruments
  note(e, t, ctx = this.ctx) {
    const f = mtof(e.midi), v = e.vel, d = e.dur;
    const big = e.big;
    switch (e.inst) {
      case 'pad': {
        const g = this.bus(this.music, (hash01(e.midi) - 0.5) * 0.6, 0.35, true);
        this.env(g, t, 0.5, v * 0.12, d, 0.6, 0.8, 0);
        g.gain.setTargetAtTime(0, t + d, 0.35);
        const lp = this.filter('lowpass', 900 + 600 * v, 0.7, g);
        for (const det of [-9, 0, 8]) this.osc('sawtooth', f, t, t + d + 2, lp, det);
        break;
      }
      case 'choir': {
        const g = this.bus(this.music, 0, 0.5, true);
        this.env(g, t, 0.9, v * 0.08, d, 0.7);
        g.gain.setTargetAtTime(0, t + d, 0.5);
        const f1 = this.filter('bandpass', 750, 6, g), f2 = this.filter('bandpass', 1150, 7, g);
        for (const det of [-6, 5]) { this.osc('sawtooth', f, t, t + d + 2.5, f1, det); this.osc('sawtooth', f, t, t + d + 2.5, f2, det + 3); }
        break;
      }
      case 'bass': {
        const g = this.bus(this.music, 0, 0.05);
        this.env(g, t, 0.005, v * 0.35, d, 0.001);
        const lp = this.filter('lowpass', 420, 1.2, g);
        this.osc('sawtooth', f, t, t + d + 0.1, lp); this.osc('sine', f, t, t + d + 0.1, g);
        break;
      }
      case 'bassLong': {
        const g = this.bus(this.music, 0, 0.1);
        this.env(g, t, 0.2, v * 0.3, d, 0.5); g.gain.setTargetAtTime(0, t + d, 0.3);
        this.osc('sine', f, t, t + d + 1.5, g); const lp = this.filter('lowpass', 300, 0.8, g); this.osc('triangle', f, t, t + d + 1.5, lp);
        break;
      }
      case 'pluck': {
        const g = this.bus(this.music, (hash01(e.midi * 3 + t) - 0.5) * 0.8, 0.2);
        this.env(g, t, 0.004, v * 0.22, 0.4, 0.001);
        const lp = this.filter('lowpass', 2600, 1, g);
        this.osc('triangle', f, t, t + 0.6, lp); this.osc('square', f * 2, t, t + 0.15, this.filter('lowpass', 1800, 0.7, g));
        break;
      }
      case 'box': {
        const g = this.bus(this.music, (hash01(e.midi * 7 + t) - 0.5) * 0.5, 0.35, true);
        this.env(g, t, 0.003, v * 0.2, 1.5, 0.001);
        this.osc('sine', f, t, t + 1.8, g); const g2 = this.ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); this.osc('sine', f * 3.01, t, t + 0.6, g2);
        const g3 = this.ctx.createGain(); g3.gain.value = 0.15; g3.connect(g); this.osc('triangle', f * 2, t, t + 1.2, g3, 4);
        break;
      }
      case 'stab': {
        const g = this.bus(this.music, 0, 0.15);
        this.env(g, t, 0.01, v * 0.1, d, 0.001);
        const lp = this.filter('lowpass', 2200, 2, g);
        lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(700, t + d);
        this.osc('sawtooth', f, t, t + d + 0.1, lp, -5); this.osc('sawtooth', f, t, t + d + 0.1, lp, 5);
        break;
      }
      case 'brass': case 'brassSoft': {
        const soft = e.inst === 'brassSoft';
        const g = this.bus(this.music, 0.1, soft ? 0.45 : 0.25, soft);
        this.env(g, t, soft ? 0.12 : 0.04, v * (soft ? 0.16 : 0.2), d * 0.9, 0.55, 0.2);
        g.gain.setTargetAtTime(0, t + d, 0.12);
        const lp = this.filter('lowpass', 500, 1.5, g);
        lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(soft ? 1600 : 2600, t + 0.12); lp.frequency.setTargetAtTime(soft ? 1100 : 1500, t + 0.15, 0.3);
        this.osc('sawtooth', f, t, t + d + 0.8, lp, -4); this.osc('sawtooth', f, t, t + d + 0.8, lp, 6); this.osc('square', f / 2, t, t + d + 0.8, this.filter('lowpass', 400, 0.7, g));
        break;
      }
      default: break;
    }
  }
  drum(e, t) {
    const v = e.vel;
    if (e.kind === 'kick') { const g = this.bus(this.music, 0, 0.05); this.env(g, t, 0.002, v * 0.7, 0.35, 0.001); const o = this.osc('sine', 120, t, t + 0.4, g); o.frequency.exponentialRampToValueAtTime(45, t + 0.25); }
    else if (e.kind === 'snare') { const g = this.bus(this.music, 0.05, 0.15); this.env(g, t, 0.002, v * 0.4, 0.18, 0.001); this.noiseSrc(t, t + 0.25, this.filter('bandpass', 1800, 0.8, g), 1, t * 7); this.osc('triangle', 190, t, t + 0.1, g); }
    else if (e.kind === 'hat') { const g = this.bus(this.music, 0.2, 0.05); this.env(g, t, 0.001, v * 0.18, 0.045, 0.001); this.noiseSrc(t, t + 0.07, this.filter('highpass', 7000, 0.7, g), 1, t * 13); }
    else if (e.kind === 'tick') { const g = this.bus(this.music, -0.1, 0.1); this.env(g, t, 0.001, v * 0.25, 0.03, 0.001); this.noiseSrc(t, t + 0.05, this.filter('bandpass', 3200, 6, g), 1, t * 17); }
  }
  hit(e, t) {
    // orchestral hit: low boom plus a bright chord
    const g = this.bus(this.music, 0, 0.5, true);
    this.env(g, t, 0.01, e.vel * (e.soft ? 0.12 : 0.22), 2.2, 0.001);
    for (const m of [38, 50, 57, 62, 66, 69]) { const lp = this.filter('lowpass', 2400, 0.8, g); this.osc('sawtooth', mtof(m), t, t + 2.5, lp, (m % 5) - 2); }
    const b = this.bus(this.sfx, 0, 0.3, true); this.env(b, t, 0.005, e.vel * 0.5, 1.2, 0.001); const o = this.osc('sine', 90, t, t + 1.4, b); o.frequency.exponentialRampToValueAtTime(38, t + 1.0);
  }
  // ------------------------------------------------ effects
  effect(e, t) {
    const v = e.vel ?? 0.7, pan = e.pan ?? 0;
    const ctx = this.ctx;
    switch (e.type) {
      case 'whistle': {
        const g = this.bus(this.sfx, 0.2, 0.25);
        this.env(g, t, 0.02, 0.12, e.dur, 0.9, 0.05, 0); g.gain.setTargetAtTime(0, t + e.dur, 0.04);
        for (const f of [2750, 3080]) { const o = this.osc('sine', f, t, t + e.dur + 0.3, g); const lfo = ctx.createOscillator(); lfo.frequency.value = 26; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + e.dur + 0.3); }
        this.noiseSrc(t, t + e.dur, this.filter('bandpass', 2900, 3, g), 1, t);
        break;
      }
      case 'flutter': for (let k = 0; k < 16; k++) { const tt = t + k * 0.07 + hash01(k + t) * 0.03; const g = this.bus(this.sfx, (hash01(k * 3 + t) - 0.5), 0.1); this.env(g, tt, 0.004, 0.18 * (1 - k / 18), 0.05, 0.001); this.noiseSrc(tt, tt + 0.08, this.filter('bandpass', 900 + 600 * hash01(k), 1.2, g), 1, tt * 3); } break;
      case 'thud': case 'step': {
        const surf = e.surf || 'cobble';
        const g = this.bus(this.sfx, pan, surf === 'metal' ? 0.3 : 0.1, surf === 'metal');
        const vel = (e.type === 'step' ? e.vel * 0.35 : v * 0.6);
        this.env(g, t, 0.002, vel, surf === 'metal' ? 0.12 : 0.07, 0.001);
        const fc = surf === 'metal' ? 1400 : surf === 'roof' ? 500 : (e.heavy ? 380 : 650);
        this.noiseSrc(t, t + 0.12, this.filter('bandpass', fc * (0.9 + 0.2 * hash01(t * 100)), surf === 'metal' ? 4 : 1.2, g), 1, t * 31);
        const o = this.osc('sine', e.heavy ? 70 : 95, t, t + 0.1, g); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
        if (surf === 'metal') { const g2 = this.bus(this.sfx, pan, 0.4, true); this.env(g2, t, 0.001, vel * 0.25, 0.25, 0.001); for (const f of [620, 1330, 2210]) this.osc('sine', f * (0.95 + 0.1 * hash01(t)), t, t + 0.3, g2); }
        break;
      }
      case 'whoosh': case 'whooshBig': {
        const big = e.type === 'whooshBig';
        const dur = big ? 2.4 : 0.6;
        const g = this.bus(this.sfx, pan, big ? 0.5 : 0.1, big);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * (big ? 0.45 : 0.3), t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
        const bp = this.filter('bandpass', 400, 1.2, g);
        bp.frequency.setValueAtTime(e.up ? 300 : 600, t); bp.frequency.exponentialRampToValueAtTime(e.up ? 4000 : 1800, t + dur);
        this.noiseSrc(t, t + dur + 0.1, bp, 1, t * 5);
        break;
      }
      case 'clang': {
        const g = this.bus(this.sfx, pan, 0.35, true);
        this.env(g, t, 0.002, v * 0.3, 0.9, 0.001);
        for (const [f, a] of [[180, 1], [412, 0.7], [733, 0.5], [1190, 0.35], [1810, 0.2]]) { const gg = ctx.createGain(); gg.gain.value = a; gg.connect(g); this.osc('sine', f, t, t + 1.2, gg); }
        this.noiseSrc(t, t + 0.05, this.filter('highpass', 2000, 0.7, g), 1, t);
        break;
      }
      case 'knock': { const g = this.bus(this.sfx, pan, 0.15); this.env(g, t, 0.002, v * 0.35, 0.12, 0.001); this.osc('triangle', 180, t, t + 0.2, g); this.noiseSrc(t, t + 0.06, this.filter('bandpass', 900, 2, g), 1, t); break; }
      case 'tink': { const g = this.bus(this.sfx, 0.1, 0.2); this.env(g, t, 0.001, v * 0.25, 0.25, 0.001); this.osc('sine', 2400 + 300 * hash01(t), t, t + 0.3, g); this.osc('sine', 3900, t, t + 0.15, g); break; }
      case 'scrape': { const g = this.bus(this.sfx, pan, 0.1); g.gain.setValueAtTime(0.25, t); g.gain.linearRampToValueAtTime(0, t + e.dur); this.noiseSrc(t, t + e.dur, this.filter('bandpass', 1500, 0.8, g), 0.7, t); break; }
      case 'creak': { const g = this.bus(this.sfx, 0.2, 0.2); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.1); const o = this.osc('sawtooth', 140, t, t + 1.2, this.filter('bandpass', 700, 8, g)); o.frequency.linearRampToValueAtTime(110, t + 1.1); break; }
      case 'tramBell': for (const k of [0, 0.32]) { const g = this.bus(this.sfx, -0.3, 0.3); this.env(g, t + k, 0.002, 0.2, 0.8, 0.001); for (const f of [1320, 2640 * 1.02, 3470]) this.osc('sine', f, t + k, t + k + 1, g); } break;
      case 'rumble': {
        const g = this.bus(this.sfx, 0, 0.15);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + e.dur * 0.35); g.gain.linearRampToValueAtTime(0, t + e.dur);
        this.noiseSrc(t, t + e.dur, this.filter('lowpass', 180, 1, g), 0.5, t);
        for (let k = 0; k < e.dur * 3; k++) { const tt = t + k / 3; const gg = this.bus(this.sfx, 0, 0.05); this.env(gg, tt, 0.002, 0.18 * Math.sin((k / (e.dur * 3)) * Math.PI), 0.06, 0.001); this.noiseSrc(tt, tt + 0.08, this.filter('bandpass', 1200, 3, gg), 1, tt); }
        break;
      }
      case 'shimmer': case 'chime': {
        const big = !!e.big;
        const n = e.type === 'chime' ? (big ? 12 : 6) : 8;
        for (let k = 0; k < n; k++) {
          const tt = t + k * (e.type === 'chime' ? 0.09 : 0.05);
          const g = this.bus(this.sfx, (hash01(k * 7 + t) - 0.5) * 0.9, 0.5, true);
          this.env(g, tt, 0.003, v * 0.08 * (big ? 1.5 : 1), 1.4, 0.001);
          const base = e.type === 'chime' ? [74, 78, 81, 86, 90, 93][k % 6] + (k >= 6 ? 12 : 0) : 86 + ((k * 5) % 12);
          this.osc('sine', mtof(base), tt, tt + 1.6, g);
        }
        break;
      }
      case 'horn': { const g = this.bus(this.sfx, -0.4, 0.5, true); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.6); g.gain.linearRampToValueAtTime(0.1, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 3.2); const lp = this.filter('lowpass', 600, 1, g); for (const m of [43, 50, 55]) this.osc('sawtooth', mtof(m), t, t + 3.3, lp); break; }
      case 'ratchet': for (let k = 0; k < e.dur * 6; k++) { const tt = t + k / 6 + (k % 2) * 0.03; const g = this.bus(this.sfx, 0.1, 0.1); this.env(g, tt, 0.001, 0.18, 0.04, 0.001); this.noiseSrc(tt, tt + 0.05, this.filter('bandpass', 2600, 5, g), 1, tt); if (k % 3 === 0) { const s = this.bus(this.sfx, 0.1, 0.1); this.env(s, tt, 0.05, 0.05, 0.3, 0.001); this.osc('sawtooth', 300 + 40 * (k % 5), tt, tt + 0.4, this.filter('bandpass', 1200, 12, s)); } } break;
      case 'hiss': { const g = this.bus(this.sfx, pan, 0.2); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.45, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + e.dur); this.noiseSrc(t, t + e.dur, this.filter('highpass', 2500, 0.6, g), 1, t); break; }
      case 'bell': {
        // the clock tower: inharmonic partials with long decay
        const g = this.bus(this.sfx, -0.25, 0.6, true);
        this.env(g, t, 0.003, v * 0.25, 5.5, 0.001);
        const f0 = 196;
        for (const [r, a, dcy] of [[0.5, 0.6, 6], [1, 1, 5], [1.19, 0.6, 3.5], [1.5, 0.45, 3], [2, 0.5, 2.5], [2.52, 0.3, 1.8], [3.01, 0.22, 1.2], [4.16, 0.12, 0.8]]) { const gg = ctx.createGain(); this.env(gg, t, 0.002, a, dcy, 0.001); gg.connect(g); this.osc('sine', f0 * r, t, t + dcy + 0.2, gg); }
        break;
      }
      case 'rattle': for (let k = 0; k < 14; k++) { const tt = t + k * 0.05 + hash01(k + t) * 0.03; const g = this.bus(this.sfx, 0, 0.3, true); this.env(g, tt, 0.001, 0.12, 0.08, 0.001); this.osc('sine', 1800 + 1400 * hash01(k * 5 + t), tt, tt + 0.1, g); } break;
      case 'chainSlide': case 'screech': {
        const scr = e.type === 'screech';
        const g = this.bus(this.sfx, 0, e.open ? 0.5 : 0.35, true);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(scr ? 0.4 : 0.2, t + 0.2); g.gain.setValueAtTime(scr ? 0.4 : 0.2, t + e.dur - 0.3); g.gain.linearRampToValueAtTime(0, t + e.dur);
        const bp = this.filter('bandpass', scr ? 3200 : 2400, scr ? 9 : 4, g);
        this.noiseSrc(t, t + e.dur, bp, 1, t);
        for (let k = 0; k < e.dur * 12; k++) { const tt = t + k / 12 + hash01(k * 3 + t) * 0.05; const gg = this.bus(this.sfx, (hash01(k + t) - 0.5) * 0.6, 0.2); this.env(gg, tt, 0.001, 0.08, 0.03, 0.001); this.noiseSrc(tt, tt + 0.04, this.filter('highpass', 5000, 0.8, gg), 1, tt); }
        break;
      }
      case 'cart': {
        const g = this.bus(this.sfx, 0, 0.3, true);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + e.dur * 0.45); g.gain.linearRampToValueAtTime(0, t + e.dur);
        const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.9, t); p.pan.linearRampToValueAtTime(0.9, t + e.dur); p.connect(g);
        this.noiseSrc(t, t + e.dur, this.filter('lowpass', 250, 1.5, p), 0.6, t);
        for (let k = 0; k < e.dur * 8; k++) { const tt = t + k / 8; const gg = this.bus(this.sfx, 0, 0.2); this.env(gg, tt, 0.001, 0.2 * Math.sin((k / (e.dur * 8)) * Math.PI), 0.05, 0.001); this.osc('square', 900 + 200 * hash01(k), tt, tt + 0.06, this.filter('bandpass', 1500, 4, gg)); }
        break;
      }
      case 'beep': for (let k = 0; k < 3; k++) { const tt = t + k * 0.14; const g = this.bus(this.sfx, 0.2, 0.2); this.env(g, tt, 0.004, 0.07, 0.1, 0.001); this.osc('square', [1320, 1760, 1480][k], tt, tt + 0.12, this.filter('lowpass', 3000, 1, g)); } break;
      case 'heartbeat': {
        for (const [dt, a] of [[0, 1], [0.22, 0.7]]) { const tt = t + dt; const g = this.bus(this.sfx, 0, 0.3, true); this.env(g, tt, 0.004, v * 0.6 * a, 0.35, 0.001); const o = this.osc('sine', e.fast ? 70 : 58, tt, tt + 0.45, g); o.frequency.exponentialRampToValueAtTime(32, tt + 0.3); }
        break;
      }
      case 'click': { const g = this.bus(this.sfx, 0, 0.5, true); this.env(g, t, 0.001, 0.4, 0.2, 0.001); this.osc('square', 820, t, t + 0.05, this.filter('bandpass', 1600, 3, g)); this.osc('sine', 3000, t + 0.04, t + 0.2, g); break; }
      case 'boom': { const g = this.bus(this.sfx, 0, 0.6, true); this.env(g, t, 0.005, 0.9, 3.5, 0.001); const o = this.osc('sine', 70, t, t + 4, g); o.frequency.exponentialRampToValueAtTime(28, t + 3); this.noiseSrc(t, t + 2, this.filter('lowpass', 200, 0.8, g), 0.5, t); break; }
      case 'cheer': { const g = this.bus(this.sfx, 0, 0.5, true); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.8); g.gain.linearRampToValueAtTime(0, t + e.dur); for (const f of [650, 1100, 2400]) this.noiseSrc(t, t + e.dur, this.filter('bandpass', f, 5, g), 1, t + f); break; }
      case 'factory': { const g = this.bus(this.sfx, 0.5, 0.6, true); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.4); g.gain.linearRampToValueAtTime(0.06, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 3.2); for (const f of [311, 370]) this.osc('sawtooth', f, t, t + 3.3, this.filter('bandpass', f * 2, 6, g)); break; }
      default: break;
    }
  }
  bed(e, t) {
    const ctx = this.ctx, dur = e.dur, v = e.vel;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.5, t + dur * 0.4); g.gain.linearRampToValueAtTime(v * 0.5, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(this.beds);
    const off = (t * 1.37) % 2.8;
    switch (e.kind) {
      case 'wind': case 'roofwind': { const bp = this.filter('bandpass', e.kind === 'wind' ? 500 : 800, 0.6, g); bp.frequency.setValueAtTime(400 + 300 * hash01(t), t); bp.frequency.linearRampToValueAtTime(500 + 400 * hash01(t + 1), t + dur); this.noiseSrc(t, t + dur, bp, 0.5, off); break; }
      case 'city': {
        this.noiseSrc(t, t + dur, this.filter('bandpass', 420, 0.8, g), 0.8, off);
        // murmur: formant blips
        for (let k = 0; k < 10; k++) { const tt = t + hash01(t * 3 + k) * dur, d = 0.2 + 0.3 * hash01(k + t); const gg = ctx.createGain(); this.env(gg, tt, 0.05, 0.25, d, 0.001); gg.connect(g); this.noiseSrc(tt, tt + d + 0.1, this.filter('bandpass', 500 + 900 * hash01(k * 7 + t), 7, gg), 1, tt); }
        break;
      }
      case 'shaft': { const s = this.bus(this.beds, 0, 0.6, true); s.gain.value = v * 0.6; this.noiseSrc(t, t + dur, this.filter('lowpass', 160, 1, g), 0.4, off); for (let k = 0; k < 2; k++) { const tt = t + hash01(t + k) * dur; const gg = ctx.createGain(); this.env(gg, tt, 0.001, 0.15, 0.2, 0.001); gg.connect(s); this.osc('sine', 1400 + 800 * hash01(k + t), tt, tt + 0.3, gg); } break; }
      case 'hall': case 'hallAwake': {
        const awake = e.kind === 'hallAwake';
        this.noiseSrc(t, t + dur, this.filter('lowpass', awake ? 220 : 140, 1.5, g), 0.5, off);
        const hum = ctx.createGain(); hum.gain.value = awake ? 0.4 : 0.2; hum.connect(g);
        this.osc('sine', awake ? 55 : 49, t, t + dur, hum); this.osc('sine', awake ? 110.5 : 98.3, t, t + dur, hum);
        // machine clanks on a slow grid
        const step = awake ? 0.6 : 1.2;
        for (let tt = Math.ceil(t / step) * step; tt < t + dur; tt += step) { const s = this.bus(this.beds, (hash01(tt) - 0.5), 0.5, true); this.env(s, tt, 0.002, v * 0.2, 0.3, 0.001); this.noiseSrc(tt, tt + 0.1, this.filter('bandpass', 700, 3, s), 1, tt); }
        break;
      }
      case 'night': { this.noiseSrc(t, t + dur, this.filter('bandpass', 350, 0.5, g), 0.5, off); for (let k = 0; k < 2; k++) { const tt = t + hash01(t * 5 + k) * dur; const gg = ctx.createGain(); this.env(gg, tt, 0.01, 0.04, 0.25, 0.001); gg.connect(g); this.osc('sine', 3800 + 400 * hash01(k + t), tt, tt + 0.3, gg); } break; }
      default: break;
    }
  }
  play(e, t) {
    if (e.type === 'note') this.note(e, t);
    else if (e.type === 'drum') this.drum(e, t);
    else if (e.type === 'hit') this.hit(e, t);
    else if (e.type === 'bed') this.bed(e, t);
    else this.effect(e, t);
  }
}

// ------------------------------------------------------------------ public interface
export class Sound {
  constructor(world) {
    const story = world.story, TIME = world.TIME;
    const W = {
      A: story.A, events: story.events, boy: story.boy, cop: story.cop, duration: world.duration,
      T: (s) => TIME.T(s),
      chapter: (n) => (world.chapters.find((c) => c.n === n) || { t: 0 }).t,
      shotT: (prefix) => world.shots.find((s) => s.name.startsWith(prefix)),
    };
    this.events = [...buildScore(W), ...buildEffects(W)].filter((e) => e.t >= 0 && e.t < world.duration).sort((a, b) => a.t - b.t);
    this.duration = world.duration;
    this.ctx = null; this.session = null; this.muted = false;
  }
  // ---- live playback
  async ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }
  start(T) {
    if (!this.ctx || this.muted) return;
    this.stop();
    const out = this.ctx.createGain(); out.gain.value = 1; out.connect(this.ctx.destination);
    if (this.recordTo) out.connect(this.recordTo);
    const synth = new Synth(this.ctx, out, 7);
    const s = { out, synth, t0: this.ctx.currentTime + 0.08, T0: T, next: 0, timer: 0 };
    // first event at or after T (beds and pads that started just before are picked up too)
    s.next = this.events.findIndex((e) => e.t >= T - (e.type === 'bed' ? 3 : 0));
    if (s.next < 0) s.next = this.events.length;
    const pump = () => {
      const now = this.ctx.currentTime, Tnow = s.T0 + (now - s.t0);
      while (s.next < this.events.length && this.events[s.next].t < Tnow + 1.2) {
        const e = this.events[s.next++];
        const when = s.t0 + (e.t - s.T0);
        if (when < now - 0.02) continue;
        try { synth.play(e, when); } catch (err) { /* ignore a failed node */ }
      }
    };
    pump();
    s.timer = setInterval(pump, 250);
    this.session = s;
  }
  stop() {
    const s = this.session;
    if (!s) return;
    clearInterval(s.timer);
    const g = s.out.gain;
    g.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    setTimeout(() => s.out.disconnect(), 300);
    this.session = null;
  }
  setMuted(m) { this.muted = m; if (m) this.stop(); }
  // film time from the audio clock while a session runs (keeps picture and sound in sync)
  clockT() { const s = this.session; return s ? s.T0 + (this.ctx.currentTime - s.t0) : null; }

  // ---- deterministic offline render: returns interleaved 16 bit stereo PCM
  async renderOffline(t0 = 0, t1 = this.duration, rate = 44100, chunk = 30) {
    const total = Math.round((t1 - t0) * rate);
    const pcm = new Int16Array(total * 2);
    const PRE = MAXLEN;
    for (let c0 = t0; c0 < t1; c0 += chunk) {
      const c1 = Math.min(t1, c0 + chunk);
      const s0 = Math.max(0, c0 - PRE);
      const len = Math.round((c1 - s0) * rate);
      const ctx = new OfflineAudioContext(2, len, rate);
      const synth = new Synth(ctx, ctx.destination, 7);
      for (const e of this.events) {
        if (e.t < s0 || e.t >= c1) continue;
        synth.play(e, e.t - s0);
      }
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      const skip = Math.round((c0 - s0) * rate), n = Math.round((c1 - c0) * rate), base = Math.round((c0 - t0) * rate);
      for (let i = 0; i < n && base + i < total; i++) {
        pcm[(base + i) * 2] = Math.max(-1, Math.min(1, L[skip + i])) * 32767;
        pcm[(base + i) * 2 + 1] = Math.max(-1, Math.min(1, R[skip + i])) * 32767;
      }
    }
    return pcm;
  }
}

// WAV container for 16 bit stereo PCM
export function wavBytes(pcm, rate = 44100) {
  const data = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const out = new Uint8Array(44 + data.length);
  const dv = new DataView(out.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + data.length, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, data.length, true);
  out.set(data, 44);
  return out;
}
