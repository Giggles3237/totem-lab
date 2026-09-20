import { copyDefaultConfig } from './default-config.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const keyOf = (row, column) => `${row}:${column}`;
const isGuardian = (symbolId) => String(symbolId).startsWith('guardian:');
const isAwakeGuardian = (symbolId) => String(symbolId).startsWith('guardian-wild:');
const isGridWild = (symbolId) => symbolId === 'wild' || isAwakeGuardian(symbolId);

export function guardianPositions(configInput) {
  const config = normalizeConfig(configInput);
  const { rows, columns } = config.grid;
  return [
    [1, 1],
    [1, columns - 2],
    [rows - 2, 1],
    [rows - 2, columns - 2]
  ];
}

export function hashSeed(value = 'totem-lab') {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
}

export function createRng(seed = 'totem-lab') {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  if (!state) state = 0x9e3779b9;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * Math.max(1, max));
    },
    get state() {
      return state >>> 0;
    }
  };
}

export function normalizeConfig(input = copyDefaultConfig()) {
  const config = structuredClone(input);
  config.grid.columns = Math.round(clamp(config.grid.columns, 5, 10));
  config.grid.rows = Math.round(clamp(config.grid.rows, 5, 10));
  config.grid.minCluster = Math.round(clamp(config.grid.minCluster, 3, 12));
  config.grid.maxCascades = Math.round(clamp(config.grid.maxCascades, 1, 50));
  config.economy.startingBalance = clamp(config.economy.startingBalance, 10, 1_000_000);
  config.economy.bet = clamp(config.economy.bet, 0.01, 1000);
  config.economy.maxWinX = clamp(config.economy.maxWinX, 10, 100_000);
  config.wild.baseWeight = clamp(config.wild.baseWeight, 0, 20);
  config.guardians.triggerChance = clamp(config.guardians.triggerChance, 0, 1);
  config.guardians.chargeNeeded = 1;
  config.guardians.effects.forEach((guardian) => {
    guardian.strength = clamp(guardian.strength, 0, 20);
  });
  config.symbols = config.symbols
    .map((symbol) => ({
      ...symbol,
      weight: clamp(symbol.weight, 0.1, 1000),
      pay: clamp(symbol.pay, 0, 100)
    }))
    .filter((symbol) => symbol.id !== 'wild');
  if (config.symbols.length < 3) throw new Error('At least three regular symbols are required.');
  return config;
}

export function createSession(configInput = copyDefaultConfig()) {
  const config = normalizeConfig(configInput);
  return {
    balance: config.economy.startingBalance,
    baseSpins: 0,
    totalWagered: 0,
    totalWon: 0,
    currentRoundWin: 0,
    guardianCharge: config.guardians.effects.map(() => 0),
    bonusPending: false,
    lastGrid: null
  };
}

function weightedSymbol(config, state, rng) {
  const choices = config.symbols
    .map((symbol) => ({ id: symbol.id, weight: symbol.weight }));
  if (config.wild.baseWeight > 0) choices.push({ id: 'wild', weight: config.wild.baseWeight });
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = rng.next() * total;
  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) return choice.id;
  }
  return choices.at(-1).id;
}

export function createGrid(configInput, state, rng) {
  const config = normalizeConfig(configInput);
  const grid = Array.from({ length: config.grid.rows }, () =>
    Array.from({ length: config.grid.columns }, () => weightedSymbol(config, state, rng))
  );
  guardianPositions(config).forEach(([row, column], index) => {
    grid[row][column] = `guardian:${index}`;
  });
  return grid;
}

function neighbors(row, column, rows, columns) {
  return [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1]
  ].filter(([nextRow, nextColumn]) =>
    nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
  );
}

