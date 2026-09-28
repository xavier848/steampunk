// Toon materials. Every surface in the film uses one of these shaders, all of them
// share one uniform block (U) so lighting, fog and shadows change in one place.
//
// Render passes (U.uPass):
//   0 = main pass into the MRT target: location 0 = HDR colour (alpha = ink id),
//       location 1 = view space normal (xyz) + linear view depth (w)
//   1 = shadow depth pass (colour output ignored)
import * as THREE from 'three';

const c = (hex) => new THREE.Color(hex);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const U = {
  uTime: { value: 0 },          // story time S
  uFilmTime: { value: 0 },      // film time T
  uPass: { value: 0 },
  uCamPos: { value: v3(0, 0, 0) },
  uSunDir: { value: v3(-0.8, 0.2, -0.3).normalize() },
  uSunColor: { value: c(0xffb070) },
  uSunInt: { value: 2.4 },
  uSkyAmb: { value: c(0x5a5c9a) },
  uGroundAmb: { value: c(0x4a3530) },
  uAmbInt: { value: 1.0 },
  uShadowTint: { value: c(0x6b4f9a) },
  uRimColor: { value: c(0xffc27a) },
  uRimInt: { value: 1.4 },
  uKeyDir2: { value: v3(0, -1, 0) },
  uKeyColor2: { value: c(0x000000) },
  uFogColor: { value: c(0x8f86b8) },
  uFogSunColor: { value: c(0xffb47a) },
  uFogDensity: { value: 0.0035 },
  uFogFalloff: { value: 0.012 },
  uFogBase: { value: 0 },
  uFogMax: { value: 0.92 },
  uAOLow: { value: 0.62 },
  uAOBase: { value: 0 },
  uAOHeight: { value: 7 },
  uShadowS: { value: null },
  uShadowMatS: { value: new THREE.Matrix4() },
  uShadowSOn: { value: 0 },
  uShadowTexS: { value: 1 / 4096 },
  uShadowBiasS: { value: 0.12 },
  uShadowD: { value: null },
  uShadowMatD: { value: new THREE.Matrix4() },
  uShadowDOn: { value: 0 },
  uShadowTexD: { value: 1 / 2048 },
  uShadowBiasD: { value: 0.05 },
  uPL: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -9999, 0, 1)) },
  uPLC: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uPLN: { value: 0 },
  uBrush: { value: null },
  uEmissiveBoost: { value: 1 },
  uWindowGlow: { value: 1 },
};

