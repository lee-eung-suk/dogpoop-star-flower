// 보스: 꼬꼬대왕 — 통통 뛰어다니며 4가지 패턴을 쓴다.
// 저학년용이라 "예고 동작을 크게, 쉬는 시간을 넉넉히"가 원칙.
import { Sound, Difficulty } from './engine.js';
import { makeProjectile, makeEnemy } from './entities.js';

export const BOSS_MAX_HP = 4;

const GRAVITY = 1750;
const HOP_VY = -520;   // 눈에 보이게 통통 뛰도록
const HOP_VX = 78;

// 패턴 순서 — 첫 패턴을 삐약이 소환으로 둬서 탄약부터 준다
const PATTERNS = ['summon', 'eggs', 'feathers', 'slam'];

export function createBoss(x, groundY, arenaL, arenaR) {
  return {
    x, y: groundY - 150,
    w: 130, h: 150,
    vx: 0, vy: 0,
    onGround: true,
    groundY,
    arenaL: arenaL != null ? arenaL : x - 400,
    arenaR: arenaR != null ? arenaR : x + 240,
    hp: Difficulty.bossHp,
    maxHp: Difficulty.bossHp,
    state: 'sleep',      // sleep -> intro -> idle -> tell -> attack -> idle -> dead
    timer: 0,
    patternIdx: 0,
    current: null,
    hurtFlash: 0,
    hopTimer: 0,
    facing: -1,
    alive: true,
    defeated: false,
    bob: 0,
  };
}

