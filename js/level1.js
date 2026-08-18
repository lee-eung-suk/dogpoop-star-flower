// 스테이지 1: 시골길 — 조작 학습 → 지형 변주 → 꼬꼬대왕 보스전
import { LOGICAL_W, LOGICAL_H, drawSprite, showToast, Sound } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime, solid, ledge, mover, crumble, springPad } from './levelcore.js';
import { createBoss, updateBoss, damageBoss, drawBoss, drawBossHpBar } from './boss.js';
import { renderStandardHud } from './hud.js';

const GROUND_Y = 460;
const WORLD_W = 4700;
const ARENA_L = 4000;          // 아레나 왼쪽 끝(여기서 봉인된다)
const ARENA_R = WORLD_W - 40;
const BOSS_X = 4380;

function ground(x, w) {
  return solid(x, GROUND_Y, w, LOGICAL_H - GROUND_Y + 220);
}

export function createLevel1(canvasCtx, images, root, hud, input, { onSuccess }) {
  let boss = null;
  let bossTriggered = false;
  let cleared = false;
  let bossEnv = null;
  let ammoTimer = 0;

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
      ammoTimer = 0;

      // 보스전 콜백은 한 곳에서 만든다.
      // (예전 버그: damageBoss 에 onDefeat 이 없는 env 를 넘겨 스테이지가 안 넘어갔다)
      bossEnv = {
        player: rt.player,
        projectiles: rt.projectiles,
        enemies: rt.enemies,
        particles: rt.particles,
        camera: rt.camera,
        onIntroDone: () => {
          rt.camera.pulseZoom(1, 0.1);
          showToast(root, '삐약이를 빨아들여(Shift 꾹) 되뱉으면 아파해! 💨⭐', 3400);
        },
        onSummon: () => {
          showToast(root, '삐약이가 나왔다! 빨아들여서 뱉어! 💨', 1800);
        },
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

      // ---- A: 기본 발판 ----
      rt.platforms.push(ledge(430, 372, 140));
      rt.platforms.push(ledge(690, 300, 120));
      rt.platforms.push(ledge(910, 372, 130));

      // ---- B: 움직이는 발판으로 구덩이 건너기 ----
      rt.platforms.push(mover(1200, 390, 130, 130, 0, 0.85));
      rt.platforms.push(springPad(1600, GROUND_Y - 16, 84));
      rt.platforms.push(ledge(1760, 300, 140));
      rt.platforms.push(ledge(2010, 240, 130));

      // ---- C: 부서지는 발판 다리 ----
      rt.platforms.push(crumble(2400, 400, 120));
      rt.platforms.push(crumble(2570, 360, 120));
      rt.platforms.push(mover(2770, 330, 130, 0, 85, 1.0));
      rt.platforms.push(ledge(3000, 380, 140));

      // ---- D: 점프대 → 숨은 보너스 ----
      rt.platforms.push(springPad(3180, GROUND_Y - 16, 84));
      rt.platforms.push(ledge(3120, 210, 210));
      rt.platforms.push(crumble(3420, 330, 120));
      rt.platforms.push(ledge(3660, 370, 140));
      rt.platforms.push(mover(3800, 300, 120, 0, 70, 1.2));

      // 아레나 봉인벽 — 보스 시작 시 "플레이어 뒤쪽"에 세운다.
      // (앞쪽에 세우면 보스에게 영영 닿지 못한다 — 실제로 그 버그가 있었다)
      rt.extra.arenaWall = { x: ARENA_L - 40, y: -300, w: 40, h: LOGICAL_H + 300, invisible: true };

      // ---- 적: 능력 재료를 순서대로 만나게 배치 (난이도 완화를 위해 밀도를 낮췄다) ----
      rt.enemies.push(makeEnemy('chick', 640, GROUND_Y, { range: 70 }));
      rt.enemies.push(makeEnemy('hen', 1620, GROUND_Y, { range: 100 }));        // 🪶 깃털
      rt.enemies.push(makeEnemy('sparrow', 1930, GROUND_Y, { range: 150 }));
      rt.enemies.push(makeEnemy('hotchi', 2180, GROUND_Y, {}));                 // ☀️ 햇살
      rt.enemies.push(makeEnemy('sprout', 2320, GROUND_Y, {}));                 // 🌱 새싹
      rt.enemies.push(makeEnemy('bubble', 2720, GROUND_Y, { range: 110 }));     // 💧 이슬
      rt.enemies.push(makeEnemy('frost', 3060, GROUND_Y, { range: 120 }));      // ❄️ 얼음
      rt.enemies.push(makeEnemy('chick', 3320, GROUND_Y, { range: 80 }));
      rt.enemies.push(makeEnemy('hen', 3700, GROUND_Y, { dir: -1, range: 100 }));

      // ---- 코인 ----
      for (let x = 200; x < 3950; x += 160) {
        if ((x > 1150 && x < 1480) || (x > 2380 && x < 2620) || (x > 3420 && x < 3560)) continue;
        rt.items.push(makeItem('coin', x, GROUND_Y - 46));
      }
      [[430, 372], [690, 300], [1760, 300], [2010, 240], [3000, 380]].forEach(([x, y]) => {
        for (let i = 0; i < 4; i++) rt.items.push(makeItem('coin', x + 22 + i * 28, y - 34));
      });
      for (let i = 0; i < 6; i++) rt.items.push(makeItem('coin', 3140 + i * 30, 166));
      rt.items.push(makeItem('clover', 3300, 166));

      // ---- 회복 (보스 앞에서 넉넉히 회복하고 들어가도록) ----
      rt.items.push(makeItem('leaf', 1810, 262));
      rt.items.push(makeItem('candy', 2060, 200));
      rt.items.push(makeItem('leaf', 2830, 292));
      rt.items.push(makeItem('leaf', 3050, 342));
      rt.items.push(makeItem('rainbow', 3700, 330));
      rt.items.push(makeItem('leaf', 3930, GROUND_Y - 40));
      rt.items.push(makeItem('clover', 3860, GROUND_Y - 40));
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

      // 플레이어가 아레나 안으로 충분히 들어온 뒤에 봉인한다
      if (!bossTriggered && p.x > ARENA_L + 90) {
        bossTriggered = true;
        boss = createBoss(BOSS_X, GROUND_Y, ARENA_L, ARENA_R);
        boss.state = 'intro';
        boss.timer = 0;
        rt.platforms.push(rt.extra.arenaWall);
        rt.camera.pulseZoom(1.2, 1.8);
        rt.camera.shake(9);
        Sound.bad();
        showToast(root, '꼬꼬대왕이 나타났다! 👑🐔', 2000);

        // 시작하자마자 탄약을 준다 — 때릴 수단 없이 갇히면 게임이 멈춘 것과 같다
        rt.enemies.push(makeEnemy('chick', ARENA_L + 200, GROUND_Y, { dir: 1, range: 150 }));
        rt.enemies.push(makeEnemy('chick', ARENA_L + 320, GROUND_Y, { dir: -1, range: 150 }));
      }

      if (boss) {
        updateBoss(boss, dt, bossEnv);

        // 탄약이 떨어지면 다시 채워준다
        if (boss.state !== 'dead') {
          ammoTimer -= dt;
          const chicks = rt.enemies.filter((e) => e.alive && e.type === 'chick').length;
          if (chicks === 0 && ammoTimer <= 0) {
            ammoTimer = 2.8;
            rt.enemies.push(makeEnemy('chick', ARENA_L + 180, GROUND_Y, { dir: 1, range: 160 }));
            rt.enemies.push(makeEnemy('chick', ARENA_L + 300, GROUND_Y, { dir: -1, range: 160 }));
          }
        }

        // 무적 상태로 들이받아도 대미지
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
        // 아레나 입구 표시
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#e5484d';
        ctx.fillRect(ARENA_L - camX - 3, 0 - camY, 6, GROUND_Y - camY);
        ctx.restore();
        drawSprite(ctx, images, 'enemy_hen.png', '🐔', ARENA_L + 40 - camX, GROUND_Y - 70 - camY, 56, 56, false);
      }
    },

    drawOverlay(rt, ctx) {
      if (boss && boss.alive) drawBossHpBar(ctx, boss, LOGICAL_W);
    },
  });

  return runtime;
}
