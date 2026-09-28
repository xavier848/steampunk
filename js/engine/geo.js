// Geometry builder: merges many primitives into one compact BufferGeometry so a
// whole city block is a single draw call. Vertex format (32 bytes):
//   position float32x3, normal int8x4 (normalised), uv float32x2,
//   aCol uint8x4 (sRGB albedo + ink id), aMat uint8x4 (layer, tile scale, spec, emissive)
import * as THREE from 'three';
import { LAYER } from './textures.js';

class Grow {
  constructor(Type, cap = 4096) { this.Type = Type; this.a = new Type(cap); this.n = 0; }
  reserve(k) {
    if (this.n + k <= this.a.length) return;
    let cap = this.a.length * 2;
    while (cap < this.n + k) cap *= 2;
    const b = new this.Type(cap); b.set(this.a.subarray(0, this.n)); this.a = b;
  }
  view() { return this.a.slice(0, this.n); }
}

const _m3 = new THREE.Matrix3();
const _v = new THREE.Vector3();

// colours are stored as sRGB encoded bytes and decoded in the shader
export function hexToSRGB(hex) {
  if (Array.isArray(hex)) return hex;
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export class GeoBuilder {
  constructor() {
    this.pos = new Grow(Float32Array, 3 * 8192);
    this.nor = new Grow(Int8Array, 4 * 8192);
    this.uv = new Grow(Float32Array, 2 * 8192);
    this.col = new Grow(Uint8Array, 4 * 8192);
    this.mat = new Grow(Uint8Array, 4 * 8192);
    this.idx = new Grow(Uint32Array, 3 * 8192);
    this.vcount = 0;
    this.m = { col: [0.8, 0.8, 0.8], layer: LAYER.BRUSH, scale: 1, spec: 0, emit: 0, id: 0.1, uv: false };
  }
  // material state for following adds
  set(o) {
    const m = { ...this.m, ...o };
    if (o.color !== undefined) m.col = hexToSRGB(o.color);
    this.m = m;
    return this;
  }
  add(geo, matrix, o) {
    const saved = this.m;
    if (o) this.set(o);
    const m = this.m;
    const P = geo.attributes.position, N = geo.attributes.normal, UVA = geo.attributes.uv;
    const vc = P.count;
    this.pos.reserve(vc * 3); this.nor.reserve(vc * 4); this.uv.reserve(vc * 2); this.col.reserve(vc * 4); this.mat.reserve(vc * 4);
    if (matrix) _m3.getNormalMatrix(matrix);
    const col0 = Math.round(m.col[0] * 255), col1 = Math.round(m.col[1] * 255), col2 = Math.round(m.col[2] * 255);
    const idb = Math.round(m.id * 255);
    const layerCode = m.uv ? 100 + m.layer : m.layer;
    const scaleCode = Math.max(1, Math.min(255, Math.round(m.scale / 0.05)));
    const specb = Math.round(m.spec * 255), emitb = Math.round(Math.min(1, m.emit / 8) * 255);
    const vcol = geo.userData.vcol; // optional per-vertex colour override [r,g,b] 0..1
    for (let i = 0; i < vc; i++) {
      _v.fromBufferAttribute(P, i);
      if (matrix) _v.applyMatrix4(matrix);
      this.pos.a[this.pos.n++] = _v.x; this.pos.a[this.pos.n++] = _v.y; this.pos.a[this.pos.n++] = _v.z;
      if (N) { _v.fromBufferAttribute(N, i); if (matrix) _v.applyMatrix3(_m3); _v.normalize(); } else _v.set(0, 1, 0);
      this.nor.a[this.nor.n++] = Math.round(_v.x * 127); this.nor.a[this.nor.n++] = Math.round(_v.y * 127); this.nor.a[this.nor.n++] = Math.round(_v.z * 127); this.nor.a[this.nor.n++] = 0;
      if (UVA) { this.uv.a[this.uv.n++] = UVA.getX(i); this.uv.a[this.uv.n++] = UVA.getY(i); } else { this.uv.a[this.uv.n++] = 0; this.uv.a[this.uv.n++] = 0; }
      if (vcol) {
        this.col.a[this.col.n++] = Math.round(vcol[i * 3] * 255); this.col.a[this.col.n++] = Math.round(vcol[i * 3 + 1] * 255); this.col.a[this.col.n++] = Math.round(vcol[i * 3 + 2] * 255);
      } else { this.col.a[this.col.n++] = col0; this.col.a[this.col.n++] = col1; this.col.a[this.col.n++] = col2; }
      this.col.a[this.col.n++] = idb;
      this.mat.a[this.mat.n++] = layerCode; this.mat.a[this.mat.n++] = scaleCode; this.mat.a[this.mat.n++] = specb; this.mat.a[this.mat.n++] = emitb;
    }
    const base = this.vcount;
    if (geo.index) {
      const I = geo.index.array;
      this.idx.reserve(I.length);
      let flip = matrix && matrix.determinant() < 0;
      for (let k = 0; k < I.length; k += 3) {
        if (flip) { this.idx.a[this.idx.n++] = base + I[k]; this.idx.a[this.idx.n++] = base + I[k + 2]; this.idx.a[this.idx.n++] = base + I[k + 1]; }
        else { this.idx.a[this.idx.n++] = base + I[k]; this.idx.a[this.idx.n++] = base + I[k + 1]; this.idx.a[this.idx.n++] = base + I[k + 2]; }
      }
    } else {
      this.idx.reserve(vc);
      let flip = matrix && matrix.determinant() < 0;
      for (let k = 0; k < vc; k += 3) {
        if (flip) { this.idx.a[this.idx.n++] = base + k; this.idx.a[this.idx.n++] = base + k + 2; this.idx.a[this.idx.n++] = base + k + 1; }
        else { this.idx.a[this.idx.n++] = base + k; this.idx.a[this.idx.n++] = base + k + 1; this.idx.a[this.idx.n++] = base + k + 2; }
      }
    }
    this.vcount += vc;
    if (o) this.m = saved;
    return this;
  }
  get empty() { return this.vcount === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.view(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.view(), 4, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.view(), 2));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col.view(), 4, true));
    g.setAttribute('aMat', new THREE.BufferAttribute(this.mat.view(), 4, false));
    g.setIndex(new THREE.BufferAttribute(this.idx.view(), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ------------------------------------------------------------------ matrices
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
// matrix placing a unit primitive between two points (cylinder along Y)
const _up = new THREE.Vector3(0, 1, 0);
export function Mseg(a, b, r, rz = r) {
  const d = _v.copy(b).sub(a);
  const len = d.length();
  _q.setFromUnitVectors(_up, d.normalize());
  const m = new THREE.Matrix4().compose(_p.copy(a).add(b).multiplyScalar(0.5), _q, _s.set(r, len, rz));
  return m;
}
export const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);

// ------------------------------------------------------------------ primitives (unit sized, cached)
const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

export const P = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  // box with its base at y=0
  boxB: () => cached('boxB', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  cyl: (seg = 12, open = false) => cached('cyl' + seg + open, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1, open)),
  cylB: (seg = 12) => cached('cylB' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1).translate(0, 0.5, 0)),
  cone: (seg = 12) => cached('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg, 1).translate(0, 0.5, 0)),
  sphere: (w = 16, h = 10) => cached('sph' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h)),
  hemi: (w = 16, h = 8) => cached('hemi' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
  torus: (rs = 8, ts = 24, arc = Math.PI * 2, tube = 0.1) => cached(`tor${rs}_${ts}_${arc.toFixed(3)}_${tube}`, () => new THREE.TorusGeometry(1, tube, rs, ts, arc)),
  plane: () => cached('plane', () => new THREE.PlaneGeometry(1, 1)),
  // octagonal and other lathe shapes
  lathe: (key, pts, seg = 16) => cached('lathe' + key + seg, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)),
  gear: (teeth = 12, inner = 0.78, hole = 0.25, spokes = 5, thick = 0.2) => cached(`gear${teeth}_${inner}_${hole}_${spokes}_${thick}`, () => gearGeometry(teeth, inner, hole, spokes, thick)),
};

