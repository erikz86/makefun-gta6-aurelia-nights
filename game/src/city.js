// The city of Port Aurelia: a road grid with blocks of buildings, parks, a harbour
// and a plaza. Generation is seeded, so the same seed always builds the same city.
// Everything the other systems need — road tests, building collision, named places —
// lives here.

import { CITY, PALETTE } from './config.js';

const BLOCK_COLS = 7;
const BLOCK_ROWS = 5;

/** True when the point is on a road (asphalt), not inside a block. */
export function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x > CITY.width || y > CITY.height) return false;
  for (const rx of CITY.roadX) if (Math.abs(x - rx) <= CITY.roadWidth / 2) return true;
  for (const ry of CITY.roadY) if (Math.abs(y - ry) <= CITY.roadWidth / 2) return true;
  return false;
}

/** The nearest point on a road centre line, used to snap traffic and police to roads. */
export function nearestRoadPoint(x, y) {
  let bestX = CITY.roadX[0];
  let bestDx = Math.abs(x - bestX);
  for (const rx of CITY.roadX) {
    const d = Math.abs(x - rx);
    if (d < bestDx) { bestDx = d; bestX = rx; }
  }
  let bestY = CITY.roadY[0];
  let bestDy = Math.abs(y - bestY);
  for (const ry of CITY.roadY) {
    const d = Math.abs(y - ry);
    if (d < bestDy) { bestDy = d; bestY = ry; }
  }
  return bestDx <= bestDy ? { x: bestX, y } : { x, y: bestY };
}

/** The road intersection nearest to a point, as grid indices. */
export function nearestNode(x, y) {
  let ix = 0;
  let best = Infinity;
  CITY.roadX.forEach((rx, i) => {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; ix = i; }
  });
  let iy = 0;
  best = Infinity;
  CITY.roadY.forEach((ry, i) => {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; iy = i; }
  });
  return { ix, iy };
}

export function nodePoint(ix, iy) {
  return { x: CITY.roadX[ix], y: CITY.roadY[iy] };
}

/** Build the whole city from a seeded random: buildings, parks, trees and water. */
export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const water = [];

  for (let col = 0; col < BLOCK_COLS; col += 1) {
    for (let row = 0; row < BLOCK_ROWS; row += 1) {
      const x0 = CITY.roadX[col] + CITY.roadWidth / 2 + 12;
      const y0 = CITY.roadY[row] + CITY.roadWidth / 2 + 12;
      const x1 = CITY.roadX[col + 1] - CITY.roadWidth / 2 - 12;
      const y1 = CITY.roadY[row + 1] - CITY.roadWidth / 2 - 12;
      const bw = x1 - x0;
      const bh = y1 - y0;

      // South-east block is the harbour: open water with jetties, no buildings.
      if (col === 6 && row === 4) {
        water.push({ x: x0 - 12, y: y0 - 12, w: bw + 24, h: bh + 24 });
        continue;
      }
      // One block is the central plaza, one a park, one a leafy square.
      if ((col === 3 && row === 2) || (col === 1 && row === 3) || (col === 5 && row === 1)) {
        parks.push({ x: x0 - 12, y: y0 - 12, w: bw + 24, h: bh + 24 });
        const count = rng.int(9, 14);
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: rng.range(x0 + 10, x1 - 10),
            y: rng.range(y0 + 10, y1 - 10),
            r: rng.range(9, 15),
          });
        }
        continue;
      }

      // Ordinary blocks: one to three buildings with a roof colour and a height.
      const count = rng.int(1, 3);
      if (count === 1) {
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, bw - 16, bh - 16));
      } else if (count === 2) {
        const vertical = bw > bh;
        if (vertical) {
          buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, bw / 2 - 10, bh - 12));
          buildings.push(makeBuilding(rng, x0 + bw / 2 + 4, y0 + 6, bw / 2 - 10, bh - 12));
        } else {
          buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, bw - 12, bh / 2 - 10));
          buildings.push(makeBuilding(rng, x0 + 6, y0 + bh / 2 + 4, bw - 12, bh / 2 - 10));
        }
      } else {
        const hw = bw / 2;
        const hh = bh / 2;
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, hw - 12, hh - 12));
        buildings.push(makeBuilding(rng, x0 + hw + 6, y0 + 6, hw - 12, hh - 12));
        buildings.push(makeBuilding(rng, x0 + 6, y0 + hh + 6, bw - 12, hh - 12));
      }
    }
  }

  // A few street trees along the main avenue.
  for (let i = 0; i < 26; i += 1) {
    trees.push({
      x: rng.range(120, CITY.width - 120),
      y: CITY.roadY[2] - 62 + (rng.next() < 0.5 ? 0 : 124),
      r: rng.range(8, 12),
    });
  }

  return { buildings, trees, parks, water };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    height: rng.int(1, 4),
    roof: rng.pick(PALETTE.buildingRoof),
    wall: rng.pick(PALETTE.buildingWall),
    seed: rng.int(0, 9999),
  };
}

/** Push a circle out of every building it overlaps; returns true when it hit one. */
export function collideBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

/** True when the point is in harbour water (cars and people cannot go there). */
export function isInWater(city, x, y) {
  for (const w of city.water) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  }
  return false;
}