export function findWinningClusters(grid, configInput) {
  const config = normalizeConfig(configInput);
  const candidates = [];
  for (const symbol of config.symbols) {
    const seen = new Set();
    for (let row = 0; row < grid.length; row += 1) {
      for (let column = 0; column < grid[0].length; column += 1) {
        const startKey = keyOf(row, column);
        if (seen.has(startKey) || !(grid[row][column] === symbol.id || isGridWild(grid[row][column]))) continue;
        const queue = [[row, column]];
        const cells = [];
        let containsSymbol = false;
        seen.add(startKey);
        while (queue.length) {
          const [currentRow, currentColumn] = queue.shift();
          cells.push([currentRow, currentColumn]);
          if (grid[currentRow][currentColumn] === symbol.id) containsSymbol = true;
          for (const [nextRow, nextColumn] of neighbors(currentRow, currentColumn, grid.length, grid[0].length)) {
            const nextKey = keyOf(nextRow, nextColumn);
            if (!seen.has(nextKey) && (grid[nextRow][nextColumn] === symbol.id || isGridWild(grid[nextRow][nextColumn]))) {
              seen.add(nextKey);
              queue.push([nextRow, nextColumn]);
            }
          }
        }
        if (containsSymbol && cells.length >= config.grid.minCluster) {
          candidates.push({ symbolId: symbol.id, cells, pay: symbol.pay });
        }
      }
    }
  }
  candidates.sort((left, right) => right.cells.length - left.cells.length || right.pay - left.pay);
  const claimed = new Set();
  return candidates.filter((cluster) => {
    if (cluster.cells.some(([row, column]) => claimed.has(keyOf(row, column)))) return false;
    cluster.cells.forEach(([row, column]) => claimed.add(keyOf(row, column)));
    return true;
  });
}

function collapseGrid(grid, clearedKeys, config, state, rng) {
  const rows = grid.length;
  const columns = grid[0].length;
  const movements = [];
  for (let column = 0; column < columns; column += 1) {
    const blockers = [];
    for (let row = 0; row < rows; row += 1) {
      if (isGuardian(grid[row][column]) || isAwakeGuardian(grid[row][column])) blockers.push(row);
    }
    const boundaries = [-1, ...blockers, rows];
    for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
      const top = boundaries[boundaryIndex] + 1;
      const bottom = boundaries[boundaryIndex + 1] - 1;
      const survivors = [];
      for (let row = bottom; row >= top; row -= 1) {
        if (!clearedKeys.has(keyOf(row, column))) survivors.push({ symbolId: grid[row][column], fromRow: row });
      }
      for (let row = bottom, index = 0; row >= top; row -= 1, index += 1) {
        if (index < survivors.length) {
          const survivor = survivors[index];
          grid[row][column] = survivor.symbolId;
          if (survivor.fromRow !== row) {
            movements.push({ symbolId: survivor.symbolId, from: [survivor.fromRow, column], to: [row, column], isNew: false });
          }
        } else {
          const symbolId = weightedSymbol(config, state, rng);
          grid[row][column] = symbolId;
          movements.push({ symbolId, from: [top - 1 - (index - survivors.length), column], to: [row, column], isNew: true });
        }
      }
    }
  }
  return movements;
}

function activateGuardian(state, selected, config) {
  const guardian = config.guardians.effects[selected];
  state.guardianCharge[selected] = 1;
  return { guardianIndex: selected, guardianId: guardian.id, name: guardian.name };
}

function adjacentGuardianIndexes(grid, clusters) {
  const winning = new Set(clusters.flatMap((cluster) => cluster.cells.map(([row, column]) => keyOf(row, column))));
  const indexes = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[0].length; column += 1) {
      if (!isGuardian(grid[row][column])) continue;
      const adjacent = neighbors(row, column, grid.length, grid[0].length)
        .some(([nextRow, nextColumn]) => winning.has(keyOf(nextRow, nextColumn)));
      if (adjacent) indexes.push(Number(grid[row][column].split(':')[1]));
    }
  }
  return indexes;
}

function maybeTriggerBonus(state) {
  const allAwake = state.guardianCharge.every((charge) => charge === 1);
  if (!allAwake) return null;
  state.bonusPending = true;
  return { type: 'bonus-pending' };
}

