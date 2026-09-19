import { copyDefaultConfig } from './default-config.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const keyOf = (row, column) => `${row}:${column}`;

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
  config.guardians.chargeNeeded = Math.round(clamp(config.guardians.chargeNeeded, 1, 50));
  config.guardians.effects.forEach((guardian) => {
    guardian.strength = clamp(guardian.strength, 0, 20);
  });
  config.bonus.freeSpins = Math.round(clamp(config.bonus.freeSpins, 1, 100));
  config.bonus.retriggerSpins = Math.round(clamp(config.bonus.retriggerSpins, 0, 100));
  config.bonus.retriggerChance = clamp(config.bonus.retriggerChance, 0, 1);
  config.bonus.guardianBoost = clamp(config.bonus.guardianBoost, 0, 10);
  config.bonus.removalThreshold = Math.round(clamp(config.bonus.removalThreshold, 1, 500));
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
    bonusSpins: 0,
    bonusSpinsRemaining: 0,
    totalWagered: 0,
    totalWon: 0,
    currentRoundWin: 0,
    guardianCharge: config.guardians.effects.map(() => 0),
    bonusProgress: Object.fromEntries(config.symbols.map((symbol) => [symbol.id, 0])),
    removedSymbols: [],
    lastGrid: null
  };
}

function weightedSymbol(config, state, rng) {
  const removed = new Set(state.removedSymbols);
  const choices = config.symbols
    .filter((symbol) => !removed.has(symbol.id))
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
  return Array.from({ length: config.grid.rows }, () =>
    Array.from({ length: config.grid.columns }, () => weightedSymbol(config, state, rng))
  );
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
        if (seen.has(startKey) || ![symbol.id, 'wild'].includes(grid[row][column])) continue;
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
            if (!seen.has(nextKey) && [symbol.id, 'wild'].includes(grid[nextRow][nextColumn])) {
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
  for (let column = 0; column < columns; column += 1) {
    const survivors = [];
    for (let row = rows - 1; row >= 0; row -= 1) {
      if (!clearedKeys.has(keyOf(row, column))) survivors.push(grid[row][column]);
    }
    for (let row = rows - 1, index = 0; row >= 0; row -= 1, index += 1) {
      grid[row][column] = index < survivors.length
        ? survivors[index]
        : weightedSymbol(config, state, rng);
    }
  }
}

function triggerGuardian(grid, config, state, rng, isBonus) {
  const chance = config.guardians.triggerChance * (isBonus ? config.bonus.guardianBoost : 1);
  if (rng.next() >= chance) return null;
  const sleeping = state.guardianCharge
    .map((charge, index) => ({ charge, index }))
    .filter(({ charge }) => charge < config.guardians.chargeNeeded);
  const pool = sleeping.length ? sleeping : state.guardianCharge.map((charge, index) => ({ charge, index }));
  const selected = pool[rng.int(pool.length)].index;
  const guardian = config.guardians.effects[selected];
  state.guardianCharge[selected] = Math.min(
    config.guardians.chargeNeeded,
    state.guardianCharge[selected] + 1
  );
  const cleared = new Set();
  let cascadeBoost = 0;

  if (guardian.id === 'sweep') {
    const row = rng.int(grid.length);
    for (let column = 0; column < grid[0].length; column += 1) cleared.add(keyOf(row, column));
  } else if (guardian.id === 'collector') {
    const present = config.symbols
      .filter((symbol) => grid.some((row) => row.includes(symbol.id)))
      .sort((left, right) => left.pay - right.pay);
    const target = present[rng.int(Math.max(1, Math.min(3, present.length)))]?.id;
    if (target) {
      for (let row = 0; row < grid.length; row += 1) {
        for (let column = 0; column < grid[0].length; column += 1) {
          if (grid[row][column] === target) cleared.add(keyOf(row, column));
        }
      }
    }
  } else if (guardian.id === 'wild') {
    const count = Math.max(1, Math.round(guardian.strength));
    for (let index = 0; index < count; index += 1) {
      grid[rng.int(grid.length)][rng.int(grid[0].length)] = 'wild';
    }
  } else if (guardian.id === 'multiplier') {
    cascadeBoost = guardian.strength;
  }
  if (cleared.size) collapseGrid(grid, cleared, config, state, rng);
  return { guardianIndex: selected, guardianId: guardian.id, name: guardian.name, cascadeBoost };
}

function maybeAwardBonus(config, state, isBonus, rng) {
  const allAwake = state.guardianCharge.every((charge) => charge >= config.guardians.chargeNeeded);
  if (!allAwake) return null;
  state.guardianCharge.fill(0);
  if (isBonus) {
    state.bonusSpinsRemaining += config.bonus.retriggerSpins;
    return { type: 'guardian-retrigger', spins: config.bonus.retriggerSpins };
  }
  state.bonusSpinsRemaining += config.bonus.freeSpins;
  state.bonusProgress = Object.fromEntries(config.symbols.map((symbol) => [symbol.id, 0]));
  state.removedSymbols = [];
  return { type: 'bonus', spins: config.bonus.freeSpins };
}

export function playSpin(configInput, state, rng) {
  const config = normalizeConfig(configInput);
  const isBonus = state.bonusSpinsRemaining > 0;
  const bet = config.economy.bet;
  if (isBonus) {
    state.bonusSpinsRemaining -= 1;
    state.bonusSpins += 1;
  } else {
    state.currentRoundWin = 0;
    state.balance -= bet;
    state.totalWagered += bet;
    state.baseSpins += 1;
  }

  const grid = createGrid(config, state, rng);
  const events = [];
  const guardianEvent = triggerGuardian(grid, config, state, rng, isBonus);
  if (guardianEvent) events.push({ type: 'guardian', ...guardianEvent });
  let cascadeMultiplier = 1 + (guardianEvent?.cascadeBoost || 0);
  let totalWin = 0;
  let cascades = 0;

  for (; cascades < config.grid.maxCascades; cascades += 1) {
    const clusters = findWinningClusters(grid, config);
    if (!clusters.length) break;
    const cleared = new Set();
    let cascadeWin = 0;
    for (const cluster of clusters) {
      const symbol = config.symbols.find((candidate) => candidate.id === cluster.symbolId);
      const sizeTier = 1 + Math.floor((cluster.cells.length - config.grid.minCluster) / 3) * 0.55;
      const clusterWin = bet * symbol.pay * cluster.cells.length * sizeTier * cascadeMultiplier;
      cascadeWin += clusterWin;
      cluster.cells.forEach(([row, column]) => cleared.add(keyOf(row, column)));
      if (isBonus) {
        const regularCount = cluster.cells.filter(([row, column]) => grid[row][column] !== 'wild').length;
        state.bonusProgress[symbol.id] += regularCount;
        if (
          state.bonusProgress[symbol.id] >= config.bonus.removalThreshold &&
          !state.removedSymbols.includes(symbol.id) &&
          state.removedSymbols.length < config.symbols.length - 2
        ) {
          state.removedSymbols.push(symbol.id);
          events.push({ type: 'symbol-removed', symbolId: symbol.id });
        }
      }
    }
    totalWin += cascadeWin;
    events.push({
      type: 'cascade',
      number: cascades + 1,
      multiplier: cascadeMultiplier,
      win: cascadeWin,
      clusters: clusters.map((cluster) => ({ symbolId: cluster.symbolId, size: cluster.cells.length }))
    });
    collapseGrid(grid, cleared, config, state, rng);
    cascadeMultiplier += 0.25;
  }

  let bonusEvent = maybeAwardBonus(config, state, isBonus, rng);
  if (isBonus && !bonusEvent && rng.next() < config.bonus.retriggerChance) {
    state.bonusSpinsRemaining += config.bonus.retriggerSpins;
    bonusEvent = { type: 'random-retrigger', spins: config.bonus.retriggerSpins };
  }
  if (bonusEvent) events.push(bonusEvent);

  const maxWin = bet * config.economy.maxWinX;
  const remainingRoundCapacity = Math.max(0, maxWin - state.currentRoundWin);
  const rawWin = totalWin;
  totalWin = Math.min(totalWin, remainingRoundCapacity);
  state.currentRoundWin += totalWin;
  state.balance += totalWin;
  state.totalWon += totalWin;
  state.lastGrid = grid;
  const bonusEnded = isBonus && state.bonusSpinsRemaining === 0;
  const result = {
    isBonus,
    bet: isBonus ? 0 : bet,
    totalWin,
    cappedAmount: rawWin - totalWin,
    winX: totalWin / bet,
    cascades,
    grid: structuredClone(grid),
    events,
    bonusSpinsRemaining: state.bonusSpinsRemaining,
    bonusEnded,
    rngState: rng.state
  };
  if (bonusEnded) {
    state.removedSymbols = [];
    state.bonusProgress = Object.fromEntries(config.symbols.map((symbol) => [symbol.id, 0]));
  }
  return result;
}

export function playRound(config, state, rng) {
  if (state.bonusSpinsRemaining) throw new Error('A base round cannot begin during free spins.');
  const spins = [playSpin(config, state, rng)];
  while (state.bonusSpinsRemaining > 0) spins.push(playSpin(config, state, rng));
  const rawBaseWin = spins.filter((spin) => !spin.isBonus).reduce((sum, spin) => sum + spin.totalWin, 0);
  const rawBonusWin = spins.filter((spin) => spin.isBonus).reduce((sum, spin) => sum + spin.totalWin, 0);
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
    bonusTriggered: spins[0].events.some((event) => event.type === 'bonus')
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