// gear: outer radius 1, teeth around, spoked wheel, thickness along Z (centred)
export function gearGeometry(teeth, inner, hole, spokes, thick) {
  const shape = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 4;
    const r = k === 1 || k === 2 ? 1.0 : inner;
    const aa = a + (k === 1 ? 0.12 : k === 2 ? -0.12 : 0) * (Math.PI * 2 / teeth) * 0.5;
    const x = Math.cos(aa) * r, y = Math.sin(aa) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  // hub hole
  const hub = new THREE.Path();
  hub.absarc(0, 0, hole * 0.5, 0, Math.PI * 2, true);
  shape.holes.push(hub);
  // spoke windows
  if (spokes > 0) {
    const r0 = hole + 0.06, r1 = inner - 0.12;
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2 + 0.16;
      const a1 = ((s + 1) / spokes) * Math.PI * 2 - 0.16;
      const w = new THREE.Path();
      w.absarc(0, 0, r1, a0, a1, false);
      w.absarc(0, 0, r0, a1, a0, true);
      shape.holes.push(w);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -thick / 2);
  return g;
}

// gable roof: ridge along X, span along Z. base at y=0 (wall top), centred.
// Builds top planes (uv: u along eaves, v down the slope in metres), an underside
// (soffit) so the roof reads from the street, and verge/fascia boards.
export function gableRoof(w, d, h, overhang = 0.4, { ends = true, thick = 0.14 } = {}) {
  const hw = w / 2 + overhang, hd = d / 2 + overhang;
  const k = h / (d / 2);            // slope ratio
  const y0 = -overhang * k;         // eaves drop below wall top following the slope
  const slope = Math.hypot(hd, h - y0);
  const W = w + 2 * overhang;
  const pos = [], uv = [];
  const quad4 = (a, b, c, d_, uva, uvb, uvc, uvd) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d_);
    uv.push(...uva, ...uvb, ...uvc, ...uva, ...uvc, ...uvd);
  };
  const z0 = [0, 0];
  // top planes (v = slope at the eave, 0 at the ridge so tile rows overlap downhill)
  quad4([-hw, y0, hd], [hw, y0, hd], [hw, h, 0], [-hw, h, 0], [0, slope], [W, slope], [W, 0], [0, 0]);
  quad4([hw, y0, -hd], [-hw, y0, -hd], [-hw, h, 0], [hw, h, 0], [0, slope], [W, slope], [W, 0], [0, 0]);
  // underside (soffit) so the roof reads from below
  const t = thick;
  quad4([hw, y0 - t, hd], [-hw, y0 - t, hd], [-hw, h - t, 0], [hw, h - t, 0], z0, z0, z0, z0);
  quad4([-hw, y0 - t, -hd], [hw, y0 - t, -hd], [hw, h - t, 0], [-hw, h - t, 0], z0, z0, z0, z0);
  if (ends) {
    const gw = w / 2 - 0.02;
    pos.push(-gw, 0, d / 2, -gw, h, 0, -gw, 0, -d / 2);
    pos.push(gw, 0, -d / 2, gw, h, 0, gw, 0, d / 2);
    uv.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.userData.eaveY = y0; g.userData.span = hd; g.userData.slope = slope;
  return g;
}

