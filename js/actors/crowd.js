// The crowd: five archetypes drawn with GPU instancing. All limb animation happens in
// the vertex shader (walk, run, idle, talk, haggle, startle, head turn, skirt sway);
// the CPU only writes a few numbers per person per frame.
import * as THREE from 'three';
import { toonMaterial } from '../engine/materials.js';
import { LAYER } from '../engine/textures.js';
import { CharBuilder, limb, ellipsoid, loft, headGeo } from './charparts.js';
import { createFaceAtlas, faceCell } from './faces.js';
import { LAYER_DYN_CASTER } from '../engine/engine.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
// bone ids
const PELVIS = 0, CHEST = 1, HEAD = 2, LTH = 3, LSH = 4, RTH = 5, RSH = 6, LAR = 7, LFA = 8, RAR = 9, RFA = 10, SKIRT = 11;
const HAT = (k) => 11 + k;   // 12..16 hat variants 1..5
const PROP = (k) => 16 + k;  // 17..19 prop variants 1..3
// colour slots: 0 skin, 1 main, 2 secondary, 3 accent, 4 dark, 5 shirt white, 6 fixed colour
const SK = 0, MAIN = 1, SEC = 2, ACC = 3, DARK = 4, WHITE = 5, FIX = 6;

const PIV = { // adult pivots (child archetype scales its own)
  hip: 0.93, knee: 0.5, waist: 1.02, neck: 1.5, shoulder: 1.43, elbow: 1.15, hipX: 0.1, shX: 0.2,
};

