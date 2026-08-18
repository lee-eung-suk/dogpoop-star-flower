// 스테이지 2: 이슬 정원 — 둥실 날기로 위로 올라가며 영양분 100% 모으기
import { drawSprite, showToast } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime, solid, ledge, mover, crumble, springPad } from './levelcore.js';
import { renderStandardHud } from './hud.js';

const WORLD_W = 1900;
const WORLD_H = 1620;
const FLOOR_Y = 1540;

export function createLevel2(canvasCtx, images, root, hud, input, { onSuccess }) {
  let done = false;

  const runtime = createLevelRuntime({
    canvasCtx, images, root, hud, input,
    world: { w: WORLD_W, h: WORLD_H },
    spawn: { x: 90, y: FLOOR_Y - 44 },
    skyTop: '#bfe9ff', skyColor: '#dcf3ff', skyBottom: '#f2fbe8',
    bgImage: 'bg_road.png',
    bgFactor: 0.16,
    bgFactorY: 0.04,

    build(rt) {
      done = false;

      rt.platforms.push(solid(0, FLOOR_Y, WORLD_W, 140));
      rt.platforms.push({ x: -30, y: -200, w: 30, h: WORLD_H + 200, invisible: true });
      rt.platforms.push({ x: WORLD_W, y: -200, w: 30, h: WORLD_H + 200, invisible: true });

      // 바닥에서 첫 도약은 점프대로
      rt.platforms.push(springPad(300, FLOOR_Y - 16, 90));

      // 지그재그 등반로 — 종류를 섞어 매 구간 느낌이 달라지게
      const steps = [
        ['ledge',   180, 1420, 150],
        ['mover',   520, 1330, 140, 120, 0, 0.8],
        ['ledge',   880, 1250, 150],
        ['crumble', 1280, 1180, 140],
        ['ledge',   1580, 1080, 150],
        ['mover',   1180, 1000, 140, 0, 90, 1.0],
        ['ledge',   800, 930, 150],
        ['crumble', 420, 860, 140],
        ['ledge',   130, 780, 150],
        ['mover',   470, 700, 140, 130, 0, 1.1],
        ['ledge',   860, 630, 160],
        ['crumble', 1250, 560, 140],
        ['ledge',   1560, 470, 150],
        ['mover',   1160, 400, 140, 0, 80, 1.2],
        ['ledge',   760, 330, 160],
        ['ledge',   380, 260, 150],
        ['ledge',   700, 180, 240],
      ];
      steps.forEach((s) => {
        if (s[0] === 'ledge') rt.platforms.push(ledge(s[1], s[2], s[3]));
        else if (s[0] === 'crumble') rt.platforms.push(crumble(s[1], s[2], s[3]));
        else rt.platforms.push(mover(s[1], s[2], s[3], s[4], s[5], s[6]));
      });

      // 영양분 아이템
      const kinds = ['dew', 'dew', 'sun', 'hail', 'dew', 'sun', 'dew', 'hail',
                     'sun', 'dew', 'dew', 'sun', 'hail', 'dew', 'sun', 'dew', 'sun'];
      steps.forEach((s, i) => {
        const x = s[1] + s[3] / 2;
        const y = s[2] - 30;
        rt.items.push(makeItem(kinds[i % kinds.length], x, y));
        if (i % 3 === 0) rt.items.push(makeItem('coin', x - 44, y));
        if (i % 4 === 1) rt.items.push(makeItem('coin', x + 44, y));
      });

      // 공중에 뜬 이슬 — 둥실 날기로만 닿는다
      for (let i = 0; i < 6; i++) rt.items.push(makeItem('dew', 250 + i * 265, 1130 - i * 125));

      rt.items.push(makeItem('leaf', 900, 1210));
      rt.items.push(makeItem('leaf', 500, 660));
      rt.items.push(makeItem('candy', 1620, 430));
      rt.items.push(makeItem('rainbow', 820, 140));
      rt.items.push(makeItem('clover', 200, 740));

      // 적 — 능력을 바꿔가며 쓰라고 종류를 섞는다
      rt.enemies.push(makeEnemy('bubble', 700, 1420, { range: 130 }));
      rt.enemies.push(makeEnemy('sparrow', 1150, 1250, { range: 180 }));
      rt.enemies.push(makeEnemy('sprout', 950, 930, {}));
      rt.enemies.push(makeEnemy('hotchi', 520, 860, {}));
      rt.enemies.push(makeEnemy('frost', 1350, 780, { range: 150 }));
      rt.enemies.push(makeEnemy('sparrow', 620, 560, { range: 200 }));
      rt.enemies.push(makeEnemy('sprout', 1320, 560, {}));
      rt.enemies.push(makeEnemy('hen', 1200, 400, { range: 90 }));
      rt.enemies.push(makeEnemy('frost', 500, 260, { range: 120 }));
    },

    renderHud(rt) {
      renderStandardHud(rt, { showNutrient: true });
    },

    onCollect(rt) {
      if (!done && rt.nutrient >= 100) {
        done = true;
        rt.camera.pulseZoom(1.2, 1.0);
        rt.camera.freeze(0.3);
        showToast(root, '영양분이 가득 찼어! 🌱✨', 2000);
        setTimeout(() => {
          runtime.finish();
          onSuccess();
        }, 1500);
      }
    },

    drawFront(rt, ctx, camX, camY) {
      drawSprite(ctx, images, 'sprout.png', '🌱', 790 - camX, 116 - camY, 64, 64, false);
    },
  });

  return runtime;
}
