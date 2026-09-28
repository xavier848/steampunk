// Hero characters (the boy and the constable): procedural skinned meshes with a painted
// face, toon material with skinning, pose application and attached props.
import * as THREE from 'three';
import { toonMaterial } from '../engine/materials.js';
import { LAYER } from '../engine/textures.js';
import { CharBuilder, limb, ellipsoid, loft, headGeo, blendAlong } from './charparts.js';
import { createFaceAtlas, faceCell, FACE } from './faces.js';
import { LAYER_DYN_CASTER } from '../engine/engine.js';
import { M, P } from '../engine/geo.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ material
const CHAR_VERT = /* glsl */ `
#include <skinning_pars_vertex>
attribute vec4 aCol; attribute vec4 aMat;
out vec3 vWP; out vec3 vN; out vec4 vCol; out vec4 vMat; out vec2 vUv; out vec3 vVN; out float vDepth; out vec3 vRest;
void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
#ifdef USE_SKINNING
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
#endif
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z; vVN = mat3(viewMatrix) * vN;
  vCol = aCol; vMat = aMat; vUv = uv; vRest = position;
  gl_Position = projectionMatrix * mv;
}`;
const CHAR_FRAG = /* glsl */ `
uniform sampler2D uFaceTex; uniform vec4 uFaceCell; uniform float uGlow; uniform float uRimBoost; uniform vec3 uTint;
in vec3 vWP; in vec3 vN; in vec4 vCol; in vec4 vMat; in vec2 vUv; in vec3 vVN; in float vDepth; in vec3 vRest;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN);
  vec3 VN = normalize(vVN);
  if (!gl_FrontFacing) { N = -N; VN = -VN; }
  float flags = vMat.w;
  float face = mod(flags, 4.0);
  float emit = floor(flags / 4.0) / 4.0;
  vec4 br = triBrush(vMat.x, vRest * 3.0, N, max(vMat.y * 0.05, 0.05));
  vec3 albedo = pow(vCol.rgb, vec3(2.2)) * (br.rgb * 2.0) * uTint;
  float bias = (br.a - 0.5) * 0.35;
  if (face > 0.5) {
    vec2 fuv = uFaceCell.xy + clamp(vUv, 0.0, 1.0) * uFaceCell.zw;
    albedo = texture(uFaceTex, fuv).rgb; // sRGB texture: already linear when sampled
    bias *= 0.3;
  }
  float sh = sunShadow(vWP, N);
  vec3 col = toonShade(albedo, N, vWP, bias, vMat.z / 255.0, 1.25 * uRimBoost, sh, 1.0);
  col += charKey(albedo, N, bias);
  if (emit > 0.0) col = mix(col, albedo * emit * uGlow * 2.5, clamp(emit, 0.0, 1.0));
  col = applyFog(col, vWP);
  writeOut(col, VN, vDepth, vCol.a);
}`;

let faceAtlas = null;
export function charMaterial({ skinned = true } = {}) {
  if (!faceAtlas) faceAtlas = createFaceAtlas();
  return toonMaterial({
    vertex: CHAR_VERT, fragment: CHAR_FRAG,
    uniforms: { uFaceTex: { value: faceAtlas }, uFaceCell: { value: new THREE.Vector4(...faceCell(0)) }, uGlow: { value: 1 }, uRimBoost: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
  });
}

// ------------------------------------------------------------------ skeleton
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
  'L_clav', 'L_arm', 'L_fore', 'L_hand', 'R_clav', 'R_arm', 'R_fore', 'R_hand',
  'L_thigh', 'L_shin', 'L_foot', 'R_thigh', 'R_shin', 'R_foot'];
const PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  L_clav: 'chest', L_arm: 'L_clav', L_fore: 'L_arm', L_hand: 'L_fore', R_clav: 'chest', R_arm: 'R_clav', R_fore: 'R_arm', R_hand: 'R_fore',
  L_thigh: 'hips', L_shin: 'L_thigh', L_foot: 'L_shin', R_thigh: 'hips', R_shin: 'R_thigh', R_foot: 'R_shin' };

