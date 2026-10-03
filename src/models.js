// Procedural 3D models: motorbikes (6 styles) and riders.
// Bikes face +Z, ground contact at y = 0.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);

// ---------- shared materials ----------
const matCache = new Map();
function mat(key, factory) {
  if (!matCache.has(key)) matCache.set(key, factory());
  return matCache.get(key);
}
const M = {
  rubber: () => mat('rubber', () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0 })),
  chrome: () => mat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 1 })),
  alloy: () => mat('alloy', () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.9 })),
  darkMetal: () => mat('darkMetal', () => new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.8 })),
  black: () => mat('black', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.5, metalness: 0.2 })),
  leather: () => mat('leather', () => new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.8, metalness: 0 })),
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1 })),
  headlight: () => mat('headlight', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 2.5 })),
  taillight: () => mat('taillight', () => new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 2 })),
  brakeDisc: () => mat('disc', () => new THREE.MeshStandardMaterial({ color: 0x6d7075, roughness: 0.45, metalness: 0.9 })),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.3, metalness: 1 })),
};

function paintMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08,
  });
}

function mesh(geo, material, cast = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = false;
  return m;
}

// Extrude a side profile given as [z, y] points into a solid of given width centred on x = 0.
function profilePart(points, width, material, bevel = 0.04) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const depth = Math.max(0.01, width - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 6,
  });
  geo.rotateY(-Math.PI / 2);        // shape x -> +z (forward), extrusion -> -x
  geo.translate(depth / 2, 0, 0);
  geo.computeVertexNormals();
  return mesh(geo, material);
}

// Smooth profile helper: turns sparse points into a smooth closed outline
function smooth(points, segments = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map(([z, y]) => new THREE.Vector3(z, y, 0)), true, 'centripetal');
  return curve.getPoints(points.length * segments).map((p) => [p.x, p.y]);
}

function cylinderBetween(a, b, radius, material, radial = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radial);
  const m = mesh(geo, material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(Y, dir.normalize());
  return m;
}

function capsuleBetween(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.CapsuleGeometry(radius, len, 4, 10);
  const m = mesh(geo, material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(Y, dir.normalize());
  return m;
}

// ---------- wheels ----------
function buildWheel(radius, tireWidth, style) {
  const g = new THREE.Group();
  const tire = mesh(new THREE.TorusGeometry(radius - tireWidth * 0.55, tireWidth * 0.55, 14, 40), M.rubber());
  tire.rotation.y = Math.PI / 2;
  g.add(tire);
  if (style === 'dirt') {
    // knobby tread
    const knobGeo = new THREE.BoxGeometry(tireWidth * 1.15, 0.035, 0.045);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const k = mesh(knobGeo, M.rubber(), false);
      k.position.set(0, Math.sin(a) * radius, Math.cos(a) * radius);
      k.rotation.x = -a;
      g.add(k);
    }
  }
  const rimR = radius - tireWidth * 1.05;
  const rim = mesh(new THREE.TorusGeometry(rimR, 0.022, 8, 40), style === 'cruiser' ? M.chrome() : M.darkMetal());
  rim.rotation.y = Math.PI / 2;
  g.add(rim);
  const hub = mesh(new THREE.CylinderGeometry(0.055, 0.055, tireWidth * 1.4, 14), M.alloy());
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  if (style === 'dirt' || style === 'cruiser') {
    const n = style === 'dirt' ? 18 : 24;
    const spokeMat = style === 'cruiser' ? M.chrome() : M.alloy();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const side = i % 2 ? 1 : -1;
      const s = cylinderBetween(
        new THREE.Vector3(side * 0.04, Math.sin(a + 0.3) * 0.05, Math.cos(a + 0.3) * 0.05),
        new THREE.Vector3(0, Math.sin(a) * rimR, Math.cos(a) * rimR), 0.006, spokeMat, 4);
      s.castShadow = false;
      g.add(s);
    }
  } else {
    // 5 split alloy spokes
    const spokeGeo = new THREE.BoxGeometry(0.03, rimR - 0.04, 0.035);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      for (const off of [-0.09, 0.09]) {
        const s = mesh(spokeGeo, M.darkMetal(), false);
        const aa = a + off;
        s.position.set(0, Math.sin(aa) * (rimR / 2 + 0.02), Math.cos(aa) * (rimR / 2 + 0.02));
        s.rotation.x = -aa + Math.PI / 2;
        g.add(s);
      }
    }
  }
  const disc = mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.01, 28), M.brakeDisc(), false);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = -tireWidth * 0.75;
  g.add(disc);
  const caliper = mesh(new THREE.BoxGeometry(0.04, 0.09, 0.06), M.gold(), false);
  caliper.position.set(-tireWidth * 0.75 - 0.02, radius * 0.42, -radius * 0.25);
  g.add(caliper);
  return g;
}

