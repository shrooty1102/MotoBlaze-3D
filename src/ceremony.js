// Podium ceremony after a race: top 3 hop onto the podium, the winner lifts the trophy,
// everyone sprays champagne, confetti rains down. 4th and 5th clap from the side.
import * as THREE from 'three';
import { buildPodiumRider, buildChampagne, buildTrophy, disposeObject } from './models.js';
import { nameSprite } from './race.js';
import { sfx } from './audio.js';

const PLACES = [
  { x: 0, h: 1.0, z: 0 },        // 1st
  { x: -1.55, h: 0.7, z: 0.05 }, // 2nd
  { x: 1.55, h: 0.45, z: 0.05 }, // 3rd
  { x: -3.25, h: 0, z: 0.55 },   // 4th
  { x: 3.25, h: 0, z: 0.55 },    // 5th
];
const HOP_AT = [2.0, 1.2, 0.4];  // 3rd hops first, winner last
const RAISE_AT = 2.9, POP_AT = 3.8, SPRAY_END = 9.0;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function podiumFace(n) {
  const cols = { 1: ['#ffe066', '#f59f00'], 2: ['#f1f3f5', '#9aa3ad'], 3: ['#f0a46b', '#a0522d'] }[n];
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7fa'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = g;
    ctx.font = 'italic 900 150px Orbitron, Arial Black, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), w / 2, h / 2 + 22);
  });
}

function backdropTexture(circuit) {
  return canvasTexture(2048, 768, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0d1f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const logos = [['MOTOBLAZE', '#ff5a1f'], ['NITRO', '#2ff3ff'], ['APEX TYRES', '#80b918'], ['TURBO OIL', '#ffd60a'], ['SPEED X', '#c77dff']];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const [t, c] = logos[(row * 2 + col) % logos.length];
        const x = (col + 0.5 + (row % 2) * 0.5) * (w / 6), y = 250 + row * 135;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x - 150, y - 45, 300, 90);
        ctx.fillStyle = c;
        ctx.font = 'italic 900 46px Orbitron, Arial Black, sans-serif';
        ctx.fillText(t, x, y + 2);
      }
    }
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(0, h - 26, w, 26);
    void circuit;
  });
}

function dotTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

