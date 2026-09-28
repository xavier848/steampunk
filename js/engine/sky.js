// Painted dusk sky: gradient dome with sun and horizon streaks, plus big cumulus
// clouds as camera facing billboards shaded in stepped bands from "puff spheres".
import * as THREE from 'three';
import { GLSL_COMMON, U } from './materials.js';
import { RNG } from '../core/rng.js';

export const SKY = {
  uZenith: { value: new THREE.Color(0x3b4a8c) },
  uMid: { value: new THREE.Color(0x8a7fb8) },
  uHorizon: { value: new THREE.Color(0xf2b48a) },
  uHorizonSun: { value: new THREE.Color(0xffd08a) },
  uBelow: { value: new THREE.Color(0x6d5a78) },
  uSunDisc: { value: new THREE.Color(0xfff0c8) },
  uSunSize: { value: 0.9994 },
  uSunGlow: { value: 1.0 },
  uCloudLit: { value: new THREE.Color(0xffd9a8) },
  uCloudMid: { value: new THREE.Color(0xe39a9a) },
  uCloudShade: { value: new THREE.Color(0x7c6aa6) },
  uCloudDeep: { value: new THREE.Color(0x4f4a86) },
  uCloudRim: { value: new THREE.Color(0xfff2c8) },
  uStreaks: { value: 1.0 },
  uSkyBright: { value: 1.0 },
};

const DOME_VERT = /* glsl */ `
${GLSL_COMMON}
out vec3 vDir;
void main() {
  vDir = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 cp = projectionMatrix * viewMatrix * wp;
  gl_Position = vec4(cp.xy, cp.w * 0.99999, cp.w); // just inside the far plane
}`;

const DOME_FRAG = /* glsl */ `
${GLSL_COMMON}
precision highp sampler2DArray;
uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uHorizonSun; uniform vec3 uBelow;
uniform vec3 uSunDisc; uniform float uSunSize; uniform float uSunGlow; uniform float uStreaks; uniform float uSkyBright;
uniform vec3 uCloudLit; uniform vec3 uCloudMid; uniform vec3 uCloudShade;
uniform sampler2DArray uBrush;
in vec3 vDir;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oNormal;
void main() {
  if (uPass == 1) discard;
  vec3 d = normalize(vDir);
  float h = d.y;
  float sd = dot(d, uSunDir);
  float az = atan(d.z, d.x);
  // stepped, painted gradient
  float t1 = smoothstep(-0.02, 0.22, h);
  float t2 = smoothstep(0.18, 0.75, h);
  vec3 col = mix(uHorizon, uMid, t1);
  col = mix(col, uZenith, t2);
  float sunSide = pow(max(sd, 0.0) + 1e-4, 3.0);
  col = mix(col, uHorizonSun, sunSide * (1.0 - smoothstep(0.0, 0.45, h)) * 0.9);
  // brush texture in sky space breaks the gradient into strokes
  vec4 br = texture(uBrush, vec3(az * 2.2, h * 5.0, 14.0));
  col *= 0.94 + (br.r - 0.5) * 0.22;
  // horizon streak clouds (thin painted strokes lit from the sun side)
  float band = smoothstep(0.015, 0.05, h) * (1.0 - smoothstep(0.10, 0.22, h));
  vec4 st = texture(uBrush, vec3(az * 1.3, h * 26.0, 8.0));
  vec4 st2 = texture(uBrush, vec3(az * 0.7 + 3.1, h * 11.0, 14.0));
  float streak = smoothstep(0.52, 0.6, st.r * 0.6 + st2.r * 0.55) * band * uStreaks;
  vec3 streakCol = mix(uCloudShade, mix(uCloudMid, uCloudLit, sunSide), 0.35 + 0.65 * sunSide);
  col = mix(col, streakCol, streak * 0.85);
  // below horizon: haze
  col = mix(col, uBelow, smoothstep(0.0, -0.08, h));
  // sun: disc with hard painted edge plus layered glow
  float disc = smoothstep(uSunSize, uSunSize + 0.00025, sd);
  float glow = pow(max(sd, 0.0) + 1e-4, 180.0) * 1.6 + pow(max(sd, 0.0) + 1e-4, 18.0) * 0.35;
  col += uSunColor * glow * uSunGlow * 0.9;
  col = mix(col, uSunDisc * 3.2, disc * uSunGlow);
  col *= uSkyBright;
  oColor = vec4(col, 0.0);
  oNormal = vec4(0.0, 0.0, 0.0, 60000.0);
}`;

const CLOUD_VERT = /* glsl */ `
${GLSL_COMMON}
attribute vec4 iCenter;   // xyz, seed
attribute vec4 iSize;     // w, h, flatness, brightness
out vec2 vQ; out float vSeed; out vec3 vSunV; out vec4 vSize; out float vDepth; out vec3 vWP;
uniform vec3 uSunDir;
void main() {
  vec4 mv = viewMatrix * vec4(iCenter.xyz, 1.0);
  vec2 q = position.xy * 2.0;
  mv.xy += q * iSize.xy * 0.5;
  vQ = q; vSeed = iCenter.w; vSize = iSize;
  vSunV = normalize(mat3(viewMatrix) * uSunDir);
  vDepth = -mv.z;
  vWP = iCenter.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const CLOUD_FRAG = /* glsl */ `
