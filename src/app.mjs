import { copyDefaultConfig } from './default-config.mjs';
import {
  createGrid,
  createRng,
  createSession,
  normalizeConfig,
  playSpin
} from './engine.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = 'totem-lab-versions-v1';
const SVG_NS = 'http://www.w3.org/2000/svg';

let activeConfig = normalizeConfig(copyDefaultConfig());
let draftConfig = structuredClone(activeConfig);
let session = createSession(activeConfig);
let playRng = createRng($('#play-seed').value);
let currentWorker = null;
let latestSimulation = null;
let pinnedBaseline = null;

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  const final = parts.pop();
  let cursor = object;
  for (const part of parts) cursor = cursor[part];
  cursor[final] = value;
}

function getPath(object, path) {
  return path.split('.').reduce((cursor, part) => cursor[part], object);
}

function symbolMap() {
  return new Map(activeConfig.symbols.map((symbol) => [symbol.id, symbol]));
}

function markDirty() {
  const dirty = JSON.stringify(draftConfig) !== JSON.stringify(activeConfig);
  const state = $('#dirty-state');
  state.textContent = dirty ? 'UNAPPLIED' : 'ACTIVE';
  state.classList.toggle('is-dirty', dirty);
}

function renderRuleControls() {
  $$('[data-path]', $('#rules-form')).forEach((input) => {
    input.value = getPath(draftConfig, input.dataset.path);
  });
  $('#guardian-editor').innerHTML = draftConfig.guardians.effects.map((guardian, index) => `
    <label class="guardian-edit">
      <strong>${guardian.glyph} · ${guardian.name}</strong>
      <small>${guardian.effect}</small>
      Effect strength
      <input type="number" min="0" max="20" step="0.1" data-guardian-strength="${index}" value="${guardian.strength}">
    </label>
  `).join('');
}

function renderSymbolControls() {
  $('#symbol-editor').innerHTML = draftConfig.symbols.map((symbol, index) => `
    <div class="symbol-row" data-symbol-index="${index}">
      <span class="symbol-preview" style="color:${symbol.color}">${symbol.glyph}</span>
      <label>Name<input value="${symbol.name}" data-symbol-field="name"></label>
      <label>Weight<input type="number" min="0.1" max="1000" step="0.1" value="${symbol.weight}" data-symbol-field="weight"></label>
      <label>Pay<input type="number" min="0" max="100" step="0.0001" value="${symbol.pay}" data-symbol-field="pay"></label>
    </div>
  `).join('');
}

function renderGuardians() {
  $('#guardian-rack').innerHTML = activeConfig.guardians.effects.map((guardian, index) => {
    const charge = session.guardianCharge[index];
    const target = activeConfig.guardians.chargeNeeded;
    const percent = Math.min(100, charge / target * 100);
    return `<article class="guardian ${charge >= target ? 'is-awake' : ''}" style="--charge:${percent}%">
      <div class="guardian-top"><span class="guardian-glyph">${guardian.glyph}</span><span class="guardian-count">${charge}/${target}</span></div>
      <strong>${guardian.name}</strong><small>${guardian.effect}</small>
    </article>`;
  }).join('');
}

function renderBoard(grid = session.lastGrid) {
  if (!grid) grid = createGrid(activeConfig, session, createRng('preview-grid'));
  const map = symbolMap();
  const board = $('#game-board');
  board.style.setProperty('--columns', activeConfig.grid.columns);
  board.innerHTML = grid.flatMap((row, rowIndex) => row.map((symbolId, columnIndex) => {
    const symbol = symbolId === 'wild'
      ? { glyph: 'W', name: 'Wild', color: '#dfff45' }
      : map.get(symbolId);
    return `<div class="symbol-tile ${symbolId === 'wild' ? 'wild' : ''}" role="gridcell" aria-label="${symbol.name}, row ${rowIndex + 1}, column ${columnIndex + 1}" style="--symbol-color:${symbol.color}">${symbol.glyph}</div>`;
  })).join('');
}