// ---------- body styles ----------
// Each style returns geometry anchor points used to pose the rider.
function addBodyStyle(bike, type, paint, accent) {
  const g = bike.root;
  const P = paint, A = accent;
  let anchors;

  if (type === 'sport' || type === 'super' || type === 'hyper') {
    const scale = type === 'hyper' ? 1.06 : 1;
    // front cowl (nose)
    g.add(profilePart([[1.02, 0.74], [0.92, 0.93], [0.66, 1.03], [0.52, 1.0], [0.58, 0.84], [0.72, 0.62], [0.94, 0.6]], 0.32 * scale, P, 0.035));
    // side fairing panels
    g.add(profilePart([[0.74, 0.62], [0.58, 0.86], [0.36, 0.86], [0.16, 0.66], [0.02, 0.46], [0.26, 0.33], [0.6, 0.36]], 0.42 * scale, P, 0.03));
    // racing stripe decal across the side panel
    g.add(profilePart([[0.66, 0.6], [0.56, 0.74], [0.18, 0.56], [0.26, 0.48]], 0.43 * scale + 0.012, A, 0.006));
    // belly pan
    g.add(profilePart([[0.6, 0.36], [0.26, 0.28], [-0.06, 0.3], [0.02, 0.44], [0.26, 0.34]], 0.34, M.black(), 0.02));
    // tank
    g.add(profilePart([[0.52, 0.98], [0.42, 1.06], [0.12, 1.06], [-0.06, 0.92], [0.1, 0.84], [0.44, 0.86]], 0.36, P, 0.04));
    // tail
    g.add(profilePart([[-0.06, 0.9], [-0.6, 0.93], [-1.0, 1.06], [-1.03, 1.0], [-0.7, 0.84], [-0.15, 0.76]], 0.22, P, 0.03));
    g.add(profilePart([[-0.62, 0.86], [-0.98, 1.0], [-1.0, 0.97], [-0.66, 0.83]], 0.235, A, 0.004));
    // seat
    g.add(profilePart([[-0.04, 0.93], [-0.52, 0.93], [-0.6, 0.97], [-0.55, 0.88], [-0.05, 0.87]], 0.26, M.leather(), 0.025));
    // windscreen
    const ws = profilePart([[0.86, 1.0], [0.55, 1.2], [0.48, 1.16], [0.62, 1.03]], 0.3, M.glass(), 0.02);
    g.add(ws);
    // headlights
    for (const x of [-0.1, 0.1]) {
      const hl = mesh(new THREE.SphereGeometry(0.06, 12, 8), M.headlight(), false);
      hl.scale.set(1, 0.55, 0.6);
      hl.position.set(x, 0.8, 0.98);
      g.add(hl);
    }
    const tl = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.03), M.taillight(), false);
    tl.position.set(0, 1.0, -1.03);
    g.add(tl);
    if (type !== 'sport') {
      // winglets
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.18), A);
        w.position.set(s * 0.27, 0.8, 0.7);
        w.rotation.z = s * -0.25;
        g.add(w);
      }
    }
    if (type === 'hyper') {
      // twin side ducts and gold accents
      for (const s of [-1, 1]) {
        const duct = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.35), M.gold());
        duct.position.set(s * 0.25, 0.7, 0.45);
        g.add(duct);
      }
    }
    anchors = {
      hip: new THREE.Vector3(0, 1.0, -0.3), grip: new THREE.Vector3(0.24, 0.98, 0.42),
      peg: new THREE.Vector3(0.2, 0.48, -0.25), lean: 0.95, steerTop: new THREE.Vector3(0, 1.0, 0.5),
    };
  } else if (type === 'street') {
    // naked roadster: tank, exposed engine, round headlight
    g.add(profilePart(smooth([[0.48, 0.95], [0.3, 1.06], [0.0, 1.04], [-0.1, 0.9], [0.05, 0.78], [0.4, 0.78]], 3), 0.36, P, 0.05));
    g.add(profilePart(smooth([[-0.08, 0.9], [-0.5, 0.92], [-0.9, 1.0], [-0.92, 0.94], [-0.55, 0.8], [-0.15, 0.78]]), 0.24, P, 0.04));
    g.add(profilePart([[-0.06, 0.95], [-0.55, 0.96], [-0.6, 0.9], [-0.06, 0.88]], 0.28, M.leather(), 0.03));
    const hl = mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.1, 18), M.black());
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.98, 0.72);
    g.add(hl);
    const lens = mesh(new THREE.CircleGeometry(0.095, 18), M.headlight(), false);
    lens.position.set(0, 0.98, 0.775);
    g.add(lens);
    const tl = mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), M.taillight(), false);
    tl.position.set(0, 0.97, -0.93);
    g.add(tl);
    // radiator in accent colour
    const rad = mesh(new THREE.BoxGeometry(0.34, 0.26, 0.05), A);
    rad.position.set(0, 0.62, 0.42);
    rad.rotation.x = -0.25;
    g.add(rad);
    anchors = {
      hip: new THREE.Vector3(0, 1.03, -0.3), grip: new THREE.Vector3(0.32, 1.12, 0.35),
      peg: new THREE.Vector3(0.2, 0.46, -0.2), lean: 0.55, steerTop: new THREE.Vector3(0, 1.05, 0.48), bars: 0.36,
    };
  } else if (type === 'dirt') {
    g.add(profilePart(smooth([[0.45, 0.95], [0.2, 1.02], [-0.1, 0.98], [-0.05, 0.82], [0.35, 0.8]]), 0.36, P, 0.06));
    // long flat seat + rear fender
    g.add(profilePart([[0.1, 1.04], [-0.75, 1.05], [-1.05, 1.12], [-1.05, 1.06], [-0.7, 0.97], [0.1, 0.96]], 0.24, M.leather(), 0.03));
    g.add(profilePart(smooth([[-0.6, 0.98], [-1.1, 1.08], [-1.12, 1.03], [-0.65, 0.92]]), 0.2, P, 0.03));
    // side number plates
    g.add(profilePart([[-0.2, 1.0], [-0.65, 1.02], [-0.6, 0.78], [-0.25, 0.8]], 0.32, A, 0.02));
    // high front fender
    g.add(profilePart(smooth([[1.05, 0.8], [0.75, 0.86], [0.5, 0.8], [0.55, 0.76], [0.75, 0.8], [1.02, 0.76]]), 0.16, P, 0.02));
    const plate = mesh(new THREE.BoxGeometry(0.22, 0.24, 0.03), A);
    plate.position.set(0, 1.08, 0.6);
    plate.rotation.x = -0.35;
    g.add(plate);
    const hl = mesh(new THREE.CircleGeometry(0.05, 12), M.headlight(), false);
    hl.position.set(0, 1.08, 0.625);
    hl.rotation.x = -0.35;
    g.add(hl);
    anchors = {
      hip: new THREE.Vector3(0, 1.1, -0.15), grip: new THREE.Vector3(0.38, 1.25, 0.42),
      peg: new THREE.Vector3(0.2, 0.5, -0.1), lean: 0.35, steerTop: new THREE.Vector3(0, 1.15, 0.5), bars: 0.42,
    };
  } else {
    // cruiser: long, low, teardrop tank, chrome
    g.add(profilePart(smooth([[0.55, 0.9], [0.3, 1.0], [-0.1, 0.96], [-0.15, 0.84], [0.2, 0.78], [0.5, 0.8]], 3), 0.38, P, 0.06));
    g.add(profilePart([[-0.12, 0.84], [-0.4, 0.8], [-0.62, 0.92], [-0.66, 0.84], [-0.4, 0.72], [-0.12, 0.76]], 0.36, M.leather(), 0.04));
    // rear fender
    g.add(profilePart(smooth([[-0.45, 0.72], [-0.75, 0.8], [-1.1, 0.68], [-1.12, 0.5], [-1.0, 0.62], [-0.7, 0.72]]), 0.24, P, 0.03));
    // front fender
    g.add(profilePart(smooth([[1.15, 0.45], [0.95, 0.62], [0.72, 0.6], [0.72, 0.56], [0.95, 0.56], [1.1, 0.4]]), 0.2, P, 0.03));
    const hl = mesh(new THREE.SphereGeometry(0.12, 18, 12), M.chrome());
    hl.position.set(0, 0.98, 0.85);
    g.add(hl);
    const lens = mesh(new THREE.CircleGeometry(0.1, 18), M.headlight(), false);
    lens.position.set(0, 0.98, 0.965);
    g.add(lens);
    const tl = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), M.taillight(), false);
    tl.position.set(0, 0.78, -1.08);
    g.add(tl);
    // V-twin cylinders in chrome
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.32, 14), M.chrome());
      c.position.set(0, 0.62, s * 0.12);
      c.rotation.x = s * 0.5;
      g.add(c);
    }
    anchors = {
      hip: new THREE.Vector3(0, 0.88, -0.38), grip: new THREE.Vector3(0.42, 1.22, 0.42),
      peg: new THREE.Vector3(0.24, 0.42, 0.42), lean: 0.05, steerTop: new THREE.Vector3(0, 1.08, 0.62), bars: 0.46,
    };
  }
  return anchors;
}

