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
    ['sun', 'sun', 'sun', 'leaf', 'leaf'],
    ['sun', 'sun', 'leaf', 'leaf', 'leaf'],
    ['water', 'water', 'water', 'water', 'leaf'],
    ['flame', 'flame', 'moon', 'moon', 'moon'],
    ['flame', 'flame', 'crown', 'crown', 'crown']
  ];
  const clusters = findWinningClusters(grid, config);
  assert.ok(clusters.some((cluster) => cluster.symbolId === 'sun' && cluster.cells.length === 5));
  assert.ok(clusters.some((cluster) => cluster.symbolId === 'leaf' && cluster.cells.length === 6));
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