function makeSkeleton(J) {
  const bones = {}, list = [];
  for (const name of BONES) {
    const b = new THREE.Bone(); b.name = name; bones[name] = b; list.push(b);
  }
  for (const name of BONES) {
    const b = bones[name];
    const p = J[name];
    if (PARENT[name]) {
      const pp = J[PARENT[name]];
      b.position.set(p.x - pp.x, p.y - pp.y, p.z - pp.z);
      bones[PARENT[name]].add(b);
    } else b.position.copy(p);
  }
  return { bones, list, index: Object.fromEntries(BONES.map((n, i) => [n, i])) };
}

// ------------------------------------------------------------------ the boy
export function buildBoy() {
  const J = {
    root: v(0, 0, 0), hips: v(0, 0.78, 0), spine: v(0, 0.9, 0), chest: v(0, 1.04, 0), neck: v(0, 1.17, 0), head: v(0, 1.23, 0.0),
    L_clav: v(0.04, 1.14, 0), L_arm: v(0.155, 1.13, -0.01), L_fore: v(0.175, 0.9, -0.02), L_hand: v(0.185, 0.69, 0.0),
    R_clav: v(-0.04, 1.14, 0), R_arm: v(-0.155, 1.13, -0.01), R_fore: v(-0.175, 0.9, -0.02), R_hand: v(-0.185, 0.69, 0.0),
    L_thigh: v(0.075, 0.76, 0), L_shin: v(0.08, 0.42, 0.01), L_foot: v(0.085, 0.085, 0),
    R_thigh: v(-0.075, 0.76, 0), R_shin: v(-0.08, 0.42, 0.01), R_foot: v(-0.085, 0.085, 0),
  };
  const sk = makeSkeleton(J);
  const I = sk.index;
  const b = new CharBuilder();
  const C = {
    skin: 0xf0c09a, shirt: 0xeadbc2, vest: 0x2f5e5a, vestDark: 0x234644, trousers: 0x6a4a36, socks: 0x8a8278,
    boot: 0x4a2c1e, cap: 0x8a7458, capBand: 0x5a4632, hair: 0x8a3e1e, leather: 0x7a4a2a, brass: 0xd8a24a, glass: 0x7ab8c8, gloves: 0x6a3e24,
  };
  const S = (color, extra = {}) => ({ color, layer: LAYER.CLOTH, scale: 0.35, id: 0.61, ...extra });
  // torso: shirt + vest
  b.add(loft([
    { y: 0.74, rx: 0.12, rz: 0.085 }, { y: 0.84, rx: 0.115, rz: 0.08 }, { y: 0.93, rx: 0.112, rz: 0.075 },
    { y: 1.03, rx: 0.13, rz: 0.085 }, { y: 1.11, rx: 0.14, rz: 0.08 }, { y: 1.16, rx: 0.1, rz: 0.06 }, { y: 1.19, rx: 0.05, rz: 0.045 },
  ], { sides: 18 }), null, S(C.vest, { id: 0.62 }), (p) => (p.y < 0.86 ? [I.hips, 1] : p.y < 0.98 ? [I.spine, 1] : [I.chest, 1]));
  // shirt V at the front and collar
  b.add(loft([{ y: 1.0, rx: 0.012, rz: 0.01, cz: 0.078 }, { y: 1.1, rx: 0.045, rz: 0.012, cz: 0.08 }, { y: 1.17, rx: 0.06, rz: 0.02, cz: 0.05 }], { sides: 8 }), null, S(C.shirt, { id: 0.63 }), I.chest);
  for (let k = 0; k < 3; k++) b.add(ellipsoid([0, 0.9 + k * 0.05, 0.083], [0.009, 0.009, 0.006], { w: 6, h: 4 }), null, { color: C.brass, layer: LAYER.METAL, spec: 0.8, id: 0.62 }, k < 1 ? I.spine : I.chest);
  // trousers / pelvis
  b.add(loft([{ y: 0.64, rx: 0.13, rz: 0.09 }, { y: 0.72, rx: 0.13, rz: 0.092 }, { y: 0.8, rx: 0.123, rz: 0.088 }], { sides: 16 }), null, S(C.trousers, { id: 0.64 }), I.hips);
  // belt
  b.add(loft([{ y: 0.78, rx: 0.127, rz: 0.09 }, { y: 0.82, rx: 0.125, rz: 0.089 }], { sides: 16 }), null, { color: 0x3a2418, layer: LAYER.CLOTH, scale: 0.3, id: 0.65 }, I.hips);
  // legs
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const hip = J[L + '_thigh'], knee = J[L + '_shin'], ankle = J[L + '_foot'];
    b.add(limb(hip.clone().add(v(0, 0.04, 0)), knee, 0.068, 0.056, { sides: 12 }), null, S(C.trousers, { id: 0.64 }), I[L + '_thigh']);
    // cuff at the knee
    b.add(limb(knee.clone().add(v(0, 0.03, 0)), knee.clone().add(v(0, -0.05, 0)), 0.062, 0.06, { sides: 12 }), null, S(C.trousers, { id: 0.64 }), I[L + '_shin']);
    b.add(limb(knee, ankle.clone().add(v(0, 0.05, 0)), 0.048, 0.036, { sides: 10, profile: (t) => 1 + 0.18 * Math.sin(t * Math.PI) * (1 - t) }), null, S(C.socks, { id: 0.66 }), I[L + '_shin']);
    // boot: shaft + foot
    b.add(limb(ankle.clone().add(v(0, 0.07, 0)), ankle.clone().add(v(0, -0.03, 0)), 0.05, 0.052, { sides: 10 }), null, { color: C.boot, layer: LAYER.CLOTH, scale: 0.3, spec: 0.3, id: 0.67 }, I[L + '_foot']);
    b.add(ellipsoid([ankle.x, 0.045, 0.05], [0.058, 0.05, 0.12], { w: 12, h: 8 }), null, { color: C.boot, layer: LAYER.CLOTH, scale: 0.3, spec: 0.3, id: 0.67 }, I[L + '_foot']);
    b.add(P.box(), M(ankle.x, 0.012, 0.05, 0, 0, 0, 0.11, 0.024, 0.25), { color: 0x2a1a12, layer: LAYER.CLOTH, id: 0.67 }, I[L + '_foot']);
  }
  // arms: rolled shirt sleeves, bare forearms, leather gloves
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = J[L + '_arm'], el = J[L + '_fore'], wr = J[L + '_hand'];
    b.add(ellipsoid([sh.x - s * 0.01, sh.y - 0.01, sh.z], [0.058, 0.05, 0.05]), null, S(C.shirt, { id: 0.63 }), I[L + '_arm']);
    b.add(limb(sh, el.clone().add(v(0, 0.02, 0)), 0.048, 0.042, { sides: 10 }), null, S(C.shirt, { id: 0.63 }), I[L + '_arm']);
    b.add(limb(el.clone().add(v(0, 0.03, 0)), el.clone().add(v(0, -0.03, 0)), 0.05, 0.048, { sides: 10 }), null, S(C.shirt, { id: 0.63 }), I[L + '_fore']);
    b.add(limb(el, wr, 0.036, 0.03, { sides: 10 }), null, { color: C.skin, layer: LAYER.BRUSH, scale: 0.3, id: 0.68 }, I[L + '_fore']);
    // gloved hand: palm, fingers as a mitten, thumb
    const hx = wr.x + s * 0.005;
    b.add(ellipsoid([hx, wr.y - 0.05, wr.z + 0.005], [0.026, 0.05, 0.042], { w: 10, h: 8 }), null, { color: C.gloves, layer: LAYER.CLOTH, scale: 0.25, spec: 0.2, id: 0.69 }, I[L + '_hand']);
    b.add(ellipsoid([hx, wr.y - 0.105, wr.z + 0.012], [0.022, 0.035, 0.036], { w: 10, h: 8 }), null, { color: C.gloves, layer: LAYER.CLOTH, scale: 0.25, spec: 0.2, id: 0.69 }, I[L + '_hand']);
    b.add(limb(v(hx - s * 0.005, wr.y - 0.035, wr.z + 0.035), v(hx - s * 0.012, wr.y - 0.075, wr.z + 0.06), 0.014, 0.012, { sides: 6 }), null, { color: C.gloves, layer: LAYER.CLOTH, id: 0.69 }, I[L + '_hand']);
  }
  // neck and head
  b.add(limb(v(0, 1.15, 0), v(0, 1.25, 0.005), 0.048, 0.046, { sides: 10 }), null, { color: C.skin, layer: LAYER.BRUSH, scale: 0.3, id: 0.7 }, (p) => (p.y < 1.2 ? [I.neck, 1] : [I.head, 1]));
  const HC = [0, 1.335, 0.012];
  b.add(headGeo(HC, [0.108, 0.122, 0.112], { jaw: 0.2, chin: 0.25 }), null, { color: C.skin, face: 1, id: 0.71 }, I.head);
  b.add(ellipsoid([0, 1.33, 0.104], [0.013, 0.019, 0.016], { w: 8, h: 6, rot: [0.45, 0, 0] }), null, { color: 0xf0c09a, layer: LAYER.BRUSH, scale: 0.2, id: 0.71 }, I.head);
  for (const s of [1, -1]) b.add(ellipsoid([s * 0.107, 1.34, 0.0], [0.016, 0.03, 0.022]), null, { color: 0xeaa888, layer: LAYER.BRUSH, scale: 0.2, id: 0.72 }, I.head);
  // hair tufts sticking out under the cap
  const tufts = [[0.09, 1.4, -0.06, 0.5, 0.4], [-0.09, 1.4, -0.06, -0.5, 0.4], [0.06, 1.38, -0.1, 0.3, 0.9], [-0.05, 1.37, -0.11, -0.3, 1.0], [0.0, 1.36, -0.115, 0, 1.1], [0.1, 1.37, 0.02, 0.9, 0.2], [-0.1, 1.37, 0.02, -0.9, 0.2]];
  for (const [x, y, z, ax, az] of tufts) {
    const g = new THREE.ConeGeometry(0.028, 0.08, 6);
    g.rotateX(Math.PI / 2 + az * 0.6); g.rotateZ(-ax * 0.9);
    g.translate(x, y - 0.03, z);
    b.add(g, null, { color: C.hair, layer: LAYER.BRUSH, scale: 0.2, id: 0.73 }, I.head);
  }
  // flat cap (Schiebermuetze): soft crown pulled forward over a short stiff brim
  b.add(ellipsoid([0, 1.43, 0.02], [0.128, 0.058, 0.14], { w: 20, h: 10, rot: [0.16, 0, 0] }), null, { color: C.cap, layer: LAYER.CLOTH, scale: 0.25, id: 0.74 }, I.head);
  b.add(ellipsoid([0, 1.405, 0.0], [0.118, 0.05, 0.122], { w: 18, h: 8 }), null, { color: C.cap, layer: LAYER.CLOTH, scale: 0.25, id: 0.74 }, I.head);
  const brim = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16, 1, false, -Math.PI / 2, Math.PI);
  brim.scale(1.0, 1, 0.62); brim.rotateX(0.28); brim.translate(0, 1.395, 0.108);
  b.add(brim, null, { color: C.capBand, layer: LAYER.CLOTH, scale: 0.25, id: 0.745 }, I.head);
  b.add(ellipsoid([0, 1.465, 0.07], [0.014, 0.007, 0.014], { w: 8, h: 4 }), null, { color: C.capBand, id: 0.74 }, I.head);
  // aviator goggles on the cap front
  for (const s of [1, -1]) {
    const g = new THREE.CylinderGeometry(0.034, 0.038, 0.035, 14);
    g.rotateX(Math.PI / 2 - 0.75); g.translate(s * 0.045, 1.468, 0.085);
    b.add(g, null, { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.75 }, I.head);
    const l = new THREE.CylinderGeometry(0.027, 0.027, 0.006, 14);
    l.rotateX(Math.PI / 2 - 0.75); l.translate(s * 0.045, 1.482, 0.098);
    b.add(l, null, { color: C.glass, layer: LAYER.GLASS, spec: 1.0, emit: 0.4, id: 0.76 }, I.head);
  }
  b.add(limb(v(-0.014, 1.47, 0.092), v(0.014, 1.47, 0.092), 0.01, 0.01, { sides: 6 }), null, { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.75 }, I.head);
  b.add(new THREE.TorusGeometry(0.128, 0.012, 5, 24).rotateX(Math.PI / 2 - 0.3).scale(1, 1, 1.08).translate(0, 1.44, 0.0), null, { color: 0x4a3020, layer: LAYER.CLOTH, id: 0.745 }, I.head);
  // scarf wrap around the neck (tails are simulated separately)
  b.add(new THREE.TorusGeometry(0.068, 0.028, 8, 16).rotateX(Math.PI / 2).scale(1, 1.0, 0.95).translate(0, 1.175, 0.0), null, { color: 0xc8322a, layer: LAYER.CLOTH, scale: 0.25, id: 0.77 }, I.neck);
  b.add(new THREE.TorusGeometry(0.075, 0.026, 8, 16).rotateX(Math.PI / 2 + 0.25).translate(0, 1.15, 0.01), null, { color: 0xb02a26, layer: LAYER.CLOTH, scale: 0.25, id: 0.77 }, I.chest);
  // satchel: strap from the right shoulder to the left hip, bag with brass buckle, glowing core
  const strap = [v(-0.12, 1.14, 0.04), v(-0.06, 1.1, 0.098), v(0.03, 0.98, 0.1), v(0.11, 0.86, 0.09), v(0.155, 0.76, 0.03)];
  for (let i = 0; i < strap.length - 1; i++) b.add(limb(strap[i], strap[i + 1], 0.012, 0.012, { sides: 6, capA: i === 0, capB: true }).scale(1, 1, 1), null, { color: C.leather, layer: LAYER.CLOTH, scale: 0.2, id: 0.78 }, strap[i].y > 0.98 ? I.chest : I.spine);
  const back = [v(-0.12, 1.14, 0.04), v(-0.08, 1.1, -0.08), v(0.05, 0.95, -0.095), v(0.155, 0.76, 0.0)];
  for (let i = 0; i < back.length - 1; i++) b.add(limb(back[i], back[i + 1], 0.011, 0.011, { sides: 6 }), null, { color: C.leather, layer: LAYER.CLOTH, scale: 0.2, id: 0.78 }, back[i].y > 0.98 ? I.chest : I.spine);
  const bag = M(0.165, 0.7, 0.04, 0, 0.35, 0);
  b.add(P.box(), bag.clone().multiply(M(0, 0, 0, 0, 0, 0, 0.07, 0.16, 0.2)), { color: C.leather, layer: LAYER.CLOTH, scale: 0.2, spec: 0.15, id: 0.79 }, I.hips);
  b.add(P.box(), bag.clone().multiply(M(0.028, 0.045, 0, 0, 0, 0, 0.03, 0.09, 0.21)), { color: 0x6a3e22, layer: LAYER.CLOTH, scale: 0.2, id: 0.79 }, I.hips);
  b.add(P.box(), bag.clone().multiply(M(0.046, 0.02, 0, 0, 0, 0, 0.012, 0.03, 0.035)), { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.79 }, I.hips);
  // brass core peeking out of the bag: glowing sphere in a cage
  const core = M(0.175, 0.8, 0.07, 0, 0.35, 0);
  b.add(ellipsoid([0, 0, 0], [0.05, 0.05, 0.05], { w: 14, h: 10 }), core, { color: 0xffb44a, layer: LAYER.BRUSH, scale: 0.2, emit: 3.5, id: 0.8 }, I.hips);
  for (let k = 0; k < 3; k++) {
    const t = new THREE.TorusGeometry(0.056, 0.006, 5, 18);
    t.rotateY((k / 3) * Math.PI); t.applyMatrix4(core);
    b.add(t, null, { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.81 }, I.hips);
  }
  const geo = b.build({ skinned: true });
  return finishHero(geo, sk, J, { name: 'boy', faceBase: 0, headTop: 1.5, height: 1.5, coreLocal: new THREE.Vector3(0.175, 0.8, 0.07), neck: J.neck, scarfColor: 0xc8322a });
}