/**
 * Build a bike. Returns { group, lean (Object3D to roll), frontWheel, rearWheel, steer, anchors }.
 * `group` is the root to position/orient; `lean` rolls around the ground contact line.
 */
export function buildBike(bikeDef, paintColor) {
  const type = bikeDef.type;
  const group = new THREE.Group();
  const lean = new THREE.Group();
  group.add(lean);
  const root = new THREE.Group();
  lean.add(root);

  const paint = paintMaterial(paintColor || bikeDef.color);
  const accentColor = new THREE.Color(paintColor || bikeDef.color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? 0x1a1a1a : 0xf2f2f2;
  const accent = paintMaterial(type === 'hyper' ? 0x222222 : accentColor);

  const dims = {
    street: { r: 0.32, tw: 0.11, rtw: 0.14, wb: [0.72, -0.66] },
    dirt: { r: 0.37, tw: 0.09, rtw: 0.11, wb: [0.78, -0.72] },
    cruiser: { r: 0.33, tw: 0.12, rtw: 0.17, wb: [0.9, -0.82] },
    sport: { r: 0.32, tw: 0.11, rtw: 0.15, wb: [0.74, -0.68] },
    super: { r: 0.32, tw: 0.11, rtw: 0.16, wb: [0.75, -0.7] },
    hyper: { r: 0.33, tw: 0.12, rtw: 0.17, wb: [0.78, -0.72] },
  }[type];

  const bike = { root };
  const anchors = addBodyStyle(bike, type, paint, accent);

  const frontWheel = buildWheel(dims.r, dims.tw, type);
  const rearWheel = buildWheel(dims.r, dims.rtw, type);
  const steer = new THREE.Group();          // steering assembly pivot
  steer.position.set(0, dims.r, dims.wb[0]);
  root.add(steer);
  steer.add(frontWheel);
  rearWheel.position.set(0, dims.r, dims.wb[1]);
  root.add(rearWheel);

  // Front forks: from axle up to the steering head
  const head = anchors.steerTop.clone().sub(steer.position);
  for (const s of [-1, 1]) {
    const lower = new THREE.Vector3(s * 0.1, 0, 0);
    const upper = new THREE.Vector3(s * 0.1, head.y, head.z);
    const mid = lower.clone().lerp(upper, 0.45);
    steer.add(cylinderBetween(lower, mid, 0.035, type === 'cruiser' ? M.chrome() : M.gold()));
    steer.add(cylinderBetween(mid, upper, 0.028, M.chrome()));
  }
  // triple clamp + handlebars
  const clamp = mesh(new THREE.BoxGeometry(0.26, 0.04, 0.1), M.darkMetal());
  clamp.position.copy(head);
  steer.add(clamp);
  const gripLocal = anchors.grip.clone().sub(steer.position);
  const barW = anchors.bars || 0.24;
  const leftGrip = new THREE.Vector3(-barW, gripLocal.y, gripLocal.z);
  const rightGrip = new THREE.Vector3(barW, gripLocal.y, gripLocal.z);
  if (anchors.bars) {
    steer.add(cylinderBetween(leftGrip, head, 0.016, type === 'cruiser' ? M.chrome() : M.black()));
    steer.add(cylinderBetween(head, rightGrip, 0.016, type === 'cruiser' ? M.chrome() : M.black()));
  } else {
    // clip-ons
    steer.add(cylinderBetween(new THREE.Vector3(-0.1, gripLocal.y, gripLocal.z), leftGrip, 0.016, M.black()));
    steer.add(cylinderBetween(new THREE.Vector3(0.1, gripLocal.y, gripLocal.z), rightGrip, 0.016, M.black()));
  }
  for (const gp of [leftGrip, rightGrip]) {
    const grip = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), M.rubber(), false);
    grip.rotation.z = Math.PI / 2;
    grip.position.copy(gp);
    steer.add(grip);
  }
  // mirrors
  for (const s of [-1, 1]) {
    const mirror = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), M.black(), false);
    mirror.position.set(s * (barW + 0.02), gripLocal.y + 0.14, gripLocal.z - 0.02);
    steer.add(mirror);
  }

  // Engine block
  const engine = mesh(new THREE.BoxGeometry(0.3, 0.32, 0.46), M.darkMetal());
  engine.position.set(0, 0.48, 0.05);
  root.add(engine);
  const cover = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 18), M.alloy());
  cover.rotation.z = Math.PI / 2;
  cover.position.set(0, 0.42, -0.08);
  root.add(cover);

  // Frame spars
  const frameMat = type === 'dirt' || type === 'street' ? accent : M.alloy();
  for (const s of [-1, 1]) {
    root.add(cylinderBetween(new THREE.Vector3(s * 0.13, anchors.steerTop.y - 0.05, anchors.steerTop.z - 0.05),
      new THREE.Vector3(s * 0.15, 0.55, -0.25), 0.03, frameMat));
    // swingarm to rear axle
    root.add(cylinderBetween(new THREE.Vector3(s * 0.14, 0.48, -0.22),
      new THREE.Vector3(s * 0.11, dims.r, dims.wb[1]), 0.035, M.darkMetal()));
  }
  // rear shock
  root.add(cylinderBetween(new THREE.Vector3(0, 0.52, -0.3), new THREE.Vector3(0, 0.82, -0.45), 0.03, M.gold()));

  // Exhaust
  if (type === 'cruiser') {
    for (const yo of [0, 0.1]) {
      root.add(cylinderBetween(new THREE.Vector3(0.2, 0.42 + yo, 0.2), new THREE.Vector3(0.22, 0.36 + yo, -1.0), 0.045, M.chrome()));
    }
  } else if (type === 'dirt') {
    root.add(cylinderBetween(new THREE.Vector3(0.18, 0.6, 0.1), new THREE.Vector3(0.18, 0.92, -0.85), 0.05, M.alloy()));
  } else {
    const can = mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 14), type === 'street' ? M.chrome() : M.darkMetal());
    can.position.set(0.2, 0.55, -0.75);
    can.rotation.x = Math.PI / 2 - 0.35;
    root.add(can);
    root.add(cylinderBetween(new THREE.Vector3(0.12, 0.32, 0.1), new THREE.Vector3(0.19, 0.48, -0.58), 0.035, M.darkMetal()));
  }

  // Footpegs
  for (const s of [-1, 1]) {
    const peg = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), M.alloy(), false);
    peg.rotation.z = Math.PI / 2;
    peg.position.set(s * anchors.peg.x, anchors.peg.y, anchors.peg.z);
    root.add(peg);
  }

  anchors.leftGrip = leftGrip.clone().add(steer.position);
  anchors.rightGrip = rightGrip.clone().add(steer.position);

  group.userData = { wheelRadius: dims.r };
  return { group, lean, root, frontWheel, rearWheel, steer, anchors, wheelRadius: dims.r };
}