export function bossHitbox(b) {
  return { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
}

function physics(b, dt) {
  b.vy += GRAVITY * dt;
  b.y += b.vy * dt;
  if (b.y + b.h >= b.groundY) {
    b.y = b.groundY - b.h;
    b.vy = 0;
    if (!b.onGround) b.onGround = true;
  } else {
    b.onGround = false;
  }
  b.x += b.vx * dt;
  const half = b.w / 2;
  if (b.x - half < b.arenaL) { b.x = b.arenaL + half; b.vx = 0; }
  if (b.x + half > b.arenaR) { b.x = b.arenaR - half; b.vx = 0; }
  if (b.onGround) b.vx *= Math.pow(0.02, dt);
}

export function updateBoss(b, dt, env) {
  if (!b.alive) return;
  b.timer += dt;
  b.bob += dt;
  if (b.hurtFlash > 0) b.hurtFlash -= dt;

  if (b.state === 'sleep') return;

  if (b.state === 'dead') {
    b.vy += GRAVITY * dt;
    b.y += b.vy * dt;
    return;
  }

  const px = env.player.x + env.player.w / 2;
  b.facing = px < b.x ? -1 : 1;

  if (b.state === 'intro') {
    physics(b, dt);
    if (b.timer > 1.9) {
      b.state = 'idle';
      b.timer = 0;
      if (env.onIntroDone) env.onIntroDone();
    }
    return;
  }

  if (b.state === 'idle') {
    // 제자리에 서 있지 않고 플레이어 쪽으로 통통 뛴다
    b.hopTimer -= dt;
    if (b.onGround && b.hopTimer <= 0) {
      b.vy = HOP_VY;
      b.vx = b.facing * HOP_VX;
      b.onGround = false;
      b.hopTimer = 0.95;
      Sound.stomp();
      env.camera.shake(2);
    }
    physics(b, dt);

    if (b.timer > Difficulty.bossRest) {
      b.timer = 0;
      b.current = PATTERNS[b.patternIdx % PATTERNS.length];
      b.patternIdx += 1;
      b.state = 'tell';
      b.vx = 0;
      Sound.bad();
    }
    return;
  }

  if (b.state === 'tell') {
    // 예고: 크게 흔들리며 멈춘다 (아이가 보고 피할 시간을 준다)
    physics(b, dt);
    if (b.current === 'slam' && b.timer > 0.75 && b.onGround) {
      b.vy = -640;                 // 내려찍기 준비 점프
      b.onGround = false;
    }
    if (b.timer > Difficulty.bossTell) {
      b.timer = 0;
      b.state = 'attack';
      doAttack(b, env);
    }
    return;
  }

  if (b.state === 'attack') {
    if (b.current === 'slam') {
      const wasAir = !b.onGround;
      physics(b, dt);
      if (wasAir && b.onGround) {
        // 착지 충격파
        Sound.bossHit();
        env.camera.shake(15);
        env.particles.spawn(b.x, b.groundY, 24, ['#d9b98a', '#fff'], { speed: 260, lift: 40 });
        [-1, 1].forEach((d) => {
          const pr = makeProjectile('enemyDrop', b.x + d * 60, b.groundY - 18, d * 210, 0);
          pr.def = Object.assign({}, pr.def, { emoji: '💨', gravity: 0 });
          pr.life = 2.4;
          env.projectiles.push(pr);
        });
      }
    } else {
      physics(b, dt);
    }
    if (b.timer > 1.0) {
      b.timer = 0;
      b.state = 'idle';
    }
  }
}

function doAttack(b, env) {
  const cx = b.x;
  if (b.current === 'summon') {
    // 삐약이 소환 — 이걸 빨아들여 되뱉는 게 이 보스의 공략법
    for (let i = 0; i < 2; i++) {
      const dir = i === 0 ? -1 : 1;
      const sx = Math.max(b.arenaL + 60, Math.min(b.arenaR - 60, cx + dir * 110));
      env.enemies.push(makeEnemy('chick', sx, b.groundY, { dir, range: 150 }));
    }
    Sound.spit();
    env.camera.shake(4);
    if (env.onSummon) env.onSummon();
  } else if (b.current === 'eggs') {
    for (let i = 0; i < 2; i++) {
      const dir = env.player.x + env.player.w / 2 < cx ? -1 : 1;
      const pr = makeProjectile('enemyDrop', cx, b.groundY - 22, dir * (135 + i * 45), 0);
      pr.def = Object.assign({}, pr.def, { emoji: '🥚', gravity: 0 });
      pr.life = 5;
      env.projectiles.push(pr);
    }
    Sound.stomp();
    env.camera.shake(6);
  } else if (b.current === 'feathers') {
    for (let i = 0; i < 5; i++) {
      const px = cx - 250 + i * 105 + (Math.random() - 0.5) * 40;
      const pr = makeProjectile('enemyDrop', px, b.y - 50, 0, 62);
      pr.def = Object.assign({}, pr.def, { emoji: '🪶', gravity: 16 });
      pr.life = 6.5;
      env.projectiles.push(pr);
    }
    Sound.bad();
  }
}

export function damageBoss(b, env, amount) {
  if (!b.alive || b.state === 'intro' || b.state === 'sleep' || b.state === 'dead') return false;
  b.hp -= amount || 1;
  b.hurtFlash = 0.35;
  b.vx = (b.facing > 0 ? -1 : 1) * 140;      // 맞으면 뒤로 밀린다
  b.vy = -180;
  b.onGround = false;
  Sound.bossHit();
  env.camera.shake(12);
  env.particles.spawn(b.x, b.y + b.h / 2, 20, ['#fff', '#ffd93d', '#ff8080'], { speed: 220, star: true, size: 4 });

  if (b.hp <= 0) {
    b.hp = 0;
    b.state = 'dead';
    b.defeated = true;
    b.vy = -260;
    env.camera.pulseZoom(1.3, 1.2);
    env.camera.shake(18);
    env.camera.freeze(0.45);
    env.particles.spawn(b.x, b.y + b.h / 2, 60,
      ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1', '#fff'],
      { speed: 320, star: true, size: 5, life: 1.2 });
    Sound.success();
    if (env.onDefeat) env.onDefeat();
  }
  return true;
}

export function drawBoss(ctx, images, b, camX, camY, drawSprite) {
  if (!b.alive || b.state === 'sleep') return;
  const cy = camY || 0;
  const shake = b.state === 'tell' ? Math.sin(b.timer * 42) * 8 : 0;
  const squash = b.onGround && b.vy === 0 ? 1 : (b.vy < 0 ? 0.93 : 1.06);
  const w = b.w / squash;
  const h = b.h * squash;
  const x = b.x - w / 2 - camX + shake;
  const y = b.y + (b.h - h) - cy;

  ctx.save();
  if (b.hurtFlash > 0 && Math.floor(b.hurtFlash * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  if (b.state === 'dead') ctx.globalAlpha = 0.6;

  // 그림자
  ctx.save();
  ctx.globalAlpha *= 0.25;
  ctx.fillStyle = '#3b2a12';
  ctx.beginPath();
  ctx.ellipse(b.x - camX, b.groundY - cy - 4, b.w * 0.42, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSprite(ctx, images, 'enemy_hen.png', '🐔', x, y, w, h, b.facing > 0);
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('👑', b.x - camX + shake, y - 4);

  // 예고 중에는 느낌표로 알려준다
  if (b.state === 'tell') {
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#e5484d';
    ctx.fillText('!', b.x - camX + shake, y - 46);
  }
  ctx.restore();
}

export function drawBossHpBar(ctx, b, logicalW) {
  if (!b.alive || b.state === 'sleep' || b.state === 'intro') return;
  const w = 420, h = 20;
  const x = (logicalW - w) / 2, y = 66;
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
  ctx.fillText(`꼬꼬대왕  ${'❤'.repeat(b.hp)}`, logicalW / 2, y + h / 2);
  ctx.restore();
}