// ------------------------------------------------------------------ GLSL chunks
export const GLSL_COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp sampler2DShadow;
uniform float uTime;
uniform float uFilmTime;
uniform int uPass;
uniform vec3 uCamPos;
`;

export const GLSL_LIGHT = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunInt;
uniform vec3 uSkyAmb; uniform vec3 uGroundAmb; uniform float uAmbInt; uniform vec3 uShadowTint;
uniform vec3 uRimColor; uniform float uRimInt;
uniform vec3 uKeyDir2; uniform vec3 uKeyColor2;
uniform vec3 uFogColor; uniform vec3 uFogSunColor; uniform float uFogDensity; uniform float uFogFalloff; uniform float uFogBase; uniform float uFogMax;
uniform float uAOLow; uniform float uAOBase; uniform float uAOHeight;
uniform sampler2DShadow uShadowS; uniform mat4 uShadowMatS; uniform float uShadowSOn; uniform float uShadowTexS; uniform float uShadowBiasS;
uniform sampler2DShadow uShadowD; uniform mat4 uShadowMatD; uniform float uShadowDOn; uniform float uShadowTexD; uniform float uShadowBiasD;
uniform vec4 uPL[8]; uniform vec4 uPLC[8]; uniform int uPLN;
uniform sampler2DArray uBrush;
uniform float uEmissiveBoost;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float shadowTap(sampler2DShadow map, mat4 m, float texel, float nbias, vec3 wp, vec3 N, float spread) {
  vec4 sp = m * vec4(wp + N * nbias, 1.0);
  vec3 p = sp.xyz / sp.w * 0.5 + 0.5;
  if (p.x <= 0.002 || p.x >= 0.998 || p.y <= 0.002 || p.y >= 0.998 || p.z >= 0.999) return 1.0;
  float z = p.z - 0.0006;
  float o = texel * spread;
  float s = texture(map, vec3(p.xy, z));
  s += texture(map, vec3(p.xy + vec2( o,  o), z));
  s += texture(map, vec3(p.xy + vec2(-o,  o), z));
  s += texture(map, vec3(p.xy + vec2( o, -o), z));
  s += texture(map, vec3(p.xy + vec2(-o, -o), z));
  return s * 0.2;
}

float sunShadow(vec3 wp, vec3 N) {
  float s = 1.0;
  if (uShadowSOn > 0.5) s = min(s, shadowTap(uShadowS, uShadowMatS, uShadowTexS, uShadowBiasS, wp, N, 1.2));
  if (uShadowDOn > 0.5) s = min(s, shadowTap(uShadowD, uShadowMatD, uShadowTexD, uShadowBiasD, wp, N, 1.2));
  // painted, slightly crisp edge
  return smoothstep(0.2, 0.8, s);
}

// four soft light bands: 0, .36, .70, 1.0
float toonBands(float x) {
  return 0.36 * smoothstep(0.015, 0.075, x) + 0.34 * smoothstep(0.30, 0.37, x) + 0.30 * smoothstep(0.66, 0.73, x);
}

vec3 hemi(vec3 N) {
  return mix(uGroundAmb, uSkyAmb, clamp(N.y * 0.5 + 0.5, 0.0, 1.0)) * uAmbInt;
}

// albedo in linear space. bias shifts the terminator (painted brush texture).
vec3 toonShade(vec3 albedo, vec3 N, vec3 wp, float bias, float spec, float rimAmt, float shadow, float ao) {
  vec3 V = normalize(uCamPos - wp);
  float ndl = dot(N, uSunDir);
  float x = clamp(ndl * 1.15 + bias, 0.0, 1.0) * shadow;
  float b = toonBands(x);
  vec3 amb = hemi(N) * ao;
  // coloured shadows: push the unlit part toward the shadow tint (violet/petrol)
  vec3 shadowSide = amb * mix(vec3(1.0), uShadowTint * 1.8, 0.35);
  vec3 light = shadowSide + uSunColor * uSunInt * b;
  // secondary key (magma from below, heart glow ...)
  float n2 = dot(N, uKeyDir2);
  light += uKeyColor2 * (0.55 * smoothstep(0.0, 0.12, n2 + bias * 0.5) + 0.45 * smoothstep(0.45, 0.55, n2 + bias * 0.5));
  // local lights (lanterns), banded
  for (int i = 0; i < 8; i++) {
    if (i >= uPLN) break;
    vec3 L = uPL[i].xyz - wp;
    float d = length(L);
    float att = clamp(1.0 - d / uPL[i].w, 0.0, 1.0);
    att *= att;
    float nl = max(dot(N, L / max(d, 1e-4)), 0.0) * 0.8 + 0.2;
    float e = nl * att + bias * 0.2;
    light += uPLC[i].rgb * uPLC[i].w * (0.5 * smoothstep(0.02, 0.08, e) + 0.5 * smoothstep(0.22, 0.3, e));
  }
  vec3 col = albedo * light;
  // rim light: strongest when looking toward the sun (back light)
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float rim = smoothstep(0.58, 0.70, 1.0 - ndv);
  float back = clamp(-dot(V, uSunDir), 0.0, 1.0);
  float side = smoothstep(-0.25, 0.25, ndl);
  col += uRimColor * uRimInt * rim * side * (0.25 + 0.75 * back) * rimAmt * (0.35 + 0.65 * shadow) * (0.35 + luma(albedo));
  // stylised highlight for metal, small and capped so bloom stays tidy
  vec3 H = normalize(uSunDir + V);
  float sp = smoothstep(0.955, 0.975, dot(N, H)) * spec * shadow;
  col += uSunColor * sp * 0.9 * (0.5 + albedo);
  // metals reflect a banded sky
  vec3 R = reflect(-V, N);
  float sky = smoothstep(-0.1, 0.35, R.y);
  col += spec * albedo * mix(uGroundAmb * 0.6, uSkyAmb * 0.9, sky) * 0.6;
  return col;
}

float groundAO(vec3 wp) {
  return mix(uAOLow, 1.0, smoothstep(uAOBase, uAOBase + uAOHeight, wp.y));
}

vec3 applyFog(vec3 col, vec3 wp) {
  vec3 d = wp - uCamPos;
  float dist = length(d);
  vec3 dir = d / max(dist, 1e-4);
  float b = max(uFogFalloff, 1e-5);
  float k = clamp(b * dir.y * dist, -60.0, 60.0);
  float integ = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
  float optical = uFogDensity * exp(clamp(-b * (uCamPos.y - uFogBase), -60.0, 60.0)) * dist * integ;
  float f = 1.0 - exp(-max(optical, 0.0));
  f = min(f, uFogMax);
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0) + 1e-4, 5.0);
  vec3 fc = mix(uFogColor, uFogSunColor, clamp(sunAmt, 0.0, 1.0));
  return mix(col, fc, f);
}

vec4 triBrush(float layer, vec3 wp, vec3 n, float scale) {
  vec3 w = abs(n);
  w = w * w; w = w * w;
  w /= (w.x + w.y + w.z + 1e-5);
  vec3 p = wp / scale;
  vec4 tx = texture(uBrush, vec3(p.zy * vec2(sign(n.x), 1.0), layer));
  vec4 ty = texture(uBrush, vec3(p.xz, layer));
  vec4 tz = texture(uBrush, vec3(p.xy * vec2(-sign(n.z), 1.0), layer));
  return tx * w.x + ty * w.y + tz * w.z;
}
`;

