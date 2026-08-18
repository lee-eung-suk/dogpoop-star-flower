// 적을 캔버스로 직접 그린다.
// OS 이모지를 쓰면 기기마다 모양이 다르고 손그림 배경과 따로 놀아서 싸구려로 보인다.
// 둥근 몸 + 큰 눈 + 볼터치라는 한 가지 규칙으로 통일해 캐릭터들이 한 세계에 살게 한다.

const OUTLINE = 'rgba(96,64,32,0.42)';

function body(ctx, cx, cy, rx, ry, top, bottom) {
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function eyes(ctx, cx, cy, spread, r, facing, blink) {
  const dx = facing * 1.5;
  [-spread, spread].forEach((off) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + off + dx, cy, r, blink ? r * 0.18 : r, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#3a2b1c';
      ctx.beginPath();
      ctx.arc(cx + off + dx + facing * r * 0.22, cy + r * 0.12, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx + off + dx + facing * r * 0.42, cy - r * 0.28, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function blush(ctx, cx, cy, spread, r, color) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = color || '#ff9db0';
  [-spread, spread].forEach((off) => {
    ctx.beginPath();
    ctx.ellipse(cx + off, cy, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function beak(ctx, cx, cy, size, facing, color) {
  ctx.fillStyle = color || '#f5a623';
  ctx.beginPath();
  ctx.moveTo(cx + facing * size * 0.1, cy - size * 0.4);
  ctx.lineTo(cx + facing * size * 1.25, cy);
  ctx.lineTo(cx + facing * size * 0.1, cy + size * 0.4);
  ctx.closePath();
  ctx.fill();
}

/**
 * 적 한 마리를 그린다.
 * kind: chick | sparrow | hotchi | bubble | frost
 * t: 애니메이션용 시간(초), facing: 1 또는 -1
 */
export function drawCreature(ctx, kind, x, y, w, h, t, facing) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dir = facing < 0 ? -1 : 1;
  const blink = (t % 3.4) > 3.25;      // 가끔 눈을 깜빡인다

  ctx.save();

  if (kind === 'chick') {
    const bounce = Math.abs(Math.sin(t * 6)) * h * 0.07;
    ctx.translate(0, -bounce);
    // 다리
    ctx.strokeStyle = '#e8962a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    [-w * 0.14, w * 0.14].forEach((off, i) => {
      const swing = Math.sin(t * 6 + i * Math.PI) * 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + off, cy + h * 0.3);
      ctx.lineTo(cx + off + swing, cy + h * 0.5);
      ctx.stroke();
    });
    body(ctx, cx, cy, w * 0.42, h * 0.4, '#ffe27a', '#f7c03f');
    // 날개
    ctx.fillStyle = '#f3b93a';
    ctx.beginPath();
    ctx.ellipse(cx - dir * w * 0.26, cy + h * 0.04, w * 0.14, h * 0.2,
      Math.sin(t * 6) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    beak(ctx, cx + dir * w * 0.32, cy + h * 0.02, w * 0.12, dir);
    eyes(ctx, cx + dir * w * 0.06, cy - h * 0.08, w * 0.13, w * 0.085, dir, blink);
    blush(ctx, cx + dir * w * 0.06, cy + h * 0.08, w * 0.24, w * 0.075);

  } else if (kind === 'sparrow') {
    const flap = Math.sin(t * 12);
    body(ctx, cx, cy, w * 0.4, h * 0.36, '#c9a882', '#a07f5c');
    // 배
    ctx.fillStyle = '#f0e3d0';
    ctx.beginPath();
    ctx.ellipse(cx + dir * w * 0.05, cy + h * 0.1, w * 0.24, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 날개(퍼덕임)
    ctx.fillStyle = '#8d6e4d';
    ctx.beginPath();
    ctx.ellipse(cx - dir * w * 0.14, cy - h * 0.06 + flap * h * 0.1,
      w * 0.28, h * 0.13, -dir * (0.5 + flap * 0.45), 0, Math.PI * 2);
    ctx.fill();
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(cx - dir * w * 0.36, cy);
    ctx.lineTo(cx - dir * w * 0.6, cy - h * 0.12);
    ctx.lineTo(cx - dir * w * 0.58, cy + h * 0.14);
    ctx.closePath();
    ctx.fill();
    beak(ctx, cx + dir * w * 0.34, cy, w * 0.11, dir, '#e0a53c');
    eyes(ctx, cx + dir * w * 0.12, cy - h * 0.08, w * 0.1, w * 0.075, dir, blink);

  } else if (kind === 'hotchi') {
    // 불꽃 머리
    const fl = Math.sin(t * 9) * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.95;
    const fg = ctx.createLinearGradient(0, cy - h * 0.95, 0, cy - h * 0.2);
    fg.addColorStop(0, '#fff0a8');
    fg.addColorStop(0.5, '#ffb03a');
    fg.addColorStop(1, '#ff7043');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.26, cy - h * 0.24);
    ctx.quadraticCurveTo(cx - w * 0.1, cy - h * (0.7 + fl), cx, cy - h * (0.95 + fl));
    ctx.quadraticCurveTo(cx + w * 0.1, cy - h * (0.7 - fl), cx + w * 0.26, cy - h * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    body(ctx, cx, cy + h * 0.06, w * 0.42, h * 0.36, '#ffa552', '#f2703a');
    eyes(ctx, cx, cy + h * 0.02, w * 0.14, w * 0.09, dir, blink);
    blush(ctx, cx, cy + h * 0.18, w * 0.26, w * 0.075, '#ffd0b0');

  } else if (kind === 'bubble') {
    const wob = Math.sin(t * 3) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.9;
    const bg = ctx.createRadialGradient(cx - w * 0.14, cy - h * 0.18, w * 0.05, cx, cy, w * 0.46);
    bg.addColorStop(0, 'rgba(255,255,255,0.95)');
    bg.addColorStop(0.55, 'rgba(150,215,250,0.85)');
    bg.addColorStop(1, 'rgba(96,180,235,0.9)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * (0.44 + wob), h * (0.44 - wob), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(70,150,205,0.5)';
    ctx.stroke();
    ctx.restore();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.18, cy - h * 0.2, w * 0.1, h * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, cx, cy, w * 0.13, w * 0.08, dir, blink);

  } else if (kind === 'frost') {
    const spin = t * 1.2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * w * 0.46, Math.sin(a) * w * 0.46);
      ctx.stroke();
    }
    ctx.restore();
    body(ctx, cx, cy, w * 0.3, h * 0.3, '#eaf7ff', '#b3ddf5');
    eyes(ctx, cx, cy, w * 0.1, w * 0.065, dir, blink);

  } else {
    // 알 수 없는 종류 — 기본 둥근 몸
    body(ctx, cx, cy, w * 0.42, h * 0.4, '#d8c6a8', '#b39f7d');
    eyes(ctx, cx, cy, w * 0.13, w * 0.08, dir, blink);
  }

  ctx.restore();
}

// 회전하는 코인 (정지된 원보다 훨씬 살아있어 보인다)
export function drawCoin(ctx, cx, cy, r, t) {
  const s = Math.cos(t * 3.4);
  const rx = Math.max(r * 0.16, Math.abs(s) * r);
  const g = ctx.createLinearGradient(cx - rx, cy - r, cx + rx, cy + r);
  g.addColorStop(0, '#ffe488');
  g.addColorStop(0.5, '#ffd028');
  g.addColorStop(1, '#e8a600');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c98a00';
  ctx.stroke();
  if (rx > r * 0.45) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff3bd';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.3, cy - r * 0.2, rx * 0.26, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
