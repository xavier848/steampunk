// The people of the market street: placement, daily behaviour and their reactions to
// Emil and Brummer rushing through. Everything is recomputed from S each frame.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { clamp, smoothstep, wrapAngle, lerpAngle } from '../core/math.js';
import { makePerson } from '../actors/people.js';
import { GAIT } from '../actors/crowd.js';
import { CITY } from '../city/layout.js';
import { CURB_H } from '../city/street.js';

const TAU = Math.PI * 2;

export class Townsfolk {
  constructor(crowd, story, market) {
    this.crowd = crowd;
    this.story = story;
    this.people = [];
    const r = new RNG(314);
    const add = (spec, kind) => {
      const p = crowd.add(makePerson(r, kind));
      if (!p) return null;
      Object.assign(p, spec);
      p.phase0 = p.phase0 ?? r.next();
      this.people.push(p);
      return p;
    };
    const skipZ = (z) => z > -24 && z < -36;
    // ---- walkers on the pavements (ping pong along a stretch)
    for (let i = 0; i < 70; i++) {
      const side = r.sign();
      const x = side * r.range(5.4, 7.6);
      const za = r.range(-22, 118), len = r.range(14, 48);
      add({ type: 'walk', x, za, zb: Math.min(126, za + len), y: CURB_H, speed: r.range(0.9, 1.45), t0: r.range(0, 100) });
    }
    // ---- walkers on the road (market crowd)
    for (let i = 0; i < 50; i++) {
      const x = r.range(-4.2, 4.2);
      const za = r.range(-20, 118), len = r.range(10, 40);
      add({ type: 'walk', x, za, zb: Math.min(126, za + len), y: 0, speed: r.range(0.8, 1.35), t0: r.range(0, 100) });
    }
    // ---- shoppers at the stalls and vendors behind them
    for (const st of market.stalls) {
      if (st.special) continue;
      const inward = -st.side; // stalls face the road
      const n = r.int(1, 3);
      for (let k = 0; k < n; k++) {
        add({ type: 'stand', x: st.pos.x + inward * r.range(1.45, 2.1), z: st.pos.z + r.range(-st.w / 2, st.w / 2), y: st.side > 0 ? CURB_H : CURB_H, yaw: st.side > 0 ? Math.PI / 2 : -Math.PI / 2, gait: GAIT.haggle });
      }
      add({ type: 'stand', x: st.pos.x - inward * 0.55, z: st.pos.z + r.range(-0.4, 0.4), y: CURB_H, yaw: st.side > 0 ? -Math.PI / 2 : Math.PI / 2, gait: r.chance(0.5) ? GAIT.talk : GAIT.haggle }, r.chance(0.6) ? 'market' : 'worker');
    }
    // ---- groups chatting on the road
    for (let i = 0; i < 14; i++) {
      const cx = r.range(-3.4, 3.4), cz = r.range(-18, 116);
      const n = r.int(2, 4);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r.range(-0.3, 0.3);
        add({ type: 'stand', x: cx + Math.sin(a) * 0.7, z: cz + Math.cos(a) * 0.7, y: 0, yaw: a + Math.PI, gait: r.chance(0.55) ? GAIT.talk : GAIT.stand });
      }
    }
    // ---- children playing (running in small circles)
    for (let i = 0; i < 6; i++) {
      const cx = r.range(-3, 3), cz = r.range(20, 110);
      for (let k = 0; k < 2; k++) add({ type: 'circle', cx, cz, R: r.range(1.2, 2.2), w: r.range(1.2, 1.8) * r.sign(), ph: k * Math.PI, y: 0 }, 'child');
    }
    // ---- porters carrying crates
    for (let i = 0; i < 6; i++) { const za = r.range(0, 60); add({ type: 'walk', x: r.sign() * r.range(3.8, 4.6), za, zb: za + 30, y: 0, speed: 0.85, t0: r.range(0, 100), carry: true }, 'worker'); }
    // ---- special people
    this.hatman = add({ type: 'hatman', x: -0.35, y: 0 }, 'gent');
    if (this.hatman) { this.crowd.setHat(this.hatman, 1); this.hatman.prop = 1; }
    this.lamplighter = add({ type: 'walk', x: -5.8, za: 60, zb: 118, y: CURB_H, speed: 0.7, t0: 10 }, 'worker');
    if (this.lamplighter) { this.lamplighter.prop = 4; this.crowd.setHat(this.lamplighter, 3); }
    this.newsboy = add({ type: 'stand', x: 2.9, z: 103.5, y: 0, yaw: 2.6, gait: GAIT.talk }, 'child');
    if (this.newsboy) this.newsboy.prop = 2;
    this.vendor = add({ type: 'stand', x: -7.4, z: 122.6, y: CURB_H, yaw: Math.PI / 2, gait: GAIT.talk }, 'market');
    // ---- the clock tower square and the cross street (seen in wide shots)
    for (let i = 0; i < 40; i++) {
      add({ type: 'walk', x: r.range(-55, 55), za: r.range(-205, -165), zb: 0, y: 0, speed: r.range(0.9, 1.4), t0: r.range(0, 100), axis: 'free', ang: r.range(0, TAU) });
    }
    for (let i = 0; i < 16; i++) {
      const side = r.sign();
      add({ type: 'walkx', z: -30 + side * r.range(6.0, 8.0), xa: r.range(-80, 60), y: CURB_H, speed: r.range(0.9, 1.4), t0: r.range(0, 100), len: r.range(20, 50) });
    }
    this.count = this.people.length;
    this._v = new THREE.Vector3();
  }

  // base behaviour -> position, yaw, gait, phase
  base(p, S) {
    const out = { x: 0, y: p.y, z: 0, yaw: 0, gait: GAIT.stand, phase: p.phase0 + S * 0.8, amp: 1 };
    if (p.type === 'walk') {
      const len = Math.max(2, p.zb - p.za);
      if (p.axis === 'free') {
        // square: long straight strolls that fold back inside the square
        const d = (S + p.t0) * p.speed;
        const L = 50;
        const k = Math.floor(d / L), f = d - k * L;
        const dir = k % 2 === 0 ? 1 : -1;
        const along = dir > 0 ? f - L / 2 : L / 2 - f;
        out.x = p.x + Math.sin(p.ang) * along; out.z = p.za + Math.cos(p.ang) * along;
        out.x = Math.max(-66, Math.min(66, out.x)); out.z = Math.max(-208, Math.min(-156, out.z));
        out.yaw = p.ang + (dir > 0 ? 0 : Math.PI);
      } else {
        const d = (S + p.t0) * p.speed;
        const k = Math.floor(d / len), f = d - k * len;
        const fwd = k % 2 === 0;
        out.z = fwd ? p.za + f : p.zb - f;
        out.x = p.x + Math.sin(d * 0.21 + p.phase0 * 6) * 0.25;
        // turn around smoothly at the ends
        const turn = smoothstep(len - 0.9, len, f);
        const yawF = fwd ? 0 : Math.PI;
        out.yaw = yawF + turn * Math.PI;
      }
      out.gait = p.carry ? GAIT.carry : GAIT.walk;
      out.phase = p.phase0 + (S + p.t0) * p.speed * 0.9;
    } else if (p.type === 'walkx') {
      const d = (S + p.t0) * p.speed;
      const k = Math.floor(d / p.len), f = d - k * p.len;
      const fwd = k % 2 === 0;
      out.x = fwd ? p.xa + f : p.xa + p.len - f;
      out.z = p.z;
      out.yaw = (fwd ? Math.PI / 2 : -Math.PI / 2) + smoothstep(p.len - 0.9, p.len, f) * Math.PI;
      out.gait = GAIT.walk;
      out.phase = p.phase0 + d * 0.9;
    } else if (p.type === 'circle') {
      const a = p.ph + S * p.w;
      out.x = p.cx + Math.cos(a) * p.R; out.z = p.cz + Math.sin(a) * p.R;
      out.yaw = Math.atan2(-Math.sin(a) * Math.sign(p.w), Math.cos(a) * Math.sign(p.w));
      out.gait = GAIT.run; out.amp = 0.7;
      out.phase = p.phase0 + S * 1.6;
    } else if (p.type === 'hatman') {
      // strolls south along the road and meets Emil at A.hat
      const A = this.story.A;
      const zHit = 61.6;
      const sp = 0.9;
      out.z = zHit + (A.hat - S) * sp;
      if (S > A.hat) out.z = zHit + 0.15 * smoothstep(A.hat, A.hat + 0.6, S); // staggers back
      out.x = p.x + (S > A.hat ? 0.35 * smoothstep(A.hat, A.hat + 0.5, S) : 0);
      out.yaw = Math.PI;
      out.gait = S < A.hat ? GAIT.walk : GAIT.stand;
      out.phase = p.phase0 + S * sp * 0.9;
    } else {
      out.x = p.x; out.z = p.z; out.yaw = p.yaw; out.gait = p.gait;
    }
    return out;
  }

  update(S, camera = null, shadowCenter = null, shadowRadius = 0) {
    const camPos = camera ? camera.position : null;
    const { boy, cop } = this.story;
    // pursuer samples over the last 1.5 s
    const samples = [];
    for (let k = 0; k < 6; k++) {
      const s = S - k * 0.28;
      samples.push({ p: boy.posAt(s), w: 1 - k / 6.5, who: 0 }, { p: cop.posAt(s), w: (1 - k / 6.5) * 0.9, who: 1 });
    }
    const boyNow = samples[0].p;
    const A = this.story.A;
    const active = S > A.run0 - 1 && S < A.chain0; // reactions only while the chase is on
    for (const p of this.people) {
      const b = this.base(p, S);
      let startle = 0, dx = 0, dz = 0, headYaw = 0;
      if (active && Math.abs(b.z - boyNow.z) < 30) {
        let best = 0;
        for (const smp of samples) {
          const ex = b.x - smp.p.x, ez = b.z - smp.p.z;
          const d2 = ex * ex + ez * ez;
          if (d2 > 16) continue;
          const w = Math.exp(-d2 / 2.4) * smp.w;
          if (w > best) { best = w; const d = Math.sqrt(d2) || 1; dx = (ex / d); dz = (ez / d); }
        }
        const push = 1.15 * best;
        dx *= push; dz *= push;
        startle = smoothstep(0.35, 0.85, best);
        // look after Emil
        const lx = boyNow.x - b.x, lz = boyNow.z - b.z;
        const ld = Math.hypot(lx, lz);
        if (ld < 11) {
          const want = wrapAngle(Math.atan2(lx, lz) - b.yaw);
          headYaw = clamp(want, -1.15, 1.15) * smoothstep(11, 5, ld);
        }
      }
      if (camPos) {
        const ex = b.x + dx - camPos.x, ez = b.z + dz - camPos.z;
        const d = Math.hypot(ex, ez);
        if (d < 1.6 && Math.abs(camPos.y - b.y - 1) < 2.5) { const k = (1.6 - d) / Math.max(d, 0.05); dx += ex * k; dz += ez * k; }
      }
      let gait = b.gait;
      if (startle > 0.5 && gait === GAIT.walk) gait = GAIT.stand;
      // the hat man flings his arms
      if (p === this.hatman && S > A.hat && S < A.hat + 2.5) startle = Math.max(startle, 1 - smoothstep(A.hat + 1.0, A.hat + 2.5, S));
      this.crowd.set(p, b.x + dx, b.y, b.z + dz, b.yaw, b.phase, gait, b.amp, startle, headYaw, 0, 0);
    }
    if (this.hatman) this.crowd.setHat(this.hatman, S < A.hat ? 1 : 0);
    this.crowd.commit(camera, shadowCenter, shadowRadius);
  }
}