function body(b, st, { coatLen = 0.6, skirt = false, apron = false, shawl = false, puffed = false, child = false, vest = false, frock = false }) {
  const P = PIV;
  const S = (slot, extra = {}) => ({ color: 0xffffff, layer: LAYER.CLOTH, scale: 0.5, slot, id: 0.3, ...extra });
  // legs (hidden inside long skirts but kept short for the feet)
  for (const s of [1, -1]) {
    const T = s > 0 ? LTH : RTH, Sh = s > 0 ? LSH : RSH;
    const x = s * P.hipX;
    if (!skirt) {
      b.add(limb(v(x, P.hip + 0.02, 0), v(x, P.knee, 0.01), 0.075, 0.058, { sides: 8, rings: 3 }), null, S(SEC, { id: 0.31 }), T);
      b.add(limb(v(x, P.knee, 0.01), v(x, 0.1, 0), 0.056, 0.045, { sides: 8, rings: 3 }), null, S(SEC, { id: 0.31 }), Sh);
    } else {
      b.add(limb(v(x * 0.8, P.knee - 0.1, 0.01), v(x * 0.8, 0.1, 0), 0.045, 0.04, { sides: 6, rings: 2 }), null, S(DARK, { id: 0.31 }), Sh);
    }
    b.add(ellipsoid([x, 0.05, 0.05], [0.055, 0.05, 0.12], { w: 8, h: 6 }), null, S(DARK, { id: 0.32, spec: 0.3 }), Sh);
  }
  // torso
  const waistR = skirt ? 0.12 : 0.15;
  b.add(loft([
    { y: P.hip - 0.02, rx: 0.17, rz: 0.12 }, { y: P.waist, rx: waistR + 0.01, rz: 0.11 }, { y: 1.2, rx: 0.17, rz: 0.12 },
    { y: 1.36, rx: 0.2, rz: 0.12 }, { y: 1.44, rx: 0.16, rz: 0.1 }, { y: 1.5, rx: 0.07, rz: 0.06 },
  ], { sides: 12 }), null, S(MAIN, { id: 0.33 }), (p) => (p.y < P.waist ? [PELVIS, 1] : [CHEST, 1]));
  if (vest) b.add(loft([{ y: P.waist - 0.02, rx: 0.16, rz: 0.12 }, { y: 1.3, rx: 0.19, rz: 0.125 }, { y: 1.4, rx: 0.17, rz: 0.11 }], { sides: 12 }), null, S(ACC, { id: 0.34 }), CHEST);
  // shirt collar + cravat
  b.add(loft([{ y: 1.46, rx: 0.075, rz: 0.07 }, { y: 1.53, rx: 0.065, rz: 0.06 }], { sides: 10 }), null, S(WHITE, { id: 0.35 }), CHEST);
  if (!skirt && !child) b.add(ellipsoid([0, 1.43, 0.1], [0.035, 0.05, 0.02], { w: 6, h: 4 }), null, S(ACC, { id: 0.36 }), CHEST);
  // coat tails / frock skirt (sways with the legs)
  if (frock) b.add(loft([{ y: P.hip - 0.45, rx: 0.2, rz: 0.17, cz: -0.02 }, { y: P.hip - 0.15, rx: 0.19, rz: 0.15 }, { y: P.hip + 0.05, rx: 0.175, rz: 0.125 }], { sides: 12, capTop: false, capBottom: true }), null, S(MAIN, { id: 0.33 }), SKIRT);
  else if (!skirt && coatLen > 0.2) b.add(loft([{ y: P.hip - coatLen * 0.5, rx: 0.19, rz: 0.15 }, { y: P.hip + 0.05, rx: 0.175, rz: 0.125 }], { sides: 12, capTop: false }), null, S(MAIN, { id: 0.33 }), SKIRT);
  if (skirt) {
    b.add(loft([{ y: 0.03, rx: 0.34, rz: 0.32 }, { y: 0.35, rx: 0.28, rz: 0.26 }, { y: 0.7, rx: 0.2, rz: 0.18 }, { y: P.waist + 0.02, rx: waistR + 0.015, rz: 0.115 }], { sides: 16, capTop: false }), null, S(SEC, { id: 0.37 }), SKIRT);
  }
  if (apron) b.add(loft([{ y: 0.25, rx: 0.2, rz: 0.03, cz: skirt ? 0.25 : 0.14 }, { y: 0.7, rx: 0.17, rz: 0.03, cz: skirt ? 0.19 : 0.13 }, { y: P.waist + 0.02, rx: 0.15, rz: 0.02, cz: 0.12 }], { sides: 8 }), null, S(ACC, { id: 0.38 }), SKIRT);
  if (shawl) b.add(loft([{ y: 1.2, rx: 0.2, rz: 0.14 }, { y: 1.38, rx: 0.23, rz: 0.15 }, { y: 1.48, rx: 0.12, rz: 0.09 }], { sides: 12 }), null, S(ACC, { id: 0.39 }), CHEST);
  // arms
  for (const s of [1, -1]) {
    const A = s > 0 ? LAR : RAR, F = s > 0 ? LFA : RFA;
    const sx = s * P.shX;
    const r0 = puffed ? 0.1 : 0.075;
    b.add(limb(v(sx, P.shoulder, 0), v(sx + s * 0.02, P.elbow, 0), r0, 0.062, { sides: 8, rings: 3 }), null, S(MAIN, { id: 0.33 }), A);
    b.add(limb(v(sx + s * 0.02, P.elbow, 0), v(sx + s * 0.025, 0.9, 0.01), 0.06, 0.05, { sides: 8, rings: 3 }), null, S(MAIN, { id: 0.33 }), F);
    b.add(ellipsoid([sx + s * 0.025, 0.83, 0.015], [0.042, 0.07, 0.052], { w: 8, h: 6 }), null, S(SK, { id: 0.4 }), F);
  }
  // head
  b.add(limb(v(0, 1.48, 0), v(0, 1.58, 0.01), 0.05, 0.048, { sides: 8, rings: 2 }), null, S(SK, { id: 0.41 }), HEAD);
  b.add(headGeo([0, 1.66, 0.012], [0.098, 0.115, 0.105], { w: 14, h: 10 }), null, { color: 0xffffff, face: 1, slot: SK, id: 0.42 }, HEAD);
  b.add(ellipsoid([0, 1.645, 0.11], [0.018, 0.022, 0.024], { w: 6, h: 4 }), null, S(SK, { id: 0.42 }), HEAD);
  // hair at the back of the head
  b.add(ellipsoid([0, 1.705, -0.05], [0.097, 0.092, 0.075], { w: 10, h: 8 }), null, S(DARK, { id: 0.43, layer: LAYER.BRUSH }), HEAD);
}

