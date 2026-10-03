// Dev check: builds every circuit, prints stats and draws all layouts to tracks-preview.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Track } from '../src/track.js';
import { levelConfig, LEVEL_COUNT } from '../src/data.js';

const cell = 220, cols = 6, rows = Math.ceil(LEVEL_COUNT / cols);
const W = cell * cols, H = cell * rows;
const img = Buffer.alloc(W * H * 3, 24);
const dot = (x, y, c, r = 1) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const px = Math.round(x + dx), py = Math.round(y + dy); if (px >= 0 && py >= 0 && px < W && py < H) img.set(c, (py * W + px) * 3); } };
for (let lvl = 1; lvl <= LEVEL_COUNT; lvl++) {
  const cfg = levelConfig(lvl);
  const t = new Track(cfg);
  const maxK = Math.max(...Array.from(t.curv).map(Math.abs));
  console.log(`${String(lvl).padStart(2)} ${cfg.circuit.name.padEnd(26)} len=${Math.round(t.length)}m scale=${t.layoutScale.toFixed(2)} minR=${(1 / maxK).toFixed(0)}m${t.forced ? '  FORCED ' + t.fail : ''}`);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of t.pos) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const sc = (cell - 30) / Math.max(maxX - minX, maxZ - minZ);
  const ox = ((lvl - 1) % cols) * cell + 15, oy = Math.floor((lvl - 1) / cols) * cell + 15;
  t.pos.forEach((p, i) => dot(ox + (p.x - minX) * sc, oy + (p.z - minZ) * sc, i < 15 ? [255, 60, 60] : [235, 235, 235], i < 15 ? 2 : 1));
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(process.argv[2] || 'tracks-preview.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
