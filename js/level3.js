// 스테이지 3: 별빛 길 — 횡스크롤로 별조각을 모아 민들레에게 가져다주고 별꽃을 피운다
import { LOGICAL_W, LOGICAL_H, drawSprite, showToast, Sound } from './engine.js';
import { makeEnemy, makeItem } from './entities.js';
import { createLevelRuntime, solid, ledge, mover, crumble, springPad } from './levelcore.js';
import { renderStandardHud } from './hud.js';

const GROUND_Y = 460;
const WORLD_W = 3600;
const GOAL_X = 3380;          // 민들레 싹이 서 있는 자리
const PIECES_NEEDED = 5;

function ground(x, w) {
  return solid(x, GROUND_Y, w, LOGICAL_H - GROUND_Y + 220, { color: '#c8a37a', topColor: '#a9d98a' });
}

export function createLevel3(canvasCtx, images, root, hud, input, { onFinish }) {
  let pieces = 0;
  let blooming = false;
  let bloomT = 0;
  let finished = false;
  let hintShown = false;

  const runtime = createLevelRuntime({
    canvasCtx, images, root, hud, input,
    world: { w: WORLD_W, h: LOGICAL_H },
    spawn: { x: 70, y: GROUND_Y - 44 },
    skyTop: '#ffe9b0', skyColor: '#fff3cf', skyBottom: '#ffeede',
    bgImage: 'bg_magic.png',
    bgFactor: 0.26,
    bgAlpha: 0.95,

    build(rt) {
      pieces = 0;
      blooming = false;
      bloomT = 0;
      finished = false;
      hintShown = false;

      // 땅은 중간중간 끊겨 있고, 그 사이를 빛나는 발판으로 건넌다
      rt.platforms.push(ground(0, 900));
      rt.platforms.push(ground(1240, 760));
      rt.platforms.push(ground(2320, WORLD_W - 2320));

      rt.platforms.push(ledge(380, 372, 140));
      rt.platforms.push(ledge(620, 300, 130));
      rt.platforms.push(springPad(840, GROUND_Y - 16, 84));

      // 첫 협곡 — 움직이는 발판
      rt.platforms.push(mover(980, 350, 130, 110, 0, 0.85));
      rt.platforms.push(ledge(1130, 250, 120));

      rt.platforms.push(ledge(1330, 360, 140));
      rt.platforms.push(crumble(1560, 310, 120));
      rt.platforms.push(ledge(1760, 250, 130));
      rt.platforms.push(springPad(1960, GROUND_Y - 16, 84));

      // 둘째 협곡 — 위아래 발판 + 부서지는 발판
      rt.platforms.push(mover(2060, 330, 120, 0, 90, 1.1));
      rt.platforms.push(crumble(2200, 260, 120));

      rt.platforms.push(ledge(2420, 370, 140));
      rt.platforms.push(mover(2640, 300, 120, 100, 0, 1.0));
      rt.platforms.push(ledge(2880, 240, 140));
      rt.platforms.push(ledge(3120, 340, 150));

      // ---- 별조각 (필요 5개, 총 9개라 몇 개 놓쳐도 된다) ----
      const piecePos = [
        [450, 330], [685, 258], [1190, 208], [1395, 318], [1820, 208],
        [2120, 292], [2260, 218], [2945, 198], [3190, 298],
      ];
      piecePos.forEach(([x, y]) => rt.items.push(makeItem('piece', x, y)));

      // ---- 코인 ----
      for (let x = 180; x < 3300; x += 170) {
        if ((x > 900 && x < 1240) || (x > 2000 && x < 2320)) continue;
        rt.items.push(makeItem('coin', x, GROUND_Y - 46));
      }

      // ---- 회복 ----
      rt.items.push(makeItem('leaf', 1350, 316));
      rt.items.push(makeItem('leaf', 2450, 326));
      rt.items.push(makeItem('candy', 2900, 196));
      rt.items.push(makeItem('rainbow', 3160, 296));

      // ---- 적: 마지막 스테이지지만 감동이 주인공이라 적게, 순하게 ----
      rt.enemies.push(makeEnemy('chick', 560, GROUND_Y, { range: 80 }));
      rt.enemies.push(makeEnemy('sparrow', 1450, GROUND_Y, { range: 150 }));
      rt.enemies.push(makeEnemy('bubble', 1700, GROUND_Y, { range: 110 }));
      rt.enemies.push(makeEnemy('frost', 2500, GROUND_Y, { range: 120 }));
      rt.enemies.push(makeEnemy('sprout', 2760, GROUND_Y, {}));
      rt.enemies.push(makeEnemy('chick', 3050, GROUND_Y, { range: 90 }));
    },

    renderHud(rt) {
      renderStandardHud(rt, { showNutrient: false, extraPill: `✨ ${pieces} / ${PIECES_NEEDED}` });
    },

    onCollect(rt, it) {
      if (it.kind === 'piece') {
        pieces += 1;
        rt.camera.shake(2);
        rt.particles.spawn(it.x + it.w / 2, it.y + it.h / 2, 14, ['#ffd93d', '#fff6c8'],
          { speed: 190, star: true, size: 4 });
        if (pieces === PIECES_NEEDED) {
          showToast(root, '별조각을 다 모았어! 민들레에게 가자 🌱', 2600);
        }
        rt.updateHud();
      }
    },

    onUpdate(rt, dt) {
      const p = rt.player;

      if (blooming) {
        // 개화 연출 중에는 조작을 막고 카메라를 민들레에 고정
        bloomT += dt;
        input.reset();
        p.vx = 0;
        rt.camera.follow(GOAL_X, GROUND_Y - 150, dt);

        if (bloomT > 0.1 && bloomT < 0.15) rt.camera.pulseZoom(1.35, 3.0);
        if (Math.random() < 0.35) {
          rt.particles.spawn(
            GOAL_X + (Math.random() - 0.5) * 220,
            GROUND_Y - 40 - Math.random() * 200,
            2, ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1', '#fff'],
            { speed: 120, lift: 90, star: true, size: 4, gravity: -30, life: 1.4 }
          );
        }
        if (!finished && bloomT > 3.2) {
          finished = true;
          runtime.finish();
          onFinish();
        }
        return;
      }

      // 골 도달 판정
      const dist = Math.abs((p.x + p.w / 2) - GOAL_X);
      if (dist < 70) {
        if (pieces >= PIECES_NEEDED) {
          blooming = true;
          bloomT = 0;
          Sound.success();
          rt.camera.freeze(0.3);
          rt.camera.shake(10);
          showToast(root, '별꽃이 피어난다! 🌼✨', 3000);
        } else if (!hintShown) {
          hintShown = true;
          showToast(root, `별조각이 ${PIECES_NEEDED - pieces}개 더 필요해! ✨`, 2400);
          setTimeout(() => { hintShown = false; }, 2600);
        }
      }
    },

    drawFront(rt, ctx, camX, camY) {
      const gx = GOAL_X - camX;
      const gy = GROUND_Y - camY;

      if (blooming) {
        // 빛기둥
        ctx.save();
        const t = Math.min(1, bloomT / 2.4);
        ctx.globalAlpha = 0.25 + t * 0.4;
        const grad = ctx.createLinearGradient(0, gy - 420, 0, gy);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,240,170,0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(gx - 90, gy - 420, 180, 420);
        ctx.restore();

        // 새싹 → 꽃
        const size = 70 + t * 190;
        const img = t > 0.45 ? 'flower.png' : 'sprout.png';
        const emoji = t > 0.45 ? '🌼' : '🌱';
        drawSprite(ctx, images, img, emoji, gx - size / 2, gy - size, size, size, false);

        // 화면 전체 화이트 플래시
        if (bloomT > 1.0 && bloomT < 1.5) {
          ctx.save();
          ctx.globalAlpha = 0.55 * (1 - Math.abs(bloomT - 1.25) / 0.25);
          ctx.fillStyle = '#fffbe6';
          ctx.fillRect(-300, -300, LOGICAL_W + 600, LOGICAL_H + 600);
          ctx.restore();
        }
        return;
      }

      // 평소: 골 지점의 민들레 싹 + 안내
      drawSprite(ctx, images, 'sprout.png', '🌱', gx - 34, gy - 68, 68, 68, false);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pieces >= PIECES_NEEDED ? '#4a8f3c' : '#8a6a4a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        pieces >= PIECES_NEEDED ? '여기야! 별꽃을 피우자 🌼' : `별조각 ${pieces}/${PIECES_NEEDED}`,
        gx, gy - 84
      );
      ctx.restore();
    },

    drawOverlay(rt, ctx) {
      if (!blooming) return;
      // 개화 마지막에 메시지
      if (bloomT > 1.6) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (bloomT - 1.6) / 0.6);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7a4a2b';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('넌 세상에서 가장 소중한 별꽃을 피워냈어!', LOGICAL_W / 2, LOGICAL_H - 70);
        ctx.restore();
      }
    },
  });

  return runtime;
}
