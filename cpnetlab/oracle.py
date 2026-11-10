"""Independent reconstruction: Hamming pairs, Floyd closure, suffix-order DP."""

import json
from functools import lru_cache
from .model import parse, outcomes


def _ranking(states, pairs):
    n = len(states)
    successors = [set() for _ in states]
    for a, b in pairs:
        successors[a].add(b)

    @lru_cache(None)
    def ways(remaining):
        if not remaining:
            return 1
        return sum(
            ways(remaining & ~(1 << i))
            for i in range(n)
            if remaining >> i & 1 and not any(remaining >> j & 1 for j in successors[i])
        )

    count = ways((1 << n) - 1)
    if not count:
        return "0", None
    # Lexicographically first least-to-most order, verified by suffix counts.
    predecessors = [{a for a, b in pairs if b == i} for i in range(n)]
    remaining = (1 << n) - 1
    order = []
    while remaining:
        i = next(
            i
            for i in range(n)
            if remaining >> i & 1
            and not any(remaining >> j & 1 for j in predecessors[i])
            and ways(remaining & ~(1 << i))
        )
        order.append(states[i])
        remaining &= ~(1 << i)
    return str(count), order


def expected(request):
    names, rows = parse(request)
    states = outcomes(len(names))
    N = len(states)
    edges = []
    pairs = []
    for a, s in enumerate(states):
        for b, t in enumerate(states):
            changed = [i for i in range(len(names)) if s[i] != t[i]]
            if len(changed) != 1:
                continue
            i = changed[0]
            ps, table = rows[i]
            context = "".join(t[j] for j in ps)
            if int(t[i]) == table[int(context, 2) if context else 0]:
                pairs.append((a, b))
                edges.append([s, t, names[i], context, int(t[i])])
    edges.sort()
    dist = [[N * N] * N for _ in states]
    for a, b in pairs:
        dist[a][b] = 1
    for k in range(N):
        for i in range(N):
            for j in range(N):
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])

    def path(a, b):
        d = dist[a][b]
        if d >= N * N:
            return None
        result = [states[a]]
        cur = a
        while d:
            nxt = min(
                j
                for i, j in pairs
                if i == cur and (j == b and d == 1 or dist[j][b] == d - 1)
            )
            result.append(states[nxt])
            cur = nxt
            d -= 1
        return result

    paths = [[path(a, b) for b in range(N)] for a in range(N)]
    cycles = [paths[i][i] for i in range(N) if paths[i][i]]
    cycle = min(cycles, key=lambda p: (len(p), p)) if cycles else None
    # Dependency reachability is separate from outcome reachability.
    dep = [[False] * len(names) for _ in names]
    for i, (ps, _) in enumerate(rows):
        for p in ps:
            dep[p][i] = True
    for k in range(len(names)):
        for i in range(len(names)):
            for j in range(len(names)):
                dep[i][j] |= dep[i][k] and dep[k][j]
    count, order = _ranking(states, pairs)
    a = states.index(request["start"])
    b = states.index(request["target"])
    f = paths[a][b]
    back = paths[b][a]
    relation = (
        "inconsistent"
        if cycle
        else "same"
        if a == b
        else "target-dominates"
        if f
        else "start-dominates"
        if back
        else "incomparable"
    )
    witnesses = {
        key: None if cycle or a == b else _ranking(states, pairs + [(u, v)])[1]
        for key, u, v in [("target_above_start", a, b), ("start_above_target", b, a)]
    }
    return dict(
        schema="cpnetlab-v1",
        request=request,
        outcomes=states,
        edges=edges,
        dependency_acyclic=not any(dep[i][i] for i in range(len(names))),
        consistent=cycle is None,
        total_order_count=count,
        order=order,
        cycle=cycle,
        reach=[[states[j] for j in range(N) if dist[i][j] < N * N] for i in range(N)],
        paths=paths,
        violations=[sum(a == i for a, b in pairs) for i in range(N)],
        sinks=[states[i] for i in range(N) if not any(a == i for a, b in pairs)],
        query=dict(
            relation=relation, forward=f, backward=back, order_witnesses=witnesses
        ),
    )


def verify(report):
    try:
        return json.dumps(report, sort_keys=True, separators=(",", ":")) == json.dumps(
            expected(report["request"]), sort_keys=True, separators=(",", ":")
        )
    except (ValueError, TypeError, KeyError, IndexError, OverflowError):
        return False
