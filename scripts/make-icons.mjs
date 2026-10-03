// Generates the app icons (PWA, Electron, Android) as PNGs with no external dependencies.
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// colour of the design at normalised coords (u,v in 0..1); returns [r,g,b,a]
function sample(u, v, { rounded, scale }) {
  // background
  if (rounded) {
    const r = 0.2, dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
    if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
  }
  const d = Math.hypot(u - 0.5, v - 0.42);
  let c = mix(hex('#1d2b64'), hex('#070a18'), Math.min(1, d * 1.6));
  // content transform (shrinks the artwork for maskable icons)
  const x = (u - 0.5) / scale + 0.5, y = (v - 0.5) / scale + 0.5;
  // orange glow disc
  const g = Math.hypot(x - 0.5, y - 0.5);
  if (g < 0.4) c = mix(c, hex('#ff5a1f'), Math.max(0, 0.35 - g * 0.8));
  // speed lines
  for (const [ly, lx0, lx1] of [[0.4, 0.05, 0.24], [0.5, 0.02, 0.2], [0.6, 0.07, 0.18]]) {
    if (Math.abs(y - ly) < 0.018 && x > lx0 && x < lx1) c = mix(hex('#ffb347'), hex('#ff3b1f'), (x - lx0) / (lx1 - lx0));
  }
  // body
  const body = [[0.3, 0.64], [0.4, 0.47], [0.52, 0.41], [0.68, 0.4], [0.82, 0.5], [0.72, 0.64], [0.62, 0.56], [0.43, 0.6]];
  if (inPoly(x, y, body)) c = mix(hex('#ffb347'), hex('#ff2e4d'), Math.min(1, Math.max(0, (x - 0.3) / 0.5)));
  // rider (helmet + back)
  const rider = [[0.46, 0.45], [0.52, 0.32], [0.62, 0.3], [0.6, 0.4]];
  if (inPoly(x, y, rider)) c = hex('#f2f5ff');
  if (Math.hypot(x - 0.64, y - 0.27) < 0.065) c = hex('#2ff3ff');
  if (Math.hypot(x - 0.67, y - 0.27) < 0.035 && x > 0.66) c = hex('#0b1020');
  // wheels
  for (const [wx, wy] of [[0.3, 0.66], [0.75, 0.66]]) {
    const r = Math.hypot(x - wx, y - wy);
    if (Math.abs(r - 0.125) < 0.035) c = hex('#f2f5ff');
    else if (r < 0.03) c = hex('#ff6a00');
  }
  return [...c, 255];
}

function render(size, opts) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const s = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, opts);
        r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
      }
      const i = (py * size + px) * 4;
      if (a > 0) { buf[i] = r / a; buf[i + 1] = g / a; buf[i + 2] = b / a; }
      buf[i + 3] = a / (ss * ss);
    }
  }
  return png(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('build', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, { rounded: true, scale: 1 }));
writeFileSync('public/icons/icon-512.png', render(512, { rounded: true, scale: 1 }));
writeFileSync('public/icons/maskable-512.png', render(512, { rounded: false, scale: 0.78 }));
writeFileSync('build/icon.png', render(512, { rounded: true, scale: 1 }));
writeFileSync('build/icon-foreground.png', render(1024, { rounded: false, scale: 0.62 }));

// Android launcher icons + splash screens (only if the Capacitor project exists)
const RES = 'android/app/src/main/res';
if (existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = `${RES}/mipmap-${d}`;
    writeFileSync(`${dir}/ic_launcher.png`, render(Math.round(48 * k), { rounded: true, scale: 1 }));
    writeFileSync(`${dir}/ic_launcher_round.png`, render(Math.round(48 * k), { rounded: true, scale: 1 }));
    writeFileSync(`${dir}/ic_launcher_foreground.png`, render(Math.round(108 * k), { rounded: false, scale: 0.6 }));
  }
  // replace Capacitor's default splash images with a branded one of the same size
  for (const dir of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
    const f = `${RES}/${dir}/splash.png`;
    if (!existsSync(f)) continue;
    const head = readFileSync(f);
    const w = head.readUInt32BE(16), h = head.readUInt32BE(20);
    writeFileSync(f, splash(w, h));
  }
  console.log('Android icons and splash screens written.');
}

function splash(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const S = Math.round(Math.min(w, h) * 0.42);
  const ox = Math.round((w - S) / 2), oy = Math.round((h - S) / 2);
  const bg = hex('#0b1020');
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      let c = bg;
      if (px >= ox && px < ox + S && py >= oy && py < oy + S) {
        const s = sample((px - ox + 0.5) / S, (py - oy + 0.5) / S, { rounded: true, scale: 1 });
        if (s[3]) c = s;
      }
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    }
  }
  return png(w, h, buf);
}
console.log('Icons written.');
