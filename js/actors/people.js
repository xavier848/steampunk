// Random but deterministic townsfolk: archetype, clothing colours, hats, props, faces, size.
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const SKIN = [0xf2c8a6, 0xe8b490, 0xd9a07a, 0xc08462, 0x9a6448, 0x7a4c36, 0xf6d6bc];
const COAT = [0x2e3f5c, 0x3e2a26, 0x2f4a3a, 0x5a2a30, 0x4a4450, 0x5a4632, 0x243040, 0x6a5040, 0x3a3a48];
const TROUS = [0x3a3634, 0x4a4038, 0x5a5048, 0x2e2c30, 0x6a5a48, 0x4a4a52];
const DRESS = [0x7a3a4a, 0x2f6a6a, 0xa0703a, 0x5a4a7a, 0x8a4a3a, 0x3a5a4a, 0xb08a6a, 0x6a3a5a, 0x2e4a6a, 0xc0907a];
const SKIRT = [0x4a3040, 0x3a3a4a, 0x5a4030, 0x2a3a4a, 0x6a4a5a, 0x4a4a3a];
const ACCENT = [0xc9a24a, 0xa83a32, 0xe6dcc6, 0x3a6a5a, 0x7a2a3a, 0xd8b890, 0x2a2a2a, 0x8a6aa0];
const WORK = [0x4a5a6a, 0x6a5a48, 0x5a4a3a, 0x3a4a5a, 0x7a6a50];
const APRON = [0xd8ccb4, 0xb8a888, 0x8a6a4a, 0xe6ddd0, 0x6a4a36];

export function makePerson(r, forceKind) {
  const kind = forceKind || r.weighted([['gent', 30], ['lady', 30], ['worker', 18], ['market', 10], ['child', 12]]);
  const p = { kind, skin: hex(r.pick(SKIN)), face: r.int(0, 31), prop: 0, hat: 0 };
  switch (kind) {
    case 'gent':
      p.colA = hex(r.pick(COAT)); p.colB = hex(r.pick(TROUS)); p.colC = hex(r.pick(ACCENT));
      p.hat = r.weighted([[1, 5], [2, 3], [3, 1], [0, 1]]);
      p.prop = r.weighted([[0, 5], [1, 3], [2, 2], [3, 1]]);
      p.height = r.range(0.96, 1.08); p.width = r.range(0.92, 1.15);
      break;
    case 'lady':
      p.colA = hex(r.pick(DRESS)); p.colB = r.chance(0.5) ? p.colA.map((c) => c * 0.8) : hex(r.pick(SKIRT)); p.colC = hex(r.pick(ACCENT.concat(DRESS)));
      p.hat = r.weighted([[5, 5], [4, 2], [0, 1]]);
      p.prop = r.weighted([[0, 5], [1, 2], [2, 2], [3, 2]]);
      p.height = r.range(0.92, 1.02); p.width = r.range(0.9, 1.05);
      break;
    case 'worker':
      p.colA = hex(r.pick(WORK)); p.colB = hex(r.pick(TROUS)); p.colC = hex(r.pick(APRON));
      p.hat = r.weighted([[3, 5], [2, 1], [0, 2]]);
      p.height = r.range(0.95, 1.07); p.width = r.range(1.0, 1.2);
      break;
    case 'market':
      p.colA = hex(r.pick(DRESS)); p.colB = hex(r.pick(SKIRT)); p.colC = hex(r.pick(APRON));
      p.hat = r.weighted([[4, 5], [0, 2]]);
      p.prop = r.weighted([[1, 3], [0, 2]]);
      p.height = r.range(0.9, 1.0); p.width = r.range(1.05, 1.25);
      break;
    default:
      p.colA = hex(r.pick(COAT.concat(DRESS))); p.colB = hex(r.pick(TROUS)); p.colC = hex(r.pick(ACCENT));
      p.hat = r.weighted([[3, 3], [0, 2]]);
      p.height = r.range(0.66, 0.78); p.width = r.range(0.95, 1.1);
  }
  return p;
}
