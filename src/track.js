// Track generation (seeded closed loop) and 3D world construction.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- seeded random + noise ----------
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x, z) => vals[perm[(x & 255) + perm[z & 255]]];
  const sm = (t) => t * t * (3 - 2 * t);
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = sm(xf), w = sm(zf);
    const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
    return (a + (b - a) * u) * (1 - w) + (c + (d - c) * u) * w;
  }
  function fbm(x, z, oct = 4) {
    let amp = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { sum += amp * noise(x * f, z * f); f *= 2.03; amp *= 0.5; }
    return sum;
  }
  return { noise, fbm };
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- track ----------
export class Track {
  constructor(cfg) {
    this.cfg = cfg;
    this.width = cfg.width;
    let ok = false;
    if (cfg.layout) {
      // real circuit outline: grow the scale until corners and gaps are raceable
      let scale = 1;
      for (let attempt = 0; attempt < 10 && !ok; attempt++, scale *= 1.12) {
        ok = this._build(this._layoutPoints(scale));
        this.layoutScale = scale;
      }
      if (!ok) this._build(this._layoutPoints(scale), true);
      this.forced = !ok;
      return;
    }
    let wobble = cfg.wobble;
    for (let attempt = 0; attempt < 14 && !ok; attempt++) {
      ok = this._generate(cfg.seed + attempt * 101, wobble);
      if (!ok && attempt % 3 === 2) wobble *= 0.85;
    }
  }

  // Control points from a circuit outline (0-100 grid) scaled to the target lap length
  _layoutPoints(scale) {
    const cfg = this.cfg;
    const path = cfg.layout;
    let per = 0;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length];
      per += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const k = (cfg.targetLength / per) * scale;
    const r = rng(cfg.seed);
    const p1 = r() * 6.28, p2 = r() * 6.28;
    // extra points along long segments keep straights straight and corners crisp
    const dense = [];
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length];
      dense.push(a);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > 20) for (const f of [0.3, 0.7]) dense.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return dense.map(([x, y], i) => {
      const t = i / dense.length;
      const h = cfg.hills * (0.65 * Math.sin(t * Math.PI * 2 + p1) + 0.35 * Math.sin(t * Math.PI * 4 + p2));
      return new THREE.Vector3((x - 50) * k, h, (y - 50) * k);
    });
  }

  _generate(seed, wobble) {
    const cfg = this.cfg;
    const r = rng(seed);
    const n = cfg.controlPoints;
    const R = cfg.trackRadius;
    const pts = [];
    const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const ang = t * Math.PI * 2 + (r() - 0.5) * (Math.PI * 2 / n) * 0.5;
      const rad = R * (1 + (r() * 2 - 1) * wobble);
      const y = cfg.hills * (0.6 * Math.sin(t * Math.PI * 4 + p1) + 0.3 * Math.sin(t * Math.PI * 6 + p2) + 0.1 * Math.sin(t * Math.PI * 2 + p3));
      pts.push(new THREE.Vector3(Math.cos(ang) * rad * 1.35, y, Math.sin(ang) * rad));
    }
    return this._build(pts);
  }

  _build(pts, force = false) {
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    const length = curve.getLength();
    const N = Math.ceil(length / 2);
    const step = length / N;
    const pos = [], tan = [], right = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      pos.push(curve.getPointAt(u));
      const t = curve.getTangentAt(u);
      tan.push(t);
      right.push(new THREE.Vector3(-t.z, 0, t.x).normalize());
    }
    // signed curvature (positive = left turn), smoothed
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = tan[(i - 2 + N) % N], b = tan[(i + 2) % N];
      const cross = a.z * b.x - a.x * b.z;
      const ang = Math.asin(Math.max(-1, Math.min(1, cross / (Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z) + 1e-6))));
      raw[i] = ang / (step * 4);
    }
    const curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -4; k <= 4; k++) s += raw[(i + k + N) % N];
      curv[i] = s / 9;
    }
    // validate: no corner tighter than ~24 m radius, no self-overlap
    let maxK = 0;
    for (let i = 0; i < N; i++) maxK = Math.max(maxK, Math.abs(curv[i]));
    // tightest allowed corner: 18 m radius (keeps roadside barriers from folding over)
    if (maxK > 1 / 18 && !force) { this.fail = 'corner'; return false; }
    const minGap = this.width + 20;
    for (let i = 0; i < N; i += 3) {
      for (let j = i + 3; j < N; j += 3) {
        const along = Math.min(j - i, N - (j - i)) * step;
        if (along < minGap * 2.2) continue;
        const dx = pos[i].x - pos[j].x, dz = pos[i].z - pos[j].z;
        if (dx * dx + dz * dz < minGap * minGap && !force) { this.fail = `gap@${i}`; return false; }
      }
    }
    Object.assign(this, { curve, length, N, step, pos, tan, right, curv });
    return true;
  }

  // Interpolated frame at distance s (wraps)
  frame(s, out = {}) {
    const L = this.length;
    let u = ((s % L) + L) % L / this.step;
    const i = Math.floor(u) % this.N;
    const j = (i + 1) % this.N;
    const f = u - Math.floor(u);
    out.pos = (out.pos || new THREE.Vector3()).lerpVectors(this.pos[i], this.pos[j], f);
    out.tan = (out.tan || new THREE.Vector3()).lerpVectors(this.tan[i], this.tan[j], f).normalize();
    out.right = (out.right || new THREE.Vector3()).lerpVectors(this.right[i], this.right[j], f).normalize();
    out.curv = this.curv[i] * (1 - f) + this.curv[j] * f;
    return out;
  }

  curvatureAt(s) {
    const L = this.length;
    const i = Math.floor((((s % L) + L) % L) / this.step) % this.N;
    return this.curv[i];
  }

  worldPos(s, d, out = new THREE.Vector3()) {
    const f = this.frame(s, _tmpFrame);
    return out.copy(f.pos).addScaledVector(f.right, d);
  }
}
const _tmpFrame = {};

