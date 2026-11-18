// Combat: fists up close (Space) and the pistol (click to shoot at the mouse).
// Bullets fly straight, spark on buildings, and hit pedestrians, police cars and
// the player's own car. Every hit on a person is a crime.

import { WANTED } from './config.js';
import { addHeat } from './police.js';
import { knockDownPedestrian, scarePedestrians } from './pedestrians.js';

export function createBullet(x, y, angle, fromPlayer) {
  const speed = 900;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.9,
    fromPlayer,
  };
}

/** Fire one pistol shot toward a world point; returns false when out of ammo. */
export function playerShoot(game, worldX, worldY) {
  if (game.ammo <= 0) {
    game.toast = 'Amunisi habis! Selesaikan misi untuk isi ulang.';
    game.toastUntil = game.time + 2;
    return false;
  }
  const p = game.player;
  const angle = Math.atan2(worldY - p.y, worldX - p.x);
  p.angle = angle;
  game.ammo -= 1;
  game.bullets.push(createBullet(p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22, angle, true));
  game.audio.shoot();
  game.muzzle = 0.08;
  scarePedestrians(game, p.x, p.y, 320);
  return true;
}

/** A punch in front of the player: hurts the nearest person in reach. */
export function playerPunch(game) {
  const p = game.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  game.audio.punch();
  const fx = p.x + Math.cos(p.angle) * 30;
  const fy = p.y + Math.sin(p.angle) * 30;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - fx, ped.y - fy) < 42) {
      knockDownPedestrian(ped);
      addHeat(game, WANTED.shootPedHeat / 2);
      game.toast = 'Kau memukul orang! Polisi memperhatikan.';
      game.toastUntil = game.time + 2;
      spawnHitParticles(game, ped.x, ped.y, '#e05a5a');
      return;
    }
  }
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    if (Math.hypot(car.x - fx, car.y - fy) < 60) {
      addHeat(game, WANTED.punchCopHeat);
      game.toast = 'Kau menyerang polisi!';
      game.toastUntil = game.time + 2;
      spawnHitParticles(game, car.x, car.y, '#3a6fd8');
      return;
    }
  }
}

export function updateBullets(game, dt) {
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

/** Bullet impacts: people fall, cars take damage, buildings spark. */
export function resolveBulletHits(game) {
  const remaining = [];
  for (const bullet of game.bullets) {
    let hit = false;
    if (bullet.fromPlayer) {
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 16) {
          knockDownPedestrian(ped);
          addHeat(game, WANTED.shootPedHeat);
          spawnHitParticles(game, ped.x, ped.y, '#e05a5a');
          game.toast = 'Kau menembak orang! Wanted naik!';
          game.toastUntil = game.time + 2;
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const car of game.cars) {
          if (car.driver === 'player') continue;
          if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 30) {
            car.health -= 20;
            if (car.driver === 'police') addHeat(game, WANTED.shootCopHeat);
            spawnHitParticles(game, bullet.x, bullet.y, '#ffcf3f');
            hit = true;
            break;
          }
        }
      }
    }
    if (!hit) remaining.push(bullet);
  }
  game.bullets = remaining;
}

export function spawnHitParticles(game, x, y, colour) {
  for (let i = 0; i < 10; i += 1) {
    game.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.5) * 220,
      life: 0.5,
      maxLife: 0.5,
      colour,
      size: 3,
    });
  }
}

export function spawnParticles(game, x, y, colour, count) {
  for (let i = 0; i < count; i += 1) {
    game.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260,
      life: 0.6,
      maxLife: 0.6,
      colour,
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(game, dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}
