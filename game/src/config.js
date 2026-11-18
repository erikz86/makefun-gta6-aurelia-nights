// Aurelia Nights — every tuning number, colour and named place in one place.
// Port Aurelia is a fictional sun-soaked harbour city. Nothing here comes from any
// commercial game: the streets, people, cars and story are all invented for this game.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city is a grid of blocks separated by roads. Roads are 100 px wide. */
export const CITY = {
  width: 3320,
  height: 2400,
  roadWidth: 100,
  pitch: 460,
  roadX: [50, 510, 970, 1430, 1890, 2350, 2810, 3270],
  roadY: [50, 510, 970, 1430, 1890, 2350],
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchRange: 46,
  punchDamage: 25,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 28,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  drag: 0.55,
  steer: 2.6,
  trafficSpeed: 150,
  copSpeed: 620,
};

export const WANTED = {
  maxStars: 5,
  heatPerStar: 20,
  stealCarHeat: 34,
  hitPedHeat: 30,
  shootPedHeat: 26,
  shootCopHeat: 40,
  punchCopHeat: 22,
  decayPerSecond: 2.2,
  decayDelay: 6,
};

export const MONEY_START = 120;
export const AMMO_START = 24;

/** Named places on the map. Every mission target is one of these. */
export const PLACES = {
  garage: { x: 560, y: 560, name: 'Garasi Rico' },
  docks: { x: 3050, y: 2180, name: 'Dermaga Selatan' },
  club: { x: 1480, y: 970, name: 'Klub Neon Marlin' },
  tower: { x: 2350, y: 1020, name: 'Menara Aurelia' },
  bank: { x: 1890, y: 1480, name: 'Bank Aurelia' },
  hideout: { x: 510, y: 1940, name: 'Persembunyian' },
  raceA: { x: 970, y: 510, name: 'Tikungan Pelabuhan' },
  raceB: { x: 2350, y: 510, name: 'Jembatan Kaca' },
  raceC: { x: 2350, y: 1890, name: 'Pasar Ikan' },
  plaza: { x: 1430, y: 1430, name: 'Plaza Matahari' },
};

/** The five story missions, in order. Stages are read by missions.js. */
export const MISSIONS = [
  {
    id: 'paket-pertama',
    title: 'Misi 1 — Paket Pertama',
    intro: [
      'RICO: Kai, akhirnya kau datang. Ada paket di garasiku.',
      'RICO: Antar ke Dermaga Selatan. Jangan dibuka. Jangan ditanya.',
    ],
    stages: [
      { type: 'goto', target: 'garage', radius: 70, text: 'Pergi ke Garasi Rico' },
      { type: 'goto', target: 'docks', radius: 80, text: 'Antar paket ke Dermaga Selatan' },
    ],
    reward: 150,
    outro: 'Paket diterima. Orang dermaga itu tersenyum — kau sudah dikenal sekarang.',
  },
  {
    id: 'jemput-maya',
    title: 'Misi 2 — Jemput Maya',
    intro: [
      'MAYA: Kai! Aku di Klub Neon Marlin. Jemput aku, ya?',
      'MAYA: Antar aku ke Menara Aurelia. Ada yang harus kuurus di sana.',
    ],
    stages: [
      { type: 'goto', target: 'club', radius: 70, text: 'Jemput Maya di Klub Neon Marlin' },
      { type: 'goto', target: 'tower', radius: 80, text: 'Antar Maya ke Menara Aurelia' },
    ],
    reward: 250,
    outro: 'MAYA: Kau bisa diandalkan. Rico benar soal kau.',
  },
  {
    id: 'balapan-pelabuhan',
    title: 'Misi 3 — Balapan Pelabuhan',
    intro: [
      'RICO: Ada balapan liar malam ini. Menang, dan namamu naik.',
      'RICO: Lewati tiga titiknya sebelum waktu habis. Pakai mobil!',
    ],
    stages: [
      { type: 'race', target: 'raceA', radius: 80, text: 'Titik 1: Tikungan Pelabuhan', time: 95 },
      { type: 'race', target: 'raceB', radius: 80, text: 'Titik 2: Jembatan Kaca', time: 95 },
      { type: 'race', target: 'raceC', radius: 80, text: 'Titik 3: Pasar Ikan', time: 95 },
    ],
    reward: 400,
    outro: 'Kau menang! Sorakan dari pelabuhan terdengar sampai ke plaza.',
  },
  {
    id: 'kabur-dari-polisi',
    title: 'Misi 4 — Kabur dari Polisi',
    intro: [
      'RICO: Polisi mengendus kita. Mereka datang sekarang!',
      'RICO: Bertahan 45 detik. Jangan sampai tertangkap!',
    ],
    stages: [
      { type: 'survive', seconds: 45, text: 'Kabur dari polisi! Bertahan 45 detik' },
    ],
    reward: 500,
    outro: 'Sirene menjauh. Kau masih bebas — untuk malam ini.',
  },
  {
    id: 'pekerjaan-terakhir',
    title: 'Misi 5 — Pekerjaan Terakhir',
    intro: [
      'RICO: Satu pekerjaan besar, lalu kita selesai. Bank Aurelia.',
      'RICO: Masuk, tahan 8 detik, lalu kabur ke persembunyian. Jangan mati.',
    ],
    stages: [
      { type: 'goto', target: 'bank', radius: 80, text: 'Masuk ke Bank Aurelia' },
      { type: 'hold', target: 'bank', radius: 90, seconds: 8, text: 'Tahan posisi di bank...' },
      { type: 'goto', target: 'hideout', radius: 90, text: 'Kabur ke Persembunyian!' },
    ],
    reward: 1000,
    outro: 'RICO: Kita kaya, Kai. Port Aurelia ini sekarang milik kita.',
  },
];

export const PALETTE = {
  sky: '#ffd9a0',
  grass: '#7fae62',
  grassDark: '#6d9c54',
  sand: '#e8d5a4',
  water: '#2e7fa8',
  waterDeep: '#1f6390',
  asphalt: '#3a3f47',
  asphaltLight: '#454b55',
  sidewalk: '#b9b3a4',
  roadLine: '#e8d44d',
  buildingRoof: ['#c96f4a', '#4a7a9e', '#8a6fb0', '#5d8a6a', '#b08a4a', '#7a5a8a', '#a85a6a', '#4a9e8a'],
  buildingWall: ['#e8dcc8', '#d8c8b0', '#c8d4dc', '#e0c8c8', '#d0d8c0'],
  parkTree: '#3f7a3a',
  parkTreeLight: '#5a9a4a',
  player: '#ffcf3f',
  playerShirt: '#2f6fd0',
  cop: '#1f3a8a',
  copLight: '#3a6fd8',
  pedShirt: ['#e05a5a', '#5aa0e0', '#5ac08a', '#e0a05a', '#a05ae0', '#e05aa0'],
  text: '#f5f0e6',
  muted: '#c9c2b2',
  gold: '#ffcf3f',
  red: '#e5484d',
  blue: '#4f9cf7',
  panel: 'rgba(12, 16, 24, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'aurelia-nights.save.v1';
export const BEST_KEY = 'aurelia-nights.best.v1';
