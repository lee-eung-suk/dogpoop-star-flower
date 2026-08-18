// 공통 엔진: 캔버스/카메라(줌·흔들림)/입력/물리/파티클/사운드
export const LOGICAL_W = 960;
export const LOGICAL_H = 540;

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener('resize', resize);

  // 매 프레임 시작: 논리 해상도로 정규화 + 카메라 줌/흔들림 적용
  function beginFrame(camera) {
    resize();
    const base = canvas.width / LOGICAL_W;
    ctx.setTransform(base, 0, 0, base, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (camera) {
      ctx.translate(LOGICAL_W / 2 + camera.shakeX, LOGICAL_H / 2 + camera.shakeY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-LOGICAL_W / 2, -LOGICAL_H / 2);
    }
  }
  // 카메라 변환 없이 화면(논리) 좌표로 그리는 패스 — 비네트, 보스 체력바, 일시정지 등
  function beginOverlay() {
    const base = canvas.width / LOGICAL_W;
    ctx.setTransform(base, 0, 0, base, 0, 0);
  }

  return { ctx, resize, beginFrame, beginOverlay, canvas };
}

// 둥근 사각형 (구형 브라우저 대비 직접 구현)
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

// 발밑 그림자 — 공중에 뜰수록 작고 옅어진다
export function drawShadow(ctx, cx, groundY, width, height) {
  const fall = Math.max(0, Math.min(1, height / 220));
  const w = width * (1 - fall * 0.45);
  const alpha = 0.28 * (1 - fall * 0.7);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3b2a12';
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 2, w / 2, w / 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function loadImages(names) {
  return Promise.all(
    names.map((name) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve([name, im]);
      im.onerror = () => resolve([name, null]);
      im.src = 'assets/images/' + name;
    }))
  ).then((pairs) => Object.fromEntries(pairs));
}

