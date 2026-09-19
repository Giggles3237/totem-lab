import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9227;
const profile = await mkdtemp(join(tmpdir(), 'totem-lab-chrome-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'http://127.0.0.1:4173'
], { stdio: 'ignore' });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find((candidate) => candidate.type === 'page' && candidate.url.includes('127.0.0.1:4173'));
      if (target) return target.webSocketDebuggerUrl;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools target did not become ready.');
}

const socket = new WebSocket(await waitForTarget());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const pageErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    pageErrors.push(message.params.entry.text);
  }
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Log.enable');
  await waitFor(`document.readyState === 'complete' && document.querySelectorAll('.symbol-tile').length === 49`);

  const initial = await evaluate(`({
    title: document.title,
    tiles: document.querySelectorAll('.symbol-tile').length,
    guardians: document.querySelectorAll('.guardian').length,
    balance: document.querySelector('#balance-value').textContent
  })`);
  if (initial.tiles !== 49 || initial.guardians !== 4) throw new Error(`Unexpected initial UI: ${JSON.stringify(initial)}`);

  await evaluate(`document.querySelector('#spin-button').click()`);
  await waitFor(`document.querySelector('#event-log li').textContent.includes('credits')`);
  const afterSpin = await evaluate(`({
    balance: document.querySelector('#balance-value').textContent,
    log: document.querySelector('#event-log li').textContent
  })`);
  if (afterSpin.balance === initial.balance) throw new Error('Spin did not change the balance.');

  await evaluate(`(() => {
    const input = document.querySelector('[data-path="grid.columns"]');
    input.value = '6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#rules-form').requestSubmit();
  })()`);
  await waitFor(`document.querySelectorAll('.symbol-tile').length === 42`);

  await evaluate(`document.querySelector('#simulator-tab').click()`);
  await evaluate(`(() => {
    document.querySelector('#simulation-rounds').value = '10000';
    document.querySelector('#run-simulation').click();
  })()`);
  await waitFor(`!document.querySelector('#run-simulation').disabled && document.querySelector('#metric-grid').textContent.includes('%')`, 30000);
  const simulation = await evaluate(`document.querySelector('#metric-grid').innerText`);
  if (!simulation.includes('RTP')) throw new Error('Simulation metrics did not render.');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const simulatorPreview = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL('../previews/totem-lab-simulator.png', import.meta.url), Buffer.from(simulatorPreview.data, 'base64'));
  await evaluate(`document.querySelector('#pin-baseline').click()`);
  await evaluate(`document.querySelector('#versions-tab').click()`);
  await evaluate(`(() => {
    document.querySelector('#version-name').value = 'Browser smoke snapshot';
    document.querySelector('#version-form').requestSubmit();
  })()`);
  await waitFor(`document.querySelectorAll('.version-item').length === 1`);

  await command('Page.reload', { ignoreCache: true });
  await waitFor(`document.readyState === 'complete' && document.querySelectorAll('.symbol-tile').length === 49`);
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const desktop = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL('../previews/totem-lab-desktop.png', import.meta.url), Buffer.from(desktop.data, 'base64'));

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command('Page.reload', { ignoreCache: true });
  await waitFor(`document.readyState === 'complete' && document.querySelectorAll('.symbol-tile').length === 49`);
  const mobile = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL('../previews/totem-lab-mobile.png', import.meta.url), Buffer.from(mobile.data, 'base64'));

  if (pageErrors.length) throw new Error(`Browser console errors: ${pageErrors.join(' | ')}`);
  console.log(JSON.stringify({ initial, afterSpin, simulation: simulation.slice(0, 180), pageErrors }, null, 2));
} finally {
  socket.close();
  chrome.kill('SIGTERM');
  await delay(250);
  await rm(profile, { recursive: true, force: true });
}
