// Fixed layout of Dampfstadt: streets, squares and the hero route anchors that the
// story, camera and city generator all refer to (metres, north = -z).
export const CITY = {
  facadeX: 8.4,                 // market street facade line (x = +-8.4)
  market: { road: 10, walk: 3.4, z0: -152, z1: 128 },
  cross: { z: -30, road: 11, walk: 3.0, half: 8.5 },
  alley: { z: -100, w: 6 },
  square: { x0: -72, x1: 72, z0: -214, z1: -152 },
  tower: { x: 0, z: -232 },
  domeHouse: { x: -60, z: -186 },
  factory: { x0: 170, x1: 430, z0: -170, z1: 170 },
  mast: { x: 175, z: -330 },
  // hero route anchors
  kiosk: { x: 6.3, z: 112 },
  cart: { x: -1.2, z: 44 },
  awning: { x: 6.1, z: 14 },
  hide: { x: -6.8, z: -8 },
  crates: { x: 7.3, z: -41 },
  ladder: { x: 8.42, z: -42.5 },
  hatch: { x: 15.2, z: -112.5 },
  heart: { x: 0, y: -150, z: -170 },
};

// secondary street grid (centre lines). Market street is x = 0, cross street z = -30.
export const NS_STREETS = [-372, -292, -212, -132, -54, 0, 54, 134, 214, 294, 374];
export const EW_STREETS = [-452, -372, -292, -214, -152, -100, -30, 50, 128, 208, 288, 368];
export const streetHalf = (kind, v) => {
  if (kind === 'ns') return v === 0 ? 8.4 : 6.6;
  if (v === -30) return 8.5;
  if (v === -100) return 3.0;
  if (v === -152 || v === -214) return 0.0;
  if (v === 128) return 7.0;
  return 6.6;
};
