// Procedural pose library. A pose is { rot: {bone: [x, y, z]}, hipsOff: [x, y, z] }.
// Conventions (character faces +Z, left = +X): thigh/arm x < 0 swings forward,
// shin x > 0 bends the knee, fore x < 0 bends the elbow, spine x > 0 leans forward,
// L arm z > 0 lifts sideways (R arm z < 0), head y > 0 turns left.
import { clamp, smoothstep, lerp } from '../core/math.js';

const TAU = Math.PI * 2;
const empty = () => ({ rot: {}, hipsOff: [0, 0, 0] });

export function idle(t, { breathe = 1, look = 0, arms = 0 } = {}) {
  const p = empty();
  const b = Math.sin(t * 1.6) * 0.02 * breathe;
  const w = Math.sin(t * 0.55) * 0.04;
  p.rot.spine = [0.02 + b, w * 0.5, 0];
  p.rot.chest = [b, 0, 0];
  p.rot.head = [-0.02 - b, look, 0];
  p.rot.L_arm = [0.05 + arms, 0, 0.09]; p.rot.R_arm = [0.05 + arms, 0, -0.09];
  p.rot.L_fore = [-0.18, 0, 0]; p.rot.R_fore = [-0.18, 0, 0];
  p.rot.L_thigh = [0, 0, 0.02 + w * 0.3]; p.rot.R_thigh = [0, 0, -0.02 + w * 0.3];
  p.rot.hips = [0, -w * 0.5, w * 0.2];
  p.hipsOff = [w * 0.02, -Math.abs(b) * 0.1, 0];
  return p;
}

// run / walk cycle. phase in cycles (1 cycle = left + right step). k = 0 walk .. 1 sprint
export function locomotion(phase, k = 1, { lean = null, armPump = 1 } = {}) {
  const p = empty();
  const ph = phase * TAU;
  const s = Math.sin(ph);
  const A = lerp(0.45, 0.95, k), K = lerp(0.6, 1.5, k), Ar = lerp(0.35, 0.9, k) * armPump;
  const legs = (o) => {
    const q = ph + o;
    const thigh = -A * Math.sin(q) - lerp(0.05, 0.25, k);
    const knee = lerp(0.08, 0.25, k) + K * Math.pow(Math.max(0, Math.sin(q + 1.25)), 1.5);
    const foot = -0.25 * Math.sin(q + 0.6) * k + 0.1;
    return [thigh, knee, foot];
  };
  const [tL, kL, fL] = legs(0), [tR, kR, fR] = legs(Math.PI);
  p.rot.L_thigh = [tL, 0, 0.02]; p.rot.R_thigh = [tR, 0, -0.02];
  p.rot.L_shin = [kL, 0, 0]; p.rot.R_shin = [kR, 0, 0];
  p.rot.L_foot = [fL, 0, 0]; p.rot.R_foot = [fR, 0, 0];
  p.rot.L_arm = [Ar * s + 0.1 * k, 0, 0.08 + 0.12 * k]; p.rot.R_arm = [-Ar * s + 0.1 * k, 0, -0.08 - 0.12 * k];
  p.rot.L_fore = [lerp(-0.4, -1.45, k) - 0.2 * Math.max(0, -s), 0, 0]; p.rot.R_fore = [lerp(-0.4, -1.45, k) - 0.2 * Math.max(0, s), 0, 0];
  const ln = lean ?? lerp(0.05, 0.28, k);
  p.rot.spine = [ln * 0.6, 0.12 * s * k, 0];
  p.rot.chest = [ln * 0.4, 0.1 * s * k, 0];
  p.rot.hips = [0.05 * k, -0.14 * s * k, 0];
  p.rot.neck = [-ln * 0.5, -0.1 * s * k, 0];
  p.rot.head = [-ln * 0.3, -0.08 * s * k, 0];
  p.hipsOff = [0, -lerp(0.01, 0.07, k) + lerp(0.015, 0.05, k) * Math.abs(Math.cos(ph)), 0];
  return p;
}

