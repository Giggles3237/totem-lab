# Totem Lab

An original, non-wagering cascade game and game-math workbench inspired by the *class* of mechanics found in grid-based slots with guardian features. It does **not** copy Red Tiger artwork, branding, audio, source code, or an asserted exact pay model.

**Live demo:** https://giggles3237.github.io/totem-lab/

## Run it

Requirements: Node.js 20 or newer. No package installation is required.

```bash
npm start
```

Open <http://127.0.0.1:4173>.

Run automated tests:

```bash
npm test
node tests/browser-smoke.mjs
```

The browser smoke test expects the local server to be running. It exercises a spin, a rule change, a worker simulation, baseline pinning, and snapshot versioning; it also saves desktop and mobile previews.

## What works

- Playable 5×5 through 10×10 cluster/cascade grid
- Seeded deterministic RNG and reproducible sessions
- Four configurable guardian effects
- Persistent guardian charge and free-spin entry
- Bonus symbol-progress meters and symbol removal from refills
- Random and guardian-driven retriggers
- Round-level maximum-win cap
- Editable grid, economy, guardian, bonus, and symbol parameters
- Web Worker Monte Carlo runs from 10,000 to 1,000,000 base rounds
- RTP with 95% confidence estimate, hit rate, bonus frequency, base/bonus contribution, standard deviation, max exposure, dry streak, convergence, and return distribution
- Pinned simulation baseline with change deltas
- Immutable configuration snapshots in local browser storage
- JSON export of a configuration and its simulation result
- Responsive desktop/mobile UI

## Important design rule

The active configuration never changes silently. Admin edits are staged as **UNAPPLIED** until the user applies them. Applying a rule set resets the play session so results from incompatible models are not blended. Saved versions are immutable snapshots; changing a loaded version creates a new working draft.

## Default math profile

The default preset is tuned to land near 96% over sufficiently large runs, but a single 100,000-round sample can still move several percentage points because rare capped wins materially affect variance. The included default seed produced approximately 96.9% in the development check. That is a prototype target—not certification.

See [docs/MATH_MODEL.md](docs/MATH_MODEL.md) for the model and interpretation notes.

## Boundaries

- Virtual credits only; no deposits, withdrawals, accounts, wallets, or real-money settlement.
- Simulation output is an engineering estimate, not regulatory certification.
- A public or real-money product would require specialized gaming counsel, jurisdiction-specific licensing, certified RNG/math review, responsible-gaming controls, security work, and an approved platform.
- Mechanics may be protectable in some jurisdictions, and trade dress/assets certainly can be. Keep the theme and implementation original and obtain counsel before commercial release.

## Project map

- `index.html` — application shell and accessible controls
- `styles.css` — responsive visual system
- `src/default-config.mjs` — balanced starting configuration
- `src/engine.mjs` — deterministic game and simulation engine
- `src/sim-worker.mjs` — background simulation worker
- `src/app.mjs` — play UI, admin panel, charts, versions, and exports
- `tests/engine.test.mjs` — deterministic unit tests
- `tests/browser-smoke.mjs` — real-Chrome interaction and rendering test
- `previews/` — current desktop/mobile screenshots
