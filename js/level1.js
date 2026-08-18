// 스테이지 1: 시골길 — 조작 학습 → 적 다양화 → 꼬꼬대왕 보스전
import { LOGICAL_W, LOGICAL_H, drawSprite, showToast, Sound } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime } from './levelcore.js';
import { createBoss, updateBoss, damageBoss, drawBoss, drawBossHpBar } from './boss.js';
import { renderStandardHud } from './hud.js';

const GROUND_Y = 460;
const WORLD_W = 4400;
const ARENA_L = 3860;

function ground(x, w) {
  return { x, y: GROUND_Y, w, h: LOGICAL_H - GROUND_Y + 200, color: '#c99a5b', topColor: '#8fd17a' };
}
function ledge(x, y, w) {
  return { x, y, w, h: 18, color: '#e0b989', topColor: '#8fd17a' };
}

export function createLevel1(canvasCtx, images, root, hud, input, { onSuccess }) {
  let boss = null;
  let bossTriggered = false;
  let introTimer = 0;

  const runtime = createLevelRuntime({
    canvasCtx, images, root, hud, input,
    world: { w: WORLD_W, h: LOGICAL_H },
    spawn: { x: 70, y: GROUND_Y - 44 },
    skyColor: '#cbe6ff',
    bgImage: 'bg_road.png',
    bgFactor: 0.3,

    build(rt) {
      boss = null;
      bossTriggered = false;
      introTimer = 0;

      // 지면 (중간에 구덩이 2곳)
      rt.platforms.push(ground(0, 1180));
      rt.platforms.push(ground(1320, 1180));
      rt.platforms.push(ground(2640, 1760));

      // 발판
      rt.platforms.push(ledge(520, 372, 130));
      rt.platforms.push(ledge(760, 300, 110));
      rt.platforms.push(ledge(1180, 350, 120));
      rt.platforms.push(ledge(1500, 300, 120));
      rt.platforms.push(ledge(1900, 370, 140));
      rt.platforms.push(ledge(2180, 290, 120));
      rt.platforms.push(ledge(2450, 360, 130));
      rt.platforms.push(ledge(2900, 330, 140));
      rt.platforms.push(ledge(3200, 260, 120)); // 숨은 보너스
      rt.platforms.push(ledge(3450, 360, 130));

      // 보스 아레나 벽 (보스 시작 시 활성화)
      rt.extra.arenaWall = { x: ARENA_L - 30, y: 0, w: 30, h: LOGICAL_H, invisible: true, disabled: true };

      // 적 배치
      rt.enemies.push(makeEnemy('chick', 700, GROUND_Y, { range: 70 }));
      rt.enemies.push(makeEnemy('chick', 980, GROUND_Y, { dir: -1, range: 80 }));
      rt.enemies.push(makeEnemy('hen', 1450, GROUND_Y, { range: 110 }));
      rt.enemies.push(makeEnemy('sparrow', 1750, GROUND_Y, { range: 150 }));
      rt.enemies.push(makeEnemy('hotchi', 2050, GROUND_Y, {}));
      rt.enemies.push(makeEnemy('hen', 2350, GROUND_Y, { dir: -1, range: 120 }));
      rt.enemies.push(makeEnemy('sprout', 2700, GROUND_Y, {}));
      rt.enemies.push(makeEnemy('frost', 2980, GROUND_Y, { range: 120 }));
      rt.enemies.push(makeEnemy('sparrow', 3250, GROUND_Y, { range: 170 }));
      rt.enemies.push(makeEnemy('chick', 3520, GROUND_Y, { range: 90 }));
      rt.enemies.push(makeEnemy('hen', 3700, GROUND_Y, { range: 100 }));

      // 코인 길
      for (let x = 220; x < 3700; x += 150) {
        if (x > 1180 && x < 1320) continue;
        if (x > 1820 && x < 2640) { /* 상단 코인은 따로 */ }
        rt.items.push(makeItem('coin', x, GROUND_Y - 46));
      }
      // 발판 위 코인 아치
      [[520, 372], [760, 300], [1500, 300], [2180, 290], [2900, 330]].forEach(([x, y]) => {
        for (let i = 0; i < 4; i++) rt.items.push(makeItem('coin', x + 18 + i * 28, y - 34));
      });
      // 숨은 보너스존 (높은 발판)
      for (let i = 0; i < 5; i++) rt.items.push(makeItem('coin', 3212 + i * 24, 214 - Math.sin((i / 4) * Math.PI) * 26));
      rt.items.push(makeItem('clover', 3260, 190));

      // 회복/특수 아이템
      rt.items.push(makeItem('leaf', 1240, 316));
      rt.items.push(makeItem('leaf', 2500, 326));
      rt.items.push(makeItem('candy', 1960, 336));
      rt.items.push(makeItem('rainbow', 3500, 326));
      rt.items.push(makeItem('leaf', 3760, GROUND_Y - 40));
    },

    renderHud(rt) {
      renderStandardHud(rt, { showNutrient: false });
    },

    bossRef: () => boss,
    onBossHit(rt) {
      if (boss) damageBoss(boss, rt.env, 1);
    },

    zoomOverride(rt, z) {
      if (boss && boss.state === 'intro') return 1.35;
      if (boss && boss.state === 'dead') return 1.25;
      if (bossTriggered) return Math.min(z, 0.98);
      return z;
    },

    onUpdate(rt, dt) {
      const p = rt.player;

      // 보스 트리거
      if (!bossTriggered && p.x > ARENA_L - 260) {
        bossTriggered = true;
        boss = createBoss(ARENA_L + 340, GROUND_Y);
        boss.state = 'intro';
        boss.timer = 0;
        rt.extra.arenaWall.disabled = false;
        rt.platforms.push(rt.extra.arenaWall);
        rt.camera.shake(10);
        Sound.bad();
        showToast(root, '꼬꼬대왕이 나타났다! 👑🐔', 2200);
      }

      if (boss) {
        updateBoss(boss, dt, {
          player: p,
          projectiles: rt.projectiles,
          enemies: rt.enemies,
          particles: rt.particles,
          camera: rt.camera,
          onIntroDone: () => { rt.camera.setZoom(1); },
          onDefeat: () => {
            showToast(root, '해냈다! 꼬꼬대왕을 물리쳤어! 🎉', 2400);
            setTimeout(() => {
              runtime.finish();
              onSuccess();
            }, 2100);
          },
        });

        // 보스 몸통 접촉 피해
        if (boss.alive && boss.state !== 'dead' && boss.state !== 'intro') {
          const hb = { x: boss.x - boss.w / 2, y: boss.y, w: boss.w, h: boss.h };
          const php = { x: p.x, y: p.y, w: p.w, h: p.h };
          const overlap = php.x < hb.x + hb.w && php.x + php.w > hb.x && php.y < hb.y + hb.h && php.y + php.h > hb.y;
          if (overlap && p.invincible > 0) {
            damageBoss(boss, rt.env, 1);
            p.vx = (p.x < boss.x ? -1 : 1) * 260;
          }
        }
      }

      // 보스 없이 끝까지 간 경우(예외)
      if (!boss && p.x > WORLD_W - 90) {
        runtime.finish();
        onSuccess();
      }
    },

    drawMid(rt, ctx, camX, camY) {
      if (boss) drawBoss(ctx, images, boss, camX, camY, drawSprite);
    },

    drawFront(rt, ctx, camX, camY) {
      // 골 지점 새싹
      if (!bossTriggered) {
        drawSprite(ctx, images, 'sprout.png', '🌱', ARENA_L + 20 - camX, GROUND_Y - 60 - camY, 54, 54, false);
      }
    },

    // 카메라 변환이 걸리지 않는 화면 좌표계 — 체력바는 여기서 그린다
    drawOverlay(rt, ctx) {
      if (boss && boss.alive) drawBossHpBar(ctx, boss, LOGICAL_W);
    },
  });

  return runtime;
}
