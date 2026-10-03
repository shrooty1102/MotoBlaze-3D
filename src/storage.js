// Persistent player profile (saved in localStorage, which also persists inside Electron and Android WebView).

const KEY = 'motoblaze3d.save.v1';
const OLD_KEYS = ['motorush3d.save.v1']; // saves from before the rename

const DEFAULTS = {
  name: '',
  coins: 0,
  bike: 'viper',
  paint: null,
  avatar: 'max',
  ownedBikes: ['viper', 'dune'],
  unlocked: 1,
  stars: {},       // level -> best stars (0-3)
  bestTimes: {},   // level -> best time in seconds
  sound: true,
  quality: null,   // 'high' | 'low' | null (auto)
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY) ?? OLD_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return structuredClone(DEFAULTS);
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function profile() { return state; }

export function update(patch) {
  Object.assign(state, patch);
  save();
}

export function totalStars() {
  return Object.values(state.stars).reduce((a, b) => a + b, 0);
}

export function recordResult(level, rank, stars, coins, time) {
  state.coins += coins;
  if ((state.stars[level] || 0) < stars) state.stars[level] = stars;
  if (rank <= 3) {
    if (!state.bestTimes[level] || time < state.bestTimes[level]) state.bestTimes[level] = time;
    state.unlocked = Math.max(state.unlocked, level + 1);
  }
  save();
}