// ---------- canvas textures ----------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(ctx, w, h, n, colors, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 0.5, size * Math.random() + 0.5);
  }
  ctx.globalAlpha = 1;
}

function roadTexture(night) {
  return canvasTex(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = night ? '#2c2d33' : '#3b3c41';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 26000, ['#55565c', '#2a2b2f', '#626369', '#1f2023'], 2.2);
    // subtle tyre wear bands
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (const x of [0.28, 0.36, 0.64, 0.72]) ctx.fillRect(w * x - 12, 0, 24, h);
    // edge lines
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(w * 0.035, 0, w * 0.022, h);
    ctx.fillRect(w * 0.943, 0, w * 0.022, h);
    // centre dashes
    ctx.fillStyle = '#f5d000';
    ctx.fillRect(w * 0.49, 0, w * 0.02, h * 0.45);
    ctx.fillRect(w * 0.49, h * 0.5, w * 0.02, h * 0.45);
  });
}

function curbTexture() {
  return canvasTex(64, 256, (ctx, w, h) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f4f4f4' : '#d61f26';
      ctx.fillRect(0, (i * h) / 4, w, h / 4);
    }
  });
}

function groundDetailTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#bdbdbd';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 9000, ['#ffffff', '#8a8a8a', '#d8d8d8', '#a0a0a0'], 3);
  });
}

function barrierTexture(night) {
  return canvasTex(256, 64, (ctx, w, h) => {
    if (night) {
      ctx.fillStyle = '#10121a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(0, h * 0.1, w, h * 0.12);
      ctx.fillStyle = '#ff2bd6'; ctx.fillRect(0, h * 0.78, w, h * 0.12);
    } else {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#f2f2f2' : '#d61f26';
        ctx.fillRect((i * w) / 8, 0, w / 8, h);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, h * 0.45, w, h * 0.1);
    }
  });
}

function checkerTexture(cols = 16, rows = 4) {
  return canvasTex(cols * 16, rows * 16, (ctx, w, h) => {
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }, false);
}

function bannerTexture(text, bg, fg) {
  return canvasTex(1024, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = -h; i < w; i += 60) { ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + 30, h); ctx.lineTo(i + 30 + h, 0); ctx.lineTo(i + h, 0); ctx.fill(); }
    ctx.fillStyle = fg;
    ctx.font = 'italic 900 118px Orbitron, Arial Black, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 6);
  }, false);
}

function boostTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#04202a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2ff3ff'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const y of [70, 150, 230]) {
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w / 2, y - 70); ctx.lineTo(w - 40, y); ctx.stroke();
    }
  }, false);
}

function crowdTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a2d36'; ctx.fillRect(0, 0, w, h);
    const cols = ['#e63946', '#f1faee', '#a8dadc', '#ffb703', '#457b9d', '#2a9d8f', '#e76f51', '#8338ec', '#ffffff'];
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 46; i++) {
        const x = i * 11.2 + (row % 2) * 5 + Math.random() * 3;
        const y = row * 32 + 8;
        ctx.fillStyle = cols[(Math.random() * cols.length) | 0];
        ctx.fillRect(x, y + 8, 8, 14);
        ctx.fillStyle = ['#f1c27d', '#8d5524', '#e0ac69', '#ffdbac'][(Math.random() * 4) | 0];
        ctx.beginPath(); ctx.arc(x + 4, y + 4, 4, 0, 7); ctx.fill();
      }
    }
  }, false);
}