export class Ceremony {
  constructor({ env, results, circuit }) {
    this.t = 0;
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.5;
    this.scene.background = new THREE.Color(0x0b1020);
    this.scene.fog = new THREE.Fog(0x0b1020, 14, 34);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const S = this.scene;

    // stage
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x1a1f33, roughness: 0.6, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    S.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), new THREE.MeshStandardMaterial({ color: 0xa3121f, roughness: 0.95 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.005, 3);
    carpet.receiveShadow = true;
    S.add(carpet);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 6.75), new THREE.MeshStandardMaterial({ map: backdropTexture(circuit), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.25 }));
    wall.material.emissiveMap = wall.material.map;
    wall.position.set(0, 3.4, -2.6);
    S.add(wall);

    // podium blocks
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f8, roughness: 0.3, clearcoat: 0.6 });
    for (let i = 0; i < 3; i++) {
      const p = PLACES[i];
      const face = new THREE.MeshPhysicalMaterial({ map: podiumFace(i + 1), roughness: 0.3, clearcoat: 0.6 });
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, p.h, 1.3), [white, white, white, white, face, white]);
      block.position.set(p.x, p.h / 2, p.z);
      block.castShadow = true; block.receiveShadow = true;
      S.add(block);
    }

    // lights
    S.add(new THREE.HemisphereLight(0x9fb8ff, 0x201810, 0.7));
    const key = new THREE.SpotLight(0xffffff, 260, 40, 0.5, 0.45, 1.5);
    key.position.set(3, 10, 8);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    S.add(key, key.target);
    for (const [x, c] of [[-7, 0xff7a2a], [7, 0x2a8cff]]) {
      const rim = new THREE.SpotLight(c, 120, 30, 0.6, 0.6, 1.5);
      rim.position.set(x, 6, 3);
      rim.target.position.set(0, 1.5, 0);
      S.add(rim, rim.target);
    }

    // riders
    this.riders = results.map((r, i) => {
      const m = buildPodiumRider(r.avatar);
      m.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const place = PLACES[i];
      m.group.position.set(place.x, place.h, place.z);
      // podium riders angle slightly towards the centre
      m.group.rotation.y = i === 0 ? 0 : -Math.sign(place.x) * 0.25;
      if (i < 3) {
        const bottle = buildChampagne();
        // hold the bottle in the outer hand so the spray goes over the crowd
        const hand = place.x > 0 ? m.leftHand : m.rightHand;
        hand.add(bottle.group);
        m.bottle = bottle;
        m.sprayArm = place.x > 0 ? m.leftArm : m.rightArm;
        m.otherArm = place.x > 0 ? m.rightArm : m.leftArm;
        if (i === 0) {
          // winner: bottle in the right hand, trophy in the left
          m.sprayArm = m.rightArm; m.otherArm = m.leftArm;
          if (bottle.group.parent !== m.rightHand) m.rightHand.add(bottle.group);
          const trophy = buildTrophy();
          trophy.rotation.x = Math.PI;
          trophy.position.y = -0.02;
          m.leftHand.add(trophy);
        }
        m.group.visible = false;
      }
      const label = nameSprite(`${i + 1}. ${r.name}`, r.isPlayer ? '#ff5a1f' : r.avatar.helmet);
      label.position.y = 2.15;
      label.scale.set(0.16, 0.04, 1);
      m.group.add(label);
      S.add(m.group);
      return { ...m, place, data: r };
    });

    // champagne spray particles
    this.maxDrops = 4000;
    this.drops = { pos: new Float32Array(this.maxDrops * 3), vel: new Float32Array(this.maxDrops * 3), life: new Float32Array(this.maxDrops), next: 0 };
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.drops.pos, 3));
    this.dropGeo = dg;
    this.dropPoints = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.12, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.95, blending: THREE.AdditiveBlending }));
    this.dropPoints.frustumCulled = false;
    this.drops.pos.fill(-999);
    S.add(this.dropPoints);

    // confetti
    const n = 700;
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.11), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }), n);
    this.conf = [];
    const palette = ['#ff5a1f', '#ffd60a', '#2ff3ff', '#ff2bd6', '#80ed99', '#ffffff', '#ffc531'];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.conf.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 14, 7 + Math.random() * 9, -2 + Math.random() * 6),
        v: 0.7 + Math.random() * 0.9, ph: Math.random() * 6.28, rs: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      });
      this.confetti.setColorAt(i, col.set(palette[i % palette.length]));
    }
    this.confetti.visible = false;
    S.add(this.confetti);
    this.cheered = false;
    this.popped = false;

    this._tmpM = new THREE.Matrix4();
    this._tmpQ = new THREE.Quaternion();
    this._tmpE = new THREE.Euler();
    this._tmpV = new THREE.Vector3();
    this._tmpD = new THREE.Vector3();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // jump straight to the celebration (used by "Skip")
  skipIntro() {
    if (this.t < POP_AT) this.t = POP_AT - 0.05;
  }

  update(dt) {
    dt = Math.min(dt, 0.1);
    const t = (this.t += dt);

    // camera: slow push-in with a gentle sway; pull back on narrow screens
    const fit = Math.max(1, 1.5 / this.camera.aspect);
    const push = Math.min(1, t / 9);
    const dist = (9.5 - push * 2.2) * fit;
    this.camera.position.set(Math.sin(t * 0.25) * 1.2, 2.3 + push * 0.2, dist);
    this.camera.lookAt(0, 1.75, 0);

    // riders
    this.riders.forEach((r, i) => {
      const g = r.group;
      if (i < 3) {
        const start = HOP_AT[i];
        if (t < start) { g.visible = false; return; }
        g.visible = true;
        const k = Math.min(1, (t - start) / 0.7);
        const e = 1 - Math.pow(1 - k, 3);
        g.position.set(r.place.x, r.place.h * e + Math.sin(k * Math.PI) * 0.7, r.place.z - 1.6 * (1 - e));
        if (k >= 1 && i === 0 && !this.cheered) { this.cheered = true; sfx.cheer(7.5); this.confetti.visible = true; }
        this._animatePodiumArms(r, i, t);
      } else {
        // 4th & 5th clap
        const clap = Math.max(0, Math.sin(t * 13)) * 0.18;
        r.rightArm.rotation.set(-1.25, 0, 0.18 + clap);
        r.leftArm.rotation.set(-1.25, 0, -(0.18 + clap));
      }
    });

    if (t >= POP_AT && !this.popped) { this.popped = true; sfx.pop(); setTimeout(() => sfx.pop(), 120); setTimeout(() => sfx.pop(), 260); sfx.spray(SPRAY_END - POP_AT); }

    // emit + simulate champagne
    const D = this.drops;
    if (t >= POP_AT && t < SPRAY_END) {
      for (let i = 0; i < 3; i++) {
        const r = this.riders[i];
        r.bottle.tip.getWorldPosition(this._tmpV);
        // bottle points along its local -Y
        this._tmpD.set(0, -1, 0).applyQuaternion(r.bottle.group.getWorldQuaternion(this._tmpQ)).normalize();
        const n = Math.round(420 * dt);
        for (let k = 0; k < n; k++) {
          const j = D.next; D.next = (D.next + 1) % this.maxDrops;
          D.pos.set([this._tmpV.x, this._tmpV.y, this._tmpV.z], j * 3);
          const sp = 4.5 + Math.random() * 2.5;
          D.vel.set([
            this._tmpD.x * sp + (Math.random() - 0.5) * 0.7,
            this._tmpD.y * sp + (Math.random() - 0.5) * 0.7,
            this._tmpD.z * sp + (Math.random() - 0.5) * 0.7,
          ], j * 3);
          D.life[j] = 1.3 + Math.random() * 0.5;
        }
      }
    }
    for (let j = 0; j < this.maxDrops; j++) {
      if (D.life[j] <= 0) continue;
      D.life[j] -= dt;
      const o = j * 3;
      D.vel[o + 1] -= 7.5 * dt;
      D.vel[o] *= 0.985; D.vel[o + 2] *= 0.985;
      D.pos[o] += D.vel[o] * dt; D.pos[o + 1] += D.vel[o + 1] * dt; D.pos[o + 2] += D.vel[o + 2] * dt;
      if (D.life[j] <= 0 || D.pos[o + 1] < 0) { D.life[j] = 0; D.pos[o + 1] = -999; }
    }
    this.dropGeo.attributes.position.needsUpdate = true;

    // confetti
    if (this.confetti.visible) {
      this.conf.forEach((c, i) => {
        c.p.y -= c.v * dt;
        c.p.x += Math.sin(t * 2 + c.ph) * 0.4 * dt;
        if (c.p.y < 0.02) { c.p.y = 7 + Math.random() * 3; }
        this._tmpE.set(t * c.rs.x, t * c.rs.y, t * c.rs.z);
        this._tmpQ.setFromEuler(this._tmpE);
        this._tmpM.compose(c.p, this._tmpQ, this._tmpV.set(1, 1, 1));
        this.confetti.setMatrixAt(i, this._tmpM);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  _animatePodiumArms(r, i, t) {
    const inward = -Math.sign(r.place.x || -1); // swing direction towards the centre / crowd
    if (t < RAISE_AT) {
      r.sprayArm.rotation.set(0, 0, r.sprayArm === r.rightArm ? -0.12 : 0.12);
      r.otherArm.rotation.set(0, 0, r.otherArm === r.rightArm ? -0.12 : 0.12);
      return;
    }
    const k = Math.min(1, (t - RAISE_AT) / 0.6);
    const side = r.sprayArm === r.rightArm ? -1 : 1;
    let ax, az;
    if (t < POP_AT) {
      // shaking the bottle
      ax = -1.6 * k + Math.sin(t * 40) * 0.12 * k;
      az = side * 0.35 * k;
    } else {
      // spraying: sweep up/down and across
      const s = t - POP_AT;
      ax = -1.95 + Math.sin(s * 3.1 + i) * 0.3;
      az = side * 0.25 + Math.sin(s * 1.7 + i * 2) * 0.35 * inward;
    }
    r.sprayArm.rotation.set(ax, 0, az);
    // winner lifts the trophy, others punch the air
    const lift = i === 0 ? -2.95 : -2.6;
    r.otherArm.rotation.set(lift * k + Math.sin(t * 3) * 0.06, 0, (r.otherArm === r.rightArm ? -0.2 : 0.2) * k);
    r.group.position.y = r.place.h + Math.abs(Math.sin(t * 4 + i)) * 0.04 * k; // bouncing with joy
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    for (const r of this.riders) disposeObject(r.group);
  }
}
