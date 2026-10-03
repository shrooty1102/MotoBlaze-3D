import { CIRCUITS } from './circuits.js';

// Static game data: bikes, riders, themes, levels and rewards.

// topSpeed in m/s, accel in m/s^2, grip = max lateral acceleration (m/s^2) before sliding.
export const BIKES = [
  {
    id: 'viper', name: 'Viper 250', type: 'street', price: 0,
    topSpeed: 58, accel: 14, grip: 21, handling: 0.85,
    color: '#e63946', desc: 'Light, nimble street bike. Perfect to learn the ropes.',
  },
  {
    id: 'dune', name: 'Dune Raider', type: 'dirt', price: 0,
    topSpeed: 55, accel: 16.5, grip: 23, handling: 1.0,
    color: '#f4a300', desc: 'Off-road beast. Grippy and quick off the line.',
  },
  {
    id: 'cruiser', name: 'Thunder Cruiser', type: 'cruiser', price: 600,
    topSpeed: 64, accel: 13, grip: 20, handling: 0.75,
    color: '#2b2d42', desc: 'Heavy V-twin with a huge top end.',
  },
  {
    id: 'blaze', name: 'Blaze R6', type: 'sport', price: 1500,
    topSpeed: 67, accel: 16.5, grip: 23.5, handling: 0.95,
    color: '#1d6cf2', desc: 'Race-bred supersport. Balanced and fast.',
  },
  {
    id: 'phantom', name: 'Phantom X', type: 'super', price: 3000,
    topSpeed: 72, accel: 18, grip: 25, handling: 1.0,
    color: '#7b2cbf', desc: 'Carbon superbike with winglets. Serious pace.',
  },
  {
    id: 'eclipse', name: 'Eclipse GT', type: 'hyper', price: 6000,
    topSpeed: 77, accel: 19.5, grip: 27, handling: 1.1,
    color: '#111111', desc: 'The ultimate hyperbike. Built to win level 30.',
  },
];

export const PAINTS = ['#e63946', '#f4a300', '#2ec4b6', '#1d6cf2', '#7b2cbf', '#111111', '#f1f1f1', '#3a7d44'];

export const AVATARS = [
  { id: 'max',  name: 'Max',  suit: '#d62828', accent: '#f1f1f1', helmet: '#d62828', stripe: '#ffffff', visor: '#1a1a2e', skin: '#e0ac69' },
  { id: 'luna', name: 'Luna', suit: '#7209b7', accent: '#f72585', helmet: '#f72585', stripe: '#7209b7', visor: '#3a0ca3', skin: '#f1c27d' },
  { id: 'rex',  name: 'Rex',  suit: '#1b1b1b', accent: '#ffd60a', helmet: '#ffd60a', stripe: '#1b1b1b', visor: '#111111', skin: '#8d5524' },
  { id: 'zara', name: 'Zara', suit: '#0077b6', accent: '#90e0ef', helmet: '#ffffff', stripe: '#0077b6', visor: '#023e8a', skin: '#c68642' },
  { id: 'kai',  name: 'Kai',  suit: '#2d6a4f', accent: '#b7e4c7', helmet: '#40916c', stripe: '#d8f3dc', visor: '#081c15', skin: '#ffdbac' },
  { id: 'nova', name: 'Nova', suit: '#f77f00', accent: '#003049', helmet: '#003049', stripe: '#f77f00', visor: '#d62828', skin: '#e0ac69' },
];

export const RIVAL_NAMES = [
  'Blaze', 'Viper', 'Storm', 'Ace', 'Turbo', 'Shadow', 'Rocket', 'Falcon', 'Nitro', 'Ghost',
  'Jett', 'Raven', 'Bolt', 'Dash', 'Rogue', 'Comet', 'Titan', 'Phoenix', 'Diesel', 'Echo',
];

