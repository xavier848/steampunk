// Headless renderer for stills, frame sequences and the video export.
//   node tools/render.mjs --scene film --times 12,40.5 --out stills --w 1920 --h 1080
//   node tools/render.mjs --range 0,10 --fps 30 --out /tmp/frames   (JPEG sequence)
//   node tools/render.mjs --range 0,540 --fps 30 --pipe out.mp4      (encode through ffmpeg)
// Uses Chromium with SwiftShader (software WebGL2). Rendering is synchronous and each
// frame is read straight from the canvas, so hidden tab throttling never matters.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const W = +(args.w || 1280), H = +(args.h || 720);
const scene = args.scene || 'film';
const out = args.out || path.join(ROOT, 'stills');
const THREE_DIR = process.env.THREE_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  const srv = await serve();
  const port = srv.address().port;
  // --gl llvmpipe: Mesa llvmpipe through ANGLE/OpenGL (run under xvfb-run); much faster
  // than SwiftShader on many cores. Default: headless SwiftShader.
  const common = ['--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--js-flags=--max-old-space-size=4096'];
  const llvm = args.gl === 'llvmpipe';
  const browser = await chromium.launch({
    headless: !llvm,
    args: llvm ? ['--use-angle=gl', '--enable-gpu', ...common] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...common],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  if (THREE_DIR) {
    await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
      const m = route.request().url().match(/three@[^/]+\/(.*)$/);
      const f = path.join(THREE_DIR, m[1]);
      if (fs.existsSync(f)) route.fulfill({ path: f, contentType: 'text/javascript' });
      else route.continue();
    });
  }
  const logs = [];
  page.on('console', (m) => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (args.verbose || m.type() === 'error' || m.type() === 'warning') console.log(t.slice(0, 2000)); });
  let fatal = null;
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message); if (!fatal) fatal = e.message; });
  const extra = args.query ? '&' + args.query : '';
  const url = `http://127.0.0.1:${port}/index.html?headless=1&scene=${scene}&w=${W}&h=${H}${extra}`;
  const t0 = Date.now();
  await page.goto(url);
  const tWait = Date.now();
  while (true) {
    const st = await page.evaluate(() => (window.dampf ? (window.dampf.ready ? 'ready' : window.dampf.error ? 'error' : 'wait') : 'wait'));
    if (st !== 'wait') break;
    if (fatal && Date.now() - tWait > 3000) { console.log('FATAL', fatal); await browser.close(); srv.close(); process.exit(1); }
    if (Date.now() - tWait > 900000) { console.log('TIMEOUT'); await browser.close(); srv.close(); process.exit(1); }
    await new Promise((r) => setTimeout(r, 300));
  }
  const err = await page.evaluate(() => window.dampf.error);
  if (err) { console.log('ERROR', err); await browser.close(); srv.close(); process.exit(1); }
  console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(await page.evaluate(() => window.dampf.stats())));
  fs.mkdirSync(out, { recursive: true });
  if (args.pre) console.log('pre:', JSON.stringify(await page.evaluate(String(args.pre))));

  if (args.times) {
    const times = String(args.times).split(',').map(Number);
    const names = args.names ? String(args.names).split(',') : null;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const s = Date.now();
      const data = await page.evaluate((tt) => window.dampf.snap(tt, 'image/png'), t);
      const name = names ? names[i] : `${args.prefix || 'still'}_${String(t.toFixed(2)).replace('.', '_')}`;
      fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`t=${t} ${name}.png ${((Date.now() - s) / 1000).toFixed(2)}s`);
    }
  }
  if (args.shots) {
    // one frame per shot at a fraction of its length (default: middle); --shots all | 2.1,3.4 | 3 (chapter)
    const frac = +(args.frac || 0.5);
    const list = await page.evaluate(() => window.dampf.world.shots.map((s) => ({ name: s.name, t0: s.t0, t1: s.t1, chapter: s.chapter })));
    const sel = String(args.shots);
    const pick = list.filter((s) => sel === 'all' || sel.split(',').some((k) => s.name.startsWith(k + ' ') || s.name.startsWith(k + '.') || String(s.chapter) === k));
    for (const s of pick) {
      const t = s.t0 + (s.t1 - s.t0) * frac;
      const s0 = Date.now();
      const data = await page.evaluate((tt) => window.dampf.snap(tt, 'image/png'), t);
      const nm = s.name.replace(/[^A-Za-z0-9ÄÖÜäöüß. ]/g, '').replace(/ /g, '_');
      fs.writeFileSync(path.join(out, nm + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`shot ${s.name} t=${t.toFixed(2)} ${((Date.now() - s0) / 1000).toFixed(2)}s`);
    }
  }
  if (args.views) {
    // JSON file: [{name, pos:[x,y,z], look:[x,y,z], fov, t}]
    const views = JSON.parse(fs.readFileSync(args.views, 'utf8'));
    for (const v of views) {
      const s0 = Date.now();
      const data = await page.evaluate((vv) => { if (vv.pos) window.dampfDebugCam(vv.pos, vv.look, vv.fov || 45); return window.dampf.snap(vv.t ?? 0, 'image/png'); }, v);
      fs.writeFileSync(path.join(out, v.name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`view ${v.name} ${((Date.now() - s0) / 1000).toFixed(2)}s`);
    }
  }
  if (args.range) {
    const [a, bnd] = String(args.range).split(',').map(Number);
    const fps = +(args.fps || 30);
    const first = Math.round(a * fps), last = Math.round(bnd * fps);
    let ff = null;
    if (args.pipe) {
      const FF = process.env.FFMPEG || 'ffmpeg';
      const crf = args.crf || '14';
      ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', args.pipe], { stdio: ['pipe', 'inherit', 'inherit'] });
    }
    const s0 = Date.now();
    for (let f = first; f < last; f++) {
      const t = f / fps;
      const data = await page.evaluate((tt) => window.dampf.snap(tt, 'image/jpeg', 0.94), t);
      const buf = Buffer.from(data.split(',')[1], 'base64');
      if (ff) { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
      else fs.writeFileSync(path.join(out, `f_${String(f).padStart(6, '0')}.jpg`), buf);
      if ((f - first) % 30 === 0) {
        const el = (Date.now() - s0) / 1000, done = f - first + 1;
        console.log(`frame ${f} (${done}/${last - first}) ${(el / done).toFixed(2)}s/frame eta ${((last - first - done) * el / done / 60).toFixed(1)}min`);
      }
    }
    if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  }
  if (args.audio) {
    // offline procedural soundtrack as WAV
    const [a, bnd] = String(args.audio).split(',').map(Number);
    const s0 = Date.now();
    const n = await page.evaluate(async ([x, y]) => await window.dampf.renderAudio(x, y), [a, bnd]);
    const parts = [];
    for (let o = 0; o < n; o += 4 << 20) parts.push(Buffer.from(await page.evaluate(([oo, ss]) => window.dampf.audioChunk(oo, ss), [o, 4 << 20]), 'base64'));
    fs.writeFileSync(args.wav || path.join(out, 'audio.wav'), Buffer.concat(parts));
    console.log(`audio written (${(n / 1e6).toFixed(1)} MB, ${((Date.now() - s0) / 1000).toFixed(1)}s)`);
  }
  if (args.eval) console.log(JSON.stringify(await page.evaluate(String(args.eval))));
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
