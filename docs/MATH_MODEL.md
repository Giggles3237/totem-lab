# Totem Lab Math Model

## One base round

A base round consists of one paid spin plus every free spin it triggers. RTP and hit rate use the base round as the denominator, which avoids treating awarded free spins as additional wagers.

1. Deduct one configured bet.
2. Fill the grid from weighted regular symbols plus the configured Wild weight.
3. Optionally trigger one guardian.
4. Find orthogonally connected clusters meeting the minimum size.
5. Pay each accepted cluster, clear it, collapse downward, and refill.
6. Increase the cascade multiplier and repeat until no win or the maximum cascade count.
7. Charge guardians persistently across base rounds.
8. Waking all four guardians awards free spins and resets their charge.
9. Cap the combined base-plus-bonus return at the configured round maximum.

## Cluster payout

For a cluster:

`bet × symbol pay × cluster size × size tier × cascade multiplier`

- `symbol pay` is editable per symbol.
- `size tier` rises every three cells above the minimum cluster size.
- `cascade multiplier` starts at 1× and rises by 0.25× after each winning cascade.
- A multiplier guardian can add an initial cascade boost.

Wilds connect to any regular symbol. Candidate clusters are evaluated largest-first; shared Wild cells are assigned only once so the same cell cannot be paid in multiple clusters.

## Guardians

Each spin has a configurable guardian-trigger probability. Sleeping guardians are selected before already-awake guardians.

- **Vine:** clears and refills one random row.
- **Ember:** collects one of the three lowest-paying regular symbols currently visible.
- **Moon:** converts random cells to Wilds.
- **Storm:** adds to the starting cascade multiplier.

The effect strengths, trigger chance, and charge threshold are editable.

## Bonus model

- Free spins do not add to wagered credits.
- Guardian trigger chance is multiplied by the configured bonus boost.
- Winning regular symbols fill a symbol-specific progress meter.
- Reaching the removal threshold removes that symbol from future bonus refills.
- At least two regular symbols always remain available.
- Guardians can retrigger the bonus; an independent random retrigger is also configurable.
- Symbol removals and progress reset when the bonus ends.

## Reported metrics

- **RTP:** total paid / total base wagers.
- **95% estimate:** `1.96 × sample standard deviation / √rounds`, expressed in RTP percentage points. It describes sampling error under the simulated model; it is not a certification interval.
- **Hit rate:** base rounds returning more than zero.
- **Bonus frequency:** base rounds divided by bonuses triggered.
- **Bonus contribution:** bonus return as a share of total return.
- **Volatility σ:** standard deviation of round returns measured in bet multiples.
- **Average bonus:** bonus return divided by bonuses triggered.
- **Max round:** largest base-plus-bonus return observed, subject to the configured cap.
- **Longest dry streak:** longest consecutive run of zero-return base rounds.

## Reproducibility

The engine uses a seeded xorshift32 generator. A configuration plus seed reproduces the same sequence. This makes individual sessions and Monte Carlo comparisons debuggable, but xorshift32 is **not** a certified gambling RNG and must never be represented as one.

## Interpreting experiments

Change one concept at a time, save a snapshot, and use the same simulation seed for comparison. A shared seed reduces noise when measuring the effect of a rule change. Large behavior changes—especially symbol removal, Wild frequency, grid dimensions, and cluster threshold—should be tested with at least several hundred thousand rounds.

