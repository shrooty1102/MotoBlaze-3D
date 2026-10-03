import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Showroom } from './showroom.js';
import { Race } from './race.js';
import { Ceremony } from './ceremony.js';
import { UI } from './ui.js';
import { levelConfig, BIKES } from './data.js';
import * as store from './storage.js';
import * as audio from './audio.js';
import { isTouchDevice, resetTouch } from './input.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');

// ---------- profile defaults ----------
const profile = store.profile();
if (profile.autoGas === undefined) store.update({ autoGas: isTouchDevice() });
const autoQuality = () => (isTouchDevice() || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high');
const quality = () => profile.quality || autoQuality();

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function applyQuality() {
  const q = quality();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 2 : 1.25));
  resize();
}

const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const showroom = new Showroom(envTexture);
showroom.attach(canvas);

let race = null;
let ceremony = null;
let mode = 'menu'; // menu | race
let closePause = null;
let currentLevel = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  showroom.resize(w, h);
  race?.resize(w, h);
  ceremony?.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- PWA install ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  document.querySelector('.install')?.classList.remove('hidden');
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// ---------- app API used by UI ----------
const app = {
  quality,
  applyQuality,
  unlockAudio() { audio.initAudio(); audio.setSoundEnabled(profile.sound); },
  setSound(on) { audio.setSoundEnabled(on); },
  canInstall: () => !!deferredInstall,
  async promptInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    document.querySelector('.install')?.classList.add('hidden');
  },
  previewBike(bikeDef, paint, avatar) { showroom.setModel(bikeDef, paint, avatar); },
  showroomOffset(x) { showroom.offsetX = x; },
  startRace,
};

const ui = new UI(uiRoot, app);

// ---------- race flow ----------
function startRace(level) {
  currentLevel = level;
  app.unlockAudio();
  const c = levelConfig(level).circuit;
  ui.showLoading(`Level ${level} &middot; ${c.name}, ${c.country}`);
  // let the loading screen paint before the heavy world build
  setTimeout(() => {
    endRace();
    endCeremony();
    const cfg = levelConfig(level);
    const hud = ui.showHUD(cfg, pause);
    race = new Race({
      renderer, env: envTexture, cfg, profile, quality: quality(), hud,
      onFinish: (result) => finishRace(cfg, result),
    });
    renderer.toneMappingExposure = race.theme.exposure;
    resize();
    mode = 'race';
    resetTouch();
    audio.startEngine();
    // warm up shader compilation so the first frames don't stutter
    renderer.compile(race.scene, race.camera);
  }, 60);
}

function endRace() {
  if (race) {
    race.dispose();
    race = null;
  }
  audio.stopEngine();
  renderer.toneMappingExposure = 1.0;
}

function endCeremony() {
  if (ceremony) { ceremony.dispose(); ceremony = null; }
}

function finishRace(cfg, result) {
  audio.stopEngine();
  if (cfg.level === 1) store.update({ coachDone: true });
  // podium ceremony first, then the results card over it
  endRace();
  ceremony = new Ceremony({ env: envTexture, results: result.results, circuit: cfg.circuit });
  resize();
  mode = 'ceremony';
  ui.showCeremony(cfg, result, {
    skip: () => ceremony?.skipIntro(),
    done: () => showResults(cfg, result),
  });
}

function showResults(cfg, result) {
  mode = 'results';
  ui.showResults(cfg, result, {
    next: () => startRace(cfg.level + 1),
    retry: () => startRace(cfg.level),
    levels: () => { toMenu(); ui.showLevels(); },
    garage: () => { toMenu(); ui.showGarage(null); },
  });
}

function toMenu() {
  endRace();
  endCeremony();
  mode = 'menu';
  showCurrentBike();
}

function showCurrentBike() {
  const p = store.profile();
  const b = BIKES.find((x) => x.id === p.bike) || BIKES[0];
  showroom.setModel(b, p.paint || b.color, null);
}

function pause() {
  if (!race || race.paused || race.state === 'finished') return;
  race.paused = true;
  audio.stopEngine();
  closePause = ui.showPause({
    resume: () => { race.paused = false; closePause = null; audio.startEngine(); },
    restart: () => { closePause = null; startRace(currentLevel); },
    quit: () => { closePause = null; toMenu(); ui.showLevels(); },
  });
}

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && mode === 'race' && race) {
    if (race.paused && closePause) {
      closePause(); closePause = null; race.paused = false; audio.startEngine();
    } else pause();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'race') pause(); });

// ---------- main loop ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  if ((mode === 'ceremony' || mode === 'results') && ceremony) {
    ceremony.update(dt);
    renderer.render(ceremony.scene, ceremony.camera);
  } else if (mode === 'race' && race) {
    race.update(dt);
    race.render();
  } else {
    showroom.update(dt);
    renderer.render(showroom.scene, showroom.camera);
  }
}

// ---------- boot ----------
applyQuality();
showCurrentBike();
ui.showTitle();
loop();

// test/debug hook
window.__game = { startRace, get race() { return race; }, get ceremony() { return ceremony; }, ui };
