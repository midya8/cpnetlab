# CPNetLab

A ranking is not an entailed preference.

A dependency-free, bounded qualitative preference-network workbench. Complete
binary CP-nets define legal single-variable improving flips. CPNetLab computes
the complete outcome graph, every shortest positive-length reachability path,
actual inconsistency cycles and the exact number of compatible strict rankings.
For a consistent model, an incomparable pair gets two actual ranking witnesses,
one in each direction. Incomparability is not indifference.

## Controls that separate the claims

- The same two-variable dependency cycle can be consistent (four compatible
  rankings, two locally unimprovable outcomes) or inconsistent (an explicit
  four-flip cycle, zero rankings), depending on its preference rows.
- In the four-variable fanout control, `0000 → 1000` is a legal improving flip
  even though the number of violated rows rises from one to three. The model
  admits 2,304 strict rankings, all of which rank the target above the start.
- Two independent consistent dependency cycles leave `0000` and `1111`
  incomparable. The complete model has 101,977,088 compatible strict rankings.
- Empty, unconditional, chain and conditional-collider controls preserve their
  complete domains and rows. Empty means one empty outcome, not zero outcomes.

These are developed synthetic controls, not measured human choices.

## Run locally

Python 3.10+ and Node 22+ for browser tests. No runtime Python dependencies.

```sh
python -m pip install .
python -m cpnetlab analyze docs/example.json > evidence.json
python -m cpnetlab verify evidence.json
cpnetlab verify evidence.json
python -m unittest discover -s tests -v
node --test tests/test_engine.mjs
# Actual Chrome tests need google-chrome on PATH:
node --test tests/test_browser.cjs
# Serve docs using any static HTTP server:
python -m http.server --directory docs 8000
```

## Evidence and independence

Python builds flips from each conditional row, finds paths with breadth-first
search and counts compatible rankings by prefix-ideal subset DP. A separate
checker instead compares Hamming-one outcome pairs, uses Floyd-Warshall
closure/distances and suffix-removal subset recursion. It reconstructs the full
report, including all canonical paths and ranking witnesses. It imports no
analyzer or generator helpers. Shared input validation and binary outcome
encoding are disclosed. JavaScript uses BigInt for ranking counts, serialized
as exact decimal strings. Browser evidence is independently checked only when
the Python checker accepts the complete JSON.

Local checks currently include every one of the 36 two-variable networks and
all 576 ordered network/pair queries; all 40,320 permutations for each of five
three-variable fixtures; 160 seeded one-to-four-variable networks; malformed
inputs, forged evidence and disabled-generator verification. Eight control
reports agree exactly between Python and JavaScript on 61 outcomes and 100
edges. Actual Chrome checks 24 control reports at three widths and every one
of 689 ordered control-pair queries, plus export, stale clearing, invalid input
and cyclic/consistent recovery. Publication, installed/fresh-source reproduction,
CI, deployment and showcase gates are not yet complete.

## Scope

Zero to four binary variables, complete strict local rankings, no self parents.
No unknown conditional rows, local ties, constraints, uncertainty or learned
preferences. No cardinal utility or recommendation-quality claim. For an
inconsistent model there is no compatible strict ranking; reachability remains
a graph fact, but CPNetLab deliberately makes no vacuous preference verdict.
We use the standard strict-total-extension consistency contract, not extended
partial-model semantics. At most sixteen outcomes, exponential enumeration and
subset counting. This is established CP-net theory and standard graph/counting
methods, not a new algorithm or scalable solver.

See [CONTRACT.md](CONTRACT.md) and [SOURCES.md](SOURCES.md).
