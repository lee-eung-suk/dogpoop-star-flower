// 스테이지 3: 민들레와 꼭 껴안기 — 연타로 성장, 카메라 줌인 + 슬로우모션 엔딩
import { LOGICAL_W, LOGICAL_H, drawSprite, drawParallax, Camera, Particles, Sound } from './engine.js';

const TAPS_NEEDED = 12;

export function createLevel3(canvasCtx, images, root, hud, input, canvasEl, { onFinish }) {
  const ctx = canvasCtx.ctx;
  const camera = new Camera(LOGICAL_W, LOGICAL_H);
  const particles = new Particles();

  let taps = 0;
  let done = false;
  let running = false;
  let rafId = null;
  let lastTs = 0;
  let time = 0;
  let slowmo = 0;

  function grow() {
    if (!running || done) return;
    taps += 1;
    Sound.grow ? Sound.grow() : Sound.coin();
    camera.shake(3 + taps * 0.4);
    camera.setZoom(1 + taps * 0.02);
    particles.spawn(LOGICAL_W / 2, LOGICAL_H * 0.58, 8, ['#ffd93d', '#fff59d', '#8fd17a'], { speed: 170, star: true, size: 3.5 });
    if (taps >= TAPS_NEEDED) finish();
  }

  function finish() {
    done = true;
    slowmo = 1.6;
    Sound.success();
    camera.setZoom(1.45);
    camera.shake(22);
    particles.spawn(LOGICAL_W / 2, LOGICAL_H * 0.5, 70, ['#ffd93d', '#ff6b9d', '#6bcb77', '#4dd0e1', '#fff'], { speed: 340, star: true, size: 5, life: 1.4 });
    setTimeout(() => { running = false; onFinish(); }, 2200);
  }

  function onTapEvent(e) { e.preventDefault(); grow(); }

  function update(dt) {
    time += dt;
    if (slowmo > 0) slowmo -= dt;
    if (input.consume('jump') || input.consume('action')) grow();
    particles.update(dt);
    camera.update(dt);
  }

  function draw() {
    canvasCtx.beginFrame(camera);
    ctx.fillStyle = '#fff3cf';
    ctx.fillRect(-200, -200, LOGICAL_W + 400, LOGICAL_H + 400);
    drawParallax(ctx, images['bg_magic.png'], time * 10, 1, -40, LOGICAL_H + 80, LOGICAL_W);

    // 빛 번짐
    if (done) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(0.85, slowmo / 1.6));
      ctx.fillStyle = '#fffbe6';
      ctx.fillRect(-200, -200, LOGICAL_W + 400, LOGICAL_H + 400);
      ctx.restore();
    }

    const scale = done ? 2.6 : 1 + taps * 0.12;
    const size = 80 * scale;
    const cx = LOGICAL_W / 2 - size / 2;
    const cy = LOGICAL_H * 0.58 - size;
    drawSprite(ctx, images, done ? 'flower.png' : 'sprout.png', done ? '🌼' : '🌱', cx, cy, size, size, false);

    // 강아지똥이 옆에서 지켜본다
    if (!done) {
      drawSprite(ctx, images, 'player.png', '🐾', LOGICAL_W / 2 - 150, LOGICAL_H * 0.58 - 44, 44, 44, false);
    }

    particles.draw(ctx, 0, 0);

    // 진행 안내
    ctx.save();
    ctx.fillStyle = 'rgba(122,74,43,0.9)';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    if (!done) {
      ctx.fillText('스페이스바 / 화면을 톡톡 두드려줘!', LOGICAL_W / 2, LOGICAL_H - 60);
      const barW = 300;
      const bx = (LOGICAL_W - barW) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(bx, LOGICAL_H - 44, barW, 14);
      ctx.fillStyle = '#6bcb77';
      ctx.fillRect(bx, LOGICAL_H - 44, barW * (taps / TAPS_NEEDED), 14);
    }
    ctx.restore();
  }

  function loop(ts) {
    if (!running) return;
    let dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (slowmo > 0) dt *= 0.35;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  return {
    mount() {
      canvasEl.addEventListener('pointerdown', onTapEvent);
    },
    start() {
      taps = 0;
      done = false;
      time = 0;
      slowmo = 0;
      camera.zoom = 1;
      camera.targetZoom = 1;
      camera.x = 0;
      camera.y = 0;
      particles.list.length = 0;
      hud.innerHTML = '';
      input.reset();
      running = true;
      lastTs = performance.now();
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
    unmount() {
      canvasEl.removeEventListener('pointerdown', onTapEvent);
    },
  };
}