export function drawSprite(ctx, images, name, fallbackEmoji, x, y, w, h, flip) {
  const im = name ? images[name] : null;
  ctx.save();
  if (im) {
    if (flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0, w, h);
    } else {
      ctx.drawImage(im, x, y, w, h);
    }
  } else {
    ctx.font = Math.floor(h * 0.9) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackEmoji, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

export function drawParallax(ctx, image, camX, factor, y, h, spanW) {
  if (!image) return;
  const width = spanW || LOGICAL_W;
  const scaledW = h * (image.width / image.height);
  let start = -((camX * factor) % scaledW);
  if (start > 0) start -= scaledW;
  for (let x = start - scaledW; x < width + scaledW; x += scaledW) {
    ctx.drawImage(image, x, y, scaledW, h);
  }
}

// ---------------- 카메라 ----------------
export class Camera {
  constructor(worldW, worldH) {
    this.x = 0;
    this.y = 0;
    this.worldW = worldW;
    this.worldH = worldH || LOGICAL_H;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakePower = 0;
    this.freezeTimer = 0;
    this.lockY = worldH ? false : true;
  }
  setZoom(z, instant) {
    this.targetZoom = z;
    if (instant) this.zoom = z;
  }
  shake(power) {
    this.shakePower = Math.max(this.shakePower, power);
  }
  freeze(seconds) {
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
  }
  isFrozen() {
    return this.freezeTimer > 0;
  }
  follow(tx, ty, dt, lead) {
    const halfW = LOGICAL_W / (2 * this.zoom);
    let centerX = tx + (lead || 0);
    centerX = Math.max(halfW, Math.min(centerX, this.worldW - halfW));
    const desiredX = centerX - LOGICAL_W / 2;
    const k = 1 - Math.pow(0.0001, dt);
    this.x += (desiredX - this.x) * k;

    if (!this.lockY) {
      const halfH = LOGICAL_H / (2 * this.zoom);
      let centerY = Math.max(halfH, Math.min(ty, this.worldH - halfH));
      const desiredY = centerY - LOGICAL_H / 2;
      this.y += (desiredY - this.y) * k;
    } else {
      this.y = 0;
    }
  }
  update(dt) {
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    const kz = 1 - Math.pow(0.005, dt);
    this.zoom += (this.targetZoom - this.zoom) * kz;
    if (this.shakePower > 0.01) {
      this.shakeX = (Math.random() - 0.5) * this.shakePower;
      this.shakeY = (Math.random() - 0.5) * this.shakePower;
      this.shakePower *= Math.pow(0.02, dt);
    } else {
      this.shakePower = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }
}

// ---------------- 입력 ----------------
const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
  ArrowDown: 'down', s: 'down', S: 'down',
  Shift: 'action', z: 'action', Z: 'action',
  x: 'roll', X: 'roll', c: 'roll', C: 'roll',
};

export class Input {
  constructor(buttons) {
    this.state = { left: false, right: false, jump: false, down: false, action: false, roll: false };
    this.pressed = {};
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    if (buttons) {
      Object.keys(buttons).forEach((name) => this._bind(buttons[name], name));
    }
  }
  _key(e, down) {
    const name = KEYMAP[e.key];
    if (!name) return;
    e.preventDefault();
    this._set(name, down);
  }
  _set(name, down) {
    if (down && !this.state[name]) this.pressed[name] = true;
    this.state[name] = down;
  }
  _bind(el, name) {
    if (!el) return;
    const handler = (down) => (e) => {
      e.preventDefault();
      this._set(name, down);
    };
    el.addEventListener('pointerdown', handler(true));
    el.addEventListener('pointerup', handler(false));
    el.addEventListener('pointercancel', handler(false));
    el.addEventListener('pointerleave', handler(false));
  }
  held(name) { return !!this.state[name]; }
  consume(name) {
    if (this.pressed[name]) { this.pressed[name] = false; return true; }
    return false;
  }
  clearPressed() { this.pressed = {}; }
  reset() {
    Object.keys(this.state).forEach((k) => { this.state[k] = false; });
    this.pressed = {};
  }
}

// ---------------- 물리 ----------------
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function moveAndCollide(e, platforms, dt) {
  const prevX = e.x;
  const prevY = e.y;
  e.x += e.vx * dt;
  for (const p of platforms) {
    if (p.oneWay) continue;
    if (rectsOverlap(e, p)) {
      if (prevX + e.w <= p.x + 0.01) { e.x = p.x - e.w; e.vx = 0; }
      else if (prevX >= p.x + p.w - 0.01) { e.x = p.x + p.w; e.vx = 0; }
    }
  }
  e.y += e.vy * dt;
  e.onGround = false;
  for (const p of platforms) {
    if (rectsOverlap(e, p)) {
      if (prevY + e.h <= p.y + 0.01 && e.vy >= 0) {
        e.y = p.y - e.h; e.vy = 0; e.onGround = true;
      } else if (!p.oneWay && prevY >= p.y + p.h - 0.01) {
        e.y = p.y + p.h; e.vy = 0;
      }
    }
  }
}

// ---------------- 파티클 ----------------
export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, count, colors, opts) {
    const o = opts || {};
    const pal = colors || ['#ffd93d', '#ff9f43', '#ff6b9d', '#6bcb77'];
    for (let i = 0; i < count; i++) {
      const angle = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
      const speed = (o.speed || 120) * (0.4 + Math.random() * 0.9);
      this.list.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (o.lift || 50),
        life: o.life || (0.5 + Math.random() * 0.4),
        maxLife: o.life || 0.9,
        size: (o.size || 4) * (0.6 + Math.random() * 0.8),
        color: pal[Math.floor(Math.random() * pal.length)],
        gravity: o.gravity != null ? o.gravity : 520,
        star: !!o.star,
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx, camX, camY) {
    const cy = camY || 0;
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      if (p.star) {
        drawStar(ctx, p.x - camX, p.y - cy, p.size * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - cy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------- 사운드 ----------------
export const Sound = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, delay, freqEnd) {
    try {
      const a = ac();
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = type || 'sine';
      const t0 = a.currentTime + (delay || 0);
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain || 0.14, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g).connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* no audio */ }
  }
  function noise(dur, gain) {
    try {
      const a = ac();
      const len = Math.floor(a.sampleRate * dur);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource();
      const g = a.createGain();
      g.gain.value = gain || 0.1;
      src.buffer = buf;
      src.connect(g).connect(a.destination);
      src.start();
    } catch (e) { /* no audio */ }
  }
  return {
    unlock() { ac(); },
    jump() { tone(420, 0.14, 'square', 0.09, 0, 780); },
    doubleJump() { tone(620, 0.16, 'square', 0.09, 0, 1100); },
    roll() { noise(0.22, 0.07); tone(200, 0.18, 'triangle', 0.07, 0, 90); },
    hover() { tone(520, 0.1, 'sine', 0.05, 0, 620); },
    inhale() { noise(0.2, 0.05); },
    spit() { tone(700, 0.14, 'square', 0.11, 0, 260); },
    swallow() { tone(300, 0.12, 'sine', 0.1, 0, 520); tone(520, 0.14, 'sine', 0.1, 0.1, 780); },
    ability() { [660, 880, 1180].forEach((f, i) => tone(f, 0.16, 'sine', 0.11, i * 0.06)); },
    attack() { tone(880, 0.1, 'square', 0.08, 0, 1200); },
    stomp() { tone(300, 0.08, 'square', 0.13); tone(140, 0.14, 'square', 0.11, 0.05); },
    coin() { tone(988, 0.07, 'sine', 0.1); tone(1318, 0.11, 'sine', 0.09, 0.05); },
    hit() { tone(180, 0.2, 'sawtooth', 0.15, 0, 90); noise(0.15, 0.08); },
    bad() { tone(220, 0.15, 'triangle', 0.13); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, i * 0.07)); },
    star() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.08, i * 0.05)); },
    bossHit() { tone(160, 0.22, 'sawtooth', 0.16, 0, 70); noise(0.25, 0.11); },
    success() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, 'sine', 0.14, i * 0.09)); },
    fail() { tone(240, 0.3, 'sawtooth', 0.11, 0, 110); tone(160, 0.36, 'sawtooth', 0.1, 0.12, 80); },
  };
})();

const ENCOURAGEMENTS = ['잘하고 있어! 💪', '조금만 더 힘내!', '멋져! 계속 가보자!', '와, 잘한다!', '대단한걸? ✨'];
export function randomEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}

export function showToast(root, text, duration) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration || 1400);
}