// jump arc, u in 0..1 (take off .. landing)
export function jump(u, { tuck = 1 } = {}) {
  const p = empty();
  const up = smoothstep(0, 0.25, u), down = smoothstep(0.7, 1.0, u);
  const t = up * (1 - down);
  p.rot.L_thigh = [lerp(0.3, -1.25 * tuck, t) + down * -0.5, 0, 0.05];
  p.rot.R_thigh = [lerp(-0.6, -0.7 * tuck, t) + down * -0.3, 0, -0.05];
  p.rot.L_shin = [lerp(0.2, 1.7 * tuck, t) + down * 0.3, 0, 0];
  p.rot.R_shin = [lerp(0.5, 1.2 * tuck, t) + down * 0.2, 0, 0];
  p.rot.L_arm = [lerp(-1.0, -1.9, t), 0, lerp(0.3, 0.7, t)];
  p.rot.R_arm = [lerp(0.5, -0.8, t), 0, lerp(-0.4, -0.9, t)];
  p.rot.L_fore = [-0.6, 0, 0]; p.rot.R_fore = [-0.9, 0, 0];
  p.rot.spine = [0.25 + 0.15 * t, 0, 0]; p.rot.chest = [0.1, 0, 0];
  p.rot.head = [-0.3, 0, 0];
  p.hipsOff = [0, 0.03 * t, 0];
  return p;
}

// landing squash, u in 0..1
export function land(u) {
  const p = empty();
  const c = Math.sin(clamp(u) * Math.PI) * (1 - u * 0.3);
  p.rot.L_thigh = [-1.1 * c - 0.2, 0, 0.1]; p.rot.R_thigh = [-0.6 * c - 0.1, 0, -0.1];
  p.rot.L_shin = [1.7 * c + 0.2, 0, 0]; p.rot.R_shin = [1.3 * c + 0.2, 0, 0];
  p.rot.L_foot = [-0.5 * c, 0, 0]; p.rot.R_foot = [-0.4 * c, 0, 0];
  p.rot.spine = [0.45 * c + 0.1, 0, 0]; p.rot.head = [-0.35 * c, 0, 0];
  p.rot.L_arm = [-0.6 * c, 0, 0.5 * c + 0.1]; p.rot.R_arm = [-0.3 * c, 0, -0.6 * c - 0.1];
  p.rot.L_fore = [-0.8, 0, 0]; p.rot.R_fore = [-0.8, 0, 0];
  p.hipsOff = [0, -0.28 * c, 0.05 * c];
  return p;
}

// ladder climb, phase in cycles (one cycle = both hands)
export function climb(phase) {
  const p = empty();
  const q = phase * TAU;
  const a = Math.sin(q), b = Math.sin(q + Math.PI);
  p.rot.L_arm = [-2.5 - 0.35 * a, 0, 0.18]; p.rot.R_arm = [-2.5 - 0.35 * b, 0, -0.18];
  p.rot.L_fore = [-0.5 - 0.5 * Math.max(0, -a), 0, 0]; p.rot.R_fore = [-0.5 - 0.5 * Math.max(0, -b), 0, 0];
  p.rot.L_thigh = [-0.9 - 0.45 * b, 0, 0.08]; p.rot.R_thigh = [-0.9 - 0.45 * a, 0, -0.08];
  p.rot.L_shin = [1.3 + 0.4 * b, 0, 0]; p.rot.R_shin = [1.3 + 0.4 * a, 0, 0];
  p.rot.L_foot = [0.3, 0, 0]; p.rot.R_foot = [0.3, 0, 0];
  p.rot.spine = [0.05, 0.05 * a, 0]; p.rot.head = [-0.25, 0.1 * a, 0];
  p.hipsOff = [0, 0.02 * Math.abs(a), 0];
  return p;
}

