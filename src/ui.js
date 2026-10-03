// DOM user interface: menus, HUD, touch controls, results.
import { BIKES, AVATARS, PAINTS, LEVEL_COUNT, levelConfig, tierName, rewardFor } from './data.js';
import * as store from './storage.js';
import { bindHold, isTouchDevice, resetTouch } from './input.js';
import { sfx } from './audio.js';
import { showTutorial } from './tutorial.js';

const STAR = `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`;
const COIN = `<svg viewBox="0 0 24 24" class="coin-ico"><circle cx="12" cy="12" r="10" fill="#f7b500"/><circle cx="12" cy="12" r="7.2" fill="#ffd34d" stroke="#d99400" stroke-width="1.2"/><path d="M12 7.6v8.8M9.6 9.8c0-1 1-1.6 2.4-1.6s2.4.6 2.4 1.6-1 1.4-2.4 1.6-2.4.6-2.4 1.6 1 1.6 2.4 1.6 2.4-.6 2.4-1.6" fill="none" stroke="#a86b00" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V7a3 3 0 00-6 0v3z"/></svg>`;
const GEAR = `<svg viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 000-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 000 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 001.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 001.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" transform="translate(-1 0)"/></svg>`;
const HELP = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2v2zm2.1-7.7l-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.4-2.1 1.2-2.8l1.2-1.3c.4-.4.6-.9.6-1.4a2 2 0 00-4 0H8a4 4 0 018 0c0 .9-.4 1.7-.9 2.3z"/></svg>`;
const PAUSE = `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmtTime = (t) => { const m = Math.floor(t / 60); const s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const ordinal = (n) => n + (['st', 'nd', 'rd'][n - 1] || 'th');

export class UI {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.screen = null;
    this.touch = isTouchDevice();
    document.body.classList.toggle('touch', this.touch);
  }

  clear() {
    this.root.innerHTML = '';
    this.screen = null;
  }

  topBar(title, back) {
    const p = store.profile();
    const bar = h(`<div class="topbar">
      ${back ? '<button class="btn icon back" aria-label="Back">&#8592;</button>' : '<span></span>'}
      <h2>${title}</h2>
      <div class="wallet"><span class="pill">${COIN}<b class="coins">${p.coins}</b></span><span class="pill star-pill">${STAR}<b>${store.totalStars()}</b></span></div>
    </div>`);
    if (back) bar.querySelector('.back').onclick = () => { sfx.click(); back(); };
    return bar;
  }

  // ---------------- TITLE ----------------
  showTitle() {
    this.clear();
    this.app.showroomOffset(-2.2);
    const p = store.profile();
    const el = h(`<div class="screen title-screen">
      <div class="logo"><span class="logo-moto">MOTO</span><span class="logo-blaze">BLAZE</span><span class="logo-3d">3D</span></div>
      <p class="tagline">5 riders. 30 world circuits. One champion.</p>
      <div class="panel title-panel">
        <label for="pname">Rider name</label>
        <input id="pname" maxlength="14" placeholder="Enter your name" autocomplete="off" value="${p.name ? p.name.replace(/"/g, '&quot;') : ''}" />
        <div class="err"></div>
        <button class="btn primary big start">START GAME</button>
        <div class="row">
          <button class="btn ghost help">${HELP} How to Play</button>
          <button class="btn ghost settings">${GEAR} Settings</button>
        </div>
        <div class="row">
          <button class="btn ghost install hidden">Install App</button>
        </div>
      </div>
      <div class="foot">${this.touch ? 'Touch controls enabled' : 'Arrow keys / WASD to ride &middot; Space for nitro &middot; Esc to pause'}</div>
    </div>`);
    const input = el.querySelector('#pname');
    const go = () => {
      const name = input.value.trim();
      if (name.length < 2) { el.querySelector('.err').textContent = 'Please enter a name (at least 2 letters)'; sfx.error(); input.focus(); return; }
      store.update({ name });
      sfx.click();
      this.app.unlockAudio();
      this.showGarage(() => this.showRider(() => this.showLevels()));
    };
    el.querySelector('.start').onclick = go;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    el.querySelector('.settings').onclick = () => { sfx.click(); this.showSettings(); };
    el.querySelector('.help').onclick = () => { sfx.click(); this.showTutorial(); };
    const installBtn = el.querySelector('.install');
    if (this.app.canInstall()) installBtn.classList.remove('hidden');
    installBtn.onclick = () => this.app.promptInstall();
    this.root.appendChild(el);
    this.screen = el;
    // first launch: walk the player through the basics
    if (!p.tutorialSeen) setTimeout(() => this.showTutorial(() => input.focus()), 400);
  }

  showTutorial(onDone) {
    return showTutorial({
      touch: this.touch,
      onDone: () => { store.update({ tutorialSeen: true }); onDone?.(); },
    });
  }

  // ---------------- GARAGE ----------------
  showGarage(next) {
    this.clear();
    const p = store.profile();
    let idx = Math.max(0, BIKES.findIndex((b) => b.id === p.bike));
    let paint = p.paint;
    this.app.showroomOffset(1.7);
    const el = h(`<div class="screen side-screen">
      <div class="side-panel panel">
        <div class="step">STEP 1 / 3 &middot; CHOOSE YOUR BIKE</div>
        <div class="bike-nav">
          <button class="btn icon prev" aria-label="Previous bike">&#8249;</button>
          <div class="bike-title"><h3 class="bname"></h3><span class="btype"></span></div>
          <button class="btn icon nextb" aria-label="Next bike">&#8250;</button>
        </div>
        <p class="bdesc"></p>
        <div class="stats"></div>
        <div class="paint-label">Paint</div>
        <div class="swatches"></div>
        <div class="dots"></div>
        <button class="btn primary big action"></button>
      </div>
    </div>`);
    el.prepend(this.topBar('Garage', () => this.showTitle()));
    const maxTop = Math.max(...BIKES.map((b) => b.topSpeed));
    const maxAcc = Math.max(...BIKES.map((b) => b.accel));
    const maxGrip = Math.max(...BIKES.map((b) => b.grip));
    const swatches = el.querySelector('.swatches');
    PAINTS.forEach((c) => {
      const s = h(`<button class="swatch" style="--c:${c}" aria-label="paint ${c}"></button>`);
      s.onclick = () => { sfx.click(); paint = c; render(); };
      swatches.appendChild(s);
    });
    const dots = el.querySelector('.dots');
    BIKES.forEach(() => dots.appendChild(h('<i></i>')));

    const render = (rebuild = true) => {
      const b = BIKES[idx];
      const owned = p.ownedBikes.includes(b.id);
      el.querySelector('.bname').textContent = b.name;
      el.querySelector('.btype').textContent = b.type.toUpperCase();
      el.querySelector('.bdesc').textContent = b.desc;
      const stat = (label, v, max, unit) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></div><em>${unit}</em></div>`;
      el.querySelector('.stats').innerHTML =
        stat('Top speed', b.topSpeed, maxTop, Math.round(b.topSpeed * 3.6) + ' km/h') +
        stat('Acceleration', b.accel, maxAcc, b.accel.toFixed(1)) +
        stat('Grip', b.grip, maxGrip, b.grip.toFixed(0));
      [...swatches.children].forEach((s, i) => s.classList.toggle('sel', (paint || b.color) === PAINTS[i]));
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
      const btn = el.querySelector('.action');
      if (owned) { btn.textContent = next ? 'SELECT & CONTINUE' : 'SELECT'; btn.className = 'btn primary big action'; }
      else {
        btn.innerHTML = `${LOCK} BUY ${COIN} ${b.price}`;
        btn.className = 'btn big action ' + (p.coins >= b.price ? 'buy' : 'locked');
      }
      if (rebuild) this.app.previewBike(b, paint || b.color, null);
    };
    el.querySelector('.prev').onclick = () => { sfx.click(); idx = (idx + BIKES.length - 1) % BIKES.length; paint = null; render(); };
    el.querySelector('.nextb').onclick = () => { sfx.click(); idx = (idx + 1) % BIKES.length; paint = null; render(); };
    el.querySelector('.action').onclick = () => {
      const b = BIKES[idx];
      if (!p.ownedBikes.includes(b.id)) {
        if (p.coins < b.price) { sfx.error(); this.toast(`You need ${b.price - p.coins} more coins. Win races to earn coins!`); return; }
        store.update({ coins: p.coins - b.price, ownedBikes: [...p.ownedBikes, b.id] });
        sfx.buy();
        this.toast(`${b.name} unlocked!`);
        el.querySelector('.coins').textContent = p.coins;
        render(false);
        return;
      }
      store.update({ bike: b.id, paint: paint || null });
      sfx.click();
      if (next) next(); else this.showLevels();
    };
    this.root.appendChild(el);
    render();
  }

  // ---------------- RIDER ----------------
  showRider(next) {
    this.clear();
    const p = store.profile();
    const bike = BIKES.find((b) => b.id === p.bike) || BIKES[0];
    this.app.showroomOffset(1.7);
    const el = h(`<div class="screen side-screen">
      <div class="side-panel panel">
        <div class="step">STEP 2 / 3 &middot; CHOOSE YOUR RIDER</div>
        <div class="avatars"></div>
        <p class="hint">Riding as <b>${p.name.replace(/</g, '&lt;')}</b></p>
        <button class="btn primary big go">${next ? 'CONTINUE' : 'DONE'}</button>
      </div>
    </div>`);
    el.prepend(this.topBar('Rider', () => this.showGarage(next ? () => this.showRider(next) : null)));
    const list = el.querySelector('.avatars');
    const pick = (a) => {
      store.update({ avatar: a.id });
      [...list.children].forEach((c) => c.classList.toggle('sel', c.dataset.id === a.id));
      this.app.previewBike(bike, p.paint || bike.color, a);
    };
    AVATARS.forEach((a) => {
      const card = h(`<button class="avatar" data-id="${a.id}">
        <div class="helmet" style="--h:${a.helmet};--s:${a.stripe};--v:${a.visor}"><i></i></div>
        <span>${a.name}</span>
        <div class="suit" style="background:linear-gradient(90deg,${a.suit} 60%,${a.accent} 60%)"></div>
      </button>`);
      card.onclick = () => { sfx.click(); pick(a); };
      list.appendChild(card);
    });
    pick(AVATARS.find((a) => a.id === p.avatar) || AVATARS[0]);
    el.querySelector('.go').onclick = () => { sfx.click(); next ? next() : this.showLevels(); };
    this.root.appendChild(el);
  }

  // ---------------- LEVELS ----------------
  showLevels() {
    this.clear();
    const p = store.profile();
    this.app.showroomOffset(0);
    const el = h(`<div class="screen levels-screen">
      <div class="levels-scroll"></div>
      <div class="levels-actions">
        <button class="btn ghost garage">Garage</button>
        <button class="btn ghost rider">Rider</button>
        <button class="btn ghost help" aria-label="How to play">${HELP}</button>
        <button class="btn ghost settings" aria-label="Settings">${GEAR}</button>
      </div>
    </div>`);
    el.prepend(this.topBar(`Select Level`, () => this.showTitle()));
    const scroll = el.querySelector('.levels-scroll');
    const tiers = [
      { name: 'EASY', from: 1, to: 10, cls: 'easy', desc: 'Learn the ropes. Gentle curves and slower rivals.' },
      { name: 'HARD', from: 11, to: 20, cls: 'hard', desc: 'Faster rivals, tighter corners, cones and oil.' },
      { name: 'EXPERT', from: 21, to: LEVEL_COUNT, cls: 'expert', desc: 'Elite riders. Brake late, use nitro, no mistakes.' },
    ];
    for (const t of tiers) {
      const sec = h(`<section class="tier ${t.cls}"><header><h3>${t.name}</h3><span>Levels ${t.from}-${t.to} &middot; ${t.desc}</span></header><div class="grid"></div></section>`);
      const grid = sec.querySelector('.grid');
      for (let n = t.from; n <= t.to; n++) {
        const cfg = levelConfig(n);
        const locked = n > p.unlocked;
        const stars = p.stars[n] || 0;
        const best = p.bestTimes[n];
        const card = h(`<button class="level ${locked ? 'locked' : ''} th-${cfg.theme}" ${locked ? 'disabled' : ''}>
          <span class="num">${n}</span>
          <span class="theme">${cfg.circuit.name}</span>
          <span class="meta">${cfg.circuit.country}${best ? ' &middot; ' + fmtTime(best) : ''}</span>
          <span class="stars">${[0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}">${STAR}</i>`).join('')}</span>
          ${locked ? `<span class="lock">${LOCK}</span>` : ''}
        </button>`);
        if (!locked) card.onclick = () => { sfx.click(); this.app.startRace(n); };
        grid.appendChild(card);
      }
      scroll.appendChild(sec);
    }
    el.querySelector('.garage').onclick = () => { sfx.click(); this.showGarage(null); };
    el.querySelector('.rider').onclick = () => { sfx.click(); this.showRider(null); };
    el.querySelector('.help').onclick = () => { sfx.click(); this.showTutorial(); };
    el.querySelector('.settings').onclick = () => { sfx.click(); this.showSettings(); };
    this.root.appendChild(el);
    // scroll to the newest unlocked level
    const target = scroll.querySelectorAll('.level')[Math.min(LEVEL_COUNT, p.unlocked) - 1];
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'center', behavior: 'instant' }));
  }

  // ---------------- SETTINGS ----------------
  showSettings() {
    const p = store.profile();
    const modal = h(`<div class="modal"><div class="panel settings-panel">
      <h3>Settings</h3>
      <label class="toggle"><span>Sound</span><input type="checkbox" class="snd" ${p.sound ? 'checked' : ''}/><i></i></label>
      <label class="toggle"><span>Auto-accelerate</span><input type="checkbox" class="auto" ${p.autoGas ? 'checked' : ''}/><i></i></label>
      <div class="seg"><span>Graphics</span><div>
        <button data-q="high" class="${this.app.quality() === 'high' ? 'sel' : ''}">High</button>
        <button data-q="low" class="${this.app.quality() === 'low' ? 'sel' : ''}">Performance</button></div></div>
      <div class="help">
        <h4>Controls</h4>
        <p><b>Keyboard:</b> &uarr;/W accelerate &middot; &darr;/S brake &middot; &larr;&rarr;/A D steer &middot; Space/Shift nitro &middot; Esc pause</p>
        <p><b>Touch:</b> drag the steering pad or use &#9664; &#9654; &middot; GAS / BRAKE / NITRO buttons on the right</p>
        <p><b>Gamepad:</b> left stick steer &middot; RT gas &middot; LT brake &middot; B nitro</p>
        <h4>Tips</h4>
        <p>Brake before tight corners or you'll slide wide. Hit the cyan arrow pads for a free boost. Inside lines are shorter!</p>
      </div>
      <div class="row"><button class="btn ghost reset">Reset progress</button><button class="btn primary close">Close</button></div>
    </div></div>`);
    modal.querySelector('.snd').onchange = (e) => { store.update({ sound: e.target.checked }); this.app.setSound(e.target.checked); };
    modal.querySelector('.auto').onchange = (e) => store.update({ autoGas: e.target.checked });
    modal.querySelectorAll('.seg button').forEach((b) => b.onclick = () => {
      store.update({ quality: b.dataset.q });
      modal.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('sel', x === b));
      this.app.applyQuality();
    });
    modal.querySelector('.reset').onclick = () => {
      if (confirm('Reset all progress, coins and bikes?')) {
        localStorage.clear();
        location.reload();
      }
    };
    modal.querySelector('.close').onclick = () => { sfx.click(); modal.remove(); };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }

  toast(text) {
    const t = h(`<div class="toast">${text}</div>`);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  }

  showLoading(text) {
    this.clear();
    const el = h(`<div class="screen loading"><div class="spinner"></div><h3>${text}</h3><p class="tip"></p></div>`);
    const tips = ['Brake before hairpins - sliding wide costs more time than braking.', 'Cyan arrow pads give you a free speed boost.', 'Nitro refills slowly - and faster when you hit boost pads.', 'Take the inside line in corners to cover less distance.', 'Avoid oil slicks - they make your bike lose grip.', 'Finish in the top 3 to unlock the next level.'];
    el.querySelector('.tip').textContent = tips[(Math.random() * tips.length) | 0];
    this.root.appendChild(el);
  }

  // ---------------- HUD ----------------
  showHUD(cfg, onPause) {
    this.clear();
    const el = h(`<div class="hud">
      <div class="hud-tl">
        <div class="hud-pos"><b class="pos">5</b><span>/5</span><small>POS</small></div>
        <div class="hud-lap">LAP <b class="lap">1</b>/<span class="laps">${cfg.laps}</span></div>
        <div class="hud-time">0:00.00</div>
        <ol class="standings"></ol>
      </div>
      <div class="hud-level">LEVEL ${cfg.level} &middot; ${cfg.circuit.name}, ${cfg.circuit.country}</div>
      <div class="hud-tr">
        <canvas class="minimap" width="180" height="180"></canvas>
        <button class="btn icon pause" aria-label="Pause">${PAUSE}</button>
      </div>
      <div class="flash"></div>
      <div class="coach hidden"><span class="coach-tag">TIP</span><span class="coach-text"></span></div>
      <div class="speedo">
        <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="50"/><circle class="val" cx="60" cy="60" r="50"/></svg>
        <div class="speed"><b>0</b><small>KM/H</small></div>
        <div class="nitro"><i></i><span>NITRO</span></div>
      </div>
      <div class="controls">
        <div class="ctl-left">
          <button class="tbtn left" aria-label="Steer left">&#9664;</button>
          <button class="tbtn right" aria-label="Steer right">&#9654;</button>
        </div>
        <div class="ctl-right">
          <button class="tbtn nitro-btn" aria-label="Nitro">N2O</button>
          <button class="tbtn brake" aria-label="Brake">BRAKE</button>
          <button class="tbtn gas" aria-label="Gas">GAS</button>
        </div>
      </div>
      <div class="speedlines"></div>
    </div>`);
    el.querySelector('.pause').onclick = onPause;
    if (this.touch) {
      bindHold(el.querySelector('.left'), 'left');
      bindHold(el.querySelector('.right'), 'right');
      bindHold(el.querySelector('.gas'), 'gas');
      bindHold(el.querySelector('.brake'), 'brake');
      bindHold(el.querySelector('.nitro-btn'), 'nitro');
      if (store.profile().autoGas) el.querySelector('.gas').classList.add('auto');
    }
    this.root.appendChild(el);
    this.hud = {
      el,
      pos: el.querySelector('.pos'), lap: el.querySelector('.lap'), time: el.querySelector('.hud-time'),
      standings: el.querySelector('.standings'), speed: el.querySelector('.speed b'),
      gauge: el.querySelector('.speedo .val'), nitro: el.querySelector('.nitro i'), nitroWrap: el.querySelector('.nitro'),
      flash: el.querySelector('.flash'), coach: el.querySelector('.coach'), map: el.querySelector('.minimap'), lines: el.querySelector('.speedlines'),
      lastStand: '',
    };
    return this;
  }

  setLaps(n) {
    this.hud.el.querySelector('.laps').textContent = n;
  }

  setupMinimap(track) {
    const c = this.hud.map;
    const ctx = c.getContext('2d');
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of track.pos) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const pad = 14;
    const scale = Math.min((c.width - pad * 2) / (maxX - minX), (c.height - pad * 2) / (maxZ - minZ));
    const ox = (c.width - (maxX - minX) * scale) / 2, oz = (c.height - (maxZ - minZ) * scale) / 2;
    this.mapXf = (x, z) => [ox + (x - minX) * scale, oz + (z - minZ) * scale];
    const bg = document.createElement('canvas');
    bg.width = c.width; bg.height = c.height;
    const b = bg.getContext('2d');
    b.lineJoin = 'round';
    const path = () => { b.beginPath(); track.pos.forEach((p, i) => { const [x, y] = this.mapXf(p.x, p.z); i ? b.lineTo(x, y) : b.moveTo(x, y); }); b.closePath(); };
    path(); b.strokeStyle = 'rgba(0,0,0,0.55)'; b.lineWidth = 9; b.stroke();
    path(); b.strokeStyle = 'rgba(255,255,255,0.9)'; b.lineWidth = 4; b.stroke();
    const [sx, sy] = this.mapXf(track.pos[0].x, track.pos[0].z);
    b.fillStyle = '#ffd60a'; b.fillRect(sx - 4, sy - 4, 8, 8);
    this.mapBg = bg;
    this.mapCtx = ctx;
  }

  update(s) {
    const H = this.hud;
    if (!H) return;
    H.pos.textContent = s.pos;
    H.lap.textContent = s.lap;
    H.time.textContent = fmtTime(s.time);
    H.speed.textContent = s.speed;
    H.gauge.style.strokeDashoffset = String(235.6 * (1 - Math.min(1, s.speedRatio)));
    H.nitro.style.width = `${Math.round(s.nitro * 100)}%`;
    H.nitroWrap.classList.toggle('active', s.boosting);
    H.lines.classList.toggle('on', s.boosting);
    const stand = s.standings.map((r) => r.name + (r.isPlayer ? '*' : '')).join('|');
    if (stand !== H.lastStand) {
      H.lastStand = stand;
      H.standings.innerHTML = s.standings.map((r, i) => `<li class="${r.isPlayer ? 'me' : ''}"><em>${i + 1}</em><i style="background:${r.avatar.helmet}"></i>${r.name.replace(/</g, '&lt;')}</li>`).join('');
    }
    // minimap
    const ctx = this.mapCtx;
    ctx.clearRect(0, 0, 180, 180);
    ctx.drawImage(this.mapBg, 0, 0);
    for (const r of s.racers) {
      const p = r.model.group.position;
      const [x, y] = this.mapXf(p.x, p.z);
      ctx.beginPath();
      ctx.arc(x, y, r.isPlayer ? 6 : 4.5, 0, 7);
      ctx.fillStyle = r.isPlayer ? '#ff3b30' : r.avatar.helmet;
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = r.isPlayer ? '#fff' : '#111'; ctx.stroke();
    }
  }

  // Coaching tip during the first race. msg = { touch, key } (or a plain string)
  coach(msg) {
    const c = this.hud?.coach;
    if (!c) return;
    let text = typeof msg === 'string' ? msg : (this.touch ? msg.touch : msg.key);
    if (msg.auto && this.touch && store.profile().autoGas) text = msg.auto;
    c.querySelector('.coach-text').innerHTML = text;
    c.classList.remove('hidden', 'show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(this.coachTimer);
    this.coachTimer = setTimeout(() => c.classList.add('hidden'), 4300);
  }

  flash(text, kind) {
    const f = this.hud?.flash;
    if (!f) return;
    const n = h(`<div class="msg ${kind}">${text}</div>`);
    f.appendChild(n);
    setTimeout(() => n.remove(), 1300);
  }

  showPause({ resume, restart, quit }) {
    const m = h(`<div class="modal pause-modal"><div class="panel">
      <h3>Paused</h3>
      <button class="btn primary big resume">RESUME</button>
      <button class="btn ghost big restart">Restart race</button>
      <button class="btn ghost big help">${HELP} How to Play</button>
      <button class="btn ghost big settings">${GEAR} Settings</button>
      <button class="btn ghost big quit">Quit to levels</button>
    </div></div>`);
    const close = () => m.remove();
    m.querySelector('.resume').onclick = () => { close(); resume(); };
    m.querySelector('.restart').onclick = () => { close(); restart(); };
    m.querySelector('.settings').onclick = () => this.showSettings();
    m.querySelector('.help').onclick = () => this.showTutorial();
    m.querySelector('.quit').onclick = () => { close(); quit(); };
    document.body.appendChild(m);
    resetTouch();
    return close;
  }

  // ---------------- PODIUM CEREMONY ----------------
  showCeremony(cfg, result, { skip, done }) {
    this.clear();
    const top = result.results.slice(0, 3);
    const medal = ['gold', 'silver', 'bronze'];
    const el = h(`<div class="screen ceremony-screen">
      <div class="cer-title"><small>${cfg.circuit.name.replace(/</g, '&lt;')} &middot; ${cfg.circuit.country}</small><h2>PODIUM</h2></div>
      <div class="cer-names">
        ${[1, 0, 2].map((i) => `<div class="cer-card ${medal[i]} ${top[i].isPlayer ? 'me' : ''}"><b>${i + 1}</b><span>${top[i].name.replace(/</g, '&lt;')}</span></div>`).join('')}
      </div>
      <div class="cer-actions">
        <button class="btn ghost skip">Skip</button>
        <button class="btn primary cont">CONTINUE &#8594;</button>
      </div>
    </div>`);
    const skipBtn = el.querySelector('.skip');
    skipBtn.onclick = () => { sfx.click(); skip(); skipBtn.remove(); };
    el.querySelector('.cont').onclick = () => { sfx.click(); done(); };
    this.root.appendChild(el);
  }

  // ---------------- RESULTS ----------------
  showResults(cfg, result, { next, retry, levels, garage }) {
    this.clear();
    const reward = rewardFor(result.rank, cfg.level);
    const p = store.profile();
    const hadUnlocked = p.unlocked;
    store.recordResult(cfg.level, result.rank, reward.stars, reward.coins, result.time);
    const unlockedNew = p.unlocked > hadUnlocked && cfg.level < LEVEL_COUNT;
    const canNext = cfg.level < LEVEL_COUNT && p.unlocked > cfg.level;
    const headline = result.rank === 1 ? 'VICTORY!' : result.rank <= 3 ? 'PODIUM FINISH!' : 'RACE OVER';
    const el = h(`<div class="screen results-screen">
      <div class="panel results">
        <div class="rank-badge r${result.rank}"><b>${result.rank}</b><small>${ordinal(result.rank).slice(-2).toUpperCase()}</small></div>
        <h2>${headline}</h2>
        <p class="sub">${cfg.circuit.name}, ${cfg.circuit.country} &middot; Level ${cfg.level} (${tierName(cfg.level)}) &middot; ${fmtTime(result.time)}</p>
        <div class="big-stars">${[0, 1, 2].map((i) => `<i data-i="${i}">${STAR}</i>`).join('')}</div>
        <div class="earned">${COIN}<b class="count">+0</b><span>coins</span></div>
        ${result.rank > 3 ? '<p class="warn-text">Finish in the top 3 to unlock the next level.</p>' : ''}
        ${unlockedNew ? `<p class="ok-text">Level ${cfg.level + 1} unlocked!</p>` : ''}
        <table class="res-table"><tbody>
          ${result.results.map((r, i) => `<tr class="${r.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><i style="background:${r.color}"></i>${r.name.replace(/</g, '&lt;')}</td><td>${r.bike}</td><td>${fmtTime(r.time)}</td></tr>`).join('')}
        </tbody></table>
        <div class="row">
          <button class="btn ghost levels">Levels</button>
          <button class="btn ghost garage">Garage</button>
          <button class="btn ghost retry">Retry</button>
          ${canNext ? '<button class="btn primary next">NEXT LEVEL &#8594;</button>' : ''}
        </div>
      </div>
    </div>`);
    el.querySelector('.levels').onclick = () => { sfx.click(); levels(); };
    el.querySelector('.garage').onclick = () => { sfx.click(); garage(); };
    el.querySelector('.retry').onclick = () => { sfx.click(); retry(); };
    if (canNext) el.querySelector('.next').onclick = () => { sfx.click(); next(); };
    this.root.appendChild(el);

    // animate stars then coins
    const stars = el.querySelectorAll('.big-stars i');
    for (let i = 0; i < reward.stars; i++) {
      setTimeout(() => { stars[i].classList.add('on'); sfx.star(i); }, 500 + i * 420);
    }
    const start = 600 + reward.stars * 420;
    const countEl = el.querySelector('.count');
    const t0 = performance.now() + start;
    const tick = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      countEl.textContent = '+' + Math.round(reward.coins * k);
      if (k < 1) requestAnimationFrame(tick);
      else sfx.coin();
    };
    requestAnimationFrame(tick);
  }
}
