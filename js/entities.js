// 적 / 아이템 / 투사체 정의
import { rectsOverlap, Difficulty } from './engine.js';

// ---------------- 복사 능력 ----------------
// 5종이 서로 "쓰는 법"이 달라야 의미가 있다.
// 단순히 색만 다른 탄을 쏘면 다 똑같이 느껴지므로, 사거리·판정·용도를 전부 다르게 잡았다.
export const ABILITIES = {
  sun: {
    name: '햇살', icon: '☀️', color: '#ffd15c', cooldown: 0.5,
    tip: '앞으로 길게 뻗는 관통 빔 — 한 줄로 선 적을 한 번에',
  },
  water: {
    name: '이슬', icon: '💧', color: '#8ecdf7', cooldown: 0.42,
    tip: '바닥에 튕기는 물방울 3발 — 발판 아래나 구석의 적에게',
  },
  vine: {
    name: '새싹', icon: '🌱', color: '#8fd17a', cooldown: 0.3,
    tip: '넓게 후려치는 덩굴 채찍 — 가까이 붙은 적을 한꺼번에 날려버린다',
  },
  feather: {
    name: '깃털', icon: '🪶', color: '#f6e3b4', cooldown: 0.9, glide: true,
    tip: '그 자리에 회오리를 세운다 — 잠시 남아 계속 때린다 / 점프 유지로 활공',
  },
  ice: {
    name: '얼음', icon: '❄️', color: '#a8dcff', cooldown: 0.55,
    tip: '적을 얼려 얼음 블록으로 — 밟고 올라서면 높은 곳에 닿는다',
  },
};

// ---------------- 적 ----------------
export const ENEMY_DEFS = {
  chick: {
    label: '삐약이', emoji: '🐤', image: null, w: 30, h: 28,
    speed: 42, ability: null, score: 1, behavior: 'walk',
  },
  hen: {
    label: '꼬꼬', emoji: '🐔', image: 'enemy_hen.png', w: 44, h: 40,
    speed: 52, ability: 'feather', score: 3, behavior: 'charge',
  },
  sparrow: {
    label: '참새', emoji: '🐦', image: null, w: 32, h: 28,
    speed: 76, ability: null, score: 2, behavior: 'fly',
  },
  sprout: {
    label: '새싹이', emoji: '🌱', image: 'sprout.png', w: 32, h: 34,
    speed: 0, ability: 'vine', score: 2, behavior: 'popup',
  },
  hotchi: {
    label: '핫치', emoji: '🔥', image: null, w: 34, h: 32,
    speed: 0, ability: 'sun', score: 3, behavior: 'shooter',
  },
  frost: {
    label: '우박정령', emoji: '❄️', image: 'item_hail.png', w: 34, h: 32,
    speed: 28, ability: 'ice', score: 3, behavior: 'floater',
  },
  bubble: {
    label: '물방울이', emoji: '🫧', image: null, w: 30, h: 30,
    speed: 36, ability: 'water', score: 2, behavior: 'floater',
  },
};

export function makeEnemy(type, x, y, opts) {
  const def = ENEMY_DEFS[type];
  const o = opts || {};
  return {
    type, def,
    x: x - def.w / 2, y: y - def.h,
    w: def.w, h: def.h,
    vx: (o.dir || 1) * def.speed * Difficulty.enemySpeed, vy: 0,
    dir: o.dir || 1,
    baseX: x, baseY: y,
    range: o.range || 80,
    alive: true,
    timer: Math.random() * 2,
    state: 'idle',
    frozen: 0,
    sucked: false,
    hitFlash: 0,
  };
}

export function updateEnemy(e, dt, player) {
  const shots = [];
  if (!e.alive) return shots;
  if (e.hitFlash > 0) e.hitFlash -= dt;

  // 빨려 들어가는 중에는 AI를 멈춘다.
  // (안 멈추면 순찰 범위로 매 프레임 되돌아가서 입까지 끌려오지 못한다)
  if (e.sucked) {
    e.sucked = false;
    return shots;
  }
  if (e.frozen > 0) {
    e.frozen -= dt;
    e.vx = 0;
    return shots;
  }
  e.timer += dt;

  const b = e.def.behavior;
  if (b === 'walk') {
    e.x += e.vx * dt;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    e.dir = e.vx < 0 ? -1 : 1;
  } else if (b === 'charge') {
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    const near = Math.abs(dx) < 250 && Math.abs(player.y - e.y) < 110;
    if (near) e.dir = dx < 0 ? -1 : 1;
    else {
      if (e.x < e.baseX - e.range) e.dir = 1;
      if (e.x > e.baseX + e.range) e.dir = -1;
    }
    e.vx = e.dir * e.def.speed * Difficulty.enemySpeed * (near ? 1.7 : 1);
    e.x += e.vx * dt;
    e.state = near ? 'charge' : 'idle';
  } else if (b === 'fly') {
    e.x += e.vx * dt;
    e.y = e.baseY - e.h - 62 + Math.sin(e.timer * 2.2) * 44;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    e.dir = e.vx < 0 ? -1 : 1;
  } else if (b === 'popup') {
    const cycle = e.timer % 3.4;
    e.state = cycle < 1.8 ? 'hidden' : 'out';
    e.y = e.baseY - e.h * (e.state === 'out' ? 1 : 0.2);
  } else if (b === 'shooter') {
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    e.dir = dx < 0 ? -1 : 1;
    if (e.timer > 2.4 && Math.abs(dx) < 360) {
      e.timer = 0;
      shots.push(makeProjectile('enemyShot', e.x + e.w / 2, e.y + e.h / 2, e.dir * 180, 0));
    }
  } else if (b === 'floater') {
    e.y = e.baseY - e.h - 88 + Math.sin(e.timer * 1.5) * 24;
    e.x += e.vx * dt;
    if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.vx = Math.abs(e.vx); }
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.vx = -Math.abs(e.vx); }
    const dx = Math.abs((player.x + player.w / 2) - (e.x + e.w / 2));
    if (e.timer > 2.8 && dx < 320) {
      e.timer = 0;
      shots.push(makeProjectile('enemyDrop', e.x + e.w / 2, e.y + e.h, 0, 140));
    }
  }
  return shots;
}

