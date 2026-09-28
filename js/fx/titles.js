// Title card and end credits, painted into canvases. The DAMPFSTADT lettering is drawn
// from our own glyph outlines (riveted brass slab letters), so it looks the same on
// every machine; the credits use the system serif.
import * as THREE from 'three';

// glyphs on a 10 x 14 grid (y down); 'f' = filled outline (with holes), 's' = stroke
const GLYPHS = {
  D: { w: 10, f: ['M0,0 L6,0 Q10,0 10,7 Q10,14 6,14 L0,14 Z M3,3 L5.6,3 Q7,3 7,7 Q7,11 5.6,11 L3,11 Z'] },
  A: { w: 10.4, f: ['M0,14 L3.9,0 L6.5,0 L10.4,14 L7.3,14 L6.6,11 L3.8,11 L3.1,14 Z M4.5,8.3 L5.9,8.3 L5.2,4.9 Z'] },
  M: { w: 11, f: ['M0,14 L0,0 L3.2,0 L5.5,6.4 L7.8,0 L11,0 L11,14 L8.2,14 L8.2,6.2 L6.3,11.4 L4.7,11.4 L2.8,6.2 L2.8,14 Z'] },
  P: { w: 9.6, f: ['M0,14 L0,0 L5.8,0 Q9.6,0 9.6,4.6 Q9.6,9.2 5.8,9.2 L3,9.2 L3,14 Z M3,2.9 L5.6,2.9 Q6.8,2.9 6.8,4.6 Q6.8,6.3 5.6,6.3 L3,6.3 Z'] },
  F: { w: 9, f: ['M0,14 L0,0 L9,0 L9,3 L3,3 L3,5.7 L7.8,5.7 L7.8,8.6 L3,8.6 L3,14 Z'] },
  S: { w: 9.6, s: ['M8.6,2.6 C7.4,0.7 5.8,1.4 4.6,1.4 C2.6,1.4 1.5,2.6 1.5,4.2 C1.5,6.2 3.4,6.7 4.9,7.1 C6.8,7.6 8.2,8.2 8.2,10 C8.2,11.8 6.8,12.6 4.8,12.6 C3.2,12.6 1.9,12.1 1.0,11.0'], sw: 2.9 },
  T: { w: 10, f: ['M0,0 L10,0 L10,3 L6.5,3 L6.5,14 L3.5,14 L3.5,3 L0,3 Z'] },
};
const RIVETS = {
  D: [[1.5, 1.5], [1.5, 12.5]], A: [[5.2, 1.4]], M: [[1.4, 1.5], [9.6, 1.5]], P: [[1.5, 1.5], [1.5, 12.5]],
  F: [[1.5, 1.5], [7.8, 1.5]], S: [], T: [[1.4, 1.5], [8.6, 1.5], [5, 12.5]],
};