// ---------- rider ----------
function solveKnee(a, c, l1, l2, hint) {
  const dir = new THREE.Vector3().subVectors(c, a);
  let d = dir.length();
  d = Math.min(d, l1 + l2 - 0.001);
  dir.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const perp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(perp, h);
}

function buildHelmet(avatar) {
  const helmet = new THREE.MeshPhysicalMaterial({ color: avatar.helmet, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const stripe = new THREE.MeshPhysicalMaterial({ color: avatar.stripe, roughness: 0.25, clearcoat: 1 });
  const visor = new THREE.MeshPhysicalMaterial({ color: avatar.visor, roughness: 0.05, metalness: 0.6, clearcoat: 1 });
  const head = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.145, 24, 18), helmet);
  shell.scale.set(0.95, 0.98, 1.08);
  head.add(shell);
  const band = mesh(new THREE.TorusGeometry(0.148, 0.018, 8, 30, Math.PI), stripe);
  band.rotation.y = Math.PI / 2;
  band.scale.set(1, 1.04, 1.12);
  head.add(band);
  const visorMesh = mesh(new THREE.SphereGeometry(0.158, 22, 12, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.28), visor, false);
  visorMesh.scale.set(0.97, 1, 1.1);
  head.add(visorMesh);
  return head;
}

