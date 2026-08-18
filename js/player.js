// 강아지똥 플레이어: 달리기 / 이단점프 / 둥실 날기 / 구르기 / 흡입 / 뱉기 / 복사능력
import { moveAndCollide, rectsOverlap, Sound, Difficulty } from './engine.js';
import { ABILITIES, makeProjectile } from './entities.js';

export const P = {
  W: 44, H: 44,
  GRAVITY: 1900,
  JUMP_V: -600,
  DOUBLE_JUMP_V: -540,
  // 달리기: 가속을 너무 높이면 켜고 끄는 스위치처럼 뻣뻣해진다. 마찰도 같이 낮춰 미끄러지듯 멈추게.
  RUN_ACCEL: 1900,
  RUN_MAX: 250,
  FRICTION: 1700,
  AIR_ACCEL: 1300,
  // 둥실 날기: 연타가 아니라 "누르고 있으면 뜬다". 저학년이 훨씬 다루기 쉽다.
  HOVER_RISE: -120,
  HOVER_SINK: 95,
  GLIDE_MAX_FALL: 140,
  ROLL_SPEED: 460,
  ROLL_TIME: 0.32,
  ROLL_COOLDOWN: 0.42,
  INHALE_RANGE: 155,
  INHALE_PULL: 540,
  ATTACK_COOLDOWN: 0.4,
  INVULN_TIME: 1.1,
  COYOTE_TIME: 0.11,
  JUMP_BUFFER: 0.13,
  JUMP_CUT: 0.45,
  MAX_HP: 6,
};

export function createPlayer(x, y) {
  const p = {
    x, y, w: P.W, h: P.H,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    maxHp: Difficulty.playerHp,
    hp: Difficulty.playerHp,
    lives: Difficulty.lives,
    squash: 1,
  };
  resetPlayer(p, x, y);
  p.hp = Difficulty.playerHp;
  p.lives = Difficulty.lives;
  return p;
}

export function resetPlayer(p, x, y) {
  p.x = x; p.y = y;
  p.vx = 0; p.vy = 0;
  p.maxHp = Difficulty.playerHp;
  p.hp = p.maxHp;          // 부활 시 체력 회복 (빠뜨리면 음수 HP로 계속 죽는다)
  p.invuln = 0.9;          // 부활 직후 잠깐 무적
  p.onGround = false;
  p.facing = 1;
  p.jumpsUsed = 0;
  p.coyote = 0;
  p.jumpBuffer = 0;
  p.hovering = false;
  p.rolling = false;
  p.rollTimer = 0;
  p.rollCooldown = 0;
  p.inhaling = false;
  p.mouthful = null;
  p.ability = null;
  p.attackTimer = 0;
  p.attackHitbox = null;
  p.invincible = 0;
  p.squash = 1;
  p.dead = false;
}

