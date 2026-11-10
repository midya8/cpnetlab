"""Explicit flip graph and prefix-ideal count; bounded exact, not scalable."""

from collections import deque
from functools import lru_cache
from .model import parse, outcomes


def _orders(vertices, edges):
    index = {s: i for i, s in enumerate(vertices)}
    N = len(vertices)
    prereq = [0] * N
    for a, b, *_ in edges:
        prereq[index[b]] |= 1 << index[a]

    @lru_cache(None)
    def count(mask):
        if mask == (1 << N) - 1:
            return 1
        return sum(
            count(mask | 1 << i)
            for i in range(N)
            if not (mask >> i & 1) and prereq[i] & mask == prereq[i]
        )

    total = count(0)
    if not total:
        return "0", None
    order = []
    mask = 0
    while len(order) < N:
        i = next(
            i
            for i in range(N)
            if not (mask >> i & 1)
            and prereq[i] & mask == prereq[i]
            and count(mask | 1 << i)
        )
        order.append(vertices[i])
        mask |= 1 << i
    return str(total), order


def analyze(request):
    names, rows = parse(request)
    states = outcomes(len(names))
    edges = []
    for s in states:
        for i, (parents, preferred) in enumerate(rows):
            context = "".join(s[j] for j in parents)
            want = preferred[int(context, 2) if context else 0]
            if int(s[i]) != want:
                t = s[:i] + str(want) + s[i + 1 :]
                edges.append([s, t, names[i], context, want])
    edges.sort()
    adj = {s: [] for s in states}
    for s, t, *_ in edges:
        adj[s].append(t)
    paths = []
    reach = []
    for source in states:
        found = {}
        queue = deque([[source]])
        while queue:
            p = queue.popleft()
            for t in adj[p[-1]]:
                if t not in found:
                    found[t] = p + [t]
                    if t != source:
                        queue.append(found[t])
        paths.append([found.get(t) for t in states])
        reach.append([t for t in states if t in found])
    cycles = [paths[i][i] for i in range(len(states)) if paths[i][i]]
    cycle = min(cycles, key=lambda p: (len(p), p)) if cycles else None
    count, order = _orders(states, edges)
    deps = {name: set() for name in names}
    for name, (ps, _) in zip(names, rows):
        deps[name] = {names[i] for i in ps}
    done = set()
    while True:
        ready = {n for n in names if n not in done and deps[n] <= done}
        if not ready:
            break
        done |= ready
    start, target = request["start"], request["target"]
    a = states.index(start)
    b = states.index(target)
    forward = paths[a][b]
    back = paths[b][a]
    relation = (
        "inconsistent"
        if cycle
        else "same"
        if a == b
        else "target-dominates"
        if forward
        else "start-dominates"
        if back
        else "incomparable"
    )
    witnesses = {}
    for key, edge in [
        ("target_above_start", [start, target]),
        ("start_above_target", [target, start]),
    ]:
        witnesses[key] = None if cycle or a == b else _orders(states, edges + [edge])[1]
    return dict(
        schema="cpnetlab-v1",
        request=request,
        outcomes=states,
        edges=edges,
        dependency_acyclic=len(done) == len(names),
        consistent=cycle is None,
        total_order_count=count,
        order=order,
        cycle=cycle,
        reach=reach,
        paths=paths,
        violations=[len(adj[s]) for s in states],
        sinks=[s for s in states if not adj[s]],
        query=dict(
            relation=relation, forward=forward, backward=back, order_witnesses=witnesses
        ),
    )
