// Painted smoke and steam: camera facing puffs with hard, eroding edges and banded
// light (like the clouds), plus additive sparks and embers. Emitters are stateless:
// particle k of an emitter is born at t_k = phase + k * interval, so every frame is
// a pure function of the story time S.
import * as THREE from 'three';
import { toonMaterial, BLEND_VEIL, BLEND_ADD } from '../engine/materials.js';
import { RNG, hash01, noise1 } from '../core/rng.js';
import { clamp, smoothstep } from '../core/math.js';

const PUFF_VERT = /* glsl */ `
attribute vec4 iPos;   // xyz, size
attribute vec4 iP;     // erosion, seed, kind, brightness
out vec2 vQ; out vec4 vP; out vec3 vSunV; out float vDepth; out vec3 vWP;
uniform vec3 uSunDir;
void main() {
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float a = iP.y * 6.2831;
  vec2 q = position.xy * 2.0;
  vec2 rq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  mv.xy += rq * iPos.w * 0.5;
  vQ = q; vP = iP; vDepth = -mv.z; vWP = iPos.xyz;
  vSunV = normalize(mat3(viewMatrix) * uSunDir);
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FRAG = /* glsl */ `
uniform vec3 uSteamLit; uniform vec3 uSteamShade; uniform vec3 uSmokeLit; uniform vec3 uSmokeShade;
in vec2 vQ; in vec4 vP; in vec3 vSunV; in float vDepth; in vec3 vWP;
void main() {
  if (uPass == 1) discard;
  // lumpy silhouette from the brush texture, eroded with age
  vec4 br = texture(uBrush, vec3(vQ * 0.45 + vP.y * 7.0, 14.0));
  float r = length(vQ) + (br.r - 0.5) * 0.55 + (br.a - 0.5) * 0.25;
  float edge = 0.95 - vP.x * 0.85;
  float alpha = 1.0 - smoothstep(edge - 0.06, edge, r);
  if (alpha < 0.02) discard;
  vec3 n = normalize(vec3(vQ, sqrt(max(0.0, 1.0 - min(1.0, dot(vQ, vQ))))));
  float l = dot(n, vSunV) + (br.g - 0.5) * 0.3;
  float b = 0.5 * smoothstep(-0.25, -0.12, l) + 0.5 * smoothstep(0.3, 0.42, l);
  vec3 lit = mix(uSteamLit, uSmokeLit, vP.z), shade = mix(uSteamShade, uSmokeShade, vP.z);
  vec3 col = mix(shade, lit, b) * vP.w;
  // rim where the puff faces the light
  col += lit * 0.25 * smoothstep(0.6, 0.9, length(vQ)) * smoothstep(0.0, 0.5, dot(normalize(vQ + 1e-4), vSunV.xy));
  col = applyFog(col, vWP);
  float a = alpha * mix(0.92, 0.85, vP.z);
  oColor = vec4(col * a, a);
  // dense steam shortens the normals (the composite hides ink there); depth and id stay
  oNormal = vec4(0.0, 0.0, 0.0, smoothstep(0.3, 0.8, a));
}`;

const SPARK_VERT = /* glsl */ `
attribute vec4 iPos;   // xyz, size
attribute vec4 iV;     // velocity xyz (for streak), heat
out vec2 vQ; out float vHeat; out vec3 vWP;
void main() {
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  vec3 vv = mat3(viewMatrix) * iV.xyz;
  vec2 dir = length(vv.xy) > 1e-4 ? normalize(vv.xy) : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  float len = iPos.w * (1.0 + length(vv.xy) * 0.06);
  mv.xy += dir * position.y * len + side * position.x * iPos.w * 0.35;
  vQ = position.xy * 2.0; vHeat = iV.w; vWP = iPos.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = /* glsl */ `
in vec2 vQ; in float vHeat; in vec3 vWP;
void main() {
  if (uPass == 1) discard;
  float a = (1.0 - smoothstep(0.2, 1.0, abs(vQ.x))) * (1.0 - smoothstep(0.3, 1.0, abs(vQ.y)));
  vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.5), vHeat) * (2.0 + 4.0 * vHeat);
  oColor = vec4(col, a);
  oNormal = vec4(0.0);
}`;

function quadGeo() {
  const b = new THREE.PlaneGeometry(1, 1);
  return b;
}

export class Particles {
  constructor({ maxPuffs = 2600, maxSparks = 1600 } = {}) {
    this.emitters = [];
    this.sparkEmitters = [];
    this.group = new THREE.Group();
    // puffs
    const q = quadGeo();
    const g = new THREE.InstancedBufferGeometry();
    g.index = q.index; g.setAttribute('position', q.attributes.position);
    this.pPos = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.pP = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.pPos); g.setAttribute('iP', this.pP);
    g.instanceCount = 0;
    this.puffGeo = g; this.maxPuffs = maxPuffs;
    this.puffMat = toonMaterial({ vertex: PUFF_VERT, fragment: PUFF_FRAG, transparent: true, depthWrite: false, blending: BLEND_VEIL, side: THREE.DoubleSide,
      uniforms: { uSteamLit: { value: new THREE.Color(1.0, 0.92, 0.78) }, uSteamShade: { value: new THREE.Color(0.52, 0.5, 0.72) }, uSmokeLit: { value: new THREE.Color(0.55, 0.45, 0.42) }, uSmokeShade: { value: new THREE.Color(0.22, 0.2, 0.3) } } });
    this.puffs = new THREE.Mesh(g, this.puffMat);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 30;
    this.group.add(this.puffs);
    // sparks
    const sq = quadGeo();
    const sg = new THREE.InstancedBufferGeometry();
    sg.index = sq.index; sg.setAttribute('position', sq.attributes.position);
    this.sPos = new THREE.InstancedBufferAttribute(new Float32Array(maxSparks * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.sV = new THREE.InstancedBufferAttribute(new Float32Array(maxSparks * 4), 4).setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute('iPos', this.sPos); sg.setAttribute('iV', this.sV);
    sg.instanceCount = 0;
    this.sparkGeo = sg; this.maxSparks = maxSparks;
    this.sparks = new THREE.Mesh(sg, toonMaterial({ vertex: SPARK_VERT, fragment: SPARK_FRAG, transparent: true, depthWrite: false, blending: BLEND_ADD, side: THREE.DoubleSide }));
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 31;
    this.group.add(this.sparks);
    this._list = [];
  }
  // kind: 'steam' | 'smoke' | 'column' ; window: [sStart, sEnd] limits births
  add(e) {
    const r = new RNG(e.seed ?? this.emitters.length * 13 + 7);
    const em = {
      pos: e.pos.clone(), dir: (e.dir || new THREE.Vector3(0, 1, 0)).clone().normalize(),
      interval: e.interval ?? 0.5, life: e.life ?? 4, size: e.size ?? 1, growth: e.growth ?? 0.6,
      speed: e.speed ?? 1.5, rise: e.rise ?? 0.6, spread: e.spread ?? 0.3, wind: e.wind || new THREE.Vector3(0.6, 0, 0.35),
      smoke: e.smoke ?? 0, bright: e.bright ?? 1, window: e.window || null, phase: r.range(0, 10), seed: r.range(0, 1000),
      range: e.range ?? 260, burst: e.burst || null, pulse: e.pulse || null, always: !!e.always, follow: e.follow || null, drag: e.drag ?? 0,
    };
    this.emitters.push(em);
    return em;
  }
  addSparks(e) {
    const em = { pos: e.pos, rate: e.rate ?? 60, life: e.life ?? 0.6, speed: e.speed ?? 4, spread: e.spread ?? 0.8, dir: e.dir || new THREE.Vector3(0, 1, 0), size: e.size ?? 0.05, gravity: e.gravity ?? 9.8, window: e.window, active: e.active || null, seed: e.seed ?? this.sparkEmitters.length * 17, drift: e.drift ?? 0, range: e.range ?? 200 };
    this.sparkEmitters.push(em);
    return em;
  }
  update(S, camera) {
    const cam = camera.position;
    // ---- puffs
    const list = this._list; list.length = 0;
    const emitters = this.emitters.map((e) => [e, (e.follow ? e.follow(S) : e.pos).distanceTo(cam)]).filter(([e, d]) => d < e.range || e.always).sort((a, b) => a[1] - b[1]);
    for (const [e] of emitters) {
      const origin = e.follow ? e.follow(S) : e.pos;
      const n = Math.ceil(e.life / e.interval) + 1;
      const kNow = Math.floor((S - e.phase) / e.interval);
      for (let j = 0; j < n; j++) {
        const k = kNow - j;
        const born = e.phase + k * e.interval;
        const a = S - born;
        if (a < 0 || a > e.life) continue;
        if (e.window && (born < e.window[0] || born > e.window[1])) continue;
        const h = hash01(k * 7919 + Math.floor(e.seed));
        const h2 = hash01(k * 104729 + Math.floor(e.seed) * 3), h3 = hash01(k * 1299709 + 11);
        let strength = 1;
        if (e.pulse) strength = e.pulse(born);
        if (strength <= 0.01) continue;
        const u = a / e.life;
        const o = e.follow ? e.follow(born) : origin;
        // motion: initial jet slowing down, buoyant rise, wind drift, a little turbulence
        const jet = e.speed * (a - 0.5 * e.drag * a * a);
        const x = o.x + e.dir.x * jet + (h - 0.5) * e.spread * a * 2 + e.wind.x * Math.pow(a, 1.35) + noise1(a * 0.7 + h * 9, 3) * 0.35 * a;
        const y = o.y + e.dir.y * jet + e.rise * a * a * 0.5 + e.rise * a + noise1(a * 0.6 + h2 * 9, 5) * 0.2 * a;
        const z = o.z + e.dir.z * jet + (h2 - 0.5) * e.spread * a * 2 + e.wind.z * Math.pow(a, 1.35);
        const size = (e.size + e.growth * a) * (0.75 + 0.5 * h3) * Math.sqrt(strength) * smoothstep(0, 0.12, u + 0.02);
        const erosion = smoothstep(0.45, 1.0, u);
        const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
        list.push([dx * dx + dy * dy + dz * dz, x, y, z, size, erosion, h, e.smoke, e.bright * (0.9 + 0.2 * h2)]);
        if (list.length >= this.maxPuffs) break;
      }
      if (list.length >= this.maxPuffs) break;
    }
    list.sort((a, b) => b[0] - a[0]); // back to front
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      this.pPos.setXYZW(i, p[1], p[2], p[3], p[4]);
      this.pP.setXYZW(i, p[5], p[6], p[7], p[8]);
    }
    this.puffGeo.instanceCount = list.length;
    this.pPos.needsUpdate = true; this.pP.needsUpdate = true;
    // ---- sparks
    let ns = 0;
    for (const e of this.sparkEmitters) {
      const origin = typeof e.pos === 'function' ? e.pos(S) : e.pos;
      if (!origin || origin.distanceTo(cam) > e.range) continue;
      const interval = 1 / e.rate;
      const n = Math.ceil(e.life / interval);
      const kNow = Math.floor(S / interval);
      for (let j = 0; j < n && ns < this.maxSparks; j++) {
        const k = kNow - j;
        const born = k * interval;
        const a = S - born;
        if (a < 0 || a > e.life) continue;
        if (e.window && (born < e.window[0] || born > e.window[1])) continue;
        if (e.active && !e.active(born)) continue;
        const o = typeof e.pos === 'function' ? e.pos(born) : e.pos;
        const h1 = hash01(k * 31 + e.seed), h2 = hash01(k * 57 + e.seed * 3), h3 = hash01(k * 91 + e.seed * 7);
        const vx = e.dir.x * e.speed + (h1 - 0.5) * e.spread * e.speed * 2;
        const vy = e.dir.y * e.speed + (h2 - 0.5) * e.spread * e.speed * 2;
        const vz = e.dir.z * e.speed + (h3 - 0.5) * e.spread * e.speed * 2;
        const x = o.x + vx * a, y = o.y + vy * a - 0.5 * e.gravity * a * a + e.drift * a, z = o.z + vz * a;
        const heat = 1 - a / e.life;
        this.sPos.setXYZW(ns, x, y, z, e.size * (0.6 + 0.8 * h1));
        this.sV.setXYZW(ns, vx, vy - e.gravity * a, vz, heat);
        ns++;
      }
    }
    this.sparkGeo.instanceCount = ns;
    this.sPos.needsUpdate = true; this.sV.needsUpdate = true;
  }
}
