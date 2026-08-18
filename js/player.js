// 강아지똥 플레이어: 달리기 / 이단점프 / 호버링 / 구르기 / 흡입 / 뱉기 / 복사능력
import { moveAndCollide, rectsOverlap, Sound } from './engine.js';
import { ABILITIES, makeProjectile } from './entities.js';

export const P = {
  W: 44, H: 44,
  GRAVITY: 1900,
  HOVER_GRAVITY: 520,
  HOVER_MAX_FALL: 90,
  GLIDE_GRAVITY: 780,
  JUMP_V: -620,
  DOUBLE_JUMP_V: -560,
  HOVER_PUFF_V: -210,
  RUN_ACCEL: 2600,
  RUN_MAX: 235,
  FRICTION: 2400,
  AIR_ACCEL: 1500,
  ROLL_SPEED: 470,
  ROLL_TIME: 0.34,
  ROLL_COOLDOWN: 0.45,
  INHALE_RANGE: 150,
  INHALE_PULL: 520,
  ATTACK_COOLDOWN: 0.34,
  INVULN_TIME: 1.1,
  MAX_HP: 6,
  COYOTE_TIME: 0.11,     // 발판에서 막 떨어진 뒤에도 잠깐 점프 허용
  JUMP_BUFFER: 0.13,     // 착지 직전에 누른 점프를 기억
  JUMP_CUT: 0.45,        // 버튼을 일찍 떼면 상승을 깎아 낮게 뛴다
};

export function createPlayer(x, y) {
  return {
    x: x, y: y, w: P.W, h: P.H,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    jumpsUsed: 0,
    coyote: 0,
    jumpBuffer: 0,
    hovering: false,
    hoverPuff: 0,
    rolling: false,
    rollTimer: 0,
    rollCooldown: 0,
    inhaling: false,
    mouthful: null,      // 입에 문 적의 type
    ability: null,       // 획득한 복사 능력 key
    attackTimer: 0,
    attackHitbox: null,
    hp: P.MAX_HP,
    maxHp: P.MAX_HP,
    lives: 3,
    invuln: 0,
    invincible: 0,       // 무적 별사탕
    squash: 1,
    dead: false,
  };
}

export function resetPlayer(p, x, y) {
  p.x = x; p.y = y;
  p.vx = 0; p.vy = 0;
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
  p.dead = false;
}

