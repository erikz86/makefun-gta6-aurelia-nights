// Vehicles: the player's car physics, parked cars to steal, and AI traffic that
// follows the road grid from intersection to intersection.

import { CAR, CITY } from './config.js';
import { collideBuildings, isInWater, nodePoint } from './city.js';

const TRAFFIC_COLOURS = ['#d8d8d8', '#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#5d6d7e', '#f5f5f5', '#1abc9c'];
const CAR_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport'];

let nextCarId = 1;

export function createCar(x, y, angle, kind, colour) {
  return {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    kind: kind || 'sedan',
    colour: colour || '#d8d8d8',
    driver: 'parked', // parked | traffic | player | police
    health: 100,
    targetNode: null,
    lane: 0,
    stuckTimer: 0,
    brakeLight: false,
    smoke: 0,
  };
}

/** Parked cars along the roads and in the plaza car park, ready to be stolen. */
export function spawnParkedCars(rng, city) {
  const cars = [];
  const spots = [];
  for (let i = 0; i < 26; i += 1) {
    const vertical = rng.next() < 0.5;
    const rx = rng.pick(CITY.roadX);
    const ry = rng.pick(CITY.roadY);
    const along = rng.range(140, CITY.width - 140);
    const x = vertical ? rx + 34 : along;
    const y = vertical ? along : ry + 34;
    if (x < 90 || y < 90 || x > CITY.width - 90 || y > CITY.height - 90) continue;
    if (collideBuildings(city, x, y, 34)) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < 90)) continue;
    spots.push({ x, y });
    const car = createCar(x, y, vertical ? Math.PI / 2 : 0, rng.pick(CAR_TYPES), rng.pick(TRAFFIC_COLOURS));
    car.driver = 'parked';
    cars.push(car);
  }
  return cars;
}

/** Traffic cars that drive the grid; they pick a new intersection when they arrive. */
export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const ix = rng.int(0, CITY.roadX.length - 1);
    const iy = rng.int(0, CITY.roadY.length - 1);
    const p = nodePoint(ix, iy);
    const car = createCar(p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng.pick(CAR_TYPES), rng.pick(TRAFFIC_COLOURS));
    car.driver = 'traffic';
    car.speed = CAR.trafficSpeed * rng.range(0.8, 1.15);
    car.lane = rng.next() < 0.5 ? -16 : 16;
    car.targetNode = pickNextNode(rng, ix, iy, -1, -1);
    cars.push(car);
  }
  return cars;
}

function pickNextNode(rng, ix, iy, fromIx, fromIy) {
  const options = [];
  if (ix > 0 && !(ix - 1 === fromIx && iy === fromIy)) options.push({ ix: ix - 1, iy });
  if (ix < CITY.roadX.length - 1 && !(ix + 1 === fromIx && iy === fromIy)) options.push({ ix: ix + 1, iy });
  if (iy > 0 && !(ix === fromIx && iy - 1 === fromIy)) options.push({ ix, iy: iy - 1 });
  if (iy < CITY.roadY.length - 1 && !(ix === fromIx && iy + 1 === fromIy)) options.push({ ix, iy: iy + 1 });
  if (options.length === 0) return { ix: fromIx, iy: fromIy };
  return options[Math.floor(rng.next() * options.length)];
}

/** One traffic car follows its lane toward its target intersection. */
export function updateTrafficCar(car, rng, dt, cars) {
  if (!car.targetNode) return;
  const target = nodePoint(car.targetNode.ix, car.targetNode.iy);
  // Lane offset: keep right, like real traffic.
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const movingX = Math.abs(dx) > Math.abs(dy);
  const laneX = movingX ? target.x : target.x + (dy >= 0 ? car.lane : -car.lane);
  const laneY = movingX ? target.y + (dx >= 0 ? -car.lane : car.lane) : target.y;
  const tx = laneX - car.x;
  const ty = laneY - car.y;
  const wantAngle = Math.atan2(ty, tx);
  car.angle = turnToward(car.angle, wantAngle, 3.2 * dt);

  // Slow down for the car ahead so traffic bunches up at busy corners.
  let ahead = Infinity;
  for (const other of cars) {
    if (other === car || other.driver === 'parked') continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const forward = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (forward > 0 && forward < 110 && side < 26) ahead = Math.min(ahead, forward);
  }
  const wantSpeed = ahead < 70 ? 0 : CAR.trafficSpeed;
  car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (dist < 26) {
    const from = { ix: car.targetNode.ix, iy: car.targetNode.iy };
    const prev = car.lastNode || { ix: -1, iy: -1 };
    car.lastNode = from;
    car.targetNode = pickNextNode(rng, from.ix, from.iy, prev.ix, prev.iy);
  }
}

/** Drive the player's car: W/S accelerate and brake, A/D steer, with simple drift. */
export function drivePlayerCar(car, input, dt) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const speedAlong = car.speed;
  if (input.up()) car.speed += CAR.accel * dt;
  if (input.down()) {
    if (speedAlong > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  if (!input.up() && !input.down()) car.speed -= car.speed * CAR.drag * dt * 0.6;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const steerInput = (input.left() ? -1 : 0) + (input.right() ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
  const direction = car.speed >= 0 ? 1 : -1;
  car.angle += steerInput * CAR.steer * steerAuthority * direction * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = input.down() && speedAlong > 20;
  return { forward, right };
}

/** Keep a car out of buildings, water and the city edge; returns true on a hard hit. */
export function collideCarWithWorld(city, car, prevX, prevY) {
  let hit = false;
  if (car.x < 40) { car.x = 40; hit = true; }
  if (car.y < 40) { car.y = 40; hit = true; }
  if (car.x > CITY.width - 40) { car.x = CITY.width - 40; hit = true; }
  if (car.y > CITY.height - 40) { car.y = CITY.height - 40; hit = true; }
  const b = collideBuildings(city, car.x, car.y, 26);
  if (b || isInWater(city, car.x, car.y)) {
    car.x = prevX;
    car.y = prevY;
    car.speed *= 0.35;
    hit = true;
  }
  return hit;
}

/** Two cars bumping: both slow down and push apart. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = 46;
  if (dist > 0 && dist < min) {
    const push = (min - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    const swap = a.speed;
    a.speed = b.speed * 0.4;
    b.speed = swap * 0.4;
    return true;
  }
  return false;
}

export function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}

export function angleDiff(a, b) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
