export const DEFAULT_CONFIG = Object.freeze({
  meta: {
    name: 'Balanced prototype',
    version: 3
  },
  grid: {
    columns: 7,
    rows: 9,
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
    triggerChance: 1,
    chargeNeeded: 1,
    effects: [
      { id: 'wild', name: 'Vine', glyph: 'V', effect: 'Turns Wild beside a winning cluster', strength: 1 },
      { id: 'wild', name: 'Ember', glyph: 'E', effect: 'Turns Wild beside a winning cluster', strength: 1 },
      { id: 'wild', name: 'Moon', glyph: 'M', effect: 'Turns Wild beside a winning cluster', strength: 1 },
      { id: 'wild', name: 'Storm', glyph: 'S', effect: 'Turns Wild beside a winning cluster', strength: 1 }
    ]
  },
  symbols: [
    { id: 'sun', name: 'Sunstone', glyph: '◆', color: '#ffd447', weight: 28, pay: 0.03359948 },
    { id: 'leaf', name: 'Leaf', glyph: '●', color: '#42d392', weight: 25, pay: 0.0447993 },
    { id: 'water', name: 'Water', glyph: '⬟', color: '#58a6ff', weight: 21, pay: 0.06159904 },
    { id: 'flame', name: 'Flame', glyph: '▲', color: '#ff6b57', weight: 17, pay: 0.08399869 },
    { id: 'moon', name: 'Moon', glyph: '☾', color: '#bb9cff', weight: 12, pay: 0.12319808 },
    { id: 'crown', name: 'Crown', glyph: '✦', color: '#fff4c2', weight: 7, pay: 0.20159685 }
  ]
});

export function copyDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
