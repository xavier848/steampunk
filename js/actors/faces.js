// Painted face atlas (Canvas 2D). Faces are wrapped cylindrically around the front of the
// head (u = +-81 degrees, v = chin..crown). Cells of 512 px:
//   0..5  boy: neutral, determined, surprised, effort, joy, blink
//   6..9  constable: stern, shout, whistle, puff
//   10,11 crowd: 4 x 4 small faces each (32 variants)
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

export const FACE = { neutral: 0, determined: 1, surprised: 2, effort: 3, joy: 4, blink: 5, stern: 6, shout: 7, whistle: 8, puff: 9, smile: 12 };
const CELL = 512, COLS = 4, ROWS = 4;

const U = (u) => u * CELL, V = (v) => (1 - v) * CELL; // uv -> px inside a cell

function skin(ctx, base, cheek, s = CELL) {
  const g = ctx.createRadialGradient(s * 0.5, s * 0.55, s * 0.05, s * 0.5, s * 0.55, s * 0.6);
  g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  // cheeks
  for (const x of [0.31, 0.69]) {
    const cg = ctx.createRadialGradient(U(x) * s / CELL, V(0.37) * s / CELL, 2, U(x) * s / CELL, V(0.37) * s / CELL, s * 0.075);
    cg.addColorStop(0, cheek); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, s, s);
  }
}

// eye: centre (u,v), expression params
function eye(ctx, cx, cy, side, p) {
  const w = p.eyeW ?? 58, h = (p.eyeH ?? 34) * (p.open ?? 1);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(side * (p.eyeTilt ?? 0.06));
  // socket shadow
  ctx.fillStyle = 'rgba(120,60,50,0.18)';
  ctx.beginPath(); ctx.ellipse(0, -4, w * 0.75, (p.eyeH ?? 34) * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  if ((p.open ?? 1) < 0.12) {
    // closed: a curved lash line
    ctx.strokeStyle = '#2a1510'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * 0.5, 0); ctx.quadraticCurveTo(0, p.happy ? -14 : 10, w * 0.5, 0); ctx.stroke();
    ctx.restore(); return;
  }
  // white
  ctx.fillStyle = '#f6efe4';
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.quadraticCurveTo(-w * 0.1, -h * 1.05, w * 0.5, -h * 0.1);
  ctx.quadraticCurveTo(w * 0.1, h * 0.85, -w * 0.5, 0);
  ctx.fill();
  ctx.save(); ctx.clip();
  // iris + pupil
  const lx = (p.lookX ?? 0) * w * 0.22, ly = (p.lookY ?? 0) * h * 0.25;
  const ir = p.iris ?? 18;
  const ig = ctx.createRadialGradient(lx - 3, ly - 4, 2, lx, ly, ir);
  ig.addColorStop(0, p.irisCol?.[0] ?? '#8fb870'); ig.addColorStop(1, p.irisCol?.[1] ?? '#3f5a2a');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(lx, ly, ir, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#120a08'; ctx.beginPath(); ctx.arc(lx, ly, ir * (p.pupil ?? 0.5), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(lx - ir * 0.35, ly - ir * 0.4, ir * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(lx + ir * 0.35, ly + ir * 0.3, ir * 0.12, 0, Math.PI * 2); ctx.fill();
  // lid shadow on the white
  ctx.fillStyle = 'rgba(90,50,60,0.25)'; ctx.fillRect(-w, -h * 1.2, w * 2, h * 0.55);
  ctx.restore();
  // upper lid line (thick, painted)
  ctx.strokeStyle = '#26130d'; ctx.lineCap = 'round';
  ctx.lineWidth = p.lid ?? 7;
  ctx.beginPath(); ctx.moveTo(-w * 0.56, 2); ctx.quadraticCurveTo(-w * 0.1, -h * 1.12, w * 0.54, -h * 0.12); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,24,0.6)';
  ctx.beginPath(); ctx.moveTo(-w * 0.4, h * 0.2); ctx.quadraticCurveTo(w * 0.1, h * 0.8, w * 0.46, 0); ctx.stroke();
  ctx.restore();
}