function renderSession(result = null) {
  $('#balance-value').textContent = formatNumber(session.balance);
  $('#bet-value').textContent = formatNumber(activeConfig.economy.bet);
  $('#win-value').textContent = formatNumber(result?.totalWin || 0);
  $('#mode-value').textContent = session.bonusSpinsRemaining ? 'Free spins' : 'Base';
  $('#round-label').textContent = result?.isBonus ? 'FREE SPIN' : result ? 'BASE SPIN' : 'READY';
  $('#cascade-label').textContent = result ? `${result.cascades} CASCADE${result.cascades === 1 ? '' : 'S'}` : 'SEED A SPIN';
  $('#bonus-banner').hidden = !session.bonusSpinsRemaining;
  $('#bonus-count').textContent = `${session.bonusSpinsRemaining} remaining`;
  $('#spin-button span').textContent = session.bonusSpinsRemaining ? 'FREE SPIN' : 'SPIN';
  $('#spin-button small').textContent = session.bonusSpinsRemaining ? 'NO CREDIT COST' : `${formatNumber(activeConfig.economy.bet)} CREDIT`;
  renderGuardians();
  renderBoard(result?.grid);
}

function logEvent(message) {
  const log = $('#event-log');
  const item = document.createElement('li');
  item.textContent = message;
  log.prepend(item);
  while (log.children.length > 18) log.lastElementChild.remove();
}

function describeResult(result) {
  if (!result.events.length) {
    logEvent(`${result.isBonus ? 'Free' : 'Base'} spin: no feature event · ${formatNumber(result.totalWin)} credits.`);
    return;
  }
  const guardian = result.events.find((event) => event.type === 'guardian');
  const removed = result.events.filter((event) => event.type === 'symbol-removed');
  const bonus = result.events.find((event) => ['bonus', 'guardian-retrigger', 'random-retrigger'].includes(event.type));
  if (guardian) logEvent(`${guardian.name} guardian triggered: ${activeConfig.guardians.effects[guardian.guardianIndex].effect}.`);
  if (removed.length) logEvent(`Bonus progression removed ${removed.map((event) => symbolMap().get(event.symbolId)?.name).join(', ')} from refills.`);
  if (bonus) logEvent(`${bonus.type === 'bonus' ? 'All guardians awake' : 'Bonus retrigger'}: +${bonus.spins} free spins.`);
  if (result.cappedAmount > 0) logEvent(`Round maximum applied: ${formatNumber(result.cappedAmount)} credits above the cap were excluded.`);
  logEvent(`${result.cascades} cascade${result.cascades === 1 ? '' : 's'} · ${formatNumber(result.totalWin)} credits · RNG ${result.rngState}.`);
}

function resetSession(message = 'Session reset.') {
  session = createSession(activeConfig);
  playRng = createRng($('#play-seed').value || 'relic-001');
  renderSession();
  logEvent(message);
}

function applyDraftConfig() {
  try {
    activeConfig = normalizeConfig(draftConfig);
    draftConfig = structuredClone(activeConfig);
    renderRuleControls();
    renderSymbolControls();
    markDirty();
    resetSession('Rule set applied; session restarted for a clean comparison.');
  } catch (error) {
    logEvent(`Configuration error: ${error.message}`);
  }
}

function bindTabs() {
  const tabs = $$('.tabs [role="tab"]');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((candidate) => candidate.setAttribute('aria-selected', String(candidate === tab)));
    $$('.tab-panel').forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
  }));
}

