// Procedural hand painted textures. No image files: every layer is painted with
// Canvas 2D brush strokes at startup. The layers live in one texture array so the
// whole city can be drawn with a single material.
//
// RGB  = albedo modulation (0.5 means "unchanged", painted strokes vary around it)
// A    = shading bias: shifts the toon light bands so the terminator follows the strokes
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

export const LAYER = {
  PLASTER: 0, STONE: 1, BRICK: 2, WOOD: 3, TILE: 4, SLATE: 5, METAL: 6, COBBLE: 7,
  CLOTH: 8, STRIPES: 9, GLASS: 10, IRON: 11, PATINA: 12, PLANKS: 13, BRUSH: 14, FLAGSTONE: 15,
  FACADE: 16, WATER: 17,
};
const SIZE = 512;
const TAU = Math.PI * 2;

class Painter {
  constructor(size, seed) {
    this.size = size;
    this.c = document.createElement('canvas');
    this.c.width = this.c.height = size;
    this.ctx = this.c.getContext('2d', { willReadFrequently: true });
    this.r = new RNG(seed);
    // A is painted on a second canvas
    this.a = document.createElement('canvas');
    this.a.width = this.a.height = size;
    this.actx = this.a.getContext('2d', { willReadFrequently: true });
  }
  fill(v, a = 128) {
    this.ctx.fillStyle = gray(v); this.ctx.fillRect(0, 0, this.size, this.size);
    this.actx.fillStyle = gray(a); this.actx.fillRect(0, 0, this.size, this.size);
  }
  // draw fn at the wrapped positions so the texture tiles seamlessly
  wrap(x, y, reach, fn) {
    const S = this.size;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * S, py = y + oy * S;
      if (px + reach < 0 || px - reach > S || py + reach < 0 || py - reach > S) continue;
      fn(px, py);
    }
  }
  stroke(ctx, x, y, len, wid, ang, style, alpha) {
    len = Math.max(0.5, len); wid = Math.max(0.5, wid);
    this.wrap(x, y, len, (px, py) => {
      ctx.save();
      ctx.translate(px, py); ctx.rotate(ang);
      ctx.globalAlpha = alpha; ctx.fillStyle = style;
      ctx.beginPath();
      // tapered stroke: ellipse body with a slightly flattened tail
      ctx.ellipse(0, 0, len * 0.5, wid * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }
  rect(ctx, x, y, w, h, style, alpha = 1) {
    this.wrap(x + w / 2, y + h / 2, Math.max(w, h), (px, py) => {
      ctx.globalAlpha = alpha; ctx.fillStyle = style;
      ctx.fillRect(px - w / 2, py - h / 2, w, h);
      ctx.globalAlpha = 1;
    });
  }
  // many strokes of random value around base
  scumble(n, lenR, widR, angC, angSpread, vBase, vVar, alphaR, toA = false, aVar = 40) {
    const r = this.r;
    for (let i = 0; i < n; i++) {
      const x = r.next() * this.size, y = r.next() * this.size;
      const len = r.range(lenR[0], lenR[1]), wid = r.range(widR[0], widR[1]);
      const ang = angC + r.range(-angSpread, angSpread);
      const v = vBase + r.range(-vVar, vVar);
      const warm = r.range(-6, 6);
      this.stroke(this.ctx, x, y, len, wid, ang, rgb(v + warm, v, v - warm), r.range(alphaR[0], alphaR[1]));
      if (toA) this.stroke(this.actx, x, y, len, wid, ang, gray(128 + r.range(-aVar, aVar)), r.range(alphaR[0], alphaR[1]));
    }
  }
  pixels() {
    const d = this.ctx.getImageData(0, 0, this.size, this.size).data;
    const a = this.actx.getImageData(0, 0, this.size, this.size).data;
    const out = new Uint8Array(this.size * this.size * 4);
    for (let i = 0; i < out.length; i += 4) { out[i] = d[i]; out[i + 1] = d[i + 1]; out[i + 2] = d[i + 2]; out[i + 3] = a[i]; }
    return out;
  }
}
const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r)) | 0},${Math.max(0, Math.min(255, g)) | 0},${Math.max(0, Math.min(255, b)) | 0})`;

// ---------------------------------------------------------------- layers
function plaster(p) {
  p.fill(128);
  p.scumble(260, [80, 200], [26, 60], 0.15, 0.5, 128, 26, [0.09, 0.17], true, 44);
  p.scumble(420, [30, 90], [8, 22], 0.0, 0.8, 128, 30, [0.1, 0.18], true, 36);
  // occasional flaking patches revealing darker base
  for (let i = 0; i < 10; i++) {
    const x = p.r.next() * SIZE, y = p.r.next() * SIZE;
    p.stroke(p.ctx, x, y, p.r.range(30, 70), p.r.range(12, 26), p.r.range(-0.4, 0.4), rgb(104, 98, 96), 0.35);
    p.stroke(p.actx, x, y, p.r.range(30, 70), p.r.range(12, 26), 0, gray(80), 0.4);
  }
}
function ashlar(p, rowH, minW, maxW, mortar, base, hueJit) {
  p.fill(90, 60);
  const r = p.r;
  for (let y = 0; y < SIZE; y += rowH) {
    let x = r.range(0, maxW);
    const end = x + SIZE;
    while (x < end) {
      const w = Math.min(r.range(minW, maxW), end - x);
      if (w < mortar + 4) { x += Math.max(w, 1); continue; }
      const v = base + r.range(-20, 18);
      const h = r.range(-hueJit, hueJit);
      const cx = (x + w / 2) % SIZE, cy = y + rowH / 2;
      const ww = w - mortar, hh = rowH - mortar;
      p.rect(p.ctx, cx - ww / 2, cy - hh / 2, ww, hh, rgb(v + h, v, v - h * 0.6));
      // painted strokes inside the block
      for (let k = 0; k < 5; k++) {
        const sx = cx + r.range(-ww * 0.4, ww * 0.4), sy = cy + r.range(-hh * 0.3, hh * 0.3);
        p.stroke(p.ctx, sx, sy, r.range(ww * 0.3, ww * 0.8), r.range(hh * 0.2, hh * 0.5), r.range(-0.2, 0.2), rgb(v + r.range(-14, 14) + h, v + r.range(-10, 10), v - h * 0.6), 0.35);
      }
      // top highlight, bottom shade
      p.rect(p.ctx, cx - ww / 2, cy - hh / 2, ww, Math.max(2, hh * 0.1), rgb(v + 26, v + 24, v + 20), 0.55);
      p.rect(p.ctx, cx - ww / 2, cy + hh / 2 - Math.max(2, hh * 0.12), ww, Math.max(2, hh * 0.12), rgb(v - 30, v - 32, v - 26), 0.5);
      p.rect(p.actx, cx - ww / 2, cy - hh / 2, ww, hh, gray(150 + r.range(-25, 25)));
      p.rect(p.actx, cx - ww / 2, cy - hh / 2, ww, hh * 0.25, gray(185), 0.6);
      x += w;
    }
  }
}
function wood(p, vertical = true) {
  p.fill(80, 60);
  const r = p.r;
  const pw = 64;
  for (let x = 0; x < SIZE; x += pw) {
    const v = 120 + r.range(-18, 18);
    const w = pw - 4;
    const px = vertical ? x + 2 : 0, py = vertical ? 0 : x + 2;
    const W = vertical ? w : SIZE, H = vertical ? SIZE : w;
    p.ctx.globalAlpha = 1; p.ctx.fillStyle = rgb(v + 8, v, v - 8); p.ctx.fillRect(px, py, W, H);
    p.actx.fillStyle = gray(150 + r.range(-20, 20)); p.actx.fillRect(px, py, W, H);
    for (let k = 0; k < 26; k++) {
      const gx = vertical ? x + 2 + r.range(3, w - 3) : r.next() * SIZE;
      const gy = vertical ? r.next() * SIZE : x + 2 + r.range(3, w - 3);
      const len = r.range(90, 320), wid = r.range(1.5, 4);
      const gv = v + r.range(-30, 22);
      p.stroke(p.ctx, gx, gy, len, wid, vertical ? Math.PI / 2 + r.range(-0.03, 0.03) : r.range(-0.03, 0.03), rgb(gv + 8, gv, gv - 10), r.range(0.3, 0.6));
    }
    // knots
    if (r.chance(0.5)) {
      const kx = vertical ? x + pw / 2 : r.next() * SIZE, ky = vertical ? r.next() * SIZE : x + pw / 2;
      p.stroke(p.ctx, kx, ky, 18, 9, vertical ? Math.PI / 2 : 0, rgb(v - 40, v - 46, v - 52), 0.7);
    }
  }
}
function tiles(p) {
  p.fill(70, 40);
  const r = p.r;
  const rowH = 42, tw = 42;
  for (let row = 0; row < SIZE / rowH; row++) {
    const y0 = row * rowH;
    const off = (row % 2) * tw * 0.5;
    for (let col = -1; col <= SIZE / tw; col++) {
      const x0 = col * tw + off;
      const v = 128 + r.range(-24, 20);
      const h = r.range(-8, 8);
      // tile body: rounded bottom
      p.wrap(x0 + tw / 2, y0 + rowH / 2, tw, (px, py) => {
        const ctx = p.ctx;
        ctx.globalAlpha = 1;
        const g = ctx.createLinearGradient(0, py - rowH / 2, 0, py + rowH / 2);
        g.addColorStop(0, rgb(v - 28 + h, v - 30, v - 32 - h));
        g.addColorStop(0.6, rgb(v + h, v, v - h));
        g.addColorStop(1, rgb(v + 18 + h, v + 14, v + 8 - h));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(px - tw / 2 + 1.5, py - rowH / 2);
        ctx.lineTo(px + tw / 2 - 1.5, py - rowH / 2);
        ctx.lineTo(px + tw / 2 - 1.5, py + rowH / 2 - 8);
        ctx.quadraticCurveTo(px, py + rowH / 2 + 6, px - tw / 2 + 1.5, py + rowH / 2 - 8);
        ctx.closePath(); ctx.fill();
        const a = p.actx;
        const ga = a.createLinearGradient(0, py - rowH / 2, 0, py + rowH / 2);
        ga.addColorStop(0, gray(90)); ga.addColorStop(1, gray(200));
        a.fillStyle = ga; a.beginPath();
        a.moveTo(px - tw / 2 + 1.5, py - rowH / 2); a.lineTo(px + tw / 2 - 1.5, py - rowH / 2);
        a.lineTo(px + tw / 2 - 1.5, py + rowH / 2 - 8); a.quadraticCurveTo(px, py + rowH / 2 + 6, px - tw / 2 + 1.5, py + rowH / 2 - 8);
        a.closePath(); a.fill();
      });
    }
  }
  p.scumble(120, [40, 120], [6, 14], 0, 0.3, 128, 20, [0.05, 0.1]);
}
function slate(p) {
  p.fill(60, 50);
  const r = p.r;
  const rowH = 36;
  for (let y = 0; y < SIZE; y += rowH) {
    let x = r.range(0, 40);
    while (x < SIZE + 40) {
      const w = r.range(34, 58);
      const v = 124 + r.range(-22, 22), h = r.range(-6, 10);
      p.rect(p.ctx, x + 1.5, y + 1.5, w - 3, rowH - 2, rgb(v - h * 0.5, v, v + h));
      p.rect(p.ctx, x + 1.5, y + rowH - 6, w - 3, 4, rgb(v + 22, v + 24, v + 28), 0.5);
      p.rect(p.actx, x + 1.5, y + 1.5, w - 3, rowH - 2, gray(140 + r.range(-30, 30)));
      x += w;
    }
  }
}
function metal(p) {
  p.fill(128, 128);
  const r = p.r;
  p.scumble(260, [120, 380], [3, 10], Math.PI / 2, 0.04, 128, 22, [0.1, 0.22], true, 30);
  p.scumble(90, [40, 100], [10, 30], Math.PI / 2, 0.3, 140, 18, [0.06, 0.12]);
  // panel seams and rivets
  for (const s of [0, 256]) {
    p.rect(p.ctx, 0, s, SIZE, 3, rgb(70, 66, 60), 0.9);
    p.rect(p.ctx, 0, s + 3, SIZE, 2, rgb(180, 176, 168), 0.5);
    p.rect(p.ctx, s, 0, 3, SIZE, rgb(70, 66, 60), 0.9);
    p.rect(p.actx, 0, s, SIZE, 4, gray(40));
    p.rect(p.actx, s, 0, 4, SIZE, gray(40));
    for (let k = 0; k < SIZE; k += 32) {
      for (const [x, y] of [[k + 16, s + 12], [s + 12, k + 16]]) {
        p.wrap(x, y, 8, (px, py) => {
          const ctx = p.ctx;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = rgb(80, 74, 66); ctx.beginPath(); ctx.arc(px + 1, py + 1.5, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = rgb(150, 146, 140); ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill();
          ctx.fillStyle = rgb(215, 210, 200); ctx.beginPath(); ctx.arc(px - 1.3, py - 1.3, 1.8, 0, TAU); ctx.fill();
          p.actx.globalAlpha = 1; p.actx.fillStyle = gray(220); p.actx.beginPath(); p.actx.arc(px, py, 4.5, 0, TAU); p.actx.fill();
        });
      }
    }
  }
}
function cobble(p) {
  p.fill(60, 30);
  const r = p.r;
  const rowH = 30;
  for (let row = 0; row < SIZE / rowH; row++) {
    let x = row % 2 ? 0 : 16;
    const y = row * rowH + rowH / 2;
    while (x < SIZE + 20) {
      const w = r.range(26, 38);
      const v = 128 + r.range(-26, 24), h = r.range(-8, 8);
      const cx = x + w / 2, cy = y + r.range(-2, 2);
      p.wrap(cx, cy, w, (px, py) => {
        const ctx = p.ctx;
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgb(v - 30 + h, v - 32, v - 30 - h);
        ctx.beginPath(); ctx.ellipse(px + 1, py + 2, w * 0.46, rowH * 0.42, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgb(v + h, v, v - h);
        ctx.beginPath(); ctx.ellipse(px, py, w * 0.44, rowH * 0.39, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.fillStyle = rgb(v + 30 + h, v + 28, v + 24 - h);
        ctx.beginPath(); ctx.ellipse(px - w * 0.1, py - rowH * 0.12, w * 0.26, rowH * 0.16, -0.2, 0, TAU); ctx.fill();
        const a = p.actx;
        a.globalAlpha = 1; a.fillStyle = gray(150 + r.range(-20, 20));
        a.beginPath(); a.ellipse(px, py, w * 0.44, rowH * 0.39, 0, 0, TAU); a.fill();
        a.fillStyle = gray(200); a.beginPath(); a.ellipse(px - w * 0.08, py - rowH * 0.1, w * 0.25, rowH * 0.18, 0, 0, TAU); a.fill();
      });
      x += w + 2;
    }
  }
}
function cloth(p) {
  p.fill(128);
  p.scumble(300, [40, 140], [10, 30], Math.PI / 2, 0.25, 128, 14, [0.06, 0.12], true, 30);
  p.scumble(200, [60, 200], [2, 5], Math.PI / 2, 0.08, 120, 18, [0.1, 0.18]);
}
function stripes(p) {
  p.fill(128);
  const r = p.r;
  for (let x = 0; x < SIZE; x += 64) {
    const v = 168;
    p.ctx.globalAlpha = 1; p.ctx.fillStyle = gray(v); p.ctx.fillRect(x, 0, 32, SIZE);
    p.ctx.fillStyle = gray(70); p.ctx.fillRect(x + 32, 0, 32, SIZE);
    for (let k = 0; k < 14; k++) {
      p.stroke(p.ctx, x + 32 + r.range(-2, 2), r.next() * SIZE, r.range(40, 120), r.range(3, 7), Math.PI / 2, gray(120), 0.4);
      p.stroke(p.ctx, x + r.range(-2, 2), r.next() * SIZE, r.range(40, 120), r.range(3, 7), Math.PI / 2, gray(120), 0.4);
    }
  }
  p.scumble(160, [60, 200], [8, 22], Math.PI / 2, 0.2, 128, 12, [0.05, 0.1], true, 20);
}
function glass(p) {
  p.fill(118, 128);
  const r = p.r;
  for (let i = 0; i < 40; i++) {
    const x = r.next() * SIZE, y = r.next() * SIZE;
    p.stroke(p.ctx, x, y, r.range(80, 220), r.range(8, 26), -0.9 + r.range(-0.1, 0.1), gray(180 + r.range(0, 50)), r.range(0.15, 0.4));
  }
  p.scumble(120, [30, 90], [6, 16], 0.6, 0.4, 110, 20, [0.08, 0.15]);
}
function iron(p) {
  p.fill(118, 128);
  const r = p.r;
  p.scumble(360, [20, 80], [6, 20], 0, Math.PI, 118, 24, [0.1, 0.2], true, 40);
  for (let i = 0; i < 40; i++) {
    const x = r.next() * SIZE, y = r.next() * SIZE;
    p.stroke(p.ctx, x, y, r.range(10, 40), r.range(4, 12), r.range(0, 3), rgb(150, 105, 80), r.range(0.2, 0.45));
  }
}
function patina(p) {
  p.fill(128);
  const r = p.r;
  p.scumble(300, [30, 110], [12, 40], Math.PI / 2, 0.5, 132, 22, [0.1, 0.2], true, 40);
  // streaks running down
  for (let i = 0; i < 90; i++) {
    const x = r.next() * SIZE, y = r.next() * SIZE;
    p.stroke(p.ctx, x, y, r.range(60, 200), r.range(3, 8), Math.PI / 2, rgb(150, 170, 165), r.range(0.15, 0.3));
  }
  for (let i = 0; i < 50; i++) {
    const x = r.next() * SIZE, y = r.next() * SIZE;
    p.stroke(p.ctx, x, y, r.range(16, 50), r.range(10, 30), r.range(0, 3), rgb(165, 120, 90), r.range(0.2, 0.4));
  }
}
function planks(p) {
  wood(p, false);
  p.scumble(80, [80, 200], [10, 20], 0, 0.1, 128, 10, [0.05, 0.1]);
}
function brush(p) {
  p.fill(128);
  p.scumble(500, [40, 140], [14, 40], 0, Math.PI, 128, 18, [0.06, 0.13], true, 45);
  p.scumble(300, [16, 50], [6, 14], 0, Math.PI, 128, 22, [0.08, 0.15], true, 35);
}
function flagstone(p) {
  ashlar(p, 128, 110, 200, 6, 128, 5);
  p.scumble(200, [40, 140], [10, 30], 0, Math.PI, 128, 12, [0.05, 0.1]);
}

// far facades: 4 x 4 windows per tile (tile = 12 m wide, 14 m high). A = 1 wall, 0.5 frame, 0 glass
function facade(p) {
  p.fill(128, 255);
  p.scumble(220, [60, 180], [20, 50], 0.1, 0.4, 128, 18, [0.08, 0.15]);
  const r = p.r;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 128 + 34, y = row * 128 + 26, w = 60, h = 84;
      // lintel and sill
      p.rect(p.ctx, x - 8, y - 10, w + 16, 9, rgb(160, 150, 140), 0.8);
      p.rect(p.ctx, x - 6, y + h, w + 12, 8, rgb(160, 150, 140), 0.8);
      // frame + glass
      p.rect(p.ctx, x - 4, y - 2, w + 8, h + 4, rgb(70, 58, 50), 1);
      p.rect(p.actx, x - 4, y - 2, w + 8, h + 4, gray(128), 1);
      p.rect(p.ctx, x, y, w, h, rgb(100, 110, 128), 1);
      p.rect(p.actx, x, y, w, h, gray(0), 1);
      p.rect(p.ctx, x + w / 2 - 2, y, 4, h, rgb(70, 58, 50), 1);
      p.rect(p.actx, x + w / 2 - 2, y, 4, h, gray(128), 1);
      p.rect(p.ctx, x, y + h * 0.4, w, 4, rgb(70, 58, 50), 1);
      p.rect(p.actx, x, y + h * 0.4, w, 4, gray(128), 1);
      // sky reflection stroke
      p.stroke(p.ctx, x + w * 0.3, y + h * 0.3, 50, 10, -0.9, gray(170), 0.35);
    }
    // string course between floors
    p.rect(p.ctx, 0, row * 128 + 120, 512, 6, rgb(150, 140, 130), 0.6);
  }
}
function water(p) {
  p.fill(128);
  p.scumble(400, [60, 220], [3, 9], 0, 0.06, 128, 40, [0.15, 0.3], true, 60);
}

const PAINT = [
  plaster,
  (p) => ashlar(p, 64, 90, 170, 5, 130, 6),
  (p) => ashlar(p, 32, 56, 80, 4, 124, 12),
  (p) => wood(p, true),
  tiles, slate, metal, cobble, cloth, stripes, glass, iron, patina, planks, brush, flagstone,
];

export function createBrushTextures(renderer) {
  const layers = PAINT.length;
  const data = new Uint8Array(SIZE * SIZE * 4 * layers);
  PAINT.forEach((fn, i) => {
    const p = new Painter(SIZE, 1000 + i * 77);
    fn(p);
    data.set(p.pixels(), i * SIZE * SIZE * 4);
  });
  const tex = new THREE.DataArrayTexture(data, SIZE, SIZE, layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Screen space canvas weave for the final composite.
export function createCanvasWeave() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = new RNG(77);
  ctx.fillStyle = gray(128); ctx.fillRect(0, 0, S, S);
  // threads: alternating over/under pattern
  const t = 4;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const over = ((x / t + y / t) % 2) === 0;
      const v = 128 + (over ? 14 : -10) + r.range(-6, 6);
      ctx.fillStyle = gray(v);
      if (over) ctx.fillRect(x, y + 0.5, t, t - 1); else ctx.fillRect(x + 0.5, y, t - 1, t);
    }
  }
  // slubs in the linen
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = gray(r.chance(0.5) ? 160 : 100);
    const horiz = r.chance(0.5);
    const x = r.next() * S, y = r.next() * S;
    if (horiz) ctx.fillRect(x, y, r.range(12, 40), 2); else ctx.fillRect(x, y, 2, r.range(12, 40));
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// Utility to build a CanvasTexture from a drawing callback.
export function canvasTexture(w, h, draw, { srgb = true, mip = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = mip;
  tex.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
