// The race: physics, AI, camera, race rules. Rendering-agnostic UI via callbacks.
import * as THREE from 'three';
import { Track, buildWorld, rng } from './track.js';
import { buildRacer, disposeObject } from './models.js';
import { BIKES, AVATARS, PAINTS, RIVAL_NAMES, THEMES } from './data.js';
import { readInput } from './input.js';
import * as audio from './audio.js';

const GRAVITY = 9.8;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const fwd = new THREE.Vector3();
const frameOut = {};

export function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,14,28,0.72)';
  ctx.beginPath(); ctx.roundRect(8, 10, 240, 44, 22); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(34, 32, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 28px Rajdhani, Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 138, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.14, 0.035, 1);
  s.position.y = 2.35;
  return s;
}

export class Race {
  constructor({ renderer, env, cfg, profile, quality, hud, onFinish }) {
    this.renderer = renderer;
    this.cfg = cfg;
    this.profile = profile;
    this.hud = hud;
    this.onFinish = onFinish;
    this.theme = THEMES[cfg.theme];
    this.quality = quality;

    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = this.theme.night ? 0.25 : 0.6;
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 9000);

    this.track = new Track(cfg);
    // at least 2 laps, except a single lap on very long circuits
    cfg.laps = this.track.length > 5000 ? 1 : Math.max(2, Math.min(3, Math.round(cfg.raceDistance / this.track.length)));
    this.layout = this._layout();
    this.world = buildWorld(this.scene, this.track, cfg, this.theme, quality, this.layout);

    this._createRacers();

