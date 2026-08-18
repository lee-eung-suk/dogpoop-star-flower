// 적 / 아이템 / 투사체 정의
import { rectsOverlap } from './engine.js';

// ---------------- 능력 ----------------
// 적을 삼키면 얻는 복사 능력. name은 HUD 표시용.
export const ABILITIES = {
  feather: { name: '깃털', icon: '🪶', color: '#f6e3b4', shot: 'feather', glide: true, desc: '깃털 회오리 + 천천히 내려오기' },
  sun:     { name: '햇살', icon: '☀️', color: '#ffd15c', shot: 'sun',     desc: '앞으로 빛줄기 발사' },
  vine:    { name: '새싹', icon: '🌱', color: '#8fd17a', melee: true,     desc: '덩굴 채찍 (판정 큼)' },
  ice:     { name: '얼음', icon: '❄️', color: '#a8dcff', shot: 'ice',     desc: '적을 얼려서 밀어내기' },
  water:   { name: '이슬', icon: '💧', color: '#8ecdf7', shot: 'water',   spread: 3, desc: '물방울 3발 산탄' },
};

// ---------------- 적 ----------------
export const ENEMY_DEFS = {
  chick: {
    label: '삐약이', emoji: '🐤', image: null, w: 30, h: 28,
    hp: 1, speed: 42, ability: null, score: 1, behavior: 'walk',
  },
  hen: {
    label: '꼬꼬', emoji: '🐔', image: 'enemy_hen.png', w: 44, h: 40,
    hp: 1, speed: 55, ability: 'feather', score: 3, behavior: 'charge',
  },
  sparrow: {
    label: '참새', emoji: '🐦', image: null, w: 32, h: 28,
    hp: 1, speed: 80, ability: null, score: 2, behavior: 'fly',
  },
  sprout: {
    label: '새싹이', emoji: '🌱', image: 'sprout.png', w: 32, h: 34,
    hp: 1, speed: 0, ability: 'vine', score: 2, behavior: 'popup',
  },
  hotchi: {
    label: '핫치', emoji: '🔥', image: null, w: 34, h: 32,
    hp: 1, speed: 0, ability: 'sun', score: 3, behavior: 'shooter',
  },
  frost: {
    label: '우박정령', emoji: '❄️', image: 'item_hail.png', w: 34, h: 32,
    hp: 1, speed: 30, ability: 'ice', score: 3, behavior: 'floater',
  },
};

export function makeEnemy(type, x, y, opts) {
  const def = ENEMY_DEFS[type];
  const o = opts || {};
  return {
    type, def,
    x: x - def.w / 2, y: y - def.h,
    w: def.w, h: def.h,
    vx: (o.dir || 1) * def.speed, vy: 0,
    dir: o.dir || 1,
    baseX: x, baseY: y,
    range: o.range || 80,
    hp: def.hp,
    alive: true,
    onGround: false,
    timer: Math.random() * 2,
    state: 'idle',
    frozen: 0,
    sucked: false,
    suckT: 0,
  };
}

// 적 행동 갱신. 반환값: 발사한 투사체 배열
export function updateEnemy(e, dt, player, platforms, gravity) {
  const shots = [];
  if (!e.alive) return shots;
  // 빨려 들어가는 중에는 AI를 멈춘다.
  // (안 멈추면 순찰 범위로 매 프레임 되돌아가서 입까지 끌려오지 못한다)
  if (e.sucked) {
    e.sucked = false;
    return shots;
  }
  e.timer += dt;
  if (e.frozen > 0) {
    e.frozen -= dt;
    e.vx = 0;
    return shots;
  }

  const b = e.def.behavior;
  if (b === 'walk') {
    e.x += e.vx * dt;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    e.dir = e.vx < 0 ? -1 : 1;
  } else if (b === 'charge') {
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    const near = Math.abs(dx) < 260 && Math.abs(player.y - e.y) < 120;
    const spd = near ? e.def.speed * 2.1 : e.def.speed;
    if (near) e.dir = dx < 0 ? -1 : 1;
    else {
      if (e.x < e.baseX - e.range) e.dir = 1;
      if (e.x > e.baseX + e.range) e.dir = -1;
    }
    e.vx = e.dir * spd;
    e.x += e.vx * dt;
    e.state = near ? 'charge' : 'idle';
  } else if (b === 'fly') {
    e.x += e.vx * dt;
    e.y = e.baseY - e.h - 60 + Math.sin(e.timer * 2.2) * 46;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    e.dir = e.vx < 0 ? -1 : 1;
  } else if (b === 'popup') {
    const cycle = e.timer % 3.2;
    e.state = cycle < 1.6 ? 'hidden' : 'out';
    e.y = e.baseY - e.h * (e.state === 'out' ? 1 : 0.25);
  } else if (b === 'shooter') {
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    e.dir = dx < 0 ? -1 : 1;
    if (e.timer > 2.2 && Math.abs(dx) < 380) {
      e.timer = 0;
      shots.push(makeProjectile('enemySun', e.x + e.w / 2, e.y + e.h / 2, e.dir * 190, 0));
    }
  } else if (b === 'floater') {
    e.y = e.baseY - e.h - 90 + Math.sin(e.timer * 1.5) * 26;
    e.x += e.vx * dt;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    if (e.timer > 2.6) {
      e.timer = 0;
      shots.push(makeProjectile('enemyIce', e.x + e.w / 2, e.y + e.h, 0, 150));
    }
  }
  return shots;
}

