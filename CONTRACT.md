# Exact finite preference contract

Input has exactly `variables`, `start`, `target`. Variables are sorted by unique
uppercase identifier; each row has exactly `name`, `parents`, `preferred`.
Parents are sorted, unique, known identifiers, excluding the variable itself.
At most four variables. Each preferred array has exactly 2^parent_count entries,
integer 0 or 1, in lexicographic parent-bit order. Booleans are not integers.
Outcomes are fixed-length binary strings in variable order. The zero-variable
model has the single empty-string outcome.

Every local statement compares two outcomes differing in exactly that variable,
with all other values fixed. Edge direction is less to more preferred.
`violations` counts outgoing edges, not cardinal loss. A sink has no outgoing
edge; this alone is not preference over every outcome.

A strict compatible total ranking is a permutation of every outcome with the
source of every improving edge before its target. The ranking count is an exact
decimal string, and ranking witnesses run from least to most preferred. There
is a compatible strict ranking iff the outcome graph is acyclic. Dependency
acyclicity is computed separately; cyclic dependencies can induce an acyclic
outcome graph.

`paths[i][j]` is the lexicographically first shortest positive-length path from
outcome i to outcome j, or null. Identity is not a zero-length preference proof.
A diagonal path exists only when an improving cycle returns to that outcome.
`reach[i]` contains exactly the destinations of positive-length paths, in outcome
order. Adding the starting outcome gives a forward-closed cut; if target lies
outside, no improving path can reach it. The canonical inconsistency witness
is the shortest diagonal path over all states, breaking ties lexicographically.

In a consistent model, nonidentity target dominance holds iff an improving path
runs from start to target. If neither direction has a path, both strict ranking
directions are compatible; witnesses demonstrate this without claiming human
indifference. For identical outcomes, neither strict ranking direction is
allowed. In an inconsistent model, compatible-ranking witnesses are null,
the count is zero and the query verdict is `inconsistent`, even when graph
paths exist in one or both directions. This avoids vacuous entailment claims.

The report's full request, domain, edges with local contexts, dependency flag,
consistency, exact count, first ranking, canonical cycle, complete reachability,
complete canonical paths, violation counts, sinks and query witnesses are
reconstructed by the independent checker and compared as strict canonical
JSON. Unknown keys, boolean/int substitutions and altered orderings fail.
Shared syntax validation and binary outcome encoding are explicit.

No cardinal utilities, weak ties, constraints, probabilistic/learned preferences
or extended cyclic partial-model semantics are implemented. Complete state
space and ideal counting are exponential. Four variables is a deliberate cap.
