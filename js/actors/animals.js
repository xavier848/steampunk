// Pigeons (peck on the ground, burst into flight at story events), bird flocks in the
// sky, the rooftop cat and the top hat that flies off in the chase. All = f(S).
import * as THREE from 'three';
import { GeoBuilder, P, M, mul } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { toonMaterial, worldMaterial } from '../engine/materials.js';
import { LAYER_DYN_CASTER } from '../engine/engine.js';
import { RNG, noise1 } from '../core/rng.js';
import { clamp, smoothstep } from '../core/math.js';

// ------------------------------------------------------------------ instanced birds
const BIRD_VERT = /* glsl */ `
attribute vec4 aCol; attribute vec4 aMat; attribute float aWing;   // -1 left wing, 1 right wing, 0 body
attribute vec4 iPos;   // xyz, yaw
attribute vec4 iState; // flap phase, flying 0..1, scale, pitch
out vec3 vWP; out vec3 vN; out vec4 vCol; out vec3 vVN; out float vDepth;
void main() {
  vec3 p = position, n = normal;
  float fly = iState.y;
  // wings: folded on the ground, flapping in flight
  if (abs(aWing) > 0.5) {
    float flap = sin(iState.x * 6.2831) * 1.0 * fly + (1.0 - fly) * -0.1;
    float a = aWing * (0.2 + flap);
    float c = cos(a), s = sin(a);
    p = vec3(p.x * c - p.y * s * aWing, p.x * s * aWing + p.y * c, p.z);
    // folded: wings tucked along the body
    p.x *= mix(0.25, 1.0, fly);
  } else if (fly < 0.5) {
    // pecking: head bob
    if (p.z > 0.06) p.y += -0.03 * max(0.0, sin(iState.x * 6.2831 * 0.5)) * (p.z - 0.06) * 10.0;
  }
  float pitch = iState.w;
  float cp = cos(pitch), sp = sin(pitch);
  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  p *= iState.z;
  float cy = cos(iPos.w), sy = sin(iPos.w);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
  vec4 wp = vec4(p + iPos.xyz, 1.0);
  vWP = wp.xyz; vN = n; vCol = aCol;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * n;
  gl_Position = projectionMatrix * mv;
}`;
const BIRD_FRAG = /* glsl */ `
in vec3 vWP; in vec3 vN; in vec4 vCol; in vec3 vVN; in float vDepth;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN); vec3 VN = normalize(vVN);
  if (!gl_FrontFacing) { N = -N; VN = -VN; }
  vec3 albedo = pow(vCol.rgb, vec3(2.2));
  vec3 col = toonShade(albedo, N, vWP, 0.0, 0.2, 1.2, 1.0, 1.0);
  col = applyFog(col, vWP);
  writeOut(col, VN, vDepth, vCol.a);
}`;

