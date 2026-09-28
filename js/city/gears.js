// Rotating wall gears: a few gear shapes, instanced, rotated as a function of story time.
import * as THREE from 'three';
import { GeoBuilder, P, M } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { worldMaterial } from '../engine/materials.js';
import { PAL } from './palette.js';
import { LAYER_STATIC_CASTER, LAYER_DYN_CASTER } from '../engine/engine.js';

const VARIANTS = [
  { teeth: 12, spokes: 4, color: PAL.brass },
  { teeth: 18, spokes: 5, color: PAL.copper },
  { teeth: 26, spokes: 6, color: PAL.brassDark },
];

function gearGeo(v) {
  const b = new GeoBuilder();
  b.set({ color: v.color, layer: LAYER.METAL, scale: 1.2, spec: 0.85, emit: 0, id: 0.83 });
  b.add(P.gear(v.teeth, 0.84, 0.22, v.spokes, 0.16), null);
  b.add(P.cyl(14), M(0, 0, 0.05, Math.PI / 2, 0, 0, 0.16, 0.34, 0.16), { color: PAL.iron, layer: LAYER.IRON, spec: 0.5 });
  b.add(P.sphere(8, 6), M(0, 0, 0.22, 0, 0, 0, 0.1), { color: PAL.gold, layer: LAYER.METAL, spec: 0.9 });
  return b.build();
}

export class Gears {
  constructor(list) {
    this.list = list;
    this.group = new THREE.Group();
    this.meshes = VARIANTS.map((v, vi) => {
      const items = list.filter((g) => variantFor(g) === vi);
      const m = new THREE.InstancedMesh(gearGeo(v), worldMaterial(), Math.max(1, items.length));
      m.count = items.length;
      m.userData.items = items;
      m.layers.enable(LAYER_STATIC_CASTER);
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    });
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._m = new THREE.Matrix4(); this._s = new THREE.Vector3();
    this.update(0);
  }
  update(S, cam = null, maxDist = 260) {
    const z = new THREE.Vector3(0, 0, 1);
    for (const mesh of this.meshes) {
      // only gears near the camera are drawn (compacted to the front of the buffer)
      let n = 0;
      for (const g of mesh.userData.items) {
        if (cam && g.pos.distanceTo(cam) > maxDist * Math.max(1, g.r / 1.5)) continue;
        this._q.setFromUnitVectors(z, g.nrm);
        this._q2.setFromAxisAngle(z, (g.phase || 0) + S * g.speed);
        this._q.multiply(this._q2);
        this._m.compose(g.pos, this._q, this._s.set(g.r, g.r, g.r));
        mesh.setMatrixAt(n++, this._m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

function variantFor(g) { return g.r < 0.9 ? 0 : g.r < 1.5 ? 1 : 2; }
