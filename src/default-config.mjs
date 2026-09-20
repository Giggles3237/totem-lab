export const DEFAULT_CONFIG = Object.freeze({
  meta: {
    name: 'Balanced prototype',
    version: 4
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
  totemModifiers: {
    chancePerCascade: 0.08,
    boardBlastWeight: 0.5,
    maxPerSpin: 1
  },
  symbols: [
    { id: 'pomegranate', name: 'Pomegranate', category: 'fruit', glyph: '◆', color: '#e6194b', weight: 25, pay: 0.105282 },
    { id: 'passionfruit', name: 'Passionfruit', category: 'fruit', glyph: '◉', color: '#8c4fc7', weight: 23, pay: 0.131603 },
    { id: 'banana', name: 'Bananas', category: 'fruit', glyph: '☾', color: '#ffd43b', weight: 21, pay: 0.168451 },
    { id: 'coconut', name: 'Coconut', category: 'fruit', glyph: '◒', color: '#8a5328', weight: 18, pay: 0.221092 },
    { id: 'dragonfruit', name: 'Dragonfruit', category: 'fruit', glyph: '✥', color: '#f32f83', weight: 15, pay: 0.315846 },
    { id: 'star', name: 'Star', category: 'classic', glyph: '★', color: '#ffc928', weight: 11, pay: 0.473769 },
    { id: 'bell', name: 'Bell', category: 'classic', glyph: '◖', color: '#ff8a1f', weight: 7, pay: 0.736974 },
    { id: 'seven', name: 'Seven', category: 'classic', glyph: '7', color: '#2997ff', weight: 4, pay: 1.158102 }
  ]
});

export function copyDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
