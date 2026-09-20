import test from 'node:test';
import assert from 'node:assert/strict';
import { copyDefaultConfig } from '../src/default-config.mjs';
import {
  createGrid,
  createRng,
  createSession,
  findWinningClusters,
  guardianPositions,
  playSpin,
  simulate
} from '../src/engine.mjs';

test('seeded RNG produces repeatable grids', () => {
  const config = copyDefaultConfig();
  const stateA = createSession(config);
  const stateB = createSession(config);
  assert.deepEqual(
    createGrid(config, stateA, createRng('same-seed')),
    createGrid(config, stateB, createRng('same-seed'))
  );
});

test('grid dimensions follow configuration', () => {
  const config = copyDefaultConfig();
  config.grid.columns = 6;
  config.grid.rows = 8;
  const grid = createGrid(config, createSession(config), createRng('dimensions'));
  assert.equal(grid.length, 8);
  assert.ok(grid.every((row) => row.length === 6));
});

test('four static guardians sit one cell inside every corner', () => {
  const config = copyDefaultConfig();
  const grid = createGrid(config, createSession(config), createRng('guardian-layout'));
  const expected = [[1, 1], [1, 5], [7, 1], [7, 5]];
  assert.deepEqual(guardianPositions(config), expected);
  expected.forEach(([row, column], index) => assert.equal(grid[row][column], `guardian:${index}`));
});

test('orthogonal clusters are detected', () => {
  const config = copyDefaultConfig();
  config.grid.minCluster = 5;
  const grid = [
    ['pomegranate', 'pomegranate', 'pomegranate', 'passionfruit', 'passionfruit'],
    ['pomegranate', 'pomegranate', 'passionfruit', 'passionfruit', 'passionfruit'],
    ['banana', 'banana', 'banana', 'banana', 'passionfruit'],
    ['coconut', 'coconut', 'star', 'star', 'star'],
    ['coconut', 'coconut', 'bell', 'bell', 'bell']
  ];
  const clusters = findWinningClusters(grid, config);
  assert.ok(clusters.some((cluster) => cluster.symbolId === 'pomegranate' && cluster.cells.length === 5));
  assert.ok(clusters.some((cluster) => cluster.symbolId === 'passionfruit' && cluster.cells.length === 6));
});

test('playSpin updates balance and records a deterministic result', () => {
  const config = copyDefaultConfig();
  const sessionA = createSession(config);
  const sessionB = createSession(config);
  const resultA = playSpin(config, sessionA, createRng('spin-seed'));
  const resultB = playSpin(config, sessionB, createRng('spin-seed'));
  assert.deepEqual(resultA, resultB);
  assert.equal(sessionA.totalWagered, config.economy.bet);
  assert.equal(sessionA.balance, config.economy.startingBalance - config.economy.bet + resultA.totalWin);
});

test('cascade frames identify only symbols that actually move or refill', () => {
  const config = copyDefaultConfig();
  const result = playSpin(config, createSession(config), createRng('spin-seed'), { captureFrames: true });
  const cascadeDrops = result.frames.filter((frame) => frame.type === 'drop' && frame.number > 0);
  assert.ok(cascadeDrops.length > 0);
  assert.ok(cascadeDrops.every((frame) => frame.movements.length > 0));
  assert.ok(cascadeDrops.some((frame) => frame.movements.length < config.grid.rows * config.grid.columns - 4));
});

test('all four totems share Wild behavior and trigger a pending bonus in one spin', () => {
  const config = copyDefaultConfig();
  const result = playSpin(config, createSession(config), createRng('bonus-180'));
  const guardianEvents = result.events.filter((event) => event.type === 'guardian');
  assert.equal(guardianEvents.length, 4);
  assert.ok(guardianEvents.every((event) => event.guardianId === 'wild'));
  assert.equal(result.bonusPending, true);
  assert.ok(result.events.some((event) => event.type === 'bonus-pending'));
});

test('simulation returns bounded metrics and repeatable output', () => {
  const config = copyDefaultConfig();
  const first = simulate(config, 500, 'math-seed');
  const second = simulate(config, 500, 'math-seed');
  assert.deepEqual(first, second);
  assert.ok(first.rtp >= 0);
  assert.ok(first.hitRate >= 0 && first.hitRate <= 100);
  assert.ok(first.maxWinX <= config.economy.maxWinX);
  assert.equal(Object.values(first.distribution).reduce((sum, value) => sum + value, 0), 500);
});

test('a lit totem can trigger a reproducible full-board blast', () => {
  const config = copyDefaultConfig();
  config.totemModifiers.chancePerCascade = 1;
  config.totemModifiers.boardBlastWeight = 1;
  let result;
  for (let index = 0; index < 500 && !result?.events.some((event) => event.type === 'totem-modifier'); index += 1) {
    result = playSpin(config, createSession(config), createRng(`blast-${index}`), { captureFrames: true });
  }
  const modifier = result.events.find((event) => event.type === 'totem-modifier');
  assert.equal(modifier.kind, 'board-blast');
  assert.equal(modifier.clearedCount, config.grid.rows * config.grid.columns - 4);
  assert.ok(result.frames.some((frame) => frame.type === 'modifier-clear'));
});

test('a lit totem can sweep exactly one configured fruit type', () => {
  const config = copyDefaultConfig();
  config.totemModifiers.chancePerCascade = 1;
  config.totemModifiers.boardBlastWeight = 0;
  let result;
  for (let index = 0; index < 500 && !result?.events.some((event) => event.type === 'totem-modifier'); index += 1) {
    result = playSpin(config, createSession(config), createRng(`sweep-${index}`), { captureFrames: true });
  }
  const modifier = result.events.find((event) => event.type === 'totem-modifier');
  assert.equal(modifier.kind, 'fruit-sweep');
  assert.ok(config.symbols.some((symbol) => symbol.category === 'fruit' && symbol.id === modifier.symbolId));
  assert.ok(modifier.clearedCount > 0);
});
