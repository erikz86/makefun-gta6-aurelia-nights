// The HUD: money, health, wanted stars, the clock, the mission objective, dialog
// and the minimap — a small live map of Port Aurelia in the corner of the screen.

import { CITY, FONT, MISSIONS, PALETTE, PLACES } from './config.js';
import { currentObjective } from './missions.js';

/** Draw the whole HUD over the world: top bars, objective, dialog, minimap. */
export function drawHud(ctx, game, view) {
  const { width, height } = view;
  drawTopLeft(ctx, game);
  drawTopRight(ctx, game);
  drawObjective(ctx, game, width);
  drawDialog(ctx, game, width, height);
  drawToast(ctx, game, width);
  drawMinimap(ctx, game, width, height);
  drawControlsHint(ctx, game, width, height);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function drawTopLeft(ctx, game) {
  panel(ctx, 14, 14, 250, 100);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, 28, 38);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('KAI "KANCIL" — PORT AURELIA', 28, 62);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(28, 74, 180, 12, 6);
  ctx.fill();
  ctx.fillStyle = game.health > 35 ? '#5ac08a' : PALETTE.red;
  ctx.beginPath();
  ctx.roundRect(28, 74, Math.max(0, 180 * game.health / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText(`NYAWA ${Math.max(0, Math.round(game.health))}`, 214, 80);
  // Ammo, on its own line under the health bar.
  ctx.fillStyle = game.ammo > 0 ? PALETTE.text : PALETTE.red;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(`AMMO ${game.ammo}`, 28, 104);
}

function drawTopRight(ctx, game) {
  // Wanted stars.
  panel(ctx, ctx.canvas.width - 214, 14, 200, 52);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const hours = Math.floor(game.clockMinutes / 60) % 24;
  const minutes = Math.floor(game.clockMinutes % 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, ctx.canvas.width - 28, 32);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(game.wanted > 0 ? 'POLISI MENCARIMU' : 'PORT AURELIA', ctx.canvas.width - 28, 52);
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, ctx.canvas.width - 196 + i * 26, 32, 10, i < game.wanted ? PALETTE.gold : 'rgba(255,255,255,0.22)');
  }
}

function drawStar(ctx, cx, cy, r, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawObjective(ctx, game, width) {
  const objective = currentObjective(game);
  const mission = game.missions.index < MISSIONS.length ? MISSIONS[game.missions.index] : null;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  panel(ctx, width / 2 - 260, 14, 520, 54);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 15px ${FONT}`;
  const title = game.missions.sideJob ? 'PEKERJAAN SAMPINGAN'
    : mission ? mission.title.toUpperCase() : 'FREE ROAM — PORT AURELIA';
  ctx.fillText(title, width / 2, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 13px ${FONT}`;
  let line = objective.text;
  if (game.missions.raceTimeLeft > 0) line += `  —  ${Math.ceil(game.missions.raceTimeLeft)} detik`;
  if (game.missions.holdTimer > 0) line += `  —  ${Math.ceil(game.missions.holdTimer)} / 8 detik`;
  if (game.missions.index < MISSIONS.length && game.missions.stage === 0 && game.missions.stageTimer > 0) {
    line += `  —  ${Math.max(0, Math.ceil(45 - game.missions.stageTimer))} detik`;
  }
  ctx.fillText(line, width / 2, 54);
}

function drawDialog(ctx, game, width, height) {
  const line = game.dialogLine;
  if (!line) return;
  const boxW = Math.min(760, width - 60);
  panel(ctx, (width - boxW) / 2, height - 150, boxW, 56);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 15px ${FONT}`;
  wrapText(ctx, line, (width - boxW) / 2 + 18, height - 122, boxW - 36, 20);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

function drawToast(ctx, game, width) {
  if (!game.toast || game.time > game.toastUntil) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 17px ${FONT}`;
  ctx.fillText(game.toast, width / 2, 96);
}

function drawControlsHint(ctx, game, width, height) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(245,240,230,0.75)';
  ctx.font = `500 12px ${FONT}`;
  const hint = game.player.car
    ? 'W/S gas & rem · A/D belok · E keluar mobil · P jeda · M suara'
    : 'WASD jalan · E masuk mobil · Spasi pukul · Klik tembak · F misi · P jeda';
  ctx.fillText(hint, 16, height - 16);
}

/** The minimap: the whole city shrunk into the corner, with the player, cars, police and the mission marker. */
export function drawMinimap(ctx, game, width, height) {
  const mw = 220;
  const mh = 160;
  const x0 = width - mw - 16;
  const y0 = height - mh - 16;
  const sx = mw / CITY.width;
  const sy = mh / CITY.height;
  panel(ctx, x0 - 6, y0 - 6, mw + 12, mh + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#5d8a5a';
  ctx.fillRect(x0, y0, mw, mh);
  // Water.
  ctx.fillStyle = PALETTE.water;
  for (const w of game.city.water) ctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (const rx of CITY.roadX) ctx.fillRect(x0 + (rx - 50) * sx, y0, 100 * sx, mh);
  for (const ry of CITY.roadY) ctx.fillRect(x0, y0 + (ry - 50) * sy, mw, 100 * sy);
  // Mission marker.
  const objective = currentObjective(game);
  if (objective.target) {
    const pulse = 1 + Math.sin(game.time * 5) * 0.25;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(x0 + objective.target.x * sx, y0 + objective.target.y * sy, 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traffic dots, police in blue, player as a white arrow.
  for (const car of game.cars) {
    ctx.fillStyle = car.driver === 'police' ? '#6fa8ff' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, car.driver === 'police' ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * sx, y0 + game.player.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * sx, y0 + game.player.y * sy, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('PORT AURELIA', x0, y0 - 12);
  void PLACES;
}
