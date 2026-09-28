// Painted shop signs and hanging emblem signs in one canvas atlas (German names).
import * as THREE from 'three';
import { canvasTexture } from '../engine/textures.js';
import { toonMaterial } from '../engine/materials.js';
import { RNG } from '../core/rng.js';

export const FASCIA = [
  'BÄCKEREI', 'UHRMACHER', 'ZEITUNGEN', 'APOTHEKE', 'KAFFEEHAUS', 'HUTMACHER', 'MESSINGWAREN', 'DAMPFBAD',
  'SCHLOSSEREI', 'TABAK', 'BUCHHANDLUNG', 'OPTIKER', 'KOLONIALWAREN', 'SCHNEIDEREI', 'EISENWAREN', 'ZUM KESSEL',
];
const BOARDS = ['#1f3a30', '#4a1c1e', '#1d2742', '#221c1a', '#3a2440', '#1c3438', '#5a3a1a', '#2a2a2a'];
const EMBLEMS = ['pretzel', 'key', 'gear', 'hat', 'clock', 'glasses', 'boot', 'cup', 'anchor', 'scissors', 'bottle', 'book', 'hammer', 'pipe', 'lamp', 'star'];

const CELL_W = 512, CELL_H = 128; // fascia cells: 4 x 4 in the top half
const EMB = 256;                  // emblem cells: 8 x 2 in the bottom half