/**
 * Build a rider posed on a bike, using anchors from buildBike.
 * Returns { group, torso } - torso can be tucked for nitro.
 */
export function buildRider(avatar, anchors) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: avatar.suit, roughness: 0.55, metalness: 0.05 });
  const accent = new THREE.MeshStandardMaterial({ color: avatar.accent, roughness: 0.5, metalness: 0.05 });
  const glove = M.black();

  const hip = anchors.hip.clone();
  const lean = anchors.lean; // 0 upright .. 1 full tuck
  const torsoLen = 0.43;
  const torsoDir = new THREE.Vector3(0, Math.cos(lean * 1.05), Math.sin(lean * 1.05)).normalize();
  const neck = hip.clone().addScaledVector(torsoDir, torsoLen);

  // pelvis + torso
  group.add(capsuleBetween(new THREE.Vector3(-0.1, hip.y, hip.z), new THREE.Vector3(0.1, hip.y, hip.z), 0.11, suit));
  const torso = capsuleBetween(hip, neck, 0.15, suit);
  torso.scale.set(1.15, 1, 0.85);
  group.add(torso);
  // chest accent panel
  const chest = capsuleBetween(hip.clone().lerp(neck, 0.35), neck.clone().lerp(hip, 0.1), 0.152, accent);
  chest.scale.set(0.7, 1, 0.88);
  group.add(chest);
  // back hump for sport tuck
  if (lean > 0.7) {
    const hump = capsuleBetween(hip.clone().lerp(neck, 0.55), neck.clone(), 0.09, suit);
    hump.position.y += 0.1;
    group.add(hump);
  }

  // helmet
  const headPos = neck.clone().addScaledVector(torsoDir, 0.09).add(new THREE.Vector3(0, 0.03, 0.04));
  const head = buildHelmet(avatar);
  head.position.copy(headPos);
  // tilt head up to look forward
  head.rotation.x = -lean * 0.6;
  group.add(head);

  // arms
  const shoulderBase = hip.clone().addScaledVector(torsoDir, torsoLen - 0.05);
  for (const s of [-1, 1]) {
    const shoulder = shoulderBase.clone().add(new THREE.Vector3(s * 0.2, 0, 0));
    const hand = (s < 0 ? anchors.leftGrip : anchors.rightGrip).clone();
    hand.y += 0.02;
    const elbow = solveKnee(shoulder, hand, 0.3, 0.3, new THREE.Vector3(s * 0.6, -0.8, -0.2));
    group.add(capsuleBetween(shoulder, elbow, 0.058, suit));
    group.add(capsuleBetween(elbow, hand, 0.05, accent));
    const pad = mesh(new THREE.SphereGeometry(0.075, 10, 8), accent);
    pad.position.copy(shoulder);
    group.add(pad);
    const g = mesh(new THREE.SphereGeometry(0.05, 10, 8), glove);
    g.position.copy(hand);
    group.add(g);
  }

  // legs
  for (const s of [-1, 1]) {
    const h = hip.clone().add(new THREE.Vector3(s * 0.12, 0, 0));
    const foot = anchors.peg.clone();
    foot.x = s * (anchors.peg.x + 0.02);
    foot.y += 0.04;
    const knee = solveKnee(h, foot, 0.44, 0.44, new THREE.Vector3(s * 0.5, 0.4, 1));
    group.add(capsuleBetween(h, knee, 0.085, suit));
    group.add(capsuleBetween(knee, foot, 0.068, suit));
    const slider = mesh(new THREE.SphereGeometry(0.06, 10, 8), accent);
    slider.position.copy(knee);
    slider.scale.set(1, 1, 0.7);
    group.add(slider);
    const boot = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.24), M.black());
    boot.position.copy(foot).add(new THREE.Vector3(0, -0.02, 0.06));
    group.add(boot);
  }

  return { group, head };
}