function hats(b, { female = false }) {
  const S = (slot, extra = {}) => ({ color: 0xffffff, layer: LAYER.CLOTH, scale: 0.4, slot, id: 0.45, ...extra });
  if (!female) {
    // 1 top hat (Zylinder)
    b.add(new THREE.CylinderGeometry(0.108, 0.098, 0.3, 12).translate(0, 1.91, 0.0), null, S(DARK, { spec: 0.3 }), HAT(1));
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.018, 14).translate(0, 1.765, 0.0), null, S(DARK, { spec: 0.3 }), HAT(1));
    b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.045, 12).translate(0, 1.8, 0.0), null, S(ACC), HAT(1));
    // 2 bowler
    b.add(new THREE.SphereGeometry(0.105, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.95, 1.05).translate(0, 1.76, 0.0), null, S(DARK, { spec: 0.3 }), HAT(2));
    b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 14).translate(0, 1.76, 0.0), null, S(DARK), HAT(2));
    // 3 flat cap
    b.add(ellipsoid([0, 1.765, 0.02], [0.115, 0.05, 0.125], { w: 10, h: 6 }), null, S(ACC), HAT(3));
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 10, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.8).translate(0, 1.745, 0.1), null, S(ACC), HAT(3));
  } else {
    // 4 bonnet / head scarf
    b.add(ellipsoid([0, 1.72, -0.02], [0.125, 0.11, 0.125], { w: 10, h: 8 }), null, S(ACC), HAT(4));
    // 5 small hat with a feather
    b.add(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 12).translate(0, 1.79, 0.0), null, S(ACC), HAT(5));
    b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 14).translate(0, 1.76, 0.0), null, S(ACC), HAT(5));
    b.add(limb(v(0.05, 1.8, -0.03), v(0.14, 1.95, -0.1), 0.02, 0.005, { sides: 5, rings: 2 }), null, { color: 0xe8dcc8, slot: FIX, layer: LAYER.BRUSH, id: 0.46 }, HAT(5));
  }
}

function props(b, { female = false }) {
  const S = (color, extra = {}) => ({ color, slot: FIX, layer: LAYER.WOOD, scale: 0.4, id: 0.47, ...extra });
  if (!female) {
    // 1 walking cane, 2 newspaper, 3 briefcase
    b.add(limb(v(-0.23, 0.86, 0.06), v(-0.25, 0.02, 0.1), 0.012, 0.012, { sides: 5, rings: 2 }), null, S(0x2a1a14, { spec: 0.4 }), PROP(1));
    b.add(new THREE.BoxGeometry(0.03, 0.26, 0.2).translate(-0.24, 0.84, 0.09), null, S(0xe6dcc6, { layer: LAYER.BRUSH }), PROP(2));
    b.add(new THREE.BoxGeometry(0.1, 0.26, 0.36).translate(-0.25, 0.68, 0.02), null, S(0x5a3422, { layer: LAYER.CLOTH, spec: 0.2 }), PROP(3));
  } else {
    // 1 basket, 2 parasol, 3 handbag
    b.add(new THREE.CylinderGeometry(0.15, 0.12, 0.14, 10).translate(-0.28, 0.8, 0.05), null, S(0xa8783e, { layer: LAYER.WOOD }), PROP(1));
    b.add(limb(v(-0.23, 0.88, 0.08), v(-0.2, 1.75, 0.02), 0.01, 0.01, { sides: 4, rings: 2 }), null, S(0x2a1a14), PROP(2));
    b.add(new THREE.ConeGeometry(0.45, 0.25, 12, 1, true).translate(-0.2, 1.8, 0.02), null, { color: 0xffffff, slot: ACC, layer: LAYER.STRIPES, scale: 0.4, id: 0.48 }, PROP(2));
    b.add(new THREE.BoxGeometry(0.08, 0.14, 0.18).translate(-0.25, 0.78, 0.05), null, S(0x3a2030, { layer: LAYER.CLOTH }), PROP(3));
  }
}