    this.state = 'countdown'; // countdown | racing | finished
    this.countdown = 3.6;
    this.lastCount = 4;
    this.time = 0;
    this.paused = false;
    this.shake = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.finishOrder = [];
    this.introT = 0;
    // coaching tips during the very first race
    this.coach = cfg.level === 1 && !profile.coachDone ? { shown: new Set(), busyUntil: 0 } : null;
    this._placeCameraInitially();
    this.hud.setupMinimap(this.track);
    this.hud.setLaps(cfg.laps);
  }

  // ---- layout of boost pads + obstacles ----
  _layout() {
    const r = rng(this.cfg.seed + 31);
    const L = this.track.length;
    const W = this.track.width;
    const pads = [];
    const obstacles = [];
    const taken = [];
    const free = (s, gap = 60) => taken.every((t) => Math.abs(((s - t + L * 1.5) % L) - L / 2) < L / 2 - gap);
    for (let i = 0; i < this.cfg.boostPads; i++) {
      // pads on straighter sections
      for (let tries = 0; tries < 40; tries++) {
        const s = 150 + r() * (L - 250);
        if (Math.abs(this.track.curvatureAt(s)) < 0.006 && free(s)) {
          pads.push({ s, d: (r() * 2 - 1) * (W / 2 - 3) });
          taken.push(s);
          break;
        }
      }
    }
    for (let i = 0; i < this.cfg.obstacles; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const s = 200 + r() * (L - 260);
        if (free(s, 45)) {
          obstacles.push({ s, d: (r() * 2 - 1) * (W / 2 - 2.5), type: r() < 0.55 ? 'cone' : 'oil' });
          taken.push(s);
          break;
        }
      }
    }
    return { pads, obstacles };
  }

  _createRacers() {
    const p = this.profile;
    const r = rng(this.cfg.seed + 17);
    const playerBike = BIKES.find((b) => b.id === p.bike) || BIKES[0];
    const playerAvatar = AVATARS.find((a) => a.id === p.avatar) || AVATARS[0];
    const names = [...RIVAL_NAMES].sort(() => r() - 0.5);
    const avatars = AVATARS.filter((a) => a.id !== playerAvatar.id);
    const W = this.track.width;
    this.racers = [];
    const rivalColors = ['#2ec4b6', '#ffd60a', '#ff4d6d', '#80ed99', '#c77dff', '#ff9f1c'];

    for (let i = 0; i < 5; i++) {
      const isPlayer = i === 4;
      let bikeDef, paint, avatar, name;
      if (isPlayer) {
        bikeDef = playerBike; paint = p.paint || playerBike.color; avatar = playerAvatar; name = p.name || 'You';
      } else {
        // rivals ride bikes that roughly match the level
        const tier = Math.min(BIKES.length - 1, Math.floor(this.cfg.diff * 5.5 + r() * 1.5));
        bikeDef = BIKES[tier];
        paint = PAINTS[(r() * PAINTS.length) | 0];
        avatar = avatars[i % avatars.length];
        name = names[i];
      }
      const model = buildRacer(bikeDef, paint, avatar);
      model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(model.group);

      const aiSpread = [1.0, 0.975, 0.955, 0.935][i] ?? 1;
      const racer = {
        id: i, name, isPlayer, bikeDef, avatar, model,
        s: -6 - (4 - i) * 0, d: 0, v: 0, latV: 0, drift: 0,
        topSpeed: isPlayer ? bikeDef.topSpeed : this.cfg.aiTopSpeed * aiSpread * (0.98 + r() * 0.04),
        accel: isPlayer ? bikeDef.accel : this.cfg.aiAccel * (0.95 + r() * 0.1),
        grip: isPlayer ? bikeDef.grip : 20 + this.cfg.diff * 7,
        handling: isPlayer ? bikeDef.handling : 0.9,
        nitro: 0.5, boostTime: 0, nitroOn: false, slipTime: 0, stunTime: 0,
        finished: false, finishTime: 0, lane: (r() * 2 - 1) * (W / 2 - 3),
        laneTimer: 0, steerVis: 0, lean: 0, wheelSpin: 0, mistakeTimer: 3 + r() * 10,
        prevS: 0, scrape: 0,
      };
      // starting grid: 2 columns, player at the back
      const row = i;
      racer.s = -5 - row * 5.5;
      racer.d = (row % 2 ? 1 : -1) * W * 0.18;
      racer.prevS = racer.s;
      if (!isPlayer) {
        racer.label = nameSprite(name, avatar.helmet);
        model.group.add(racer.label);
      }
      this.racers.push(racer);
    }
    this.player = this.racers[4];

    if (this.theme.night) {
      const head = new THREE.SpotLight(0xfff1d6, 60, 90, 0.45, 0.6, 1.2);
      head.position.set(0, 1.1, 0.9);
      head.target.position.set(0, 0, 22);
      this.player.model.root.add(head, head.target);
    }
  }

  _placeCameraInitially() {
    const p = this.player;
    this._updateRacerTransform(p, 0);
    this.camPos.copy(p.model.group.position).add(new THREE.Vector3(8, 4, 8));
    this.camLook.copy(p.model.group.position);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- main update ----------
  update(dt) {
    if (this.paused) return;
    dt = Math.min(dt, 1 / 20);

    if (this.state === 'countdown') {
      this.countdown -= dt;
      this.introT += dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n >= 0) {
        this.lastCount = n;
        if (n >= 1 && n <= 3) { this.hud.flash(String(n), 'count'); audio.sfx.countBeep(); }
        this._setStartLights(Math.max(0, 4 - n));
      }
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.hud.flash('GO!', 'go');
        audio.sfx.goBeep();
        this._setStartLights(-1);
      }
    } else {
      this.time += dt;
    }

    const input = this.state === 'racing' ? readInput() : { steer: 0, throttle: 0, brake: 0, nitro: false };
    if (this.state === 'racing' && this.profile.autoGas && input.brake === 0) input.throttle = 1;

    for (const r of this.racers) {
      let ctrl;
      if (r.isPlayer && !r.finished && !this.autopilot) ctrl = input;
      else ctrl = this._aiControl(r, dt);
      if (this.state === 'countdown') ctrl = { steer: 0, throttle: 0, brake: 1, nitro: false };
      this._physics(r, ctrl, dt);
    }
    this._collisions();
    for (const r of this.racers) {
      this._checkTriggers(r);
      this._checkLaps(r);
      this._updateRacerTransform(r, dt);
    }

    this._updateCamera(dt);
    this._updateHud();
    if (this.coach && this.state === 'racing') this._coachTick();

    // shadows follow the player
    const pp = this.player.model.group.position;
    const sunDir = tmpV.set(...this.theme.sunDir).normalize();
    this.world.sun.position.copy(pp).addScaledVector(sunDir, 150);
    this.world.sun.target.position.copy(pp);
    this.world.sky.position.copy(this.camera.position);

    // pulse boost pads
    const pulse = 1.1 + Math.sin(performance.now() * 0.008) * 0.5;
    if (this.world.padMeshes[0]) this.world.padMeshes[0].material.emissiveIntensity = pulse;

    const p = this.player;
    audio.updateEngine(p.v, p.topSpeed, this.state === 'racing' ? Math.max(input.throttle, 0.2) : 0.1, p.nitroOn || p.boostTime > 0);
  }

  _setStartLights(n) {
    this.world.lightMats.forEach((m, i) => {
      if (n < 0) { m.emissive.set(0x00ff44); m.emissiveIntensity = 3; }
      else { m.emissive.set(0xff0000); m.emissiveIntensity = i < n * 2 - 1 ? 3 : 0; }
    });
  }

  // ---------- first-race coaching ----------
  _coachTick() {
    const c = this.coach, t = this.time, p = this.player, L = this.track.length;
    const show = (id, msg) => {
      if (c.shown.has(id) || t < c.busyUntil) return;
      c.shown.add(id);
      c.busyUntil = t + 4.6;
      this.hud.coach(msg);
    };
    show('gas', { key: 'Hold <kbd>↑</kbd> or <kbd>W</kbd> to accelerate', touch: 'Hold <b>GAS</b> to accelerate', auto: 'Your bike accelerates by itself. Hold <b>BRAKE</b> to slow down' });
    if (t > 5) show('steer', { key: 'Steer with <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>', touch: 'Tap <b>◀ ▶</b> to steer' });
    for (const pad of this.layout.pads) {
      const ahead = ((pad.s - (p.s % L)) % L + L) % L;
      if (t > 3 && ahead < 120) show('pad', 'Ride over the <b>cyan arrows</b> for a free speed boost!');
    }
    if (t > 11) show('brake', { key: 'Tap <kbd>↓</kbd> before sharp corners so you don’t slide wide', touch: 'Tap <b>BRAKE</b> before sharp corners so you don’t slide wide' });
    if (t > 16 && p.nitro > 0.5) show('nitro', { key: 'Nitro ready! Press <kbd>Space</kbd> for a boost', touch: 'Nitro ready! Tap <b>N2O</b> for a boost' });
    if (this.cfg.laps > 1 && Math.floor(p.s / L) >= this.cfg.laps - 1) show('final', 'Final lap! Finish in the <b>top 3</b> to unlock Level 2');
  }

  // ---------- AI ----------
  _aiControl(r, dt) {
    const track = this.track;
    const W = track.width;
    const cfg = this.cfg;
    const finishedPlayer = r.isPlayer && r.finished;
    const autopilot = r.isPlayer && !r.finished;

    // look ahead for the tightest curve within braking distance
    const look = 25 + r.v * 2.2;
    let kMax = 0, kSigned = 0;
    for (let a = 10; a <= look; a += 8) {
      const k = track.curvatureAt(r.s + a);
      if (Math.abs(k) > kMax) { kMax = Math.abs(k); kSigned = k; }
    }
    const skill = finishedPlayer ? 0.7 : cfg.aiCornerSkill;
    let cornerSpeed = kMax > 1e-4 ? Math.sqrt((r.grip * (0.82 + 0.22 * skill)) / kMax) : 999;
    let target = Math.min(r.topSpeed, cornerSpeed);
    if (finishedPlayer) target = Math.min(target, 30);

    // rubber band keeps the pack together (gentler on harder levels)
    if (!r.isPlayer && !autopilot && this.state === 'racing') {
      const gap = this.player.s - r.s;
      const band = 1 - cfg.diff * 0.6;
      if (gap > 60) target *= 1 + Math.min(0.1, gap / 1500) * band;
      if (gap < -90) target *= 1 - Math.min(0.12, -gap / 1200) * (0.5 + band);
      // occasional mistakes on easy levels
      r.mistakeTimer -= dt;
      if (r.mistakeTimer < 0) {
        r.mistakeTimer = 4 + Math.random() * (6 + cfg.diff * 30);
        if (Math.random() > cfg.diff) r.stunTime = Math.max(r.stunTime, 0.6 + Math.random());
      }
      if (r.stunTime > 0) target *= 0.8;
    }

    // racing line: inside of the upcoming corner, otherwise own lane
    const kNear = track.curvatureAt(r.s + 30 + r.v * 0.6);
    let lineD = r.lane;
    if (Math.abs(kNear) > 0.004) lineD = -Math.sign(kNear) * Math.min(W / 2 - 1.8, Math.abs(kNear) * 600);

    // avoid obstacles and bikes ahead
    const L = track.length;
    for (const ob of this.layout.obstacles) {
      const ahead = ((ob.s - (r.s % L)) % L + L) % L;
      if (ahead < 55 && Math.abs(lineD - ob.d) < 2.8) {
        lineD = ob.d + (ob.d > 0 ? -3.2 : 3.2);
      }
    }
    for (const o of this.racers) {
      if (o === r) continue;
      const ahead = o.s - r.s;
      if (ahead > 0 && ahead < 14 && Math.abs(o.d - r.d) < 1.6 && o.v < r.v + 2) {
        lineD = o.d + (o.d > 0 ? -2.4 : 2.4);
        if (ahead < 5) target = Math.min(target, o.v + 1);
      }
    }
    lineD = Math.max(-W / 2 + 1.2, Math.min(W / 2 - 1.2, lineD));
    r.laneTimer -= dt;
    if (r.laneTimer < 0) { r.laneTimer = 3 + Math.random() * 5; r.lane = (Math.random() * 2 - 1) * (W / 2 - 3); }

    const steer = Math.max(-1, Math.min(1, (lineD - r.d) * 0.45 - r.latV * 0.06));
    const throttle = r.v < target ? 1 : 0;
    const brake = r.v > target + 1.5 ? Math.min(1, (r.v - target) / 8) : 0;
    // nitro on straights for skilled riders
    const nitro = !finishedPlayer && cfg.diff > 0.25 && r.nitro > 0.4 && kMax < 0.004 && Math.random() < cfg.diff;
    return { steer, throttle, brake, nitro };
  }

  // ---------- physics ----------
  _physics(r, c, dt) {
    const track = this.track;
    const W = track.width;
    const k = track.curvatureAt(r.s);

    r.boostTime = Math.max(0, r.boostTime - dt);
    r.slipTime = Math.max(0, r.slipTime - dt);
    r.stunTime = Math.max(0, r.stunTime - dt);

    // nitro
    r.nitroOn = c.nitro && r.nitro > 0.02 && this.state === 'racing';
    if (r.nitroOn) r.nitro = Math.max(0, r.nitro - dt * 0.33);
    else if (this.state === 'racing') r.nitro = Math.min(1, r.nitro + dt * 0.035);

    const boosting = r.nitroOn || r.boostTime > 0;
    const offroad = Math.abs(r.d) > W / 2 + 1.3;
    let top = r.topSpeed * (boosting ? 1.22 : 1);
    if (offroad) top *= 0.55;
    if (r.stunTime > 0) top *= 0.85;

    // longitudinal
    if (c.throttle > 0 && r.v < top) {
      const a = r.accel * (boosting ? 1.6 : 1) * (1 - Math.pow(r.v / top, 3) * 0.85);
      r.v = Math.min(top, r.v + a * c.throttle * dt);
    } else if (r.v > top) {
      r.v = Math.max(top, r.v - (offroad ? 22 : 9) * dt);
    }
    if (c.brake > 0) r.v = Math.max(0, r.v - 30 * c.brake * dt);
    r.v = Math.max(0, r.v - (0.8 + 0.0016 * r.v * r.v) * dt * (c.throttle > 0 ? 0.2 : 1));

    // lateral: cornering grip vs. centrifugal demand
    const grip = r.grip * (r.slipTime > 0 ? 0.45 : 1) * (offroad ? 0.75 : 1);
    const need = r.v * r.v * Math.abs(k);
    const excess = Math.max(0, need - grip);
    r.drift = Math.sign(k) * excess * 0.55;          // pushes to the outside of the corner
    if (excess > 0) r.v = Math.max(0, r.v - excess * 0.22 * dt);

    let steer = c.steer;
    if (r.slipTime > 0) steer += Math.sin(performance.now() * 0.012 + r.id) * 0.8;
    const latTarget = steer * (5 + r.v * 0.2) * r.handling;
    r.latV += (latTarget - r.latV) * Math.min(1, dt * 7);
    r.d += (r.latV + r.drift) * dt;

    // barriers
    const limit = W / 2 + 6.4;
    if (Math.abs(r.d) > limit) {
      r.d = Math.sign(r.d) * limit;
      if (r.v > 12) {
        r.v -= r.v * 1.6 * dt;
        r.scrape = 0.15;
        if (r.isPlayer) this.shake = Math.max(this.shake, 0.25);
      }
      r.latV = -Math.sign(r.d) * 2;
    }
    r.scrape = Math.max(0, r.scrape - dt);

    // progress along track (inside line is shorter)
    const denom = Math.max(0.6, Math.min(1.6, 1 + k * r.d));
    r.prevS = r.s;
    r.s += (r.v * dt) / denom;
    r.steerVis += (steer - r.steerVis) * Math.min(1, dt * 8);
  }

  _collisions() {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        const ds = b.s - a.s;
        const dd = b.d - a.d;
        if (Math.abs(ds) < 2.1 && Math.abs(dd) < 1.0) {
          const push = (1.0 - Math.abs(dd)) / 2 + 0.02;
          const sgn = dd >= 0 ? 1 : -1;
          a.d -= sgn * push; b.d += sgn * push;
          a.latV -= sgn * 2; b.latV += sgn * 2;
          const [back, front] = ds > 0 ? [a, b] : [b, a];
          if (back.v > front.v) {
            const rel = back.v - front.v;
            back.v = front.v * 0.97;
            front.v += rel * 0.15;
            if ((back.isPlayer || front.isPlayer) && rel > 4) { audio.sfx.hit(); this.shake = 0.4; }
          }
        }
      }
    }
  }

  _crossed(r, s) {
    const L = this.track.length;
    return Math.floor((r.s - s) / L) > Math.floor((r.prevS - s) / L);
  }

  _checkTriggers(r) {
    for (const pad of this.layout.pads) {
      if (this._crossed(r, pad.s) && Math.abs(r.d - pad.d) < 2.3) {
        r.boostTime = 1.6;
        r.nitro = Math.min(1, r.nitro + 0.25);
        if (r.isPlayer) { audio.sfx.boost(); this.hud.flash('BOOST!', 'boost'); }
      }
    }
    for (const ob of this.layout.obstacles) {
      if (!this._crossed(r, ob.s)) continue;
      if (ob.type === 'cone' && Math.abs(r.d - ob.d) < 1.7) {
        r.v *= 0.62; r.stunTime = 0.8;
        if (r.isPlayer) { audio.sfx.hit(); this.shake = 0.5; }
      } else if (ob.type === 'oil' && Math.abs(r.d - ob.d) < 2.0) {
        r.slipTime = 1.3;
        if (r.isPlayer) { audio.sfx.slip(); this.hud.flash('OIL!', 'warn'); }
      }
    }
  }

  _checkLaps(r) {
    const L = this.track.length;
    const laps = this.cfg.laps;
    if (r.finished) return;
    const lapNow = Math.floor(r.s / L);
    const lapPrev = Math.floor(r.prevS / L);
    if (lapNow > lapPrev && lapNow >= 1) {
      if (lapNow >= laps) {
        r.finished = true;
        r.finishTime = this.time;
        this.finishOrder.push(r);
        if (r.isPlayer) this._playerFinished();
      } else if (r.isPlayer) {
        audio.sfx.lap();
        this.hud.flash(lapNow === laps - 1 ? 'FINAL LAP' : `LAP ${lapNow + 1}`, 'lap');
      }
    }
  }

  _playerFinished() {
    this.state = 'finished';
    audio.sfx.finish();
    // estimate finishing times for riders still on track
    const L = this.track.length;
    const total = this.cfg.laps * L;
    const results = this.racers.map((r) => {
      if (r.finished) return { racer: r, time: r.finishTime };
      const avg = Math.max(25, (r.s / Math.max(1, this.time)) * 0.98);
      return { racer: r, time: this.time + Math.max(0.3, (total - r.s) / avg) };
    }).sort((a, b) => a.time - b.time);
    const rank = results.findIndex((x) => x.racer.isPlayer) + 1;
    this.hud.flash(rank === 1 ? '1ST PLACE!' : `FINISHED ${rank}${['ST', 'ND', 'RD', 'TH', 'TH'][rank - 1]}`, 'go');
    this.finishTimer = setTimeout(() => this.onFinish({
      rank,
      time: this.player.finishTime,
      results: results.map((x) => ({
        name: x.racer.name, isPlayer: x.racer.isPlayer, bike: x.racer.bikeDef.name, time: x.time, color: x.racer.avatar.helmet, avatar: x.racer.avatar,
      })),
    }), 2200);
  }

  // ---------- visuals ----------
  _updateRacerTransform(r, dt) {
    const f = this.track.frame(r.s, frameOut);
    const g = r.model.group;
    g.position.copy(f.pos).addScaledVector(f.right, r.d);
    g.position.y += 0.02;
    const lat = r.latV + r.drift;
    const yaw = Math.max(-0.5, Math.min(0.5, Math.atan2(lat, Math.max(r.v, 4))));
    fwd.copy(f.tan).multiplyScalar(Math.cos(yaw)).addScaledVector(f.right, Math.sin(yaw));
    tmpV2.copy(g.position).add(fwd);
    g.lookAt(tmpV2);

    const leanTarget = Math.max(-0.85, Math.min(0.85, Math.atan((-f.curv * r.v * r.v) / GRAVITY) * 0.85 + r.latV * 0.035));
    r.lean += (leanTarget - r.lean) * Math.min(1, dt * 6);
    r.model.lean.rotation.z = r.lean + (r.slipTime > 0 ? Math.sin(performance.now() * 0.02) * 0.08 : 0);
    // wheelie-ish pitch on boost
    const pitchT = (r.nitroOn || r.boostTime > 0) && r.v < r.topSpeed * 0.9 ? -0.05 : 0;
    r.model.lean.rotation.x += (pitchT - r.model.lean.rotation.x) * Math.min(1, dt * 4);

    const spin = (r.v * dt) / r.model.wheelRadius;
    r.model.frontWheel.rotation.x += spin;
    r.model.rearWheel.rotation.x += spin;
    r.model.steer.rotation.y = -r.steerVis * 0.22 * (1 - Math.min(1, r.v / 60) * 0.7);
    if (r.label) {
      const dist = g.position.distanceTo(this.camera.position);
      r.label.visible = dist < 160 && dist > 7;
    }
  }

  _updateCamera(dt) {
    const p = this.player;
    const g = p.model.group;
    const f = this.track.frame(p.s, frameOut);
    let desired, look;
    if (this.state === 'countdown') {
      // sweeping intro shot from the side to behind the bike
      const t = Math.min(1, this.introT / 3.4);
      const e = t * t * (3 - 2 * t);
      const ang = (1 - e) * 2.4;
      const back = tmpV.copy(f.tan).multiplyScalar(-Math.cos(ang) * (6.5 + (1 - e) * 2)).addScaledVector(f.right, Math.sin(ang) * (7 + (1 - e) * 2));
      desired = g.position.clone().add(back).add(new THREE.Vector3(0, 2.4 + (1 - e) * 1.2, 0));
      look = g.position.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(f.tan, e * 8);
      this.camPos.lerp(desired, Math.min(1, dt * 5));
      this.camLook.lerp(look, Math.min(1, dt * 6));
    } else if (this.state === 'finished') {
      const t = performance.now() * 0.0003;
      desired = g.position.clone().add(new THREE.Vector3(Math.cos(t) * 8, 3, Math.sin(t) * 8));
      look = g.position.clone().add(new THREE.Vector3(0, 1, 0));
      this.camPos.lerp(desired, Math.min(1, dt * 2));
      this.camLook.lerp(look, Math.min(1, dt * 4));
    } else {
      const speedK = Math.min(1, p.v / 70);
      const dir = tmpV.set(0, 0, 1).applyQuaternion(g.quaternion);
      const camDir = dir.lerp(f.tan, 0.5).normalize();
      desired = g.position.clone().addScaledVector(camDir, -(4.6 + speedK * 1.4)).add(new THREE.Vector3(0, 1.85 + speedK * 0.25, 0));
      look = g.position.clone().addScaledVector(camDir, 7).add(new THREE.Vector3(0, 1.0, 0));
      const k = 1 - Math.exp(-dt * 9);
      this.camPos.lerp(desired, k);
      this.camLook.lerp(look, 1 - Math.exp(-dt * 14));
    }
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.25;
      this.camera.position.add(tmpV2.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    // keep camera above ground
    const fy = f.pos.y + 0.6;
    if (this.camera.position.y < fy) this.camera.position.y = fy;
    this.camera.lookAt(this.camLook);
    // roll slightly into corners & widen FOV at speed
    this.camera.rotateZ(-p.lean * 0.12);
    const boosting = p.nitroOn || p.boostTime > 0;
    const fovT = 62 + Math.min(1, p.v / 75) * 12 + (boosting ? 8 : 0);
    this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
  }

  standings() {
    return [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.s - a.s;
    });
  }

  _updateHud() {
    const p = this.player;
    const L = this.track.length;
    const order = this.standings();
    const pos = order.indexOf(p) + 1;
    const lap = Math.min(this.cfg.laps, Math.max(1, Math.floor(p.s / L) + 1));
    this.hud.update({
      pos, lap, laps: this.cfg.laps,
      speed: Math.round(p.v * 3.6),
      speedRatio: p.v / (p.topSpeed * 1.22),
      time: this.time,
      nitro: p.nitro,
      boosting: p.nitroOn || p.boostTime > 0,
      standings: order,
      racers: this.racers,
      track: this.track,
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    clearTimeout(this.finishTimer);
    for (const r of this.racers) {
      disposeObject(r.model.group);
      if (r.label) { r.label.material.map.dispose(); r.label.material.dispose(); }
    }
    this.world.dispose();
  }
}
