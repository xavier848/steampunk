// Shot list: every shot is a function of film time T (and story time S) returning the
// camera. Shot boundaries are hung onto story anchors, so retiming the story moves the cuts.
import * as THREE from 'three';
import { V, cam, spline, splineCached, smoothPos, heading, yawDir, follow, handheld, orbit, dollyDist, ease, mixCam } from './camera.js';
import { clamp, smoothstep, lerp } from '../core/math.js';
import { CITY } from '../city/layout.js';
import { ROOF } from '../city/rooftops.js';
import { CURB_H } from '../city/street.js';
import { HALL } from '../city/underworld.js';

export function buildShots(story, TIME, flyover, extras = {}) {
  const { A, boy, cop } = story;
  const T = (s) => TIME.T(s);
  const shots = [];
  let tPrev = 0;
  // add a shot that ends at film time t1
  const shot = (name, chapter, t1, fn, opt = {}) => { shots.push({ name, chapter, t0: tPrev, t1, fn, ...opt }); tPrev = t1; };
  const head = (tr, S, h = 1.3) => { const p = tr.posAt(S); p.y += h; return p; };
  const boyHead = (S) => head(boy, S, 1.32);
  const copHead = (S) => head(cop, S, 1.72);
  const tower = V(CITY.tower.x, 58, CITY.tower.z);

  // ================================================================ 1 flyover (see flyover.js)
  for (const f of flyover) shot(f.name, 1, f.t1, f.fn, { title: !!f.title, ...(f.opt || {}) });

  // ================================================================ 2 Die Marktgasse
  const stallBoy = V(-4.55, 0, 122.6);
  shot('2.1 Sturzflug in die Marktgasse', 2, A.walk1 - 5.5, (t, S, sh) => {
    const u = ease((t - sh.t0) / (sh.t1 - sh.t0));
    const pos = splineCached('dive', [V(70, 92, 250), V(34, 58, 205), V(12, 26, 166), V(3.5, 8.5, 140), V(0.8, 2.6, 128.2), V(-1.2, 1.75, 125.6)], u);
    const look = splineCached('diveL', [V(0, 45, -232), V(0, 30, -120), V(-1, 12, 60), V(-3, 3, 112), V(-4.4, 1.5, 122.4), V(-4.9, 1.25, 122.3)], u);
    return cam(pos, look, lerp(52, 40, u), { near: pos.y > 20 ? 0.6 : 0.15 });
  });
  shot('2.2 Am Messingstand', 2, A.walk1 + 0.4, (t, S) => cam(V(-3.1, 1.55, 125.0), V(-5.6, 1.2, 122.2), 38));
  shot('2.3 Emil geht los', 2, A.stop1 + 0.3, (t, S) => {
    const f = follow(boy, S, { back: 2.9, side: 0.75, up: 1.62, lookUp: 1.5, lookAhead: 9, win: 0.8 });
    return cam(f.pos, f.look.lerp(tower, 0.08), 44);
  });
  shot('2.4 Der Kern pulsiert', 2, A.walk2 + 0.5, (t, S, sh) => {
    const b = boy.posAt(S);
    const u = (t - sh.t0) / (sh.t1 - sh.t0);
    return cam(V(b.x - 0.45, 1.28, b.z - 1.85), V(b.x + 0.1, 1.08 + 0.12 * smoothstep(0.6, 0.85, u), b.z), 40);
  });
  shot('2.5 Der Schutzmann am Kiosk', 2, A.halt - 3.2, (t, S) => cam(V(-1.3, 1.55, 118.2), V(4.2, 1.55, 112.2), 38));
  shot('2.6 Der Glanz in der Tasche', 2, A.halt - 0.4, (t, S) => {
    const c = copHead(S);
    return cam(V(c.x + 1.0, 2.15, c.z + 1.3), boyHead(S).add(V(0, -0.35, 0)), 34);
  });
  shot('2.7 Halt!', 2, A.whistle - 0.1, (t, S) => {
    const b = boyHead(S);
    return cam(V(b.x - 0.6, 1.3, b.z - 1.6), b.clone().add(V(0.1, -0.02, 0)), 34);
  });
  shot('2.8 Die Pfeife', 2, A.run0 + 0.8, (t, S, sh) => {
    const c = copHead(S);
    const u = (t - sh.t0) / (sh.t1 - sh.t0);
    return cam(V(c.x - 1.6, 1.55, c.z - 1.3 - u * 0.3), c.clone().add(V(0, -0.05, 0)), 38);
  });

  // ================================================================ 3 Die Verfolgung
  shot('3.1 Verfolgung frontal', 3, A.hat - 1.7, (t, S) => {
    const f = follow(boy, S, { back: -5.2, side: 0.4, up: 1.45, lookUp: 1.05, lookAhead: 2.5, win: 0.7 });
    const c = cam(f.pos, boyHead(S).add(V(0, -0.25, 0)), 46);
    return handheld(c, t, 1.4);
  }, { handheld: true });
  shot('3.2 Der Hut fällt', 3, A.hat + 1.7, (t, S) => {
    const c = cam(V(1.8, 0.55, 57.2), V(-0.4, 1.1, 61.8), 40);
    return handheld(c, t, 0.8);
  }, { handheld: true });
  shot('3.3 Auf den Karren zu', 3, T(A.cartJump - 0.55), (t, S) => {
    const f = follow(boy, S, { back: 3.4, side: -1.6, up: 1.1, lookUp: 1.0, lookAhead: 5, win: 0.6 });
    return handheld(cam(f.pos, f.look, 48), t, 1.2);
  }, { handheld: true });
  shot('3.4 Sprung über den Karren', 3, T(A.cartLand + 0.45), (t, S, sh) => {
    const u = (t - sh.t0) / (sh.t1 - sh.t0);
    const pos = V(-3.7 + u * 0.4, 0.4, 45.2 - u * 2.2);
    return cam(pos, boy.posAt(S).add(V(0, 0.85, 0)), 46);
  });
  shot('3.5 Durch die Stände', 3, T(A.slide - 0.9), (t, S) => {
    const b = smoothPos(boy, S, 0.4);
    const c = cam(V(4.75, 1.05, b.z + 0.4), b.clone().add(V(0, 0.95, -1.2)), 50);
    return handheld(c, t, 1.0);
  }, { handheld: true });
  shot('3.6 Unter der Markise', 3, T(A.slide + 1.6), (t, S) => cam(V(5.75, 0.34, 11.6), boy.posAt(S).add(V(0, 0.45, 0)).lerp(V(4.4, 0.8, 14.6), 0.3), 56));
  shot('3.7 Über die Straße', 3, T(A.hide - 0.4), (t, S) => {
    const f = follow(boy, S, { back: 4.2, side: 1.4, up: 1.9, lookUp: 0.9, lookAhead: 4, win: 0.7 });
    return handheld(cam(f.pos, f.look, 48), t, 1.3);
  }, { handheld: true });
  shot('3.8 Brummer drängt durch', 3, T(A.hide + 3.2), (t, S) => {
    const f = follow(cop, S, { back: -6.5, side: 0.8, up: 1.7, lookUp: 1.55, lookAhead: 2, win: 0.8 });
    return handheld(cam(f.pos, copHead(S).add(V(0, -0.3, 0)), 44), t, 1.2);
  }, { handheld: true });
  shot('3.9 Versteck', 3, T(A.hide + 8.0), (t, S) => {
    const b = boy.posAt(S);
    return cam(V(b.x - 0.05, 0.75, b.z + 1.55), V(b.x + 0.25, 0.72, b.z - 0.1), 40);
  });
  shot('3.10 Brummer sucht', 3, T(A.hide + 11.8), (t, S) => {
    const c = cop.posAt(S);
    return cam(V(-6.2, 0.95, -9.4), c.clone().add(V(0, 1.45, 0)), 38);
  });
  shot('3.11 Emil späht', 3, T(A.glow - 0.1), (t, S) => {
    const b = boy.posAt(S);
    return cam(V(b.x + 1.1, 0.85, b.z - 0.9), V(b.x + 0.05, 0.85, b.z - 0.05), 36);
  });
  shot('3.12 Der Kern verrät ihn', 3, T(A.glow + 1.1), (t, S, sh) => {
    const b = boy.posAt(S);
    const u = (t - sh.t0) / (sh.t1 - sh.t0);
    return cam(V(b.x + 0.62 - u * 0.12, 0.62, b.z + 0.55), V(b.x + 0.12, 0.55, b.z + 0.1), 34);
  });
  shot('3.13 Da ist er!', 3, T(A.bolt + 0.35), (t, S) => cam(V(-3.9, 1.35, -13.0), copHead(S).add(V(0, -0.15, 0)), 38));
  shot('3.14 Emil flitzt los', 3, T(A.crossRails - 1.4), (t, S) => {
    const f = follow(boy, S, { back: 5.5, side: -2.2, up: 2.0, lookUp: 1.0, lookAhead: 5, win: 0.5 });
    return handheld(cam(f.pos, f.look, 50), t, 1.5);
  }, { handheld: true });
  shot('3.15 Die Straßenbahn', 3, T(A.crossRails + 1.9), (t, S) => handheld(cam(V(0.6, 0.95, -41.2), V(3.4, 1.25, -25.5), 54), t, 0.6), { handheld: true });
  shot('3.16 Emil grinst', 3, T(A.crossRails + 3.3), (t, S) => {
    const b = boyHead(S);
    return cam(V(b.x + 0.2, b.y - 0.02, b.z - 1.45), b.clone().add(V(-0.1, -0.02, 0)), 36);
  });
  shot('3.17 Brummer hinter der Bahn', 3, T(A.crossRails + 5.2), (t, S) => cam(V(3.9, 1.35, -35.2), copHead(S).lerp(V(1.5, 1.7, -24), 0.2), 40));

  // ================================================================ 4 Die Leiter
  shot('4.1 Auf die Kisten', 4, T(A.ladder0 + 0.8), (t, S) => cam(V(3.3, 1.35, -38.2), boy.posAt(S).add(V(0, 1.0, 0)), 44));
  // crane shot up the facade (interrupted once by Brummer arriving below)
  const crane = (t, S, u) => {
    const b = boy.posAt(S);
    const pos = V(lerp(4.4, 3.0, u), b.y + lerp(0.1, 1.3, u), lerp(-38.4, -39.9, u));
    return cam(pos, b.clone().add(V(0.35, 1.0, 0)), lerp(48, 42, u));
  };
  const craneU = (t) => ease(clamp((t - T(A.ladder0 + 0.8)) / (T(A.ladderTop - 1.8) - T(A.ladder0 + 0.8))));
  shot('4.2 Kranfahrt an der Fassade', 4, T(A.ladder0 + 7.6), (t, S) => crane(t, S, craneU(t)));
  shot('4.3 Brummer an der Leiter', 4, T(A.ladder0 + 12.6), (t, S) => {
    const c = copHead(S);
    return cam(V(c.x - 2.3, 1.05, c.z - 2.0), c.clone().add(V(0.4, 0.45, 0.1)), 44);
  });
  shot('4.4 Ins goldene Licht', 4, T(A.ladderTop + 0.2), (t, S) => crane(t, S, craneU(t)));
  shot('4.5 Über die Brüstung', 4, T(A.onRoof + 0.6), (t, S) => cam(V(12.4, ROOF.h1 + 1.35, -45.6), boy.posAt(S).add(V(0, 0.8, 0)), 44));
  shot('4.6 Blick hinab', 4, T(A.onRoof + 3.4), (t, S) => cam(V(7.75, ROOF.h1 + 1.45, -43.3), V(5.9, 1.1, -41.2), 46));
  shot('4.7 Emil oben', 4, T(A.roofRun + 0.4), (t, S) => {
    const b = boyHead(S);
    return cam(V(b.x - 1.6, b.y - 0.35, b.z + 1.4), b.clone(), 36);
  });

  // ================================================================ 5 Über die Dächer
  shot('5.1 Über das erste Dach', 5, T(A.ridge - 0.3), (t, S) => {
    const b = smoothPos(boy, S, 0.4);
    return cam(V(b.x - 6.5, b.y + 1.2, b.z + 2.0), b.clone().add(V(0, 0.9, -1.0)), 46);
  });
  shot('5.2 Auf dem First', 5, T(A.walkway + 0.2), (t, S) => {
    const b = smoothPos(boy, S, 0.4);
    return cam(V(b.x + 4.8, b.y + 0.25, b.z - 3.2), b.clone().add(V(0, 0.95, 0)), 44);
  });
  shot('5.3 Über den Steg', 5, T(A.laundry + 0.5), (t, S) => {
    const f = follow(boy, S, { back: -4.2, side: 1.0, up: 1.2, lookUp: 1.0, lookAhead: 1, win: 0.5 });
    return cam(f.pos, f.look, 48);
  });
  shot('5.4 Die Katze', 5, T(A.catPass + 1.8), (t, S) => cam(V(20.9, 16.35, -64.9), V(15.2, 15.3, -68.2), 42));
  shot('5.5 Unter der Wäsche', 5, T(A.glassRoof + 0.3), (t, S) => {
    const f = follow(boy, S, { back: 3.4, side: -0.7, up: 1.35, lookUp: 1.1, lookAhead: 4, win: 0.5 });
    return cam(f.pos, f.look, 50);
  });
  shot('5.6 Das Glasdach', 5, T(A.fireLadder + 0.2), (t, S) => {
    const b = smoothPos(boy, S, 0.3);
    return cam(V(13.5, 17.2, b.z + 4.5), b.clone().add(V(0, 0.8, -1.5)), 46);
  });
  shot('5.7 Die Brandmauer', 5, T(A.clockLook + 0.5), (t, S) => cam(V(11.0, ROOF.h5 + 1.9, -88.6), boy.posAt(S).add(V(0.1, 0.8, 0)), 46));
  shot('5.8 Sieben Minuten vor Sieben', 5, T(A.runUp + 0.2), (t, S, sh) => {
    const b = boy.posAt(S);
    const u = ease((t - sh.t0) / (sh.t1 - sh.t0));
    const pos = V(b.x + 1.2 - u * 0.5, b.y + 1.2 + u * 0.5, b.z + 2.6 + u * 0.8);
    return cam(pos, V(lerp(b.x, CITY.tower.x, 0.4), lerp(b.y + 1.3, 50, 0.3), lerp(b.z, CITY.tower.z, 0.35)), 48);
  });
  shot('5.9 Anlauf', 5, T(A.alleyJump - 0.05), (t, S) => {
    const f = follow(boy, S, { back: 4.0, side: -1.0, up: 1.2, lookUp: 1.0, lookAhead: 5, win: 0.4 });
    return cam(f.pos, f.look, 50);
  });
  shot('5.10 Sprung über die Gasse', 5, T(A.alleyLand + 0.3), (t, S, sh) => {
    // slow motion orbit around Emil in mid air
    const u = clamp((t - sh.t0) / (sh.t1 - sh.t0));
    const b = boy.posAt(S).add(V(0, 0.8, 0));
    const ang = lerp(-2.2, 0.9, ease(u));
    const pos = orbit(b, ang, lerp(4.2, 3.4, u), lerp(0.4, -0.6, u));
    return cam(pos, b, lerp(46, 40, u));
  });
  shot('5.11 Landung', 5, T(A.seeHatch + 1.2), (t, S) => cam(V(10.8, 15.25, -106.8), boy.posAt(S).add(V(0, 0.7, 0)), 42));

  // ================================================================ 6 Die Luke
  shot('6.1 Zur Luke', 6, T(A.wheel + 0.3), (t, S) => {
    const f = follow(boy, S, { back: 3.5, side: 1.2, up: 1.4, lookUp: 0.9, lookAhead: 3, win: 0.5 });
    return cam(f.pos, f.look.lerp(V(CITY.hatch.x, ROOF.h6 + 1.2, CITY.hatch.z), 0.3), 44);
  });
  shot('6.2 Das Handrad', 6, T(A.lid + 0.2), (t, S) => {
    // beside the collar: Emil heaves the handwheel round
    const d = V(CITY.hatch.x - 14.25, 0, CITY.hatch.z + 111.05).normalize(), side = V(d.z, 0, -d.x);
    const w = V(CITY.hatch.x, ROOF.h6 + 0.98, CITY.hatch.z).addScaledVector(d, -(ROOF.shaftR + 0.34));
    return cam(w.clone().addScaledVector(side, 1.45).addScaledVector(d, -0.55).add(V(0, 0.28, 0)), w.clone().addScaledVector(d, -0.25).add(V(0, 0.12, 0)), 42);
  });
  shot('6.3 Dampfstoß', 6, T(A.steam + 2.8), (t, S) => cam(V(10.6, 15.6, -108.3), V(CITY.hatch.x, ROOF.h6 + 2.2, CITY.hatch.z), 46));
  shot('6.4 Blick in die Tiefe', 6, T(A.lookDown + 7.4), (t, S, sh) => {
    // vertigo: dolly in while the field of view widens
    const u = ease((t - sh.t0) / (sh.t1 - sh.t0));
    const top = V(CITY.hatch.x + 0.25, ROOF.h6 + 1.2, CITY.hatch.z + 0.2);
    const fov = lerp(22, 68, u);
    const d = dollyDist(9.0, 22, fov);
    const pos = top.clone().add(V(0.35, d, 0.25));
    return cam(pos, V(CITY.hatch.x, ROOF.h6 - 40, CITY.hatch.z), fov, { near: 0.1 });
  });
  shot('6.5 Sieben Uhr', 6, T(A.bell + 3.0), (t, S, sh) => {
    const u = ease((t - sh.t0) / (sh.t1 - sh.t0));
    return cam(V(-6 + u * 2, 18 + u * 3, -150 - u * 6), V(CITY.tower.x, 60, CITY.tower.z), 44);
  });
  shot('6.6 Entschlossen', 6, T(A.rim + 0.2), (t, S) => {
    const b = boyHead(S);
    const d = V(CITY.hatch.x - 14.25, 0, CITY.hatch.z + 111.05).normalize();
    return cam(b.clone().addScaledVector(d, 0.95).add(V(d.z * 0.35, 0.02, -d.x * 0.35)), b, 36);
  });
  shot('6.7 Der Sprung in den Schacht', 6, T(A.chain0 + 0.3), (t, S) => cam(V(12.6, 17.2, -109.0), V(CITY.hatch.x, ROOF.h6 + 0.8, CITY.hatch.z), 46));

  // ================================================================ 7 Der Schacht
  const u01 = (t, sh) => clamp((t - sh.t0) / (sh.t1 - sh.t0));
  const bp = (S) => boy.posAt(S);
  const D = HALL.catDir, SIDE = V(D.z, 0, -D.x);
  const cw = (d, lat = 0, y = 0) => HALL.catA.clone().addScaledVector(D, d).addScaledVector(SIDE, lat).add(V(0, y, 0));
  const hc = HALL.heart;
  shot('7.1 Die Kette', 7, T(A.slide0 + 3.0), (t, S) => {
    // from above: Emil and the chain dropping away into the depth
    const b = boy.posAt(S);
    const k = smoothstep(A.slide0, A.slide0 + 2.5, S);
    const pos = V(b.x + 0.32, b.y + lerp(2.6, 3.4, k), b.z - 0.62);
    return cam(pos, V(b.x, b.y - 2.5, b.z - 0.05), lerp(58, 70, k), { near: 0.08 });
  });
  shot('7.2 Funkenflug', 7, T(A.brake + 0.9), (t, S) => {
    const b = boy.posAt(S);
    return cam(V(b.x - 0.55, b.y + 0.55, b.z - 0.62), V(b.x, b.y + 1.55, b.z - 0.1), 52, { near: 0.06 });
  });
  shot('7.3 Das Grubengleis', 7, T(A.cartPass + 1.0), (t, S) => {
    const b = bp(S);
    return handheld(cam(V(CITY.hatch.x + 3.9, -42.7, CITY.hatch.z + 1.45), V(b.x, b.y + 1.0, b.z), 46, { near: 0.1 }), t, 0.6);
  });
  shot('7.4 Weiter hinab', 7, T(A.slide1 + 3.4), (t, S) => {
    // close beside him: the lamps and rings rush upwards past his face
    const b = boy.posAt(S);
    return cam(V(b.x + 0.62, b.y + 1.05, b.z - 0.72), V(b.x - 0.05, b.y + 0.95, b.z + 0.1), 66, { near: 0.06 });
  });
  shot('7.5 Durchbruch', 7, T(A.breakthrough + 1.9), (t, S) => {
    const b = bp(S);
    return cam(V(CITY.hatch.x + 2.6, -84.5, CITY.hatch.z + 2.4), V(b.x, b.y + 1.1, b.z), 50);
  });
  shot('7.6 Die Halle', 7, T(A.chainEnd + 0.2), (t, S, sh) => {
    const u = ease(u01(t, sh));
    const b = bp(S);
    const pos = V(lerp(-38, -30, u), lerp(-108, -112, u), lerp(-84, -92, u));
    return cam(pos, b.clone().add(V(0, 1, 0)).lerp(hc, lerp(0.15, 0.3, u)), 55);
  });
  shot('7.7 Absprung', 7, T(A.catLand + 0.9), (t, S) => {
    const b = bp(S);
    return cam(cw(3.6, 0.35, 1.25), V(b.x, b.y + 0.9, b.z), 46);
  });

  // ================================================================ 8 Die Maschinenhalle
  shot('8.1 Staunen', 8, T(A.hallLook + 4.0), (t, S) => {
    const b = bp(S);
    const f = HALL.catDir;
    return cam(V(b.x + f.x * 1.25 + SIDE.x * 0.3, b.y + 1.32, b.z + f.z * 1.25 + SIDE.z * 0.3), V(b.x, b.y + 1.28, b.z), 38);
  });
  shot('8.2 Die große Halle', 8, T(A.hallLook + 11.0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    const b = bp(S);
    const pos = splineCached('hall82', [V(b.x - 0.9, b.y + 1.55, b.z + 2.0), V(b.x + 4, b.y + 5, b.z + 8), V(b.x + 14, b.y + 14, b.z + 18), V(b.x + 24, b.y + 22, b.z + 26)], u);
    const look = V(lerp(b.x, hc.x, u * 0.8), lerp(b.y + 1.2, hc.y, u), lerp(b.z - 3, hc.z, u * 0.8));
    return cam(pos, look, lerp(44, 58, u));
  });
  shot('8.3 Am Glutfluss', 8, T(A.catRun + 1.8), (t, S, sh) => {
    const u = u01(t, sh);
    return cam(V(-15.5 - u * 1.5, -145.2, -116 - u * 3), V(-26, -149, -134), 50);
  });
  shot('8.4 Über den Steg', 8, T(A.valve + 0.2), (t, S) => {
    const f = follow(boy, S, { back: -4.0, side: 0.35, up: 1.35, lookUp: 1.0, lookAhead: 2, win: 0.6 });
    return handheld(cam(f.pos, f.look, 46), t, 0.8);
  });
  shot('8.5 Das Ventil', 8, T(A.dash + 1.1), (t, S) => {
    const b = bp(S);
    return handheld(cam(cw(22.6, 2.7, 1.6), V(b.x, b.y + 1.0, b.z).lerp(cw(21, 0.9, 0.6), 0.35), 44), t, 0.6);
  });
  shot('8.6 Der Automat', 8, T(A.meet + 2.2), (t, S) => {
    const b = bp(S);
    return cam(cw(34.4, 0.25, 0.85), V(b.x, b.y + 1.05, b.z), 40);
  });
  shot('8.7 Das goldene Auge', 8, T(A.autoBow + 0.9), (t, S) => cam(cw(31.35, 0.32, 0.95), cw(32.3, 0, 0.95), 36));
  shot('8.8 Die Verbeugung', 8, T(A.pass + 2.2), (t, S, sh) => {
    const u = u01(t, sh);
    const b = bp(S);
    return cam(cw(31.2 + u * 0.8, 2.8, 1.25), V(b.x, b.y + 0.7, b.z).lerp(cw(32.6, -0.2, 0.6), 0.5), 42);
  });
  shot('8.9 Die Lücke', 8, T(A.gapLand + 0.5), (t, S) => {
    const b = bp(S);
    return cam(cw(40.3, 4.4, -0.7), V(b.x, b.y + 0.8, b.z), 46);
  });
  shot('8.10 Das Herz', 8, T(A.heart0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    const b = smoothPos(boy, S, 0.4);
    const pos = b.clone().addScaledVector(HALL.catDir, -lerp(2.0, 3.2, u)).addScaledVector(SIDE, 0.6).add(V(0, lerp(1.5, 1.2, u), 0));
    return cam(pos, hc.clone().add(V(0, lerp(-2, 1, u), 0)), 50);
  });

  // ================================================================ 9 Das Herz
  shot('9.1 Zum Sockel', 9, T(A.atSocket + 1.0), (t, S) => {
    const b = smoothPos(boy, S, 0.4);
    return cam(b.clone().addScaledVector(SIDE, 2.6).addScaledVector(HALL.sockDir, 0.6).add(V(0, 1.25, 0)), b.clone().add(V(0, 0.95, 0)).lerp(HALL.socket, 0.3), 44);
  });
  shot('9.2 Der alte Kern', 9, T(A.atSocket + 3.4), (t, S) => {
    const oc = HALL.stand.clone().addScaledVector(V(HALL.sockDir.z, 0, -HALL.sockDir.x), 1.3).addScaledVector(HALL.sockDir, -0.2);
    return cam(oc.clone().addScaledVector(HALL.sockDir, 1.0).add(V(0.3, 0.45, 0)), oc.clone().add(V(0, 0.2, 0)), 40);
  });
  shot('9.3 Der müde Herzschlag', 9, T(A.take + 0.6), (t, S, sh) => {
    const u = u01(t, sh);
    return cam(V(24 - u * 2, -146.5, -146 - u * 2), hc.clone().add(V(0, 2, 0)), 52);
  });
  shot('9.4 Der Kern', 9, T(A.insert), (t, S) => {
    const b = bp(S);
    const f = HALL.sockDir.clone().negate(); // boy looks along -sockDir
    const pos = b.clone().addScaledVector(f, 0.95).addScaledVector(SIDE, 0.3).add(V(0, 1.12, 0));
    return cam(pos, b.clone().add(V(0, 1.05, 0)), 40);
  });
  shot('9.5 Einsetzen', 9, T(A.click + 1.0), (t, S) => {
    const b = bp(S);
    return cam(b.clone().addScaledVector(SIDE, -1.9).addScaledVector(HALL.sockDir, 0.4).add(V(0, 1.3, 0)), b.clone().add(V(0, 1.05, 0)).lerp(HALL.socket, 0.55), 42);
  });
  shot('9.6 Stille', 9, T(A.wake + 0.5), (t, S, sh) => {
    const u = u01(t, sh);
    return cam(HALL.socket.clone().addScaledVector(HALL.sockDir, 1.9 - u * 0.3).addScaledVector(SIDE, 0.55).add(V(0, 0.3, 0)), HALL.socket, 40);
  });
  shot('9.7 Das Herz erwacht', 9, T(A.waveS + 0.8), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(cw(36 - u * 4, -1.2, 2.2 + u * 1.5), hc.clone().add(V(0, 1.5, 0)), 54);
  });
  shot('9.8 Die Lichtwelle', 9, T(A.cheer), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(V(-52 + u * 6, -134 + u * 4, -268 + u * 8), hc.clone().add(V(0, 4, 0)), 56);
  });
  shot('9.9 Jubel', 9, T(A.afterglow + 0.4), (t, S) => {
    const b = bp(S);
    const f = HALL.sockDir;
    return cam(b.clone().addScaledVector(f, -1.0).addScaledVector(SIDE, -2.1).add(V(0, 1.1, 0)), b.clone().add(V(0, 1.15, 0)), 40);
  });
  shot('9.10 Die Halle lebt', 9, T(A.upShaft), (t, S, sh) => {
    const u = ease(u01(t, sh));
    const b = bp(S);
    const pos = splineCached('hall910', [b.clone().addScaledVector(HALL.sockDir, 2.5).add(V(0, 1.6, 0)), b.clone().addScaledVector(HALL.sockDir, 9).add(V(4, 7, 0)), b.clone().addScaledVector(HALL.sockDir, 26).add(V(16, 20, 0))], u);
    return cam(pos, b.clone().add(V(0, 1, 0)).lerp(hc, 0.5 + 0.3 * u), lerp(42, 60, u));
  });
  shot('9.11 Licht im Schacht', 9, T(A.city), (t, S, sh) => {
    // inside the shaft looking up: the lamps catch fire one after another, sparks race upwards
    const u = u01(t, sh);
    return cam(V(CITY.hatch.x - 0.55, -66 + u * 3, CITY.hatch.z - 0.35), V(CITY.hatch.x + 0.1, 10, CITY.hatch.z + 0.15), 64, { near: 0.08 });
  });
  // epilogue up in the city (no Emil in these shots)
  shot('9.12 Die Luke glüht', 9, T(A.city + 5.0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(V(10.6 - u * 1.5, 15.8 + u * 1.2, -106.5 + u * 1.5), V(CITY.hatch.x, ROOF.h6 + 3.5, CITY.hatch.z), 48);
  }, { focus: 'none' });
  shot('9.13 Die Marktgasse erwacht', 9, T(A.city + 12.0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(V(-2.2, 1.7 + u * 1.2, 30 - u * 4), V(0.5, 4.5 + u * 2, -40), 50);
  }, { focus: 'none' });
  shot('9.14 Wachtmeister Brummer', 9, T(A.city + 19.0), (t, S) => {
    const c = copHead(S);
    // he has turned towards the sunset and the glowing street
    return cam(V(c.x - 1.35, c.y - 0.12, c.z - 1.45), c.clone().add(V(0, 0.02, 0)), 36);
  }, { focus: 'cop' });
  shot('9.15 Der Uhrturm', 9, T(A.city + 25.0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(V(-14 + u * 6, 14 + u * 10, -168 - u * 4), V(CITY.tower.x, 52, CITY.tower.z), 44);
  }, { focus: 'none' });
  shot('9.16 Das Luftschiff', 9, T(A.city + 31.0), (t, S, sh) => {
    const u = u01(t, sh);
    if (extras.airships) {
      const a = extras.airships.big, p = a.posAt(S), d = a.dirAt(S), side = V(d.z, 0, -d.x);
      return cam(p.clone().addScaledVector(side, -46).addScaledVector(d, -30 + u * 12).add(V(0, -6, 0)), p.clone().addScaledVector(d, 10), 44, { near: 1 });
    }
    return cam(V(40 + u * 10, 60 + u * 4, -60 - u * 6), V(0, 55, -232), 50);
  }, { focus: 'none' });
  const seat = A.seat;
  shot('9.17 Emil auf dem Dach', 9, T(A.city + 40.0), (t, S, sh) => {
    const u = ease(u01(t, sh));
    return cam(V(seat.x + 2.6 - u * 0.4, seat.y + 1.55 + u * 0.3, seat.z + 2.2 - u * 0.6), V(seat.x - 6, seat.y + 1.2, seat.z - 5.5), 50);
  });
  shot('9.18 Emil und die Katze', 9, T(A.city + 46.0), (t, S, sh) => {
    const u = u01(t, sh);
    return cam(V(seat.x - 1.35, seat.y + 1.05, seat.z - 1.2 + u * 0.15), V(seat.x, seat.y + 0.95, seat.z + 0.25), 40);
  });
  shot('9.19 Dampfstadt bei Nacht', 9, T(A.epilogueEnd), (t, S, sh) => {
    const u = ease(u01(t, sh));
    const pos = splineCached('night', [V(seat.x + 2.0, seat.y + 1.8, seat.z + 1.5), V(seat.x + 6, seat.y + 12, seat.z + 12), V(40, 70, -20), V(90, 160, 60), V(150, 250, 160)], u);
    const look = splineCached('nightL', [V(seat.x - 6, seat.y + 1.2, seat.z - 5.5), V(-10, 20, -150), V(0, 30, -180), V(0, 40, -200), V(0, 50, -230)], u);
    return cam(pos, look, 52, { near: u < 0.2 ? 0.2 : 1 });
  }, { fadeOut: 3.5 });
  shot('Abspann', 9, T(A.epilogueEnd) + 48, (t, S) => cam(V(0, 300, 400), V(0, 50, -200), 50, { near: 1 }), { focus: 'none', credits: true, blank: true });
  return shots;
}
