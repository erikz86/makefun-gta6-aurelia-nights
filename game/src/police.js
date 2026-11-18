// The wanted system and the police: heat rises with every crime, stars follow the
// heat, and police cars spawn on the road grid and chase the player. Get caught on
// foot or rammed to a stop and it is over — BUSTED.

import { CAR, WANTED } from './config.js';
import { nearestNode, nodePoint } from './city.js';
import { createCar, turnToward } from './vehicles.js';

/** Stars shown on the HUD, 0 to 5, from the heat value. */
export function starsFromHeat(heat) {
  return Math.min(WANTED.maxStars, Math.ceil(heat / WANTED.heatPerStar));
}

export function addHeat(game, amount) {
  game.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar, game.heat + amount);
  game.wanted = starsFromHeat(game.heat);
  game.timeSinceCrime = 0;
}

/** Heat cools off when the player lies low and no police car is close. */
export function decayWanted(game, dt) {
  game.timeSinceCrime += dt;
  const nearestCop = nearestCopDistance(game);
  if (game.timeSinceCrime > WANTED.decayDelay && (nearestCop === null || nearestCop > 520)) {
    const rate = game.wanted >= 3 ? WANTED.decayPerSecond * 0.45 : WANTED.decayPerSecond;
    game.heat = Math.max(0, game.heat - rate * dt);
    game.wanted = starsFromHeat(game.heat);
  }
}

export function nearestCopDistance(game) {
  let best = null;
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (best === null || d < best) best = d;
  }
  return best;
}

/** Keep the number of police cars on the road equal to the wanted level. */
export function maintainPolice(game, rng, dt) {
  const cops = game.cars.filter((c) => c.driver === 'police');
  if (game.wanted === 0) {
    for (const cop of cops) {
      // No wanted level: the police drive off and despawn.
      cop.despawn = (cop.despawn || 0) + dt;
    }
    game.cars = game.cars.filter((c) => !(c.driver === 'police' && (c.despawn || 0) > 4));
    return;
  }
  const want = Math.min(game.wanted, 5);
  if (cops.length < want) {
    const cop = spawnCopCar(game, rng);
    if (cop) game.cars.push(cop);
  }
}

function spawnCopCar(game, rng) {
  // Spawn on a road two or three intersections away, never right on top of the player.
  const node = nearestNode(game.player.x, game.player.y);
  for (let tries = 0; tries < 12; tries += 1) {
    const ix = Math.max(0, Math.min(7, node.ix + rng.int(-3, 3)));
    const iy = Math.max(0, Math.min(5, node.iy + rng.int(-3, 3)));
    const p = nodePoint(ix, iy);
    const d = Math.hypot(p.x - game.player.x, p.y - game.player.y);
    if (d < 550 || d > 1400) continue;
    if (game.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 90)) continue;
    const cop = createCar(p.x, p.y, 0, 'police', '#1f3a8a');
    cop.driver = 'police';
    cop.speed = 200;
    cop.targetNode = { ix, iy };
    return cop;
  }
  return null;
}

/** A police car chases along the road grid, then rams the player up close. */
export function updatePoliceCar(cop, game, rng, dt) {
  const px = game.player.x;
  const py = game.player.y;
  const dist = Math.hypot(px - cop.x, py - cop.y);
  const playerNode = nearestNode(px, py);
  const copNode = nearestNode(cop.x, cop.y);

  if (dist < 260) {
    // Close in: steer straight at the player and ram.
    const wantAngle = Math.atan2(py - cop.y, px - cop.x);
    cop.angle = turnToward(cop.angle, wantAngle, 3.4 * dt);
    cop.speed += (CAR.copSpeed - cop.speed) * Math.min(1, dt * 1.2);
  } else {
    // Far: drive the grid toward the player's intersection.
    if (!cop.targetNode || (Math.hypot(nodePoint(cop.targetNode.ix, cop.targetNode.iy).x - cop.x,
      nodePoint(cop.targetNode.ix, cop.targetNode.iy).y - cop.y) < 30)) {
      cop.targetNode = nextNodeToward(copNode, playerNode, rng);
    }
    const target = nodePoint(cop.targetNode.ix, cop.targetNode.iy);
    const wantAngle = Math.atan2(target.y - cop.y, target.x - cop.x);
    cop.angle = turnToward(cop.angle, wantAngle, 3.4 * dt);
    cop.speed += (CAR.copSpeed * 0.92 - cop.speed) * Math.min(1, dt * 1.2);
  }
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  cop.sirenPhase = (cop.sirenPhase || 0) + dt;
}

function nextNodeToward(from, to, rng) {
  const options = [];
  if (to.ix > from.ix) options.push({ ix: from.ix + 1, iy: from.iy });
  if (to.ix < from.ix) options.push({ ix: from.ix - 1, iy: from.iy });
  if (to.iy > from.iy) options.push({ ix: from.ix, iy: from.iy + 1 });
  if (to.iy < from.iy) options.push({ ix: from.ix, iy: from.iy - 1 });
  if (options.length === 0) return { ix: from.ix, iy: from.iy };
  // Prefer the axis with the bigger gap, but sometimes take the other road.
  options.sort((a, b) => {
    const da = Math.abs(a.ix - to.ix) + Math.abs(a.iy - to.iy);
    const db = Math.abs(b.ix - to.ix) + Math.abs(b.iy - to.iy);
    return da - db;
  });
  return rng.next() < 0.75 ? options[0] : options[Math.floor(rng.next() * options.length)];
}

/** Busted check: caught on foot by a close cop, or rammed to a stop in a car. */
export function checkBusted(game, dt) {
  if (game.wanted === 0) {
    game.bustedTimer = 0;
    return false;
  }
  const player = game.player;
  let caught = false;
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (!player.car && d < 62) caught = true;
    if (player.car && d < 44 && Math.abs(player.car.speed) < 60) caught = true;
  }
  if (caught) {
    game.bustedTimer += dt;
    if (game.bustedTimer > 1.6) return true;
  } else {
    game.bustedTimer = Math.max(0, game.bustedTimer - dt * 2);
  }
  return false;
}