function windowsTexture() {
  return canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0a0c14'; ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) {
      if (Math.random() < 0.45) {
        ctx.fillStyle = ['#ffd27a', '#9fd8ff', '#ffe9b0', '#ff9fd8'][(Math.random() * 4) | 0];
        ctx.fillRect(x, y, 8, 9);
      }
    }
  });
}

// ---------- geometry helpers ----------
// Ribbon following the track. edge(i) returns [dA, yA, dB, yB] offsets for the two edges.
function ribbon(track, edgeA, edgeB, tileLen, opts = {}) {
  const N = track.N;
  const segs = N + 1;
  const positions = new Float32Array(segs * 2 * 3);
  const uvs = new Float32Array(segs * 2 * 2);
  const L = track.length;
  const tiles = Math.max(1, Math.round(L / tileLen));
  for (let k = 0; k < segs; k++) {
    const i = k % N;
    const p = track.pos[i], r = track.right[i];
    const v = (k / N) * tiles;
    const [dA, yA] = edgeA, [dB, yB] = edgeB;
    positions.set([p.x + r.x * dA, p.y + yA, p.z + r.z * dA, p.x + r.x * dB, p.y + yB, p.z + r.z * dB], k * 6);
    uvs.set(opts.swapUV ? [v, 0, v, 1] : [0, v, 1, v], k * 4);
  }
  const idx = [];
  for (let k = 0; k < N; k++) {
    const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- world ----------
export function buildWorld(scene, track, cfg, theme, quality, layout) {
  const night = theme.night;
  const high = quality === 'high';
  const disposables = [];
  const world = new THREE.Group();
  scene.add(world);
  const noise = makeNoise(cfg.seed);
  const W = track.width;

  // --- fog & sky ---
  scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
  scene.background = new THREE.Color(theme.skyHorizon);
  const sunDir = new THREE.Vector3(...theme.sunDir).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      sunColor: { value: new THREE.Color(theme.sun) },
      sunDir: { value: sunDir },
      sunSize: { value: night ? 900.0 : 380.0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunSize; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        if (d.y < 0.0) col = horizon * 0.92;
        float sd = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(sd, sunSize) * 3.0 + pow(sd, 12.0) * 0.22 + pow(sd, 3.0) * 0.06);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  world.add(sky);

  if (night) {
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 1500; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
      sp.push(Math.cos(th) * Math.sin(ph) * 4500, Math.cos(ph) * 4500, Math.sin(th) * Math.sin(ph) * 4500);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
    world.add(stars);
  }

  // --- lights ---
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
  world.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.position.copy(sunDir).multiplyScalar(150);
  sun.castShadow = true;
  const sm = high ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  world.add(sun);
  world.add(sun.target);

  // --- ground info (distance to track + track height) ---
  const coarse = [];
  for (let i = 0; i < track.N; i += 3) coarse.push(track.pos[i]);
  const cx = new Float32Array(coarse.map((p) => p.x));
  const cz = new Float32Array(coarse.map((p) => p.z));
  const cy = new Float32Array(coarse.map((p) => p.y));
  function nearest(x, z) {
    let best = Infinity, bi = 0;
    for (let i = 0; i < cx.length; i++) {
      const dx = cx[i] - x, dz = cz[i] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bi = i; }
    }
    return { dist: Math.sqrt(best), h: cy[bi] };
  }
  const flatR = W / 2 + 14;
  function groundHeight(x, z, info = nearest(x, z)) {
    const base = info.h - 0.35;
    const hills = (noise.fbm(x * 0.006, z * 0.006, 4) - 0.45) * 40;
    const mountains = Math.pow(noise.fbm(x * 0.0022 + 50, z * 0.0022 + 50, 5), 1.6) * 420;
    const t1 = smoothstep(flatR, flatR + 70, info.dist);
    const t2 = smoothstep(flatR + 220, flatR + 650, info.dist);
    return base + hills * t1 + mountains * t2 + (info.dist > 900 ? (info.dist - 900) * 0.25 : 0) * t2;
  }

  // --- terrain ---
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.pos) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const size = Math.max(maxX - minX, maxZ - minZ) + 2600;
  const segs = high ? 230 : 150;
  const tGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate(centre.x, 0, centre.z);
  const tp = tGeo.attributes.position;
  const colors = new Float32Array(tp.count * 3);
  const gc = theme.ground.map((c) => new THREE.Color(c));
  const fc = theme.far.map((c) => new THREE.Color(c));
  const snowC = new THREE.Color('#f4f7fb');
  const rockC = new THREE.Color(theme.props === 'desert' ? '#9a5a33' : '#6f6a64');
  const col = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const info = nearest(x, z);
    const y = groundHeight(x, z, info);
    tp.setY(i, y);
    const n1 = noise.noise(x * 0.03, z * 0.03);
    const n2 = noise.noise(x * 0.004 + 9, z * 0.004 + 9);
    col.copy(gc[0]).lerp(gc[1], n1).lerp(gc[2], n2 * 0.7);
    const far = smoothstep(150, 700, info.dist);
    col.lerp(fc[0].clone().lerp(fc[1], n1), far);
    const rel = y - info.h;
    if (rel > 60 && theme.props !== 'city') col.lerp(rockC, smoothstep(60, 140, rel) * 0.8);
    const snowLine = theme.snowLine ?? 190;
    if (rel > snowLine && !['desert', 'city', 'tropical'].includes(theme.props)) col.lerp(snowC, smoothstep(snowLine, snowLine + 70, rel));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tGeo.computeVertexNormals();
  const detail = groundDetailTexture();
  detail.repeat.set(size / 14, size / 14);
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1, metalness: 0 }));
  terrain.receiveShadow = true;
  world.add(terrain);

  // --- road ---
  const roadTex = roadTexture(night);
  const road = new THREE.Mesh(ribbon(track, [-W / 2, 0.02], [W / 2, 0.02], 24),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82, metalness: 0.05 }));
  road.receiveShadow = true;
  world.add(road);
  // curbs
  const curbTex = curbTexture();
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const a = s * (W / 2), b = s * (W / 2 + 1.3);
    const g = s < 0 ? ribbon(track, [b, 0.07], [a, 0.04], 4) : ribbon(track, [a, 0.04], [b, 0.07], 4);
    const m = new THREE.Mesh(g, curbMat);
    m.receiveShadow = true;
    world.add(m);
  }
  // shoulders: gravel strips sloping down into terrain
  const shoulderColor = { meadow: '#7c7464', desert: '#c2955a', alpine: '#7a7468', tropical: '#8a7a5c', sunset: '#7a6a55', night: '#2a2c33' }[cfg.theme];
  const shoulderMat = new THREE.MeshStandardMaterial({ color: shoulderColor, map: detail, roughness: 1 });
  for (const s of [-1, 1]) {
    const a = s * (W / 2 + 1.3), b = s * (W / 2 + 7);
    const g = s < 0 ? ribbon(track, [b, -0.25], [a, 0.065], 6) : ribbon(track, [a, 0.065], [b, -0.25], 6);
    const m = new THREE.Mesh(g, shoulderMat);
    m.receiveShadow = true;
    world.add(m);
  }
  // barriers (armco)
  const barTex = barrierTexture(night);
  const barMat = new THREE.MeshStandardMaterial({
    map: barTex, roughness: 0.5, metalness: night ? 0 : 0.3, side: THREE.DoubleSide,
    emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? barTex : null, emissiveIntensity: night ? 1.2 : 0,
  });
  const barrierD = W / 2 + 7.2;
  for (const s of [-1, 1]) {
    const g = ribbon(track, [s * barrierD, 1.0], [s * barrierD, 0.1], 8, { swapUV: true });
    world.add(new THREE.Mesh(g, barMat));
  }
  // barrier posts (instanced)
  {
    const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 0.6, roughness: 0.4 });
    const every = 4;
    const count = Math.floor(track.N / every) * 2;
    const posts = new THREE.InstancedMesh(postGeo, postMat, count);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < track.N; i += every) {
      for (const s of [-1, 1]) {
        if (k >= count) break;
        const p = track.pos[i], r = track.right[i];
        m4.makeTranslation(p.x + r.x * s * (barrierD + 0.1), p.y + 0.45, p.z + r.z * s * (barrierD + 0.1));
        posts.setMatrixAt(k++, m4);
      }
    }
    posts.count = k;
    world.add(posts);
  }

  // --- start / finish ---
  const f0 = track.frame(0);
  const startGroup = new THREE.Group();
  startGroup.position.copy(f0.pos);
  startGroup.lookAt(f0.pos.clone().add(f0.tan));
  world.add(startGroup);
  const checker = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.4), new THREE.MeshStandardMaterial({ map: checkerTexture(16, 4), roughness: 0.7 }));
  checker.rotation.x = -Math.PI / 2;
  checker.position.y = 0.035;
  checker.receiveShadow = true;
  startGroup.add(checker);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.7, roughness: 0.35 });
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), pillarMat);
    pillar.position.set(s * (W / 2 + 2.2), 4.5, 0);
    pillar.castShadow = true;
    startGroup.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 5.4, 2.2, 0.8), [
    pillarMat, pillarMat, pillarMat, pillarMat,
    new THREE.MeshStandardMaterial({ map: bannerTexture('FINISH', ['#111111', '#333333'], '#ffd60a') }),
    new THREE.MeshStandardMaterial({ map: bannerTexture('MOTOBLAZE 3D', ['#d00000', '#ff7b00'], '#ffffff') }),
  ]);
  beam.position.y = 9;
  beam.castShadow = true;
  startGroup.add(beam);
  // start lights on the gantry
  const lightMats = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 0 });
    lightMats.push(m);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), m);
    bulb.position.set((i - 2) * 1.1, 7.6, -0.45);
    startGroup.add(bulb);
  }

  // grandstand next to the start straight
  {
    const crowd = crowdTexture();
    const stand = new THREE.Group();
    const steps = 6;
    const standMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8 });
    const crowdMat = new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 });
    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 2), standMat);
      step.position.set(0, i * 1 + 0.5, i * 2);
      step.receiveShadow = true; step.castShadow = high;
      stand.add(step);
    }
    const people = new THREE.Mesh(new THREE.PlaneGeometry(60, 13), crowdMat);
    people.position.set(0, 3.8, 5);
    people.rotation.set(-1.107, Math.PI, 0, 'YXZ');
    stand.add(people);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(62, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    roof.position.set(0, steps + 5, steps);
    roof.castShadow = true;
    stand.add(roof);
    for (const x of [-30, 0, 30]) {
      const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, steps + 5), pillarMat);
      col2.position.set(x, (steps + 5) / 2, steps * 2 + 0.5);
      stand.add(col2);
    }
    const fs = track.frame(-25);
    const side = 1;
    stand.position.copy(fs.pos).addScaledVector(fs.right, side * (barrierD + 6));
    stand.position.y -= 0.3;
    stand.lookAt(stand.position.clone().addScaledVector(fs.right, side));
    world.add(stand);
  }

  // sponsor billboards
  {
    const boards = [
      ['NITRO', ['#00b4d8', '#0077b6'], '#ffffff'], ['MOTOBLAZE', ['#d00000', '#ff7b00'], '#ffffff'],
      ['TURBO OIL', ['#111111', '#444444'], '#ffd60a'], ['SPEED X', ['#7b2cbf', '#c77dff'], '#ffffff'],
      ['APEX TYRES', ['#2b9348', '#80b918'], '#ffffff'], ['RACE 24', ['#ffd60a', '#ffc300'], '#111111'],
    ];
    const r = rng(cfg.seed + 5);
    const boardGeo = new THREE.BoxGeometry(14, 3.2, 0.3);
    for (let i = 0; i < 10; i++) {
      const s = (i + 0.5) / 10 * track.length + r() * 30;
      const f = track.frame(s);
      const side = r() < 0.5 ? -1 : 1;
      const b = boards[i % boards.length];
      const tex = bannerTexture(b[0], b[1], b[2]);
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: night ? 0xffffff : 0, emissiveMap: night ? tex : null, emissiveIntensity: night ? 0.5 : 0 });
      const back = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const board = new THREE.Mesh(boardGeo, [back, back, back, back, face, back]);
      const holder = new THREE.Group();
      holder.position.copy(f.pos).addScaledVector(f.right, side * (barrierD + 3));
      holder.lookAt(holder.position.clone().addScaledVector(f.right, -side).addScaledVector(f.tan, -0.5));
      board.position.y = 3.6;
      board.castShadow = true;
      holder.add(board);
      for (const x of [-5, 5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), pillarMat);
        leg.position.set(x, 1.6, -0.2);
        holder.add(leg);
      }
      world.add(holder);
    }
  }

  // --- boost pads & obstacles from race layout ---
  const boostTex = boostTexture();
  const boostMat = new THREE.MeshStandardMaterial({ map: boostTex, emissive: 0xffffff, emissiveMap: boostTex, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 });
  const padMeshes = [];
  for (const pad of layout.pads) {
    const f = track.frame(pad.s);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), boostMat);
    m.position.copy(f.pos).addScaledVector(f.right, pad.d);
    m.position.y += 0.05;
    m.lookAt(m.position.clone().add(f.tan));
    m.rotateX(-Math.PI / 2);
    m.rotateZ(Math.PI);
    world.add(m);
    padMeshes.push(m);
  }
  const coneGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.05, 0.3, 0.75, 14).translate(0, 0.4, 0),
    new THREE.BoxGeometry(0.7, 0.06, 0.7).translate(0, 0.03, 0),
  ]);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5, emissive: night ? 0x441800 : 0 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const oilMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.92 });
  for (const ob of layout.obstacles) {
    const f = track.frame(ob.s);
    const p = f.pos.clone().addScaledVector(f.right, ob.d);
    if (ob.type === 'cone') {
      for (const off of [-0.9, 0, 0.9]) {
        const c = new THREE.Mesh(coneGeo, coneMat);
        c.position.copy(p).addScaledVector(f.right, off);
        c.castShadow = true;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 14), stripeMat);
        st.position.y = 0.45;
        c.add(st);
        world.add(c);
      }
    } else {
      const oil = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), oilMat);
      oil.position.copy(p); oil.position.y += 0.045;
      oil.rotation.x = -Math.PI / 2;
      oil.scale.set(1.3, 0.85, 1);
      oil.rotation.z = Math.random() * 3;
      world.add(oil);
    }
  }

  // --- scenery props ---
  addProps(world, theme, cfg, track, nearest, groundHeight, high, barrierD);

  // clouds (day only)
  if (!night) {
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92, fog: false, emissive: 0x666666 });
    const r = rng(cfg.seed + 77);
    for (let i = 0; i < 16; i++) {
      const cl = new THREE.Group();
      for (let j = 0; j < 6; j++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(30 + r() * 30, 1), cloudMat);
        puff.position.set((r() - 0.5) * 140, (r() - 0.5) * 18, (r() - 0.5) * 60);
        puff.scale.y = 0.55;
        cl.add(puff);
      }
      const a = r() * Math.PI * 2, d = 900 + r() * 1400;
      cl.position.set(centre.x + Math.cos(a) * d, 380 + r() * 260, centre.z + Math.sin(a) * d);
      world.add(cl);
    }
  }

  return {
    group: world, sun, sky, lightMats, padMeshes, centre, groundHeight,
    dispose() {
      world.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
        }
      });
      scene.remove(world);
      for (const d of disposables) d.dispose?.();
    },
  };
}

