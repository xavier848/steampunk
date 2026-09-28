// Lantern glass (instanced, per lamp glow for flicker and the final light wave)
// plus the choice of the nearest lamps that act as real toon point lights.
import * as THREE from 'three';
import { toonMaterial, U } from '../engine/materials.js';

const GLASS_VERT = /* glsl */ `
attribute vec4 iPos;   // xyz, glow
attribute vec4 iTint;  // rgb, scale
out vec3 vWP; out vec3 vN; out vec3 vVN; out float vDepth; out float vGlow; out vec3 vTint; out float vY;
void main() {
  vec3 p = position * iTint.w;
  vec4 wp = vec4(iPos.xyz + p, 1.0);
  vWP = wp.xyz; vN = normal; vY = position.y;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * normal;
  vGlow = iPos.w; vTint = iTint.rgb;
  gl_Position = projectionMatrix * mv;
}`;
const GLASS_FRAG = /* glsl */ `
in vec3 vWP; in vec3 vN; in vec3 vVN; in float vDepth; in float vGlow; in vec3 vTint; in float vY;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN);
  // unlit glass: dim amber with a sky reflection; lit: hot core, warm edges
  float sh = 1.0;
  vec3 off = toonShade(vec3(0.35, 0.28, 0.2), N, vWP, 0.0, 0.6, 0.5, sh, 1.0);
  float core = 1.0 - smoothstep(0.0, 0.26, abs(vY));
  vec3 on = vTint * (1.6 + 2.8 * core);
  vec3 col = mix(off, on, clamp(vGlow, 0.0, 1.0)) * max(vGlow, 1.0);
  col = applyFog(col, vWP);
  writeOut(col, normalize(vVN), vDepth, 0.31);
}`;

export class Lamps {
  constructor(anchors, { color = new THREE.Color(1.0, 0.62, 0.28) } = {}) {
    this.anchors = anchors; // [{pos, base (0..1 glow), phase}]
    const n = anchors.length;
    const geo0 = new THREE.CylinderGeometry(0.15, 0.13, 0.42, 6, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = geo0.index;
    g.setAttribute('position', geo0.attributes.position);
    g.setAttribute('normal', geo0.attributes.normal);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.iTint = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.iPos.setUsage(THREE.DynamicDrawUsage);
    anchors.forEach((a, i) => {
      this.iPos.setXYZW(i, a.pos.x, a.pos.y, a.pos.z, a.base ?? 1);
      const c = a.color || color;
      this.iTint.setXYZW(i, c.r, c.g, c.b, a.scale ?? 1);
    });
    g.setAttribute('iPos', this.iPos);
    g.setAttribute('iTint', this.iTint);
    g.instanceCount = n;
    this.mesh = new THREE.Mesh(g, toonMaterial({ vertex: GLASS_VERT, fragment: GLASS_FRAG }));
    this.mesh.frustumCulled = false;
    this.color = color;
    this.glow = new Float32Array(n).fill(1);
  }
  // glowFn(i, anchor) -> 0..1.5 ; focus = world point the lights are chosen around
  update(glowFn, focus, maxLights = 8, lightScale = 1) {
    const n = this.anchors.length;
    for (let i = 0; i < n; i++) {
      const g = glowFn ? glowFn(i, this.anchors[i]) : 1;
      this.glow[i] = g;
      this.iPos.setW(i, g);
    }
    this.iPos.needsUpdate = true;
    // nearest lamps become point lights
    const cand = [];
    for (let i = 0; i < n; i++) {
      if (this.glow[i] < 0.05) continue;
      cand.push([this.anchors[i].pos.distanceToSquared(focus), i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const k = Math.min(maxLights, cand.length);
    for (let j = 0; j < 8; j++) {
      if (j < k) {
        const a = this.anchors[cand[j][1]];
        const g = this.glow[cand[j][1]];
        const c = a.color || this.color;
        U.uPL.value[j].set(a.pos.x, a.pos.y - 0.1, a.pos.z, a.range ?? 7.5);
        U.uPLC.value[j].set(c.r, c.g, c.b, 1.3 * g * lightScale * (a.power ?? 1));
      } else {
        U.uPL.value[j].set(0, -9999, 0, 1);
        U.uPLC.value[j].set(0, 0, 0, 0);
      }
    }
    U.uPLN.value = k;
  }
}