export function playSpin(configInput, state, rng, options = {}) {
  const config = normalizeConfig(configInput);
  const captureFrames = Boolean(options.captureFrames);
  const bet = config.economy.bet;
  state.currentRoundWin = 0;
  state.balance -= bet;
  state.totalWagered += bet;
  state.baseSpins += 1;
  state.guardianCharge.fill(0);
  state.bonusPending = false;

  const grid = createGrid(config, state, rng);
  const events = [];
  const frames = captureFrames ? [{ type: 'drop', grid: structuredClone(grid), number: 0 }] : null;
  let cascadeMultiplier = 1;
  let totalWin = 0;
  let cascades = 0;

  for (; cascades < config.grid.maxCascades; cascades += 1) {
    const clusters = findWinningClusters(grid, config);
    if (!clusters.length) break;
    const cleared = new Set();
    let cascadeWin = 0;
    const activationChance = config.guardians.triggerChance;
    const activated = adjacentGuardianIndexes(grid, clusters).filter(() => rng.next() < activationChance);
    for (const guardianIndex of activated) {
      const [guardianRow, guardianColumn] = guardianPositions(config)[guardianIndex];
      grid[guardianRow][guardianColumn] = `guardian-wild:${guardianIndex}`;
      const guardianEvent = activateGuardian(state, guardianIndex, config);
      events.push({
        type: 'guardian',
        guardianIndex,
        guardianId: guardianEvent.guardianId,
        name: guardianEvent.name,
        cascade: cascades + 1
      });
    }
    for (const cluster of clusters) {
      const symbol = config.symbols.find((candidate) => candidate.id === cluster.symbolId);
      const sizeTier = 1 + Math.floor((cluster.cells.length - config.grid.minCluster) / 3) * 0.55;
      const clusterWin = bet * symbol.pay * cluster.cells.length * sizeTier * cascadeMultiplier;
      cascadeWin += clusterWin;
      cluster.cells.forEach(([row, column]) => {
        if (!isGuardian(grid[row][column]) && !isAwakeGuardian(grid[row][column])) cleared.add(keyOf(row, column));
      });
    }
    totalWin += cascadeWin;
    events.push({
      type: 'cascade',
      number: cascades + 1,
      multiplier: cascadeMultiplier,
      win: cascadeWin,
      clusters: clusters.map((cluster) => ({ symbolId: cluster.symbolId, size: cluster.cells.length, cells: cluster.cells }))
    });
    if (frames) frames.push({
      type: 'win',
      grid: structuredClone(grid),
      number: cascades + 1,
      multiplier: cascadeMultiplier,
      win: cascadeWin,
      cleared: [...cleared].map((cell) => cell.split(':').map(Number)),
      clusters: clusters.map((cluster) => ({ symbolId: cluster.symbolId, cells: cluster.cells }))
    });
    const movements = collapseGrid(grid, cleared, config, state, rng);
    if (frames) frames.push({ type: 'drop', grid: structuredClone(grid), number: cascades + 1, movements });
    cascadeMultiplier += 0.25;
  }

  const bonusEvent = maybeTriggerBonus(state);
  if (bonusEvent) events.push(bonusEvent);

  const maxWin = bet * config.economy.maxWinX;
  const remainingRoundCapacity = Math.max(0, maxWin - state.currentRoundWin);
  const rawWin = totalWin;
  totalWin = Math.min(totalWin, remainingRoundCapacity);
  state.currentRoundWin += totalWin;
  state.balance += totalWin;
  state.totalWon += totalWin;
  state.lastGrid = grid;
  const result = {
    isBonus: false,
    bet,
    totalWin,
    cappedAmount: rawWin - totalWin,
    winX: totalWin / bet,
    cascades,
    grid: structuredClone(grid),
    events,
    frames,
    bonusPending: state.bonusPending,
    rngState: rng.state
  };
  return result;
}