function goldText(ctx, text, x, y, size, maxW) {
  ctx.font = `bold ${size}px "DejaVu Serif", Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size;
  while (ctx.measureText(text).width > maxW && s > 20) { s -= 2; ctx.font = `bold ${s}px "DejaVu Serif", Georgia, serif`; }
  ctx.fillStyle = 'rgba(10,6,4,0.7)';
  ctx.fillText(text, x + 3, y + 4);
  const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
  g.addColorStop(0, '#fff0b8'); g.addColorStop(0.45, '#e8b64e'); g.addColorStop(1, '#9a6424');
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
}

function drawEmblem(ctx, kind, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#fff0b8'); g.addColorStop(0.5, '#e0aa44'); g.addColorStop(1, '#8a5a20');
  ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
  const circle = (x, y, r, fill = true) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); };
  switch (kind) {
    case 'pretzel':
      ctx.beginPath(); ctx.ellipse(-s * 0.3, 0, s * 0.35, s * 0.45, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(s * 0.3, 0, s * 0.35, s * 0.45, -0.3, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'key':
      circle(-s * 0.45, 0, s * 0.3, false); ctx.beginPath(); ctx.moveTo(-s * 0.15, 0); ctx.lineTo(s * 0.7, 0); ctx.stroke();
      ctx.fillRect(s * 0.4, 0, s * 0.1, s * 0.3); ctx.fillRect(s * 0.6, 0, s * 0.1, s * 0.25);
      break;
    case 'gear': {
      ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? s * 0.62 : s * 0.8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; circle(0, 0, s * 0.25); ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'hat':
      ctx.fillRect(-s * 0.4, -s * 0.6, s * 0.8, s * 0.9); ctx.fillRect(-s * 0.7, s * 0.25, s * 1.4, s * 0.16);
      break;
    case 'clock':
      circle(0, 0, s * 0.7, false); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.45); ctx.moveTo(0, 0); ctx.lineTo(s * 0.35, s * 0.1); ctx.stroke();
      break;
    case 'glasses':
      circle(-s * 0.35, 0, s * 0.25, false); circle(s * 0.35, 0, s * 0.25, false); ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.1, 0); ctx.stroke();
      break;
    case 'boot':
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.6); ctx.lineTo(s * 0.1, -s * 0.6); ctx.lineTo(s * 0.1, s * 0.2); ctx.lineTo(s * 0.6, s * 0.35); ctx.lineTo(s * 0.6, s * 0.55); ctx.lineTo(-s * 0.3, s * 0.55); ctx.closePath(); ctx.fill();
      break;
    case 'cup':
      ctx.fillRect(-s * 0.4, -s * 0.3, s * 0.7, s * 0.7); circle(s * 0.4, s * 0.05, s * 0.2, false); ctx.fillRect(-s * 0.6, s * 0.45, s * 1.1, s * 0.1);
      break;
    case 'anchor':
      ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(0, s * 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.5, 0.2, Math.PI - 0.2); ctx.stroke(); circle(0, -s * 0.75, s * 0.15, false);
      break;
    case 'scissors':
      circle(-s * 0.3, s * 0.4, s * 0.2, false); circle(s * 0.3, s * 0.4, s * 0.2, false);
      ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.25); ctx.lineTo(s * 0.35, -s * 0.7); ctx.moveTo(s * 0.2, s * 0.25); ctx.lineTo(-s * 0.35, -s * 0.7); ctx.stroke();
      break;
    case 'bottle':
      ctx.fillRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.75); ctx.fillRect(-s * 0.1, -s * 0.6, s * 0.2, s * 0.5);
      break;
    case 'book':
      ctx.fillRect(-s * 0.6, -s * 0.45, s * 0.55, s * 0.9); ctx.fillRect(s * 0.05, -s * 0.45, s * 0.55, s * 0.9);
      break;
    case 'hammer':
      ctx.fillRect(-s * 0.08, -s * 0.3, s * 0.16, s * 0.95); ctx.fillRect(-s * 0.5, -s * 0.6, s * 1.0, s * 0.32);
      break;
    case 'pipe':
      ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.2); ctx.lineTo(s * 0.1, -s * 0.2); ctx.stroke(); ctx.fillRect(s * 0.05, -s * 0.45, s * 0.45, s * 0.7);
      break;
    case 'lamp':
      ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.5); ctx.lineTo(s * 0.4, s * 0.5); ctx.lineTo(s * 0.25, -s * 0.3); ctx.lineTo(-s * 0.25, -s * 0.3); ctx.closePath(); ctx.fill(); circle(0, -s * 0.5, s * 0.15);
      break;
    default: {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? s * 0.3 : s * 0.75; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

export function createSignAtlas() {
  const r = new RNG(42);
  return canvasTexture(2048, 1024, (ctx) => {
    ctx.fillStyle = '#20160f'; ctx.fillRect(0, 0, 2048, 1024);
    FASCIA.forEach((name, i) => {
      const x = (i % 4) * CELL_W, y = Math.floor(i / 4) * CELL_H;
      const col = BOARDS[i % BOARDS.length];
      ctx.fillStyle = col; ctx.fillRect(x, y, CELL_W, CELL_H);
      // painterly board strokes
      for (let k = 0; k < 40; k++) {
        ctx.globalAlpha = 0.08; ctx.fillStyle = r.chance(0.5) ? '#ffffff' : '#000000';
        ctx.fillRect(x + r.range(0, CELL_W), y + r.range(0, CELL_H), r.range(60, 200), r.range(2, 6));
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#c8963e'; ctx.lineWidth = 5; ctx.strokeRect(x + 10, y + 10, CELL_W - 20, CELL_H - 20);
      ctx.lineWidth = 2; ctx.strokeRect(x + 18, y + 18, CELL_W - 36, CELL_H - 36);
      goldText(ctx, name, x + CELL_W / 2, y + CELL_H / 2 + 3, 62, CELL_W - 70);
    });
    EMBLEMS.forEach((kind, i) => {
      const x = (i % 8) * EMB, y = 512 + Math.floor(i / 8) * EMB;
      ctx.fillStyle = BOARDS[(i + 3) % BOARDS.length]; ctx.fillRect(x, y, EMB, EMB);
      ctx.strokeStyle = '#c8963e'; ctx.lineWidth = 8; ctx.strokeRect(x + 12, y + 12, EMB - 24, EMB - 24);
      drawEmblem(ctx, kind, x + EMB / 2, y + EMB / 2, EMB * 0.34);
    });
  });
}

export function signUV(kind, idx) {
  if (kind === 'fascia') {
    const i = idx % 16;
    const x = (i % 4) * CELL_W, y = Math.floor(i / 4) * CELL_H;
    return [x / 2048, 1 - (y + CELL_H) / 1024, (x + CELL_W) / 2048, 1 - y / 1024];
  }
  const i = idx % 16;
  const x = (i % 8) * EMB, y = 512 + Math.floor(i / 8) * EMB;
  return [x / 2048, 1 - (y + EMB) / 1024, (x + EMB) / 2048, 1 - y / 1024];
}

const TEX_VERT = /* glsl */ `
attribute float aId;
out vec3 vWP; out vec3 vN; out vec2 vUv; out vec3 vVN; out float vDepth; out float vId;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; vVN = mat3(viewMatrix) * vN; vUv = uv; vId = aId;
  gl_Position = projectionMatrix * mv;
}`;
const TEX_FRAG = /* glsl */ `
uniform sampler2D uMap;
in vec3 vWP; in vec3 vN; in vec2 vUv; in vec3 vVN; in float vDepth; in float vId;
void main() {
  if (uPass == 1) { oColor = vec4(0.0); oNormal = vec4(0.0); return; }
  vec3 N = normalize(vN);
  vec3 albedo = texture(uMap, vUv).rgb;
  float sh = sunShadow(vWP, N);
  vec3 col = toonShade(albedo, N, vWP, 0.0, 0.25, 0.6, sh, groundAO(vWP));
  col = applyFog(col, vWP);
  writeOut(col, normalize(vVN), vDepth, vId);
}`;

export function texturedMaterial(map, { polygonOffset = true, side = THREE.FrontSide } = {}) {
  const m = toonMaterial({ vertex: TEX_VERT, fragment: TEX_FRAG, uniforms: { uMap: { value: map } }, side });
  if (polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; }
  return m;
}

// Build one mesh with all signs (fascia boards and double sided hanging emblems).
export function buildSigns(atlas, X) {
  const pos = [], nrm = [], uv = [], ids = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const pushQuad = (matrix, w, h, [u0, v0, u1, v1], flip = false) => {
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const uvs = flip ? [[u1, v0], [u0, v0], [u0, v1], [u1, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const nz = flip ? -1 : 1;
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    n.set(0, 0, nz).transformDirection(matrix);
    for (const k of order) {
      v.set(pts[k][0], pts[k][1], flip ? -0.02 : 0.0).applyMatrix4(matrix);
      pos.push(v.x, v.y, v.z); nrm.push(n.x, n.y, n.z); uv.push(uvs[k][0], uvs[k][1]); ids.push(0.77);
    }
  };
  for (const s of X.signs) pushQuad(s.matrix, s.w, s.h, signUV('fascia', s.idx));
  for (const s of X.hanging) {
    const uvr = signUV('emblem', s.idx);
    pushQuad(s.matrix, s.w, s.h, uvr, false);
    pushQuad(s.matrix, s.w, s.h, uvr, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(ids, 1));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, texturedMaterial(atlas));
}

// hanging sign boards (the wooden plate behind the emblem) go into the world builder
export function addHangingBoards(b, X) {
  for (const s of X.hanging) {
    b.add(new THREE.BoxGeometry(s.w + 0.08, s.h + 0.08, 0.012), s.matrix, { color: 0x3a2a1e, layer: 3, scale: 1, spec: 0, emit: 0, id: 0.76, uv: false });
    // chains
    for (const sx of [-s.w * 0.35, s.w * 0.35]) {
      const m = s.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(sx, s.h / 2 + 0.12, 0).multiply(new THREE.Matrix4().makeScale(0.015, 0.24, 0.015)));
      b.add(new THREE.CylinderGeometry(1, 1, 1, 4), m, { color: 0x2a2626, layer: 11, scale: 1, spec: 0.3, emit: 0, id: 0.76, uv: false });
    }
  }
}
