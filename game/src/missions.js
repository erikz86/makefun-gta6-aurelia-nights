// Missions and story: five chained jobs for Rico and Maya across Port Aurelia, then
// repeatable side jobs once the story is done. Each mission is a list of stages —
// go somewhere, hold a spot, survive a timer, or race through checkpoints.

import { MISSIONS, PLACES } from './config.js';
import { addHeat } from './police.js';

export function createMissionState() {
  return {
    index: 0, // which story mission is active; MISSIONS.length means the story is done
    stage: 0,
    stageTimer: 0,
    holdTimer: 0,
    dialog: [],
    dialogIndex: 0,
    dialogUntil: 0,
    active: false,
    complete: false,
    sideJob: null, // { target, text, reward } once the story is done
    raceTimeLeft: 0,
  };
}

/** The current objective text for the HUD, and the marker position on the map. */
export function currentObjective(game) {
  const m = game.missions;
  if (m.sideJob) return { text: m.sideJob.text, target: m.sideJob.target, radius: 80 };
  if (m.index >= MISSIONS.length) {
    return { text: 'Port Aurelia milikmu. Cari pekerjaan sampingan (F) di dekat orang.', target: null, radius: 0 };
  }
  const mission = MISSIONS[m.index];
  const stage = mission.stages[m.stage];
  if (!stage) return { text: mission.title, target: null, radius: 0 };
  const target = stage.target ? PLACES[stage.target] : null;
  return { text: stage.text, target, radius: stage.radius || 80 };
}

export function startMission(game, index) {
  const m = game.missions;
  m.index = index;
  m.stage = 0;
  m.stageTimer = 0;
  m.holdTimer = 0;
  m.active = true;
  m.complete = false;
  const mission = MISSIONS[index];
  m.dialog = mission.intro.slice();
  m.dialogIndex = 0;
  m.dialogUntil = game.time + 5;
  game.toast = mission.title;
  game.toastUntil = game.time + 3;
}

export function startSideJob(game, rng) {
  const spots = Object.values(PLACES);
  const target = spots[Math.floor(rng.next() * spots.length)];
  const reward = 100 + Math.floor(rng.next() * 3) * 50;
  game.missions.sideJob = {
    target,
    text: `Antar paket ke ${target.name} — hadiah $${reward}`,
    reward,
  };
  game.toast = 'Pekerjaan sampingan: antar paket';
  game.toastUntil = game.time + 3;
}

/** Advance the active mission; returns 'complete' | 'failed' | null. */
export function updateMissions(game, rng, dt) {
  const m = game.missions;
  if (m.sideJob) {
    const d = Math.hypot(game.player.x - m.sideJob.target.x, game.player.y - m.sideJob.target.y);
    if (d < 80) {
      game.money += m.sideJob.reward;
      game.audio.coin();
      game.toast = `Paket diantar! +$${m.sideJob.reward}`;
      game.toastUntil = game.time + 3;
      m.sideJob = null;
      saveProgress(game);
    }
    return null;
  }
  if (m.index >= MISSIONS.length || !m.active) return null;
  const mission = MISSIONS[m.index];
  const stage = mission.stages[m.stage];
  if (!stage) return null;

  if (stage.type === 'goto' || stage.type === 'hold') {
    const target = PLACES[stage.target];
    const d = Math.hypot(game.player.x - target.x, game.player.y - target.y);
    if (stage.type === 'goto') {
      if (d < stage.radius) {
        if (mission.id === 'pekerjaan-terakhir' && m.stage === 0) {
          addHeat(game, 40);
          game.toast = 'Alarm berbunyi! Polisi datang!';
          game.toastUntil = game.time + 3;
        }
        advanceStage(game, mission);
      }
    } else {
      if (d < stage.radius) {
        m.holdTimer += dt;
        if (m.holdTimer >= stage.seconds) advanceStage(game, mission);
      } else {
        m.holdTimer = Math.max(0, m.holdTimer - dt);
      }
    }
  } else if (stage.type === 'race') {
    if (m.raceTimeLeft <= 0) m.raceTimeLeft = stage.time;
    m.raceTimeLeft -= dt;
    const target = PLACES[stage.target];
    const d = Math.hypot(game.player.x - target.x, game.player.y - target.y);
    if (d < stage.radius) {
      game.audio.pickup();
      advanceStage(game, mission);
    } else if (m.raceTimeLeft <= 0) {
      return failMission(game, 'Waktu habis! Balapan gagal.');
    }
  } else if (stage.type === 'survive') {
    m.stageTimer += dt;
    if (m.stageTimer >= stage.seconds) {
      advanceStage(game, mission);
      game.heat = 0;
      game.wanted = 0;
    }
  }
  return null;
}

function advanceStage(game, mission) {
  const m = game.missions;
  m.stage += 1;
  m.holdTimer = 0;
  m.raceTimeLeft = 0;
  if (m.stage >= mission.stages.length) {
    completeMission(game, mission);
  } else {
    game.audio.pickup();
  }
}

function completeMission(game, mission) {
  const m = game.missions;
  game.money += mission.reward;
  game.ammo += 12;
  game.audio.missionComplete();
  game.toast = `${mission.title} selesai! +$${mission.reward}`;
  game.toastUntil = game.time + 4;
  m.dialog = [mission.outro];
  m.dialogIndex = 0;
  m.dialogUntil = game.time + 5;
  m.index += 1;
  m.stage = 0;
  m.active = false;
  m.complete = true;
  game.stats.missionsDone += 1;
  saveProgress(game);
  if (m.index < MISSIONS.length) {
    // The next job starts when the player walks to Rico's garage — or press F anywhere.
    game.toast = `${mission.title} selesai! +$${mission.reward} — tekan F untuk misi berikutnya`;
    game.toastUntil = game.time + 5;
  } else {
    game.toast = 'CERITA SELESAI — Port Aurelia milikmu sekarang!';
    game.toastUntil = game.time + 6;
  }
}

function failMission(game, message) {
  const m = game.missions;
  m.stage = 0;
  m.stageTimer = 0;
  m.holdTimer = 0;
  m.raceTimeLeft = 0;
  m.active = false;
  game.toast = message;
  game.toastUntil = game.time + 4;
  game.audio.busted();
  return 'failed';
}

/** The current dialog line, or null when no dialog is showing. */
export function currentDialog(game) {
  const m = game.missions;
  if (m.dialogIndex >= m.dialog.length) return null;
  if (game.time > m.dialogUntil) {
    m.dialogIndex += 1;
    m.dialogUntil = game.time + 5;
    if (m.dialogIndex >= m.dialog.length) return null;
  }
  return m.dialog[m.dialogIndex];
}

export function saveProgress(game) {
  try {
    const data = {
      money: game.money,
      health: game.health,
      ammo: game.ammo,
      missionIndex: game.missions.index,
      x: game.player.x,
      y: game.player.y,
      clock: game.clockMinutes,
      missionsDone: game.stats.missionsDone,
    };
    window.localStorage.setItem('aurelia-nights.save.v1', JSON.stringify(data));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem('aurelia-nights.save.v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
