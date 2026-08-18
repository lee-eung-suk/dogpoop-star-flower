// 공통 HUD 렌더링
import { ABILITIES } from './entities.js';

export function renderStandardHud(rt, opts) {
  const o = opts || {};
  const p = rt.player;
  const hud = rt.hud;
  hud.innerHTML = '';

  const left = document.createElement('div');
  left.className = 'hud-left';

  const hearts = document.createElement('div');
  hearts.className = 'hearts';
  let s = '';
  for (let i = 0; i < p.maxHp; i++) s += i < p.hp ? '❤️' : '🖤';
  hearts.textContent = s;
  left.appendChild(hearts);

  const lives = document.createElement('div');
  lives.className = 'pill';
  lives.textContent = `🍀 ${p.lives}`;
  left.appendChild(lives);

  if (p.ability && ABILITIES[p.ability]) {
    const ab = document.createElement('div');
    ab.className = 'pill ability';
    ab.textContent = `${ABILITIES[p.ability].icon} ${ABILITIES[p.ability].name}`;
    left.appendChild(ab);
  }
  hud.appendChild(left);

  const right = document.createElement('div');
  right.className = 'hud-right';
  const coin = document.createElement('div');
  coin.className = 'pill';
  coin.textContent = `🪙 ${rt.coins}`;
  right.appendChild(coin);

  if (o.showNutrient) {
    const gaugeWrap = document.createElement('div');
    gaugeWrap.className = 'pill';
    gaugeWrap.textContent = `🌱 ${Math.floor(rt.nutrient)}%`;
    right.appendChild(gaugeWrap);
  }
  hud.appendChild(right);

  if (o.showNutrient) {
    const bar = document.createElement('div');
    bar.className = 'gauge-bar';
    const fill = document.createElement('div');
    fill.className = 'gauge-fill';
    fill.style.width = Math.min(100, rt.nutrient) + '%';
    bar.appendChild(fill);
    hud.appendChild(bar);
  }

  // 입에 문 상태 안내
  if (p.mouthful) {
    const tip = document.createElement('div');
    tip.className = 'mouth-tip';
    tip.textContent = '↓ 삼키기(능력 획득)   /   흡입버튼 뱉기';
    hud.appendChild(tip);
  }
}