export const THEMES = {
  meadow: {
    name: 'Green Valley',
    skyTop: '#2f74c9', skyHorizon: '#bfe3ff', fog: '#cfe6f5', fogDensity: 0.0011,
    sun: '#fff4e0', sunIntensity: 3.0, sunDir: [0.5, 0.75, 0.3], hemiSky: '#cfe8ff', hemiGround: '#4a6b2a', hemiIntensity: 1.1,
    ground: ['#4f8f2f', '#6aa83a', '#3d7a26'], far: ['#5d8a45', '#7d9a6a'], snowCaps: false,
    props: 'trees', exposure: 1.0, night: false,
  },
  desert: {
    name: 'Sun Canyon',
    skyTop: '#3b82c4', skyHorizon: '#f6d8a8', fog: '#ecd3a8', fogDensity: 0.0012,
    sun: '#fff0d0', sunIntensity: 3.3, sunDir: [-0.4, 0.8, 0.35], hemiSky: '#ffe9c4', hemiGround: '#a8763e', hemiIntensity: 1.0,
    ground: ['#d9a464', '#c98f4e', '#e2b77a'], far: ['#b8703c', '#d08a50'], snowCaps: false,
    props: 'desert', exposure: 1.0, night: false,
  },
  alpine: {
    name: 'Alpine',
    skyTop: '#3f7fc8', skyHorizon: '#d6e8f7', fog: '#d3e2ee', fogDensity: 0.0012,
    sun: '#fffaf0', sunIntensity: 2.9, sunDir: [0.3, 0.65, -0.5], hemiSky: '#dcecff', hemiGround: '#3f5f2a', hemiIntensity: 1.1,
    ground: ['#3f7d30', '#5a9238', '#2f6a26'], far: ['#4f7a48', '#6d8a70'], snowLine: 110,
    props: 'pines', exposure: 1.0, night: false,
  },
  tropical: {
    name: 'Tropical',
    skyTop: '#1f78d1', skyHorizon: '#c8ecff', fog: '#cfeaf2', fogDensity: 0.0012,
    sun: '#fff1d6', sunIntensity: 3.2, sunDir: [0.2, 0.85, 0.4], hemiSky: '#d2f0ff', hemiGround: '#3d7a2a', hemiIntensity: 1.1,
    ground: ['#3d9a35', '#5cb043', '#2f8a2f'], far: ['#3f8a50', '#68a070'], snowCaps: false,
    props: 'tropical', exposure: 1.0, night: false,
  },
  sunset: {
    name: 'Autumn Ridge',
    skyTop: '#3a2f6b', skyHorizon: '#ff9a5a', fog: '#e8a07a', fogDensity: 0.0013,
    sun: '#ffb070', sunIntensity: 2.8, sunDir: [-0.8, 0.22, -0.4], hemiSky: '#ffc49a', hemiGround: '#5a3a2a', hemiIntensity: 0.9,
    ground: ['#7a7a2c', '#8f6a2a', '#6b7d2e'], far: ['#6b4a5a', '#8a5a5a'], snowCaps: false,
    props: 'autumn', exposure: 1.05, night: false,
  },
  night: {
    name: 'Neon Night',
    skyTop: '#03040c', skyHorizon: '#1b2147', fog: '#0d1230', fogDensity: 0.0016,
    sun: '#9fb4ff', sunIntensity: 0.7, sunDir: [0.3, 0.8, 0.2], hemiSky: '#3b4a8a', hemiGround: '#141420', hemiIntensity: 0.55,
    ground: ['#1d2a1d', '#223022', '#1a241a'], far: ['#141a2e', '#1c2340'], snowCaps: false,
    props: 'city', exposure: 1.1, night: true,
  },
};

export { CIRCUITS };
export const LEVEL_COUNT = CIRCUITS.length;

// Difficulty: levels 1-10 are gentle (0 .. 0.18), then it ramps hard from 0.3 up to 1.0 at level 30.
export function difficultyFor(level) {
  if (level <= 10) return (level - 1) * 0.02;
  return 0.3 + ((level - 11) / (LEVEL_COUNT - 11)) * 0.7;
}

export function tierName(level) {
  if (level <= 10) return 'Easy';
  if (level <= 20) return 'Hard';
  return 'Expert';
}

export function levelConfig(level) {
  const diff = difficultyFor(level);
  const circuit = CIRCUITS[level - 1];
  return {
    level,
    diff,
    circuit,
    theme: circuit.theme,
    layout: circuit.path,
    // lap length grows a little with difficulty; tight layouts are scaled up automatically
    targetLength: 2300 + diff * 700,
    seed: 1000 + level * 7919,
    // total race distance; laps are worked out from the circuit's lap length
    raceDistance: level <= 10 ? 4400 : 5800,
    laps: 2,
    trackRadius: 300 - diff * 70,
    // How much the radius of control points varies -> sharper corners
    wobble: 0.16 + diff * 0.32,
    controlPoints: Math.round(9 + diff * 7),
    hills: circuit.hills,
    width: 17 - diff * 4,
    // AI absolute top speed (m/s) and cornering skill
    aiTopSpeed: 47 + diff * 27,
    aiCornerSkill: 0.8 + diff * 0.2,
    aiAccel: 12 + diff * 7,
    obstacles: level <= 3 ? 0 : Math.round(2 + diff * 14),
    boostPads: level <= 10 ? 4 : 3,
  };
}

// Rewards by finishing rank (1-based)
export function rewardFor(rank, level) {
  const stars = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
  const base = [100, 60, 35, 15, 10][rank - 1];
  const mult = 1 + (level - 1) * 0.08;
  return { stars, coins: Math.round(base * mult) };
}