export function playerHitbox(p) {
  if (p.rolling) return { x: p.x + 2, y: p.y + p.h * 0.42, w: p.w - 4, h: p.h * 0.58 };
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

export function inhaleZone(p) {
  const range = P.INHALE_RANGE;
  return {
    x: p.facing > 0 ? p.x + p.w : p.x - range,
    y: p.y - 18,
    w: range,
    h: p.h + 36,
  };
}

/**
 * env = { input, platforms, enemies, projectiles, items, particles, camera, world,
 *         abilityOf, onAbility, onAbilityLost, onSpit }
 */
export function updatePlayer(p, dt, env) {
  const { input, platforms, particles, camera } = env;

  if (p.invuln > 0) p.invuln -= dt;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.rollCooldown > 0) p.rollCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;
  if (p.attackTimer <= 0) p.attackHitbox = null;

  // ---- 구르기 ----
  if (p.rolling) {
    p.rollTimer -= dt;
    p.vx = p.facing * P.ROLL_SPEED;
    if (p.rollTimer <= 0) {
      p.rolling = false;
      p.rollCooldown = P.ROLL_COOLDOWN;
    }
  } else if (input.consume('roll') && p.rollCooldown <= 0 && !p.mouthful && p.onGround) {
    p.rolling = true;
    p.rollTimer = P.ROLL_TIME;
    p.inhaling = false;
    p.hovering = false;
    Sound.roll();
    particles.spawn(p.x + p.w / 2, p.y + p.h, 8, ['#e0c9a6', '#fff'], { speed: 90, lift: 10, life: 0.35, size: 3 });
  }

  // ---- 삼키기 (입에 문 상태에서 ↓) ----
  if (p.mouthful && input.consume('down')) {
    const key = env.abilityOf ? env.abilityOf(p.mouthful) : null;
    p.mouthful = null;
    if (key && ABILITIES[key]) {
      p.ability = key;
      Sound.ability();
      camera.freeze(0.22);
      camera.pulseZoom(1.18, 0.35);
      particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 22, [ABILITIES[key].color, '#fff'], { speed: 200, lift: 60, star: true, size: 4 });
      if (env.onAbility) env.onAbility(key);
    } else {
      Sound.swallow();
      particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 10, ['#d9c6a5'], { speed: 120 });
      if (env.onAbility) env.onAbility(null);
    }
  }

  // ---- 액션 버튼: 뱉기 / 능력공격 / 흡입 ----
  const actionPressed = input.consume('action');
  if (actionPressed && p.mouthful) {
    env.projectiles.push(
      makeProjectile('star', p.x + p.w / 2 + p.facing * 30, p.y + p.h / 2, p.facing * 520, 0)
    );
    p.mouthful = null;
    p.inhaling = false;
    Sound.spit();
    camera.shake(4);
    particles.spawn(p.x + p.w / 2 + p.facing * 30, p.y + p.h / 2, 8, ['#fff', '#ffd93d'],
      { speed: 140, angle: p.facing > 0 ? 0 : Math.PI, spread: 1.2 });
    if (env.onSpit) env.onSpit();
  } else if (actionPressed && p.ability && p.attackTimer <= 0) {
    fireAbility(p, env);
  } else if (!p.mouthful && !p.ability && !p.rolling) {
    p.inhaling = input.held('action');
  } else {
    p.inhaling = false;
  }

  // ---- 흡입 ----
  if (p.inhaling) {
    const zone = inhaleZone(p);
    const mouthX = p.x + p.w / 2 + p.facing * 22;
    const mouthY = p.y + p.h / 2;
    for (const e of env.enemies) {
      if (!e.alive || !rectsOverlap(zone, e)) continue;
      const dx = mouthX - (e.x + e.w / 2);
      const dy = mouthY - (e.y + e.h / 2);
      const dist = Math.hypot(dx, dy) || 1;
      e.sucked = true;
      e.x += (dx / dist) * P.INHALE_PULL * dt;
      e.y += (dy / dist) * P.INHALE_PULL * dt;
      if (dist < 34) {
        e.alive = false;
        p.mouthful = e.type;
        p.inhaling = false;
        Sound.swallow();
        particles.spawn(mouthX, mouthY, 8, ['#fff', '#ffe8a3'], { speed: 90 });
      }
    }
    if (env.items) {
      for (const it of env.items) {
        if (it.taken || !rectsOverlap(zone, it)) continue;
        const dx = mouthX - (it.x + it.w / 2);
        const dy = mouthY - (it.y + it.h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        it.x += (dx / dist) * P.INHALE_PULL * 0.85 * dt;
        it.y += (dy / dist) * P.INHALE_PULL * 0.85 * dt;
        it.baseY = it.y;
      }
    }
  }

  // ---- 좌우 이동 ----
  if (!p.rolling) {
    const accel = p.onGround ? P.RUN_ACCEL : P.AIR_ACCEL;
    const maxSpd = p.inhaling ? P.RUN_MAX * 0.5 : P.RUN_MAX;
    if (input.held('left') && !input.held('right')) {
      p.vx = Math.max(p.vx - accel * dt, -maxSpd);
      if (!p.inhaling) p.facing = -1;
    } else if (input.held('right') && !input.held('left')) {
      p.vx = Math.min(p.vx + accel * dt, maxSpd);
      if (!p.inhaling) p.facing = 1;
    } else {
      const dec = (p.onGround ? P.FRICTION : P.FRICTION * 0.35) * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - dec);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + dec);
    }
  }

  // ---- 점프 / 이단점프 / 둥실 날기 ----
  if (p.onGround) p.coyote = P.COYOTE_TIME;
  else if (p.coyote > 0) p.coyote -= dt;

  if (input.consume('jump')) p.jumpBuffer = P.JUMP_BUFFER;
  else if (p.jumpBuffer > 0) p.jumpBuffer -= dt;

  if (p.jumpBuffer > 0 && !p.rolling) {
    if (p.onGround || (p.coyote > 0 && p.jumpsUsed === 0)) {
      p.jumpBuffer = 0;
      p.coyote = 0;
      p.vy = P.JUMP_V;
      p.jumpsUsed = 1;
      p.hovering = false;
      p.squash = 0.76;
      Sound.jump();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 6, ['#e8d6b4'], { speed: 80, lift: 0, life: 0.3, size: 3 });
    } else if (p.jumpsUsed < 2) {
      p.jumpBuffer = 0;
      p.vy = P.DOUBLE_JUMP_V;
      p.jumpsUsed = 2;
      p.squash = 0.72;
      Sound.doubleJump();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 12, ['#fff', '#ffe8a3'],
        { speed: 150, lift: -20, life: 0.4, size: 3, star: true });
    } else if (!p.hovering) {
      p.jumpBuffer = 0;
      p.hovering = true;
      Sound.hover();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 6, ['#ffffff'],
        { speed: 60, lift: -30, life: 0.35, size: 3, gravity: 120 });
    } else {
      p.jumpBuffer = 0;
    }
  }

  // 둥실 날기 해제
  if (p.hovering && (input.held('down') || p.rolling)) p.hovering = false;

  // ---- 수직 이동 ----
  const gliding = !p.hovering && p.ability === 'feather' && input.held('jump') && p.vy > 0;
  if (p.hovering) {
    // 누르고 있으면 천천히 오르고, 떼면 천천히 내려온다
    const target = input.held('jump') ? P.HOVER_RISE : P.HOVER_SINK;
    p.vy += (target - p.vy) * Math.min(1, dt * 8);
  } else {
    if (p.vy < 0 && !input.held('jump')) {
      p.vy += (-p.vy) * P.JUMP_CUT * Math.min(1, dt * 18);   // 버튼을 일찍 떼면 낮게
    }
    p.vy += P.GRAVITY * dt;
    if (gliding) p.vy = Math.min(p.vy, P.GLIDE_MAX_FALL);
    p.vy = Math.min(p.vy, 1150);
  }

  const wasAir = !p.onGround;
  moveAndCollide(p, platforms, dt);

  if (p.onGround) {
    if (wasAir) p.squash = 1.26;
    p.jumpsUsed = 0;
    p.hovering = false;
  }

  if (env.world) p.x = Math.max(0, Math.min(p.x, env.world.w - p.w));

  p.squash += (1 - p.squash) * Math.min(1, dt * 12);
  return p;
}

