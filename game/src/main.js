// Aurelia Nights — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { AMMO_START, BEST_KEY, CAR, CITY, MONEY_START, PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideBuildings, isInWater } from './city.js';
import { collideCarWithWorld, collideCars, createCar, drivePlayerCar, spawnParkedCars, spawnTraffic, updateTrafficCar } from './vehicles.js';
import { knockDownPedestrian, makePedestrian, spawnPedestrians, updatePedestrian } from './pedestrians.js';
import { addHeat, checkBusted, decayWanted, maintainPolice, updatePoliceCar } from './police.js';
import { createMissionState, currentDialog, currentObjective, loadProgress, saveProgress, startMission, startSideJob, updateMissions } from './missions.js';
import { playerPunch, playerShoot, resolveBulletHits, spawnParticles, updateBullets, updateParticles } from './combat.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const audio = createAudio();

/** Build a fresh game: the city, the traffic, the people, and Kai at the garage. */
export function createGame() {
  const city = buildCity(rng);
  const cars = [...spawnParkedCars(rng, city), ...spawnTraffic(rng, 14)];
  const peds = spawnPedestrians(rng, city, 26);
  // Kai's own starter car waits on the road by the garage, unlocked.
  const starter = createCar(700, 510, 0, 'sedan', '#ffcf3f');
  starter.driver = 'parked';
  cars.push(starter);
  const game = {
    rng, city, cars, peds,
    audio,
    time: 0,
    clockMinutes: 9 * 60 + 24,
    money: MONEY_START,
    health: PLAYER.health,
    ammo: AMMO_START,
    heat: 0,
    wanted: 0,
    timeSinceCrime: 99,
    bustedTimer: 0,
    player: {
      x: 560, y: 700, angle: -Math.PI / 2,
      car: null, punchCooldown: 0, moving: false,
    },
    camera: { x: 560, y: 700 },
    bullets: [],
    particles: [],
    pickups: [
      { x: 620, y: 560, kind: 'ammo', taken: false },
      { x: 510, y: 1880, kind: 'ammo', taken: false },
      { x: 1430, y: 1370, kind: 'health', taken: false },
    ],
    missions: createMissionState(),
    stats: { missionsDone: 0, carsStolen: 0, pedsHit: 0 },
    toast: '',
    toastUntil: 0,
    dialogLine: null,
    markerTarget: null,
    muzzle: 0,
    ramCooldown: 0,
    overKind: null,
    hasSave: false,
    autoInput: null,
    shake: 0,
  };
  return game;
}

const game = createGame();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

/** The nearest car the player could enter, within reach on foot. */
function nearestEnterableCar(game) {
  const p = game.player;
  let best = null;
  let bestD = 78;
  for (const car of game.cars) {
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(game, car) {
  const p = game.player;
  if (car.driver === 'parked') {
    addHeat(game, 34);
    game.stats.carsStolen += 1;
    game.toast = 'Mobil dicuri! Polisi memperhatikan.';
    game.toastUntil = game.time + 3;
  } else if (car.driver === 'traffic') {
    addHeat(game, 34);
    game.stats.carsStolen += 1;
    game.toast = 'Kau membajak mobil di jalan!';
    game.toastUntil = game.time + 3;
  }
  car.driver = 'player';
  car.speed = 0;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  audio.carDoor();
}

function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const sideX = car.x - Math.sin(car.angle) * 36;
  const sideY = car.y + Math.cos(car.angle) * 36;
  p.x = sideX;
  p.y = sideY;
  p.angle = car.angle;
  p.car = null;
  audio.carDoor();
}

function updatePlayerOnFoot(game, input, dt) {
  const p = game.player;
  const mx = input.moveX();
  const my = input.moveY();
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    const speed = PLAYER.walkSpeed;
    const dx = (mx / len) * speed * dt;
    const dy = (my / len) * speed * dt;
    p.angle = Math.atan2(dy, dx);
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!collideBuildings(game.city, nx, p.y, PLAYER.radius) && !isInWater(game.city, nx, p.y)) p.x = nx;
    if (!collideBuildings(game.city, p.x, ny, PLAYER.radius) && !isInWater(game.city, p.x, ny)) p.y = ny;
    p.x = Math.max(20, Math.min(CITY.width - 20, p.x));
    p.y = Math.max(20, Math.min(CITY.height - 20, p.y));
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
}