${GLSL_COMMON}
precision highp sampler2DArray;
uniform vec3 uCloudLit; uniform vec3 uCloudMid; uniform vec3 uCloudShade; uniform vec3 uCloudDeep; uniform vec3 uCloudRim;
uniform vec3 uFogColor; uniform vec3 uSunColor; uniform float uSkyBright;
uniform sampler2DArray uBrush;
in vec2 vQ; in float vSeed; in vec3 vSunV; in vec4 vSize; in float vDepth; in vec3 vWP;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oNormal;
float h1(float n) { return fract(sin(n * 91.345 + vSeed * 17.13) * 43758.5453); }
void main() {
  if (uPass == 1) discard;
  // painted edge wobble
  vec4 br = texture(uBrush, vec3(vQ * vec2(1.3, 0.9) + vSeed * 3.7, 14.0));
  vec2 q = vQ + (br.rg - 0.5) * 0.07;
  float best = -1.0; vec3 n = vec3(0.0, 0.0, 1.0);
  float asp = vSize.x / vSize.y;
  for (int i = 0; i < 11; i++) {
    float fi = float(i);
    float x = (h1(fi) * 2.0 - 1.0) * 0.62;
    float r = mix(0.26, 0.46, h1(fi + 11.0)) * (1.0 - abs(x) * 0.55);
    float y = -0.35 + r * 0.85 + h1(fi + 23.0) * 0.28 * (1.0 - abs(x));
    vec2 d = (q - vec2(x, y)) * vec2(asp, 1.0) / (r * vec2(asp, 1.0));
    d.x *= 1.0;
    float dd = dot(d, d);
    if (dd < 1.0) {
      float z = sqrt(1.0 - dd) * r + y * 0.35;
      if (z > best) { best = z; n = normalize(vec3(d.x, d.y, sqrt(1.0 - dd) * 1.1)); }
    }
  }
  // flat base
  if (best < 0.0 || q.y < -0.36 + (br.b - 0.5) * 0.04) discard;
  float l = dot(n, vSunV);
  float b1 = smoothstep(-0.25, -0.15, l);
  float b2 = smoothstep(0.18, 0.28, l);
  float b3 = smoothstep(0.55, 0.62, l);
  vec3 col = mix(uCloudDeep, uCloudShade, b1);
  col = mix(col, uCloudMid, b2);
  col = mix(col, uCloudLit, b3);
  // underside darker, rim where puffs face the sun
  col = mix(col, uCloudDeep, smoothstep(-0.1, -0.34, q.y) * 0.5);
  float rim = smoothstep(0.75, 0.95, 1.0 - n.z) * smoothstep(0.0, 0.4, dot(n.xy, vSunV.xy));
  col = mix(col, uCloudRim, rim * 0.8);
  col *= (0.92 + (br.a - 0.5) * 0.2) * vSize.w * uSkyBright;
  // aerial fade to horizon colour for far clouds
  col = mix(col, uFogColor, clamp(vDepth / 9000.0, 0.0, 0.55));
  oColor = vec4(col, 0.0);
  oNormal = vec4(0.0, 0.0, 0.0, 60000.0);
}`;

export function createSky({ radius = 9000, clouds = 46, seed = 5, ring = [1600, 5200], height = [260, 1100], center = [0, 0] } = {}) {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { ...U, ...SKY },
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  dome.frustumCulled = false;
  // drawn after all opaque geometry: early depth test skips every covered pixel
  dome.renderOrder = 20;
  group.add(dome);

  // cloud billboards
  const r = new RNG(seed);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  const cen = new Float32Array(clouds * 4), siz = new Float32Array(clouds * 4);
  const list = [];
  for (let i = 0; i < clouds; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(ring[0], ring[1]);
    const w = r.range(500, 1500) * (d / 3000);
    list.push({ x: center[0] + Math.cos(a) * d, y: r.range(height[0], height[1]) * (0.6 + d / 6000), z: center[1] + Math.sin(a) * d, w, h: w * r.range(0.45, 0.7), seed: r.range(0, 100), b: r.range(0.9, 1.05), d });
  }
  // far to near so overlapping billboards draw in order
  list.sort((p, q) => q.d - p.d);
  list.forEach((c, i) => {
    cen.set([c.x, c.y, c.z, c.seed], i * 4);
    siz.set([c.w, c.h, 0, c.b], i * 4);
  });
  g.setAttribute('iCenter', new THREE.InstancedBufferAttribute(cen, 4));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(siz, 4));
  g.instanceCount = clouds;
  const cloudMesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...U, ...SKY },
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    side: THREE.DoubleSide,
  }));
  cloudMesh.frustumCulled = false;
  cloudMesh.renderOrder = 19;
  group.add(cloudMesh);
  group.userData = { dome, cloudMesh, list };
  return group;
}
