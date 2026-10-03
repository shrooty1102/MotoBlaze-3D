// "How to Play" tutorial: illustrated slides, adapted to touch or keyboard devices.
import './tutorial.css';
import { sfx } from './audio.js';

const key = (k, wide) => `<kbd class="${wide ? 'wide' : ''}">${k}</kbd>`;
const tbtn = (label, cls) => `<span class="t-tbtn ${cls}">${label}</span>`;
const STAR = `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`;
const COIN = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f7b500"/><circle cx="12" cy="12" r="7.2" fill="#ffd34d" stroke="#d99400" stroke-width="1.2"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="900" fill="#a86b00">$</text></svg>`;

function slides(touch) {
  return [
    {
      title: 'Welcome to MotoBlaze 3D',
      text: 'Race against <b>4 rival riders</b> across <b>30 levels</b>. Finish in the <b>top 3</b> to unlock the next level. Levels 1–10 are easy, and things get much tougher after that!',
      art: `<div class="t-podium">
        <div class="p p2"><span>2</span></div><div class="p p1"><span>1</span><i class="trophy">🏆</i></div><div class="p p3"><span>3</span></div>
      </div>`,
    },
    touch ? {
      title: 'Riding controls',
      text: 'Use <b>◀ ▶</b> on the left to steer. On the right, hold <b>GAS</b> to speed up and <b>BRAKE</b> to slow down. Auto-accelerate is on, so you can just steer and brake (change it in Settings).',
      art: `<div class="t-phone">
        <div class="screen-area">
          <div class="l">${tbtn('◀', 'steer')}${tbtn('▶', 'steer')}</div>
          <div class="r"><div class="col">${tbtn('N2O', 'n2o')}${tbtn('BRAKE', 'brake')}</div>${tbtn('GAS', 'gas')}</div>
        </div>
      </div>`,
    } : {
      title: 'Riding controls',
      text: 'Hold <b>↑ / W</b> to accelerate, <b>↓ / S</b> to brake, and steer with <b>← → / A D</b>. Press <b>Esc</b> to pause. A gamepad works too!',
      art: `<div class="t-keys">
        <div class="cluster"><div>${key('↑')}</div><div>${key('←')}${key('↓')}${key('→')}</div><small>or</small><div>${key('W')}</div><div>${key('A')}${key('S')}${key('D')}</div></div>
        <div class="legend"><span><i class="g"></i>Accelerate</span><span><i class="r"></i>Brake</span><span><i class="b"></i>Steer</span></div>
      </div>`,
    },
    {
      title: 'Nitro & boost pads',
      text: `Your <b>nitro bar</b> fills up slowly. Press ${touch ? '<b>N2O</b>' : '<b>Space</b>'} to burn it for a big burst of speed. Ride over the <b>cyan arrow pads</b> on the road for a free boost and extra nitro.`,
      art: `<div class="t-nitro">
        <div class="pad"><i></i><i></i><i></i></div>
        <div class="bar"><b></b><span>NITRO</span></div>
        ${touch ? tbtn('N2O', 'n2o big') : key('SPACE', true)}
      </div>`,
    },
    {
      title: 'Take corners like a pro',
      text: '<b>Brake before sharp corners!</b> Go in too fast and your bike slides wide and loses speed. Stay on the <b>inside line</b>, because it is shorter. Grass and walls slow you down a lot.',
      art: `<svg class="t-corner" viewBox="0 0 220 140">
        <path d="M10 130 L10 70 Q10 15 65 15 L210 15" fill="none" stroke="#3b3c41" stroke-width="38" stroke-linejoin="round"/>
        <path d="M10 130 L10 70 Q10 15 65 15 L210 15" fill="none" stroke="#f5d000" stroke-width="2" stroke-dasharray="8 8"/>
        <path d="M22 130 L22 78 Q24 32 70 30 L210 30" fill="none" stroke="#3ddc84" stroke-width="4" stroke-linecap="round"/>
        <path d="M2 130 L-3 60" fill="none" stroke="#ff4060" stroke-width="3" stroke-dasharray="5 5"/>
        <circle cx="22" cy="100" r="11" fill="#ff2e4d"/><text x="22" y="104" text-anchor="middle" font-size="11" font-weight="900" fill="#fff">B</text>
        <text x="118" y="60" fill="#3ddc84" font-size="13" font-weight="700">inside line</text>
        <text x="44" y="118" fill="#ff8a9a" font-size="12" font-weight="700">brake here</text>
      </svg>`,
    },
    {
      title: 'Watch out for hazards',
      text: 'From level 4 you will find <b>traffic cones</b>, which slow you right down, and <b>oil slicks</b>, which make your bike slip. Steer around them, and don\'t bump into rivals either!',
      art: `<div class="t-hazards">
        <div><svg viewBox="0 0 60 70"><path d="M30 6 L44 58 H16 Z" fill="#ff6a00"/><path d="M25 26 H35 L37.5 36 H22.5 Z" fill="#fff"/><rect x="8" y="58" width="44" height="7" rx="2" fill="#ff6a00"/></svg><span>Cones</span></div>
        <div><svg viewBox="0 0 80 50"><ellipse cx="40" cy="27" rx="36" ry="18" fill="#0a0a0a"/><ellipse cx="30" cy="21" rx="14" ry="5" fill="#ffffff" opacity=".25"/><ellipse cx="52" cy="31" rx="8" ry="3" fill="#7b2cbf" opacity=".35"/></svg><span>Oil slicks</span></div>
      </div>`,
    },
    {
      title: 'Win stars & coins',
      text: '1st place earns <b>3 stars</b>, 2nd earns <b>2</b> and 3rd earns <b>1</b>. Every finish earns <b>coins</b>, and higher levels pay more. Spend coins in the <b>Garage</b> on faster bikes with better grip.',
      art: `<div class="t-rewards">
        <div class="stars"><i>${STAR}</i><i class="mid">${STAR}</i><i>${STAR}</i></div>
        <div class="coins">${COIN}<b>+100</b></div>
        <div class="ranks"><span>1st ★★★</span><span>2nd ★★</span><span>3rd ★</span></div>
      </div>`,
    },
    {
      title: 'Ready to ride?',
      text: `Pick your bike, choose your rider and start with <b>Level 1</b>. You can open this tutorial again any time from the <b>How to Play</b> button.`,
      art: `<div class="t-ready"><span class="flag">🏁</span><span class="go">GO!</span></div>`,
    },
  ];
}

