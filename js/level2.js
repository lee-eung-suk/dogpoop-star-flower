// 스테이지 2: 이슬 정원 — 호버링으로 위로 올라가며 영양분 100% 모으기
import { LOGICAL_H, drawSprite, showToast } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime } from './levelcore.js';
import { renderStandardHud } from './hud.js';

const WORLD_W = 1900;
const WORLD_H = 1620;
const FLOOR_Y = 1540;

function slab(x, y, w, oneWay) {
  return { x, y, w, h: 18, color: '#e0b989', topColor: '#8fd17a', oneWay: !!oneWay };
}

export function createLevel2(canvasCtx, images, root, hud, input, { onSuccess }) {
  let done = false;

  const runtime = createLevelRuntime({
    canvasCtx, images, root, hud, input,
    world: { w: WORLD_W, h: WORLD_H },
    spawn: { x: 90, y: FLOOR_Y - 44 },
    skyColor: '#d9f0ff',
    bgImage: 'bg_road.png',
    bgFactor: 0.18,

    build(rt) {
      done = false;

      // 바닥
      rt.platforms.push({ x: 0, y: FLOOR_Y, w: WORLD_W, h: 120, color: '#c99a5b', topColor: '#8fd17a' });
      // 좌우 벽
      rt.platforms.push({ x: -30, y: 0, w: 30, h: WORLD_H, invisible: true });
      rt.platforms.push({ x: WORLD_W, y: 0, w: 30, h: WORLD_H, invisible: true });

      // 지그재그로 올라가는 발판들
      const steps = [
        [180, 1420, 150], [520, 1330, 150], [880, 1250, 150], [1280, 1180, 160],
        [1580, 1080, 150], [1180, 1000, 150], [800, 930, 150], [420, 860, 150],
        [130, 780, 150], [470, 700, 150], [860, 630, 160], [1250, 560, 150],
        [1560, 470, 150], [1160, 400, 150], [760, 330, 160], [380, 260, 150],
        [720, 180, 220],
      ];
      steps.forEach(([x, y, w]) => rt.platforms.push(slab(x, y, w, true)));

      // 아이템: 이슬/햇살/우박
      const kinds = ['dew', 'dew', 'sun', 'hail', 'dew', 'sun', 'dew', 'hail', 'sun', 'dew', 'dew', 'sun', 'hail', 'dew', 'sun', 'dew', 'sun'];
      steps.forEach(([x, y, w], i) => {
        rt.items.push(makeItem(kinds[i % kinds.length], x + w / 2, y - 30));
        if (i % 3 === 0) rt.items.push(makeItem('coin', x + w / 2 - 40, y - 30));
        if (i % 4 === 1) rt.items.push(makeItem('coin', x + w / 2 + 40, y - 30));
      });

      // 공중에 떠 있는 이슬 (호버링으로만 닿음)
      for (let i = 0; i < 6; i++) {
        rt.items.push(makeItem('dew', 260 + i * 260, 1120 - i * 120));
      }

      rt.items.push(makeItem('leaf', 900, 1210));
      rt.items.push(makeItem('leaf', 500, 660));
      rt.items.push(makeItem('candy', 1620, 430));
      rt.items.push(makeItem('rainbow', 830, 140));
      rt.items.push(makeItem('clover', 200, 740));

      // 적
      rt.enemies.push(makeEnemy('frost', 700, 1420, { range: 130 }));
      rt.enemies.push(makeEnemy('sparrow', 1150, 1250, { range: 180 }));
      rt.enemies.push(makeEnemy('sprout', 950, 930, {}));
      rt.enemies.push(makeEnemy('hotchi', 520, 860, {}));
      rt.enemies.push(makeEnemy('frost', 1350, 780, { range: 150 }));
      rt.enemies.push(makeEnemy('sparrow', 620, 560, { range: 200 }));
      rt.enemies.push(makeEnemy('sprout', 1320, 560, {}));
      rt.enemies.push(makeEnemy('hotchi', 1220, 400, {}));
      rt.enemies.push(makeEnemy('frost', 500, 260, { range: 120 }));
    },

    renderHud(rt) {
      renderStandardHud(rt, { showNutrient: true });
    },

    zoomOverride(rt, z) {
      // 높이 올라갈수록 살짝 줌아웃 — 아래가 보이면 무섭지만 시야는 필요
      const p = rt.player;
      const climb = 1 - Math.max(0, Math.min(1, (p.y - 180) / (FLOOR_Y - 180)));
      return Math.min(z, 1 - climb * 0.1);
    },

    onCollect(rt, it) {
      if (!done && rt.nutrient >= 100) {
        done = true;
        rt.camera.setZoom(1.25);
        rt.camera.freeze(0.35);
        showToast(root, '영양분이 가득 찼어! 🌱✨', 2000);
        setTimeout(() => {
          runtime.finish();
          onSuccess();
        }, 1500);
      }
    },

    drawFront(rt, ctx, camX, camY) {
      // 꼭대기 민들레 싹
      drawSprite(ctx, images, 'sprout.png', '🌱', 800 - camX, 120 - camY, 64, 64, false);
    },
  });

  return runtime;
}