export function playerHitbox(p) {
  if (p.rolling) return { x: p.x, y: p.y + p.h * 0.42, w: p.w, h: p.h * 0.58 };
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

// 흡입 범위(앞쪽 부채꼴을 사각형으로 근사)
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
 * 플레이어 갱신.
 * env = { input, platforms, enemies, projectiles, particles, camera, world, onAbility, onSpit }
 */
export function updatePlayer(p, dt, env) {
  const { input, platforms, particles, camera } = env;

  if (p.invuln > 0) p.invuln -= dt;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.rollCooldown > 0) p.rollCooldown -= dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;
  else p.attackHitbox = null;

  // ---- 구르기 ----
  if (p.rolling) {
    p.rollTimer -= dt;
    p.vx = p.facing * P.ROLL_SPEED;
    if (p.rollTimer <= 0) {
      p.rolling = false;
      p.rollCooldown = P.ROLL_COOLDOWN;
    }
  } else if (input.consume('roll') && p.rollCooldown <= 0 && !p.mouthful) {
    if (p.onGround) {
      p.rolling = true;
      p.rollTimer = P.ROLL_TIME;
      p.inhaling = false;
      Sound.roll();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 8, ['#e0c9a6', '#fff'], { speed: 90, lift: 10, life: 0.35, size: 3 });
      camera.shake(4);
    }
  }

  // ---- 삼키기 (입에 문 상태에서 ↓) ----
  if (p.mouthful && input.consume('down')) {
    const abilityKey = env.abilityOf ? env.abilityOf(p.mouthful) : null;
    p.mouthful = null;
    if (abilityKey && ABILITIES[abilityKey]) {
      p.ability = abilityKey;
      Sound.ability();
      camera.freeze(0.28);
      camera.setZoom(1.3);
      particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 22, [ABILITIES[abilityKey].color, '#fff'], { speed: 200, lift: 60, star: true, size: 4 });
      if (env.onAbility) env.onAbility(abilityKey);
    } else {
      Sound.swallow();
      particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 10, ['#d9c6a5'], { speed: 120 });
      if (env.onAbility) env.onAbility(null);
    }
  }

  // ---- 액션 버튼: 뱉기 / 능력공격 / 흡입 ----
  const actionPressed = input.consume('action');
  if (actionPressed && p.mouthful) {
    // 뱉기: 별 탄환
    const proj = makeProjectile('star', p.x + p.w / 2 + p.facing * 30, p.y + p.h / 2, p.facing * 520, 0);
    env.projectiles.push(proj);
    p.mouthful = null;
    p.inhaling = false;
    Sound.spit();
    camera.shake(5);
    particles.spawn(p.x + p.w / 2 + p.facing * 30, p.y + p.h / 2, 8, ['#fff', '#ffd93d'], { speed: 140, angle: p.facing > 0 ? 0 : Math.PI, spread: 1.2 });
    if (env.onSpit) env.onSpit();
  } else if (actionPressed && p.ability && p.attackTimer <= 0) {
    fireAbility(p, env);
  } else if (!p.mouthful && !p.ability && !p.rolling) {
    p.inhaling = input.held('action');
  } else {
    p.inhaling = false;
  }

  // ---- 흡입 처리 ----
  if (p.inhaling) {
    if (Math.random() < 0.25) Sound.inhale();
    const zone = inhaleZone(p);
    const mouthX = p.x + p.w / 2 + p.facing * 22;
    const mouthY = p.y + p.h / 2;
    for (const e of env.enemies) {
      if (!e.alive) continue;
      if (!rectsOverlap(zone, e)) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dx = mouthX - ex;
      const dy = mouthY - ey;
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
    // 아이템도 빨려온다
    if (env.items) {
      for (const it of env.items) {
        if (it.taken) continue;
        if (!rectsOverlap(zone, it)) continue;
        const dx = mouthX - (it.x + it.w / 2);
        const dy = mouthY - (it.y + it.h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        it.x += (dx / dist) * P.INHALE_PULL * 0.8 * dt;
        it.y += (dy / dist) * P.INHALE_PULL * 0.8 * dt;
      }
    }
    particles.spawn(
      p.x + p.w / 2 + p.facing * 60, p.y + p.h / 2, 1,
      ['#ffffff'],
      { speed: 60, angle: p.facing > 0 ? Math.PI : 0, spread: 1.4, gravity: 0, life: 0.25, size: 2.5 }
    );
  }

  // ---- 좌우 이동 ----
  if (!p.rolling) {
    const accel = p.onGround ? P.RUN_ACCEL : P.AIR_ACCEL;
    const maxSpd = p.inhaling ? P.RUN_MAX * 0.45 : P.RUN_MAX;
    if (input.held('left') && !input.held('right')) {
      p.vx = Math.max(p.vx - accel * dt, -maxSpd);
      if (!p.inhaling) p.facing = -1;
    } else if (input.held('right') && !input.held('left')) {
      p.vx = Math.min(p.vx + accel * dt, maxSpd);
      if (!p.inhaling) p.facing = 1;
    } else if (p.onGround) {
      const dec = P.FRICTION * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - dec);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + dec);
    }
  }

  // ---- 점프 / 이단점프 / 호버링 ----
  // 코요테 타임: 발판을 막 벗어나도 잠깐은 지상 점프로 쳐준다
  if (p.onGround) p.coyote = P.COYOTE_TIME;
  else if (p.coyote > 0) p.coyote -= dt;
  // 점프 버퍼: 착지 직전 입력을 기억했다가 닿는 순간 발동
  if (input.consume('jump')) p.jumpBuffer = P.JUMP_BUFFER;
  else if (p.jumpBuffer > 0) p.jumpBuffer -= dt;

  if (p.jumpBuffer > 0 && !p.rolling) {
    p.jumpBuffer = 0;
    if (p.onGround || (p.coyote > 0 && p.jumpsUsed === 0)) {
      p.coyote = 0;
      p.vy = P.JUMP_V;
      p.jumpsUsed = 1;
      p.hovering = false;
      p.squash = 0.75;
      Sound.jump();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 6, ['#e8d6b4'], { speed: 80, lift: 0, life: 0.3, size: 3 });
    } else if (p.jumpsUsed < 2) {
      p.vy = P.DOUBLE_JUMP_V;
      p.jumpsUsed = 2;
      p.squash = 0.7;
      Sound.doubleJump();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 12, ['#fff', '#ffe8a3'], { speed: 150, lift: -20, life: 0.4, size: 3, star: true });
      camera.shake(2);
    } else {
      // 커비식 호버링: 계속 누르면 계속 뜬다
      p.hovering = true;
      p.hoverPuff = 0.25;
      p.vy = Math.min(p.vy, P.HOVER_PUFF_V);
      Sound.hover();
      particles.spawn(p.x + p.w / 2, p.y + p.h, 4, ['#ffffff'], { speed: 60, lift: -30, life: 0.35, size: 3, gravity: 120 });
    }
  }
  if (p.hoverPuff > 0) p.hoverPuff -= dt;

  // 호버링 해제: 아래키 또는 액션
  if (p.hovering && (input.held('down') || p.mouthful || p.rolling)) {
    p.hovering = false;
  }

  // ---- 가변 점프 높이 ----
  if (p.vy < 0 && !p.hovering && !input.held('jump')) {
    p.vy += (-p.vy) * P.JUMP_CUT * Math.min(1, dt * 18);
  }

  // ---- 중력 ----
  let g = P.GRAVITY;
  const gliding = p.ability === 'feather' && input.held('jump') && p.vy > 0 && !p.hovering;
  if (p.hovering) g = P.HOVER_GRAVITY;
  else if (gliding) g = P.GLIDE_GRAVITY;
  p.vy += g * dt;
  if (p.hovering) p.vy = Math.min(p.vy, P.HOVER_MAX_FALL);
  else if (gliding) p.vy = Math.min(p.vy, 150);
  p.vy = Math.min(p.vy, 1200);

  const wasAir = !p.onGround;
  moveAndCollide(p, platforms, dt);

  if (p.onGround) {
    if (wasAir && p.vy === 0) {
      p.squash = 1.28;
      if (p.hovering) p.hovering = false;
    }
    p.jumpsUsed = 0;
    p.hovering = false;
  }

  // 월드 경계
  if (env.world) {
    p.x = Math.max(0, Math.min(p.x, env.world.w - p.w));
  }

  // 찌그러짐 애니메이션 복원
  p.squash += (1 - p.squash) * Math.min(1, dt * 12);

  return p;
}