/** Show the tutorial. Resolves when the player finishes or skips it. */
export function showTutorial({ touch, onDone } = {}) {
  const list = slides(touch);
  let i = 0;
  const el = document.createElement('div');
  el.className = 'modal tutorial';
  el.innerHTML = `<div class="panel t-panel">
    <button class="t-skip">Skip</button>
    <div class="t-art"></div>
    <div class="t-step"></div>
    <h3 class="t-title"></h3>
    <p class="t-text"></p>
    <div class="t-dots">${list.map(() => '<i></i>').join('')}</div>
    <div class="t-nav">
      <button class="btn ghost t-back">Back</button>
      <button class="btn primary t-next">Next</button>
    </div>
  </div>`;
  const art = el.querySelector('.t-art');
  const dots = [...el.querySelectorAll('.t-dots i')];

  const render = () => {
    const s = list[i];
    art.innerHTML = s.art;
    art.classList.remove('in'); void art.offsetWidth; art.classList.add('in');
    el.querySelector('.t-step').textContent = `${i + 1} / ${list.length}`;
    el.querySelector('.t-title').textContent = s.title;
    el.querySelector('.t-text').innerHTML = s.text;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    el.querySelector('.t-back').style.display = i === 0 ? 'none' : '';
    el.querySelector('.t-next').textContent = i === list.length - 1 ? "LET'S RACE!" : 'Next';
    el.querySelector('.t-skip').style.visibility = i === list.length - 1 ? 'hidden' : 'visible';
  };
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    el.remove();
    onDone?.();
  };
  const go = (d) => {
    const n = i + d;
    if (n >= list.length) { sfx.click(); close(); return; }
    if (n < 0) return;
    i = n; sfx.click(); render();
  };
  const onKey = (e) => {
    if (['ArrowRight', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  el.querySelector('.t-next').onclick = () => go(1);
  el.querySelector('.t-back').onclick = () => go(-1);
  el.querySelector('.t-skip').onclick = () => { sfx.click(); close(); };
  dots.forEach((d, k) => d.onclick = () => { i = k; render(); });
  // swipe between slides
  let sx = null;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  el.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(el);
  render();
  el.querySelector('.t-next').focus();
  return close;
}
