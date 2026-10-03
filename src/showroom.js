// 3D showroom behind the menus: rotating bike + rider on a lit podium.
import * as THREE from 'three';
import { buildBike, buildRider, disposeObject } from './models.js';

export class Showroom {
  constructor(env) {
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.45;
    this.scene.background = new THREE.Color(0x0b1020);
    this.scene.fog = new THREE.Fog(0x0b1020, 14, 40);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.angle = 0.6;
    this.autoRotate = true;
    this.offsetX = 0;

    // podium
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x0d1326, roughness: 0.35, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.55, 0.25, 64), new THREE.MeshStandardMaterial({ color: 0x1a2240, roughness: 0.25, metalness: 0.8 }));
    podium.position.y = 0.125;
    podium.receiveShadow = true;
    this.scene.add(podium);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.03, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff6a00 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.26;
    this.scene.add(ring);
    this.ring = ring;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.015, 8, 128), new THREE.MeshBasicMaterial({ color: 0x00c8ff }));
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.01;
    this.scene.add(ring2);

    // backdrop light streaks
    const streakMat = new THREE.MeshBasicMaterial({ color: 0x1f6fff, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 8 + Math.random() * 6), streakMat);
      const a = (i / 14) * Math.PI * 2;
      s.position.set(Math.cos(a) * 16, 4, Math.sin(a) * 16);
      s.lookAt(0, 4, 0);
      this.scene.add(s);
    }

    // lights
    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x10131f, 0.6));
    const key = new THREE.SpotLight(0xffffff, 110, 30, 0.55, 0.5, 1.6);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const rim = new THREE.SpotLight(0xff7a2a, 90, 30, 0.6, 0.6, 1.6);
    rim.position.set(-5, 5, -5);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0x3a7bff, 25, 20);
    fill.position.set(-4, 2, 4);
    this.scene.add(fill);

    this.holder = new THREE.Group();
    this.holder.position.y = 0.25;
    this.scene.add(this.holder);
    this.model = null;

    this.dragging = false;
  }

  setModel(bikeDef, paint, avatar) {
    if (this.model) {
      this.holder.remove(this.model.group);
      disposeObject(this.model.group);
    }
    const bike = buildBike(bikeDef, paint);
    if (avatar) bike.root.add(buildRider(avatar, bike.anchors).group);
    bike.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bike.group.scale.setScalar(1.5);
    this.holder.add(bike.group);
    this.model = bike;
    this.pop = 0;
  }

  // Allow drag-to-rotate on the canvas
  attach(canvas) {
    let lastX = 0;
    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; lastX = e.clientX; this.autoRotate = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.angle += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => { if (this.dragging) { this.dragging = false; setTimeout(() => { this.autoRotate = true; }, 2500); } });
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.portrait = h > w;
  }

  update(dt) {
    if (this.autoRotate) this.angle += dt * 0.35;
    this.holder.rotation.y = this.angle;
    if (this.model && this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 3);
      const e = 1 - Math.pow(1 - this.pop, 3);
      this.model.group.scale.setScalar(1.5 * (0.85 + 0.15 * e));
    }
    this.ring.material.color.setHSL(0.07, 1, 0.5 + Math.sin(performance.now() * 0.003) * 0.1);
    const dist = this.portrait ? 11.5 : 7.4;
    const camX = this.portrait ? 0 : this.offsetX;
    this.camera.position.set(camX, this.portrait ? 3.6 : 2.6, dist);
    this.camera.lookAt(camX, this.portrait ? 0.4 : 1.1, 0);
  }
}