export const ARCH = ['gent', 'lady', 'worker', 'market', 'child'];
function archetypeGeo(kind) {
  const b = new CharBuilder();
  if (kind === 'gent') { body(b, {}, { frock: true, vest: true }); hats(b, {}); props(b, {}); }
  else if (kind === 'lady') { body(b, {}, { skirt: true, puffed: true }); hats(b, { female: true }); props(b, { female: true }); }
  else if (kind === 'worker') { body(b, {}, { coatLen: 0, apron: true, vest: true }); hats(b, {}); props(b, {}); }
  else if (kind === 'market') { body(b, {}, { skirt: true, apron: true, shawl: true }); hats(b, { female: true }); props(b, { female: true }); }
  else { body(b, {}, { coatLen: 0, child: true, vest: true }); hats(b, {}); props(b, {}); }
  return b.build({ skinned: false });
}

// ------------------------------------------------------------------ shader
const CROWD_VERT = /* glsl */ `
attribute vec2 aBone;
attribute vec4 aCol; attribute vec4 aMat;
attribute vec4 iPos;    // x y z yaw
attribute vec4 iAnim;   // phase (cycles), gait, amplitude, startle
attribute vec4 iLook;   // head yaw, head pitch, lean, prop
attribute vec4 iShape;  // height, width, face index, hat
attribute vec3 iColA; attribute vec3 iColB; attribute vec3 iColC; attribute vec3 iColS;
uniform float uHeadScale;
out vec3 vWP; out vec3 vN; out vec4 vCol; out vec4 vMat; out vec2 vUv; out vec3 vVN; out float vDepth; out vec3 vRest; out float vFace; out float vFaceIdx;
vec3 rx(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 ry(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rz(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
void main() {
  float bone = aBone.x;
  vec3 p = position, n = normal;
  // hat and prop variants: collapse the ones this person does not wear
  bool hidden = false;
  if (bone > 11.5 && bone < 16.5 && abs((bone - 11.0) - iShape.w) > 0.1) hidden = true;
  if (bone > 16.5 && abs((bone - 16.0) - iLook.w) > 0.1) hidden = true;
  float TAU = 6.2831853;
  float ph = iAnim.x * TAU;
  float gait = iAnim.y;
  float amp = iAnim.z;
  float startle = iAnim.w;
  float t = uTime;
  // ---- per bone angles for the gait
  float thL = 0.0, thR = 0.0, knL = 0.0, knR = 0.0, arL = 0.0, arR = 0.0, faL = -0.15, faR = -0.15, azL = 0.06, azR = -0.06;
  float lean = iLook.z, twist = 0.0, bob = 0.0, sway = 0.0, headYaw = iLook.x, headPitch = iLook.y, skirt = 0.0;
  if (gait < 0.5) { // walk
    float s = sin(ph), c = cos(ph);
    thL = -0.42 * s * amp; thR = 0.42 * s * amp;
    knL = (0.12 + 0.55 * max(0.0, sin(ph + 1.4))) * amp; knR = (0.12 + 0.55 * max(0.0, sin(ph + 1.4 + 3.14159))) * amp;
    arL = 0.32 * s * amp; arR = -0.32 * s * amp; faL = -0.3 - 0.15 * max(0.0, s); faR = -0.3 - 0.15 * max(0.0, -s);
    bob = 0.025 * cos(2.0 * ph) * amp; twist = 0.08 * s * amp; skirt = 0.12 * s * amp; sway = 0.03 * s;
  } else if (gait < 1.5) { // stand idle
    float w = sin(t * 0.7 + iAnim.x * 17.0);
    sway = 0.02 * w; bob = 0.004 * sin(t * 1.9 + iAnim.x * 9.0); thL = 0.03 * w; thR = -0.03 * w; faL = faR = -0.2;
  } else if (gait < 2.5) { // talking: gesturing right arm, nodding
    float g = sin(t * 2.3 + iAnim.x * 11.0), g2 = sin(t * 1.3 + iAnim.x * 5.0);
    arR = -0.5 - 0.35 * max(0.0, g); faR = -1.1 - 0.4 * g; azR = -0.25 - 0.15 * g2;
    headPitch += 0.08 * sin(t * 3.1 + iAnim.x * 3.0); sway = 0.02 * g2;
    arL = -0.1; faL = -0.9;
  } else if (gait < 3.5) { // haggling / handling goods: both arms forward
    float g = sin(t * 1.7 + iAnim.x * 7.0);
    arL = -0.7 - 0.15 * g; arR = -0.8 + 0.15 * g; faL = -0.9; faR = -1.0 - 0.3 * max(0.0, g);
    lean += 0.12; headPitch += 0.2;
  } else if (gait < 4.5) { // run
    float s = sin(ph);
    thL = -0.8 * s * amp; thR = 0.8 * s * amp;
    knL = (0.3 + 1.0 * max(0.0, sin(ph + 1.2))) * amp; knR = (0.3 + 1.0 * max(0.0, sin(ph + 1.2 + 3.14159))) * amp;
    arL = 0.7 * s * amp; arR = -0.7 * s * amp; faL = faR = -1.3;
    bob = 0.05 * abs(cos(ph)) * amp; lean += 0.25 * amp; twist = 0.15 * s * amp; skirt = 0.2 * s;
  } else { // carrying: arms up holding something on the shoulder
    float s = sin(ph);
    thL = -0.35 * s * amp; thR = 0.35 * s * amp; knL = 0.1 + 0.4 * max(0.0, sin(ph + 1.4)); knR = 0.1 + 0.4 * max(0.0, sin(ph + 4.5));
    arL = -2.6; faL = -0.6; arR = 0.2 * s; bob = 0.02 * cos(2.0 * ph);
  }
  // startle reaction: arms fly up, body leans back
  arL = mix(arL, -1.6, startle); arR = mix(arR, -1.8, startle); faL = mix(faL, -1.2, startle); faR = mix(faR, -1.3, startle);
  azL = mix(azL, 0.6, startle); azR = mix(azR, -0.6, startle); lean = mix(lean, -0.25, startle);
  // ---- apply the bone chain (pivots in rest pose)
  const vec3 HIP_L = vec3(0.1, 0.93, 0.0), HIP_R = vec3(-0.1, 0.93, 0.0), KNEE_L = vec3(0.1, 0.5, 0.01), KNEE_R = vec3(-0.1, 0.5, 0.01);
  const vec3 WAIST = vec3(0.0, 1.02, 0.0), NECK = vec3(0.0, 1.5, 0.0), SH_L = vec3(0.2, 1.43, 0.0), SH_R = vec3(-0.2, 1.43, 0.0);
  const vec3 EL_L = vec3(0.22, 1.15, 0.0), EL_R = vec3(-0.22, 1.15, 0.0);
  int b = int(bone + 0.5);
  if (b == 4) { p = rx(p - KNEE_L, knL) + KNEE_L; n = rx(n, knL); }
  if (b == 6) { p = rx(p - KNEE_R, knR) + KNEE_R; n = rx(n, knR); }
  if (b == 3 || b == 4) { p = rx(p - HIP_L, thL) + HIP_L; n = rx(n, thL); }
  if (b == 5 || b == 6) { p = rx(p - HIP_R, thR) + HIP_R; n = rx(n, thR); }
  if (b == 11) { float k = clamp((0.95 - p.y) / 0.9, 0.0, 1.0); p.z += skirt * k * 0.25 + lean * k * 0.1; p.x += sway * k * 2.0; }
  if (b == 8 || b == 17 || b == 18 || b == 19) {
    // left forearm, props sit in the right hand (bone 10) for the default rig
  }
  if (b == 8) { p = rx(p - EL_L, faL) + EL_L; n = rx(n, faL); }
  if (b == 10 || b >= 17) { p = rx(p - EL_R, faR) + EL_R; n = rx(n, faR); }
  if (b == 7 || b == 8) { p = rz(rx(p - SH_L, arL), azL) + SH_L; n = rz(rx(n, arL), azL); }
  if (b == 9 || b == 10 || b >= 17) { p = rz(rx(p - SH_R, arR), azR) + SH_R; n = rz(rx(n, arR), azR); }
  if (b == 2 || (b >= 12 && b <= 16)) {
    vec3 hp = p - NECK; hp *= uHeadScale; p = hp + NECK;
    p = ry(rx(p - NECK, headPitch), headYaw) + NECK; n = ry(rx(n, headPitch), headYaw);
  }
  if (b == 1 || b == 2 || (b >= 7 && b <= 10) || b >= 12) { p = ry(rx(p - WAIST, lean), twist) + WAIST; n = ry(rx(n, lean), twist); }
  p = rz(p - vec3(0.0, 0.0, 0.0), sway * 0.3); p.y += bob;
  if (hidden) p = vec3(0.0, 1.0, 0.0);
  // instance transform
  p.xz *= iShape.y; p *= iShape.x;
  p = ry(p, iPos.w); n = ry(n, iPos.w);
  vec4 wp = modelMatrix * vec4(p + iPos.xyz, 1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * n);
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * vN;
  float slot = aBone.y;
  vec3 col = aCol.rgb;
  if (slot < 0.5) col = iColS; else if (slot < 1.5) col = iColA; else if (slot < 2.5) col = iColB; else if (slot < 3.5) col = iColC;
  else if (slot < 4.5) col = vec3(0.16, 0.12, 0.11) + iColS * 0.12; else if (slot < 5.5) col = vec3(0.92, 0.88, 0.8);
  // each person gets its own ink id so neighbours separate
  vCol = vec4(col, fract(iShape.z * 0.137 + iPos.x * 0.0131 + 0.21));
  vMat = aMat; vUv = uv; vRest = position; vFace = mod(aMat.w, 4.0); vFaceIdx = iShape.z;
  gl_Position = projectionMatrix * mv;
}`;
const CROWD_FRAG = /* glsl */ `
uniform sampler2D uFaceTex; uniform vec4 uFaceBase;
in vec3 vWP; in vec3 vN; in vec4 vCol; in vec4 vMat; in vec2 vUv; in vec3 vVN; in float vDepth; in vec3 vRest; in float vFace; in float vFaceIdx;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN); vec3 VN = normalize(vVN);
  if (!gl_FrontFacing) { N = -N; VN = -VN; }
  vec4 br = triBrush(vMat.x, vRest * 2.0, N, max(vMat.y * 0.05, 0.05));
  vec3 albedo = pow(vCol.rgb, vec3(2.2)) * (br.rgb * 2.0);
  if (vFace > 0.5) {
    float k = mod(vFaceIdx, 32.0);
    float cellI = floor(k / 16.0);
    float kk = mod(k, 16.0);
    vec2 cell = uFaceBase.xy + vec2(cellI * uFaceBase.z, 0.0);
    vec2 sub = vec2(mod(kk, 4.0), 3.0 - floor(kk / 4.0)) * 0.25;
    vec2 fuv = cell + (sub + clamp(vUv, 0.0, 1.0) * 0.25) * uFaceBase.zw;
    vec3 f = texture(uFaceTex, fuv).rgb; // sRGB texture: already linear
    // tint the painted skin toward this person's skin colour
    albedo = f * (pow(vCol.rgb, vec3(2.2)) / vec3(0.83, 0.52, 0.36));
  }
  float sh = sunShadow(vWP, N);
  vec3 col = toonShade(albedo, N, vWP, (br.a - 0.5) * 0.3, vMat.z / 255.0, 1.0, sh, groundAO(vWP) * 0.3 + 0.7);
  col += charKey(albedo, N, (br.a - 0.5) * 0.3) * 0.8;
  col = applyFog(col, vWP);
  writeOut(col, VN, vDepth, vCol.a);
}`;