function updatePlayerCar(game, input, dt) {
  const p = game.player;
  const car = p.car;
  const prevX = car.x;
  const prevY = car.y;
  drivePlayerCar(car, input, dt);
  if (collideCarWithWorld(game.city, car, prevX, prevY) && Math.abs(car.speed) > 200) {
    audio.crash();
    spawnParticles(game, car.x, car.y, '#c9c2b2', 8);
    game.shake = 0.25;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Running over a pedestrian is a crime.
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 90) {
      knockDownPedestrian(ped);
      addHeat(game, 30);
      game.stats.pedsHit += 1;
      audio.crash();
      spawnParticles(game, ped.x, ped.y, '#e05a5a', 12);
      game.toast = 'Kau menabrak pejalan kaki! Wanted naik!';
      game.toastUntil = game.time + 3;
      car.speed *= 0.6;
    }
  }
}

/** One fixed simulation step: every system advances, in dependency order. */
export function stepWorld(game, input, dt) {
  game.time += dt;
  game.clockMinutes += dt * 0.5;
  if (game.muzzle > 0) game.muzzle -= dt;
  if (game.shake > 0) game.shake -= dt;

  const p = game.player;
  if (p.car) updatePlayerCar(game, input, dt);
  else updatePlayerOnFoot(game, input, dt);

  // Traffic and police.
  updateTraffic(game, dt);
  maintainPolice(game, game.rng, dt);
  for (const car of game.cars) {
    if (car.driver === 'police') updatePoliceCar(car, game, game.rng, dt);
  }
  // Car-on-car bumps.
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      if (collideCars(game.cars[i], game.cars[j])) {
        if (game.cars[i].driver === 'player' || game.cars[j].driver === 'player') {
          if (Math.abs(game.cars[i].speed) + Math.abs(game.cars[j].speed) > 300) {
            audio.crash();
            game.shake = 0.2;
          }
        }
      }
    }
  }
  // Police ramming hurts the player.
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 46 && game.ramCooldown <= 0) {
      game.ramCooldown = 0.9;
      game.health -= p.car ? 6 : 12;
      audio.crash();
      game.shake = 0.35;
      spawnParticles(game, p.x, p.y, '#e5484d', 10);
      if (!p.car) {
        p.x += (p.x - car.x) * 0.2;
        p.y += (p.y - car.y) * 0.2;
      }
    }
  }
  if (game.ramCooldown > 0) game.ramCooldown -= dt;

  // Pedestrians, respawning the ones who got up and walked off.
  for (const ped of game.peds) updatePedestrian(ped, game.rng, game.city, game, dt);
  if (game.peds.length < 22 && game.time % 1 < dt) {
    const ped = makePedestrian(game.rng, game.city);
    if (ped) game.peds.push(ped);
  }
  game.peds = game.peds.filter((ped) => !(ped.state === 'down' && ped.stateTimer <= 0 && Math.hypot(ped.x - p.x, ped.y - p.y) > 900));

  // Bullets, particles, pickups.
  updateBullets(game, dt);
  resolveBulletHits(game);
  updateParticles(game, dt);
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 42) {
      pickup.taken = true;
      if (pickup.kind === 'ammo') {
        game.ammo += 24;
        game.toast = 'Amunisi +24';
      } else {
        game.health = Math.min(100, game.health + 40);
        game.toast = 'Nyawa +40';
      }
      game.toastUntil = game.time + 2;
      audio.pickup();
    }
  }

  // Wanted, health, missions, dialog, camera.
  decayWanted(game, dt);
  if (game.wanted === 0 && game.health < PLAYER.health) game.health = Math.min(PLAYER.health, game.health + 2 * dt);
  if (game.missions) updateMissions(game, game.rng, dt);
  game.dialogLine = game.missions ? currentDialog(game) : null;
  const objective = game.missions ? currentObjective(game) : { target: null };
  game.markerTarget = objective.target || null;

  const cam = game.camera;
  cam.x += (p.x - cam.x) * Math.min(1, dt * 4);
  cam.y += (p.y - cam.y) * Math.min(1, dt * 4);
  if (game.shake > 0) {
    cam.x += (Math.random() - 0.5) * game.shake * 30;
    cam.y += (Math.random() - 0.5) * game.shake * 30;
  }

  const playerSpeed = p.car ? p.car.speed : 0;
  audio.updateEngine(playerSpeed, Boolean(p.car), dt);
  audio.updateSiren(game.wanted, dt);
}

