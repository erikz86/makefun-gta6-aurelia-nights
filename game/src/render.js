// Rendering: the camera follows the player across Port Aurelia, and every screen —
// title, pause, busted and wasted — is drawn here too. Buildings get a fake-3D
// roof offset, cars get headlights at dusk, and the sun stays warm all day.

import { CITY, FONT, MISSIONS, PALETTE } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.72, Math.min(1.15, viewW / 1280));
  }

  window.addEventListener('resize', resize);
  resize();

  function worldToScreen(x, y, camera) {
    return {
      x: (x - camera.x) * scale + viewW / 2,
      y: (y - camera.y) * scale + viewH / 2,
    };
  }

  return {
    get view() {
      return { width: viewW, height: viewH, scale };
    },
    resize,
    worldToScreen,
    /** Paint the current screen: world + HUD, or a menu screen over the city. */
    draw(game, screen) {
      ctx.clearRect(0, 0, viewW, viewH);
      drawWorld(ctx, game, { viewW, viewH, scale }, worldToScreen);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHud(ctx, game, { width: viewW, height: viewH });
      }
      if (screen === SCREEN_TITLE) drawTitle(ctx, game, viewW, viewH);
      else if (screen === SCREEN_PAUSED) drawPaused(ctx, game, viewW, viewH);
      else if (screen === SCREEN_OVER) drawGameOver(ctx, game, viewW, viewH);
    },
  };
}