function glyphPath(ctx, g, sc, x0, y0) {
  const tr = (s) => s.replace(/(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/g, (m, a, _b, c) => `${(x0 + a * sc).toFixed(2)},${(y0 + c * sc).toFixed(2)}`);
  return (g.f || g.s).map((d) => new Path2D(tr(d).replace(/([MLQCZ])/g, ' $1 ').replace(/,/g, ' ')));
}

function drawWord(ctx, word, cx, cy, sc) {
  const gap = 1.5;
  const total = [...word].reduce((a, ch) => a + GLYPHS[ch].w, 0) + gap * (word.length - 1);
  let x = cx - (total * sc) / 2;
  const y0 = cy - 7 * sc;
  const letters = [];
  for (const ch of word) { letters.push({ g: GLYPHS[ch], ch, x }); x += (GLYPHS[ch].w + gap) * sc; }
  const paint = (fn) => { for (const L of letters) fn(L, glyphPath(ctx, L.g, sc, L.x, y0)); };
  const shape = (L, paths, style, width, offx = 0, offy = 0) => {
    ctx.save(); ctx.translate(offx, offy);
    for (const p of paths) {
      if (L.g.s) { ctx.lineWidth = L.g.sw * sc + width; ctx.lineCap = 'round'; ctx.strokeStyle = style; ctx.stroke(p); }
      else if (width > 0) { ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.strokeStyle = style; ctx.stroke(p); ctx.fillStyle = style; ctx.fill(p, 'evenodd'); }
      else { ctx.fillStyle = style; ctx.fill(p, 'evenodd'); }
    }
    ctx.restore();
  };
  // soft shadow, dark rim, brass body, highlight on the upper edges, rivets
  paint((L, p) => shape(L, p, 'rgba(20,8,4,0.55)', sc * 1.4, sc * 0.45, sc * 0.7));
  paint((L, p) => shape(L, p, '#2a140a', sc * 0.9));
  const grad = ctx.createLinearGradient(0, y0, 0, y0 + 14 * sc);
  grad.addColorStop(0, '#fff0b8'); grad.addColorStop(0.18, '#f2c360'); grad.addColorStop(0.5, '#c98a2e'); grad.addColorStop(0.56, '#a8661e'); grad.addColorStop(0.8, '#d8a044'); grad.addColorStop(1, '#8a4e18');
  paint((L, p) => shape(L, p, grad, 0));
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  // painted streaks across the metal
  for (let i = 0; i < 90; i++) {
    const yy = y0 + ((i * 37) % 140) / 10 * sc, xx = cx - 60 * sc + ((i * 53) % 1200) / 10 * sc;
    ctx.strokeStyle = i % 3 ? 'rgba(255,240,200,0.12)' : 'rgba(90,40,10,0.14)';
    ctx.lineWidth = sc * 0.35; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + sc * 3.5, yy - sc * 0.4); ctx.stroke();
  }
  ctx.restore();
  paint((L, p) => { ctx.save(); ctx.beginPath(); for (const pp of p) ctx.clip(pp, 'evenodd'); shape(L, p, 'rgba(255,248,220,0.55)', sc * 0.25, -sc * 0.12, -sc * 0.18); ctx.restore(); });
  for (const L of letters) for (const [rx, ry] of RIVETS[L.ch]) {
    const X = L.x + rx * sc, Y = y0 + ry * sc;
    ctx.fillStyle = '#3a1c0c'; ctx.beginPath(); ctx.arc(X + sc * 0.08, Y + sc * 0.1, sc * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(X, Y, sc * 0.32, 0, Math.PI * 2); ctx.fill();
  }
}

export function createTitleTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const ctx = c.getContext('2d');
  drawWord(ctx, 'DAMPFSTADT', 1024, 220, 16.5);
  // thin rule with a gear and the subtitle
  ctx.fillStyle = 'rgba(250,226,170,0.95)';
  ctx.fillRect(724, 372, 600, 3);
  ctx.beginPath(); ctx.arc(1024, 373, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a3414'; ctx.beginPath(); ctx.arc(1024, 373, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = '600 40px Georgia, "DejaVu Serif", "Times New Roman", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(40,16,6,0.6)'; ctx.fillText('Eine Geschichte aus der Stadt der Maschinen', 1026, 432);
  ctx.fillStyle = '#fbe7bd'; ctx.fillText('Eine Geschichte aus der Stadt der Maschinen', 1024, 429);
  return tex(c);
}

export const CREDITS = [
  ['big', 'DAMPFSTADT'], ['gap'],
  ['role', 'Ein Kurzfilm, der in Echtzeit im Browser entsteht'], ['gap'], ['gap'],
  ['role', 'Mit'], ['name', 'Emil'], ['name', 'Wachtmeister Brummer'], ['name', 'den Leuten von Dampfstadt'], ['name', 'den Automaten der Tiefe'], ['name', 'und dem Großen Herz'], ['gap'],
  ['role', 'Idee und Auftrag'], ['name', 'Xavier Haas'], ['gap'],
  ['role', 'Geschichte, Kamera, Animation und Musik'], ['name', 'Claude'], ['gap'],
  ['role', 'Gemalt mit'], ['name', 'three.js und WebGL 2'], ['gap'],
  ['role', 'Jede Figur, jedes Haus, jeder Pinselstrich'], ['role', 'und jeder Klang ist prozedural erzeugt.'], ['role', 'Keine Modelle, keine Fotos, keine Samples.'], ['gap'], ['gap'],
  ['name', 'Danke fürs Zuschauen'], ['gap'], ['gap'], ['big', 'Ende'],
];

export function createCreditsTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 4096;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = 160;
  for (const [kind, text] of CREDITS) {
    if (kind === 'gap') { y += 70; continue; }
    if (kind === 'big') {
      if (text === 'DAMPFSTADT') { drawWord(ctx, text, 512, y + 20, 7.2); y += 170; continue; }
      ctx.font = '600 84px Georgia, "DejaVu Serif", serif'; ctx.fillStyle = '#f6d9a0'; ctx.fillText(text, 512, y); y += 130; continue;
    }
    ctx.font = kind === 'role' ? 'italic 34px Georgia, "DejaVu Serif", serif' : '600 50px Georgia, "DejaVu Serif", serif';
    ctx.fillStyle = kind === 'role' ? '#d9b98a' : '#fbe9c4';
    ctx.fillText(text, 512, y);
    y += kind === 'role' ? 56 : 70;
  }
  const t = tex(c);
  t.userData.used = (y + 120) / 4096;
  return t;
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; // composited in display space
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.userData = {};
  return t;
}