function readStoredVersions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeStoredVersions(versions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

function renderVersions() {
  const versions = readStoredVersions();
  $('#version-list').innerHTML = versions.length ? versions.map((version) => `
    <article class="version-item" data-version-id="${version.id}">
      <div><strong>${version.name}</strong><small>${new Date(version.createdAt).toLocaleString()} · ${version.config.grid.columns}×${version.config.grid.rows} · ${version.config.grid.minCluster}+ clusters</small></div>
      <div><button type="button" data-load-version>Load</button><button type="button" data-delete-version>Delete</button></div>
    </article>
  `).join('') : '<p class="panel-intro">No snapshots yet. Save the balanced preset before your first experiment.</p>';
}

function metricCard(label, value) {
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function renderSimulation(result) {
  latestSimulation = result;
  $('#metric-grid').innerHTML = [
    metricCard('RTP', `${formatNumber(result.rtp)}%`),
    metricCard('Hit rate', `${formatNumber(result.hitRate)}%`),
    metricCard('Bonus frequency', result.bonusFrequency ? `1 / ${formatNumber(result.bonusFrequency, 0)}` : 'None'),
    metricCard('Volatility σ', `${formatNumber(result.standardDeviationX)}×`),
    metricCard('Bonus contribution', `${formatNumber(result.bonusContribution)}%`),
    metricCard('Average bonus', `${formatNumber(result.averageBonusWinX)}×`),
    metricCard('Max round', `${formatNumber(result.maxWinX)}×`),
    metricCard('Longest dry streak', `${formatNumber(result.longestDryStreak, 0)} rounds`)
  ].join('');
  $('#confidence-label').textContent = `95% estimate: ±${formatNumber(result.confidence95)} points · ${result.rounds.toLocaleString()} rounds`;
  renderConvergence(result.convergence);
  renderDistribution(result.distribution, result.rounds);
  $('#pin-baseline').disabled = false;
  $('#export-results').disabled = false;
  renderComparison();
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderConvergence(points) {
  const svg = $('#convergence-chart');
  svg.innerHTML = '';
  const width = 640;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.rtp);
  const low = Math.max(0, Math.min(80, ...values) - 5);
  const high = Math.max(120, ...values.map((value) => value + 5));
  [0, .5, 1].forEach((fraction) => {
    const y = padding + (height - padding * 2) * fraction;
    svg.append(svgElement('line', { x1: padding, x2: width - padding, y1: y, y2: y, class: 'chart-grid' }));
    const label = svgElement('text', { x: 2, y: y + 6, class: 'chart-label' });
    label.textContent = `${formatNumber(high - (high - low) * fraction, 0)}%`;
    svg.append(label);
  });
  const targetY = padding + (high - 100) / (high - low) * (height - padding * 2);
  svg.append(svgElement('line', { x1: padding, x2: width - padding, y1: targetY, y2: targetY, class: 'chart-target' }));
  const coordinates = points.map((point, index) => {
    const x = padding + index / Math.max(1, points.length - 1) * (width - padding * 2);
    const y = padding + (high - point.rtp) / (high - low) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  svg.append(svgElement('polyline', { points: coordinates, class: 'chart-line' }));
}

function renderDistribution(distribution, rounds) {
  const labels = [
    ['zero', '0×'], ['under1', '<1×'], ['oneTo2', '1–2×'], ['twoTo5', '2–5×'],
    ['fiveTo10', '5–10×'], ['tenTo50', '10–50×'], ['over50', '50×+']
  ];
  const maximum = Math.max(...labels.map(([key]) => distribution[key]));
  $('#distribution-chart').innerHTML = labels.map(([key, label]) => {
    const percent = distribution[key] / rounds * 100;
    const width = distribution[key] / maximum * 100;
    return `<div class="distribution-row"><span>${label}</span><div class="distribution-track"><div class="distribution-fill" style="width:${width}%"></div></div><strong>${formatNumber(percent, 1)}%</strong></div>`;
  }).join('');
}

function renderComparison() {
  const banner = $('#comparison-banner');
  if (!pinnedBaseline || !latestSimulation) {
    banner.hidden = true;
    return;
  }
  const rtpDelta = latestSimulation.rtp - pinnedBaseline.result.rtp;
  const hitDelta = latestSimulation.hitRate - pinnedBaseline.result.hitRate;
  const volatilityDelta = latestSimulation.standardDeviationX - pinnedBaseline.result.standardDeviationX;
  banner.hidden = false;
  banner.innerHTML = `<strong>Compared with “${pinnedBaseline.name}”</strong><br>RTP ${rtpDelta >= 0 ? '+' : ''}${formatNumber(rtpDelta)} pts · Hit rate ${hitDelta >= 0 ? '+' : ''}${formatNumber(hitDelta)} pts · Volatility ${volatilityDelta >= 0 ? '+' : ''}${formatNumber(volatilityDelta)}×`;
}

function runSimulation() {
  if (currentWorker) {
    currentWorker.terminate();
    currentWorker = null;
  }
  const button = $('#run-simulation');
  button.disabled = true;
  button.textContent = 'Simulating…';
  $('#simulation-progress').hidden = false;
  $('#simulation-progress-bar').style.width = '0%';
  $('#simulation-progress-label').textContent = '0%';
  currentWorker = new Worker('./src/sim-worker.mjs', { type: 'module' });
  currentWorker.addEventListener('message', (event) => {
    if (event.data.type === 'progress') {
      const percent = Math.round(event.data.progress * 100);
      $('#simulation-progress-bar').style.width = `${percent}%`;
      $('#simulation-progress-label').textContent = `${percent}%`;
    } else if (event.data.type === 'complete') {
      renderSimulation(event.data.result);
      button.disabled = false;
      button.textContent = 'Run simulation';
      currentWorker.terminate();
      currentWorker = null;
      logEvent(`Simulation completed: ${event.data.result.rounds.toLocaleString()} base rounds at ${formatNumber(event.data.result.rtp)}% RTP.`);
    } else if (event.data.type === 'error') {
      button.disabled = false;
      button.textContent = 'Run simulation';
      logEvent(`Simulation failed: ${event.data.message}`);
      currentWorker.terminate();
      currentWorker = null;
    }
  });
  currentWorker.postMessage({
    type: 'simulate',
    config: activeConfig,
    rounds: Number($('#simulation-rounds').value),
    seed: $('#simulation-seed').value || 'simulation'
  });
}

function bindEvents() {
  bindTabs();
  $('#rules-form').addEventListener('input', (event) => {
    if (event.target.dataset.path) setPath(draftConfig, event.target.dataset.path, Number(event.target.value));
    if (event.target.dataset.guardianStrength !== undefined) {
      draftConfig.guardians.effects[Number(event.target.dataset.guardianStrength)].strength = Number(event.target.value);
    }
    markDirty();
  });
  $('#rules-form').addEventListener('submit', (event) => { event.preventDefault(); applyDraftConfig(); });
  $('#reset-rules').addEventListener('click', () => {
    draftConfig = copyDefaultConfig();
    renderRuleControls();
    renderSymbolControls();
    markDirty();
  });
  $('#symbol-editor').addEventListener('input', (event) => {
    const row = event.target.closest('[data-symbol-index]');
    if (!row || !event.target.dataset.symbolField) return;
    const symbol = draftConfig.symbols[Number(row.dataset.symbolIndex)];
    const field = event.target.dataset.symbolField;
    symbol[field] = ['weight', 'pay'].includes(field) ? Number(event.target.value) : event.target.value;
    markDirty();
  });
  $('#apply-symbols').addEventListener('click', applyDraftConfig);
  $('#spin-button').addEventListener('click', () => {
    const result = playSpin(activeConfig, session, playRng);
    renderSession(result);
    describeResult(result);
  });
  $('#play-seed').addEventListener('change', () => resetSession('Seed changed; deterministic session restarted.'));
  $('#reset-session').addEventListener('click', () => resetSession());
  $('#clear-log').addEventListener('click', () => { $('#event-log').innerHTML = '<li>Event stream cleared.</li>'; });
  $('#run-simulation').addEventListener('click', runSimulation);
  $('#pin-baseline').addEventListener('click', () => {
    pinnedBaseline = {
      name: activeConfig.meta.name,
      result: structuredClone(latestSimulation),
      config: structuredClone(activeConfig)
    };
    renderComparison();
    logEvent(`Pinned ${activeConfig.meta.name} as the comparison baseline.`);
  });
  $('#export-results').addEventListener('click', () => {
    const payload = { exportedAt: new Date().toISOString(), config: activeConfig, result: latestSimulation };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `totem-lab-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  $('#version-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#version-name').value.trim() || `Snapshot ${new Date().toLocaleString()}`;
    const versions = readStoredVersions();
    versions.unshift({ id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), config: structuredClone(activeConfig) });
    writeStoredVersions(versions.slice(0, 30));
    $('#version-name').value = '';
    renderVersions();
    logEvent(`Saved immutable configuration snapshot “${name}”.`);
  });
  $('#version-list').addEventListener('click', (event) => {
    const item = event.target.closest('[data-version-id]');
    if (!item) return;
    const versions = readStoredVersions();
    const version = versions.find((candidate) => candidate.id === item.dataset.versionId);
    if (event.target.matches('[data-load-version]')) {
      activeConfig = normalizeConfig(version.config);
      activeConfig.meta.name = version.name;
      draftConfig = structuredClone(activeConfig);
      renderRuleControls();
      renderSymbolControls();
      markDirty();
      resetSession(`Loaded snapshot “${version.name}”.`);
    } else if (event.target.matches('[data-delete-version]') && confirm(`Delete “${version.name}”?`)) {
      writeStoredVersions(versions.filter((candidate) => candidate.id !== version.id));
      renderVersions();
    }
  });
  $('#toggle-panel').addEventListener('click', () => {
    const panel = $('#control-panel');
    panel.hidden = !panel.hidden;
    $('#toggle-panel').textContent = panel.hidden ? 'Show lab' : 'Hide lab';
    $('#toggle-panel').setAttribute('aria-expanded', String(!panel.hidden));
  });
}

function initialize() {
  renderRuleControls();
  renderSymbolControls();
  renderVersions();
  renderSession();
  markDirty();
  bindEvents();
}

initialize();
