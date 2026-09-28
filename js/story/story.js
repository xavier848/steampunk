// The story of DAMPFSTADT in story time S: Emil's and Brummer's tracks, the set piece
// objects (tram, falling top hat, pigeons), expressions and sound events. The camera
// shots (shots.js) are hung onto the anchors A.* defined here.
import * as THREE from 'three';
import { Track } from './track.js';
import { buildTimeMap } from '../time.js';
import * as POSE from '../actors/poses.js';
import { FACE } from '../actors/faces.js';
import { CITY } from '../city/layout.js';
import { ROOF } from '../city/rooftops.js';
import { CURB_H } from '../city/street.js';
import { smoothstep, clamp, pulse } from '../core/math.js';

const W = CURB_H; // pavement height
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildStory() {
  const A = {};                 // named anchors (story time)
  const boy = new Track('boy', { stride: 1.2, walkStride: 0.58 });
  const cop = new Track('cop', { stride: 1.35, walkStride: 0.72 });
  const events = [];
  const ev = (s, type, extra = {}) => events.push({ s, type, ...extra });
  const faces = [];             // [s, face] for the boy
  const copFaces = [];
  const face = (s, f) => faces.push([s, f]);
  const cface = (s, f) => copFaces.push([s, f]);

  // ================================================================ 2 Die Marktgasse
  // Emil stands at a brass stall looking at gears, then strolls north.
  A.boyStart = 58;
  const stallPos = v(-4.55, 0, 122.6);
  boy.pose(A.boyStart, (u, t) => POSE.addRot(POSE.idle(t, { look: 0 }), 'head', 0.35, 0.1 * Math.sin(t * 0.7), 0), { s0: 0, pos: stallPos, yaw: -Math.PI / 2 });
  face(0, FACE.neutral);
  A.turn = boy.end + 26;
  boy.pose(26, (u, t) => {
    const p = POSE.idle(t);
    POSE.addRot(p, 'head', 0.35, 0.15 * Math.sin(t * 0.8), 0);
    p.rot.R_arm = [-0.6, 0, -0.1]; p.rot.R_fore = [-0.9 - 0.2 * Math.sin(t * 2), 0, 0]; // turning a small gear in his hand
    return p;
  });
  A.walk1 = boy.end;
  boy.path([stallPos, v(-2.6, 0, 121.2), v(-0.2, 0, 119.2), v(0.9, 0, 117.0)], { gait: 'walk', speed: 1.05 });
  A.stop1 = boy.end;
  face(A.walk1, FACE.determined);
  // the core pulses, the lamps above flicker: he looks down at the satchel, then up
  boy.pose(6.5, (u, t) => POSE.blend([[POSE.lookSatchel(t, smoothstep(0.0, 0.2, u) * (1 - smoothstep(0.6, 0.8, u))), 1], [POSE.addRot(POSE.idle(t), 'head', -0.35, 0.5, 0), smoothstep(0.62, 0.8, u)]]));
  face(A.stop1 + 0.2, FACE.neutral); face(A.stop1 + 4.3, FACE.determined);
  A.pulse = A.stop1 + 1.2;
  ev(A.pulse, 'corePulse');
  A.walk2 = boy.end;
  boy.path([v(0.9, 0, 117.0), v(1.1, 0, 112.0), v(1.2, 0, 105.6)], { gait: 'walk', speed: 1.0 });
  A.halt = boy.end;
  boy.pose(2.6, (u, t) => POSE.addRot(POSE.idle(t), 'head', 0, -1.2 * smoothstep(0, 0.25, u), 0));
  face(A.halt + 0.1, FACE.surprised);
  A.whistle = A.halt + 1.0;
  ev(A.whistle, 'whistle', { who: 'cop', dur: 1.6 });
  ev(A.whistle + 0.15, 'pigeons', { at: v(3.0, 0, 108.5), n: 9 });

  // ================================================================ 3 Die Verfolgung
  A.run0 = boy.end;
  face(A.run0, FACE.effort);
  boy.path([v(1.2, 0, 105.6), v(1.9, 0, 100), v(0.4, 0, 94), v(-1.7, 0, 88.5), v(-0.9, 0, 82), v(1.6, 0, 75.5), v(0.8, 0, 69), v(-0.3, 0, 62.4)], { gait: 'run', speed: 4.6 });
  A.hat = boy.end;
  ev(A.hat, 'hat', { at: v(-0.35, 0, 61.6) });
  boy.pose(0.45, (u, t) => POSE.blend([[POSE.locomotion(0.1 + u * 0.4, 0.6), 1], [POSE.land(u * 0.6), 0.5]]));
  face(A.hat, FACE.surprised); face(A.hat + 0.8, FACE.effort);
  boy.path([v(-0.35, 0, 61.2), v(-1.0, 0, 54.5), v(-1.3, 0, 48.6)], { gait: 'run', speed: 4.4 });
  A.cartJump = boy.end;
  boy.jump(v(-1.1, 0, 40.4), { dur: 0.95, h: 1.3 });
  ev(A.cartJump, 'jump'); ev(boy.end, 'land');
  A.cartLand = boy.end;
  boy.pose(0.35, (u) => POSE.land(u));
  boy.path([v(-1.1, 0, 40.2), v(0.6, 0, 33), v(2.3, 0, 24.5), v(3.1, 0, 16.1)], { gait: 'run', speed: 4.7 });
  A.slide = boy.end;
  boy.move(v(5.9, W, 13.1), 0.95, (u) => POSE.slide(u), { yaw: Math.atan2(2.8, -2.8), ease: (u) => 1 - (1 - u) * (1 - u) });
  ev(A.slide, 'slide');
  face(A.slide, FACE.effort);
  boy.pose(0.5, (u, t) => POSE.blend([[POSE.slide(1 - u), 1 - u], [POSE.crouch(0.5 * (1 - u)), u]]));
  boy.path([v(5.9, W, 13.1), v(6.0, W, 10.6), v(2.3, 0, 5.2), v(-2.6, 0, -0.8), v(-5.6, W, -5.4), v(-7.25, W, -8.2)], { gait: 'run', speed: 4.9 });
  A.hide = boy.end;
  // hiding behind the barrels; peeks when the constable is close
  const hideDur = 15.5;
  boy.pose(hideDur, (u, t) => POSE.hide(t, pulse(u, 0.55, 0.3) + 0.4 * pulse(u, 0.9, 0.12)), { yaw: Math.PI / 2 });
  face(A.hide + 0.3, FACE.determined); face(A.hide + 7.5, FACE.surprised); face(A.hide + 10.5, FACE.determined); face(A.hide + 14.2, FACE.surprised);
  A.glow = A.hide + 13.4;      // the core flares and gives him away
  ev(A.glow, 'coreFlare');
  A.bolt = boy.end;
  face(A.bolt + 0.3, FACE.effort);
  boy.path([v(-7.25, W, -8.2), v(-4.2, 0, -11.2), v(0.9, 0, -17.2), v(3.3, 0, -24.5), v(4.3, 0, -32.0), v(5.0, W, -38.4)], { gait: 'run', speed: 5.6 });
  A.across = boy.end;
  // he stops on the far side and looks back while the tram thunders through
  boy.pose(4.6, (u, t) => POSE.addRot(POSE.idle(t), 'head', 0, 0, 0), { yaw: 0.2 });
  face(A.across + 0.5, FACE.joy); face(A.across + 3.6, FACE.determined);
  boy.path([v(5.0, W, -38.4), v(5.9, W, -39.8), v(6.5, W, -40.6)], { gait: 'walk', speed: 1.6 });

  // ================================================================ 4 Die Leiter
  A.crates = boy.end;
  boy.move(v(7.1, CURB_H + 1.5, -41.4), 2.2, (u, t) => POSE.blend([[POSE.climb(u * 1.2), 1], [POSE.crouch(0.4), 0.3]]), { yaw: Math.PI / 2, ease: (u) => u * u * (3 - 2 * u) });
  ev(A.crates + 0.5, 'crate'); ev(A.crates + 1.4, 'crate');
  A.ladder0 = boy.end;
  const ladderX = CITY.ladder.x - 0.32 - 0.36;
  const climbDur = 15.5;
  boy.move(v(ladderX, ROOF.ladderTop - 0.75, CITY.ladder.z), climbDur, (u, t) => POSE.climb(t * 0.85), { a: v(ladderX, CURB_H + 1.55, CITY.ladder.z), yaw: Math.PI / 2 });
  for (let k = 0; k < climbDur * 1.7; k++) ev(A.ladder0 + k / 1.7, 'rung');
  A.ladderTop = boy.end;
  boy.move(v(9.35, ROOF.h1, CITY.ladder.z), 1.9, (u, t) => POSE.blend([[POSE.climb(t * 0.85), 1 - u], [POSE.crouch(0.6 * Math.sin(u * Math.PI)), u]]), { yaw: Math.PI / 2 });
  A.onRoof = boy.end;
  boy.pose(5.2, (u, t) => POSE.addRot(POSE.idle(t, { breathe: 2.5 }), 'head', 0.35, 0, 0), { yaw: -Math.PI / 2 });
  face(A.onRoof + 0.4, FACE.joy); face(A.onRoof + 3.8, FACE.determined);

  // ================================================================ 5 Über die Dächer
  A.roofRun = boy.end;
  boy.path([v(9.35, ROOF.h1, -42.5), v(10.2, ROOF.h1, -44.6), v(11.0, ROOF.h1, -47.3)], { gait: 'run', speed: 3.8 });
  boy.jump(v(11.8, 15.55, -49.1), { dur: 0.5, h: 0.45 });
  const ridgeY = ROOF.h2ridge + 0.03;
  boy.path([v(11.8, 15.55, -49.1), v(14.0, 16.25, -51.3), v(15.3, ridgeY, -53.0)], { gait: 'run', speed: 3.2 });
  A.ridge = boy.end;
  boy.path([v(15.3, ridgeY, -53.0), v(15.4, ridgeY, -55.2), v(15.4, ridgeY, -57.3)], { gait: 'jog', speed: 2.0, mod: (p, t) => POSE.balance(p, 1, t) });
  ev(A.ridge + 0.6, 'pigeons', { at: v(15.4, ridgeY, -55.5), n: 7 });
  boy.jump(v(16.35, ROOF.walkY + 0.03, -58.9), { dur: 0.55, h: 0.35 });
  A.walkway = boy.end;
  boy.path([v(16.35, ROOF.walkY + 0.03, -58.9), v(16.35, ROOF.walkY + 0.03, -62.0)], { gait: 'run', speed: 3.4 });
  boy.jump(v(16.0, ROOF.h3, -63.3), { dur: 0.45, h: 0.45 });
  A.laundry = boy.end;
  const duckAt = (st, z0) => pulse(st.pos.z, z0, 0.9);
  boy.path([v(16.0, ROOF.h3, -63.3), v(15.4, ROOF.h3, -64.6), v(14.9, ROOF.h3, -68.0), v(14.6, ROOF.h3, -71.0), v(13.4, ROOF.h3, -72.2), v(10.4, ROOF.h3, -72.55)], {
    gait: 'run', speed: 3.4, mod: (p, t, st) => POSE.duck(p, Math.max(duckAt(st, -64.0), duckAt(st, -71.5))) });
  A.catPass = A.laundry + 1.2;
  boy.jump(v(8.8, 14.95, -74.2), { dur: 0.5, h: 0.45 });
  A.glassRoof = boy.end;
  boy.path([v(8.8, 14.95, -74.2), v(8.8, 14.95, -79.0), v(8.8, 14.95, -84.0)], { gait: 'run', speed: 3.3 });
  boy.path([v(8.8, 14.95, -84.0), v(9.5, 14.95, -84.25)], { gait: 'walk', speed: 1.4 });
  A.fireLadder = boy.end;
  boy.move(v(9.5, ROOF.h5 + 0.25, -84.25), 3.6, (u, t) => POSE.climb(t * 0.9), { yaw: Math.PI });
  for (let k = 0; k < 6; k++) ev(A.fireLadder + k * 0.6, 'rung');
  boy.move(v(9.8, ROOF.h5, -86.1), 1.2, (u, t) => POSE.blend([[POSE.climb(t * 0.9), 1 - u], [POSE.crouch(0.5 * Math.sin(u * Math.PI)), u]]), { yaw: Math.PI });
  A.clockLook = boy.end;
  const towerYaw = Math.atan2(CITY.tower.x - 9.8, CITY.tower.z - -86.1);
  boy.pose(5.5, (u, t) => POSE.addRot(POSE.idle(t, { breathe: 2.2 }), 'head', -0.12, 0, 0), { yaw: towerYaw });
  face(A.clockLook + 0.3, FACE.neutral); face(A.clockLook + 3.4, FACE.determined);
  ev(A.clockLook + 0.8, 'airship');
  A.runUp = boy.end;
  boy.path([v(9.8, ROOF.h5, -86.1), v(11.4, ROOF.h5, -91.5), v(12.3, ROOF.h5, -96.3)], { gait: 'run', speed: 4.6 });
  boy.jump(v(12.35, ROOF.h5 + 0.68, -96.95), { dur: 0.28, h: 0.2 });
  A.alleyJump = boy.end;
  boy.jump(v(13.0, ROOF.h6, -104.8), { dur: 1.0, h: 1.05, tuck: 1.2 });
  ev(A.alleyJump, 'jump', { big: true }); ev(boy.end, 'land', { big: true });
  face(A.alleyJump, FACE.effort);
  A.alleyLand = boy.end;
  boy.pose(0.9, (u) => POSE.land(u), { yaw: Math.PI });
  boy.pose(0.8, (u, t) => POSE.blend([[POSE.land(1 - u * 0.5), 1 - u], [POSE.idle(t), u]]));
  face(A.alleyLand + 0.5, FACE.joy);
  A.seeHatch = boy.end;
  boy.pose(2.8, (u, t) => POSE.addRot(POSE.idle(t, { breathe: 2 }), 'head', 0.1, -0.35 * smoothstep(0.2, 0.6, u), 0));
  face(A.seeHatch + 1.0, FACE.determined);

  // ================================================================ 6 Die Luke
  A.toHatch = boy.end;
  const hatchStand = v(14.25, ROOF.h6, -111.05);
  const hatchYaw = Math.atan2(CITY.hatch.x - hatchStand.x, CITY.hatch.z - hatchStand.z);
  boy.path([v(13.0, ROOF.h6, -104.8), v(13.8, ROOF.h6, -108.2), hatchStand], { gait: 'jog', speed: 2.2 });
  A.wheel = boy.end;
  boy.pose(4.8, (u, t) => POSE.wheel(t), { yaw: hatchYaw });
  ev(A.wheel + 0.3, 'wheel', { dur: 4.4 });
  face(A.wheel, FACE.effort);
  A.lid = boy.end;
  boy.pose(1.6, (u, t) => POSE.blend([[POSE.wheel(t), 1 - u], [POSE.crouch(0.3, 1.0), u]]));
  A.steam = A.lid + 1.2;
  ev(A.lid + 0.2, 'hatchOpen'); ev(A.steam, 'steamBurst');
  boy.pose(3.2, (u, t) => POSE.shield(t, smoothstep(0, 0.15, u) * (1 - smoothstep(0.75, 1, u))));
  face(A.steam, FACE.surprised); face(A.steam + 2.6, FACE.determined);
  A.lookDown = boy.end;
  boy.pose(7.5, (u, t) => POSE.lookDown(t, smoothstep(0, 0.2, u)));
  face(A.lookDown + 0.5, FACE.surprised); face(A.lookDown + 4.0, FACE.effort);
  A.bell = boy.end;
  for (let k = 0; k < 7; k++) ev(A.bell + k * 1.35, 'bell', { k });
  boy.pose(5.6, (u, t) => POSE.addRot(POSE.idle(t, { breathe: 2.5 }), 'head', -0.1, -0.9 * smoothstep(0.05, 0.3, u) * (1 - smoothstep(0.7, 0.95, u)), 0));
  face(A.bell + 0.4, FACE.neutral); face(A.bell + 3.0, FACE.determined);
  A.rim = boy.end;
  boy.move(v(14.75, ROOF.h6 + 1.22, -111.75), 1.5, (u, t) => POSE.blend([[POSE.climb(t), 1 - u * 0.5], [POSE.crouch(0.7), u * 0.8]]), { yaw: hatchYaw });
  A.jumpIn = boy.end;
  boy.jump(v(CITY.hatch.x, ROOF.h6 - 0.4, CITY.hatch.z), { dur: 0.7, h: 0.35 });
  ev(A.jumpIn, 'jump');
  A.chain0 = boy.end;
  face(A.jumpIn, FACE.effort);

  // ================================================================ constable Brummer
  const copSpot = v(4.35, 0, 112.4);
  cop.pose(A.halt - 3.4, (u, t) => POSE.reading(t), { s0: 0, pos: copSpot, yaw: -Math.PI / 2 });
  cface(0, FACE.stern);
  A.copNotice = A.halt - 3.4;
  cop.pose(1.8, (u, t) => POSE.addRot(POSE.reading(t, 1 - u), 'head', -0.2 * u, 0.9 * smoothstep(0, 0.5, u), 0));
  cop.path([copSpot, v(3.6, 0, 110.4), v(3.1, 0, 109.0)], { gait: 'walk', speed: 1.4, s0: A.halt - 1.6 });
  cface(A.halt - 1.0, FACE.shout);
  cop.pose(A.run0 + 0.7 - cop.end, (u, t) => POSE.whistle(t, smoothstep(0, 0.3, u)), { yaw: Math.PI });
  cface(A.whistle - 0.2, FACE.whistle);
  A.copRun = cop.end;
  cface(A.copRun, FACE.puff);
  // he follows Emil's line, slower, going around the cart and past the awning on the road
  cop.path([v(3.1, 0, 109.0), v(2.4, 0, 100), v(0.9, 0, 93), v(-1.2, 0, 86), v(-0.2, 0, 78), v(1.8, 0, 70), v(1.3, 0, 60), v(1.9, 0, 50), v(2.1, 0, 40), v(1.2, 0, 30), v(0.2, 0, 20), v(-1.6, 0, 8), v(-2.6, 0, -4), v(-2.8, 0, -12), v(-2.7, 0, -17.2)], { gait: 'run', k: 0.85, s1: A.hide + 5.0 });
  A.copStop = cop.end;
  cop.pose(A.glow - cop.end, (u, t) => POSE.search(t, 1), { yaw: Math.PI });
  cface(A.copStop, FACE.stern);
  cop.pose(A.bolt - A.glow, (u, t) => POSE.point(t, smoothstep(0.1, 0.5, u)), { yaw: -2.2 });
  cface(A.glow + 0.3, FACE.shout);
  // lunges after him and is cut off by the tram
  cop.path([v(-2.7, 0, -17.2), v(-0.6, 0, -19.4), v(0.9, 0, -21.6)], { gait: 'run', k: 0.9, speed: 3.9 });
  A.copBlocked = cop.end;
  cop.pose(0.9, (u, t) => POSE.blend([[POSE.land(u * 0.7), 1 - u], [POSE.idle(t), u]]), { yaw: Math.PI });
  cop.pose(2.4, (u, t) => POSE.whistle(t, 1), { yaw: Math.PI });
  ev(A.copBlocked + 1.0, 'whistle', { who: 'cop', dur: 1.8 });
  A.copAfterTram = cop.end;
  // out of breath: hands on the knees for a moment, then he trots after Emil
  cop.pose(5.2, (u, t) => { const p = POSE.crouch(0.25, 0.9); POSE.addRot(p, 'spine', 0.45, 0, 0); POSE.addRot(p, 'head', -0.5, 0, 0); p.hipsOff[1] += Math.sin(t * 5) * 0.02; return p; }, { yaw: Math.PI });
  cop.path([v(0.9, 0, -21.6), v(2.5, 0, -30), v(4.6, W, -37.6), v(6.2, W, -41.4)], { gait: 'jog', k: 0.55, s1: A.ladder0 + 6.5 });
  A.copAtLadder = cop.end;
  // tries the ladder, creak, gives up; whistles and shakes his fist
  cop.pose(2.0, (u, t) => POSE.blend([[POSE.climb(0.2 + u * 0.3), 0.8], [POSE.idle(t), 0.2]]), { yaw: Math.PI / 2 });
  ev(A.copAtLadder + 1.1, 'creak');
  cop.pose(1.2, (u, t) => POSE.idle(t), { yaw: Math.PI / 2 });
  cop.pose(2.6, (u, t) => POSE.whistle(t, 1), { yaw: Math.PI / 2 });
  ev(cop.end - 2.2, 'whistle', { who: 'cop', dur: 2.0 });
  cop.pose(4.0, (u, t) => POSE.shakeFist(t, 1), { yaw: Math.PI / 2 });
  cface(A.copAtLadder, FACE.stern); cface(A.copAtLadder + 3.3, FACE.whistle); cface(A.copAtLadder + 5.8, FACE.shout);
  cop.pose(400, (u, t) => POSE.addRot(POSE.idle(t, { breathe: 1.6 }), 'head', -0.25, 0, 0), { yaw: Math.PI / 2 });
  cface(A.copAtLadder + 9.8, FACE.puff);

  // ================================================================ tram on the Kesselstrasse
  // Emil crosses the rails; the tram front passes his line 0.8 s later and cuts off Brummer
  const crossS = sOfZ(boy, -30.0, A.bolt, A.across);
  A.crossRails = crossS;
  const tramSpeed = 7.5, tramX0 = 5.0 + tramSpeed * 0.9;
  const tram = { z: -30, speed: tramSpeed, frontAt: (S) => tramX0 - tramSpeed * (S - crossS), len: 13.5 };
  ev(crossS - 3.0, 'tramBell'); ev(crossS - 1.5, 'tram', { dur: 6 });

  // ================================================================ slow motion and film time
  const slowMo = [
    { s: A.cartJump + 0.05, sDur: 0.8, speed: 0.3 },
    { s: A.alleyJump + 0.02, sDur: 0.93, speed: 0.085 },
  ];
  A.slowMo = slowMo;
  return { A, boy, cop, events, faces, copFaces, tram, slowMo };
}

// story time when a track crosses a given z between s0 and s1 (bisection on the path)
function sOfZ(track, z, s0, s1) {
  let lo = s0, hi = s1;
  const f = (s) => track.posAt(s).z - z;
  if (f(lo) * f(hi) > 0) return (s0 + s1) / 2;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// expression at S from a sorted list with automatic blinks
export function faceAt(list, S, blinkSeed = 0) {
  let f = list[0][1];
  for (const [s, ff] of list) { if (s <= S) f = ff; else break; }
  // blink every ~3.7 s for 0.12 s (not while surprised)
  const ph = (S + blinkSeed) % 3.7;
  if (ph < 0.12 && f !== FACE.surprised && f !== FACE.whistle && f !== FACE.puff) return f < 6 ? FACE.blink : f;
  return f;
}