// ------------------------------------------------------------------ the constable
export function buildCop() {
  const J = {
    root: v(0, 0, 0), hips: v(0, 0.98, 0), spine: v(0, 1.12, 0), chest: v(0, 1.34, 0), neck: v(0, 1.54, 0), head: v(0, 1.6, 0.01),
    L_clav: v(0.06, 1.5, 0), L_arm: v(0.23, 1.49, -0.01), L_fore: v(0.26, 1.18, -0.02), L_hand: v(0.27, 0.92, 0.0),
    R_clav: v(-0.06, 1.5, 0), R_arm: v(-0.23, 1.49, -0.01), R_fore: v(-0.26, 1.18, -0.02), R_hand: v(-0.27, 0.92, 0.0),
    L_thigh: v(0.1, 0.95, 0), L_shin: v(0.105, 0.52, 0.01), L_foot: v(0.11, 0.1, 0),
    R_thigh: v(-0.1, 0.95, 0), R_shin: v(-0.105, 0.52, 0.01), R_foot: v(-0.11, 0.1, 0),
  };
  const sk = makeSkeleton(J);
  const I = sk.index;
  const b = new CharBuilder();
  const C = { coat: 0x243458, coatDark: 0x1a2440, red: 0xa82a2a, skin: 0xe6ab8c, glove: 0xf0ece0, boot: 0x1e1a1a, brass: 0xe0aa48, helmet: 0x1c1a1e, stache: 0x6a5a50, trousers: 0x1e2436 };
  const S = (color, extra = {}) => ({ color, layer: LAYER.CLOTH, scale: 0.4, id: 0.41, ...extra });
  // barrel torso with a proud belly
  b.add(loft([
    { y: 0.92, rx: 0.19, rz: 0.16, cz: 0.02 }, { y: 1.02, rx: 0.22, rz: 0.22, cz: 0.05 }, { y: 1.14, rx: 0.235, rz: 0.25, cz: 0.07 },
    { y: 1.28, rx: 0.23, rz: 0.22, cz: 0.05 }, { y: 1.42, rx: 0.22, rz: 0.15, cz: 0.01 }, { y: 1.5, rx: 0.18, rz: 0.11 }, { y: 1.56, rx: 0.08, rz: 0.07 },
  ], { sides: 20 }), null, S(C.coat), (p) => (p.y < 1.06 ? [I.hips, 1] : p.y < 1.26 ? [I.spine, 1] : [I.chest, 1]));
  // coat skirt flaring over the thighs
  b.add(loft([{ y: 0.62, rx: 0.24, rz: 0.2, cz: 0.02 }, { y: 0.8, rx: 0.215, rz: 0.18, cz: 0.02 }, { y: 0.95, rx: 0.195, rz: 0.165, cz: 0.02 }], { sides: 20, capTop: false }), null, S(C.coat), I.hips);
  // belt and buckle
  b.add(loft([{ y: 1.0, rx: 0.225, rz: 0.225, cz: 0.05 }, { y: 1.06, rx: 0.232, rz: 0.24, cz: 0.06 }], { sides: 20 }), null, { color: 0x121010, layer: LAYER.CLOTH, spec: 0.3, id: 0.42 }, I.hips);
  b.add(P.box(), M(0, 1.03, 0.3, 0, 0, 0, 0.07, 0.06, 0.02), { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.43 }, I.hips);
  // two rows of brass buttons
  for (let k = 0; k < 4; k++) for (const s of [1, -1]) {
    const y = 1.12 + k * 0.09; const z = 0.3 - Math.abs(y - 1.14) * 0.35;
    b.add(ellipsoid([s * 0.07, y, z], [0.014, 0.014, 0.008], { w: 6, h: 4 }), null, { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.43 }, y < 1.26 ? I.spine : I.chest);
  }
  // collar
  b.add(loft([{ y: 1.52, rx: 0.1, rz: 0.09 }, { y: 1.6, rx: 0.085, rz: 0.08 }], { sides: 14 }), null, S(C.red, { id: 0.44 }), I.chest);
  // legs
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const hip = J[L + '_thigh'], knee = J[L + '_shin'], ankle = J[L + '_foot'];
    b.add(limb(hip.clone().add(v(0, 0.03, 0)), knee, 0.085, 0.065, { sides: 12 }), null, S(C.trousers), I[L + '_thigh']);
    b.add(limb(knee, ankle.clone().add(v(0, 0.12, 0)), 0.06, 0.048, { sides: 12 }), null, S(C.trousers), I[L + '_shin']);
    b.add(limb(ankle.clone().add(v(0, 0.2, 0)), ankle.clone().add(v(0, -0.02, 0)), 0.058, 0.06, { sides: 12 }), null, { color: C.boot, layer: LAYER.CLOTH, spec: 0.5, id: 0.45 }, I[L + '_foot']);
    b.add(ellipsoid([ankle.x, 0.05, 0.07], [0.07, 0.055, 0.15], { w: 12, h: 8 }), null, { color: C.boot, layer: LAYER.CLOTH, spec: 0.5, id: 0.45 }, I[L + '_foot']);
    // red trouser stripe
    b.add(limb(hip.clone().add(v(s * 0.08, 0, 0)), knee.clone().add(v(s * 0.062, 0, 0)), 0.012, 0.012, { sides: 5 }), null, { color: C.red, id: 0.46 }, I[L + '_thigh']);
  }
  // arms
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = J[L + '_arm'], el = J[L + '_fore'], wr = J[L + '_hand'];
    b.add(ellipsoid([sh.x - s * 0.02, sh.y, sh.z], [0.09, 0.07, 0.08]), null, S(C.coat), I[L + '_arm']);
    b.add(ellipsoid([sh.x, sh.y + 0.045, sh.z], [0.085, 0.02, 0.06]), null, { color: C.brass, layer: LAYER.METAL, spec: 0.7, id: 0.47 }, I[L + '_clav']);
    b.add(limb(sh, el, 0.07, 0.06, { sides: 12 }), null, S(C.coat), I[L + '_arm']);
    b.add(limb(el, wr.clone().add(v(0, 0.04, 0)), 0.058, 0.05, { sides: 12 }), null, S(C.coat), I[L + '_fore']);
    b.add(limb(wr.clone().add(v(0, 0.08, 0)), wr.clone().add(v(0, 0.02, 0)), 0.058, 0.058, { sides: 12 }), null, S(C.red, { id: 0.44 }), I[L + '_fore']);
    b.add(ellipsoid([wr.x, wr.y - 0.06, wr.z + 0.01], [0.04, 0.07, 0.055]), null, { color: C.glove, layer: LAYER.CLOTH, id: 0.48 }, I[L + '_hand']);
    b.add(limb(v(wr.x - s * 0.01, wr.y - 0.04, wr.z + 0.045), v(wr.x - s * 0.02, wr.y - 0.09, wr.z + 0.075), 0.018, 0.016, { sides: 6 }), null, { color: C.glove, id: 0.48 }, I[L + '_hand']);
  }
  // head: jowly, with moustache, Pickelhaube
  b.add(limb(v(0, 1.52, 0), v(0, 1.64, 0.01), 0.07, 0.068, { sides: 12 }), null, { color: C.skin, id: 0.49 }, (p) => (p.y < 1.57 ? [I.neck, 1] : [I.head, 1]));
  const HC = [0, 1.72, 0.015];
  b.add(headGeo(HC, [0.125, 0.14, 0.13], { jaw: -0.18, chin: 0.1 }), null, { color: C.skin, face: 1, id: 0.5 }, I.head);
  b.add(ellipsoid([0, 1.705, 0.14], [0.03, 0.032, 0.036]), null, { color: 0xd8826a, layer: LAYER.BRUSH, scale: 0.2, id: 0.5 }, I.head);
  for (const s of [1, -1]) {
    b.add(ellipsoid([s * 0.125, 1.72, 0.0], [0.02, 0.035, 0.026]), null, { color: 0xdc9a80, id: 0.51 }, I.head);
    // big curled moustache
    b.add(limb(v(s * 0.005, 1.675, 0.142), v(s * 0.075, 1.668, 0.12), 0.024, 0.012, { sides: 8 }), null, { color: C.stache, layer: LAYER.BRUSH, scale: 0.2, id: 0.52 }, I.head);
    b.add(limb(v(s * 0.075, 1.668, 0.12), v(s * 0.115, 1.7, 0.095), 0.012, 0.005, { sides: 6 }), null, { color: C.stache, layer: LAYER.BRUSH, scale: 0.2, id: 0.52 }, I.head);
    // sideburns
    b.add(ellipsoid([s * 0.118, 1.69, 0.03], [0.018, 0.05, 0.035]), null, { color: C.stache, id: 0.52 }, I.head);
  }
  // Pickelhaube
  b.add(ellipsoid([0, 1.8, 0.0], [0.135, 0.12, 0.15], { w: 18, h: 10 }), null, { color: C.helmet, layer: LAYER.CLOTH, spec: 0.6, id: 0.53 }, I.head);
  const visor = new THREE.CylinderGeometry(0.13, 0.13, 0.01, 16, 1, false, -Math.PI / 2, Math.PI);
  visor.scale(1.05, 1, 0.9); visor.rotateX(0.12); visor.translate(0, 1.76, 0.07);
  b.add(visor, null, { color: C.helmet, spec: 0.6, id: 0.53 }, I.head);
  b.add(ellipsoid([0, 1.815, 0.14], [0.055, 0.06, 0.012]), null, { color: C.brass, layer: LAYER.METAL, spec: 0.95, id: 0.54 }, I.head);
  b.add(P.cylB(10), M(0, 1.9, 0.0, 0, 0, 0, 0.03, 0.03, 0.03), { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.54 }, I.head);
  b.add(P.cone(10), M(0, 1.92, 0.0, 0, 0, 0, 0.022, 0.11, 0.022), { color: C.brass, layer: LAYER.METAL, spec: 0.9, id: 0.54 }, I.head);
  // whistle on a chain, hanging from the chest
  b.add(limb(v(-0.09, 1.34, 0.21), v(-0.05, 1.24, 0.25), 0.004, 0.004, { sides: 4 }), null, { color: C.brass, spec: 0.8, id: 0.55 }, I.chest);
  const geo = b.build({ skinned: true });
  return finishHero(geo, sk, J, { name: 'cop', faceBase: 6, headTop: 2.0, height: 1.95, neck: J.neck });
}

function finishHero(geo, sk, J, meta) {
  const mat = charMaterial();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(sk.bones.root);
  mesh.bind(new THREE.Skeleton(sk.list));
  mesh.frustumCulled = false;
  mesh.layers.enable(LAYER_DYN_CASTER);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, bones: sk.bones, J, mat, meta, setFace(i) { mat.uniforms.uFaceCell.value.set(...faceCell(i)); } };
}

// Apply a pose: map of bone -> [rx, ry, rz]; plus root position/yaw and hips offset.
export function applyPose(hero, pose) {
  const B = hero.bones;
  for (const name in B) { if (name !== 'root') B[name].rotation.set(0, 0, 0); }
  for (const name in pose.rot) {
    const r = pose.rot[name];
    if (B[name]) B[name].rotation.set(r[0], r[1], r[2], 'YXZ');
  }
  const hp = hero.J.hips;
  B.hips.position.set(hp.x + (pose.hipsOff?.[0] || 0), hp.y + (pose.hipsOff?.[1] || 0), hp.z + (pose.hipsOff?.[2] || 0));
  hero.group.position.copy(pose.pos);
  hero.group.rotation.set(0, pose.yaw, 0);
  hero.group.updateMatrixWorld(true);
}
