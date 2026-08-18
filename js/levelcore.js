// 레벨 공통 런타임: 시뮬레이션 루프, 충돌, 다이나믹 카메라, 드로잉
import {
  LOGICAL_W, LOGICAL_H, drawSprite, drawParallax, Camera, Particles,
  Sound, rectsOverlap, showToast, randomEncouragement, drawStar,
  roundRect, drawShadow,
} from './engine.js';
import {
  updateEnemy, updateProjectiles, bobItems, makeItem, makeProjectile,
  ENEMY_DEFS, ITEM_DEFS, ABILITIES,
} from './entities.js';
import {
  createPlayer, resetPlayer, updatePlayer, hurtPlayer, drawPlayer, playerHitbox, P,
} from './player.js';


// 대상 아래에서 가장 가까운 발판 윗면 y (그림자용)
function groundUnder(x, y, platforms) {
  let best = null;
  for (const pl of platforms) {
    if (pl.invisible) continue;
    if (x < pl.x || x > pl.x + pl.w) continue;
    if (pl.y + 1 < y) continue;
    if (best === null || pl.y < best) best = pl.y;
  }
  return best;
}

// 멀리 있는 언덕 — 절차적으로 그려 배경에 깊이를 준다
function drawHills(ctx, camX, factor, baseY, amp, color, seed) {
  const off = camX * factor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-40, LOGICAL_H + 200);
  for (let x = -40; x <= LOGICAL_W + 40; x += 20) {
    const t = (x + off) * 0.0035 + seed;
    const y = baseY - (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(LOGICAL_W + 40, LOGICAL_H + 200);
  ctx.closePath();
  ctx.fill();
}

// 지형 한 덩이 — 흙 + 잔디 + 풀포기
function drawTerrain(ctx, pl, camX, camY) {
  const x = pl.x - camX;
  const y = pl.y - camY;
  const w = pl.w;
  const h = pl.h;
  const thin = h <= 24;

  ctx.save();
  roundRect(ctx, x, y, w, h, thin ? 8 : 10);
  ctx.fillStyle = pl.color || '#c99a5b';
  ctx.fill();

  // 흙 결
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
  ctx.globalAlpha = 1;
  ctx.restore();

  // 잔디 윗면
  ctx.save();
  roundRect(ctx, x, y, w, Math.min(thin ? 7 : 12, h), thin ? 6 : 8);
  ctx.fillStyle = pl.topColor || '#8fd17a';
  ctx.fill();
  ctx.restore();

  // 풀포기
  ctx.save();
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
  ctx.restore();
}

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
    coins: 0, nutrient: 0, complete: false,
    extra: {},
  };

  window.addEventListener('keydown', (e) => {
    if (!rt.running) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      rt.paused = !rt.paused;
      if (!rt.paused) rt.lastTs = performance.now();
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
    abilityOf: (enemyType) => (ENEMY_DEFS[enemyType] ? ENEMY_DEFS[enemyType].ability : null),
    onAbility: (key) => {
      if (key && ABILITIES[key]) showToast(root, `${ABILITIES[key].icon} ${ABILITIES[key].name} 능력을 얻었다!`);
    },
    onAbilityLost: (key, x, y) => {
      const it = makeItem('coin', x, y - 20);
      it.kind = 'ability';
      it.abilityKey = key;
      it.def = { emoji: ABILITIES[key].icon, image: null, w: 28, h: 28, sfx: 'ability' };
      it.w = 28; it.h = 28;
      rt.items.push(it);
    },
  };
  rt.env = env;

  function rebuild() {
    rt.platforms.length = 0;
    rt.enemies.length = 0;
    rt.items.length = 0;
    rt.projectiles.length = 0;
    particles.list.length = 0;
    cfg.build(rt);
    rt.coins = 0;
    rt.nutrient = 0;
    rt.complete = false;
    rt.time = 0;
    resetPlayer(player, cfg.spawn.x, cfg.spawn.y);
    player.lives = rt.livesCarry != null ? rt.livesCarry : 3;
    camera.zoom = 1;
    camera.targetZoom = 1;
    camera.x = 0;
    camera.y = 0;
    camera.follow(player.x + player.w / 2, player.y, 1, 0);
    if (cfg.onReset) cfg.onReset(rt);
    updateHud();
  }

  function updateHud() {
    if (cfg.renderHud) cfg.renderHud(rt);
  }
  rt.updateHud = updateHud;

  function killEnemy(e, fromStomp) {
    e.alive = false;
    particles.spawn(e.x + e.w / 2, e.y + e.h / 2, 14, ['#fff', '#ffd93d', '#ffb4c8'], { speed: 190, star: true, size: 3.5 });
    rt.coins += e.def.score;
    Sound.stomp();
    camera.shake(fromStomp ? 6 : 4);
    updateHud();
  }
  rt.killEnemy = killEnemy;

  function collectItem(it) {
    it.taken = true;
    const d = it.def;
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    if (it.kind === 'ability') {
      player.ability = it.abilityKey;
      Sound.ability();
      camera.freeze(0.2);
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
      particles.spawn(cx, cy, 24, ['#ff6b9d', '#ffd93d', '#6bcb77', '#4dd0e1'], { speed: 220, star: true });
    } else if (d.invincible) {
      player.invincible = d.invincible;
      Sound.star();
      showToast(root, '무적이다! ⭐');
      camera.setZoom(0.92);
      setTimeout(() => camera.setZoom(1), 800);
      particles.spawn(cx, cy, 26, ['#ffd93d', '#fff'], { speed: 240, star: true });
    } else if (d.life) {
      player.lives += 1;
      Sound.heal();
      showToast(root, '목숨 하나 추가! 🍀');
      particles.spawn(cx, cy, 16, ['#6bcb77', '#fff'], { speed: 180, star: true });
    } else {
      Sound[d.sfx] ? Sound[d.sfx]() : Sound.coin();
      particles.spawn(cx, cy, 8, ['#ffd93d'], { speed: 120 });
    }
    if (d.nutrient) {
      rt.nutrient = Math.max(0, Math.min(100, rt.nutrient + d.nutrient));
      if (d.nutrient < 0) camera.shake(5);
    }
    if (!d.nutrient && !d.heal && !d.healAll && !d.invincible && !d.life) rt.coins += 1;
    if (rt.coins >= 100) { rt.coins -= 100; player.lives += 1; showToast(root, '코인 100개! 목숨 +1 🍀'); }
    updateHud();
    if (cfg.onCollect) cfg.onCollect(rt, it);
  }
  rt.collectItem = collectItem;

  function loseLife() {
    player.lives -= 1;
    Sound.fail();
    camera.shake(16);
    if (player.lives <= 0) {
      showToast(root, '괜찮아, 처음부터 다시 해보자! 🌱');
      rt.livesCarry = 3;
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

  function update(dt) {
    rt.time += dt;

    updatePlayer(player, dt, env);

    // 적
    for (const e of rt.enemies) {
      if (!e.alive) continue;
      const shots = updateEnemy(e, dt, player, rt.platforms, P.GRAVITY);
      for (const s of shots) rt.projectiles.push(s);
    }

    updateProjectiles(rt.projectiles, dt);
    bobItems(rt.items, dt);

    // 투사체 vs 적 / 플레이어
    for (const pr of rt.projectiles) {
      if (!pr.alive) continue;
      if (pr.def.friendly) {
        for (const e of rt.enemies) {
          if (!e.alive) continue;
          if (rectsOverlap(pr, e)) {
            if (pr.def.freeze) { e.frozen = 2.5; }
            killEnemy(e, false);
            pr.alive = false;
            break;
          }
        }
        if (pr.alive && cfg.bossRef && cfg.bossRef(rt)) {
          const b = cfg.bossRef(rt);
          if (b.alive && b.state !== 'sleep' && b.state !== 'intro' && b.state !== 'dead') {
            const hb = { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h };
            if (rectsOverlap(pr, hb)) {
              pr.alive = false;
              if (cfg.onBossHit) cfg.onBossHit(rt, pr);
            }
          }
        }
      } else {
        if (rectsOverlap(pr, playerHitbox(player))) {
          if (player.invincible > 0 || player.rolling) {
            pr.alive = false;
          } else if (hurtPlayer(player, env, pr.x)) {
            pr.alive = false;
            updateHud();
            if (player.dead) { loseLife(); return; }
          }
        }
      }
    }

    // 플레이어 vs 적
    const phb = playerHitbox(player);
    for (const e of rt.enemies) {
      if (!e.alive) continue;
      if (e.def.behavior === 'popup' && e.state === 'hidden') continue;
      if (!rectsOverlap(phb, e)) continue;

      if (player.invincible > 0 || player.rolling) {
        killEnemy(e, false);
        continue;
      }
      if (player.attackHitbox && rectsOverlap(player.attackHitbox, e)) {
        killEnemy(e, false);
        continue;
      }
      const stomping = player.vy > 60 && (player.y + player.h - e.y) < 26;
      if (stomping) {
        killEnemy(e, true);
        player.vy = P.JUMP_V * 0.58;
        player.jumpsUsed = 1;
      } else if (hurtPlayer(player, env, e.x + e.w / 2)) {
        updateHud();
        if (player.dead) { loseLife(); return; }
      }
    }

    // 능력 근접 공격 판정 (적과 겹치지 않아도 맞도록)
    if (player.attackHitbox) {
      for (const e of rt.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(player.attackHitbox, e)) killEnemy(e, false);
      }
    }

    // 아이템
    for (const it of rt.items) {
      if (it.taken) continue;
      if (rectsOverlap(phb, it)) collectItem(it);
    }

    // 낙사
    if (player.y > (cfg.world.h || LOGICAL_H) + 160) {
      player.hp = 0;
      player.dead = true;
      loseLife();
      return;
    }

    // 죽은 적/아이템 정리
    for (let i = rt.enemies.length - 1; i >= 0; i--) if (!rt.enemies[i].alive) rt.enemies.splice(i, 1);
    for (let i = rt.items.length - 1; i >= 0; i--) if (rt.items[i].taken) rt.items.splice(i, 1);

    particles.update(dt);

    // ---- 다이나믹 카메라 ----
    if (!cfg.manualCamera) {
      const speedRatio = Math.min(1, Math.abs(player.vx) / P.RUN_MAX);
      let targetZoom = 1 - speedRatio * 0.12;
      if (player.rolling) targetZoom = 0.86;
      if (player.hovering) targetZoom = Math.min(targetZoom, 0.93);
      if (cfg.zoomOverride) targetZoom = cfg.zoomOverride(rt, targetZoom);
      camera.setZoom(targetZoom);
      const lead = player.facing * speedRatio * 70;
      camera.follow(player.x + player.w / 2, player.y + player.h / 2, dt, lead);
    }
    camera.update(dt);

    if (cfg.onUpdate) cfg.onUpdate(rt, dt);

    if (Math.random() < 0.0012) showToast(root, randomEncouragement());
  }

  function drawWorld() {
    const camX = camera.x;
    const camY = camera.y;

    // 배경 1: 하늘 그라디언트
    const sky = ctx.createLinearGradient(0, -200, 0, LOGICAL_H + 200);
    sky.addColorStop(0, cfg.skyTop || '#9fd8f7');
    sky.addColorStop(0.55, cfg.skyColor || '#cbe6ff');
    sky.addColorStop(1, cfg.skyBottom || '#eaf6e6');
    ctx.fillStyle = sky;
    ctx.fillRect(-300, -300, LOGICAL_W + 600, LOGICAL_H + 600);

    // 배경 2: 절차적 원경 언덕 (깊이감)
    drawHills(ctx, camX, 0.08, LOGICAL_H * 0.62 - camY * 0.05, 26, 'rgba(150,205,190,0.55)', 0);
    drawHills(ctx, camX, 0.14, LOGICAL_H * 0.70 - camY * 0.08, 34, 'rgba(126,193,163,0.6)', 2.1);

    // 배경 3: 배경 일러스트
    if (cfg.bgImage && images[cfg.bgImage]) {
      ctx.save();
      ctx.globalAlpha = cfg.bgAlpha != null ? cfg.bgAlpha : 0.9;
      // 세로 시차는 아주 약하게. 크게 주면 높은 맵에서 배경이 화면 밖으로 밀려 이음새가 생긴다
      const bgY = -110 - camY * (cfg.bgFactorY != null ? cfg.bgFactorY : 0.05);
      drawParallax(ctx, images[cfg.bgImage], camX, cfg.bgFactor || 0.35, bgY, LOGICAL_H + 300, LOGICAL_W);
      ctx.restore();
    }

    if (cfg.drawBack) cfg.drawBack(rt, ctx, camX, camY);

    // 발판
    for (const pl of rt.platforms) {
      if (pl.invisible) continue;
      if (pl.x - camX > LOGICAL_W + 200 || pl.x + pl.w - camX < -200) continue;
      drawTerrain(ctx, pl, camX, camY);
    }

    // 아이템
    for (const it of rt.items) {
      if (it.taken) continue;
      const ix = it.x - camX;
      const iy = it.y - camY;
      if (ix > LOGICAL_W + 120 || ix + it.w < -120) continue;
      if (it.kind === 'coin') {
        // 이모지 코인은 작게 그리면 어둡게 뭉개져서 직접 그린다
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
      drawSprite(ctx, images, it.def.image, it.def.emoji, ix, iy, it.w, it.h, false);
    }

    // 적 (발밑 그림자 먼저)
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

    // 흡입 이펙트
    if (player.inhaling) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ffffff';
      const zx = player.facing > 0 ? player.x + player.w - camX : player.x - 150 - camX;
      ctx.beginPath();
      ctx.moveTo(player.x + player.w / 2 - camX, player.y + player.h / 2 - camY);
      ctx.lineTo(zx + (player.facing > 0 ? 150 : 0), player.y - 30 - camY);
      ctx.lineTo(zx + (player.facing > 0 ? 150 : 0), player.y + player.h + 30 - camY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 능력 근접 공격 이펙트
    if (player.attackHitbox) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#8fd17a';
      const hb = player.attackHitbox;
      ctx.fillRect(hb.x - camX, hb.y - camY, hb.w, hb.h);
      ctx.restore();
    }

    // 투사체
    for (const pr of rt.projectiles) {
      if (!pr.alive) continue;
      if (pr.kind === 'star') {
        ctx.fillStyle = '#ffd93d';
        drawStar(ctx, pr.x - camX + pr.w / 2, pr.y - camY + pr.h / 2, pr.w * 0.6);
      } else {
        drawSprite(ctx, images, null, pr.def.emoji, pr.x - camX, pr.y - camY, pr.w, pr.h, false);
      }
    }

    const pgy = groundUnder(player.x + player.w / 2, player.y + player.h, rt.platforms);
    if (pgy != null) drawShadow(ctx, player.x + player.w / 2 - camX, pgy - camY, player.w, pgy - (player.y + player.h));
    drawPlayer(ctx, images, player, camX, camY, drawSprite);
    particles.draw(ctx, camX, camY);

    if (cfg.drawFront) cfg.drawFront(rt, ctx, camX, camY);
  }

  function drawOverlay() {
    // 비네트 — 화면 가장자리를 살짝 눌러 중앙에 시선을 모은다
    const g = ctx.createRadialGradient(
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.42,
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.92
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,12,0,0.26)');
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
    if (camera.isFrozen()) {
      camera.update(dt);
      dt = 0;
    }
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

export { makeItem, makeProjectile, showToast, Sound, drawSprite, rectsOverlap };