function drawWorld(ctx, game, view, worldToScreen) {
  const { viewW, viewH, scale } = view;
  const camera = game.camera;
  const left = camera.x - viewW / 2 / scale - 80;
  const top = camera.y - viewH / 2 / scale - 80;
  const right = camera.x + viewW / 2 / scale + 80;
  const bottom = camera.y + viewH / 2 / scale + 80;

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, viewW, viewH);
  const origin = worldToScreen(0, 0, camera);
  ctx.fillStyle = PALETTE.grassDark;
  for (let gx = 0; gx < CITY.width; gx += 230) {
    for (let gy = 0; gy < CITY.height; gy += 230) {
      if (gx + gy > right || gy > bottom) continue;
      const p = worldToScreen(gx, gy, camera);
      ctx.fillRect(p.x, p.y, 3 * scale, 3 * scale);
    }
  }
  void origin;

  // Harbour water.
  for (const w of game.city.water) {
    const p = worldToScreen(w.x, w.y, camera);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(p.x, p.y, w.w * scale, w.h * scale);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(p.x, p.y + w.h * 0.5 * scale, w.w * scale, 6 * scale);
    ctx.fillRect(p.x, p.y + w.h * 0.8 * scale, w.w * scale, 4 * scale);
  }

  // Parks.
  for (const park of game.city.parks) {
    const p = worldToScreen(park.x, park.y, camera);
    ctx.fillStyle = '#69a854';
    ctx.fillRect(p.x, p.y, park.w * scale, park.h * scale);
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(p.x, p.y, park.w * scale, park.h * scale);
  }

  drawRoads(ctx, camera, worldToScreen, scale, left, top, right, bottom);
  drawTrees(ctx, game, camera, worldToScreen, scale, left, top, right, bottom);
  drawBuildings(ctx, game, camera, worldToScreen, scale, left, top, right, bottom);
  drawMissionMarker(ctx, game, camera, worldToScreen, scale);
  drawPickups(ctx, game, camera, worldToScreen, scale);
  drawCars(ctx, game, camera, worldToScreen, scale, left, top, right, bottom);
  drawPedestrians(ctx, game, camera, worldToScreen, scale, left, top, right, bottom);
  drawPlayer(ctx, game, camera, worldToScreen, scale);
  drawBullets(ctx, game, camera, worldToScreen, scale);
  drawParticles(ctx, game, camera, worldToScreen, scale);

  // Warm sunset wash that deepens as the in-game clock moves toward evening.
  const hour = (game.clockMinutes / 60) % 24;
  const dusk = hour >= 17 || hour < 6 ? 0.10 : hour >= 15 ? 0.05 : 0;
  if (dusk > 0) {
    ctx.fillStyle = `rgba(255, 120, 60, ${dusk})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  // Soft vignette so the HUD reads against the world.
  const vignette = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.45, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(10,10,20,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawRoads(ctx, camera, worldToScreen, scale, left, top, right, bottom) {
  // Asphalt strips.
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of CITY.roadX) {
    const p = worldToScreen(rx - CITY.roadWidth / 2, 0, camera);
    ctx.fillRect(p.x, 0, CITY.roadWidth * scale, 2000);
  }
  for (const ry of CITY.roadY) {
    const p = worldToScreen(0, ry - CITY.roadWidth / 2, camera);
    ctx.fillRect(0, p.y, 2000, CITY.roadWidth * scale);
  }
  // Sidewalks: pale edges along every road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of CITY.roadX) {
    const p1 = worldToScreen(rx - CITY.roadWidth / 2, 0, camera);
    const p2 = worldToScreen(rx + CITY.roadWidth / 2 - 12, 0, camera);
    ctx.fillRect(p1.x, 0, 12 * scale, 2000);
    ctx.fillRect(p2.x, 0, 12 * scale, 2000);
  }
  for (const ry of CITY.roadY) {
    const p1 = worldToScreen(0, ry - CITY.roadWidth / 2, camera);
    const p2 = worldToScreen(0, ry + CITY.roadWidth / 2 - 12, camera);
    ctx.fillRect(0, p1.y, 2000, 12 * scale);
    ctx.fillRect(0, p2.y, 2000, 12 * scale);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of CITY.roadX) {
    for (let y = 0; y < CITY.height; y += 64) {
      if (y < top || y > bottom) continue;
      const p = worldToScreen(rx, y, camera);
      ctx.fillRect(p.x - 2 * scale, p.y, 4 * scale, 28 * scale);
    }
  }
  for (const ry of CITY.roadY) {
    for (let x = 0; x < CITY.width; x += 64) {
      if (x < left || x > right) continue;
      const p = worldToScreen(x, ry, camera);
      ctx.fillRect(p.x, p.y - 2 * scale, 28 * scale, 4 * scale);
    }
  }
}

function drawTrees(ctx, game, camera, worldToScreen, scale, left, top, right, bottom) {
  for (const tree of game.city.trees) {
    if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
    const p = worldToScreen(tree.x, tree.y, camera);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3 * scale, p.y + 4 * scale, tree.r * scale, tree.r * 0.7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.parkTree;
    ctx.beginPath();
    ctx.arc(p.x, p.y, tree.r * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.parkTreeLight;
    ctx.beginPath();
    ctx.arc(p.x - tree.r * 0.3 * scale, p.y - tree.r * 0.3 * scale, tree.r * 0.55 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, game, camera, worldToScreen, scale, left, top, right, bottom) {
  for (const b of game.city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    const lift = b.height * 7;
    const p = worldToScreen(b.x, b.y, camera);
    // Shadow and wall.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(p.x + 5 * scale, p.y + 6 * scale, b.w * scale, b.h * scale);
    ctx.fillStyle = b.wall;
    ctx.fillRect(p.x, p.y, b.w * scale, b.h * scale);
    // Windows on the wall face.
    ctx.fillStyle = 'rgba(40,60,90,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if ((cx * 7 + cy * 13 + b.seed) % 5 === 0) continue;
        ctx.fillRect(p.x + (8 + cx * 34) * scale, p.y + (8 + cy * 34) * scale, 16 * scale, 18 * scale);
      }
    }
    // Roof, lifted up-left for a fake 3D look.
    ctx.fillStyle = b.roof;
    ctx.fillRect(p.x - lift * 0.4 * scale, p.y - lift * scale, b.w * scale, b.h * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(p.x - lift * 0.4 * scale, p.y - lift * scale, b.w * scale, 8 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(p.x - lift * 0.4 * scale + b.w * 0.25 * scale, p.y - lift * scale + b.h * 0.3 * scale, b.w * 0.2 * scale, b.h * 0.25 * scale);
  }
}

function drawPickups(ctx, game, camera, worldToScreen, scale) {
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const p = worldToScreen(pickup.x, pickup.y, camera);
    const bob = Math.sin(game.time * 3 + pickup.x) * 3 * scale;
    ctx.fillStyle = pickup.kind === 'ammo' ? PALETTE.gold : '#5ac08a';
    ctx.beginPath();
    ctx.roundRect(p.x - 11 * scale, p.y - 11 * scale + bob, 22 * scale, 22 * scale, 5 * scale);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `700 ${11 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pickup.kind === 'ammo' ? 'AMMO' : '+', p.x, p.y + bob);
  }
}

