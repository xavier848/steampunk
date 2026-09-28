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