function fireAbility(p, env) {
  const ab = ABILITIES[p.ability];
  if (!ab) return;
  p.attackTimer = P.ATTACK_COOLDOWN;
  const mx = p.x + p.w / 2 + p.facing * 26;
  const my = p.y + p.h / 2;

  if (ab.melee) {
    p.attackHitbox = {
      x: p.facing > 0 ? p.x + p.w : p.x - 74,
      y: p.y - 8,
      w: 74,
      h: p.h + 16,
      power: 2,
    };
    Sound.attack();
    env.particles.spawn(mx + p.facing * 20, my, 12, ['#8fd17a', '#c8f0b0'], {
      speed: 150, angle: p.facing > 0 ? 0 : Math.PI, spread: 1.6, gravity: 0, life: 0.28,
    });
    env.camera.shake(3);
    return;
  }

  const kind = ab.shot;
  const count = ab.spread || 1;
  for (let i = 0; i < count; i++) {
    const off = count > 1 ? (i - (count - 1) / 2) * 0.28 : 0;
    const speed = 430;
    env.projectiles.push(
      makeProjectile(kind, mx, my, p.facing * speed * Math.cos(off), speed * Math.sin(off) * 0.7)
    );
  }
  Sound.attack();
  env.particles.spawn(mx, my, 6, [ab.color, '#fff'], {
    speed: 110, angle: p.facing > 0 ? 0 : Math.PI, spread: 1.0, gravity: 0, life: 0.25,
  });
  env.camera.shake(2);
}

// 피격 처리. 반환 true면 실제로 맞음
export function hurtPlayer(p, env, fromX) {
  if (p.invuln > 0 || p.invincible > 0 || p.rolling || p.dead) return false;
  p.hp -= 1;
  p.invuln = P.INVULN_TIME;
  const dir = fromX != null && fromX > p.x + p.w / 2 ? -1 : 1;
  p.vx = dir * 220;
  p.vy = -280;
  p.hovering = false;
  p.inhaling = false;
  Sound.hit();
  env.camera.shake(11);
  env.camera.setZoom(1.12);
  setTimeout(() => env.camera.setZoom(1), 220);
  env.particles.spawn(p.x + p.w / 2, p.y + p.h / 2, 14, ['#ff8080', '#fff'], { speed: 170, star: true });

  // 능력을 잃고 바닥에 떨어뜨린다 (커비 규칙)
  if (p.ability) {
    const lost = p.ability;
    p.ability = null;
    if (env.onAbilityLost) env.onAbilityLost(lost, p.x + p.w / 2, p.y);
  }
  if (p.mouthful) p.mouthful = null;
  if (p.hp <= 0) p.dead = true;
  return true;
}

export function drawPlayer(ctx, images, p, camX, camY, drawSprite) {
  const cy = camY || 0;
  const flashing = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
  if (flashing) return;

  const puffed = p.hovering ? 1.22 : 1;
  const sx = (2 - p.squash) * puffed;
  const sy = p.squash * puffed;
  const w = p.w * sx;
  const h = p.h * sy;
  const dx = p.x - camX + (p.w - w) / 2;
  const dy = p.y - cy + (p.h - h);

  ctx.save();

  // 무적(별사탕) 반짝임
  if (p.invincible > 0) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1'][Math.floor(p.invincible * 12) % 4];
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y - cy + p.h / 2, p.w * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 능력 오라
  if (p.ability && ABILITIES[p.ability]) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = ABILITIES[p.ability].color;
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y - cy + p.h / 2, p.w * 0.68, 0, Math.PI * 2);
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

  // 입에 문 상태 표시
  if (p.mouthful) {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('😗', p.x - camX + p.w / 2 + p.facing * 18, p.y - cy + 12);
  }
  // 능력 아이콘
  if (p.ability && ABILITIES[p.ability]) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ABILITIES[p.ability].icon, p.x - camX + p.w / 2, p.y - cy - 8);
  }
  ctx.restore();
}
