import { simulate } from './engine.mjs';

self.addEventListener('message', (event) => {
  const { type, config, rounds, seed } = event.data || {};
  if (type !== 'simulate') return;
  try {
    const result = simulate(config, rounds, seed, (progress) => {
      self.postMessage({ type: 'progress', progress });
    });
    self.postMessage({ type: 'complete', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
