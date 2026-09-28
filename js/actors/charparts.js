// Character geometry builder. Parts are modelled in a rest pose (character faces +Z,
// left side is +X, feet at y = 0) and merged into one geometry. Each vertex carries
// its bone (rigid) or two blended bones, colour, painted texture layer and a face flag.
import * as THREE from 'three';
import { LAYER } from '../engine/textures.js';
import { hexToSRGB } from '../engine/geo.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

export class CharBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = []; this.slot = [];
    this.count = 0;
  }
  // style: {color, layer, scale, spec, emit (0..8), face (0 none, 1 face texture), id, slot (crowd colour slot)}
  // skin: bone index | (v) => [b0, w0, b1, w1]
  // aMat = (layer, tile scale code, spec 0..255, face + 4 * emissive level)
  add(geo, matrix, style, skin) {
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
    const c = hexToSRGB(style.color ?? 0xcccccc);
    const layer = style.layer ?? LAYER.BRUSH;
    const scale = Math.round((style.scale ?? 0.6) / 0.05);
    const spec = Math.round((style.spec ?? 0) * 255);
    const w = (style.face ? 1 : 0) + 4 * Math.round(Math.min(8, style.emit ?? 0) * 4);
    const id = style.id ?? 0.5;
    const slot = style.slot ?? 6;
    if (matrix) _m3.getNormalMatrix(matrix);
    const base = this.count;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i); if (matrix) _v.applyMatrix4(matrix);
      _n.fromBufferAttribute(N, i); if (matrix) _n.applyMatrix3(_m3); _n.normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      if (UV) this.uv.push(UV.getX(i), UV.getY(i)); else this.uv.push(0, 0);
      this.col.push(c[0], c[1], c[2], id);
      this.mat.push(layer, scale, spec, w);
      this.slot.push(slot);
      if (typeof skin === 'function') {
        const [b0, w0, b1, w1] = skin(_v);
        this.si.push(b0, b1 ?? 0, 0, 0); this.sw.push(w0, w1 ?? 0, 0, 0);
      } else { this.si.push(skin, 0, 0, 0); this.sw.push(1, 0, 0, 0); }
    }
    if (geo.index) { const I = geo.index.array; for (let k = 0; k < I.length; k++) this.idx.push(base + I[k]); }
    else for (let k = 0; k < P.count; k++) this.idx.push(base + k);
    this.count += P.count;
  }
  build({ skinned = true } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 4));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 4));
    if (skinned) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    } else {
      // crowd: bone (rigid) and colour slot
      const bone = new Float32Array(this.count * 2);
      for (let i = 0; i < this.count; i++) { bone[i * 2] = this.si[i * 4]; bone[i * 2 + 1] = this.slot[i]; }
      g.setAttribute('aBone', new THREE.BufferAttribute(bone, 2));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------ part shapes
// Tapered tube from a to b with rounded ends. profile(t) optionally scales the radius.
export function limb(a, b, ra, rb, { sides = 10, rings = 6, flat = 1, capA = true, capB = true, profile = null } = {}) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a), B = b.isVector3 ? b : new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const pts = [];
  const capSeg = 4;
  if (capA) for (let i = 0; i <= capSeg; i++) { const t = (i / capSeg) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(t) * ra + 1e-4, -Math.cos(t) * ra * 0.8)); }
  else pts.push(new THREE.Vector2(1e-4, 0), new THREE.Vector2(ra, 0));
  for (let i = 1; i < rings; i++) {
    const t = i / rings;
    let r = ra + (rb - ra) * t;
    if (profile) r *= profile(t);
    pts.push(new THREE.Vector2(r, t * len));
  }
  if (capB) for (let i = 0; i <= capSeg; i++) { const t = (i / capSeg) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(t) * rb + 1e-4, len + Math.sin(t) * rb * 0.8)); }
  else pts.push(new THREE.Vector2(rb, len), new THREE.Vector2(1e-4, len));
  const g = new THREE.LatheGeometry(pts, sides);
  if (flat !== 1) g.scale(1, 1, flat);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  g.computeVertexNormals();
  return g;
}

export function ellipsoid(c, r, { w = 14, h = 10, rot = null } = {}) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(r[0], r[1], r[2]);
  if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
  g.translate(c[0], c[1], c[2]);
  return g;
}

// vertical loft through elliptical rings [{y, rx, rz, cx, cz, open}] with caps
export function loft(rings, { sides = 16, capTop = true, capBottom = true, frontFlat = 0 } = {}) {
  const pos = [], idx = [];
  rings.forEach((r) => {
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      let x = Math.sin(a) * r.rx, z = Math.cos(a) * r.rz;
      if (frontFlat && z > 0) z *= 1 - frontFlat;
      pos.push((r.cx || 0) + x, r.y, (r.cz || 0) + z);
    }
  });
  const row = sides + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  let p = pos.slice();
  const addCap = (ringI, up) => {
    const r = rings[ringI];
    const ci = p.length / 3;
    p.push(r.cx || 0, r.y, r.cz || 0);
    for (let s = 0; s < sides; s++) {
      const a = ringI * row + s, b = a + 1;
      if (up) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capBottom) addCap(0, false);
  if (capTop) addCap(rings.length - 1, true);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  // flip if winding is inverted (we want outward normals): test first quad
  g.computeVertexNormals();
  const n = g.attributes.normal, P = g.attributes.position;
  const test = new THREE.Vector3(P.getX(0), 0, P.getZ(0));
  if (test.dot(new THREE.Vector3(n.getX(0), 0, n.getZ(0))) < 0) {
    const I = g.index.array;
    for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

// head: ellipsoid with a UV projection of the face texture onto the front
export function headGeo(c, r, { w = 24, h = 18, jaw = 0.12, chin = 0.2 } = {}) {
  const g = new THREE.SphereGeometry(1, w, h);
  const P = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    // narrower jaw and a slightly pointed chin
    if (y < 0) { const k = 1 - jaw * (-y); x *= k; z *= 1 - jaw * 0.5 * (-y); if (z > 0) y -= chin * Math.max(0, z) * (-y) * 0.5; }
    // flatter face front, fuller cranium at the back
    if (z > 0.3) z = 0.3 + (z - 0.3) * 0.85;
    P.setXYZ(i, x * r[0] + c[0], y * r[1] + c[1], z * r[2] + c[2]);
    // cylindrical UV around the front: u in [0,1] for +-80 degrees
    const ang = Math.atan2(x, z);
    uv.setXY(i, 0.5 + ang / (Math.PI * 0.9), 0.5 + y * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

// helper for blended weights along a segment between two joints
export function blendAlong(a, b, boneA, boneB, t0 = 0.35, t1 = 0.65) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a), B = b.isVector3 ? b : new THREE.Vector3(...b);
  const d = B.clone().sub(A), L2 = d.lengthSq();
  return (v) => {
    const t = Math.max(0, Math.min(1, v.clone().sub(A).dot(d) / L2));
    const w = t <= t0 ? 0 : t >= t1 ? 1 : (t - t0) / (t1 - t0);
    const s = w * w * (3 - 2 * w);
    return [boneA, 1 - s, boneB, s];
  };
}