function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver !== 'traffic') continue;
    updateTrafficCar(car, game.rng, dt, game.cars);
  }
}

function runShot(name) {
  const renderer = createRenderer(canvas);
  const scene = stageShot(name, game, stepWorld, rng);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  game.hasSave = Boolean(loadProgress());
  let screen = SCREEN_TITLE;
  let best = readBest();
  // Debug hook for automated play-tests (read-only state snapshot).
  window.__gameDebug = () => ({
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
    inCar: Boolean(game.player.car),
    carSpeed: game.player.car ? Math.round(game.player.car.speed) : 0,
    wanted: game.wanted,
    money: game.money,
    health: Math.round(game.health),
    ammo: game.ammo,
    mission: game.missions.index,
    missionActive: game.missions.active,
    screen,
    cars: game.cars.length,
    peds: game.peds.length,
    cops: game.cars.filter((c) => c.driver === 'police').length,
  });
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFresh() {
    const fresh = createGame();
    Object.assign(game, fresh);
    game.hasSave = false;
    screen = SCREEN_PLAY;
    announce('Bermain. Pergi ke Garasi Rico — tekan F untuk mulai misi pertama.');
  }

  function continueSave() {
    const save = loadProgress();
    if (!save) {
      startFresh();
      return;
    }
    game.money = save.money;
    game.health = save.health;
    game.ammo = save.ammo;
    game.player.x = save.x;
    game.player.y = save.y;
    game.camera.x = save.x;
    game.camera.y = save.y;
    game.clockMinutes = save.clock || game.clockMinutes;
    game.stats.missionsDone = save.missionsDone || 0;
    game.missions.index = save.missionIndex || 0;
    game.missions.active = false;
    screen = SCREEN_PLAY;
    announce('Lanjutan dimuat. Tekan F untuk misi berikutnya.');
  }

  function endGame(kind) {
    game.overKind = kind;
    screen = SCREEN_OVER;
    audio.busted();
    if (game.money > best) {
      best = game.money;
      saveBest(best);
    }
    saveProgress(game);
    announce(kind === 'busted' ? 'Tertangkap polisi.' : 'Kau tumbang.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || clicked) {
        audio.unlock();
        if (game.hasSave) continueSave();
        else startFresh();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM || clicked) startFresh();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Jeda.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Bermain.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER_CAR) {
      if (game.player.car) exitCar(game);
      else {
        const car = nearestEnterableCar(game);
        if (car) enterCar(game, car);
      }
    }
    if (actions & ACTION_PUNCH && !game.player.car) playerPunch(game);
    if (actions & ACTION_INTERACT && game.missions) {
      if (game.missions.sideJob) {
        // Already on a side job: F does nothing.
      } else if (!game.missions.active && game.missions.index < 5) {
        startMission(game, game.missions.index);
      } else if (!game.missions.active && game.missions.index >= 5) {
        startSideJob(game, game.rng);
      }
    }
    if (clicked && !game.player.car && screen === SCREEN_PLAY) {
      const mouse = input.mouse();
      const view = renderer.view;
      const worldX = game.camera.x + (mouse.x - view.width / 2) / view.scale;
      const worldY = game.camera.y + (mouse.y - view.height / 2) / view.scale;
      playerShoot(game, worldX, worldY);
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const effectiveInput = game.autoInput || input;
    stepWorld(game, effectiveInput, STEP);
    if (game.health <= 0) endGame('wasted');
    else if (checkBusted(game, STEP)) endGame('busted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') audio.toggleMute();
    if (event.code === 'KeyN' && screen === SCREEN_TITLE) {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch { /* ignore */ }
      game.hasSave = false;
      startFresh();
    }
    if (event.code === 'KeyR' && screen === SCREEN_PAUSED) continueSave();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Aurelia Nights. Tekan Enter atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
