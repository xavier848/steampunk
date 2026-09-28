// Post pipeline: turns the toon-lit HDR frame into a painting.
//   main MRT pass  -> tone (filmic, gamma)  -> structure tensor -> blur
//   -> anisotropic Kuwahara (8 sectors, polynomial weights)
//   -> composite: ink lines from depth + normals (thinner far away), bloom,
//      light shafts, complementary grade, canvas weave, vignette, titles, fade.
import * as THREE from 'three';

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const HEAD = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 oFrag;
`;

function passMat(frag, uniforms = {}, defines = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: HEAD + frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  });
}

// ------------------------------------------------------------------ shaders
const TONE = /* glsl */ `
uniform sampler2D tSrc; uniform float uExposure;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = max(texture(tSrc, vUv).rgb, 0.0) * uExposure;
  c = aces(c);
  c = pow(c, vec3(1.0 / 2.2));
  oFrag = vec4(c, 1.0);
}`;

const TENSOR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-1, -1)).rgb;
  vec3 b = texture(tSrc, vUv + uTexel * vec2( 0, -1)).rgb;
  vec3 c = texture(tSrc, vUv + uTexel * vec2( 1, -1)).rgb;
  vec3 d = texture(tSrc, vUv + uTexel * vec2(-1,  0)).rgb;
  vec3 f = texture(tSrc, vUv + uTexel * vec2( 1,  0)).rgb;
  vec3 g = texture(tSrc, vUv + uTexel * vec2(-1,  1)).rgb;
  vec3 h = texture(tSrc, vUv + uTexel * vec2( 0,  1)).rgb;
  vec3 i = texture(tSrc, vUv + uTexel * vec2( 1,  1)).rgb;
  vec3 u = (-a - 2.0 * d - g + c + 2.0 * f + i) * 0.25;
  vec3 v = (-a - 2.0 * b - c + g + 2.0 * h + i) * 0.25;
  oFrag = vec4(dot(u, u), dot(v, v), dot(u, v), 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir;
void main() {
  // 9 tap gaussian (sigma ~2) using linear sampling offsets
  vec4 s = texture(tSrc, vUv) * 0.2270270270;
  s += texture(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  s += texture(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  s += texture(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  s += texture(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  oFrag = s;
}`;

