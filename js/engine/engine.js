// Engine: WebGL renderer, shadow rigs (static city shadow baked once per region,
// dynamic shadow around the action every frame), adaptive resolution and the
// deterministic frame render used by playback, stills and the video export.
import * as THREE from 'three';
import { U } from './materials.js';
import { Post } from './post.js';
import { createBrushTextures, createCanvasWeave } from './textures.js';

export const LAYER_MAIN = 0, LAYER_STATIC_CASTER = 1, LAYER_DYN_CASTER = 2;

class ShadowRig {
  constructor(size, layer) {
    this.size = size;
    this.depth = new THREE.DepthTexture(size, size, THREE.FloatType);
    this.depth.compareFunction = THREE.LessEqualCompare;
    this.depth.minFilter = this.depth.magFilter = THREE.LinearFilter;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthTexture: this.depth, depthBuffer: true, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
    this.cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 1000);
    this.cam.layers.set(layer);
    this.mat = new THREE.Matrix4();
    this.key = '';
  }
  // fit an orthographic sun camera around centre (radius R), snapped to texels
  fit(center, R, sunDir, depthRange = 600) {
    const cam = this.cam;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.near = 1; cam.far = depthRange * 2;
    cam.updateProjectionMatrix();
    // stable basis
    const up = Math.abs(sunDir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const texel = (2 * R) / this.size;
    const look = new THREE.Matrix4().lookAt(sunDir.clone(), new THREE.Vector3(0, 0, 0), up);
    const inv = look.clone().invert();
    const c = center.clone().applyMatrix4(inv);
    c.x = Math.round(c.x / texel) * texel;
    c.y = Math.round(c.y / texel) * texel;
    c.applyMatrix4(look);
    cam.position.copy(c).addScaledVector(sunDir, depthRange);
    cam.up.copy(up);
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    this.mat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    return texel;
  }
}

export class Engine {
  constructor(canvas, { headless = false, width, height } = {}) {
    this.canvas = canvas;
    this.headless = headless;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: headless, stencil: false });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(1);
    U.uBrush.value = createBrushTextures(this.renderer);
    this.weave = createCanvasWeave();
    this.post = new Post(this.renderer, { weave: this.weave });
    this.shadowS = new ShadowRig(4096, LAYER_STATIC_CASTER);
    this.shadowD = new ShadowRig(2048, LAYER_DYN_CASTER);
    // a tiny cleared depth texture: shadow samplers are never left unbound (an empty
    // fallback makes WebGL reject the draw) and never sample the map being rendered
    this.shadowDummy = new ShadowRig(4, 30);
    for (const rig of [this.shadowDummy, this.shadowS, this.shadowD]) {
      this.renderer.setRenderTarget(rig.rt); this.renderer.clear(true, true, false);
    }
    this.renderer.setRenderTarget(null);
    U.uShadowS.value = this.shadowDummy.depth;
    U.uShadowD.value = this.shadowDummy.depth;
    this.fixedSize = headless && width ? [width, height] : null;
    this.pixelRatio = 1;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.minPixelRatio = 0.5;
    this.frameTimes = [];
    this.adaptive = !headless;
    this.resize();
  }
  resize() {
    let w, h;
    if (this.fixedSize) [w, h] = this.fixedSize;
    else { w = this.canvas.clientWidth || window.innerWidth; h = this.canvas.clientHeight || window.innerHeight; }
    this.cssW = w; this.cssH = h;
    const pw = Math.max(2, Math.round(w * this.pixelRatio)), ph = Math.max(2, Math.round(h * this.pixelRatio));
    this.renderer.setSize(pw, ph, false);
    this.post.setSize(pw, ph);
    this.width = pw; this.height = ph;
  }
  setPixelRatio(pr) {
    pr = Math.max(this.minPixelRatio, Math.min(this.maxPixelRatio, pr));
    if (Math.abs(pr - this.pixelRatio) < 0.04) return;
    this.pixelRatio = pr;
    this.resize();
  }
  // adapt resolution toward ~60 fps (called with the last frame's wall time)
  adapt(ms) {
    if (!this.adaptive) return;
    this.frameTimes.push(ms);
    if (this.frameTimes.length < 20) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 19) this.setPixelRatio(this.pixelRatio * Math.sqrt(16.6 / avg) * 0.97);
    else if (avg < 12.5) this.setPixelRatio(this.pixelRatio * 1.08);
  }
  bakeStatic(scene, key, center, radius, sunDir, depthRange = 600) {
    if (this.shadowS.key === key) return;
    this.shadowS.key = key;
    const texel = this.shadowS.fit(center, radius, sunDir, depthRange);
    U.uShadowMatS.value.copy(this.shadowS.mat);
    U.uShadowTexS.value = 1 / this.shadowS.size;
    U.uShadowBiasS.value = texel * 1.6;
    this._renderShadow(scene, this.shadowS);
    U.uShadowS.value = this.shadowS.depth;
    U.uShadowSOn.value = 1;
  }
  dynamicShadow(scene, center, radius, sunDir) {
    const texel = this.shadowD.fit(center, radius, sunDir, 300);
    U.uShadowMatD.value.copy(this.shadowD.mat);
    U.uShadowTexD.value = 1 / this.shadowD.size;
    U.uShadowBiasD.value = texel * 1.6;
    this._renderShadow(scene, this.shadowD);
    U.uShadowD.value = this.shadowD.depth;
    U.uShadowDOn.value = 1;
  }
  _renderShadow(scene, rig) {
    const r = this.renderer;
    if (this.post.prof) this.post._mark('pre');
    const keep = [U.uShadowS.value, U.uShadowD.value, U.uShadowSOn.value, U.uShadowDOn.value];
    U.uShadowS.value = U.uShadowD.value = this.shadowDummy.depth;
    U.uShadowSOn.value = U.uShadowDOn.value = 0;
    U.uPass.value = 1;
    r.setRenderTarget(rig.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(scene, rig.cam);
    U.uPass.value = 0;
    [U.uShadowS.value, U.uShadowD.value, U.uShadowSOn.value, U.uShadowDOn.value] = keep;
    r.setRenderTarget(null);
    if (this.post.prof) this.post._mark(rig === this.shadowS ? 'shadowStatic' : 'shadowDyn');
  }
  renderFrame(scene, camera) {
    U.uCamPos.value.copy(camera.position);
    if (!this.keyOverride) {
      // character key light from the upper side of the camera
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      U.uCharKeyDir.value.set(e[0] * 0.55 + e[4] * 0.5 + e[8] * 0.7, e[1] * 0.55 + e[5] * 0.5 + e[9] * 0.7, e[2] * 0.55 + e[6] * 0.5 + e[10] * 0.7).normalize();
    }
    this.post.renderScene(scene, camera);
    this.post.finish(null);
  }
}
