# Whole-row counterfactual graphs

`cpnetlab scopes request.json > rows.json` builds a complete row-subset atlas.
`cpnetlab verify-scopes rows.json` reconstructs and checks it independently.
The complete-model `analyze` and `verify` commands are unchanged.

## What is withdrawn

Input is the same complete binary model as CONTRACT.md, with an additional
limit of eight complete conditional table rows across all variables. Zero rows
are allowed. A row consists of one variable, one complete assignment to its
parents and its strict local preferred value. Row IDs use sorted variables and
lexicographic parent contexts, with bit i representing row i. A retained mask
keeps that row's entire group of improving flips, including every combination
of nonparent variables. Every outcome remains in every counterfactual graph.

Withdrawal is not an edge reversal, indifference, an outcome deletion, a new
complete CP-net or an automatic preference revision. The supplied complete model
is not changed. These are graph subsets of its explicit strict constraints.
We do not implement Brafman's extended semantics for partial/cyclic models.
No row has an importance, probability, learned score or revision recommendation.

## Every subset, not selected examples

Schema `cpnetlab-row-subsets-v1` contains the original request, outcome domain,
all row descriptors with complete edge groups, all masks from 0 to 2^r-1,
consistent-subset count and four complete inclusion-minimal antichains:

- Forward and backward supports retain the rows needed for a positive-length
  improving path for the fixed supplied query, in the respective direction.
- Conflicts retain an inconsistent group of whole rows.
- Withdrawals remove rows from the complete mask to make the remaining graph
  consistent. These are complements of maximal consistent retained masks.

Each subset records consistency, the lexicographically first least-to-most
compatible total order if consistent, the shortest lexicographic improving
cycle if inconsistent, and canonical shortest positive-length query paths.
The paths remain graph facts in an inconsistent graph. We make no vacuous
strict-preference entailment claim there. A self-query requires a positive
cycle, never a zero-step identity path. No subset ranking count is calculated.

Minimal means no proper subset has the same property. It does not mean minimum
cardinality. The additional `minimum_withdrawal_size` distinguishes that case.
All minimal withdrawals are exactly the minimal hitting sets of all minimal
conflicts. With no conflicts, the sole minimal withdrawal is the empty set,
size zero. The empty retained mask has no edges and a compatible total order;
zero variables still means one empty outcome. An absent path is null.

## Controlled contrasts

Eight developed synthetic controls cover 865 total row subsets. The default
three-variable, eight-row model has two minimal conflicts (masks 195 and 246),
238 consistent masks out of 256 and six minimal withdrawals: 2, 5, 17, 33, 64, 128. Three withdrawals have size one and three have size two; every one is
inclusion-minimal. Choosing an irreducible withdrawal does not imply choosing
a smallest withdrawal, and neither implies a sensible human preference change.

The detour-support model has minimal forward supports 5 and 54. They contain
two and four rows and supply two- and four-edge paths respectively. It is not
valid to discard the larger support simply because another support is smaller.
Two disjoint conflicts also show that hitting just one conflict need not restore
consistency. Empty, fanout, consistent-cycle, inconsistent-cycle and collider
controls preserve the original complete model and all unconstrained outcomes.
These examples are constructed, not empirical data or measured human choices.

## Reconstruction and checks

The Python generator constructs every edge from a supplied conditional row,
finds paths with breadth-first search and tests immediate predecessor masks
for upward-monotone path/inconsistency predicates. It finds maximal consistent
masks by testing every immediate supermask. The independent checker instead
labels directed Hamming-one outcome pairs with row IDs, computes Floyd-Warshall
distances, reconstructs canonical paths greedily and tests all proper candidate
subsets for each antichain. Both independently build topological order witnesses.
It imports neither generator nor complete-model analyzer. Shared strict input
validation and outcome encoding are disclosed. Exact JSON structure and values
are required, including type distinctions, arrays, additional fields and nulls.

Browser JavaScript uses the base analyzer's validated complete graph and row
edges, then constructs every mask independently within that implementation.
It is not the independent verifier. Downloaded browser evidence is independently
checked only when Python `verify-scopes` accepts the complete report.

Tests compare all 36 two-variable networks' 400 row masks with all 24 possible
total orders, including both query directions. Eight complete atlases agree
between Python and JavaScript and are accepted by the independent checker.
All 576 ordered two-variable query atlases (6,400 subset records) are accepted
by the independent checker, including positive self-cycle paths. Every reported path and ranking is checked against its exact retained-row edges;
minimal hitting-set duality is exhaustively checked. Seeded one-to-four-variable
models (91 accepted from 100 seeded attempts), type/field/edge/antichain forgeries, disabled-generator checks, row-limit
rejection and installed module/console execution outside the checkout are
included. Chrome selects every one of the 865 control masks, every antichain
button, every row checkbox, all eight exports, and stale/invalid/limit recovery;
all eight controls are checked at 1280, 390 and 320 pixels. The complete-model
checks remain in CI. Local success is not proof of deployed success.

Bounds are explicit: at most four binary variables, sixteen outcomes and eight
complete rows (256 subsets). Enumeration and antichain comparison are
exponential. This is an exact teaching implementation of established graph and
minimal-conflict concepts, not a scalable diagnosis solver or new algorithm.
See SOURCES.md, including the explanation survey, for prior work and boundaries.
