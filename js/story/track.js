// Character tracks in story time S. A track is a list of segments; each segment
// knows the position, heading and pose of the character for any S inside it.
// Segment types:
//   path   : follow waypoints at a gait (walk/run); locomotion phase = distance / stride
//   jump   : ballistic arc from a to b with apex height h
//   pose   : stand at a spot and play a pose function pose(u, s)
//   move   : straight move a -> b with a custom pose function (climb, slide, ...)
import * as THREE from 'three';
import { Path, clamp, smoothstep, lerp, lerpAngle, wrapAngle } from '../core/math.js';
import * as POSE from '../actors/poses.js';

const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

export class Track {
  constructor(name, { stride = 1.35, walkStride = 1.0 } = {}) {
    this.name = name; this.segs = []; this.stride = stride; this.walkStride = walkStride;
    this.dist = 0; // accumulated distance for continuous gait phase
  }
  get end() { return this.segs.length ? this.segs[this.segs.length - 1].s1 : 0; }
  get last() { return this.segs[this.segs.length - 1]; }
  lastPos() { const s = this.last; return s ? this.sample(s, s.s1).pos.clone() : null; }
  lastYaw() { const s = this.last; return s ? this.sample(s, s.s1).yaw : 0; }

  // run or walk along points; duration from speed, or fixed end time s1
  path(points, { s0 = this.end, s1 = null, speed = 5, gait = 'run', k = null, smooth = true, lean = null, face = null, mod = null } = {}) {
    const pts = points.map(v3);
    const path = smooth && pts.length > 2 ? new Path(pts, { samples: 16 }) : new Path(pts, { samples: 2, tension: 0 });
    const len = path.length;
    const dur = s1 !== null ? s1 - s0 : len / speed;
    const seg = { type: 'path', s0, s1: s0 + dur, path, len, gait, k: k ?? (gait === 'run' ? 1 : gait === 'jog' ? 0.6 : 0.1), d0: this.dist, lean, face, mod };
    this.dist += len;
    this.faceOverride = null;
    this.segs.push(seg);
    return this;
  }
  jump(b, { s0 = this.end, dur = 0.8, h = 1.2, a = null, tuck = 1 } = {}) {
    const A = a ? v3(a) : this.lastPos();
    const B = v3(b);
    const yaw = Math.atan2(B.x - A.x, B.z - A.z);
    this.segs.push({ type: 'jump', s0, s1: s0 + dur, a: A, b: B, h, yaw, tuck });
    this.dist += A.distanceTo(B);
    return this;
  }
  pose(dur, fn, { s0 = this.end, pos = null, yaw = null, face = null } = {}) {
    const P = pos ? v3(pos) : this.lastPos();
    const Y = yaw ?? this.lastYaw();
    this.segs.push({ type: 'pose', s0, s1: s0 + dur, pos: P, yaw: Y, fn, face });
    return this;
  }
  move(b, dur, fn, { s0 = this.end, a = null, yaw = null, ease = (u) => u, face = null } = {}) {
    const A = a ? v3(a) : this.lastPos();
    const B = v3(b);
    const Y = yaw ?? this.lastYaw();
    this.segs.push({ type: 'move', s0, s1: s0 + dur, a: A, b: B, yaw: Y, fn, ease, face });
    return this;
  }
  // teleport between shots (only used across cuts)
  wait(until) { const s = this.last; if (s && until > s.s1) this.pose(until - s.s1, (u, t) => POSE.idle(t)); return this; }

  segAt(S) {
    const segs = this.segs;
    if (S <= segs[0].s0) return [segs[0], 0];
    for (let i = 0; i < segs.length; i++) if (S <= segs[i].s1) return [segs[i], i];
    return [segs[segs.length - 1], segs.length - 1];
  }
  sample(seg, S) {
    const u = clamp((S - seg.s0) / Math.max(1e-6, seg.s1 - seg.s0));
    const out = { pos: new THREE.Vector3(), yaw: 0, u, seg };
    if (seg.type === 'path') {
      // ease in and out only for walks; runs keep constant speed
      const d = u * seg.len;
      seg.path.pointAt(d, out.pos);
      const tan = seg.path.tangentAt(Math.min(seg.len - 0.01, d + 0.3));
      out.yaw = seg.face ?? Math.atan2(tan.x, tan.z);
      out.speed = seg.len / Math.max(1e-6, seg.s1 - seg.s0);
      out.dist = seg.d0 + d;
    } else if (seg.type === 'jump') {
      out.pos.lerpVectors(seg.a, seg.b, u);
      out.pos.y += 4 * seg.h * u * (1 - u);
      out.yaw = seg.yaw;
    } else if (seg.type === 'pose') {
      out.pos.copy(seg.pos); out.yaw = seg.yaw;
    } else {
      out.pos.lerpVectors(seg.a, seg.b, seg.ease(u)); out.yaw = seg.yaw;
    }
    return out;
  }
  posePart(seg, st, S) {
    if (seg.type === 'path') {
      const stride = seg.gait === 'run' ? this.stride : seg.gait === 'jog' ? (this.stride + this.walkStride) / 2 : this.walkStride;
      const p = POSE.locomotion(st.dist / (stride * 2), seg.k, { lean: seg.lean });
      return seg.mod ? seg.mod(p, S, st) : p;
    }
    if (seg.type === 'jump') return POSE.jump(st.u, { tuck: seg.tuck });
    return seg.fn(st.u, S, st);
  }
  // full state with pose cross fades at segment borders
  at(S) {
    const [seg, i] = this.segAt(S);
    const st = this.sample(seg, S);
    let pose = this.posePart(seg, st, S);
    const X = 0.22; // crossfade window (s)
    const prev = this.segs[i - 1], next = this.segs[i + 1];
    if (prev && S - seg.s0 < X) {
      const w = 1 - smoothstep(0, X, S - seg.s0);
      const pst = this.sample(prev, prev.s1);
      pose = POSE.blend([[pose, 1 - w * 0.5], [this.posePart(prev, pst, prev.s1), w * 0.5]]);
    }
    if (next && seg.s1 - S < X) {
      const w = 1 - smoothstep(0, X, seg.s1 - S);
      const nst = this.sample(next, next.s0);
      pose = POSE.blend([[pose, 1 - w * 0.5], [this.posePart(next, nst, next.s0), w * 0.5]]);
    }
    // smooth yaw across segment borders
    let yaw = st.yaw;
    if (prev && S - seg.s0 < 0.35) yaw = lerpAngle(this.sample(prev, prev.s1).yaw, yaw, smoothstep(0, 0.35, S - seg.s0));
    st.pose = pose; st.yaw = yaw; st.index = i;
    st.face = seg.face;
    return st;
  }
  // position only (cheap), used by the scarf and crowd reactions
  posAt(S) { const [seg] = this.segAt(S); return this.sample(seg, S).pos; }
  velAt(S, dt = 0.05) { return this.posAt(S + dt).sub(this.posAt(S - dt)).multiplyScalar(1 / (2 * dt)); }
}