// sliding down a chain: hands overhead, legs wrapped, sway s in -1..1
export function chainSlide(t, sway = 0) {
  const p = empty();
  const w = Math.sin(t * 5.0) * 0.05;
  p.rot.L_arm = [-2.95, 0, -0.18]; p.rot.R_arm = [-2.9, 0, 0.18];
  p.rot.L_fore = [-0.35 + w, 0, 0]; p.rot.R_fore = [-0.3 - w, 0, 0];
  p.rot.L_thigh = [-0.55, 0, -0.18]; p.rot.R_thigh = [-0.25, 0, 0.2];
  p.rot.L_shin = [1.1, 0, 0]; p.rot.R_shin = [0.6, 0, 0];
  p.rot.L_foot = [0.4, 0, 0]; p.rot.R_foot = [0.5, 0, 0];
  p.rot.spine = [-0.1 + sway * 0.05, 0, sway * 0.1]; p.rot.head = [-0.35, 0, 0];
  return p;
}

// crouch / kneel (hatch), u = 0 standing .. 1 deep crouch; reach = arms forward
export function crouch(u, reach = 0) {
  const p = empty();
  p.rot.L_thigh = [-1.5 * u, 0, 0.12]; p.rot.R_thigh = [-1.1 * u, 0, -0.12];
  p.rot.L_shin = [2.0 * u, 0, 0]; p.rot.R_shin = [1.9 * u, 0, 0];
  p.rot.L_foot = [-0.5 * u, 0, 0]; p.rot.R_foot = [-0.6 * u, 0, 0];
  p.rot.spine = [0.5 * u + 0.2 * reach, 0, 0]; p.rot.chest = [0.2 * u, 0, 0];
  p.rot.head = [-0.2 * u + 0.3 * reach, 0, 0];
  p.rot.L_arm = [-0.3 - 1.0 * reach, 0, 0.15]; p.rot.R_arm = [-0.3 - 1.0 * reach, 0, -0.15];
  p.rot.L_fore = [-0.6 + 0.3 * reach, 0, 0]; p.rot.R_fore = [-0.6 + 0.3 * reach, 0, 0];
  p.hipsOff = [0, -0.36 * u, -0.06 * u];
  return p;
}

// constable: blowing the whistle (right hand at the mouth)
export function whistle(t, k = 1) {
  const p = idle(t);
  p.rot.R_arm = [-1.55 * k, 0.2, -0.45 * k]; p.rot.R_fore = [-2.15 * k, 0, 0];
  p.rot.head = [-0.12 * k, 0.05, 0]; p.rot.chest = [-0.08 * k, 0, 0];
  p.rot.L_arm = [0.1, 0, 0.35 * k]; p.rot.L_fore = [-1.2 * k, 0, 0];
  return p;
}
export function shakeFist(t, k = 1) {
  const p = idle(t);
  const s = Math.sin(t * 11) * 0.25;
  p.rot.R_arm = [-2.6 * k, 0, -0.25 * k]; p.rot.R_fore = [(-1.2 + s) * k, 0, 0];
  p.rot.spine = [-0.1 * k, 0, 0]; p.rot.head = [-0.35 * k, 0, 0];
  p.rot.L_arm = [0.2, 0, 0.3]; p.rot.L_fore = [-1.4, 0, 0];
  return p;
}

// weighted blend of poses: [[pose, w], ...]
export function blend(list) {
  const out = empty();
  let W = 0;
  for (const [, w] of list) W += w;
  if (W <= 0) return out;
  for (const [p, w0] of list) {
    const w = w0 / W;
    for (const k in p.rot) {
      const r = p.rot[k];
      const o = out.rot[k] || (out.rot[k] = [0, 0, 0]);
      o[0] += r[0] * w; o[1] += r[1] * w; o[2] += r[2] * w;
    }
    out.hipsOff[0] += p.hipsOff[0] * w; out.hipsOff[1] += p.hipsOff[1] * w; out.hipsOff[2] += p.hipsOff[2] * w;
  }
  return out;
}
// add small offsets on top of a pose (e.g. head look)
export function addRot(p, bone, x, y, z) {
  const r = p.rot[bone] || (p.rot[bone] = [0, 0, 0]);
  r[0] += x; r[1] += y; r[2] += z;
  return p;
}

