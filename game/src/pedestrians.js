// Pedestrians: people walking the sidewalks of Port Aurelia. They stroll between
// nearby corners, flee from gunfire and speeding cars, and fall down when hit.

import { CITY, PALETTE } from './config.js';
import { collideBuildings, isInWater, isOnRoad } from './city.js';

const NAMES = ['Ana', 'Bruno', 'Carla', 'Dario', 'Elena', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jorge', 'Lena', 'Marco', 'Nina', 'Oscar', 'Paula', 'Rosa', 'Tomas', 'Vera'];

export function spawnPedestrians(rng, city, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const ped = makePedestrian(rng, city);
    if (ped) peds.push(ped);
  }
  return peds;
}

export function makePedestrian(rng, city) {
  for (let tries = 0; tries < 20; tries += 1) {
    const vertical = rng.next() < 0.5;
    const road = vertical ? rng.pick(CITY.roadX) : rng.pick(CITY.roadY);
    const along = rng.range(120, (vertical ? CITY.height : CITY.width) - 120);
    const side = rng.pick([-68, 68]);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    if (collideBuildings(city, x, y, 16) || isInWater(city, x, y)) continue;
    return {
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 75),
      name: rng.pick(NAMES),
      shirt: rng.pick(PALETTE.pedShirt),
      target: null,
      state: 'walk', // walk | flee | down
      stateTimer: 0,
      panic: 0,
    };
  }
  return null;
}

/** Pick a new nearby sidewalk corner for a pedestrian to stroll toward. */
export function pickStrollTarget(rng, ped) {
  const vertical = rng.next() < 0.5;
  const road = vertical
    ? CITY.roadX[Math.floor(rng.next() * CITY.roadX.length)]
    : CITY.roadY[Math.floor(rng.next() * CITY.roadY.length)];
  const along = rng.range(120, (vertical ? CITY.height : CITY.width) - 120);
  const side = rng.pick([-68, 68]);
  return {
    x: vertical ? road + side : along,
    y: vertical ? along : road + side,
  };
}

export function updatePedestrian(ped, rng, city, game, dt) {
  if (ped.state === 'down') {
    ped.stateTimer -= dt;
    return;
  }
  // Fleeing: run away from the threat, then calm down.
  if (ped.state === 'flee') {
    ped.stateTimer -= dt;
    const dx = ped.x - game.player.x;
    const dy = ped.y - game.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    movePed(ped, city, Math.cos(ped.angle) * 150 * dt, Math.sin(ped.angle) * 150 * dt);
    if (ped.stateTimer <= 0) ped.state = 'walk';
    return;
  }
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
    ped.target = pickStrollTarget(rng, ped);
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  ped.angle = Math.atan2(dy, dx);
  movePed(ped, city, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt);
}

function movePed(ped, city, dx, dy) {
  const nx = ped.x + dx;
  const ny = ped.y + dy;
  if (!collideBuildings(city, nx, ped.y, 12) && !isInWater(city, nx, ped.y)) ped.x = nx;
  if (!collideBuildings(city, ped.x, ny, 12) && !isInWater(city, ped.x, ny)) ped.y = ny;
  ped.x = Math.max(20, Math.min(CITY.width - 20, ped.x));
  ped.y = Math.max(20, Math.min(CITY.height - 20, ped.y));
}

/** Every pedestrian near a point panics and runs. */
export function scarePedestrians(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
    }
  }
}

/** A pedestrian is knocked down: they lie still, then get up and walk away. */
export function knockDownPedestrian(ped) {
  ped.state = 'down';
  ped.stateTimer = 6;
  ped.speed = 60;
}

export function isPedestrianOnRoad(ped) {
  return isOnRoad(ped.x, ped.y);
}
