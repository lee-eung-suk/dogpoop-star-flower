// 레벨 공통 런타임: 시뮬레이션 루프, 충돌, 카메라, 드로잉
import {
  LOGICAL_W, LOGICAL_H, drawSprite, drawParallax, Camera, Particles,
  Sound, rectsOverlap, showToast, randomEncouragement, drawStar,
  roundRect, drawShadow, Difficulty, Music,
} from './engine.js';
import {
  updateEnemy, updateProjectiles, bobItems, makeItem, makeIceBlock,
  ENEMY_DEFS, ABILITIES,
} from './entities.js';
import {
  createPlayer, resetPlayer, updatePlayer, hurtPlayer, drawPlayer, playerHitbox, P,
} from './player.js';

// ---------------- 발판 만들기 (레벨에서 쓰는 도우미) ----------------
export function solid(x, y, w, h, opts) {
  return Object.assign({ x, y, w, h: h || 18, color: '#c99a5b', topColor: '#8fd17a' }, opts || {});
}
export function ledge(x, y, w, opts) {
  return Object.assign({ x, y, w, h: 18, color: '#e0b989', topColor: '#8fd17a', oneWay: true }, opts || {});
}
// 좌우/위아래로 왕복하는 발판
export function mover(x, y, w, dx, dy, speed) {
  return {
    x, y, w, h: 18, color: '#d3b08a', topColor: '#8fd17a', oneWay: true,
    move: { ox: x, oy: y, dx, dy, speed: speed || 1, t: Math.random() * Math.PI * 2 },
  };
}
// 밟으면 잠시 뒤 무너지고, 조금 있다 되살아나는 발판
export function crumble(x, y, w) {
  return {
    x, y, w, h: 18, color: '#d9a066', topColor: '#c98a4b', oneWay: true,
    crumble: { state: 'idle', timer: 0 },
  };
}
// 점프대
export function springPad(x, y, w) {
  return { x, y, w: w || 70, h: 16, color: '#ff9f43', topColor: '#ffd93d', oneWay: true, spring: 980 };
}

// ---------------- 배경/지형 그리기 ----------------
function groundUnder(x, y, platforms) {
  let best = null;
  for (const pl of platforms) {
    if (pl.invisible || pl.hidden) continue;
    if (x < pl.x || x > pl.x + pl.w) continue;
    if (pl.y + 1 < y) continue;
    if (best === null || pl.y < best) best = pl.y;
  }
  return best;
}

