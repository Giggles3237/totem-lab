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

- Playable 5×5 through 10×10 cluster/cascade grid; the default is a 7-column × 9-row board
- Four static totem stations, each inset one cell from a corner; symbols collapse around them
- Adjacent cluster wins turn fixed totem stations into Wilds for the remainder of that spin
- Lighting all four totems in one spin emits a bonus trigger; bonus rules and value are intentionally pending
- Blender-rendered original symbol and guardian set with reproducible source scripts and `.blend` files
- Eight distinct Blender-rendered symbols—pomegranate, passionfruit, bananas, coconut, dragonfruit, star, bell, and seven—plus a Wild bolt, with thick outlines and unique silhouettes for colorblind-safe recognition
- Staged fall, bounce, cluster-clear, guardian-wake, particle, and bonus animation
- Lit-totem modifiers: a full Board Blast or a sweep of one visible fruit type, both followed by normal gravity and refill
- Configurable modifier chance, event split, and per-spin limit; default is 8% after each winning cascade, 50/50, maximum one
- Manual play and stoppable Auto Spin for 5, 10, 25, or 50 sequential spins
- Lightweight original Web Audio feedback with an on/off control
- Seeded deterministic RNG and reproducible sessions
- Four mechanically identical corner totems with configurable adjacent-wake probability
- Binary per-spin totem state: dormant or lit/Wild
- Explicit all-four-lit bonus trigger with no invented bonus implementation
- Round-level maximum-win cap
- Editable grid, economy, totem wake probability, and symbol parameters
- Web Worker Monte Carlo runs from 10,000 to 1,000,000 base rounds
- RTP with 95% confidence estimate, hit rate, bonus frequency, base/bonus contribution, standard deviation, max exposure, dry streak, convergence, and return distribution
- Pinned simulation baseline with change deltas
- Immutable configuration snapshots in local browser storage
- JSON export of a configuration and its simulation result
- Responsive desktop/mobile UI with a persistent compact HUD and reachable Spin button; redundant totem cards are hidden on phones because the board shows the same state

## Important design rule

The active configuration never changes silently. Admin edits are staged as **UNAPPLIED** until the user applies them. Applying a rule set resets the play session so results from incompatible models are not blended. Saved versions are immutable snapshots; changing a loaded version creates a new working draft.

## Default math profile

The v4 **base game** preset, including the lit-totem Board Blast/Fruit Sweep events, produced 95.35% over the documented 150,000-round `lab-baseline-01` development run (95% sampling estimate: ±0.99 points). The bonus currently contributes zero modeled value because its rules have not been defined. Any future bonus implementation will require taking value out of the base game and running a fresh full-game tune. This is a prototype target—not certification.

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
- `assets/renders/` — transparent PNGs rendered from Blender
- `blender/render_assets.py` — reproducible procedural asset generator
- `blender/*.blend` — editable Blender source scenes for every game component
- `tests/engine.test.mjs` — deterministic unit tests
- `tests/browser-smoke.mjs` — real-Chrome interaction and rendering test
- `previews/` — current desktop/mobile screenshots