// ---------- scenery ----------
function addProps(world, theme, cfg, track, nearest, groundHeight, high, barrierD) {
  const r = rng(cfg.seed + 999);
  const kind = theme.props;
  const night = theme.night;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.pos) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = 320;

  function place(count, minD, maxD) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 12) {
      tries++;
      const x = minX - pad + r() * (maxX - minX + pad * 2);
      const z = minZ - pad + r() * (maxZ - minZ + pad * 2);
      const info = nearest(x, z);
      if (info.dist < minD || info.dist > maxD) continue;
      out.push({ x, z, y: groundHeight(x, z, info), dist: info.dist });
    }
    return out;
  }

  function instanced(geo, material, items, scaleFn, colorFn, cast = true) {
    const im = new THREE.InstancedMesh(geo, material, items.length);
    items.forEach((it, i) => {
      const s = scaleFn(it, i);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot ?? r() * Math.PI * 2);
      sc.set(s.x ?? s, s.y ?? s, s.z ?? s);
      pos.set(it.x, it.y, it.z);
      m4.compose(pos, q, sc);
      im.setMatrixAt(i, m4);
      if (colorFn) im.setColorAt(i, colorFn(it, i));
    });
    im.castShadow = cast && high;
    im.receiveShadow = false;
    world.add(im);
    return im;
  }

  const density = high ? 1 : 0.55;
  const minD = barrierD + 4;

  if (kind === 'trees' || kind === 'autumn' || kind === 'pines') {
    const broadCount = kind === 'pines' ? 0 : Math.round(520 * density);
    const pineCount = Math.round((kind === 'pines' ? 760 : 300) * density);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d25, roughness: 1 });
    if (broadCount) {
      const items = place(broadCount, minD, 520);
      const trunk = new THREE.CylinderGeometry(0.25, 0.4, 4, 6).translate(0, 2, 0);
      const crown = mergeGeometries([
        new THREE.IcosahedronGeometry(2.8, 1).translate(0, 5.6, 0),
        new THREE.IcosahedronGeometry(2.0, 1).translate(1.3, 4.6, 0.6),
        new THREE.IcosahedronGeometry(2.1, 1).translate(-1.2, 4.9, -0.5),
      ]);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
      const palette = kind === 'autumn'
        ? ['#d94f1e', '#f08a24', '#e9b222', '#b8321e', '#8a9a2a']
        : ['#3f7d2a', '#4c8f32', '#2f6b22', '#5a9a3a', '#6a8f2a'];
      const scales = items.map(() => 0.8 + r() * 0.9);
      instanced(trunk, trunkMat, items, (it, i) => scales[i]);
      instanced(crown, crownMat, items, (it, i) => scales[i], () => col.set(palette[(r() * palette.length) | 0]).offsetHSL(0, 0, (r() - 0.5) * 0.08).clone());
    }
    if (pineCount) {
      const items = place(pineCount, minD, 560);
      const trunk = new THREE.CylinderGeometry(0.2, 0.35, 2, 6).translate(0, 1, 0);
      const crown = mergeGeometries([
        new THREE.ConeGeometry(2.6, 4.5, 8).translate(0, 3.5, 0),
        new THREE.ConeGeometry(2.0, 3.8, 8).translate(0, 5.6, 0),
        new THREE.ConeGeometry(1.3, 3.0, 8).translate(0, 7.6, 0),
      ]);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
      const scales = items.map(() => 0.8 + r() * 1.0);
      instanced(trunk, trunkMat, items, (it, i) => scales[i]);
      instanced(crown, crownMat, items, (it, i) => scales[i], () => col.set(kind === 'autumn' ? '#2f5a2a' : '#1f4a2c').offsetHSL(0, 0, (r() - 0.5) * 0.06).clone());
      if (theme.snowyTrees) {
        const snowCap = mergeGeometries([
          new THREE.ConeGeometry(1.45, 1.4, 8).translate(0, 8.6, 0),
          new THREE.ConeGeometry(2.1, 1.1, 8).translate(0, 6.6, 0),
        ]);
        instanced(snowCap, new THREE.MeshStandardMaterial({ color: 0xf6f9ff, roughness: 0.8, flatShading: true }), items, (it, i) => scales[i] * 1.02);
      }
    }
    if (kind !== 'pines') {
      // flowers / bushes near the track
      const items = place(Math.round(500 * density), minD - 2, 120);
      const bush = new THREE.IcosahedronGeometry(0.9, 0).translate(0, 0.4, 0);
      instanced(bush, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), items,
        () => 0.6 + r() * 0.9, () => col.set(kind === 'autumn' ? ['#a8461e', '#7a7a22', '#c9781e'][(r() * 3) | 0] : ['#3d7a26', '#5a9a32', '#2f6b1f'][(r() * 3) | 0]).clone(), false);
    }
  }

  if (kind === 'desert') {
    const items = place(Math.round(380 * density), minD, 520);
    const cMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const cactus = mergeGeometries([
      new THREE.CapsuleGeometry(0.45, 4, 4, 8).translate(0, 2.4, 0),
      new THREE.CapsuleGeometry(0.3, 1.4, 4, 8).rotateZ(Math.PI / 2).translate(0.8, 2.2, 0),
      new THREE.CapsuleGeometry(0.3, 1.6, 4, 8).translate(1.45, 3.0, 0),
      new THREE.CapsuleGeometry(0.28, 1.0, 4, 8).rotateZ(Math.PI / 2).translate(-0.7, 2.9, 0),
      new THREE.CapsuleGeometry(0.28, 1.2, 4, 8).translate(-1.2, 3.5, 0),
    ]);
    instanced(cactus, cMat, items, () => 0.7 + r() * 0.8, () => col.set('#3f7a3a').offsetHSL(0, 0, (r() - 0.5) * 0.1).clone());
    // mesas / big rocks
    const rocks = place(Math.round(90 * density), minD + 30, 700);
    const rockGeo = new THREE.CylinderGeometry(1, 1.25, 1, 7, 1);
    instanced(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), rocks,
      (it) => { const s = 10 + r() * 30; return { x: s, y: s * (0.5 + r() * 1.2), z: s * (0.7 + r() * 0.6) }; },
      () => col.set(['#a4522c', '#b8683a', '#8f4526'][(r() * 3) | 0]).clone());
    const tumble = place(Math.round(260 * density), minD - 2, 200);
    instanced(new THREE.IcosahedronGeometry(0.7, 0).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1, flatShading: true }), tumble, () => 0.5 + r());
  }

  if (kind === 'tropical' || kind === 'desert') {
    // palm trees: curved trunk + drooping fronds
    const items = place(Math.round((kind === 'tropical' ? 420 : 110) * density), minD, kind === 'tropical' ? 480 : 300);
    const segs = [];
    let x = 0, y = 0;
    for (let i = 0; i < 6; i++) {
      const g = new THREE.CylinderGeometry(0.22 - i * 0.015, 0.28 - i * 0.015, 1.5, 7);
      g.rotateZ(-0.06 - i * 0.03);
      g.translate(x, y + 0.75, 0);
      segs.push(g);
      x += 0.06 + i * 0.05; y += 1.45;
    }
    const trunk = mergeGeometries(segs);
    const fronds = [];
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.BoxGeometry(0.7, 0.06, 3.4);
      leaf.translate(0, 0, 1.7);
      leaf.rotateX(0.35 + (i % 2) * 0.25);
      leaf.rotateY((i / 8) * Math.PI * 2);
      leaf.translate(x, y, 0);
      fronds.push(leaf);
    }
    const crown = mergeGeometries(fronds);
    const scales = items.map(() => 0.8 + r() * 0.6);
    instanced(trunk, new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }), items, (it, i) => scales[i]);
    instanced(crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), items, (it, i) => scales[i],
      () => col.set(['#2f8a2f', '#3f9a32', '#4a8a28'][(r() * 3) | 0]).clone());
    if (kind === 'tropical') {
      const bushes = place(Math.round(520 * density), minD - 2, 140);
      instanced(new THREE.IcosahedronGeometry(1.0, 0).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), bushes,
        () => 0.6 + r(), () => col.set(['#2f8a2f', '#4fa83a', '#e0457b', '#2a7a2a'][(r() * 4) | 0]).clone(), false);
    }
  }

  if (kind === 'city') {
    // skyscrapers around the circuit
    const items = place(Math.round(240 * density), minD + 25, 650);
    const win = windowsTexture();
    win.repeat.set(2, 3);
    const bMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 1.1, roughness: 0.6 });
    const bGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    instanced(bGeo, bMat, items, (it) => {
      const h = 25 + r() * 90 * Math.min(1, it.dist / 200);
      return { x: 14 + r() * 18, y: h, z: 14 + r() * 18 };
    }, () => col.setHSL(0.6 + r() * 0.1, 0.2, 0.25 + r() * 0.2).clone(), false);
    // neon tops
    const tops = items.slice(0, 60);
    instanced(new THREE.BoxGeometry(1, 0.6, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), tops.map((t) => ({ ...t, y: t.y + 2 })),
      () => 8, () => col.set(['#00e5ff', '#ff2bd6', '#ffd60a'][(r() * 3) | 0]).clone(), false);
  }

  // street lamps for night levels / poles otherwise
  if (night) {
    const every = 30; // samples (60 m)
    const items = [];
    for (let i = 0; i < track.N; i += every) {
      const s = (i / every) % 2 ? -1 : 1;
      const p = track.pos[i], rt = track.right[i];
      items.push({ x: p.x + rt.x * s * (barrierD + 1.2), y: p.y, z: p.z + rt.z * s * (barrierD + 1.2), rot: Math.atan2(rt.x * -s, rt.z * -s) });
    }
    const pole = mergeGeometries([
      new THREE.CylinderGeometry(0.12, 0.18, 9, 8).translate(0, 4.5, 0),
      new THREE.BoxGeometry(0.12, 0.12, 3).translate(0, 9, 1.4),
    ]);
    instanced(pole, new THREE.MeshStandardMaterial({ color: 0x30333a, metalness: 0.6, roughness: 0.4 }), items, () => 1, null, false);
    instanced(new THREE.BoxGeometry(0.6, 0.15, 1.1).translate(0, 8.9, 2.7), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), items, () => 1, null, false);
    // light pools on the road
    const poolTex = canvasTex(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }, false);
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const poolItems = items.map((it, k) => {
      const i = k * every; const s = k % 2 ? -1 : 1;
      const p = track.pos[i], rt = track.right[i];
      return { x: p.x + rt.x * s * (barrierD - 5), y: p.y + 0.06, z: p.z + rt.z * s * (barrierD - 5) };
    });
    const pool = instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, poolItems, () => 22, null, false);
    pool.renderOrder = 1;
  }

  // scattered rocks everywhere
  const rocks = place(Math.round(160 * density), minD, 400);
  instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), rocks,
    () => 0.4 + r() * 1.6, () => col.set(theme.props === 'desert' ? '#9a6a44' : theme.props === 'pines' ? '#8a96a3' : '#7d7770').clone());
}
