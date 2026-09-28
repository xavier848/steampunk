// Chapter 1: the flight over Dampfstadt at sunset (camera only).
import { V, cam, splineCached, ease } from './camera.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { CITY } from '../city/layout.js';

export function buildFlyover(airships) {
  const shots = [];
  const tower = V(CITY.tower.x, 55, CITY.tower.z);
  const u01 = (t, sh) => clamp((t - sh.t0) / (sh.t1 - sh.t0));
  shots.push({ name: '1.1 Aus den Wolken', t1: 15.5, fn: (t, S, sh) => {
    const u = ease(u01(t, sh));
    const pos = splineCached('f1', [V(-420, 520, 900), V(-300, 430, 700), V(-190, 330, 520), V(-110, 250, 380)], u);
    const look = splineCached('f1l', [V(-60, 300, 300), V(-20, 150, 100), V(0, 60, -60), V(0, 40, -150)], u);
    return cam(pos, look, 50, { near: 2 });
  } });
  shots.push({ name: '1.2 Das Luftschiff', t1: 32, fn: (t, S, sh) => {
    const u = u01(t, sh);
    const a = airships.big;
    const p = a.posAt(S);
    const d = a.dirAt(S);
    const side = V(d.z, 0, -d.x);
    const pos = p.clone().addScaledVector(side, lerp(-52, -38, u)).addScaledVector(d, lerp(-40, 22, ease(u))).add(V(0, lerp(10, -4, u), 0));
    const look = p.clone().addScaledVector(d, lerp(-5, 40, ease(u))).add(V(0, lerp(-6, -30, u), 0));
    return cam(pos, look, 46, { near: 1 });
  } });
  shots.push({ name: '1.3 DAMPFSTADT', t1: 47.5, title: true, fn: (t, S, sh) => {
    const u = ease(u01(t, sh));
    const pos = splineCached('f3', [V(120, 170, 260), V(170, 150, 150), V(210, 130, 40), V(215, 115, -60)], u);
    const look = splineCached('f3l', [V(260, 40, 60), V(300, 40, -20), V(280, 40, -120), V(180, 50, -300)], u);
    return cam(pos, look, 50, { near: 1.5 });
  } });
  shots.push({ name: '1.4 Über die Dächer zum Uhrturm', t1: 62.5, fn: (t, S, sh) => {
    const u = ease(u01(t, sh));
    const pos = splineCached('f4', [V(160, 70, -40), V(95, 50, -110), V(45, 42, -150), V(18, 44, -180)], u);
    const look = splineCached('f4l', [V(40, 40, -200), V(10, 50, -230), V(0, 56, -232), V(-40, 30, -200)], u);
    return cam(pos, look, 46, { near: 0.8 });
  } });
  shots.push({ name: '1.5 Über der Marktgasse', t1: 77.5, fn: (t, S, sh) => {
    const u = ease(u01(t, sh));
    const pos = splineCached('f5', [V(-10, 55, -150), V(-4, 48, -60), V(4, 52, 40), V(20, 70, 140)], u);
    const look = splineCached('f5l', [V(0, 10, -40), V(0, 6, 40), V(0, 4, 110), V(0, 20, 220)], u);
    return cam(pos, look, 50, { near: 0.8 });
  } });
  return shots;
}