// ---- 능력별 공격: 5종이 각각 다른 방식으로 작동한다 ----
function fireAbility(p, env) {
  const ab = ABILITIES[p.ability];
  if (!ab) return;
  p.attackTimer = ab.cooldown || P.ATTACK_COOLDOWN;
  const mx = p.x + p.w / 2 + p.facing * 26;
  const my = p.y + p.h / 2;
  const dirAngle = p.facing > 0 ? 0 : Math.PI;

  if (p.ability === 'vine') {
    // 넓게 후려치는 근접 판정 + 강한 넉백
    p.attackHitbox = {
      x: p.facing > 0 ? p.x + p.w - 6 : p.x - 86,
      y: p.y - 20,
      w: 92,
      h: p.h + 40,
      knockback: 320,
    };
    Sound.attack();
    env.particles.spawn(mx + p.facing * 26, my, 16, ['#8fd17a', '#c8f0b0', '#fff'],
      { speed: 190, angle: dirAngle, spread: 1.9, gravity: 0, life: 0.3 });
    env.camera.shake(4);
    return;
  }

  if (p.ability === 'feather') {
    // 제자리에 회오리를 세운다 — 지나가는 적을 계속 때린다
    env.projectiles.push(makeProjectile('tornado', mx + p.facing * 24, my, p.facing * 60, 0));
    Sound.attack();
    env.particles.spawn(mx, my, 12, ['#f6e3b4', '#fff'],
      { speed: 130, gravity: 0, life: 0.4 });
    env.camera.shake(3);
    return;
  }

  if (p.ability === 'sun') {
    // 관통 빔 — 한 줄로 선 적을 전부 뚫는다
    env.projectiles.push(makeProjectile('sunbeam', mx, my, p.facing * 620, 0));
    Sound.attack();
    env.particles.spawn(mx, my, 10, ['#ffd15c', '#fff6cf'],
      { speed: 150, angle: dirAngle, spread: 0.6, gravity: 0, life: 0.25 });
    env.camera.shake(2);
    return;
  }

  if (p.ability === 'water') {
    // 바닥에 튕기는 물방울 3발 — 구석·아래쪽을 노린다
    [-0.42, -0.18, 0.06].forEach((up) => {
      env.projectiles.push(
        makeProjectile('droplet', mx, my, p.facing * 330, up * 620)
      );
    });
    Sound.attack();
    env.particles.spawn(mx, my, 8, ['#8ecdf7', '#dff1ff'],
      { speed: 120, angle: dirAngle, spread: 1.1, gravity: 0, life: 0.25 });
    return;
  }

  if (p.ability === 'ice') {
    // 적을 얼려 발판으로 만든다
    env.projectiles.push(makeProjectile('iceshot', mx, my, p.facing * 420, 0));
    Sound.attack();
    env.particles.spawn(mx, my, 8, ['#a8dcff', '#fff'],
      { speed: 130, angle: dirAngle, spread: 0.8, gravity: 0, life: 0.25 });
    return;
  }
}