function drawMissionMarker(ctx, game, camera, worldToScreen, scale) {
  const target = game.markerTarget;
  if (!target) return;
  const p = worldToScreen(target.x, target.y, camera);
  const pulse = 1 + Math.sin(game.time * 4) * 0.2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-11 * pulse * scale, -11 * pulse * scale, 22 * pulse * scale, 22 * pulse * scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-5 * pulse * scale, -5 * pulse * scale, 10 * pulse * scale, 10 * pulse * scale);
  ctx.restore();
  // A beacon column so the marker is visible from far away.
  const gradient = ctx.createLinearGradient(p.x, p.y - 260 * scale, p.x, p.y);
  gradient.addColorStop(0, 'rgba(255,207,63,0)');
  gradient.addColorStop(1, 'rgba(255,207,63,0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(p.x - 7 * scale, p.y - 260 * scale, 14 * scale, 260 * scale);
}

function drawCars(ctx, game, camera, worldToScreen, scale, left, top, right, bottom) {
  for (const car of game.cars) {
    if (car.x < left || car.x > right || car.y < top || car.y > bottom) continue;
    const p = worldToScreen(car.x, car.y, camera);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(-26 * scale + 3, -13 * scale + 3, 52 * scale, 26 * scale, 8 * scale);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.colour;
    ctx.beginPath();
    ctx.roundRect(-27 * scale, -14 * scale, 54 * scale, 28 * scale, 9 * scale);
    ctx.fill();
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = `700 ${10 * scale}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 4 * scale);
    }
    if (car.kind === 'van') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-20 * scale, -11 * scale, 30 * scale, 22 * scale);
    }
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.fillRect(8 * scale, -11 * scale, 8 * scale, 22 * scale);
    ctx.fillRect(-18 * scale, -11 * scale, 6 * scale, 22 * scale);
    // Headlights.
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(25 * scale, -11 * scale, 3 * scale, 5 * scale);
    ctx.fillRect(25 * scale, 6 * scale, 3 * scale, 5 * scale);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(-28 * scale, -11 * scale, 3 * scale, 5 * scale);
      ctx.fillRect(-28 * scale, 6 * scale, 3 * scale, 5 * scale);
    }
    // Police light bar, flashing red and blue.
    if (car.driver === 'police') {
      const phase = Math.floor((car.sirenPhase || 0) * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6fff';
      ctx.fillRect(-4 * scale, -14 * scale, 8 * scale, 6 * scale);
      ctx.fillStyle = phase ? '#2a6fff' : '#ff2a2a';
      ctx.fillRect(-4 * scale, 8 * scale, 8 * scale, 6 * scale);
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${9 * scale}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLISI', 0, -18 * scale);
    }
    ctx.restore();
  }
}

function drawPedestrians(ctx, game, camera, worldToScreen, scale, left, top, right, bottom) {
  for (const ped of game.peds) {
    if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
    const p = worldToScreen(ped.x, ped.y, camera);
    if (ped.state === 'down') {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 13 * scale, 8 * scale, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin(game.time * 8 + ped.x) * 1.5 * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10 * scale, 9 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ped.angle) * 3 * scale, p.y + Math.sin(ped.angle) * 3 * scale + bob, 5.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, game, camera, worldToScreen, scale) {
  const p = game.player;
  if (p.car) return; // the player is inside the car, drawn with the cars
  const s = worldToScreen(p.x, p.y, camera);
  const bob = Math.sin(game.time * 10) * (p.moving ? 1.5 : 0) * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 11 * scale, 11 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Direction ring.
  ctx.strokeStyle = 'rgba(255,207,63,0.9)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(s.x, s.y + bob, 15 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath();
  ctx.arc(s.x, s.y + bob, 11 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(s.x + Math.cos(p.angle) * 4 * scale, s.y + Math.sin(p.angle) * 4 * scale + bob, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when aiming.
  if (game.ammo > 0) {
    ctx.fillStyle = '#222';
    ctx.fillRect(s.x + Math.cos(p.angle) * 12 * scale - 2, s.y + Math.sin(p.angle) * 12 * scale - 2 + bob, 7 * scale, 4 * scale);
  }
  if (game.muzzle > 0) {
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath();
    ctx.arc(s.x + Math.cos(p.angle) * 24 * scale, s.y + Math.sin(p.angle) * 24 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets(ctx, game, camera, worldToScreen, scale) {
  ctx.fillStyle = '#ffe98a';
  for (const b of game.bullets) {
    const p = worldToScreen(b.x, b.y, camera);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, game, camera, worldToScreen, scale) {
  for (const pt of game.particles) {
    const p = worldToScreen(pt.x, pt.y, camera);
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pt.size * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function dim(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
  ctx.fillRect(0, 0, w, h);
}

function drawTitle(ctx, game, w, h) {
  dim(ctx, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 ${Math.min(84, w * 0.07)}px ${FONT}`;
  ctx.fillText('AURELIA', w / 2, h * 0.3);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `300 ${Math.min(44, w * 0.038)}px ${FONT}`;
  ctx.fillText('N I G H T S', w / 2, h * 0.3 + 58);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('Satu kota. Lima pekerjaan. Jangan sampai tertangkap.', w / 2, h * 0.3 + 108);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('WASD jalan · E masuk / keluar mobil · Spasi pukul · Klik tembak · F misi · P jeda', w / 2, h * 0.62);
  ctx.fillStyle = game.hasSave ? '#7ee2a0' : PALETTE.gold;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(game.hasSave ? 'Tekan ENTER — Lanjutkan (save ditemukan) atau N — Permainan Baru' : 'Tekan ENTER atau KLIK untuk mulai', w / 2, h * 0.7);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('Port Aurelia — kota fiktif. Cerita, nama dan mobilnya orisinal. Main offline, tanpa unduhan.', w / 2, h * 0.78);
  ctx.fillText('Misi: antar paket Rico, jemput Maya, menangi balapan pelabuhan, kabur dari polisi.', w / 2, h * 0.82);
}

function drawPaused(ctx, game, w, h) {
  dim(ctx, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText('JEDA', w / 2, h * 0.42);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('P / Esc untuk lanjut · M suara · R mulai ulang dari save terakhir', w / 2, h * 0.52);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `600 16px ${FONT}`;
  const mission = game.missions.index < MISSIONS.length ? MISSIONS[game.missions.index].title : 'Cerita selesai';
  ctx.fillText(`${mission}  ·  $${game.money}  ·  Misi selesai: ${game.stats.missionsDone}`, w / 2, h * 0.6);
}

function drawGameOver(ctx, game, w, h) {
  dim(ctx, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const busted = game.overKind === 'busted';
  ctx.fillStyle = busted ? '#6fa8ff' : PALETTE.red;
  ctx.font = `800 ${Math.min(72, w * 0.06)}px ${FONT}`;
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', w / 2, h * 0.36);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(
    busted ? 'Polisi Port Aurelia menangkapmu. Kai mendekam semalam di sel.' : 'Kai tumbang di jalanan Port Aurelia.',
    w / 2, h * 0.48,
  );
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`Uang: $${game.money}  ·  Misi selesai: ${game.stats.missionsDone} dari 5  ·  Mobil dicuri: ${game.stats.carsStolen}`, w / 2, h * 0.56);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('Tekan ENTER untuk bermain lagi', w / 2, h * 0.66);
}