export function playRound(config, state, rng) {
  const spins = [playSpin(config, state, rng)];
  const rawBaseWin = spins[0].totalWin;
  const rawBonusWin = 0;
  const roundCap = config.economy.bet * config.economy.maxWinX;
  const totalWin = Math.min(rawBaseWin + rawBonusWin, roundCap);
  const extraRoundCap = rawBaseWin + rawBonusWin - totalWin;
  if (extraRoundCap > 0) {
    state.balance -= extraRoundCap;
    state.totalWon -= extraRoundCap;
  }
  const cappedAmount = extraRoundCap + spins.reduce((sum, spin) => sum + spin.cappedAmount, 0);
  const baseWin = Math.min(rawBaseWin, totalWin);
  const bonusWin = Math.max(0, totalWin - baseWin);
  return {
    spins,
    totalWin,
    baseWin,
    bonusWin,
    cappedAmount,
    bonusTriggered: spins[0].events.some((event) => event.type === 'bonus-pending')
  };
}

export function simulate(configInput, rounds, seed = 'simulation', onProgress = null) {
  const config = normalizeConfig(configInput);
  const totalRounds = Math.round(clamp(rounds, 100, 10_000_000));
  const state = createSession(config);
  state.balance = 1_000_000_000;
  const rng = createRng(seed);
  let totalWin = 0;
  let baseWin = 0;
  let bonusWin = 0;
  let hitCount = 0;
  let bonusCount = 0;
  let bonusSpinCount = 0;
  let maxWinX = 0;
  let dryStreak = 0;
  let longestDryStreak = 0;
  let sumX = 0;
  let sumSquareX = 0;
  const distribution = {
    zero: 0,
    under1: 0,
    oneTo2: 0,
    twoTo5: 0,
    fiveTo10: 0,
    tenTo50: 0,
    over50: 0
  };
  const convergence = [];
  const progressEvery = Math.max(100, Math.floor(totalRounds / 100));
  const sampleEvery = Math.max(1, Math.floor(totalRounds / 60));

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const round = playRound(config, state, rng);
    const winX = round.totalWin / config.economy.bet;
    totalWin += round.totalWin;
    baseWin += round.baseWin;
    bonusWin += round.bonusWin;
    bonusSpinCount += round.spins.length - 1;
    bonusCount += Number(round.bonusTriggered);
    hitCount += Number(round.totalWin > 0);
    maxWinX = Math.max(maxWinX, winX);
    sumX += winX;
    sumSquareX += winX * winX;
    if (round.totalWin > 0) dryStreak = 0;
    else dryStreak += 1;
    longestDryStreak = Math.max(longestDryStreak, dryStreak);
    if (winX === 0) distribution.zero += 1;
    else if (winX < 1) distribution.under1 += 1;
    else if (winX < 2) distribution.oneTo2 += 1;
    else if (winX < 5) distribution.twoTo5 += 1;
    else if (winX < 10) distribution.fiveTo10 += 1;
    else if (winX < 50) distribution.tenTo50 += 1;
    else distribution.over50 += 1;
    if ((roundIndex + 1) % sampleEvery === 0 || roundIndex === totalRounds - 1) {
      convergence.push({
        spins: roundIndex + 1,
        rtp: totalWin / ((roundIndex + 1) * config.economy.bet) * 100
      });
    }
    if (onProgress && ((roundIndex + 1) % progressEvery === 0 || roundIndex === totalRounds - 1)) {
      onProgress((roundIndex + 1) / totalRounds);
    }
  }

  const meanX = sumX / totalRounds;
  const variance = Math.max(0, sumSquareX / totalRounds - meanX * meanX);
  const standardDeviation = Math.sqrt(variance);
  const rtp = totalWin / (totalRounds * config.economy.bet) * 100;
  const confidence95 = 1.96 * standardDeviation / Math.sqrt(totalRounds) * 100;
  return {
    rounds: totalRounds,
    seed: String(seed),
    rtp,
    confidence95,
    hitRate: hitCount / totalRounds * 100,
    bonusFrequency: bonusCount ? totalRounds / bonusCount : null,
    bonusCount,
    averageBonusWinX: bonusCount ? bonusWin / config.economy.bet / bonusCount : 0,
    baseContribution: totalWin ? baseWin / totalWin * 100 : 0,
    bonusContribution: totalWin ? bonusWin / totalWin * 100 : 0,
    standardDeviationX: standardDeviation,
    maxWinX,
    longestDryStreak,
    bonusSpinCount,
    distribution,
    convergence
  };
}
