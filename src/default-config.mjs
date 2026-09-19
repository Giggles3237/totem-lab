export const DEFAULT_CONFIG = Object.freeze({
  meta: {
    name: 'Balanced prototype',
    version: 1
  },
  grid: {
    columns: 7,
    rows: 7,
    minCluster: 5,
    maxCascades: 12
  },
  economy: {
    startingBalance: 1000,
    bet: 1,
    maxWinX: 500
  },
  wild: {
    baseWeight: 1.2
  },
  guardians: {
    triggerChance: 0.08,
    chargeNeeded: 10,
    effects: [
      { id: 'sweep', name: 'Vine', glyph: 'V', effect: 'Clear a random row', strength: 1 },
      { id: 'collector', name: 'Ember', glyph: 'E', effect: 'Collect a low-value symbol', strength: 1 },
      { id: 'wild', name: 'Moon', glyph: 'M', effect: 'Create Wilds', strength: 3 },
      { id: 'multiplier', name: 'Storm', glyph: 'S', effect: 'Boost cascade multiplier', strength: 0.5 }
    ]
  },
  bonus: {
    freeSpins: 10,
    retriggerSpins: 3,
    retriggerChance: 0.005,
    guardianBoost: 1.1,
    removalThreshold: 40
  },
  symbols: [
    { id: 'sun', name: 'Sunstone', glyph: '◆', color: '#ffd447', weight: 28, pay: 0.0546 },
    { id: 'leaf', name: 'Leaf', glyph: '●', color: '#42d392', weight: 25, pay: 0.0728 },
    { id: 'water', name: 'Water', glyph: '⬟', color: '#58a6ff', weight: 21, pay: 0.1001 },
    { id: 'flame', name: 'Flame', glyph: '▲', color: '#ff6b57', weight: 17, pay: 0.1365 },
    { id: 'moon', name: 'Moon', glyph: '☾', color: '#bb9cff', weight: 12, pay: 0.2002 },
    { id: 'crown', name: 'Crown', glyph: '✦', color: '#fff4c2', weight: 7, pay: 0.3276 }
  ]
});

export function copyDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