// ---------- podium ceremony props ----------
export function buildChampagne() {
  // points along local -Y (the cork end), so it follows the arm when held
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0f3d1e, roughness: 0.08, metalness: 0.1, clearcoat: 1 });
  const foil = M.gold();
  const label = new THREE.MeshStandardMaterial({ color: 0xf3e6c0, roughness: 0.6 });
  const body = mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.2, 18), glass);
  body.position.y = -0.1;
  g.add(body);
  const lab = mesh(new THREE.CylinderGeometry(0.0495, 0.0495, 0.08, 18, 1, true), label, false);
  lab.position.y = -0.09;
  g.add(lab);
  const shoulder = mesh(new THREE.CylinderGeometry(0.018, 0.048, 0.08, 18), glass);
  shoulder.position.y = -0.24;
  g.add(shoulder);
  const neck = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 12), foil);
  neck.position.y = -0.315;
  g.add(neck);
  const tip = new THREE.Object3D();
  tip.position.y = -0.36;
  g.add(tip);
  return { group: g, tip };
}

export function buildTrophy() {
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.18, metalness: 1 });
  const g = new THREE.Group();
  const prof = [[0, 0], [0.07, 0], [0.07, 0.03], [0.025, 0.05], [0.02, 0.14], [0.05, 0.17], [0.11, 0.22], [0.13, 0.32], [0.12, 0.33], [0, 0.26]];
  const cup = mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 24), gold);
  g.add(cup);
  for (const s of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), gold);
    handle.position.set(s * 0.13, 0.26, 0);
    handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(handle);
  }
  return g;
}