function pigeonGeo(kind) {
  const b = new GeoBuilder();
  const grey = kind === 'swift' ? 0x2a2630 : 0x8a8a9a, dark = kind === 'swift' ? 0x1a1820 : 0x5a5a6e;
  b.set({ color: grey, layer: LAYER.BRUSH, scale: 0.2, spec: 0.2, emit: 0, id: 0.5 });
  b.add(P.sphere(8, 6), M(0, 0.1, 0, 0, 0, 0, 0.07, 0.07, 0.13));
  b.add(P.sphere(8, 6), M(0, 0.17, 0.1, 0, 0, 0, 0.045), { color: dark });
  b.add(P.cone(5), M(0, 0.165, 0.15, Math.PI / 2, 0, 0, 0.012, 0.03, 0.012), { color: 0xe0a040 });
  b.add(P.box(), M(0, 0.1, -0.15, 0, 0, 0, 0.08, 0.015, 0.1), { color: dark });
  const body = b.build();
  body.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(body.attributes.position.count), 1));
  // wings as separate geometry (so aWing can be set per vertex)
  const wb = new GeoBuilder();
  wb.set({ color: grey, layer: LAYER.BRUSH, scale: 0.2, spec: 0, emit: 0, id: 0.5 });
  wb.add(P.box(), M(0.14, 0.12, 0, 0, 0, 0, 0.22, 0.01, 0.1));
  const wl = wb.build(); // right wing (x > 0)
  const merged = new THREE.BufferGeometry();
  const parts = [[body, 0], [wl, 1], [wl, -1]];
  const pos = [], nor = [], col = [], mat = [], wing = [], idx = [];
  let base = 0;
  for (const [g, w] of parts) {
    const Pp = g.attributes.position, N = g.attributes.normal, C = g.attributes.aCol, Mt = g.attributes.aMat;
    for (let i = 0; i < Pp.count; i++) {
      pos.push(w < 0 ? -Pp.getX(i) : Pp.getX(i), Pp.getY(i), Pp.getZ(i));
      nor.push(w < 0 ? -N.getX(i) : N.getX(i), N.getY(i), N.getZ(i));
      col.push(C.getX(i), C.getY(i), C.getZ(i), C.getW(i));
      mat.push(Mt.getX(i), Mt.getY(i), Mt.getZ(i), Mt.getW(i));
      wing.push(w);
    }
    const I = g.index.array;
    for (let k = 0; k < I.length; k += 3) {
      if (w < 0) idx.push(base + I[k], base + I[k + 2], base + I[k + 1]);
      else idx.push(base + I[k], base + I[k + 1], base + I[k + 2]);
    }
    base += Pp.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  merged.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 4));
  merged.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 4));
  merged.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  merged.setIndex(idx);
  return merged;
}

