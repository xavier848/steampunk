// Lighting and grading presets ("looks"). A look sets every shared uniform: sun,
// ambient, shadow tint, rim, fog, sky colours and the post grade. Looks can be
// blended, so light changes (sunset, the hall waking up) are smooth functions of time.
import * as THREE from 'three';
import { U } from './materials.js';
import { SKY } from './sky.js';

const C = (h) => new THREE.Color(h);
const sunFrom = (azDeg, elDeg) => {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  // azimuth 0 = north (-z), 90 = east (+x), 270 = west (-x)
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
};

export const LOOKS = {
  dusk: {
    sunDir: sunFrom(326, 15), sunColor: C(0xffa964), sunInt: 3.0,
    skyAmb: C(0x6a6aa8), groundAmb: C(0x7a5048), ambInt: 1.05, shadowTint: C(0x6a58a8),
    rimColor: C(0xffc070), rimInt: 1.5,
    key2Dir: new THREE.Vector3(0, -1, 0), key2Color: C(0x000000),
    fogColor: C(0x9a86b8), fogSunColor: C(0xffb070), fogDensity: 0.0042, fogFalloff: 0.014, fogBase: 0, fogMax: 0.9,
    aoLow: 0.6, aoBase: 0, aoHeight: 8,
    sky: { zenith: C(0x324a8e), mid: C(0x8e7ab8), horizon: C(0xf3a878), horizonSun: C(0xffcf86), below: C(0x6d5a78),
      cloudLit: C(0xffd29a), cloudMid: C(0xea9a92), cloudShade: C(0x8a6fae), cloudDeep: C(0x55508e), cloudRim: C(0xfff0c0), sunGlow: 1, bright: 1 },
    post: { exposure: 1.0, bloom: 0.85, bloomThreshold: 1.05, rays: 0.9, ink: [0.16, 0.085, 0.05], inkOpacity: 0.85,
      shadowTone: [-0.03, 0.02, 0.09], highTone: [0.08, 0.03, -0.05], toneAmt: 1.0, contrast: 1.07, sat: 1.1,
      vignette: 0.5, vignetteColor: [0.5, 0.42, 0.62], canvas: 0.06, rayColor: [1.0, 0.7, 0.4] },
  },
};

// derived looks: a deep copy of dusk with overrides (every look has the same keys, so
// they can be blended with mixLook)
function derive(base, o) {
  const out = {};
  for (const k of Object.keys(base)) {
    const v = base[k];
    if (o[k] === undefined) out[k] = v && v.clone ? v.clone() : (Array.isArray(v) ? v.slice() : (typeof v === 'object' ? derive(v, {}) : v));
    else if (typeof v === 'object' && !v.isColor && !v.isVector3 && !Array.isArray(v)) out[k] = derive(v, o[k]);
    else out[k] = o[k];
  }
  return out;
}
const toHeart = new THREE.Vector3(-0.246, 0.3, -0.969).normalize(); // from the catwalk towards the heart
// the shaft: cold daylight from the hatch far above, warm lamps, depth fading to dark
LOOKS.shaft = derive(LOOKS.dusk, {
  sunDir: new THREE.Vector3(0.15, 1, 0.1).normalize(), sunColor: C(0x8fa4e0), sunInt: 0.5,
  skyAmb: C(0x3a3e5e), groundAmb: C(0x3a2622), ambInt: 0.75, shadowTint: C(0x3a3a6a),
  rimColor: C(0xffb070), rimInt: 1.2, key2Dir: new THREE.Vector3(0, -1, 0), key2Color: C(0x1a0c06),
  fogColor: C(0x1c1620), fogSunColor: C(0x2a2430), fogDensity: 0.03, fogFalloff: 0.001, fogBase: 0, fogMax: 0.92,
  aoLow: 0.8, aoBase: -200, aoHeight: 4,
  post: { exposure: 1.15, bloom: 1.0, bloomThreshold: 1.0, rays: 0, vignette: 0.6, vignetteColor: [0.25, 0.2, 0.3], contrast: 1.1 },
});
// the machine hall with the dying heart: dim ember light, violet shadows
LOOKS.hall = derive(LOOKS.dusk, {
  sunDir: toHeart, sunColor: C(0xff8a44), sunInt: 1.25,
  skyAmb: C(0x4a3e6a), groundAmb: C(0x9a4a22), ambInt: 1.1, shadowTint: C(0x4a3478),
  rimColor: C(0xffa050), rimInt: 1.6, key2Dir: new THREE.Vector3(0, -1, 0), key2Color: C(0x3a1406),
  fogColor: C(0x3a2830), fogSunColor: C(0xa0502a), fogDensity: 0.0085, fogFalloff: 0.012, fogBase: -150, fogMax: 0.85,
  aoLow: 0.65, aoBase: -150, aoHeight: 6,
  post: { exposure: 1.3, bloom: 1.05, bloomThreshold: 1.0, rays: 0, shadowTone: [-0.02, 0.0, 0.1], highTone: [0.1, 0.03, -0.06], vignette: 0.5, vignetteColor: [0.35, 0.2, 0.3], sat: 1.12 },
});
// the hall when the heart runs again: golden, bright, warm fog
LOOKS.hallAwake = derive(LOOKS.hall, {
  sunColor: C(0xffc070), sunInt: 2.7, skyAmb: C(0x6a5a8a), groundAmb: C(0xb0602a), ambInt: 1.05,
  rimColor: C(0xffd890), rimInt: 2.2, key2Color: C(0x6a2a0c),
  fogColor: C(0x6a4a3a), fogSunColor: C(0xffc070), fogDensity: 0.0075,
  post: { exposure: 1.2, bloom: 1.3, bloomThreshold: 1.0, rays: 0, highTone: [0.12, 0.05, -0.06], sat: 1.15, vignette: 0.45 },
});
// blue hour for the epilogue: the sun is almost gone, the city lights carry the frame
LOOKS.night = derive(LOOKS.dusk, {
  sunColor: C(0xff7a4a), sunInt: 1.5,
  skyAmb: C(0x4a5a9a), groundAmb: C(0x5a4050), ambInt: 0.95, shadowTint: C(0x4a4a9a),
  rimColor: C(0xffb070), rimInt: 1.3,
  fogColor: C(0x4a4a78), fogSunColor: C(0xd08060), fogDensity: 0.0048,
  sky: { zenith: C(0x16204a), mid: C(0x3e3e7e), horizon: C(0xc0705e), horizonSun: C(0xff9a5a), below: C(0x3a3050),
    cloudLit: C(0xf0a080), cloudMid: C(0x8a5a7a), cloudShade: C(0x4a4078), cloudDeep: C(0x2a2a5a), cloudRim: C(0xffc090), sunGlow: 0.7, bright: 0.85 },
  post: { exposure: 1.08, bloom: 1.15, bloomThreshold: 0.95, rays: 0.5, shadowTone: [-0.04, 0.0, 0.12], vignette: 0.55 },
});