function drawHills(ctx, camX, factor, baseY, amp, color, seed) {
  const off = camX * factor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-40, LOGICAL_H + 300);
  for (let x = -40; x <= LOGICAL_W + 40; x += 20) {
    const t = (x + off) * 0.0035 + seed;
    ctx.lineTo(x, baseY - (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4) * amp);
  }
  ctx.lineTo(LOGICAL_W + 40, LOGICAL_H + 300);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, pl, camX, camY) {
  const x = pl.x - camX;
  const y = pl.y - camY;
  const w = pl.w;
  const h = pl.h;
  const thin = h <= 24;

  ctx.save();
  if (pl.crumble && pl.crumble.state === 'shaking') {
    ctx.translate(Math.sin(pl.crumble.timer * 60) * 2.5, 0);
  }

  roundRect(ctx, x, y, w, h, thin ? 8 : 10);
  ctx.fillStyle = pl.color;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#7d5533';
  ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 26) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + 14, y + 10);
    ctx.stroke();
  }
  ctx.restore();

  roundRect(ctx, x, y, w, Math.min(thin ? 7 : 12, h), thin ? 6 : 8);
  ctx.fillStyle = pl.topColor;
  ctx.fill();

  // 종류별 표식 — 보면 바로 알 수 있게
  if (pl.spring) {
    ctx.fillStyle = '#e07a1f';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲▲▲', x + w / 2, y + h / 2);
  } else if (pl.move) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 12, y + h / 2 + 3);
    ctx.lineTo(x + w / 2 + 12, y + h / 2 + 3);
    ctx.stroke();
  } else if (pl.iceBlock) {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h - 8);
    ctx.lineTo(x + w / 2, y + 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (!thin || pl.oneWay) {
    ctx.strokeStyle = '#79c063';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 12; i < w - 8; i += 46) {
      const gx = x + i + ((pl.x + i) % 13);
      ctx.beginPath();
      ctx.moveTo(gx, y + 1);
      ctx.quadraticCurveTo(gx - 3, y - 6, gx - 5, y - 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx + 3, y + 1);
      ctx.quadraticCurveTo(gx + 6, y - 5, gx + 9, y - 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- 런타임 ----------------
export function createLevelRuntime(cfg) {
  const { canvasCtx, images, root, hud, input } = cfg;
  const ctx = canvasCtx.ctx;

  const camera = new Camera(cfg.world.w, cfg.world.h);
  const particles = new Particles();
  const player = createPlayer(cfg.spawn.x, cfg.spawn.y);

  const rt = {
    cfg, ctx, camera, particles, player, images, input, root, hud,
    platforms: [], enemies: [], items: [], projectiles: [],
    time: 0, running: false, rafId: null, lastTs: 0, paused: false,
    coins: 0, nutrient: 0, livesCarry: null,
    extra: {},
  };

  window.addEventListener('keydown', (e) => {
    if (!rt.running) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      rt.paused = !rt.paused;
      if (!rt.paused) rt.lastTs = performance.now();
      Music.duck(rt.paused);
      input.reset();
    }
  });

  const env = {
    input, particles, camera,
    platforms: rt.platforms,
    enemies: rt.enemies,
    projectiles: rt.projectiles,
    items: rt.items,
    world: cfg.world,
    abilityOf: (type) => (ENEMY_DEFS[type] ? ENEMY_DEFS[type].ability : null),
    onAbility: (key) => {
      if (key && ABILITIES[key]) {
        showToast(root, `${ABILITIES[key].icon} ${ABILITIES[key].name} — ${ABILITIES[key].tip}`, 2600);
      }
      updateHud();
    },
    onAbilityLost: (key, x, y) => {
      const it = makeItem('coin', x, y - 20);
      it.kind = 'ability';
      it.abilityKey = key;
      it.def = { emoji: ABILITIES[key].icon, image: null, w: 28, h: 28 };
      it.w = 28; it.h = 28;
      it.pickupDelay = 0.9;
      rt.items.push(it);
      updateHud();
    },
    onSpit: () => updateHud(),
  };
  rt.env = env;

  function rebuild() {
    rt.platforms.length = 0;
    rt.enemies.length = 0;
    rt.items.length = 0;
    rt.projectiles.length = 0;
    particles.list.length = 0;
    rt.extra = {};
    cfg.build(rt);
    rt.coins = 0;
    rt.nutrient = 0;
    rt.time = 0;
    rt.paused = false;
    resetPlayer(player, cfg.spawn.x, cfg.spawn.y);
    player.lives = rt.livesCarry != null ? rt.livesCarry : Difficulty.lives;
    camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
    if (cfg.onReset) cfg.onReset(rt);
    updateHud();
  }

  function updateHud() {
    if (cfg.renderHud) cfg.renderHud(rt);
  }
  rt.updateHud = updateHud;

  function killEnemy(e, opts) {
    const o = opts || {};
    e.alive = false;
    particles.spawn(e.x + e.w / 2, e.y + e.h / 2, o.big ? 20 : 14,
      ['#fff', '#ffd93d', '#ffb4c8'], { speed: o.big ? 260 : 190, star: true, size: 3.5 });
    rt.coins += e.def.score;
    Sound.stomp();
    camera.shake(o.big ? 6 : 3);
    updateHud();
  }
  rt.killEnemy = killEnemy;

  function freezeEnemyToBlock(e) {
    e.alive = false;
    const block = makeIceBlock(e.x - 6, e.y + e.h - 42, e.w, e.h);
    rt.platforms.push(block);
    particles.spawn(e.x + e.w / 2, e.y + e.h / 2, 16, ['#a8dcff', '#fff'], { speed: 160 });
    Sound.bad();
    rt.coins += e.def.score;
    updateHud();
  }

  function collectItem(it) {
    it.taken = true;
    const d = it.def;
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;

    if (it.kind === 'ability') {
      player.ability = it.abilityKey;
      Sound.ability();
      particles.spawn(cx, cy, 16, [ABILITIES[it.abilityKey].color, '#fff'], { speed: 180, star: true });
      updateHud();
      return;
    }
    if (d.heal) {
      player.hp = Math.min(player.maxHp, player.hp + d.heal);
      Sound.heal();
      particles.spawn(cx, cy, 12, ['#8fd17a', '#fff'], { speed: 150 });
    } else if (d.healAll) {
      player.hp = player.maxHp;
      Sound.heal();
      showToast(root, '체력이 가득 찼어! 🌈');
      particles.spawn(cx, cy, 24, ['#ff6b9d', '#ffd93d', '#6bcb77'], { speed: 220, star: true });
    } else if (d.invincible) {
      player.invincible = d.invincible;
      Sound.star();
      showToast(root, '무적이다! ⭐');
      particles.spawn(cx, cy, 26, ['#ffd93d', '#fff'], { speed: 240, star: true });
    } else if (d.life) {
      player.lives += 1;
      Sound.heal();
      showToast(root, '목숨 하나 추가! 🍀');
      particles.spawn(cx, cy, 16, ['#6bcb77', '#fff'], { speed: 180, star: true });
    } else {
      if (Sound[d.sfx]) Sound[d.sfx](); else Sound.coin();
      particles.spawn(cx, cy, 8, ['#ffd93d'], { speed: 120 });
    }

    if (d.nutrient) {
      rt.nutrient = Math.max(0, Math.min(100, rt.nutrient + d.nutrient));
      if (d.nutrient < 0) camera.shake(4);
    } else if (!d.heal && !d.healAll && !d.invincible && !d.life && !d.piece) {
      rt.coins += 1;
    }
    if (rt.coins >= 100) {
      rt.coins -= 100;
      player.lives += 1;
      showToast(root, '코인 100개! 목숨 +1 🍀');
    }
    updateHud();
    if (cfg.onCollect) cfg.onCollect(rt, it);
  }
  rt.collectItem = collectItem;

  // 레벨(보스 등)에서 플레이어에게 피해를 줄 때 쓴다.
  // 죽으면 목숨 처리까지 여기서 끝내고 true 를 돌려준다.
  rt.hurtPlayer = (fromX) => {
    if (!hurtPlayer(player, env, fromX)) return false;
    updateHud();
    if (player.dead) { loseLife(); return true; }
    return true;
  };

  function loseLife() {
    player.lives -= 1;
    Sound.fail();
    camera.shake(14);
    if (player.lives <= 0) {
      showToast(root, '괜찮아, 처음부터 다시 해보자! 🌱');
      rt.livesCarry = Difficulty.lives;
    } else {
      showToast(root, `괜찮아, 다시! (남은 목숨 ${player.lives}) 🌱`);
      rt.livesCarry = player.lives;
    }
    rt.running = false;
    setTimeout(() => {
      rebuild();
      rt.running = true;
      rt.lastTs = performance.now();
      rt.rafId = requestAnimationFrame(loop);
    }, 1100);
  }

  // ---- 발판 갱신 (움직임 / 무너짐 / 얼음 수명) ----
  function updatePlatforms(dt) {
    for (let i = rt.platforms.length - 1; i >= 0; i--) {
      const pl = rt.platforms[i];

      if (pl.move) {
        const m = pl.move;
        m.t += dt * m.speed;
        const s = Math.sin(m.t);
        pl.prevX = pl.x;
        pl.prevY = pl.y;
        pl.x = m.ox + s * m.dx;
        pl.y = m.oy + s * m.dy;
      }

      if (pl.crumble) {
        const c = pl.crumble;
        if (c.state === 'shaking') {
          c.timer -= dt;
          if (c.timer <= 0) {
            c.state = 'gone';
            c.timer = 2.6;
            pl.hidden = true;
            pl.oneWay = true;
            pl.noCollide = true;
            particles.spawn(pl.x + pl.w / 2, pl.y, 12, ['#d9a066', '#c98a4b'], { speed: 130 });
          }
        } else if (c.state === 'gone') {
          c.timer -= dt;
          if (c.timer <= 0) {
            c.state = 'idle';
            pl.hidden = false;
            pl.noCollide = false;
          }
        }
      }

      if (pl.iceBlock) {
        pl.life -= dt;
        if (pl.life <= 0) {
          particles.spawn(pl.x + pl.w / 2, pl.y + pl.h / 2, 12, ['#a8dcff', '#fff'], { speed: 140 });
          rt.platforms.splice(i, 1);
        }
      }
    }
  }

  function collidablePlatforms() {
    return rt.platforms.filter((pl) => !pl.noCollide);
  }

  function update(dt) {
    rt.time += dt;

    updatePlatforms(dt);

    // 움직이는 발판이 플레이어를 태우고 간다
    const carrier = player.groundPlatform;
    if (carrier && carrier.move && carrier.prevX != null) {
      player.x += carrier.x - carrier.prevX;
      player.y += carrier.y - carrier.prevY;
    }

    env.platforms = collidablePlatforms();
    updatePlayer(player, dt, Object.assign(env, { platforms: env.platforms }));

    // 밟은 발판의 반응 (점프대 / 무너짐)
    const gp = player.groundPlatform;
    if (gp) {
      if (gp.spring && player.vy >= 0) {
        player.vy = -gp.spring;
        player.jumpsUsed = 0;
        player.hovering = false;
        player.squash = 0.7;
        Sound.doubleJump();
        particles.spawn(player.x + player.w / 2, player.y + player.h, 14, ['#ffd93d', '#ff9f43'],
          { speed: 190, lift: 40, star: true });
        camera.shake(4);
      }
      if (gp.crumble && gp.crumble.state === 'idle') {
        gp.crumble.state = 'shaking';
        gp.crumble.timer = 0.55;
      }
    }

    // 적
    for (const e of rt.enemies) {
      if (!e.alive) continue;
      const shots = updateEnemy(e, dt, player);
      for (const s of shots) rt.projectiles.push(s);
    }

    updateProjectiles(rt.projectiles, dt, collidablePlatforms());
    bobItems(rt.items, dt);

    // 투사체 판정
    for (const pr of rt.projectiles) {
      if (!pr.alive) continue;

      if (pr.def.friendly) {
        for (const e of rt.enemies) {
          if (!e.alive || !rectsOverlap(pr, e)) continue;
          if (pr.hitSet) {
            if (pr.hitSet.has(e)) continue;
            pr.hitSet.add(e);
          }
          if (pr.def.freeze) freezeEnemyToBlock(e);
          else killEnemy(e, { big: pr.kind === 'star' });
          if (!pr.def.pierce) { pr.alive = false; break; }
        }
        if (pr.alive && cfg.bossRef) {
          const b = cfg.bossRef(rt);
          if (b && b.alive && b.state !== 'sleep' && b.state !== 'intro' && b.state !== 'dead') {
            const hb = { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
            if (rectsOverlap(pr, hb) && !(pr.hitSet && pr.hitSet.has(b))) {
              if (pr.hitSet) pr.hitSet.add(b);
              if (!pr.def.pierce) pr.alive = false;
              if (cfg.onBossHit) cfg.onBossHit(rt, pr);
            }
          }
        }
      } else if (rectsOverlap(pr, playerHitbox(player))) {
        if (player.invincible > 0 || player.rolling) {
          pr.alive = false;
        } else if (hurtPlayer(player, env, pr.x)) {
          pr.alive = false;
          updateHud();
          if (player.dead) { loseLife(); return; }
        }
      }
    }

    // 능력 근접 판정 (덩굴 채찍)
    if (player.attackHitbox) {
      for (const e of rt.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(player.attackHitbox, e)) killEnemy(e, { big: true });
      }
    }

    // 플레이어 vs 적
    const phb = playerHitbox(player);
    for (const e of rt.enemies) {
      if (!e.alive) continue;
      if (e.def.behavior === 'popup' && e.state === 'hidden') continue;
      if (!rectsOverlap(phb, e)) continue;

      if (player.invincible > 0 || player.rolling) { killEnemy(e); continue; }
      const stomping = player.vy > 60 && (player.y + player.h - e.y) < 26;
      if (stomping) {
        killEnemy(e, { big: true });
        player.vy = P.JUMP_V * 0.6;
        player.jumpsUsed = 1;
      } else if (hurtPlayer(player, env, e.x + e.w / 2)) {
        updateHud();
        if (player.dead) { loseLife(); return; }
      }
    }

    // 아이템
    for (const it of rt.items) {
      if (it.taken || it.pickupDelay > 0) continue;
      if (rectsOverlap(phb, it)) collectItem(it);
    }

    // 낙사
    if (player.y > (cfg.world.h || LOGICAL_H) + 160) {
      player.hp = 0;
      player.dead = true;
      loseLife();
      return;
    }

    for (let i = rt.enemies.length - 1; i >= 0; i--) if (!rt.enemies[i].alive) rt.enemies.splice(i, 1);
    for (let i = rt.items.length - 1; i >= 0; i--) if (rt.items[i].taken) rt.items.splice(i, 1);

    particles.update(dt);

    // 카메라: 줌은 연출용으로만 쓴다. 평상시 1로 고정 — 속도에 따라 계속 변하면 어지럽다.
    camera.follow(player.x + player.w / 2, player.y + player.h / 2, dt);
    camera.update(dt);

    if (cfg.onUpdate) cfg.onUpdate(rt, dt);
    if (Math.random() < 0.0012) showToast(root, randomEncouragement());
  }

  // ---------------- 드로잉 ----------------
  function drawWorld() {
    const camX = camera.x;
    const camY = camera.y;

    const sky = ctx.createLinearGradient(0, -200, 0, LOGICAL_H + 200);
    sky.addColorStop(0, cfg.skyTop || '#9fd8f7');
    sky.addColorStop(0.55, cfg.skyColor || '#cbe6ff');
    sky.addColorStop(1, cfg.skyBottom || '#eaf6e6');
    ctx.fillStyle = sky;
    ctx.fillRect(-300, -300, LOGICAL_W + 600, LOGICAL_H + 600);

    drawHills(ctx, camX, 0.08, LOGICAL_H * 0.62 - camY * 0.05, 26, 'rgba(150,205,190,0.55)', 0);
    drawHills(ctx, camX, 0.14, LOGICAL_H * 0.70 - camY * 0.08, 34, 'rgba(126,193,163,0.6)', 2.1);

    if (cfg.bgImage && images[cfg.bgImage]) {
      ctx.save();
      ctx.globalAlpha = cfg.bgAlpha != null ? cfg.bgAlpha : 0.9;
      const bgY = -110 - camY * (cfg.bgFactorY != null ? cfg.bgFactorY : 0.05);
      drawParallax(ctx, images[cfg.bgImage], camX, cfg.bgFactor || 0.3, bgY, LOGICAL_H + 300, LOGICAL_W);
      ctx.restore();
    }

    if (cfg.drawBack) cfg.drawBack(rt, ctx, camX, camY);

    for (const pl of rt.platforms) {
      if (pl.invisible || pl.hidden) continue;
      if (pl.x - camX > LOGICAL_W + 200 || pl.x + pl.w - camX < -200) continue;
      drawTerrain(ctx, pl, camX, camY);
    }

    for (const it of rt.items) {
      if (it.taken) continue;
      const ix = it.x - camX;
      const iy = it.y - camY;
      if (ix > LOGICAL_W + 120 || ix + it.w < -120) continue;
      if (it.kind === 'coin') {
        const r = it.w / 2;
        ctx.beginPath();
        ctx.arc(ix + r, iy + r, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd93d';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#e0a300';
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(ix + r * 0.72, iy + r * 0.66, r * 0.22, r * 0.36, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fill();
        continue;
      }
      if (it.kind === 'ability') {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(rt.time * 6) * 0.25;
        ctx.fillStyle = ABILITIES[it.abilityKey].color;
        ctx.beginPath();
        ctx.arc(ix + it.w / 2, iy + it.h / 2, it.w * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawSprite(ctx, images, it.def.image, it.def.emoji, ix, iy, it.w, it.h, false);
    }

    for (const e of rt.enemies) {
      if (!e.alive) continue;
      if (e.def.behavior === 'popup' && e.state === 'hidden') continue;
      const gy = groundUnder(e.x + e.w / 2, e.y + e.h, rt.platforms);
      if (gy != null) drawShadow(ctx, e.x + e.w / 2 - camX, gy - camY, e.w, gy - (e.y + e.h));
      ctx.save();
      if (e.frozen > 0) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#a8dcff';
        ctx.fillRect(e.x - camX - 3, e.y - camY - 3, e.w + 6, e.h + 6);
      }
      drawSprite(ctx, images, e.def.image, e.def.emoji, e.x - camX, e.y - camY, e.w, e.h, e.dir < 0);
      ctx.restore();
    }

    if (cfg.drawMid) cfg.drawMid(rt, ctx, camX, camY);

    if (player.inhaling) {
      ctx.save();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = '#ffffff';
      const tipX = player.facing > 0 ? player.x + player.w + P.INHALE_RANGE : player.x - P.INHALE_RANGE;
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2 - camX, player.y + player.h / 2 - camY);
      ctx.lineTo(tipX - camX, player.y - 30 - camY);
      ctx.lineTo(tipX - camX, player.y + player.h + 30 - camY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (player.attackHitbox) {
      const hb = player.attackHitbox;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#8fd17a';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        player.x + player.w / 2 - camX, player.y + player.h / 2 - camY,
        hb.w * 0.8,
        player.facing > 0 ? -0.9 : Math.PI - 0.9,
        player.facing > 0 ? 0.9 : Math.PI + 0.9
      );
      ctx.stroke();
      ctx.restore();
    }

    for (const pr of rt.projectiles) {
      if (!pr.alive) continue;
      const px = pr.x - camX;
      const py = pr.y - camY;
      const r = pr.def.render;
      if (r === 'star') {
        ctx.fillStyle = '#ffd93d';
        drawStar(ctx, px + pr.w / 2, py + pr.h / 2, pr.w * 0.6);
      } else if (r === 'beam') {
        ctx.save();
        ctx.globalAlpha = Math.max(0.35, pr.life / pr.def.life);
        const g = ctx.createLinearGradient(px, 0, px + pr.w, 0);
        g.addColorStop(0, 'rgba(255,240,180,0.2)');
        g.addColorStop(0.5, '#ffe98a');
        g.addColorStop(1, 'rgba(255,240,180,0.2)');
        ctx.fillStyle = g;
        roundRect(ctx, px, py, pr.w, pr.h, pr.h / 2);
        ctx.fill();
        ctx.restore();
      } else if (r === 'tornado') {
        ctx.save();
        ctx.globalAlpha = Math.max(0.25, pr.life / pr.def.life) * 0.85;
        ctx.strokeStyle = '#f3e0ae';
        ctx.lineWidth = 4;
        for (let k = 0; k < 4; k++) {
          const t = pr.age * 9 + k;
          const yy = py + (k / 3) * pr.h;
          const rr = 8 + (1 - k / 3) * 15;
          ctx.beginPath();
          ctx.ellipse(px + pr.w / 2 + Math.sin(t) * 4, yy, rr, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        drawSprite(ctx, images, null, pr.def.emoji, px, py, pr.w, pr.h, false);
      }
    }

    const pgy = groundUnder(player.x + player.w / 2, player.y + player.h, rt.platforms);
    if (pgy != null) drawShadow(ctx, player.x + player.w / 2 - camX, pgy - camY, player.w, pgy - (player.y + player.h));
    drawPlayer(ctx, images, player, camX, camY, drawSprite);
    particles.draw(ctx, camX, camY);

    if (cfg.drawFront) cfg.drawFront(rt, ctx, camX, camY);
  }

  function drawOverlay() {
    const g = ctx.createRadialGradient(
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.45,
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.95
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,12,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (cfg.drawOverlay) cfg.drawOverlay(rt, ctx);

    if (rt.paused) {
      ctx.fillStyle = 'rgba(20,16,10,0.55)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('일시정지', LOGICAL_W / 2, LOGICAL_H / 2 - 12);
      ctx.font = '20px sans-serif';
      ctx.fillText('ESC 또는 P 를 눌러 계속하기', LOGICAL_W / 2, LOGICAL_H / 2 + 34);
    }
  }

  function loop(ts) {
    if (!rt.running) return;
    let dt = Math.min(0.05, (ts - rt.lastTs) / 1000);
    rt.lastTs = ts;
    if (rt.paused) dt = 0;
    if (camera.isFrozen()) { camera.update(dt); dt = 0; }
    if (dt > 0) update(dt);
    if (!rt.running) return;
    canvasCtx.beginFrame(camera);
    drawWorld();
    canvasCtx.beginOverlay();
    drawOverlay();
    rt.rafId = requestAnimationFrame(loop);
  }

  return {
    rt,
    start() {
      rt.livesCarry = null;
      rebuild();
      rt.running = true;
      rt.lastTs = performance.now();
      rt.rafId = requestAnimationFrame(loop);
    },
    stop() {
      rt.running = false;
      if (rt.rafId) cancelAnimationFrame(rt.rafId);
      input.reset();
    },
    finish() {
      rt.running = false;
      if (rt.rafId) cancelAnimationFrame(rt.rafId);
    },
  };
}

export { makeItem, showToast, Sound, drawSprite, rectsOverlap };
