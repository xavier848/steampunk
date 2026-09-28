// Small brass automatons that tend the machine hall: a barrel body on stubby legs, a
// domed head with one big glass eye and a little smoke stack. They waddle (rigid body
// sway and bob) along loops; the one on the catwalk meets Emil.
import * as THREE from 'three';
import { GeoBuilder, P, M } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { worldMaterial } from '../engine/materials.js';
import { LAYER_DYN_CASTER } from '../engine/engine.js';
import { PAL } from '../city/palette.js';

const mat = (color, layer, o = {}) => ({ color, layer, scale: 0.4, spec: 0, emit: 0, id: 0.7, uv: false, ...o });

function bodyGeo() {
  const b = new GeoBuilder();
  b.add(P.lathe('autobody', [[0, 0], [0.2, 0], [0.26, 0.08], [0.28, 0.3], [0.25, 0.52], [0.18, 0.58], [0, 0.58]], 16), M(0, 0.3, 0), mat(PAL.brass, LAYER.METAL, { spec: 0.85, id: 0.7 }));
  for (const y of [0.42, 0.62, 0.8]) b.add(new THREE.TorusGeometry(0.275, 0.018, 5, 18), M(0, y, 0, Math.PI / 2, 0, 0), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.71 }));
  // rivets and a gauge on the belly
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.add(P.sphere(5, 4), M(Math.sin(a) * 0.28, 0.52, Math.cos(a) * 0.28, 0, 0, 0, 0.018), mat(PAL.brassDark, LAYER.METAL, { spec: 0.9, id: 0.71 })); }
  b.add(P.cyl(14), M(0, 0.6, 0.27, Math.PI / 2, 0, 0, 0.08, 0.03, 0.08), mat(0xe8dcc0, LAYER.BRUSH, { id: 0.72 }));
  b.add(P.box(), M(0.02, 0.6, 0.29, 0, 0, 0.7, 0.008, 0.06, 0.006), mat(0x2a1a14, LAYER.BRUSH, { id: 0.72 }));
  // legs and feet
  for (const s of [-1, 1]) {
    b.add(P.cyl(8), M(s * 0.12, 0.17, 0, 0, 0, 0, 0.05, 0.3, 0.05), mat(0x3a3434, LAYER.IRON, { spec: 0.5, id: 0.73 }));
    b.add(P.boxB(), M(s * 0.12, 0, 0.05, 0, 0, 0, 0.13, 0.06, 0.24), mat(PAL.brassDark, LAYER.METAL, { spec: 0.7, id: 0.73 }));
    // arms with pincers
    b.add(P.cyl(8), M(s * 0.31, 0.62, 0.05, 0.5, 0, s * 0.35, 0.035, 0.32, 0.035), mat(0x3a3434, LAYER.IRON, { spec: 0.5, id: 0.74 }));
    b.add(P.sphere(8, 6), M(s * 0.36, 0.48, 0.13, 0, 0, 0, 0.05), mat(PAL.copper, LAYER.METAL, { spec: 0.8, id: 0.74 }));
  }
  return b.build();
}
function headGeo() {
  const b = new GeoBuilder();
  b.add(P.hemi(16, 8), M(0, 0, 0, 0, 0, 0, 0.21, 0.2, 0.21), mat(PAL.copper, LAYER.METAL, { spec: 0.8, id: 0.75 }));
  b.add(P.cyl(16), M(0, -0.01, 0, 0, 0, 0, 0.215, 0.04, 0.215), mat(PAL.brassDark, LAYER.METAL, { spec: 0.8, id: 0.75 }));
  b.add(new THREE.TorusGeometry(0.085, 0.022, 6, 18), M(0, 0.08, 0.17), mat(PAL.brass, LAYER.METAL, { spec: 0.9, id: 0.76 }));
  b.add(P.cyl(8), M(-0.08, 0.2, -0.05, 0, 0, 0.2, 0.03, 0.14, 0.03), mat(0x3a3434, LAYER.IRON, { id: 0.76 }));   // stack
  b.add(P.sphere(6, 4), M(0.1, 0.19, 0.02, 0, 0, 0, 0.03), mat(0xd23a2a, LAYER.GLASS, { emit: 2, id: 0.76 }));    // bulb
  return b.build();
}
function eyeGeo(color) {
  const b = new GeoBuilder();
  b.add(P.sphere(12, 8), M(0, 0.08, 0.175, 0, 0, 0, 0.068, 0.068, 0.04), mat(color, LAYER.GLASS, { emit: 7, spec: 0.9, id: 0.77 }));
  return b.build();
}

export class Automatons {
  // defs: [{ path: (S) => ({pos, yaw, walk, head, pitch, eye}) }]
  constructor(defs) {
    const wm = worldMaterial();
    const body = bodyGeo(), head = headGeo(), eyeR = eyeGeo(0xff5a3a), eyeG = eyeGeo(0xffc860);
    this.group = new THREE.Group();
    this.list = defs.map((d) => {
      const g = new THREE.Group();
      const bm = new THREE.Mesh(body, wm); bm.layers.enable(LAYER_DYN_CASTER);
      const hg = new THREE.Group(); hg.position.y = 0.88;
      const hm = new THREE.Mesh(head, wm); hm.layers.enable(LAYER_DYN_CASTER);
      const er = new THREE.Mesh(eyeR, wm), eg = new THREE.Mesh(eyeG, wm);
      hg.add(hm, er, eg);
      g.add(bm, hg);
      g.scale.setScalar(d.scale || 1);
      this.group.add(g);
      return { def: d, g, head: hg, er, eg };
    });
  }
  update(S) {
    for (const a of this.list) {
      const st = a.def.at(S);
      const w = st.walk || 0, ph = st.phase ?? S * 6;
      a.g.position.copy(st.pos);
      a.g.position.y += Math.abs(Math.sin(ph)) * 0.035 * w;
      a.g.rotation.set(st.pitch || 0, st.yaw, Math.sin(ph) * 0.09 * w, 'YXZ');
      a.head.rotation.set(st.headPitch || 0, st.head || 0, 0, 'YXZ');
      a.er.visible = !st.gold; a.eg.visible = !!st.gold;
      a.g.visible = st.visible !== false;
    }
  }
}