const tmpC = new THREE.Color();
export function applyLook(engine, L) {
  U.uSunDir.value.copy(L.sunDir);
  U.uSunColor.value.copy(L.sunColor); U.uSunInt.value = L.sunInt;
  U.uSkyAmb.value.copy(L.skyAmb); U.uGroundAmb.value.copy(L.groundAmb); U.uAmbInt.value = L.ambInt;
  U.uShadowTint.value.copy(L.shadowTint);
  U.uRimColor.value.copy(L.rimColor); U.uRimInt.value = L.rimInt;
  U.uKeyDir2.value.copy(L.key2Dir); U.uKeyColor2.value.copy(L.key2Color);
  U.uFogColor.value.copy(L.fogColor); U.uFogSunColor.value.copy(L.fogSunColor);
  U.uFogDensity.value = L.fogDensity; U.uFogFalloff.value = L.fogFalloff; U.uFogBase.value = L.fogBase; U.uFogMax.value = L.fogMax;
  U.uAOLow.value = L.aoLow; U.uAOBase.value = L.aoBase; U.uAOHeight.value = L.aoHeight;
  const s = L.sky;
  SKY.uZenith.value.copy(s.zenith); SKY.uMid.value.copy(s.mid); SKY.uHorizon.value.copy(s.horizon); SKY.uHorizonSun.value.copy(s.horizonSun);
  SKY.uBelow.value.copy(s.below); SKY.uCloudLit.value.copy(s.cloudLit); SKY.uCloudMid.value.copy(s.cloudMid);
  SKY.uCloudShade.value.copy(s.cloudShade); SKY.uCloudDeep.value.copy(s.cloudDeep); SKY.uCloudRim.value.copy(s.cloudRim);
  SKY.uSunGlow.value = s.sunGlow; SKY.uSkyBright.value = s.bright;
  const p = L.post, pp = engine.post.params, cu = engine.post.mComp.uniforms;
  pp.exposure = p.exposure; pp.bloom = p.bloom; pp.bloomThreshold = p.bloomThreshold; pp.rays = p.rays;
  cu.uInk.value.setRGB(...p.ink); cu.uInkOpacity.value = p.inkOpacity;
  cu.uShadowTone.value.setRGB(...p.shadowTone); cu.uHighTone.value.setRGB(...p.highTone); cu.uToneAmt.value = p.toneAmt;
  cu.uContrast.value = p.contrast; cu.uSat.value = p.sat; cu.uVignette.value = p.vignette;
  cu.uVignetteColor.value.setRGB(...p.vignetteColor); cu.uCanvas.value = p.canvas; cu.uRayColor.value.setRGB(...p.rayColor);
}

// blend two looks (t in 0..1) into a new look object
export function mixLook(A, B, t) {
  const out = {};
  for (const k of Object.keys(A)) {
    const a = A[k], b = B[k];
    if (a instanceof THREE.Color) out[k] = a.clone().lerp(b, t);
    else if (a instanceof THREE.Vector3) out[k] = a.clone().lerp(b, t).normalize();
    else if (typeof a === 'number') out[k] = a + (b - a) * t;
    else if (Array.isArray(a)) out[k] = a.map((v, i) => v + (b[i] - v) * t);
    else if (typeof a === 'object') out[k] = mixLook(a, b, t);
    else out[k] = t < 0.5 ? a : b;
  }
  return out;
}