export const GLSL_OUT = /* glsl */ `
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oNormal;
void writeOut(vec3 col, vec3 viewN, float depth, float id) {
  col = clamp(col, 0.0, 60.0);
  oColor = vec4(col, id);
  oNormal = vec4(normalize(viewN + vec3(0.0, 0.0, 1e-5)), depth);
}
`;

// ------------------------------------------------------------------ world
const WORLD_VERT = /* glsl */ `
${GLSL_COMMON}
attribute vec4 aCol;
attribute vec4 aMat;
out vec3 vWP; out vec3 vN; out vec4 vCol; out vec4 vMat; out vec2 vUv; out vec3 vVN; out float vDepth;
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  n = mat3(instanceMatrix) * n;
#endif
  vec4 wp = modelMatrix * lp;
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  vVN = mat3(viewMatrix) * vN;
  vCol = aCol; vMat = aMat; vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;

const WORLD_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_LIGHT}
${GLSL_OUT}
uniform float uWindowGlow;
in vec3 vWP; in vec3 vN; in vec4 vCol; in vec4 vMat; in vec2 vUv; in vec3 vVN; in float vDepth;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN);
  vec3 VN = normalize(vVN);
  if (!gl_FrontFacing) { N = -N; VN = -VN; }
  float layerCode = vMat.x;
  float scale = max(vMat.y * 0.05, 0.05);
  vec4 br;
  if (layerCode >= 99.5) br = texture(uBrush, vec3(vUv / scale, layerCode - 100.0));
  else br = triBrush(layerCode, vWP, N, scale);
  vec3 albedo = pow(vCol.rgb, vec3(2.2)) * (br.rgb * 2.0);
  float bias = (br.a - 0.5) * 0.45;
  float spec = vMat.z / 255.0;
  float emis = vMat.w / 255.0 * 8.0 * uEmissiveBoost;
  float sh = sunShadow(vWP, N);
  float ao = groundAO(vWP);
  vec3 col = toonShade(albedo, N, vWP, bias, spec, 1.0, sh, ao);
  if (emis > 0.0) {
    // windows and lamp glass: flat painted glow with a lighter core
    float core = smoothstep(0.35, 0.75, br.r);
    col = mix(col, albedo * emis * (0.8 + 0.5 * core) * uWindowGlow, clamp(emis, 0.0, 1.0));
  }
  col = applyFog(col, vWP);
  writeOut(col, VN, vDepth, vCol.a);
}`;

export function worldMaterial({ side = THREE.FrontSide, extraUniforms = {}, defines = {} } = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...U, ...extraUniforms },
    vertexShader: WORLD_VERT,
    fragmentShader: WORLD_FRAG,
    side,
    defines,
  });
}

// Generic custom toon material helper: callers provide the vertex body and fragment body.
export function toonMaterial({ vertex, fragment, uniforms = {}, side = THREE.FrontSide, defines = {}, transparent = false, blending, depthWrite = true }) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...U, ...uniforms },
    vertexShader: `${GLSL_COMMON}\n${vertex}`,
    fragmentShader: `${GLSL_COMMON}\n${GLSL_LIGHT}\n${GLSL_OUT}\n${fragment}`,
    side, defines, transparent, depthWrite,
  });
  if (blending) Object.assign(m, blending);
  return m;
}

// Blending that leaves attachment 1 (normals/depth) and the ink id untouched:
// fragment writes oNormal = vec4(0) and alpha channel is preserved.
export const BLEND_ALPHA = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};
export const BLEND_ADD = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};