// ---------------- 투사체 ----------------
export const PROJECTILE_DEFS = {
  star:      { emoji: '⭐', w: 26, h: 26, friendly: true,  life: 1.2, gravity: 0,   power: 2 },
  feather:   { emoji: '🪶', w: 24, h: 24, friendly: true,  life: 0.7, gravity: 0,   power: 1 },
  sun:       { emoji: '✨', w: 24, h: 24, friendly: true,  life: 0.8, gravity: 0,   power: 1 },
  ice:       { emoji: '❄️', w: 22, h: 22, friendly: true,  life: 0.9, gravity: 0,   power: 1, freeze: true },
  water:     { emoji: '💧', w: 18, h: 18, friendly: true,  life: 0.7, gravity: 260, power: 1 },
  enemySun:  { emoji: '🔥', w: 22, h: 22, friendly: false, life: 2.2, gravity: 0,   power: 1 },
  enemyIce:  { emoji: '🧊', w: 22, h: 22, friendly: false, life: 2.6, gravity: 90,  power: 1 },
};

export function makeProjectile(kind, x, y, vx, vy) {
  const def = PROJECTILE_DEFS[kind];
  return {
    kind, def,
    x: x - def.w / 2, y: y - def.h / 2,
    w: def.w, h: def.h,
    vx, vy,
    life: def.life,
    alive: true,
  };
}

export function updateProjectiles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.vy += p.def.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || !p.alive) list.splice(i, 1);
  }
}

// ---------------- 아이템 ----------------
export const ITEM_DEFS = {
  coin:    { emoji: '🪙', image: null,            w: 22, h: 22, sfx: 'coin' },
  leaf:    { emoji: '🍃', image: null,            w: 28, h: 28, sfx: 'heal', heal: 1 },
  rainbow: { emoji: '🌈', image: null,            w: 34, h: 34, sfx: 'heal', healAll: true },
  candy:   { emoji: '⭐', image: null,            w: 30, h: 30, sfx: 'star', invincible: 8 },
  clover:  { emoji: '🍀', image: null,            w: 28, h: 28, sfx: 'heal', life: 1 },
  dew:     { emoji: '💧', image: 'item_dew.png',  w: 28, h: 28, sfx: 'coin', nutrient: 10, ability: 'water' },
  sun:     { emoji: '☀️', image: 'item_sun.png',  w: 28, h: 28, sfx: 'coin', nutrient: 15, ability: 'sun' },
  hail:    { emoji: '❄️', image: 'item_hail.png', w: 28, h: 28, sfx: 'bad',  nutrient: -10 },
};

export function makeItem(kind, x, y) {
  const def = ITEM_DEFS[kind];
  return {
    kind, def,
    x: x - def.w / 2, y: y - def.h / 2,
    w: def.w, h: def.h,
    baseY: y - def.h / 2,
    taken: false,
    t: Math.random() * 6,
  };
}

export function bobItems(items, dt) {
  for (const it of items) {
    if (it.taken) continue;
    it.t += dt;
    it.y = it.baseY + Math.sin(it.t * 3) * 4;
  }
}

export { rectsOverlap };
