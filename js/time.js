// Film time T (seconds of the film) and story time S (seconds inside the story world).
// S runs at speed 1 except during slow motion; speed keys are piecewise linear in T,
// so S(T) is an exact piecewise quadratic and every frame is reproducible.
export class TimeMap {
  constructor(keys) {
    // keys: [[T, speed], ...] sorted by T
    this.keys = keys;
    this.cum = [keys[0][0]]; // S = T at the first key
    for (let i = 1; i < keys.length; i++) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      this.cum.push(this.cum[i - 1] + ((v0 + v1) / 2) * (t1 - t0));
    }
  }
  S(T) {
    const k = this.keys;
    if (T <= k[0][0]) return T - k[0][0] + this.cum[0];
    const n = k.length;
    if (T >= k[n - 1][0]) return this.cum[n - 1] + (T - k[n - 1][0]) * k[n - 1][1];
    let i = 1;
    while (i < n - 1 && k[i][0] < T) i++;
    const [t0, v0] = k[i - 1], [t1, v1] = k[i];
    const dt = T - t0;
    const a = (v1 - v0) / (t1 - t0);
    return this.cum[i - 1] + v0 * dt + 0.5 * a * dt * dt;
  }
  speed(T) {
    const k = this.keys;
    if (T <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (T <= k[i][0]) { const u = (T - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u; }
    return k[k.length - 1][1];
  }
  // inverse (monotonic): film time at which story time S is reached
  T(S) {
    let lo = -10, hi = 2000;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (this.S(m) < S) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
}

// Build the map from slow motion specs given in story time: the slow speed is fully
// reached at story time s, holds for sDur story seconds, then ramps back.
export function buildTimeMap(specs, rampIn = 0.9, rampOut = 1.4, offset = 0) {
  const m = buildTimeMap0(specs, rampIn, rampOut);
  if (!offset) return m;
  // film time runs ahead of story time by a constant offset (a longer title flight)
  return { keys: m.keys, S: (T) => m.S(T - offset), speed: (T) => m.speed(T - offset), T: (S) => m.T(S) + offset, offset };
}
function buildTimeMap0(specs, rampIn, rampOut) {
  const keys = [[-10, 1]];
  let lag = 0;
  for (const sp of specs) {
    const v = sp.speed;
    const tA = sp.s - rampIn * (1 + v) / 2 + lag;      // ramp starts
    const tB = tA + rampIn;                            // slow speed reached (story time sp.s)
    const tC = tB + sp.sDur / v;                       // hold ends
    const tD = tC + rampOut;                           // back to real time
    keys.push([tA, 1], [tB, v], [tC, v], [tD, 1]);
    lag = tD - (sp.s + sp.sDur + rampOut * (1 + v) / 2);
  }
  keys.push([100000, 1]);
  return new TimeMap(keys);
}

export const DURATION = 540;

// chapter start times are derived from the story (see story/story.js)
export const CHAPTERS = [
  { n: 1, t: 0, title: 'Flug über Dampfstadt' },
  { n: 2, t: 65, title: 'Die Marktgasse' },
  { n: 3, t: 105, title: 'Die Verfolgung' },
  { n: 4, t: 178, title: 'Die Leiter' },
  { n: 5, t: 218, title: 'Über die Dächer' },
  { n: 6, t: 280, title: 'Die Luke' },
  { n: 7, t: 315, title: 'Der Schacht' },
  { n: 8, t: 355, title: 'Die Maschinenhalle' },
  { n: 9, t: 410, title: 'Das Herz' },
];
