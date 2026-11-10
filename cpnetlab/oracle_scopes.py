"""Independent row atlas: Hamming pairs, Floyd paths, all-proper-subset tests."""

import json
from .model import parse, outcomes


def expected_scopes(request):
    names, tables = parse(request)
    states = outcomes(len(names))
    descriptors = []
    offsets = []
    for i, (ps, table) in enumerate(tables):
        offsets.append(len(descriptors))
        for c, want in enumerate(table):
            descriptors.append(
                dict(
                    row_id=len(descriptors),
                    variable=names[i],
                    context=format(c, f"0{len(ps)}b") if ps else "",
                    preferred=want,
                    edges=[],
                )
            )
    R = len(descriptors)
    if R > 8:
        raise ValueError(
            "Row-subset atlas supports at most eight complete conditional rows"
        )
    labelled = []
    for a, s in enumerate(states):
        for b, t in enumerate(states):
            diff = [i for i in range(len(names)) if s[i] != t[i]]
            if len(diff) != 1:
                continue
            i = diff[0]
            ps, table = tables[i]
            context = "".join(s[j] for j in ps)
            c = int(context, 2) if context else 0
            if int(t[i]) == table[c]:
                label = offsets[i] + c
                labelled.append((a, b, label))
                descriptors[label]["edges"].append([s, t])
    for row in descriptors:
        row["edges"].sort()
    N = len(states)
    records = []
    for mask in range(1 << R):
        pairs = [(a, b) for a, b, r in labelled if mask & 1 << r]
        inf = N * N + 1
        d = [[inf] * N for _ in states]
        for a, b in pairs:
            d[a][b] = 1
        for k in range(N):
            for a in range(N):
                for b in range(N):
                    d[a][b] = min(d[a][b], d[a][k] + d[k][b])

        def path(a, b):
            left = d[a][b]
            if left >= inf:
                return None
            out = [states[a]]
            while left:
                a = min(
                    v
                    for u, v in pairs
                    if u == a and (left == 1 and v == b or d[v][b] == left - 1)
                )
                out.append(states[a])
                left -= 1
            return out

        cycles = [path(i, i) for i in range(N) if d[i][i] < inf]
        cycle = min(cycles, key=lambda p: (len(p), p)) if cycles else None
        order = None
        if not cycles:
            chosen = []
            for _ in range(N):
                i = next(
                    i
                    for i in range(N)
                    if i not in chosen and all(a in chosen for a, b in pairs if b == i)
                )
                chosen.append(i)
            order = [states[i] for i in chosen]
        a, b = states.index(request["start"]), states.index(request["target"])
        records.append(
            dict(
                mask=mask,
                consistent=not cycles,
                order=order,
                cycle=cycle,
                forward=path(a, b),
                backward=path(b, a),
            )
        )

    def minimal(candidates):
        return [
            m for m in candidates if not any(n != m and n & m == n for n in candidates)
        ]

    full = (1 << R) - 1
    withdrawals = sorted(
        minimal([full ^ x["mask"] for x in records if x["consistent"]])
    )
    return dict(
        schema="cpnetlab-row-subsets-v1",
        request=request,
        outcomes=states,
        rows=descriptors,
        subset_count=1 << R,
        consistent_subset_count=sum(1 for x in records if x["consistent"]),
        subsets=records,
        minimal_forward_supports=minimal(
            [x["mask"] for x in records if x["forward"] is not None]
        ),
        minimal_backward_supports=minimal(
            [x["mask"] for x in records if x["backward"] is not None]
        ),
        minimal_conflicts=minimal([x["mask"] for x in records if not x["consistent"]]),
        minimal_withdrawals=withdrawals,
        minimum_withdrawal_size=min(bin(m).count("1") for m in withdrawals),
    )


def verify_scopes(report):
    try:
        return json.dumps(report, sort_keys=True, separators=(",", ":")) == json.dumps(
            expected_scopes(report["request"]), sort_keys=True, separators=(",", ":")
        )
    except (ValueError, TypeError, KeyError, IndexError, OverflowError):
        return False
