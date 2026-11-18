// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one sets up a
// real game state — a car, a wanted level, an active mission — then plays the real
// rules forward for a fixed number of steps, steered by a small autopilot, so the
// frame is what a short game really looks like and the same seed always gives the
// same frame.

import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DRIVE_SECONDS = 8;
const CHASE_SECONDS = 7;
const MISSION_SECONDS = 5;
const START_SECONDS = 6;

/** A fake input the autopilot writes into every step: gas, steering, walking. */
function createAutoInput() {
  const state = { up: false, down: false, left: false, right: false, mx: 0, my: 0 };
  return {
    state,
    moveX() { return state.mx; },
    moveY() { return state.my; },
    up() { return state.up; },
    down() { return state.down; },
    left() { return state.left; },
    right() { return state.right; },
    takeActions() { return 0; },
    mouse() { return { x: 0, y: 0 }; },
    takeClick() { return false; },
  };
}

/** Steer the player's car toward a point on the road, at full gas. */
function autopilotDrive(game, auto, target) {
  const car = game.player.car;
  if (!car) return;
  const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  auto.state.up = true;
  auto.state.down = false;
  auto.state.left = diff < -0.08;
  auto.state.right = diff > 0.08;
}

/** Walk the player on foot toward a point. */
function autopilotWalk(game, auto, target) {
  const p = game.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  auto.state.mx = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
  auto.state.my = Math.abs(dy) > 12 ? Math.sign(dy) : 0;
}

/** Put the player behind the wheel of a fresh car at a road point. */
function putPlayerInCar(game, x, y, angle, colour) {
  const car = createCar(x, y, angle, 'sport', colour);
  car.driver = 'player';
  game.cars.push(car);
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

function runSteps(game, stepWorld, auto, seconds, steer) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (steer) steer();
    stepWorld(game, auto, STEP);
  }
  game.autoInput = null;
}

/**
 * Set `game` to the named scene (start, drive, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, game, stepWorld, rng) {
  const auto = createAutoInput();
  game.autoInput = auto;
  game.clockMinutes = 17 * 60 + 25;
  game.hasSave = false;

  if (name === 'drive') {
    game.money = 1250;
    putPlayerInCar(game, 700, 970, 0, '#e67e22');
    startMission(game, 1);
    game.missions.dialogIndex = 0;
    game.missions.dialogUntil = game.time + 9;
    runSteps(game, stepWorld, auto, DRIVE_SECONDS, () => autopilotDrive(game, auto, { x: 2900, y: 970 }));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    game.money = 1840;
    game.health = 78;
    putPlayerInCar(game, 1000, 1430, 0, '#ffcf3f');
    startMission(game, 3);
    addHeat(game, 55);
    runSteps(game, stepWorld, auto, CHASE_SECONDS, () => autopilotDrive(game, auto, { x: 2900, y: 1430 }));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    game.money = 640;
    game.player.x = 1890;
    game.player.y = 1650;
    game.player.angle = -Math.PI / 2;
    game.camera.x = 1890;
    game.camera.y = 1560;
    startMission(game, 4);
    game.missions.dialogIndex = 0;
    game.missions.dialogUntil = game.time + 9;
    runSteps(game, stepWorld, auto, MISSION_SECONDS, () => autopilotWalk(game, auto, { x: 1890, y: 1480 }));
    return { screen: SCREEN_PLAY };
  }

  // start: the title screen over a living city — traffic moving, people walking.
  game.player.x = 1430;
  game.player.y = 1370;
  game.player.angle = Math.PI / 2;
  game.camera.x = 1430;
  game.camera.y = 1370;
  const idle = createAutoInput();
  runSteps(game, stepWorld, idle, START_SECONDS, null);
  return { screen: SCREEN_TITLE };
}