export function hurtPlayer(p, env, fromX) {
  if (p.invuln > 0 || p.invincible > 0 || p.rolling || p.dead) return false;
  p.hp -= 1;
  p.invuln = Difficulty.invuln;
  const dir = fromX != null && fromX > p.x + p.w / 2 ? -1 : 1;
  p.vx = dir * 210;
  p.vy = -270;
  p.hovering = false;
  p.inhaling = false;
  Sound.hit();
  env.camera.shake(9);
  env.particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 14, ['#ff8080', '#fff'], { speed: 170, star: true });

  if (p.ability) {
    const lost = p.ability;
    p.ability = null;
    if (env.onAbilityLost) env.onAbilityLost(lost, p.x + p.w / 2, p.y);
  }
  p.mouthful = null;
  if (p.hp <= 0) p.dead = true;
  return true;
}

export function drawPlayer(ctx, images, p, camX, camY, drawSprite) {
  const cy = camY || 0;
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;

  const puffed = p.hovering ? 1.2 : 1;
  const w = p.w * (2 - p.squash) * puffed;
  const h = p.h * p.squash * puffed;
  const dx = p.x - camX + (p.w - w) / 2;
  const dy = p.y - cy + (p.h - h);

  ctx.save();

  if (p.invincible > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1'][Math.floor(p.invincible * 12) % 4];
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y - cy + p.h / 2, p.w * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (p.ability && ABILITIES[p.ability]) {
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = ABILITIES[p.ability].color;
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y - cy + p.h / 2, p.w * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (p.rolling) {
    ctx.translate(p.x - camX + p.w / 2, p.y - cy + p.h / 2);
    ctx.rotate(((Date.now() % 400) / 400) * Math.PI * 2 * p.facing);
    drawSprite(ctx, images, 'player.png', '🐾', -p.w / 2, -p.h / 2, p.w, p.h, p.facing < 0);
    ctx.restore();
    return;
  }

  drawSprite(ctx, images, 'player.png', '🐾', dx, dy, w, h, p.facing < 0);

  if (p.mouthful) {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('😗', p.x - camX + p.w / 2 + p.facing * 18, p.y - cy + 12);
  }
  if (p.ability && ABILITIES[p.ability]) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ABILITIES[p.ability].icon, p.x - camX + p.w / 2, p.y - cy - 8);
  }
  ctx.restore();
}