// ------------------------------------------------------------------ crowd manager
export class Crowd {
  constructor(capacity = { gent: 80, lady: 80, worker: 60, market: 40, child: 40 }) {
    this.group = new THREE.Group();
    this.kinds = {};
    const atlas = createFaceAtlas();
    const base = faceCell(10);
    for (const kind of ARCH) {
      const geo0 = archetypeGeo(kind);
      const cap = capacity[kind] || 1;
      const g = new THREE.InstancedBufferGeometry();
      g.index = geo0.index;
      for (const name of ['position', 'normal', 'uv', 'aCol', 'aMat', 'aBone']) g.setAttribute(name, geo0.attributes[name]);
      const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
      const A = { iPos: mk(4), iAnim: mk(4), iLook: mk(4), iShape: mk(4), iColA: mk(3), iColB: mk(3), iColC: mk(3), iColS: mk(3) };
      for (const k in A) g.setAttribute(k, A[k]);
      g.instanceCount = 0;
      const mat = toonMaterial({ vertex: CROWD_VERT, fragment: CROWD_FRAG, uniforms: { uFaceTex: { value: atlas }, uFaceBase: { value: new THREE.Vector4(base[0], base[1], base[2], base[3]) }, uHeadScale: { value: kind === 'child' ? 1.3 : 1.14 } }, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.layers.enable(LAYER_DYN_CASTER);
      this.group.add(mesh);
      this.kinds[kind] = { mesh, g, A, cap, n: 0 };
    }
    this.people = [];
  }
  add(person) {
    const K = this.kinds[person.kind];
    if (K.n >= K.cap) return null;
    person.slot = K.n++;
    K.g.instanceCount = K.n;
    const i = person.slot, A = K.A;
    A.iShape.setXYZW(i, person.height, person.width, person.face, person.hat);
    A.iColA.setXYZ(i, ...person.colA); A.iColB.setXYZ(i, ...person.colB); A.iColC.setXYZ(i, ...person.colC); A.iColS.setXYZ(i, ...person.skin);
    for (const k of ['iShape', 'iColA', 'iColB', 'iColC', 'iColS']) A[k].needsUpdate = true;
    this.people.push(person);
    return person;
  }
  // write dynamic state for one person
  set(person, x, y, z, yaw, phase, gait, amp, startle, headYaw = 0, headPitch = 0, lean = 0) {
    const K = this.kinds[person.kind], i = person.slot, A = K.A;
    A.iPos.setXYZW(i, x, y, z, yaw);
    A.iAnim.setXYZW(i, phase, gait, amp, startle);
    A.iLook.setXYZW(i, headYaw, headPitch, lean, person.prop || 0);
  }
  hide(person) { const K = this.kinds[person.kind]; K.A.iPos.setXYZW(person.slot, 0, -500, 0, 0); }
  commit() {
    for (const kind of ARCH) { const A = this.kinds[kind].A; A.iPos.needsUpdate = true; A.iAnim.needsUpdate = true; A.iLook.needsUpdate = true; }
  }
}

export const GAIT = { walk: 0, stand: 1, talk: 2, haggle: 3, run: 4, carry: 5 };