// box (centred) with uv in metres on every face; faces: +x, -x, +y, -y, +z, -z
export function boxUV(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  return g;
}

// generic quad from 4 points with metric uv (for roof planes, signs)
export function quad(a, b, cc, d, uvScale = 1) {
  const g = new THREE.BufferGeometry();
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...cc), D = new THREE.Vector3(...d);
  const w = A.distanceTo(B), h = A.distanceTo(D);
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...cc, ...a, ...cc, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w * uvScale, 0, w * uvScale, h * uvScale, 0, 0, w * uvScale, h * uvScale, 0, h * uvScale], 2));
  g.computeVertexNormals();
  return g;
}

// Tube along points with constant radius
export function tube(points, radius, radial = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'catmullrom', 0.2);
  return new THREE.TubeGeometry(curve, Math.max(4, points.length * 6), radius, radial, closed);
}

// Pipe made of straight runs with rounded elbows: points are corners.
export function pipeRun(b, points, r, { collars = true, collarColor } = {}) {
  const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    b.add(P.cyl(10, true), Mseg(a, c, r));
    if (collars) {
      const d = c.clone().sub(a);
      const len = d.length();
      const n = Math.floor(len / 1.6);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        const p0 = a.clone().lerp(c, t - 0.03 / len * 2), p1 = a.clone().lerp(c, t + 0.03 / len * 2);
        b.add(P.cyl(10), Mseg(p0, p1, r * 1.28), collarColor ? { color: collarColor } : undefined);
      }
    }
  }
  for (let i = 0; i < pts.length; i++) b.add(P.sphere(10, 8), M(pts[i].x, pts[i].y, pts[i].z, 0, 0, 0, r * 1.18));
}