// Anisotropic Kuwahara with polynomial sector weights (Kyprianidis et al.)
const KUWAHARA = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tTensor; uniform vec2 uTexel;
uniform float uRadius; uniform float uQ; uniform float uAlpha;
void main() {
  vec3 g = texture(tTensor, vUv).xyz;
  float disc = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
  float l1 = 0.5 * (g.y + g.x + disc);
  float l2 = 0.5 * (g.y + g.x - disc);
  vec2 tv = vec2(l1 - g.x, -g.z);
  vec2 t = dot(tv, tv) > 1e-12 ? normalize(tv) : vec2(0.0, 1.0);
  float A = (l1 + l2) > 1e-9 ? (l1 - l2) / (l1 + l2) : 0.0;
  float phi = -atan(t.y, t.x);
  float a = uRadius * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = uRadius * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 R = mat2(cp, -sp, sp, cp);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  int mx = int(ceil(sqrt(a * a * cp * cp + b * b * sp * sp)));
  int my = int(ceil(sqrt(a * a * sp * sp + b * b * cp * cp)));
  const float zeta = 0.33;
  const float zc = 0.3927;
  float szc = sin(zc);
  float eta = (zeta + cos(zc)) / (szc * szc);
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; ++k) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  for (int j = -my; j <= my; ++j) {
    for (int i = -mx; i <= mx; ++i) {
      vec2 v = SR * vec2(float(i), float(j));
      float vv = dot(v, v);
      if (vv > 0.25) continue;
      vec3 c = texture(tSrc, vUv + vec2(float(i), float(j)) * uTexel).rgb;
      vec3 cc = c * c;
      float w[8]; float z, vxx, vyy, sum = 0.0;
      vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
      z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
      vec2 r = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * r.x * r.x; vyy = zeta - eta * r.y * r.y;
      z = max(0.0, r.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -r.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -r.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, r.x + vyy); w[7] = z * z; sum += w[7];
      float gw = exp(-3.125 * vv) / max(sum, 1e-6);
      for (int k = 0; k < 8; ++k) { float wk = w[k] * gw; m[k] += vec4(c * wk, wk); s[k] += cc * wk; }
    }
  }
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; ++k) {
    if (m[k].w < 1e-6) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 var = abs(s[k] / m[k].w - mean * mean);
    float sigma2 = var.r + var.g + var.b;
    float wk = 1.0 / (1.0 + pow(1000.0 * sigma2 + 1e-6, 0.5 * uQ));
    o += vec4(mean * wk, wk);
  }
  vec3 res = o.w > 1e-6 ? o.rgb / o.w : texture(tSrc, vUv).rgb;
  oFrag = vec4(res, 1.0);
}`;

// Bloom
const BRIGHT = /* glsl */ `
uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee; uniform vec2 uTexel;
vec3 pre(vec2 uv) {
  vec3 c = min(max(texture(tSrc, uv).rgb, 0.0), vec3(24.0));
  float br = max(max(c.r, c.g), c.b);
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * contrib;
}
void main() {
  // 4 tap box downsample of the prefiltered colour
  vec3 s = pre(vUv + uTexel * vec2(-0.5, -0.5)) + pre(vUv + uTexel * vec2(0.5, -0.5))
         + pre(vUv + uTexel * vec2(-0.5, 0.5)) + pre(vUv + uTexel * vec2(0.5, 0.5));
  oFrag = vec4(s * 0.25, 1.0);
}`;
const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-2, 2)).rgb;
  vec3 b = texture(tSrc, vUv + uTexel * vec2(0, 2)).rgb;
  vec3 c = texture(tSrc, vUv + uTexel * vec2(2, 2)).rgb;
  vec3 d = texture(tSrc, vUv + uTexel * vec2(-2, 0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + uTexel * vec2(2, 0)).rgb;
  vec3 g = texture(tSrc, vUv + uTexel * vec2(-2, -2)).rgb;
  vec3 h = texture(tSrc, vUv + uTexel * vec2(0, -2)).rgb;
  vec3 i = texture(tSrc, vUv + uTexel * vec2(2, -2)).rgb;
  vec3 j = texture(tSrc, vUv + uTexel * vec2(-1, 1)).rgb;
  vec3 k = texture(tSrc, vUv + uTexel * vec2(1, 1)).rgb;
  vec3 l = texture(tSrc, vUv + uTexel * vec2(-1, -1)).rgb;
  vec3 m = texture(tSrc, vUv + uTexel * vec2(1, -1)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  oFrag = vec4(o, 1.0);
}`;
const UP = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uMix;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-1, 1)).rgb;
  vec3 b = texture(tSrc, vUv + uTexel * vec2(0, 1)).rgb * 2.0;
  vec3 c = texture(tSrc, vUv + uTexel * vec2(1, 1)).rgb;
  vec3 d = texture(tSrc, vUv + uTexel * vec2(-1, 0)).rgb * 2.0;
  vec3 e = texture(tSrc, vUv).rgb * 4.0;
  vec3 f = texture(tSrc, vUv + uTexel * vec2(1, 0)).rgb * 2.0;
  vec3 g = texture(tSrc, vUv + uTexel * vec2(-1, -1)).rgb;
  vec3 h = texture(tSrc, vUv + uTexel * vec2(0, -1)).rgb * 2.0;
  vec3 i = texture(tSrc, vUv + uTexel * vec2(1, -1)).rgb;
  vec3 up = (a + b + c + d + e + f + g + h + i) / 16.0;
  oFrag = vec4(texture(tPrev, vUv).rgb + up * uMix, 1.0);
}`;

// Light shafts: occlusion mask from sky depth near the sun, then radial blur
const RAYMASK = /* glsl */ `
uniform sampler2D tND; uniform sampler2D tCol; uniform vec2 uSun; uniform float uAspect; uniform float uFar;
void main() {
  float d = texture(tND, vUv).w;
  float sky = step(uFar, d);
  vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
  float glow = exp(-dot(dv, dv) * 9.0);
  vec3 c = min(texture(tCol, vUv).rgb, vec3(4.0));
  float br = max(0.0, max(c.r, max(c.g, c.b)) - 0.9);
  oFrag = vec4(vec3(sky * glow * (0.6 + br) + br * 0.05 * (1.0 - sky)), 1.0);
}`;
const RAYBLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uSun; uniform float uDensity; uniform float uDecay;
void main() {
  vec2 delta = (vUv - uSun) * uDensity / 40.0;
  vec2 uv = vUv;
  float illum = 1.0, acc = 0.0;
  for (int i = 0; i < 40; i++) {
    uv -= delta;
    acc += texture(tSrc, clamp(uv, 0.0, 1.0)).r * illum;
    illum *= uDecay;
  }
  oFrag = vec4(vec3(acc / 40.0), 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tPaint; uniform sampler2D tND; uniform sampler2D tHDR; uniform sampler2D tBloom; uniform sampler2D tRays;
uniform sampler2D tWeave; uniform sampler2D tTitle;
uniform vec2 uTexel; uniform vec2 uRes;
uniform vec3 uInk; uniform float uInkOpacity; uniform float uInkNear; uniform float uInkFar; uniform float uInkD0; uniform float uInkD1; uniform float uInkFade;
uniform float uBloom; uniform vec3 uRayColor; uniform float uRays;
uniform vec3 uShadowTone; uniform vec3 uHighTone; uniform float uToneAmt; uniform float uContrast; uniform float uSat;
uniform float uVignette; uniform vec3 uVignetteColor; uniform float uCanvas; uniform float uFade; uniform vec3 uFadeColor;
uniform vec4 uTitleRect; uniform float uTitleOpacity;
uniform float uLift;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec3 col = texture(tPaint, vUv).rgb;
  // ---------------------------------------------------------------- ink lines
  vec4 nd0 = texture(tND, vUv);
  float d0 = max(nd0.w, 1e-3);
  float id0 = texture(tHDR, vUv).a;
  float wpx = mix(uInkNear, uInkFar, smoothstep(uInkD0, uInkD1, d0));
  vec2 o = uTexel * wpx;
  float ink = 0.0;
  vec2 offs[8];
  offs[0] = vec2(1, 0); offs[1] = vec2(-1, 0); offs[2] = vec2(0, 1); offs[3] = vec2(0, -1);
  offs[4] = vec2(0.7, 0.7); offs[5] = vec2(-0.7, 0.7); offs[6] = vec2(0.7, -0.7); offs[7] = vec2(-0.7, -0.7);
  float nEdge = 0.0, dEdge = 0.0, iEdge = 0.0;
  for (int k = 0; k < 8; k++) {
    vec2 uv = vUv + offs[k] * o;
    vec4 nd = texture(tND, uv);
    float dk = max(nd.w, 1e-3);
    // silhouette: neighbour is clearly behind us (line drawn on the front object)
    float rel = (dk - d0) / d0;
    dEdge = max(dEdge, smoothstep(0.035, 0.09, rel));
    // creases
    float nd_ = dot(nd0.xyz, nd.xyz);
    nEdge = max(nEdge, smoothstep(0.55, 0.3, nd_) * step(abs(rel), 0.08));
    float idk = texture(tHDR, uv).a;
    iEdge = max(iEdge, step(0.004, abs(idk - id0)) * step(-0.01, rel));
  }
  ink = max(dEdge, max(nEdge * 0.85, iEdge * 0.9));
  float far = smoothstep(uInkD1 * 0.6, uInkFade, d0);
  ink *= (1.0 - far) * uInkOpacity;
  // lines pick up a little of the local colour so they read as paint, not vector strokes
  vec3 inkCol = mix(uInk, col * 0.35, 0.25);
  col = mix(col, inkCol, clamp(ink, 0.0, 1.0));

  // ---------------------------------------------------------------- bloom and shafts
  vec3 bl = texture(tBloom, vUv).rgb * uBloom;
  bl = 1.0 - exp(-bl);
  col = 1.0 - (1.0 - col) * (1.0 - bl);
  float r = texture(tRays, vUv).r * uRays;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(uRayColor * r, 0.0, 1.0));

  // ---------------------------------------------------------------- grade
  float l = lum(col);
  col += uShadowTone * uToneAmt * (1.0 - smoothstep(0.0, 0.55, l)) * 0.6;
  col += uHighTone * uToneAmt * smoothstep(0.45, 1.0, l) * 0.35;
  col = (col - 0.5) * uContrast + 0.5;
  float l2 = lum(col);
  col = mix(vec3(l2), col, uSat);
  col = max(col, vec3(0.0)) + uLift;

  // ---------------------------------------------------------------- canvas weave
  vec2 wuv = vUv * uRes / 256.0;
  float w = texture(tWeave, wuv).r - 0.5;
  float wx = texture(tWeave, wuv + vec2(1.0 / 256.0, 0.0)).r - 0.5;
  col *= 1.0 + w * uCanvas + (w - wx) * uCanvas * 0.8;

  // ---------------------------------------------------------------- vignette
  vec2 q = vUv - 0.5;
  float vig = smoothstep(0.35, 0.95, length(q * vec2(1.25, 1.0)));
  col = mix(col, col * uVignetteColor, vig * uVignette);

  // ---------------------------------------------------------------- titles
  if (uTitleOpacity > 0.0) {
    vec2 tuv = (vUv - uTitleRect.xy) / uTitleRect.zw;
    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      vec4 t = texture(tTitle, tuv);
      col = mix(col, t.rgb, t.a * uTitleOpacity);
    }
  }
  col = mix(uFadeColor, col, uFade);
  oFrag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ------------------------------------------------------------------ pipeline
export class Post {
  constructor(renderer, { weave } = {}) {
    this.r = renderer;
    this.w = 2; this.h = 2;
    this.samples = 4;
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(g, null);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);

    const HF = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtMain = new THREE.WebGLRenderTarget(2, 2, { count: 2, type: THREE.HalfFloatType, samples: this.samples, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rtTone = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtT1 = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtT2 = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtKuwa = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtToneS = new THREE.WebGLRenderTarget(2, 2, HF);
    this.bloomRT = [];
    for (let i = 0; i < 6; i++) this.bloomRT.push(new THREE.WebGLRenderTarget(2, 2, HF));
    this.bloomUp = [];
    for (let i = 0; i < 6; i++) this.bloomUp.push(new THREE.WebGLRenderTarget(2, 2, HF));
    this.rtRayMask = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtRays = new THREE.WebGLRenderTarget(2, 2, HF);
    this.rtOut = null;

    this.mTone = passMat(TONE, { tSrc: { value: null }, uExposure: { value: 1 } });
    this.mTensor = passMat(TENSOR, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mBlur = passMat(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mKuwa = passMat(KUWAHARA, { tSrc: { value: null }, tTensor: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 4 }, uQ: { value: 8 }, uAlpha: { value: 1 } });
    this.mBright = passMat(BRIGHT, { tSrc: { value: null }, uThreshold: { value: 1.1 }, uKnee: { value: 0.5 }, uTexel: { value: new THREE.Vector2() } });
    this.mDown = passMat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = passMat(UP, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
    this.mRayMask = passMat(RAYMASK, { tND: { value: null }, tCol: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uFar: { value: 5000 } });
    this.mRayBlur = passMat(RAYBLUR, { tSrc: { value: null }, uSun: { value: new THREE.Vector2() }, uDensity: { value: 0.9 }, uDecay: { value: 0.965 } });
    this.blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); this.blackTex.needsUpdate = true;
    this.mComp = passMat(COMPOSITE, {
      tPaint: { value: null }, tND: { value: null }, tHDR: { value: null }, tBloom: { value: null }, tRays: { value: null },
      tWeave: { value: weave }, tTitle: { value: this.blackTex },
      uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
      uInk: { value: new THREE.Color(0x24130c) }, uInkOpacity: { value: 0.9 }, uInkNear: { value: 1.3 }, uInkFar: { value: 0.6 },
      uInkD0: { value: 4 }, uInkD1: { value: 60 }, uInkFade: { value: 400 },
      uBloom: { value: 0.9 }, uRayColor: { value: new THREE.Color(1.0, 0.72, 0.42) }, uRays: { value: 0.8 },
      uShadowTone: { value: new THREE.Color(-0.02, 0.03, 0.09) }, uHighTone: { value: new THREE.Color(0.09, 0.03, -0.06) }, uToneAmt: { value: 1 },
      uContrast: { value: 1.08 }, uSat: { value: 1.12 }, uLift: { value: 0.0 },
      uVignette: { value: 0.45 }, uVignetteColor: { value: new THREE.Color(0.55, 0.45, 0.62) }, uCanvas: { value: 0.07 },
      uFade: { value: 1 }, uFadeColor: { value: new THREE.Color(0, 0, 0) },
      uTitleRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uTitleOpacity: { value: 0 },
    });
    this.params = {
      exposure: 1.0, kuwaRadius: 3, kuwaQ: 8, kuwaOn: true, bloom: 0.9, bloomThreshold: 1.1,
      rays: 0.8, sunScreen: null, far: 5000, kuwaScale: 0.5,
    };
  }
  setSize(w, h, force = false) {
    if (w === this.w && h === this.h && !force) return;
    this.w = w; this.h = h;
    this.rtMain.setSize(w, h);
    this.rtTone.setSize(w, h);
    const ks = this.params.kuwaScale;
    const kw = Math.max(2, Math.round(w * ks)), kh = Math.max(2, Math.round(h * ks));
    this.kw = kw; this.kh = kh;
    this.rtToneS.setSize(kw, kh);
    this.rtT1.setSize(kw, kh); this.rtT2.setSize(kw, kh);
    this.rtKuwa.setSize(kw, kh);
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6; i++) { this.bloomRT[i].setSize(Math.max(1, bw), Math.max(1, bh)); this.bloomUp[i].setSize(Math.max(1, bw), Math.max(1, bh)); bw >>= 1; bh >>= 1; }
    this.rtRayMask.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.rtRays.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }
  _run(mat, target, label) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.fsScene, this.fsCam);
    if (this.prof) this._mark(label || 'pass');
  }
  _mark(label) {
    const gl = this.r.getContext();
    // readPixels forces the GPU process to finish all queued work (finish() does not)
    const px = this._px || (this._px = new Uint8Array(16));
    const rt = this.r.getRenderTarget();
    if (rt && rt.texture && rt.texture.type === THREE.HalfFloatType) {
      const f = this._pxf || (this._pxf = new Uint16Array(4));
      this.r.readRenderTargetPixels(rt, 0, 0, 1, 1, f);
    } else if (rt) { /* depth-only or byte targets */ try { this.r.readRenderTargetPixels(rt, 0, 0, 1, 1, px); } catch (e) {} }
    else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const now = performance.now();
    this.prof[label] = (this.prof[label] || 0) + (now - this._t);
    this._t = now;
  }
  renderScene(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.rtMain);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    if (this.prof) this._mark('scene');
  }
  // full post chain; target null = canvas
  finish(target = null) {
    const p = this.params;
    const W = this.w, H = this.h;
    const hdr = this.rtMain.textures[0], nd = this.rtMain.textures[1];
    // tone
    this.mTone.uniforms.tSrc.value = hdr;
    this.mTone.uniforms.uExposure.value = p.exposure;
    this._run(this.mTone, this.rtTone, 'tone');
    let paint = this.rtTone.texture;
    if (p.kuwaOn) {
      const KW = this.kw, KH = this.kh;
      let src = this.rtTone.texture;
      if (KW !== W) {
        // downsample the toned image for the painterly pass
        this.mDown.uniforms.tSrc.value = this.rtTone.texture;
        this.mDown.uniforms.uTexel.value.set(0.5 / W, 0.5 / H);
        this._run(this.mDown, this.rtToneS, 'downsample');
        src = this.rtToneS.texture;
      }
      this.mTensor.uniforms.tSrc.value = src;
      this.mTensor.uniforms.uTexel.value.set(1 / KW, 1 / KH);
      this._run(this.mTensor, this.rtT1, 'tensor');
      this.mBlur.uniforms.tSrc.value = this.rtT1.texture; this.mBlur.uniforms.uDir.value.set(1 / KW, 0);
      this._run(this.mBlur, this.rtT2);
      this.mBlur.uniforms.tSrc.value = this.rtT2.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / KH);
      this._run(this.mBlur, this.rtT1);
      const k = this.mKuwa.uniforms;
      k.tSrc.value = src; k.tTensor.value = this.rtT1.texture; k.uTexel.value.set(1 / KW, 1 / KH);
      k.uRadius.value = p.kuwaRadius; k.uQ.value = p.kuwaQ;
      this._run(this.mKuwa, this.rtKuwa, 'kuwahara');
      paint = this.rtKuwa.texture;
    }
    // bloom
    let src = hdr;
    this.mBright.uniforms.tSrc.value = hdr;
    this.mBright.uniforms.uThreshold.value = p.bloomThreshold;
    this.mBright.uniforms.uTexel.value.set(1 / W, 1 / H);
    this._run(this.mBright, this.bloomRT[0], 'bloom');
    for (let i = 1; i < 6; i++) {
      this.mDown.uniforms.tSrc.value = this.bloomRT[i - 1].texture;
      this.mDown.uniforms.uTexel.value.set(1 / this.bloomRT[i - 1].width, 1 / this.bloomRT[i - 1].height);
      this._run(this.mDown, this.bloomRT[i]);
    }
    // upsample: bloomUp[5] = bloomRT[5]; bloomUp[i] = bloomRT[i] + up(bloomUp[i+1])
    let prevTex = this.bloomRT[5].texture;
    for (let i = 4; i >= 0; i--) {
      const u = this.mUp.uniforms;
      u.tSrc.value = prevTex; u.tPrev.value = this.bloomRT[i].texture;
      u.uTexel.value.set(1 / this.bloomRT[i + 1].width, 1 / this.bloomRT[i + 1].height);
      u.uMix.value = 1.0;
      this._run(this.mUp, this.bloomUp[i]);
      prevTex = this.bloomUp[i].texture;
    }
    // light shafts
    let raysOn = 0;
    if (p.sunScreen && p.rays > 0) {
      const s = p.sunScreen;
      if (s.x > -0.6 && s.x < 1.6 && s.y > -0.6 && s.y < 1.6 && s.z > 0) {
        raysOn = 1;
        const m = this.mRayMask.uniforms;
        m.tND.value = nd; m.tCol.value = hdr; m.uSun.value.set(s.x, s.y); m.uAspect.value = W / H; m.uFar.value = p.far;
        this._run(this.mRayMask, this.rtRayMask);
        const b = this.mRayBlur.uniforms;
        b.tSrc.value = this.rtRayMask.texture; b.uSun.value.set(s.x, s.y);
        this._run(this.mRayBlur, this.rtRays);
      }
    }
    const c = this.mComp.uniforms;
    c.tPaint.value = paint; c.tND.value = nd; c.tHDR.value = hdr; c.tBloom.value = this.bloomUp[0].texture;
    c.tRays.value = raysOn ? this.rtRays.texture : this.blackTex;
    c.uTexel.value.set(1 / W, 1 / H); c.uRes.value.set(W, H);
    c.uBloom.value = p.bloom; c.uRays.value = raysOn ? p.rays : 0;
    this._run(this.mComp, target, 'composite');
  }
}
