// The boy's red scarf: two verlet ribbons that trail from the neck. The simulation is
// re-run from a fixed warm-up window on a time grid aligned to absolute story time,
// so the result depends only on S (scrubbing, stills and export stay deterministic).
import * as THREE from 'three';
import { toonMaterial } from '../engine/materials.js';
import { LAYER_DYN_CASTER } from '../engine/engine.js';
import { noise1 } from '../core/rng.js';

const DT = 1 / 90;
const WARM = 1.4;           // seconds of warm-up
const N = 11;               // nodes per tail
const SEG = 0.068;

const VERT = /* glsl */ `
attribute float aSide; attribute float aT;
out vec3 vWP; out vec3 vN; out vec3 vVN; out float vDepth; out float vT; out float vSide;
void main() {
  vec4 wp = vec4(position, 1.0);
  vWP = wp.xyz; vN = normal; vT = aT; vSide = aSide;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * normal;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
in vec3 vWP; in vec3 vN; in vec3 vVN; in float vDepth; in float vT; in float vSide;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN); vec3 VN = normalize(vVN);
  if (!gl_FrontFacing) { N = -N; VN = -VN; }
  // knitted stripes + fringe darkening toward the end
  float stripe = step(0.5, fract(vT * 7.0)) * 0.12;
  vec3 albedo = pow(uColor, vec3(2.2)) * (1.0 - stripe) * (1.0 - smoothstep(0.85, 1.0, vT) * 0.25);
  float sh = sunShadow(vWP, N);
  vec3 col = toonShade(albedo, N, vWP, (fract(vT * 3.1 + vSide * 0.3) - 0.5) * 0.2, 0.0, 1.3, sh, 1.0);
  col += charKey(albedo, N, 0.0);
  col = applyFog(col, vWP);
  writeOut(col, VN, vDepth, 0.77);
}`;

export class Scarf {
  constructor(color = new THREE.Color(0.78, 0.2, 0.16)) {
    this.tails = [0, 1].map(() => ({ p: Array.from({ length: N }, () => new THREE.Vector3()), q: Array.from({ length: N }, () => new THREE.Vector3()) }));
    const verts = 2 * N * 2;
    this.pos = new Float32Array(verts * 3);
    this.nrm = new Float32Array(verts * 3);
    const side = new Float32Array(verts), tt = new Float32Array(verts);
    const idx = [];
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < N; i++) {
        const a = (k * N + i) * 2;
        side[a] = -1; side[a + 1] = 1; tt[a] = tt[a + 1] = i / (N - 1);
        if (i < N - 1) idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, toonMaterial({ vertex: VERT, fragment: FRAG, uniforms: { uColor: { value: color } }, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.layers.enable(LAYER_DYN_CASTER);
    this._a = new THREE.Vector3(); this._f = new THREE.Vector3(); this._r = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  // frameAt(S) -> { neck: Vector3, fwd: Vector3, right: Vector3, wind: Vector3 }
  update(S, frameAt) {
    const n1 = Math.floor(S / DT);
    const n0 = n1 - Math.round(WARM / DT);
    const f0 = frameAt(n0 * DT);
    const g = new THREE.Vector3(0, -9.8, 0);
    // initial state: hanging back and down from the anchors
    for (let k = 0; k < 2; k++) {
      const T = this.tails[k];
      const anchor = this.anchor(f0, k, this._a);
      for (let i = 0; i < N; i++) {
        T.p[i].copy(anchor).addScaledVector(f0.fwd, -SEG * i * 0.7).addScaledVector(new THREE.Vector3(0, -1, 0), SEG * i * 0.7);
        T.q[i].copy(T.p[i]);
      }
    }
    const tmp = new THREE.Vector3(), wind = new THREE.Vector3();
    const stepTo = (t, dt) => {
      const f = frameAt(t);
      wind.copy(f.wind || new THREE.Vector3(0.6, 0, 0.3));
      wind.x += noise1(t * 1.7, 3) * 1.2; wind.z += noise1(t * 1.3, 7) * 1.2; wind.y += noise1(t * 2.1, 5) * 0.6;
      for (let k = 0; k < 2; k++) {
        const T = this.tails[k];
        const anchor = this.anchor(f, k, this._a);
        T.p[0].copy(anchor); T.q[0].copy(anchor);
        for (let i = 1; i < N; i++) {
          const p = T.p[i], q = T.q[i];
          tmp.copy(p).sub(q).multiplyScalar(0.965); // damping (air drag)
          q.copy(p);
          p.add(tmp).addScaledVector(g, dt * dt * 0.55).addScaledVector(wind, dt * dt * (0.8 + i * 0.08));
        }
        for (let it = 0; it < 3; it++) {
          for (let i = 1; i < N; i++) {
            const a = T.p[i - 1], b = T.p[i];
            tmp.copy(b).sub(a);
            const d = tmp.length() || 1e-6;
            const diff = (d - SEG) / d;
            if (i === 1) b.addScaledVector(tmp, -diff);
            else { a.addScaledVector(tmp, diff * 0.5); b.addScaledVector(tmp, -diff * 0.5); }
          }
          // keep the scarf outside the torso (sphere below the neck, a bit behind)
          const c = this._v.copy(f.neck).addScaledVector(f.up || new THREE.Vector3(0, 1, 0), -0.2).addScaledVector(f.fwd, 0.0);
          for (let i = 2; i < N; i++) {
            tmp.copy(T.p[i]).sub(c);
            const d = tmp.length();
            if (d < f.bodyR) T.p[i].copy(c).addScaledVector(tmp, f.bodyR / Math.max(d, 1e-4));
          }
        }
      }
    };
    for (let n = n0 + 1; n <= n1; n++) stepTo(n * DT, DT);
    // final partial step to S (keeps motion continuous between grid points)
    const rem = S - n1 * DT;
    if (rem > 1e-5) stepTo(S, rem);
    this.writeMesh(frameAt(S));
  }
  anchor(f, k, out) {
    // two tails leave the knot at the left side of the neck, slightly behind
    return out.copy(f.neck).addScaledVector(f.right, 0.05 + k * 0.02).addScaledVector(f.fwd, -0.05 + k * 0.02).addScaledVector(f.up || new THREE.Vector3(0, 1, 0), -0.03 - k * 0.03);
  }
  writeMesh(f) {
    const up = f.up || new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3(), side = new THREE.Vector3(), n = new THREE.Vector3();
    for (let k = 0; k < 2; k++) {
      const T = this.tails[k];
      for (let i = 0; i < N; i++) {
        const p = T.p[i];
        a.copy(T.p[Math.min(N - 1, i + 1)]).sub(T.p[Math.max(0, i - 1)]).normalize();
        side.copy(a).cross(up);
        if (side.lengthSq() < 1e-4) side.copy(f.right); else side.normalize();
        const w = 0.07 * (1 - 0.25 * (i / (N - 1)));
        n.copy(side).cross(a).normalize();
        const base = ((k * N + i) * 2) * 3;
        this.pos[base] = p.x - side.x * w * 0.5; this.pos[base + 1] = p.y - side.y * w * 0.5; this.pos[base + 2] = p.z - side.z * w * 0.5;
        this.pos[base + 3] = p.x + side.x * w * 0.5; this.pos[base + 4] = p.y + side.y * w * 0.5; this.pos[base + 5] = p.z + side.z * w * 0.5;
        this.nrm.set([n.x, n.y, n.z, n.x, n.y, n.z], base);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}
