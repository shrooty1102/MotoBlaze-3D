// Synthesised audio (no asset files needed): engine with gear shifts, beeps, boosts, impacts, rewards.

let ctx = null;
let master = null;
let enabled = true;
let engine = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.6 : 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
}

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
}

function noiseBuffer(seconds = 1) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function startEngine() {
  if (!ctx || engine) return;
  const out = ctx.createGain();
  out.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 4;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'square';
  const g2 = ctx.createGain(); g2.gain.value = 0.35;
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(2); n.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2000;
  const ng = ctx.createGain(); ng.gain.value = 0.0;
  o1.connect(filter); o2.connect(g2); g2.connect(filter);
  n.connect(nf); nf.connect(ng); ng.connect(out);
  filter.connect(out);
  out.connect(master);
  o1.start(); o2.start(); n.start();
  engine = { out, filter, o1, o2, ng };
}

// speedRatio 0..1, throttle 0..1, boost bool
export function updateEngine(speed, topSpeed, throttle, boost) {
  if (!engine) return;
  const gears = 6;
  const ratio = Math.min(1.1, speed / topSpeed);
  const gear = Math.min(gears - 1, Math.floor(ratio * gears * 0.999));
  const inGear = ratio * gears - gear;               // 0..1 within gear
  const rpm = 0.28 + inGear * 0.72;
  const base = 55 + rpm * 120 + gear * 8;
  const t = ctx.currentTime;
  engine.o1.frequency.setTargetAtTime(base, t, 0.03);
  engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.03);
  engine.filter.frequency.setTargetAtTime(500 + rpm * 1400 + throttle * 600 + (boost ? 800 : 0), t, 0.05);
  engine.out.gain.setTargetAtTime(0.1 + throttle * 0.08 + (boost ? 0.05 : 0), t, 0.05);
  engine.ng.gain.setTargetAtTime(Math.min(0.25, speed / 300) + (boost ? 0.12 : 0), t, 0.1);
}

export function stopEngine() {
  if (!engine) return;
  const e = engine;
  engine = null;
  e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.out.disconnect(); } catch (err) { /* already stopped */ } }, 400);
}

function tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseHit(dur, freq, vol, delay = 0, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur + 0.1);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.1);
}

export const sfx = {
  click: () => tone(880, 0.08, 'triangle', 0.15),
  countBeep: () => tone(440, 0.25, 'square', 0.18),
  goBeep: () => tone(880, 0.6, 'square', 0.2),
  boost: () => { noiseHit(0.8, 1800, 0.35, 0, 'bandpass'); tone(200, 0.6, 'sawtooth', 0.12, 0, 600); },
  hit: () => { noiseHit(0.35, 400, 0.6); tone(90, 0.3, 'sine', 0.4); },
  slip: () => noiseHit(0.5, 3000, 0.25, 0, 'highpass'),
  lap: () => { tone(660, 0.15, 'triangle', 0.2); tone(990, 0.3, 'triangle', 0.2, 0.15); },
  finish: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.22, i * 0.12)); },
  star: (i) => tone(700 + i * 220, 0.35, 'triangle', 0.25),
  coin: () => { tone(1320, 0.08, 'square', 0.1); tone(1760, 0.18, 'square', 0.1, 0.07); },
  buy: () => { [784, 988, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, i * 0.08)); },
  error: () => tone(160, 0.25, 'square', 0.15),
  pop: () => { noiseHit(0.06, 2500, 0.7, 0, 'highpass'); tone(700, 0.12, 'sine', 0.25, 0, 220); },
  spray: (dur = 4) => noiseHit(dur, 4000, 0.18, 0.05, 'highpass'),
  cheer: (dur = 7) => crowd(dur),
};

// Crowd cheer: band-passed noise with a wobbling swell
function crowd(dur) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur + 0.2);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.6);
  g.gain.setValueAtTime(0.35, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 3.3;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain); lfoGain.connect(g.gain);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
  // a few whistles
  for (let i = 0; i < 3; i++) tone(1800 + Math.random() * 600, 0.35, 'sine', 0.05, 0.8 + i * 1.3, 2600);
}