function brow(ctx, cx, cy, side, p) {
  ctx.save();
  ctx.translate(cx, cy + (p.browY ?? 0));
  ctx.rotate(side * (p.browAng ?? 0));
  ctx.fillStyle = p.browCol ?? '#4a2a1a';
  ctx.beginPath();
  const w = p.browW ?? 64, t = p.browT ?? 12;
  ctx.moveTo(-w * 0.55 * side, t * 0.4);
  ctx.quadraticCurveTo(0, -t * 1.2, w * 0.55 * side, t * 0.1);
  ctx.quadraticCurveTo(0, -t * 0.1, -w * 0.55 * side, t * 0.9);
  ctx.fill();
  ctx.restore();
}

function mouth(ctx, cx, cy, p) {
  ctx.save(); ctx.translate(cx, cy);
  const w = p.mouthW ?? 60;
  ctx.lineCap = 'round';
  switch (p.mouth) {
    case 'open':
      ctx.fillStyle = '#3a1210'; ctx.beginPath(); ctx.ellipse(0, 6, w * 0.32, p.mouthH ?? 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c05050'; ctx.beginPath(); ctx.ellipse(0, 16, w * 0.2, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2e8dc'; ctx.fillRect(-w * 0.22, -12, w * 0.44, 7);
      break;
    case 'teeth':
      ctx.fillStyle = '#3a1210'; ctx.beginPath(); ctx.ellipse(0, 2, w * 0.45, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2e8dc'; ctx.fillRect(-w * 0.4, -6, w * 0.8, 9);
      ctx.strokeStyle = '#8a4a40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.4, 3); ctx.lineTo(w * 0.4, 3); ctx.stroke();
      break;
    case 'smile':
      ctx.strokeStyle = '#5a2018'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-w * 0.5, -6); ctx.quadraticCurveTo(0, 22, w * 0.5, -8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(-w * 0.36, 0); ctx.quadraticCurveTo(0, 14, w * 0.36, 0); ctx.quadraticCurveTo(0, 6, -w * 0.36, 0); ctx.fill();
      break;
    case 'purse':
      ctx.fillStyle = '#8a3a30'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a1210'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.07, 5, 0, 0, Math.PI * 2); ctx.fill();
      break;
    default: {
      const c = p.smirk ?? 0;
      ctx.strokeStyle = '#5a2018'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-w * 0.45, 2 + c * 4); ctx.quadraticCurveTo(0, 6, w * 0.45, -c * 8); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,70,60,0.5)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-w * 0.25, 14); ctx.quadraticCurveTo(0, 18, w * 0.25, 14); ctx.stroke();
    }
  }
  ctx.restore();
}