/**
 * A standing rider for the podium. Arms are pivot groups at the shoulders so they can be animated:
 * rotation.x < 0 raises an arm forward/up, rotation.z swings it sideways.
 * Returns { group, leftArm, rightArm, leftHand, rightHand, head }.
 */
export function buildPodiumRider(avatar) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: avatar.suit, roughness: 0.55, metalness: 0.05 });
  const accent = new THREE.MeshStandardMaterial({ color: avatar.accent, roughness: 0.5, metalness: 0.05 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // legs
  for (const s of [-1, 1]) {
    const hip = V(s * 0.11, 0.93, 0), foot = V(s * 0.14, 0.07, 0.02);
    const knee = solveKnee(hip, foot, 0.45, 0.45, V(0, 0, 1));
    group.add(capsuleBetween(hip, knee, 0.085, suit));
    group.add(capsuleBetween(knee, foot, 0.07, suit));
    const pad = mesh(new THREE.SphereGeometry(0.065, 10, 8), accent);
    pad.position.copy(knee).add(V(0, 0, 0.04));
    group.add(pad);
    const boot = mesh(new THREE.BoxGeometry(0.11, 0.13, 0.26), M.black());
    boot.position.copy(foot).add(V(0, -0.005, 0.05));
    group.add(boot);
  }
  // pelvis, torso, chest panel
  group.add(capsuleBetween(V(-0.1, 0.95, 0), V(0.1, 0.95, 0), 0.11, suit));
  const torso = capsuleBetween(V(0, 0.95, 0), V(0, 1.4, 0), 0.15, suit);
  torso.scale.set(1.15, 1, 0.8);
  group.add(torso);
  const chest = capsuleBetween(V(0, 1.1, 0.02), V(0, 1.36, 0.02), 0.152, accent);
  chest.scale.set(0.7, 1, 0.82);
  group.add(chest);
  const head = buildHelmet(avatar);
  head.position.set(0, 1.6, 0.01);
  group.add(head);

  const arm = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.21, 1.37, 0);
    const pad = mesh(new THREE.SphereGeometry(0.075, 10, 8), accent);
    pivot.add(pad);
    pivot.add(capsuleBetween(V(0, 0, 0), V(0, -0.29, 0.02), 0.058, suit));
    pivot.add(capsuleBetween(V(0, -0.29, 0.02), V(0, -0.56, 0.05), 0.05, accent));
    const hand = new THREE.Group();
    hand.position.set(0, -0.6, 0.05);
    hand.add(mesh(new THREE.SphereGeometry(0.052, 10, 8), M.black()));
    pivot.add(hand);
    pivot.rotation.z = s * 0.12;
    group.add(pivot);
    return { pivot, hand };
  };
  const right = arm(-1), left = arm(1);   // rider faces +Z, so their right side is -X
  return { group, rightArm: right.pivot, leftArm: left.pivot, rightHand: right.hand, leftHand: left.hand, head };
}

// Convenience: full bike + rider combo
export function buildRacer(bikeDef, paint, avatar) {
  const bike = buildBike(bikeDef, paint);
  const rider = buildRider(avatar, bike.anchors);
  bike.root.add(rider.group);
  return { ...bike, rider };
}

// Dispose a model's geometries and its non-shared materials
export function disposeObject(obj) {
  const shared = new Set(matCache.values());
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !shared.has(o.material)) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
