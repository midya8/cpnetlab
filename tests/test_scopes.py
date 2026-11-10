import unittest, itertools, json, copy, random
from pathlib import Path
from cpnetlab.scopes import analyze_scopes
from cpnetlab.oracle_scopes import verify_scopes
from cpnetlab import analyze
from test_cpnetlab import variable, request, permutations_reference


class Scopes(unittest.TestCase):
    def test_all_two_variable_row_subsets(self):
        opts = lambda name, other: (
            [variable(name, (), [v]) for v in [0, 1]]
            + [variable(name, [other], p) for p in itertools.product([0, 1], repeat=2)]
        )
        count = 0
        for A, B in itertools.product(opts("A", "B"), opts("B", "A")):
            atlas = analyze_scopes(request([A, B]))
            self.assertTrue(verify_scopes(atlas))
            for sub in atlas["subsets"]:
                count += 1
                edges = [
                    e
                    for r in atlas["rows"]
                    if sub["mask"] >> r["row_id"] & 1
                    for e in r["edges"]
                ]
                orders = permutations_reference(
                    {"outcomes": atlas["outcomes"], "edges": edges}
                )
                self.assertEqual(sub["consistent"], bool(orders))
                self.assertEqual(sub["order"], list(min(orders)) if orders else None)
                for field, s, t in [("forward", "00", "11"), ("backward", "11", "00")]:
                    if orders:
                        self.assertEqual(
                            sub[field] is not None,
                            all(o.index(s) < o.index(t) for o in orders),
                        )
        self.assertEqual(count, 400)

    def test_eight_controls_complete_and_hitting_duality(self):
        controls = json.loads(Path("docs/row-controls.json").read_text())
        total = 0
        for c in controls:
            a = analyze_scopes(c["request"])
            self.assertTrue(verify_scopes(a))
            total += a["subset_count"]
            base = analyze(c["request"])
            full = a["subsets"][-1]
            for k in ["consistent", "order", "cycle"]:
                self.assertEqual(full[k], base[k])
            for k in ["forward", "backward"]:
                self.assertEqual(full[k], base["query"][k])
            conflicts = a["minimal_conflicts"]
            hits = [
                m for m in range(a["subset_count"]) if all(m & c for c in conflicts)
            ]
            minimal = [m for m in hits if not any(n != m and n & m == n for n in hits)]
            self.assertEqual(a["minimal_withdrawals"], minimal)
            for sub in a["subsets"]:
                edges = [
                    e
                    for row in a["rows"]
                    if sub["mask"] >> row["row_id"] & 1
                    for e in row["edges"]
                ]
                if sub["consistent"]:
                    self.assertEqual(set(sub["order"]), set(a["outcomes"]))
                    pos = {s: i for i, s in enumerate(sub["order"])}
                    self.assertTrue(all(pos[s] < pos[t] for s, t in edges))
                for p in [sub["cycle"], sub["forward"], sub["backward"]]:
                    if p:
                        self.assertTrue(all([s, t] in edges for s, t in zip(p, p[1:])))
        self.assertEqual(total, 865)

    def test_minimal_is_not_minimum(self):
        cs = {
            c["id"]: c for c in json.loads(Path("docs/row-controls.json").read_text())
        }
        a = analyze_scopes(cs["unequal-withdrawals"]["request"])
        self.assertEqual(a["minimal_conflicts"], [195, 246])
        self.assertEqual(a["minimal_withdrawals"], [2, 5, 17, 33, 64, 128])
        self.assertEqual(a["minimum_withdrawal_size"], 1)
        self.assertEqual(
            sorted(m.bit_count() for m in a["minimal_withdrawals"]), [1, 1, 1, 2, 2, 2]
        )
        b = analyze_scopes(cs["detour-support"]["request"])
        self.assertEqual(b["minimal_forward_supports"], [5, 54])
        self.assertEqual([m.bit_count() for m in b["minimal_forward_supports"]], [2, 4])
        self.assertEqual(
            [
                len(b["subsets"][m]["forward"]) - 1
                for m in b["minimal_forward_supports"]
            ],
            [2, 4],
        )

    def test_seeded_models(self):
        rng = random.Random(883)
        accepted = 0
        for n in [1, 2, 3, 4]:
            for _ in range(25):
                vs = []
                for name in "ABCD"[:n]:
                    ps = [p for p in "ABCD"[:n] if p != name and rng.randrange(4) == 0]
                    vs.append(
                        variable(
                            name, ps, [rng.randrange(2) for _ in range(1 << len(ps))]
                        )
                    )
                if sum(len(v["preferred"]) for v in vs) <= 8:
                    accepted += 1
                    self.assertTrue(verify_scopes(analyze_scopes(request(vs))))
        self.assertEqual(accepted, 91)

    def test_limits_and_forgery(self):
        with self.assertRaises(ValueError):
            analyze_scopes(
                request(
                    [
                        variable("A", ["B", "C", "D"], [0] * 8),
                        variable("B"),
                        variable("C"),
                        variable("D"),
                    ]
                )
            )
        a = analyze_scopes(request([variable("A"), variable("B")]))
        changes = [
            lambda r: r.update(subset_count=True),
            lambda r: r.update(extra=1),
            lambda r: r.update(minimal_withdrawals=[]),
            lambda r: r["rows"][0]["edges"].clear(),
            lambda r: r["subsets"][0].update(consistent=1),
            lambda r: r["subsets"][-1]["order"].reverse(),
            lambda r: r["subsets"][-1].update(forward=None),
            lambda r: r.update(minimal_forward_supports=[0]),
        ]
        for f in changes:
            r = copy.deepcopy(a)
            f(r)
            self.assertFalse(verify_scopes(r))

    def test_disabled_generator(self):
        import cpnetlab.scopes, cpnetlab.core

        a = analyze_scopes(request([variable("A")]))
        old, old2 = cpnetlab.scopes.analyze_scopes, cpnetlab.core.analyze

        def fail(_):
            raise AssertionError("generator called")

        cpnetlab.scopes.analyze_scopes = cpnetlab.core.analyze = fail
        try:
            self.assertTrue(verify_scopes(a))
        finally:
            cpnetlab.scopes.analyze_scopes, cpnetlab.core.analyze = old, old2
