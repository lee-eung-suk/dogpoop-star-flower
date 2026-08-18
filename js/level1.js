// 스테이지 1: 시골길 — 조작 학습 → 지형 변주 → 꼬꼬대왕 보스전
import { LOGICAL_W, LOGICAL_H, drawSprite, showToast, Sound } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime, solid, ledge, mover, crumble, springPad } from './levelcore.js';
import { createBoss, updateBoss, damageBoss, drawBoss, drawBossHpBar } from './boss.js';
import { renderStandardHud } from './hud.js';

const GROUND_Y = 460;
const WORLD_W = 4600;
const ARENA_L = 4000;

function ground(x, w) {
  return solid(x, GROUND_Y, w, LOGICAL_H - GROUND_Y + 220);
}

export function createLevel1(canvasCtx, images, root, hud, input, { onSuccess }) {
  let boss = null;
  let bossTriggered = false;
  let cleared = false;
  let bossEnv = null;

  const runtime = createLevelRuntime({
    canvasCtx, images, root, hud, input,
    world: { w: WORLD_W, h: LOGICAL_H },
    spawn: { x: 70, y: GROUND_Y - 44 },
    skyTop: '#8fd3f4', skyColor: '#cbe6ff', skyBottom: '#eaf6e6',
    bgImage: 'bg_road.png',
    bgFactor: 0.28,

    build(rt) {
      boss = null;
      bossTriggered = false;
      cleared = false;

      // 보스전 콜백을 한 곳에서 만든다.
      // (예전 버그: damageBoss 에 levelcore 의 env 를 넘겨 onDefeat 가 없어서 스테이지가 안 넘어갔다)
      bossEnv = {
        player: rt.player,
        projectiles: rt.projectiles,
        enemies: rt.enemies,
        particles: rt.particles,
        camera: rt.camera,
        onIntroDone: () => { rt.camera.pulseZoom(1, 0.1); },
        onDefeat: () => {
          if (cleared) return;
          cleared = true;
          showToast(root, '해냈다! 꼬꼬대왕을 물리쳤어! 🎉', 2400);
          setTimeout(() => {
            runtime.finish();
            onSuccess();
          }, 2000);
        },
      };
      rt.extra.bossEnv = bossEnv;

      // ---- 지면 (구덩이 3곳) ----
      rt.platforms.push(ground(0, 1150));
      rt.platforms.push(ground(1480, 900));
      rt.platforms.push(ground(2620, 800));
      rt.platforms.push(ground(3560, WORLD_W - 3560));

      // ---- A 구간: 기본 발판 ----
      rt.platforms.push(ledge(430, 372, 130));
      rt.platforms.push(ledge(680, 300, 110));
      rt.platforms.push(ledge(900, 372, 120));

      // ---- B 구간: 첫 구덩이는 움직이는 발판으로 건넌다 ----
      rt.platforms.push(mover(1200, 390, 120, 130, 0, 0.9));
      rt.platforms.push(springPad(1600, GROUND_Y - 16, 80));
      rt.platforms.push(ledge(1760, 300, 130));
      rt.platforms.push(ledge(2010, 240, 120));

      // ---- C 구간: 부서지는 발판 다리 ----
      rt.platforms.push(crumble(2400, 400, 110));
      rt.platforms.push(crumble(2560, 360, 110));
      rt.platforms.push(mover(2760, 330, 120, 0, 90, 1.1));
      rt.platforms.push(ledge(3000, 380, 130));

      // ---- D 구간: 점프대로 올라가는 숨은 보너스 ----
      rt.platforms.push(springPad(3180, GROUND_Y - 16, 80));
      rt.platforms.push(ledge(3120, 210, 200));      // 보너스 발판
      rt.platforms.push(crumble(3420, 330, 110));
      rt.platforms.push(ledge(3660, 370, 130));
      rt.platforms.push(mover(3800, 300, 110, 0, 70, 1.3));

      // 보스 아레나 벽 (보스 시작 시 붙인다)
      rt.extra.arenaWall = { x: ARENA_L - 30, y: -200, w: 30, h: LOGICAL_H + 200, invisible: true };

      // ---- 적 ----
      rt.enemies.push(makeEnemy('chick', 620, GROUND_Y, { range: 70 }));
      rt.enemies.push(makeEnemy('chick', 950, GROUND_Y, { dir: -1, range: 80 }));
      rt.enemies.push(makeEnemy('hen', 1620, GROUND_Y, { range: 110 }));       // 깃털
      rt.enemies.push(makeEnemy('sparrow', 1900, GROUND_Y, { range: 160 }));
      rt.enemies.push(makeEnemy('hotchi', 2180, GROUND_Y, {}));                // 햇살
      rt.enemies.push(makeEnemy('sprout', 2300, GROUND_Y, {}));                // 새싹
      rt.enemies.push(makeEnemy('bubble', 2700, GROUND_Y, { range: 120 }));    // 이슬
      rt.enemies.push(makeEnemy('frost', 3050, GROUND_Y, { range: 130 }));     // 얼음
      rt.enemies.push(makeEnemy('hen', 3300, GROUND_Y, { dir: -1, range: 120 }));
      rt.enemies.push(makeEnemy('sparrow', 3620, GROUND_Y, { range: 170 }));
      rt.enemies.push(makeEnemy('chick', 3900, GROUND_Y, { range: 80 }));

      // ---- 코인 ----
      for (let x = 200; x < 3950; x += 160) {
        if ((x > 1150 && x < 1480) || (x > 2380 && x < 2620) || (x > 3420 && x < 3560)) continue;
        rt.items.push(makeItem('coin', x, GROUND_Y - 46));
      }
      [[430, 372], [680, 300], [1760, 300], [2010, 240], [3000, 380]].forEach(([x, y]) => {
        for (let i = 0; i < 4; i++) rt.items.push(makeItem('coin', x + 20 + i * 28, y - 34));
      });
      // 숨은 보너스 (점프대로만 닿는 높은 발판)
      for (let i = 0; i < 6; i++) rt.items.push(makeItem('coin', 3140 + i * 30, 166));
      rt.items.push(makeItem('clover', 3300, 166));

      // ---- 회복/특수 ----
      rt.items.push(makeItem('leaf', 1810, 262));
      rt.items.push(makeItem('candy', 2060, 200));
      rt.items.push(makeItem('leaf', 3050, 342));
      rt.items.push(makeItem('rainbow', 3700, 330));
      rt.items.push(makeItem('leaf', 3950, GROUND_Y - 40));
    },

    renderHud(rt) {
      renderStandardHud(rt, { showNutrient: false });
    },

    bossRef: () => boss,
    onBossHit(rt) {
      if (boss && bossEnv) damageBoss(boss, bossEnv, 1);
    },

    onUpdate(rt, dt) {
      const p = rt.player;

      if (!bossTriggered && p.x > ARENA_L - 240) {
        bossTriggered = true;
        boss = createBoss(ARENA_L + 330, GROUND_Y);
        boss.state = 'intro';
        boss.timer = 0;
        rt.platforms.push(rt.extra.arenaWall);
        rt.camera.pulseZoom(1.25, 1.9);
        rt.camera.shake(9);
        Sound.bad();
        showToast(root, '꼬꼬대왕이 나타났다! 👑🐔', 2200);
      }

      if (boss) {
        updateBoss(boss, dt, bossEnv);

        if (boss.alive && boss.state !== 'dead' && boss.state !== 'intro') {
          const hb = { x: boss.x - boss.w / 2, y: boss.y, w: boss.w, h: boss.h };
          const overlap = p.x < hb.x + hb.w && p.x + p.w > hb.x && p.y < hb.y + hb.h && p.y + p.h > hb.y;
          if (overlap && p.invincible > 0) {
            damageBoss(boss, bossEnv, 1);
            p.vx = (p.x < boss.x ? -1 : 1) * 260;
          }
        }
      }
    },

    drawMid(rt, ctx, camX, camY) {
      if (boss) drawBoss(ctx, images, boss, camX, camY, drawSprite);
    },

    drawFront(rt, ctx, camX, camY) {
      if (!bossTriggered) {
        drawSprite(ctx, images, 'sprout.png', '🌱', ARENA_L + 20 - camX, GROUND_Y - 60 - camY, 54, 54, false);
      }
    },

    drawOverlay(rt, ctx) {
      if (boss && boss.alive) drawBossHpBar(ctx, boss, LOGICAL_W);
    },
  });

  return runtime;
}