function boyFace(ctx, p, r) {
  skin(ctx, ['#f3c9a4', '#dc9e7c'], 'rgba(230,110,90,0.28)');
  // freckles
  const fr = new RNG(7);
  ctx.fillStyle = 'rgba(160,85,55,0.55)';
  for (let i = 0; i < 44; i++) {
    const side = fr.sign();
    const x = U(0.5 + side * fr.range(0.04, 0.22)), y = V(0.42 + fr.range(-0.04, 0.06));
    ctx.beginPath(); ctx.arc(x, y, fr.range(1.5, 3.2), 0, Math.PI * 2); ctx.fill();
  }
  // nose shading (the nose itself is geometry)
  ctx.fillStyle = 'rgba(170,80,60,0.25)';
  ctx.beginPath(); ctx.ellipse(U(0.5) + 6, V(0.39), 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(150,70,50,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(U(0.5) - 12, V(0.375)); ctx.quadraticCurveTo(U(0.5), V(0.36), U(0.5) + 12, V(0.375)); ctx.stroke();
  for (const s of [-1, 1]) {
    eye(ctx, U(0.5 + s * 0.152), V(0.525), s, { eyeW: 86, eyeH: 50, iris: 25, lid: 9, ...p, irisCol: ['#9ac070', '#446a2e'] });
    brow(ctx, U(0.5 + s * 0.158), V(0.64), s, { browW: 96, browT: 17, ...p, browCol: '#6a3420' });
  }
  mouth(ctx, U(0.5), V(0.27), { mouthW: 84, ...p });
  // hair fringe at the top edge (under the cap)
  ctx.fillStyle = '#7a3a1e';
  for (let i = 0; i < 16; i++) {
    const x = U(0.2 + i * 0.04);
    ctx.beginPath(); ctx.moveTo(x - 20, V(0.86)); ctx.lineTo(x + 6, V(0.74 + (i % 3) * 0.015)); ctx.lineTo(x + 26, V(0.86)); ctx.fill();
  }
  ctx.fillRect(0, 0, CELL, V(0.85));
}

function copFace(ctx, p) {
  skin(ctx, ['#eab494', '#c98470'], 'rgba(210,80,70,0.6)');
  // red nose shading
  const ng = ctx.createRadialGradient(U(0.5), V(0.42), 2, U(0.5), V(0.42), 34);
  ng.addColorStop(0, 'rgba(200,70,60,0.7)'); ng.addColorStop(1, 'rgba(200,70,60,0)');
  ctx.fillStyle = ng; ctx.fillRect(0, 0, CELL, CELL);
  for (const s of [-1, 1]) {
    eye(ctx, U(0.5 + s * 0.155), V(0.54), s, { eyeW: 62, eyeH: 30, iris: 16, irisCol: ['#6a8ab0', '#2a3a5a'], lid: 10, ...p });
    brow(ctx, U(0.5 + s * 0.16), V(0.645), s, { browW: 118, browT: 28, browCol: '#5a4a44', ...p });
  }
  // mouth sits under the (geometric) moustache
  mouth(ctx, U(0.5), V(0.25), { mouthW: 76, ...p });
  // stubble
  ctx.fillStyle = 'rgba(90,70,70,0.12)';
  ctx.beginPath(); ctx.ellipse(U(0.5), V(0.2), 120, 70, 0, 0, Math.PI * 2); ctx.fill();
}

function crowdFace(ctx, x0, y0, s, r) {
  // one neutral skin; the crowd shader tints it per person
  const sc = ['#f2caa6', '#dca47e'];
  ctx.save(); ctx.translate(x0, y0);
  const g = ctx.createRadialGradient(s * 0.5, s * 0.55, 2, s * 0.5, s * 0.55, s * 0.6);
  g.addColorStop(0, sc[0]); g.addColorStop(1, sc[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const u = (v) => v * s, vv = (v) => (1 - v) * s;
  const female = r.chance(0.45);
  // eyes: dark almond with a light glint
  for (const side of [-1, 1]) {
    const ex = u(0.5 + side * 0.15);
    ctx.fillStyle = '#f2ebe0';
    ctx.beginPath(); ctx.ellipse(ex, vv(0.53), s * 0.07, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e120c';
    ctx.beginPath(); ctx.arc(ex, vv(0.53), s * 0.034, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - s * 0.012, vv(0.545), s * 0.01, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e120c'; ctx.lineWidth = s * 0.028;
    ctx.beginPath(); ctx.moveTo(ex - s * 0.075, vv(0.54)); ctx.quadraticCurveTo(ex, vv(0.585), ex + s * 0.075, vv(0.545)); ctx.stroke();
    ctx.fillStyle = r.pick(['#3a2418', '#5a3a24', '#2a2020', '#8a8078']);
    ctx.save(); ctx.translate(ex, vv(0.64)); ctx.rotate(side * r.range(-0.15, 0.2));
    ctx.fillRect(-s * 0.08, -s * 0.02, s * 0.16, s * (female ? 0.024 : 0.04)); ctx.restore();
  }
  ctx.fillStyle = 'rgba(150,70,55,0.35)'; ctx.fillRect(u(0.48), vv(0.44), s * 0.05, s * 0.1);
  if (!female && r.chance(0.55)) {
    ctx.fillStyle = r.pick(['#3a2418', '#6a4a30', '#aaa098', '#2a1a14']);
    if (r.chance(0.5)) { ctx.beginPath(); ctx.ellipse(u(0.5), vv(0.34), s * 0.13, s * 0.035, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(u(0.5), vv(0.24), s * 0.18, s * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = female ? '#a83a3a' : '#6a2a20'; ctx.lineWidth = s * 0.035;
  ctx.beginPath(); ctx.moveTo(u(0.43), vv(0.29)); ctx.quadraticCurveTo(u(0.5), vv(0.27), u(0.57), vv(0.29)); ctx.stroke();
  if (female) { ctx.fillStyle = 'rgba(220,100,100,0.3)'; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(u(0.5 + side * 0.15), vv(0.4), s * 0.05, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}

const BOY = [
  { mouth: 'line', smirk: 0.4, browAng: -0.05, open: 1, lookX: 0 },                                  // neutral
  { mouth: 'line', smirk: -0.2, browAng: 0.22, browY: 10, open: 0.8, lookX: 0, lid: 9 },               // determined
  { mouth: 'open', mouthH: 20, browAng: -0.2, browY: -18, open: 1.25, iris: 15, pupil: 0.4 },         // surprised
  { mouth: 'teeth', browAng: 0.3, browY: 12, open: 0.45, lid: 10 },                                   // effort
  { mouth: 'smile', browAng: -0.1, browY: -6, open: 0.75, happy: true },                               // joy
  { mouth: 'line', smirk: 0.2, open: 0.05, browAng: 0.0 },                                             // blink
];
const COP = [
  { mouth: 'line', browAng: 0.25, browY: 8, open: 0.7 },
  { mouth: 'open', mouthH: 26, browAng: 0.35, browY: 12, open: 0.9 },
  { mouth: 'purse', browAng: 0.3, browY: 6, open: 0.6 },
  { mouth: 'open', mouthH: 16, browAng: -0.25, browY: -8, open: 0.5 },
];

export function createFaceAtlas() {
  const c = document.createElement('canvas');
  c.width = CELL * COLS; c.height = CELL * ROWS;
  const ctx = c.getContext('2d');
  const r = new RNG(99);
  const cell = (i, fn) => { ctx.save(); ctx.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL); ctx.beginPath(); ctx.rect(0, 0, CELL, CELL); ctx.clip(); fn(); ctx.restore(); };
  BOY.forEach((p, i) => cell(i, () => boyFace(ctx, p, r)));
  COP.forEach((p, i) => cell(6 + i, () => copFace(ctx, p)));
  cell(12, () => copFace(ctx, { mouth: 'smile', browAng: -0.18, browY: -8, open: 0.7, happy: true }));
  for (const ci of [10, 11]) cell(ci, () => { for (let k = 0; k < 16; k++) crowdFace(ctx, (k % 4) * 128, Math.floor(k / 4) * 128, 128, r); });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// uv offset/scale for a cell (for the shader: uv' = offset + uv * scale)
export function faceCell(i) {
  const x = i % COLS, y = Math.floor(i / COLS);
  return [x / COLS, 1 - (y + 1) / ROWS, 1 / COLS, 1 / ROWS];
}
export function crowdFaceCell(k) {
  const i = 10 + Math.floor(k / 16) % 2, kk = k % 16;
  const [ox, oy, sx, sy] = faceCell(i);
  const x = kk % 4, y = Math.floor(kk / 4);
  return [ox + (x / 4) * sx, oy + (1 - (y + 1) / 4) * sy, sx / 4, sy / 4];
}