// ---- extra poses for the story
// baseball slide under an obstacle, u in 0..1
export function slide(u) {
  const p = empty();
  const k = Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5);
  p.rot.L_thigh = [-1.35 * k, 0, 0.12]; p.rot.R_thigh = [-0.4 * k, 0, -0.1];
  p.rot.L_shin = [0.15, 0, 0]; p.rot.R_shin = [1.5 * k, 0, 0];
  p.rot.spine = [-0.9 * k, 0, 0]; p.rot.chest = [-0.25 * k, 0, 0]; p.rot.head = [0.6 * k, 0, 0];
  p.rot.L_arm = [-0.6 * k, 0, 0.9 * k]; p.rot.R_arm = [0.4 * k, 0, -1.1 * k];
  p.rot.L_fore = [-0.4, 0, 0]; p.rot.R_fore = [-0.3, 0, 0];
  p.hipsOff = [0, -0.55 * k, 0];
  return p;
}
// arms spread for balance on a ridge (added on top of locomotion)
export function balance(p, amt = 1, t = 0) {
  const w = Math.sin(t * 3.1) * 0.15;
  p.rot.L_arm = [(p.rot.L_arm?.[0] ?? 0) * (1 - amt) - 0.2 * amt, 0, 1.25 * amt + w];
  p.rot.R_arm = [(p.rot.R_arm?.[0] ?? 0) * (1 - amt) - 0.2 * amt, 0, -1.25 * amt + w];
  p.rot.L_fore = [-0.3, 0, 0]; p.rot.R_fore = [-0.3, 0, 0];
  addRot(p, 'spine', -0.1 * amt, 0, w * 0.4);
  return p;
}
// duck under something while running (amt 0..1)
export function duck(p, amt) {
  addRot(p, 'spine', 0.55 * amt, 0, 0); addRot(p, 'chest', 0.25 * amt, 0, 0); addRot(p, 'head', -0.3 * amt, 0, 0);
  p.hipsOff[1] -= 0.22 * amt;
  addRot(p, 'L_thigh', -0.35 * amt, 0, 0); addRot(p, 'R_thigh', -0.35 * amt, 0, 0);
  addRot(p, 'L_shin', 0.35 * amt, 0, 0); addRot(p, 'R_shin', 0.35 * amt, 0, 0);
  return p;
}
// looking at something held at the hip (the satchel)
export function lookSatchel(t, amt = 1) {
  const p = idle(t);
  addRot(p, 'head', 0.55 * amt, 0.35 * amt, 0); addRot(p, 'neck', 0.2 * amt, 0.1 * amt, 0);
  p.rot.L_arm = [-0.35 * amt, 0, 0.25]; p.rot.L_fore = [-0.9 * amt, 0, 0];
  p.rot.R_arm = [-0.45 * amt, 0, -0.05]; p.rot.R_fore = [-1.2 * amt, 0.2, 0];
  addRot(p, 'spine', 0.12 * amt, 0.1 * amt, 0);
  return p;
}
// hiding crouched behind barrels, peeking to the side (peek 0..1)
export function hide(t, peek = 0) {
  const p = crouch(0.85, 0.2);
  addRot(p, 'spine', 0.15, 0.3 * peek, 0); addRot(p, 'head', -0.25 - 0.2 * peek, 0.5 * peek, 0);
  p.rot.R_arm = [-0.9, 0, -0.1]; p.rot.R_fore = [-1.3, 0, 0];
  p.rot.L_arm = [-0.3, 0, 0.35]; p.rot.L_fore = [-1.5, 0, 0];
  p.hipsOff[1] -= 0.02 * Math.sin(t * 1.7);
  return p;
}
// turning the hatch wheel (arms circling in front of the chest)
export function wheel(t, amt = 1) {
  const p = crouch(0.25, 0.4);
  const a = t * 5.5;
  p.rot.L_arm = [-1.25 + Math.sin(a) * 0.35, 0, 0.25 + Math.cos(a) * 0.1];
  p.rot.R_arm = [-1.25 + Math.sin(a + Math.PI) * 0.35, 0, -0.25 + Math.cos(a + Math.PI) * 0.1];
  p.rot.L_fore = [-0.6 + Math.cos(a) * 0.2, 0, 0]; p.rot.R_fore = [-0.6 + Math.cos(a + Math.PI) * 0.2, 0, 0];
  addRot(p, 'spine', 0.35, Math.sin(a) * 0.08, 0); addRot(p, 'head', -0.1, 0, 0);
  return p;
}
// shielding the face from a blast (steam), u 0..1 fades in, then relaxes
export function shield(t, amt = 1) {
  const p = idle(t);
  p.rot.R_arm = [-1.8 * amt, 0.3, -0.5 * amt]; p.rot.R_fore = [-1.9 * amt, 0, 0];
  p.rot.L_arm = [-0.6 * amt, 0, 0.6 * amt]; p.rot.L_fore = [-1.0 * amt, 0, 0];
  addRot(p, 'spine', -0.25 * amt, 0.3 * amt, 0); addRot(p, 'head', 0.2 * amt, 0.5 * amt, 0);
  p.hipsOff[2] -= 0.12 * amt;
  return p;
}
// leaning over an opening, looking down
export function lookDown(t, amt = 1) {
  const p = crouch(0.35 * amt, 0.2);
  addRot(p, 'spine', 0.55 * amt, 0, 0); addRot(p, 'chest', 0.2 * amt, 0, 0); addRot(p, 'head', 0.55 * amt, 0, 0);
  p.rot.L_arm = [-1.0 * amt, 0, 0.3]; p.rot.R_arm = [-1.0 * amt, 0, -0.3];
  p.rot.L_fore = [-0.3, 0, 0]; p.rot.R_fore = [-0.3, 0, 0];
  p.hipsOff[1] += Math.sin(t * 2) * 0.005;
  return p;
}
// pointing with the right arm (the constable spots the glow)
export function point(t, amt = 1) {
  const p = idle(t);
  p.rot.R_arm = [-1.5 * amt, 0.2, -0.2 * amt]; p.rot.R_fore = [-0.15, 0, 0];
  addRot(p, 'spine', -0.05 * amt, -0.2 * amt, 0); addRot(p, 'head', 0, -0.15 * amt, 0);
  return p;
}
// looking around (searching)
export function search(t, amt = 1) {
  const p = idle(t);
  const a = Math.sin(t * 1.4) * 0.9 * amt;
  addRot(p, 'head', -0.05, a, 0); addRot(p, 'chest', 0, a * 0.4, 0);
  p.rot.L_arm = [0, 0, 0.35]; p.rot.L_fore = [-1.4, 0, 0];
  p.rot.R_arm = [0, 0, -0.35]; p.rot.R_fore = [-1.4, 0, 0];
  return p;
}
// holding a newspaper
export function reading(t, amt = 1) {
  const p = idle(t);
  p.rot.L_arm = [-0.9 * amt, 0, 0.1]; p.rot.R_arm = [-0.9 * amt, 0, -0.1];
  p.rot.L_fore = [-1.0 * amt, 0, 0]; p.rot.R_fore = [-1.0 * amt, 0, 0];
  addRot(p, 'head', 0.3 * amt, 0, 0);
  return p;
}
// hanging and sliding on a chain (see chainSlide), grip the chain above
export function hang(t, swing = 0) {
  const p = chainSlide(t, swing);
  p.rot.L_thigh = [-0.3 + 0.2 * Math.sin(t * 2), 0, 0.05]; p.rot.R_thigh = [-0.1 - 0.2 * Math.sin(t * 2), 0, -0.05];
  p.rot.L_shin = [0.5, 0, 0]; p.rot.R_shin = [0.4, 0, 0];
  return p;
}