class BirdBatch {
  constructor(count, kind) {
    const g0 = pigeonGeo(kind);
    const g = new THREE.InstancedBufferGeometry();
    g.index = g0.index;
    for (const k of ['position', 'normal', 'aCol', 'aMat', 'aWing']) g.setAttribute(k, g0.attributes[k]);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iState = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iPos.setUsage(THREE.DynamicDrawUsage); this.iState.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iState', this.iState);
    g.instanceCount = count;
    this.mesh = new THREE.Mesh(g, toonMaterial({ vertex: BIRD_VERT, fragment: BIRD_FRAG, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.count = count;
  }
  set(i, x, y, z, yaw, flap, fly, scale, pitch) { this.iPos.setXYZW(i, x, y, z, yaw); this.iState.setXYZW(i, flap, fly, scale, pitch); }
  commit() { this.iPos.needsUpdate = true; this.iState.needsUpdate = true; }
}

// pigeon flocks: each flock sits somewhere and takes off at story time 'up'
export class Pigeons {
  constructor(flocks) {
    this.flocks = flocks; // [{at: Vector3, n, up (S), dir}]
    let n = 0; for (const f of flocks) n += f.n;
    this.batch = new BirdBatch(n, 'pigeon');
    this.mesh = this.batch.mesh;
    const r = new RNG(21);
    this.birds = [];
    for (const f of flocks) {
      for (let k = 0; k < f.n; k++) {
        this.birds.push({ f, ox: r.range(-1.6, 1.6), oz: r.range(-1.6, 1.6), yaw: r.range(0, 6.28), ph: r.range(0, 1), delay: r.range(0, 0.35), vx: r.range(-1, 1), vz: r.range(-1, 1), climb: r.range(2.5, 4), speed: r.range(3, 5) });
      }
    }
  }
  update(S) {
    this.birds.forEach((b, i) => {
      const f = b.f;
      const t = S - f.up - b.delay;
      let x = f.at.x + b.ox, y = f.at.y, z = f.at.z + b.oz, yaw = b.yaw + noise1(S * 0.4 + i, 3) * 0.8, fly = 0, pitch = 0;
      if (t > 0) {
        const dir = new THREE.Vector3(b.vx + (f.dir?.x || 0), 0, b.vz + (f.dir?.z || 0)).normalize();
        const d = b.speed * t + 1.2 * t * t;
        x += dir.x * d; z += dir.z * d;
        y += b.climb * t + 0.8 * t * t;
        yaw = Math.atan2(dir.x, dir.z);
        fly = smoothstep(0, 0.15, t);
        pitch = -0.5 * (1 - smoothstep(0.3, 1.5, t));
        if (t > 9) y = -1000; // gone over the roofs
      } else {
        // hopping around while pecking
        x += noise1(S * 0.3 + i * 1.7, 7) * 0.3; z += noise1(S * 0.3 + i * 2.3, 9) * 0.3;
      }
      this.batch.set(i, x, y, z, yaw, S * (t > 0 ? 4.5 : 0.9) + b.ph, fly, 1, pitch);
    });
    this.batch.commit();
  }
}

// flocks of swifts circling in the sky (for the flight over the city)
export class Flocks {
  constructor(list) {
    this.list = list; // [{center, R, h, n, w}]
    let n = 0; for (const f of list) n += f.n;
    this.batch = new BirdBatch(n, 'swift');
    this.mesh = this.batch.mesh;
    const r = new RNG(99);
    this.birds = [];
    for (const f of list) for (let k = 0; k < f.n; k++) this.birds.push({ f, a: r.range(0, 0.6), dr: r.range(-6, 6), dh: r.range(-4, 4), ph: r.range(0, 1), sp: r.range(0.9, 1.1) });
  }
  update(S) {
    this.birds.forEach((b, i) => {
      const f = b.f;
      const a = f.phase + S * f.w * b.sp + b.a;
      const R = f.R + b.dr + noise1(S * 0.5 + i, 5) * 3;
      const x = f.center.x + Math.cos(a) * R, z = f.center.z + Math.sin(a) * R;
      const y = f.center.y + b.dh + Math.sin(S * 0.7 + i) * 2;
      const yaw = Math.atan2(-Math.sin(a) * Math.sign(f.w), Math.cos(a) * Math.sign(f.w));
      this.batch.set(i, x, y, z, yaw, S * 3.2 + b.ph, 1, f.scale || 5, 0);
    });
    this.batch.commit();
  }
}

// ------------------------------------------------------------------ the rooftop cat
export class Cat {
  constructor(pos) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    const mat = worldMaterial();
    const fur = { color: 0x3a3438, layer: LAYER.BRUSH, scale: 0.15, spec: 0.1, emit: 0, id: 0.55 };
    const light = { ...fur, color: 0x8a7a70 };
    const body = new GeoBuilder();
    body.add(P.sphere(12, 8), M(0, 0.17, -0.02, -0.5, 0, 0, 0.11, 0.2, 0.12), fur);   // sitting body
    body.add(P.sphere(10, 8), M(0, 0.28, 0.05, 0, 0, 0, 0.08, 0.1, 0.07), light);       // chest
    for (const s of [-1, 1]) body.add(P.sphere(8, 6), M(s * 0.05, 0.03, 0.09, 0, 0, 0, 0.03, 0.03, 0.05), fur); // paws
    this.body = new THREE.Mesh(body.build(), mat);
    this.group.add(this.body);
    const head = new GeoBuilder();
    head.add(P.sphere(12, 10), M(0, 0, 0, 0, 0, 0, 0.075, 0.068, 0.07), fur);
    head.add(P.sphere(8, 6), M(0, -0.02, 0.055, 0, 0, 0, 0.035, 0.026, 0.028), light);
    for (const s of [-1, 1]) {
      head.add(P.cone(4), M(s * 0.045, 0.055, -0.005, 0, 0, -s * 0.3, 0.028, 0.06, 0.018), fur);
      head.add(P.sphere(8, 6), M(s * 0.03, 0.012, 0.058, 0, 0, 0, 0.016, 0.014, 0.01), { color: 0xf0c040, layer: LAYER.BRUSH, scale: 0.1, spec: 0.8, emit: 2.2, id: 0.56 });
    }
    this.head = new THREE.Mesh(head.build(), mat);
    this.head.position.set(0, 0.4, 0.06);
    this.group.add(this.head);
    // tail: five segments
    this.tail = [];
    let parent = this.group;
    let off = new THREE.Vector3(0, 0.05, -0.13);
    const seg = new GeoBuilder();
    seg.add(P.cyl(6), M(0, 0, -0.045, Math.PI / 2, 0, 0, 0.018, 0.09, 0.018), fur);
    const sg = seg.build();
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(sg, mat);
      s.position.copy(off);
      parent.add(s);
      this.tail.push(s);
      parent = s; off = new THREE.Vector3(0, 0, -0.085);
    }
    this.group.traverse((o) => { if (o.isMesh) o.layers.enable(LAYER_DYN_CASTER); });
  }
  update(S, target) {
    // head follows Emil when he is near, otherwise looks around lazily
    const local = this.group.worldToLocal(target.clone());
    const d = local.length();
    let yaw = Math.atan2(local.x, local.z), pitch = -Math.atan2(local.y - 0.4, Math.hypot(local.x, local.z));
    const idleYaw = noise1(S * 0.3, 4) * 0.8;
    const k = smoothstep(14, 6, d);
    yaw = idleYaw * (1 - k) + clamp(yaw, -1.3, 1.3) * k;
    pitch = clamp(pitch, -0.6, 0.6) * k;
    this.head.rotation.set(pitch, yaw, 0, 'YXZ');
    this.tail.forEach((s, i) => s.rotation.set(-0.35 + 0.12 * i * 0.3, Math.sin(S * 2.2 - i * 0.7) * 0.35, 0));
    this.group.updateMatrixWorld(true);
  }
}

// ------------------------------------------------------------------ the falling top hat
export class FallingHat {
  constructor(at, sHit) {
    const b = new GeoBuilder();
    const m = { color: 0x1c1818, layer: LAYER.CLOTH, scale: 0.3, spec: 0.35, emit: 0, id: 0.52 };
    b.add(P.cyl(14), M(0, 0.15, 0, 0, 0, 0, 0.11, 0.3, 0.1), m);
    b.add(P.cyl(16), M(0, 0.005, 0, 0, 0, 0, 0.17, 0.018, 0.17), m);
    b.add(P.cyl(14), M(0, 0.045, 0, 0, 0, 0, 0.112, 0.045, 0.112), { ...m, color: 0x7a2a2a });
    this.mesh = new THREE.Mesh(b.build(), worldMaterial());
    this.mesh.layers.enable(LAYER_DYN_CASTER);
    this.at = at.clone(); this.sHit = sHit;
    this.mesh.visible = false;
  }
  update(S) {
    const t = S - this.sHit;
    this.mesh.visible = t > 0 && t < 400;
    if (!this.mesh.visible) return;
    const p = this.mesh.position, r = this.mesh.rotation;
    const vx = 1.3, vz = 1.6, vy = 3.2, g = 9.8;
    const tf = (vy + Math.sqrt(vy * vy + 2 * g * 1.85)) / g; // time to hit the ground from 1.85 m
    if (t < tf) {
      p.set(this.at.x + vx * t, 1.85 + vy * t - 0.5 * g * t * t, this.at.z + vz * t);
      r.set(t * 7, t * 3, t * 4);
    } else {
      // one bounce, then it rolls on its brim in a curve and settles on its side
      const u = t - tf;
      const roll = Math.min(u, 2.6);
      const d = 1.5 * roll - 0.25 * roll * roll;
      const ang = 0.5 * roll;
      const bounce = Math.max(0, Math.sin(Math.min(u, 0.5) * Math.PI / 0.5)) * 0.25 * (u < 0.5 ? 1 : 0);
      p.set(this.at.x + vx * tf + Math.sin(ang) * d, 0.1 + bounce, this.at.z + vz * tf + Math.cos(ang) * d);
      r.set(Math.PI / 2, ang * 1.5, roll * 5 + (u > 2.6 ? 0 : 0));
    }
  }
}