// ---------------- 투사체 ----------------
// pierce: 적을 맞혀도 사라지지 않음 / bounces: 지면 튕김 횟수 / linger: 제자리 지속 판정
export const PROJECTILE_DEFS = {
  star:      { emoji: '⭐', w: 26, h: 26, friendly: true,  life: 1.3, gravity: 0,   render: 'star' },
  sunbeam:   { emoji: '✨', w: 42, h: 14, friendly: true,  life: 0.55, gravity: 0,  pierce: true, render: 'beam' },
  droplet:   { emoji: '💧', w: 18, h: 18, friendly: true,  life: 1.6, gravity: 760, bounces: 2, render: 'emoji' },
  tornado:   { emoji: '🌀', w: 46, h: 74, friendly: true,  life: 1.5, gravity: 0,   pierce: true, linger: true, render: 'tornado' },
  iceshot:   { emoji: '❄️', w: 24, h: 24, friendly: true,  life: 0.9, gravity: 0,   freeze: true, render: 'emoji' },
  enemyShot: { emoji: '🔥', w: 22, h: 22, friendly: false, life: 2.2, gravity: 0,   render: 'emoji' },
  enemyDrop: { emoji: '🧊', w: 22, h: 22, friendly: false, life: 2.6, gravity: 110, render: 'emoji' },
};

export function makeProjectile(kind, x, y, vx, vy) {
  const def = PROJECTILE_DEFS[kind];
  return {
    kind, def,
    x: x - def.w / 2, y: y - def.h / 2,
    w: def.w, h: def.h,
    vx, vy,
    life: def.life,
    bounces: def.bounces || 0,
    alive: true,
    hitSet: def.pierce ? new Set() : null,   // 관통탄이 같은 적을 매 프레임 때리지 않도록
    age: 0,
  };
}

export function updateProjectiles(list, dt, platforms) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    p.life -= dt;

    if (p.def.linger) {
      // 회오리는 제자리에서 아주 천천히 흐른다
      p.x += p.vx * dt * 0.25;
    } else {
      p.vy += p.def.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 지면 튕김
      if (p.bounces > 0 && p.vy > 0 && platforms) {
        for (const pl of platforms) {
          if (pl.invisible) continue;
          if (p.x + p.w < pl.x || p.x > pl.x + pl.w) continue;
          const top = pl.y;
          if (p.y + p.h >= top && p.y + p.h - p.vy * dt <= top + 4) {
            p.y = top - p.h;
            p.vy = -Math.abs(p.vy) * 0.62;
            p.vx *= 0.86;
            p.bounces -= 1;
            break;
          }
        }
      }
    }

    if (p.life <= 0 || !p.alive) list.splice(i, 1);
  }
}

// ---------------- 얼음 블록 ----------------
// 얼음 능력으로 언 적은 "밟고 올라설 수 있는 발판"이 된다. 이게 이 능력의 존재 이유다.
export function makeIceBlock(x, y, w, h) {
  return {
    x, y, w: Math.max(46, w + 12), h: Math.max(42, h + 10),
    color: '#bfe6ff', topColor: '#eaf7ff',
    iceBlock: true, life: 7,
  };
}

// ---------------- 아이템 ----------------
export const ITEM_DEFS = {
  coin:    { emoji: '🪙', image: null,            w: 22, h: 22, sfx: 'coin' },
  leaf:    { emoji: '🍃', image: null,            w: 28, h: 28, sfx: 'heal', heal: 1 },
  rainbow: { emoji: '🌈', image: null,            w: 34, h: 34, sfx: 'heal', healAll: true },
  candy:   { emoji: '⭐', image: null,            w: 30, h: 30, sfx: 'star', invincible: 8 },
  clover:  { emoji: '🍀', image: null,            w: 28, h: 28, sfx: 'heal', life: 1 },
  dew:     { emoji: '💧', image: 'item_dew.png',  w: 28, h: 28, sfx: 'coin', nutrient: 10 },
  sun:     { emoji: '☀️', image: 'item_sun.png',  w: 28, h: 28, sfx: 'coin', nutrient: 15 },
  hail:    { emoji: '❄️', image: 'item_hail.png', w: 28, h: 28, sfx: 'bad',  nutrient: -10 },
  piece:   { emoji: '✨', image: null,            w: 30, h: 30, sfx: 'star', piece: true },
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