// holding the brass core in front of the chest with both hands, looking at it
export function holdCore(t, amt = 1, lift = 0) {
  const p = idle(t);
  const k = amt;
  p.rot.L_arm = [-0.75 * k - 0.5 * lift, 0, 0.09 - 0.3 * k]; p.rot.R_arm = [-0.75 * k - 0.5 * lift, 0, -0.09 + 0.3 * k];
  p.rot.L_fore = [-0.18 - 1.15 * k + 0.3 * lift, 0.35 * k, 0]; p.rot.R_fore = [-0.18 - 1.15 * k + 0.3 * lift, -0.35 * k, 0];
  addRot(p, 'head', 0.4 * k - 0.35 * lift, 0, 0); addRot(p, 'neck', 0.1 * k, 0, 0);
  return p;
}
// pushing the core into the socket in front of him at chest height (u 0 hold .. 1 arms out)
export function insertCore(t, u) {
  const p = holdCore(t, 1 - u);
  const k = u;
  p.rot.L_arm = [-0.75 - 0.75 * k, 0, 0.09 - 0.3 + 0.1 * k]; p.rot.R_arm = [-0.75 - 0.75 * k, 0, -0.09 + 0.3 - 0.1 * k];
  p.rot.L_fore = [-1.33 + 1.1 * k, 0.35 * (1 - k), 0]; p.rot.R_fore = [-1.33 + 1.1 * k, -0.35 * (1 - k), 0];
  addRot(p, 'spine', 0.18 * k, 0, 0); addRot(p, 'head', -0.3 * k, 0, 0);
  p.rot.L_thigh = [-0.25 * k, 0, 0.05]; p.rot.R_thigh = [0.2 * k, 0, -0.05];
  p.rot.L_shin = [0.35 * k, 0, 0];
  return p;
}
// looking up in awe, arms a little away from the body
export function awe(t, amt = 1) {
  const p = idle(t, { breathe: 1.5 });
  addRot(p, 'head', -0.42 * amt, 0.12 * Math.sin(t * 0.4) * amt, 0); addRot(p, 'spine', -0.08 * amt, 0, 0);
  p.rot.L_arm = [0.1, 0, 0.09 + 0.3 * amt]; p.rot.R_arm = [0.1, 0, -0.09 - 0.3 * amt];
  p.rot.L_fore = [-0.35 * amt, 0, 0]; p.rot.R_fore = [-0.35 * amt, 0, 0];
  return p;
}
// joy: right fist up, little hop
export function cheer(t, amt = 1) {
  const p = idle(t, { breathe: 2 });
  const b = Math.abs(Math.sin(t * 5.5)) * amt;
  p.rot.R_arm = [-2.6 * amt, 0, -0.25 * amt]; p.rot.R_fore = [-0.5 * amt - 0.3 * b, 0, 0];
  p.rot.L_arm = [-0.5 * amt, 0, 0.35 * amt]; p.rot.L_fore = [-1.1 * amt, 0, 0];
  addRot(p, 'head', -0.25 * amt, 0, 0);
  p.hipsOff = [0, 0.05 * b, 0];
  return p;
}
// the constable takes off his helmet and wipes his brow (u 0..1) then smiles
export function copRelief(t, u) {
  const p = idle(t, { breathe: 1.4 });
  const k = Math.sin(Math.min(1, u) * Math.PI);
  p.rot.R_arm = [-2.2 * k, 0, -0.3 * k]; p.rot.R_fore = [-1.6 * k, 0, 0];
  addRot(p, 'head', -0.3, 0, 0);
  return p;
}
// sitting on a ledge, legs dangling over the edge, hands on the ledge beside the hips
export function sit(t, look = 0) {
  const p = idle(t, { breathe: 1.2 });
  p.rot.L_thigh = [-1.45, 0, 0.12]; p.rot.R_thigh = [-1.5, 0, -0.1];
  p.rot.L_shin = [1.35 + 0.12 * Math.sin(t * 1.3), 0, 0]; p.rot.R_shin = [1.45 + 0.12 * Math.sin(t * 1.3 + 2.2), 0, 0];
  p.rot.L_foot = [0.3, 0, 0]; p.rot.R_foot = [0.25, 0, 0];
  p.rot.spine = [0.12, 0, 0]; p.rot.chest = [0.05, 0, 0];
  p.rot.L_arm = [0.35, 0, 0.35]; p.rot.R_arm = [0.35, 0, -0.35];
  p.rot.L_fore = [-0.25, 0, 0]; p.rot.R_fore = [-0.25, 0, 0];
  addRot(p, 'head', -0.12, look, 0);
  p.hipsOff = [0, 0, -0.04];
  return p;
}
