"""Exhaustive what-if graphs over whole supplied rows, not preference revision."""

from collections import deque
from .model import parse, outcomes


def analyze_scopes(request):
    names, tables = parse(request)
    states = outcomes(len(names))
    rows = []
    for i, (parents, table) in enumerate(tables):
        for context_index, want in enumerate(table):
            context = format(context_index, f"0{len(parents)}b") if parents else ""
            edges = []
            for s in states:
                if "".join(s[j] for j in parents) == context and int(s[i]) != want:
                    edges.append([s, s[:i] + str(want) + s[i + 1 :]])
            rows.append(
                dict(
                    row_id=len(rows),
                    variable=names[i],
                    context=context,
                    preferred=want,
                    edges=edges,
                )
            )
    if len(rows) > 8:
        raise ValueError(
            "Row-subset atlas supports at most eight complete conditional rows"
        )
    r = len(rows)
    records = []
    for mask in range(1 << r):
        edges = sorted(
            e for row in rows if mask >> row["row_id"] & 1 for e in row["edges"]
        )
        adj = {s: [] for s in states}
        for s, t in edges:
            adj[s].append(t)
        paths = {}
        for source in states:
            found = {}
            q = deque([[source]])
            while q:
                p = q.popleft()
                for t in adj[p[-1]]:
                    if t not in found:
                        found[t] = p + [t]
                        if t != source:
                            q.append(found[t])
            paths[source] = found
        cycles = [paths[s][s] for s in states if s in paths[s]]
        cycle = min(cycles, key=lambda p: (len(p), p)) if cycles else None
        order = None
        if cycle is None:
            remaining = set(states)
            order = []
            while remaining:
                s = next(
                    s
                    for s in states
                    if s in remaining
                    and not any(b == s and a in remaining for a, b in edges)
                )
                order.append(s)
                remaining.remove(s)
        records.append(
            dict(
                mask=mask,
                consistent=cycle is None,
                order=order,
                cycle=cycle,
                forward=paths[request["start"]].get(request["target"]),
                backward=paths[request["target"]].get(request["start"]),
            )
        )

    def minima(predicate):
        return [
            m
            for m in range(1 << r)
            if predicate(records[m])
            and all(
                not predicate(records[m ^ (1 << i)]) for i in range(r) if m >> i & 1
            )
        ]

    full = (1 << r) - 1
    withdrawals = sorted(
        full ^ m
        for m in range(1 << r)
        if records[m]["consistent"]
        and all(
            not records[m | 1 << i]["consistent"] for i in range(r) if not m >> i & 1
        )
    )
    return dict(
        schema="cpnetlab-row-subsets-v1",
        request=request,
        outcomes=states,
        rows=rows,
        subset_count=1 << r,
        consistent_subset_count=sum(x["consistent"] for x in records),
        subsets=records,
        minimal_forward_supports=minima(lambda x: x["forward"] is not None),
        minimal_backward_supports=minima(lambda x: x["backward"] is not None),
        minimal_conflicts=minima(lambda x: not x["consistent"]),
        minimal_withdrawals=withdrawals,
        minimum_withdrawal_size=min(bin(m).count("1") for m in withdrawals),
    )
