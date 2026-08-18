// 보스: 꼬꼬대왕 (위스피 우즈 포지션 — 느리고 예고 동작이 크다)
import { Sound } from './engine.js';
import { makeProjectile, makeEnemy } from './entities.js';

export const BOSS_MAX_HP = 5;

export function createBoss(x, groundY) {
  return {
    x: x, y: groundY - 150,
    w: 130, h: 150,
    groundY,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    state: 'sleep',      // sleep -> intro -> idle -> tell -> attack -> idle -> dead
    timer: 0,
    pattern: 0,
    hurtFlash: 0,
    alive: true,
    defeated: false,
    bob: 0,
    tellPattern: null,
  };
}

export function bossHitbox(b) {
  return { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
}

/**
 * env = { player, projectiles, enemies, particles, camera, onDefeat, onIntroDone }
 */
export function updateBoss(b, dt, env) {
  if (!b.alive) return;
  b.timer += dt;
  b.bob += dt;
  if (b.hurtFlash > 0) b.hurtFlash -= dt;

  if (b.state === 'sleep') return;

  if (b.state === 'intro') {
    if (b.timer > 1.9) {
      b.state = 'idle';
      b.timer = 0;
      if (env.onIntroDone) env.onIntroDone();
    }
    return;
  }

  if (b.state === 'dead') return;

  if (b.state === 'idle') {
    // 저학년 배려: 패턴 사이 넉넉한 휴식
    if (b.timer > 2.0) {
      b.timer = 0;
      b.tellPattern = b.pattern % 3;
      b.state = 'tell';
      Sound.bad();
    }
    return;
  }

  if (b.state === 'tell') {
    // 예고 동작 (크게 흔들림)
    if (b.timer > 0.9) {
      b.timer = 0;
      b.state = 'attack';
      doAttack(b, env);
      b.pattern += 1;
    }
    return;
  }

  if (b.state === 'attack') {
    if (b.timer > 1.1) {
      b.timer = 0;
      b.state = 'idle';
    }
  }
}

function doAttack(b, env) {
  const which = b.tellPattern;
  const cx = b.x;
  if (which === 0) {
    // 알 굴리기 — 바닥으로 굴러온다
    for (let i = 0; i < 2; i++) {
      const dir = env.player.x + env.player.w / 2 < cx ? -1 : 1;
      const proj = makeProjectile('enemyIce', cx, b.groundY - 20, dir * (130 + i * 40), 0);
      proj.def = Object.assign({}, proj.def, { emoji: '🥚', gravity: 0 });
      proj.life = 5;
      env.projectiles.push(proj);
    }
    Sound.stomp();
    env.camera.shake(8);
  } else if (which === 1) {
    // 깃털 폭풍 — 위에서 천천히 떨어진다
    for (let i = 0; i < 5; i++) {
      const px = cx - 260 + i * 110 + (Math.random() - 0.5) * 40;
      const proj = makeProjectile('enemyIce', px, b.y - 60, 0, 70);
      proj.def = Object.assign({}, proj.def, { emoji: '🪶', gravity: 20 });
      proj.life = 6;
      env.projectiles.push(proj);
    }
    Sound.bad();
  } else {
    // 삐약이 소환 — 이걸 빨아들여 되뱉는 게 공략법
    for (let i = 0; i < 2; i++) {
      const dir = i === 0 ? -1 : 1;
      const chick = makeEnemy('chick', cx + dir * 70, b.groundY, { dir, range: 200 });
      chick.baseX = cx + dir * 70;
      env.enemies.push(chick);
    }
    Sound.spit();
    env.camera.shake(5);
  }
}

export function damageBoss(b, env, amount) {
  if (!b.alive || b.state === 'intro' || b.state === 'sleep' || b.state === 'dead') return false;
  b.hp -= amount || 1;
  b.hurtFlash = 0.35;
  Sound.bossHit();
  env.camera.shake(13);
  env.particles.spawn(b.x, b.y + b.h / 2, 20, ['#fff', '#ffd93d', '#ff8080'], { speed: 220, star: true, size: 4 });
  if (b.hp <= 0) {
    b.hp = 0;
    b.state = 'dead';
    b.defeated = true;
    env.camera.setZoom(1.35);
    env.camera.shake(20);
    env.camera.freeze(0.5);
    env.particles.spawn(b.x, b.y + b.h / 2, 60, ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1', '#fff'], { speed: 320, star: true, size: 5, life: 1.2 });
    Sound.success();
    if (env.onDefeat) env.onDefeat();
    return true;
  }
  return true;
}

export function drawBoss(ctx, images, b, camX, camY, drawSprite) {
  if (!b.alive || b.state === 'sleep') return;
  const cy = camY || 0;
  const shake = b.state === 'tell' ? Math.sin(b.timer * 40) * 7 : 0;
  const bobY = Math.sin(b.bob * 1.6) * 5;
  const dying = b.state === 'dead';

  ctx.save();
  if (b.hurtFlash > 0 && Math.floor(b.hurtFlash * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  if (dying) {
    ctx.globalAlpha = 0.6;
    ctx.translate(0, Math.min(60, b.timer * 40));
  }
  const x = b.x - b.w / 2 - camX + shake;
  const y = b.y - cy + bobY;
  drawSprite(ctx, images, 'enemy_hen.png', '🐔', x, y, b.w, b.h, false);
  // 왕관
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('👑', b.x - camX + shake, y - 4);
  ctx.restore();
}

export function drawBossHpBar(ctx, b, logicalW) {
  if (!b.alive || b.state === 'sleep' || b.state === 'intro') return;
  const w = 420;
  const h = 20;
  const x = (logicalW - w) / 2;
  const y = 66;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(x, y, w, h);
  const ratio = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = ratio > 0.5 ? '#ff8f6b' : '#e5484d';
  ctx.fillRect(x, y, w * ratio, h);
  ctx.fillStyle = '#4a2e0e';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('꼬꼬대왕', logicalW / 2, y + h / 2);
  ctx.restore();
}
