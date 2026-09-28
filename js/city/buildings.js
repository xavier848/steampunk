// Procedural steampunk town houses. A lot describes one house; addBuilding writes
// its geometry into a GeoBuilder (world space) and records animated or emissive
// anchors (gears, lamps, vents, chimneys, signs) in the collector X.
//
// Local frame: facade faces +Z, x runs along the facade, y up, base at y = 0.
// No two visible faces are ever coplanar: trims always protrude by at least 4 cm.
import * as THREE from 'three';
import { P, M, Mseg, mul, gableRoof, pipeRun } from '../engine/geo.js';
import { LAYER } from '../engine/textures.js';
import { RNG } from '../core/rng.js';
import { PAL } from './palette.js';

export function newCollector() {
  return { gears: [], lamps: [], vents: [], chimneys: [], signs: [], clocks: [], lights: [], hanging: [], roofs: [] };
}

const WALL_T = 0.42;

export function addBuilding(b, lot, X) {
  const r = new RNG(lot.seed || 1);
  const T = new THREE.Matrix4().makeRotationY(lot.rot || 0).setPosition(lot.x, lot.y || 0, lot.z);
  const L = (m) => mul(T, m);
  const W = lot.w, D = lot.d;
  const style = lot.style || r.pick(['stone', 'timber', 'timber', 'brick', 'plaster']);
  const id = r.range(0.05, 0.95);
  const gH = lot.groundH || 4.4;
  const fH = lot.floorH || r.pick([3.3, 3.5, 3.6]);
  const floors = lot.floors ?? r.int(2, 4);
  const jetty = style === 'timber' ? (lot.jetty ?? 0.32) : 0;
  const H = gH + floors * fH;
  const wallCol = lot.wall ?? (style === 'stone' ? r.pick(PAL.stone) : style === 'brick' ? r.pick(PAL.brick) : r.pick(PAL.plaster));
  const trimCol = lot.trim ?? (style === 'brick' ? r.pick(PAL.stone) : style === 'timber' ? r.pick(PAL.timber) : r.pick(PAL.stoneDark.concat(PAL.stone)));
  const baseCol = lot.base ?? r.pick(PAL.stone);
  const wallLayer = style === 'stone' ? LAYER.STONE : style === 'brick' ? LAYER.BRICK : LAYER.PLASTER;
  const wallScale = style === 'stone' ? 3.2 : style === 'brick' ? 2.6 : 3.0;
  const mWall = { color: wallCol, layer: wallLayer, scale: wallScale, spec: 0, emit: 0, id, uv: false };
  const mTrim = { color: trimCol, layer: style === 'timber' ? LAYER.WOOD : LAYER.STONE, scale: style === 'timber' ? 1.6 : 2.2, spec: 0, emit: 0, id, uv: false };
  const mBase = { color: baseCol, layer: LAYER.STONE, scale: 2.6, spec: 0, emit: 0, id, uv: false };
  const mGlass = { color: PAL.glass, layer: LAYER.GLASS, scale: 1.6, spec: 0.25, emit: 0, id, uv: false };
  const mFrame = { color: lot.frame ?? r.pick([0x3a2c24, 0xe8dcc4, 0x2f4a44, 0x5a3526]), layer: LAYER.WOOD, scale: 1.2, spec: 0, emit: 0, id, uv: false };
  const mIron = { color: PAL.iron, layer: LAYER.IRON, scale: 1.5, spec: 0.35, emit: 0, id, uv: false };
  const mBrass = { color: PAL.brass, layer: LAYER.METAL, scale: 1.5, spec: 0.8, emit: 0, id, uv: false };
  const mCopper = { color: PAL.copper, layer: LAYER.METAL, scale: 1.5, spec: 0.7, emit: 0, id, uv: false };
  const box = (x0, x1, y0, y1, z0, z1, m, F = null) => {
    const mm = M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    b.add(P.box(), L(F ? mul(F, mm) : mm), m);
  };

  // --- core body (inset behind the facade wall layer) -------------------------
  box(-W / 2, W / 2, 0, H, -D / 2, D / 2 - WALL_T, mWall);
  // plinth
  box(-W / 2 - 0.08, W / 2 + 0.08, 0, 0.55, -D / 2 - 0.08, D / 2 + 0.1, mBase);

  const litChance = lot.lit ?? 0.28;

  // --- facade builder -----------------------------------------------------------
  // F maps facade space (u along, v up, n outward; wall occupies n in [-WALL_T, 0]) to local.
  const facadeF = (side) => {
    if (side === 'front') return M(0, 0, D / 2);
    if (side === 'right') return M(W / 2, 0, 0, 0, Math.PI / 2, 0);
    if (side === 'left') return M(-W / 2, 0, 0, 0, -Math.PI / 2, 0);
    return M(0, 0, -D / 2, 0, Math.PI, 0);
  };

  function windowsFor(width, ww, gap) {
    const n = Math.max(1, Math.floor((width - 0.8) / (ww + gap)));
    const span = width / n;
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(-width / 2 + span * (i + 0.5));
    return xs;
  }

  // one storey of wall with recessed windows; n0 = outward offset (jetty)
  function storey(F, width, y0, h, xs, ww, wh, sill, n0, opts = {}) {
    const t = WALL_T;
    const zA = n0 - t, zB = n0;
    const sillY = y0 + sill, topY = sillY + wh;
    // spandrel under windows and lintel band above
    box(-width / 2, width / 2, y0, sillY, zA, zB, mWall, F);
    box(-width / 2, width / 2, topY, y0 + h, zA, zB, mWall, F);
    // piers
    let prev = -width / 2;
    for (const x of xs) {
      box(prev, x - ww / 2, sillY, topY, zA, zB, mWall, F);
      prev = x + ww / 2;
    }
    box(prev, width / 2, sillY, topY, zA, zB, mWall, F);
    for (const x of xs) {
      const lit = r.chance(opts.lit ?? litChance);
      const g = lit ? { ...mGlass, color: r.pick([PAL.glassWarm, PAL.glassLit]), emit: r.range(1.6, 2.6), layer: LAYER.GLASS } : mGlass;
      // glass pane deep in the recess
      box(x - ww / 2, x + ww / 2, sillY, topY, zB - 0.26, zB - 0.22, g, F);
      // frame and cross mullions, slightly in front of the glass
      const fw = 0.07;
      box(x - ww / 2, x + ww / 2, sillY, sillY + fw, zB - 0.22, zB - 0.16, mFrame, F);
      box(x - ww / 2, x + ww / 2, topY - fw, topY, zB - 0.22, zB - 0.16, mFrame, F);
      box(x - fw / 2, x + fw / 2, sillY, topY, zB - 0.22, zB - 0.17, mFrame, F);
      box(x - ww / 2, x + ww / 2, sillY + wh * 0.62, sillY + wh * 0.62 + fw, zB - 0.22, zB - 0.17, mFrame, F);
      // sill
      box(x - ww / 2 - 0.12, x + ww / 2 + 0.12, sillY - 0.1, sillY, zB - 0.05, zB + 0.16, mTrim, F);
      // lintel / pediment
      if (style === 'stone' || style === 'brick' || style === 'plaster') {
        box(x - ww / 2 - 0.16, x + ww / 2 + 0.16, topY, topY + 0.22, zB - 0.05, zB + 0.1, mTrim, F);
        if (opts.pediment) {
          const pm = { ...mTrim };
          b.add(P.cyl(3), L(mul(F, M(x, topY + 0.3, zB + 0.02, Math.PI / 2, 0, Math.PI / 2, 0.18, ww * 0.62 + 0.25, 0.46))), pm);
        }
        // side surrounds
        box(x - ww / 2 - 0.12, x - ww / 2, sillY, topY, zB - 0.02, zB + 0.06, mTrim, F);
        box(x + ww / 2, x + ww / 2 + 0.12, sillY, topY, zB - 0.02, zB + 0.06, mTrim, F);
      }
      // shutters
      if (opts.shutters && r.chance(0.55)) {
        const sc = { ...mFrame, color: lot.shutter ?? r.pick(PAL.shutter), layer: LAYER.WOOD, scale: 1.0 };
        const open = r.chance(0.7);
        if (open) {
          box(x - ww / 2 - 0.62, x - ww / 2 - 0.08, sillY + 0.04, topY - 0.04, zB + 0.01, zB + 0.06, sc, F);
          box(x + ww / 2 + 0.08, x + ww / 2 + 0.62, sillY + 0.04, topY - 0.04, zB + 0.01, zB + 0.06, sc, F);
        }
      }
      // flower box
      if (opts.flowers && r.chance(0.3)) {
        box(x - ww / 2, x + ww / 2, sillY - 0.02, sillY + 0.22, zB + 0.16, zB + 0.4, { ...mFrame, color: 0x6b4a32 }, F);
        for (let k = 0; k < 5; k++) {
          b.add(P.sphere(6, 4), L(mul(F, M(x - ww / 2 + 0.12 + k * (ww - 0.24) / 4, sillY + 0.3, zB + 0.28, 0, 0, 0, 0.14))), { color: r.pick([0x4f7a3a, 0x5d8a44, 0xc0465a, 0xe0a040]), layer: LAYER.BRUSH, scale: 0.6, spec: 0, emit: 0, id, uv: false });
        }
      }
      if (lit && X) X.lights.push(new THREE.Vector3(x, sillY + wh * 0.5, zB + 0.2).applyMatrix4(L(F)));
    }
  }

  // timber frame overlay for one storey
  function timber(F, width, y0, h, xs, ww, wh, sill, n0) {
    const z0 = n0 + 0.001, z1 = n0 + 0.09;
    const bw = 0.2;
    const tm = mTrim;
    // sole plate + top plate
    box(-width / 2 - 0.05, width / 2 + 0.05, y0, y0 + 0.24, z0, z1 + 0.03, tm, F);
    box(-width / 2 - 0.05, width / 2 + 0.05, y0 + h - 0.2, y0 + h, z0, z1 + 0.03, tm, F);
    // sill rail
    box(-width / 2, width / 2, y0 + sill - 0.14, y0 + sill, z0, z1, tm, F);
    // posts at the ends and around windows
    const posts = [-width / 2 + bw / 2, width / 2 - bw / 2];
    for (const x of xs) { posts.push(x - ww / 2 - bw / 2, x + ww / 2 + bw / 2); }
    for (const x of posts) box(x - bw / 2, x + bw / 2, y0 + 0.24, y0 + h - 0.2, z0, z1, tm, F);
    // braces in the wide piers
    const sorted = [...new Set(posts.map((p) => +p.toFixed(3)))].sort((a, c) => a - c);
    for (let i = 0; i < sorted.length - 1; i++) {
      const xa = sorted[i] + bw / 2, xb = sorted[i + 1] - bw / 2;
      const gap = xb - xa;
      if (gap < 0.7) continue;
      const inWindow = xs.some((x) => Math.abs((xa + xb) / 2 - x) < ww / 2);
      if (inWindow) {
        // short braces under the window (parapet cross)
        const ya = y0 + 0.24, yb = y0 + sill - 0.14;
        if (yb - ya > 0.5) {
          b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xa, ya, (z0 + z1) / 2), new THREE.Vector3(xb, yb, (z0 + z1) / 2), 0.14, 0.085))), tm);
          b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xb, ya, (z0 + z1) / 2 + 0.005), new THREE.Vector3(xa, yb, (z0 + z1) / 2 + 0.005), 0.14, 0.085))), tm);
        }
        continue;
      }
      const ya = y0 + 0.24, yb = y0 + h - 0.2;
      const kind = r.int(0, 2);
      if (kind === 0) {
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xa, ya, (z0 + z1) / 2), new THREE.Vector3(xb, yb, (z0 + z1) / 2), 0.16, 0.085))), tm);
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xb, ya, (z0 + z1) / 2 + 0.006), new THREE.Vector3(xa, yb, (z0 + z1) / 2 + 0.006), 0.16, 0.085))), tm);
      } else if (kind === 1) {
        const ym = (ya + yb) / 2;
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xa, ya, (z0 + z1) / 2), new THREE.Vector3(xb, ym, (z0 + z1) / 2), 0.16, 0.085))), tm);
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(xa, yb, (z0 + z1) / 2 + 0.006), new THREE.Vector3(xb, ym, (z0 + z1) / 2 + 0.006), 0.16, 0.085))), tm);
      } else {
        box(xa, xb, (ya + yb) / 2 - 0.08, (ya + yb) / 2 + 0.08, z0, z1, tm, F);
      }
    }
  }

  // --- ground floor: shop front or stone base with door --------------------------
  const front = facadeF('front');
  const isShop = lot.shop ?? r.chance(0.8);
  function groundFloor(F, width, main) {
    const t = WALL_T;
    const shopCol = lot.shopColor ?? r.pick(PAL.shop);
    const mShop = { color: shopCol, layer: LAYER.WOOD, scale: 1.4, spec: 0.05, emit: 0, id, uv: false };
    const mGold = { color: PAL.gold, layer: LAYER.METAL, scale: 1.0, spec: 0.9, emit: 0, id, uv: false };
    if (isShop && main) {
      // stone piers at the ends, painted wooden shop front between
      box(-width / 2, -width / 2 + 0.5, 0, gH, -t, 0.08, mBase, F);
      box(width / 2 - 0.5, width / 2, 0, gH, -t, 0.08, mBase, F);
      const inner = width - 1.0;
      // fascia board for the sign
      box(-inner / 2 - 0.05, inner / 2 + 0.05, gH - 1.05, gH - 0.2, -t, 0.14, mShop, F);
      box(-inner / 2 - 0.1, inner / 2 + 0.1, gH - 0.24, gH - 0.1, -t, 0.24, mShop, F); // cornice of the shop front
      if (X) X.signs.push({ matrix: L(mul(F, M(0, gH - 0.62, 0.16))), w: inner - 0.4, h: 0.62, kind: 'fascia', idx: lot.sign ?? r.int(0, 15), id });
      // stall riser under the windows
      box(-inner / 2, inner / 2, 0.0, 0.75, -t, 0.02, mShop, F);
      // door position
      const doorW = 1.3;
      const doorX = r.pick([-1, 1]) * (inner / 2 - doorW / 2 - 0.2);
      // big windows either side of the door
      const segs = [[-inner / 2, doorX - doorW / 2], [doorX + doorW / 2, inner / 2]];
      for (const [a, c] of segs) {
        const wdt = c - a;
        if (wdt < 0.4) continue;
        // pilasters
        box(a, a + 0.12, 0.75, gH - 1.05, -t, 0.05, mShop, F);
        box(c - 0.12, c, 0.75, gH - 1.05, -t, 0.05, mShop, F);
        const lit = r.chance(0.65);
        const g = lit ? { ...mGlass, color: PAL.glassWarm, emit: r.range(1.2, 2.2) } : mGlass;
        box(a + 0.12, c - 0.12, 0.75, gH - 1.05, -0.2, -0.16, g, F);
        // glazing bars
        const n = Math.max(1, Math.round((c - a) / 1.1));
        for (let k = 1; k < n; k++) {
          const x = a + (k / n) * (c - a);
          box(x - 0.035, x + 0.035, 0.75, gH - 1.05, -0.16, -0.1, mShop, F);
        }
        box(a + 0.12, c - 0.12, gH - 1.55, gH - 1.48, -0.16, -0.1, mShop, F);
        if (lit && X) X.lights.push(new THREE.Vector3((a + c) / 2, 1.8, 0.4).applyMatrix4(L(F)));
      }
      // recessed door
      box(doorX - doorW / 2, doorX + doorW / 2, 0.0, 2.7, -t - 0.02, -t + 0.04, { ...mShop, color: 0x3a2a22 }, F);
      box(doorX - doorW / 2, doorX + doorW / 2, 2.7, gH - 1.05, -0.12, 0.02, mShop, F);
      box(doorX - 0.05, doorX + 0.05, 0.1, 2.6, -t + 0.04, -t + 0.08, mGold, F);
      // step
      box(doorX - doorW / 2 - 0.1, doorX + doorW / 2 + 0.1, 0.0, 0.16, -t, 0.3, mBase, F);
    } else {
      // plain base storey with arched door and small windows
      const xs = windowsFor(width, 1.1, 1.2);
      const doorI = main ? Math.floor(xs.length / 2) : -1;
      const t2 = WALL_T;
      box(-width / 2, width / 2, 0, 0.9, -t2, 0.02, mBase, F);
      box(-width / 2, width / 2, 3.1, gH, -t2, 0.02, mBase, F);
      let prev = -width / 2;
      xs.forEach((x, i) => {
        const w2 = i === doorI ? 1.4 : 1.1;
        box(prev, x - w2 / 2, 0.9, 3.1, -t2, 0.02, mBase, F);
        prev = x + w2 / 2;
        if (i === doorI) {
          box(x - w2 / 2, x + w2 / 2, 0, 0.9, -t2, -t2 + 0.1, mBase, F); // (door fills the spandrel)
          box(x - w2 / 2 + 0.05, x + w2 / 2 - 0.05, 0.0, 2.9, -0.3, -0.26, { ...mFrame, color: 0x4a3024 }, F);
          b.add(P.cyl(16), L(mul(F, M(x, 2.95, -0.1, Math.PI / 2, 0, 0, w2 / 2 + 0.12, 0.3, w2 / 2 + 0.12))), mTrim);
        } else {
          const lit = r.chance(litChance);
          const g = lit ? { ...mGlass, color: PAL.glassWarm, emit: 1.8 } : mGlass;
          box(x - w2 / 2, x + w2 / 2, 0.9, 3.1, -0.28, -0.24, g, F);
          box(x - 0.035, x + 0.035, 0.9, 3.1, -0.24, -0.19, mFrame, F);
          box(x - w2 / 2, x + w2 / 2, 2.2, 2.27, -0.24, -0.19, mFrame, F);
        }
      });
      box(prev, width / 2, 0.9, 3.1, -t2, 0.02, mBase, F);
      // string course
      box(-width / 2 - 0.05, width / 2 + 0.05, gH - 0.18, gH, -t2, 0.12, mTrim, F);
      // rustication lines
      for (let y = 1.3; y < 3.1; y += 0.6) box(-width / 2 - 0.01, width / 2 + 0.01, y, y + 0.05, -0.06, 0.035, { ...mBase, color: 0x8a7a6a }, F);
    }
  }

  // --- assemble the facades ---------------------------------------------------------
  const sides = lot.sides || ['front'];
  for (const side of sides) {
    const F = facadeF(side);
    const width = side === 'front' || side === 'back' ? W : D;
    const main = side === 'front';
    groundFloor(F, width, main);
    const ww = lot.ww ?? r.pick([1.05, 1.15, 1.25]);
    const xs = windowsFor(width, ww, style === 'timber' ? 1.0 : 1.25);
    for (let f = 0; f < floors; f++) {
      const y0 = gH + f * fH;
      const n0 = main ? jetty * (f + 1) : 0;
      const wh = f === 0 && style !== 'timber' ? 2.05 : 1.8;
      const sill = f === 0 && style !== 'timber' ? 0.8 : 0.85;
      storey(F, width + (main ? 0 : 0), y0, fH, xs, ww, wh, sill, n0, { shutters: style !== 'stone', flowers: f < 2 && style !== 'brick', pediment: style === 'stone' && f === 0 });
      if (style === 'timber') timber(F, width, y0, fH, xs, ww, wh, sill, n0);
      if (main && jetty > 0) {
        // jetty: floor slab visible from below with carved brackets
        box(-width / 2 - 0.03, width / 2 + 0.03, y0 - 0.12, y0 + 0.02, n0 - jetty - 0.02, n0 + 0.04, mTrim, F);
        for (const x of [-width / 2 + 0.3, ...xs.map((x) => x - ww / 2 - 0.3), width / 2 - 0.3]) {
          b.add(P.box(), L(mul(F, M(x, y0 - 0.32, n0 - jetty * 0.4, -0.7, 0, 0, 0.16, 0.5, 0.16))), mTrim);
        }
      }
      // string course between storeys for masonry styles
      if (style !== 'timber') box(-width / 2 - 0.06, width / 2 + 0.06, y0 - 0.1, y0 + 0.06, -0.3, 0.1, mTrim, F);
    }
    // the side walls of the jetty (fill between facade layers) on the main facade
    if (main && jetty > 0) {
      for (let f = 0; f < floors; f++) {
        const y0 = gH + f * fH, n0 = jetty * (f + 1);
        box(-width / 2, -width / 2 + 0.05, y0, y0 + fH, -WALL_T, n0 - WALL_T + 0.001, mWall, F);
        box(width / 2 - 0.05, width / 2, y0, y0 + fH, -WALL_T, n0 - WALL_T + 0.001, mWall, F);
      }
    }
    // corner quoins
    if (style === 'brick' || style === 'plaster') {
      for (let y = gH; y < H - 0.3; y += 0.6) {
        const alt = Math.round((y - gH) / 0.6) % 2;
        box(-width / 2 - 0.05, -width / 2 + (alt ? 0.55 : 0.35), y, y + 0.5, -0.1, 0.06, mTrim, F);
        box(width / 2 - (alt ? 0.35 : 0.55), width / 2 + 0.05, y, y + 0.5, -0.1, 0.06, mTrim, F);
      }
    }
  }
  // blank facades on the non-street sides (with a few small windows)
  for (const side of ['front', 'back', 'left', 'right']) {
    if (sides.includes(side)) continue;
    const F = facadeF(side);
    const width = side === 'front' || side === 'back' ? W : D;
    box(-width / 2, width / 2, 0, H, -WALL_T, 0, mWall, F);
  }

  // --- cornice and roof -----------------------------------------------------------------
  const topJ = jetty * floors;
  const roofType = lot.roof || r.pick(['gableStreet', 'gableStreet', 'gableSide', 'mansard', 'flat']);
  const dz = topJ / 2; // body front grows by the jetties: roof must cover it
  const RD = D + topJ;
  const RT = (m) => L(mul(M(0, H, dz), m));
  const tileCol = lot.tile ?? (roofType === 'mansard' ? r.pick(PAL.slate.concat(PAL.zinc)) : r.pick(PAL.tile.concat(PAL.slate)));
  const roofLayer = PAL.slate.includes(tileCol) || PAL.zinc.includes(tileCol) ? LAYER.SLATE : LAYER.TILE;
  const mRoof = { color: tileCol, layer: roofLayer, scale: 2.4, spec: 0.05, emit: 0, id, uv: true };
  if (style !== 'timber' || roofType === 'flat' || roofType === 'mansard') {
    // cornice
    b.add(P.box(), RT(M(0, 0.12, 0, 0, 0, 0, W + 0.5, 0.24, RD + 0.5)), mTrim);
    b.add(P.box(), RT(M(0, -0.12, 0, 0, 0, 0, W + 0.3, 0.26, RD + 0.3)), { ...mTrim, color: PAL.stoneDark[0] });
  }
  let roofTop = H;
  if (roofType === 'gableStreet' || roofType === 'gableSide') {
    const along = roofType === 'gableStreet';
    const span = along ? W : RD;
    const len = along ? RD : W;
    const rh = lot.roofH ?? span * r.range(0.42, 0.6);
    const g = gableRoof(len, span, rh, 0.45, { ends: !along });
    const rot = along ? M(0, 0.05, 0, 0, Math.PI / 2, 0) : M(0, 0.05, 0);
    b.add(g, RT(rot), mRoof);
    roofTop = H + rh;
    if (X) X.roofs.push({ type: along ? 'gableZ' : 'gableX', matrix: RT(rot), len, span, h: rh });
    if (along) {
      // decorated front gable wall (triangle) with a round window
      const F = mul(front, M(0, 0, topJ));
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const y0 = H + (i / steps) * rh, y1 = H + ((i + 1) / steps) * rh;
        const hw = (W / 2) * (1 - (i + 1) / steps) + 0.001;
        const hw0 = (W / 2) * (1 - i / steps);
        box(-(hw + hw0) / 2, (hw + hw0) / 2, y0, y1, -WALL_T, 0.0, mWall, F);
      }
      // back gable (plain)
      const Fb = facadeF('back');
      for (let i = 0; i < steps; i++) {
        const y0 = H + (i / steps) * rh, y1 = H + ((i + 1) / steps) * rh;
        const hw = (W / 2) * (1 - (i + 0.5) / steps);
        box(-hw, hw, y0, y1, -WALL_T, 0.0, mWall, Fb);
      }
      const ow = { ...mTrim };
      if (style === 'timber') {
        // king post and braces in the gable
        box(-0.1, 0.1, H, H + rh * 0.92, 0.0, 0.09, mTrim, F);
        box(-W / 2 + 0.2, W / 2 - 0.2, H + rh * 0.34, H + rh * 0.34 + 0.18, 0.0, 0.09, mTrim, F);
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(-W * 0.36, H + 0.1, 0.05), new THREE.Vector3(-0.1, H + rh * 0.6, 0.05), 0.15, 0.09))), mTrim);
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(W * 0.36, H + 0.1, 0.05), new THREE.Vector3(0.1, H + rh * 0.6, 0.05), 0.15, 0.09))), mTrim);
      }
      // round attic window
      const cy = H + rh * 0.42;
      b.add(P.torus(6, 20, Math.PI * 2, 0.16), L(mul(F, M(0, cy, 0.06, 0, 0, 0, 0.55))), ow);
      b.add(P.cyl(18), L(mul(F, M(0, cy, -0.15, Math.PI / 2, 0, 0, 0.5, 0.05, 0.5))), r.chance(0.4) ? { ...mGlass, color: PAL.glassWarm, emit: 2.0 } : mGlass);
      // bargeboards (verge trim) following the slopes
      const ov = 0.45;
      for (const s of [-1, 1]) {
        b.add(P.box(), L(mul(F, Mseg(new THREE.Vector3(s * (W / 2 + ov), H - ov * (rh / (W / 2)) + 0.05, 0.14), new THREE.Vector3(0, H + rh + 0.1, 0.14), 0.3, 0.12))), { ...mTrim, color: style === 'timber' ? trimCol : 0x5a3a28, layer: LAYER.WOOD });
      }
      // finial
      b.add(P.cone(8), L(mul(F, M(0, H + rh + 0.05, 0.1, 0, 0, 0, 0.09, 0.9, 0.09))), mBrass);
      b.add(P.sphere(8, 6), L(mul(F, M(0, H + rh + 0.12, 0.1, 0, 0, 0, 0.14))), mBrass);
    } else {
      // dormers on the street side of a side gable roof
      const nd = Math.max(1, Math.floor(W / 3.6));
      for (let i = 0; i < nd; i++) {
        const x = -W / 2 + (W / nd) * (i + 0.5);
        const zf = RD / 2 - 0.9;
        const k = rh / (RD / 2);
        const yb = H + (RD / 2 - zf) * k - 0.2;
        const dm = (m) => L(mul(M(x, 0, dz), m));
        b.add(P.box(), dm(M(0, yb + 0.8, zf, 0, 0, 0, 1.5, 1.6, 1.4)), mWall);
        b.add(P.box(), dm(M(0, yb + 0.85, zf + 0.72, 0, 0, 0, 0.9, 1.1, 0.04)), r.chance(0.35) ? { ...mGlass, color: PAL.glassWarm, emit: 2 } : mGlass);
        b.add(P.box(), dm(M(0, yb + 0.85, zf + 0.75, 0, 0, 0, 1.05, 1.25, 0.03)), mFrame);
        const dg = gableRoof(1.5, 1.8, 0.7, 0.18, { ends: true });
        b.add(dg, dm(M(0, yb + 1.6, zf - 0.1, 0, Math.PI / 2, 0)), mRoof);
      }
    }
  } else if (roofType === 'mansard') {
    const h1 = 2.6, inset = 0.9;
    const geo = mansardGeometry(W + 0.3, RD + 0.3, h1, inset);
    b.add(geo, RT(M(0, 0.24, 0)), mRoof);
    // flat top with a zinc cap
    b.add(P.box(), RT(M(0, 0.24 + h1 + 0.1, 0, 0, 0, 0, W + 0.3 - inset * 2 + 0.1, 0.2, RD + 0.3 - inset * 2 + 0.1)), { ...mRoof, uv: false, color: PAL.zinc[0], layer: LAYER.METAL, scale: 3, spec: 0.2 });
    roofTop = H + h1 + 0.4;
    // dormers in the steep slope
    const nd = Math.max(1, Math.floor(W / 3.0));
    for (let i = 0; i < nd; i++) {
      const x = -W / 2 + (W / nd) * (i + 0.5);
      const zf = (RD + 0.3) / 2 - inset * 0.55;
      const dm = (m) => RT(mul(M(x, 0, 0), m));
      b.add(P.box(), dm(M(0, 1.35, zf, 0, 0, 0, 1.3, 1.9, 1.2)), mTrim);
      b.add(P.box(), dm(M(0, 1.3, zf + 0.62, 0, 0, 0, 0.8, 1.3, 0.04)), r.chance(0.35) ? { ...mGlass, color: PAL.glassWarm, emit: 2 } : mGlass);
      b.add(P.cyl(12), dm(M(0, 2.3, zf + 0.1, Math.PI / 2, 0, 0, 0.66, 1.3, 0.3)), { ...mRoof, uv: false, layer: LAYER.METAL, scale: 2, color: PAL.patina[0], spec: 0.3 });
    }
    if (X) X.roofs.push({ type: 'mansard', matrix: RT(M(0, 0, 0)), w: W, d: RD, h: h1 });
  } else if (roofType === 'flat') {
    // parapet with a balustrade look
    const pt = 0.25, ph = 1.0;
    b.add(P.box(), RT(M(0, 0.03, 0, 0, 0, 0, W - 0.02, 0.06, RD - 0.02)), { ...mTrim, color: 0x5a4c48, layer: LAYER.BRUSH, scale: 2 });
    b.add(P.box(), RT(M(0, ph / 2 + 0.24, RD / 2 + 0.2 - pt / 2, 0, 0, 0, W + 0.5, ph, pt)), mTrim);
    b.add(P.box(), RT(M(0, ph / 2 + 0.24, -RD / 2 - 0.2 + pt / 2, 0, 0, 0, W + 0.5, ph, pt)), mTrim);
    b.add(P.box(), RT(M(W / 2 + 0.2 - pt / 2, ph / 2 + 0.24, 0, 0, 0, 0, pt, ph, RD + 0.4 - 2 * pt)), mTrim);
    b.add(P.box(), RT(M(-W / 2 - 0.2 + pt / 2, ph / 2 + 0.24, 0, 0, 0, 0, pt, ph, RD + 0.4 - 2 * pt)), mTrim);
    roofTop = H + 1.3;
    // water tank on legs
    if (r.chance(0.6)) {
      const tx = r.range(-W / 4, W / 4), tz = r.range(-RD / 4, 0);
      const tr = r.range(1.0, 1.5);
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(P.cylB(6), RT(M(tx + a * tr * 0.6, 0.2, tz + c * tr * 0.6, 0, 0, 0, 0.08, 2.2, 0.08)), mIron);
      b.add(P.cylB(16), RT(M(tx, 2.3, tz, 0, 0, 0, tr, 2.4, tr)), { ...mCopper, color: r.pick([PAL.copper, PAL.patina[1], 0x6a5040]) });
      b.add(P.cone(16), RT(M(tx, 4.7, tz, 0, 0, 0, tr * 1.08, 0.8, tr * 1.08)), { ...mCopper, color: PAL.patina[0] });
      roofTop = Math.max(roofTop, H + 5.5);
    }
    if (X) X.roofs.push({ type: 'flat', matrix: RT(M(0, 0, 0)), w: W, d: RD });
  } else if (roofType === 'dome') {
    const rr = Math.min(W, RD) * 0.42;
    b.add(P.cylB(24), RT(M(0, 0.2, 0, 0, 0, 0, rr * 1.02, 2.2, rr * 1.02)), mWall);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.add(P.box(), RT(M(Math.cos(a) * rr * 1.04, 1.3, Math.sin(a) * rr * 1.04, 0, -a, 0, 0.2, 2.2, 0.35)), mTrim);
    }
    const domeCol = lot.domeColor ?? r.pick([PAL.patina[0], PAL.brass, PAL.patina[2]]);
    b.add(P.hemi(24, 10), RT(M(0, 2.4, 0, 0, 0, 0, rr, rr * 0.95, rr)), { color: domeCol, layer: domeCol === PAL.brass ? LAYER.METAL : LAYER.PATINA, scale: 3, spec: domeCol === PAL.brass ? 0.9 : 0.3, emit: 0, id, uv: false });
    // ribs
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(P.torus(4, 12, Math.PI / 2, 0.035), RT(mul(M(0, 2.4, 0, 0, a, 0), M(0, 0, 0, 0, 0, Math.PI / 2, rr * 1.01, rr * 0.96, rr * 1.01))), mBrass);
    }
    b.add(P.cylB(10), RT(M(0, 2.4 + rr * 0.9, 0, 0, 0, 0, 0.35, 1.2, 0.35)), mBrass);
    b.add(P.sphere(10, 8), RT(M(0, 2.4 + rr * 0.95 + 1.3, 0, 0, 0, 0, 0.3)), mBrass);
    roofTop = H + 2.4 + rr + 1.8;
    // flat roof around
    b.add(P.box(), RT(M(0, 0.1, 0, 0, 0, 0, W + 0.3, 0.2, RD + 0.3)), mTrim);
  }

  // --- chimneys ----------------------------------------------------------------------
  const nc = lot.chimneys ?? r.int(1, 3);
  for (let i = 0; i < nc; i++) {
    const cx = r.range(-W / 2 + 0.8, W / 2 - 0.8), cz = r.range(-RD / 2 + 1.0, RD / 2 - 1.5) + dz;
    const ch = roofTop - H + r.range(0.6, 1.6);
    const mCh = { color: r.pick(PAL.brick), layer: LAYER.BRICK, scale: 2.2, spec: 0, emit: 0, id, uv: false };
    b.add(P.boxB(), L(M(cx, H - 0.5, cz, 0, 0, 0, 0.7, ch + 0.5, 0.55)), mCh);
    b.add(P.boxB(), L(M(cx, H + ch - 0.05, cz, 0, 0, 0, 0.86, 0.18, 0.72)), mTrim);
    for (let k = 0; k < 2; k++) b.add(P.cylB(8), L(M(cx - 0.15 + k * 0.3, H + ch + 0.1, cz, 0, 0, 0, 0.1, 0.35, 0.1)), { ...mCh, color: 0x9a5a40 });
    if (X) X.chimneys.push({ pos: new THREE.Vector3(cx, H + ch + 0.5, cz).applyMatrix4(T), seed: r.int(0, 9999), strength: r.range(0.5, 1) });
  }

  // --- steampunk details on the main facade ---------------------------------------------
  const Ff = mul(front, M(0, 0, 0));
  if (lot.pipes ?? r.chance(0.75)) {
    const np = r.int(1, 2);
    for (let i = 0; i < np; i++) {
      const px = (i === 0 ? -1 : 1) * (W / 2 - r.range(0.25, 0.5));
      const pr = r.range(0.09, 0.16);
      const zOff = 0.25 + jetty * floors + 0.05;
      const pts = [
        new THREE.Vector3(px, 0.3, 0.3),
        new THREE.Vector3(px, gH - 0.4, 0.3),
        new THREE.Vector3(px, gH - 0.1, zOff),
        new THREE.Vector3(px, H + 0.6, zOff),
      ];
      const world = pts.map((p) => p.applyMatrix4(L(Ff)));
      b.set({ ...mCopper });
      pipeRun(b, world, pr, { collarColor: PAL.brassDark });
      // a valve wheel and a gauge on the pipe
      const vy = r.range(1.2, 2.0);
      const vp = new THREE.Vector3(px, vy, 0.3 + pr + 0.08).applyMatrix4(L(Ff));
      b.add(P.torus(5, 14, Math.PI * 2, 0.12), mul(L(Ff), M(px, vy, 0.3 + pr + 0.1, 0, 0, 0, 0.22)), { ...mIron, color: 0x8a2a22 });
      b.add(P.cyl(6), mul(L(Ff), M(px, vy, 0.3 + pr + 0.02, Math.PI / 2, 0, 0, 0.04, 0.2, 0.04)), mIron);
      const gy = gH + r.range(0.4, fH);
      b.add(P.cyl(16), mul(L(Ff), M(px + (px < 0 ? 0.36 : -0.36), gy, zOff, Math.PI / 2, 0, 0, 0.2, 0.1, 0.2)), mBrass);
      b.add(P.cyl(16), mul(L(Ff), M(px + (px < 0 ? 0.36 : -0.36), gy, zOff + 0.05, Math.PI / 2, 0, 0, 0.16, 0.02, 0.16)), { color: 0xf2e6c8, layer: LAYER.BRUSH, scale: 1, spec: 0, emit: 0, id, uv: false });
      if (X) X.vents.push({ pos: vp, dir: new THREE.Vector3(px < 0 ? -1 : 1, 0.3, 0.6).transformDirection(L(Ff)), seed: r.int(0, 9999) });
    }
  }
  if (lot.gear ?? r.chance(0.35)) {
    // big wall gear pair on a blank area of the facade (top floor, beside windows) or gable
    const gr = lot.gearR ?? r.range(0.9, 1.6);
    const gx = lot.gearX ?? (r.sign() * (W / 2 - gr - 0.2));
    const gy = lot.gearY ?? (H - gr - 0.6);
    const zz = jetty * floors + 0.18;
    const pos = new THREE.Vector3(gx, gy, zz).applyMatrix4(L(Ff));
    const nrm = new THREE.Vector3(0, 0, 1).transformDirection(L(Ff));
    if (X) {
      X.gears.push({ pos, nrm, r: gr, teeth: Math.round(gr * 10), speed: r.range(0.15, 0.35) * r.sign(), color: r.pick([PAL.brass, PAL.copper, PAL.brassDark]) });
      const gr2 = gr * r.range(0.45, 0.6);
      const ang = r.range(-0.8, 0.8) + (gx > 0 ? Math.PI : 0);
      const off = (gr + gr2) * 0.93;
      const pos2 = new THREE.Vector3(gx + Math.cos(ang) * off, gy + Math.sin(ang) * off, zz + 0.05).applyMatrix4(L(Ff));
      X.gears.push({ pos: pos2, nrm, r: gr2, teeth: Math.round(gr2 * 10), speed: -X.gears[X.gears.length - 1].speed * gr / gr2, color: r.pick([PAL.brass, PAL.copper]) });
    }
    // back plate
    b.add(P.cyl(20), mul(L(Ff), M(gx, gy, zz - 0.12, Math.PI / 2, 0, 0, gr * 0.5, 0.1, gr * 0.5)), mIron);
  }
  if (lot.balcony ?? r.chance(0.35)) {
    const f = r.int(0, Math.max(0, floors - 2));
    const y = gH + f * fH + 0.05;
    const bw = Math.min(W - 1.0, r.range(2.4, 4.2));
    const bx = r.range(-W / 2 + bw / 2 + 0.3, W / 2 - bw / 2 - 0.3);
    const n0 = jetty * (f + 1);
    box(bx - bw / 2, bx + bw / 2, y - 0.1, y + 0.1, n0, n0 + 1.1, mTrim, Ff);
    // railing
    const rail = { ...mIron };
    box(bx - bw / 2, bx + bw / 2, y + 1.0, y + 1.06, n0 + 1.02, n0 + 1.1, rail, Ff);
    for (let x = bx - bw / 2 + 0.05; x <= bx + bw / 2; x += 0.16) box(x - 0.015, x + 0.015, y + 0.1, y + 1.0, n0 + 1.04, n0 + 1.07, rail, Ff);
    box(bx - bw / 2, bx - bw / 2 + 0.04, y + 0.1, y + 1.06, n0 + 0.05, n0 + 1.1, rail, Ff);
    box(bx + bw / 2 - 0.04, bx + bw / 2, y + 0.1, y + 1.06, n0 + 0.05, n0 + 1.1, rail, Ff);
    // brackets
    for (const x of [bx - bw / 2 + 0.2, bx + bw / 2 - 0.2]) b.add(P.box(), mul(L(Ff), M(x, y - 0.35, n0 + 0.4, -0.8, 0, 0, 0.1, 0.8, 0.1)), rail);
  }
  if (lot.hangingSign ?? r.chance(0.5)) {
    const sx = r.sign() * (W / 2 - 0.4);
    const sy = gH + 0.4;
    const arm = { ...mIron };
    box(sx - 0.03, sx + 0.03, sy + 0.8, sy + 0.86, 0.0, 1.2, arm, Ff);
    b.add(P.box(), mul(L(Ff), M(sx, sy + 0.55, 0.55, 0.7, 0, 0, 0.03, 0.03, 0.8)), arm);
    if (X) X.hanging.push({ matrix: L(mul(Ff, M(sx, sy + 0.35, 0.72, 0, Math.PI / 2, 0))), w: 0.9, h: 0.7, idx: r.int(0, 15), id });
  }
  if (lot.wallLamp ?? r.chance(0.6)) {
    const lx = r.sign() * (W / 2 - r.range(0.9, 1.4));
    const ly = gH - 0.2;
    const lp = new THREE.Vector3(lx, ly, 0.55 + 0.1).applyMatrix4(L(Ff));
    if (X) X.lamps.push({ pos: lp, kind: 'wall', matrix: L(mul(Ff, M(lx, ly, 0.0))) });
  }
  return { H, roofTop, style, id };
}

// Mansard: lower steep frustum from (w x d) at y=0 to inset rectangle at y=h.
export function mansardGeometry(w, d, h, inset) {
  const x0 = w / 2, z0 = d / 2, x1 = w / 2 - inset, z1 = d / 2 - inset;
  const pos = [], uv = [];
  const slope = Math.hypot(inset, h);
  const face = (a, b, c, e, lenA, lenB) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(0, slope, lenA, slope, lenA - (lenA - lenB) / 2, 0, 0, slope, lenA - (lenA - lenB) / 2, 0, (lenA - lenB) / 2, 0);
  };
  face([-x0, 0, z0], [x0, 0, z0], [x1, h, z1], [-x1, h, z1], w, w - 2 * inset);
  face([x0, 0, -z0], [-x0, 0, -z0], [-x1, h, -z1], [x1, h, -z1], w, w - 2 * inset);
  face([x0, 0, z0], [x0, 0, -z0], [x1, h, -z1], [x1, h, z1], d, d - 2 * inset);
  face([-x0, 0, -z0], [-x0, 0, z0], [-x1, h, z1], [-x1, h, -z1], d, d - 2 * inset);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
