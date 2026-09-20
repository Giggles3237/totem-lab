# Totem Lab Math Model

## One base round

A base round currently consists of one paid cascade spin. The undefined bonus is recorded as a trigger but is not executed or assigned value.

1. Deduct one configured bet.
2. Fill the 7×9 default grid from weighted regular symbols plus the configured Wild weight, preserving four static totem cells inset one space from each corner.
3. A cluster orthogonally adjacent to a dormant totem may light it. A lit totem becomes a static Wild for the remainder of that spin.
4. Find orthogonally connected clusters meeting the minimum size.
5. Pay each accepted cluster, clear it, collapse downward, and refill.
6. Increase the cascade multiplier and repeat until no win or the maximum cascade count.
7. Totem state is binary and resets at the start of every paid spin.
8. Lighting all four totems during one spin emits a bonus trigger. No bonus return is modeled yet.
9. Cap the base-spin return at the configured round maximum.

## Cluster payout

For a cluster:

`bet × symbol pay × cluster size × size tier × cascade multiplier`

- `symbol pay` is editable per symbol.
- `size tier` rises every three cells above the minimum cluster size.
- `cascade multiplier` starts at 1× and rises by 0.25× after each winning cascade.

Wilds connect to any regular symbol. Candidate clusters are evaluated largest-first; shared Wild cells are assigned only once so the same cell cannot be paid in multiple clusters.

## Totems

The four totems occupy fixed board cells at `(1,1)`, `(1,columns−2)`, `(rows−2,1)`, and `(rows−2,columns−2)` using zero-based coordinates. This creates a one-symbol border around every corner totem. Gravity resolves independently in each column segment above and below a totem, so symbols never replace or pass through the station.

An orthogonally adjacent cluster checks the configurable wake probability. Once lit, the totem cell acts as a Wild in later cascades. All four totems have exactly the same mechanical effect; their names and artwork are cosmetic.

## Bonus model

- Lighting all four totems during one paid spin emits `bonus-pending`.
- The simulator records trigger frequency, but adds no spins, modifiers, symbol removals, retriggers, or bonus return.
- Bonus contribution and average bonus are reported as pending in the UI.
- Defining the bonus later will change full-game RTP and require a new tune.

## Reported metrics

- **RTP:** current base-game return / total paid-spin wagers. It excludes undefined bonus value.
- **95% estimate:** `1.96 × sample standard deviation / √rounds`, expressed in RTP percentage points. It describes sampling error under the simulated model; it is not a certification interval.
- **Hit rate:** base rounds returning more than zero.
- **Bonus frequency:** base rounds divided by bonuses triggered.
- **Bonus contribution:** pending until bonus rules and return are defined.
- **Volatility σ:** standard deviation of round returns measured in bet multiples.
- **Average bonus:** pending until bonus rules and return are defined.
- **Max round:** largest base-spin return observed, subject to the configured cap.
- **Longest dry streak:** longest consecutive run of zero-return base rounds.

## Reproducibility

The engine uses a seeded xorshift32 generator. A configuration plus seed reproduces the same sequence. This makes individual sessions and Monte Carlo comparisons debuggable, but xorshift32 is **not** a certified gambling RNG and must never be represented as one.

## Interpreting experiments

Change one concept at a time, save a snapshot, and use the same simulation seed for comparison. A shared seed reduces noise when measuring the effect of a rule change. Large behavior changes—especially Wild frequency, grid dimensions, cluster threshold, and the eventual bonus—should be tested with at least several hundred thousand rounds.
