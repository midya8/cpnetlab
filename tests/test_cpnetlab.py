import unittest, itertools, random, copy, json
from cpnetlab import analyze, verify
from cpnetlab.model import outcomes


def variable(name, parents=(), preferred=(1,)):
    return dict(name=name, parents=list(parents), preferred=list(preferred))


def request(variables, start=None, target=None):
    n = len(variables)
    return dict(
        variables=variables,
        start="0" * n if start is None else start,
        target="1" * n if target is None else target,
    )


def permutations_reference(report):
    states = report["outcomes"]
    edges = [e[:2] for e in report["edges"]]
    orders = []
    for order in itertools.permutations(states):
        pos = {s: i for i, s in enumerate(order)}
        if all(pos[a] < pos[b] for a, b in edges):
            orders.append(order)
    return orders


class CPNet(unittest.TestCase):
    def test_empty(self):
        a = analyze(request([]))
        self.assertEqual(a["total_order_count"], "1")
        self.assertEqual(a["order"], [""])
        self.assertEqual(a["query"]["relation"], "same")
        self.assertTrue(verify(a))

    def test_all_two_variable_networks_and_queries(self):
        opts = lambda name, other: (
            [variable(name, (), [v]) for v in [0, 1]]
            + [variable(name, [other], p) for p in itertools.product([0, 1], repeat=2)]
        )
        for A, B in itertools.product(opts("A", "B"), opts("B", "A")):
            a = analyze(request([A, B]))
            orders = permutations_reference(a)
            self.assertEqual(a["total_order_count"], str(len(orders)))
            self.assertEqual(a["consistent"], bool(orders))
            self.assertTrue(verify(a))
            for s, t in itertools.product(outcomes(2), repeat=2):
                r = analyze(request([A, B], s, t))
                self.assertTrue(verify(r))
                if orders and s != t:
                    forward = all(o.index(s) < o.index(t) for o in orders)
                    backward = all(o.index(t) < o.index(s) for o in orders)
                    self.assertEqual(r["query"]["forward"] is not None, forward)
                    self.assertEqual(r["query"]["backward"] is not None, backward)

    def test_dependency_cycle_not_inconsistency(self):
        good = request(
            [variable("A", ["B"], [0, 1]), variable("B", ["A"], [0, 1])], "01", "10"
        )
        a = analyze(good)
        self.assertFalse(a["dependency_acyclic"])
        self.assertTrue(a["consistent"])
        self.assertEqual(a["total_order_count"], "4")
        self.assertEqual(a["query"]["relation"], "incomparable")
        for key, order in a["query"]["order_witnesses"].items():
            self.assertIsNotNone(order)
        bad = copy.deepcopy(good)
        bad["variables"][1]["preferred"] = [1, 0]
        b = analyze(bad)
        self.assertFalse(b["consistent"])
        self.assertEqual(b["total_order_count"], "0")
        self.assertEqual(b["cycle"], ["00", "01", "11", "10", "00"])
        self.assertEqual(b["query"]["relation"], "inconsistent")
        self.assertTrue(verify(b))

    def test_three_variable_all_rankings(self):
        fixtures = [
            request([variable("A"), variable("B"), variable("C")]),
            request(
                [
                    variable("A"),
                    variable("B", ["A"], [0, 1]),
                    variable("C", ["B"], [0, 1]),
                ]
            ),
            request(
                [variable("A"), variable("B"), variable("C", ["A", "B"], [0, 1, 1, 0])]
            ),
            request(
                [
                    variable("A", ["B"], [0, 1]),
                    variable("B", ["A"], [0, 1]),
                    variable("C"),
                ]
            ),
            request(
                [
                    variable("A", ["B"], [0, 1]),
                    variable("B", ["A"], [1, 0]),
                    variable("C"),
                ]
            ),
        ]
        for r in fixtures:
            a = analyze(r)
            orders = permutations_reference(a)
            self.assertEqual(a["total_order_count"], str(len(orders)))
            self.assertEqual(a["order"], list(min(orders)) if orders else None)
            self.assertTrue(verify(a))
            if orders:
                for i, s in enumerate(a["outcomes"]):
                    for j, t in enumerate(a["outcomes"]):
                        if s != t:
                            self.assertEqual(
                                a["paths"][i][j] is not None,
                                all(o.index(s) < o.index(t) for o in orders),
                            )

    def test_seeded_networks(self):
        rng = random.Random(2811)
        for n in [1, 2, 3, 4]:
            names = list("ABCD"[:n])
            for _ in range(40):
                vs = []
                for name in names:
                    ps = [p for p in names if p != name and rng.randrange(2)]
                    vs.append(
                        variable(
                            name, ps, [rng.randrange(2) for _ in range(2 ** len(ps))]
                        )
                    )
                a = analyze(request(vs))
                self.assertTrue(verify(a))
                for i, s in enumerate(a["outcomes"]):
                    cut = set(a["reach"][i])
                    self.assertTrue(
                        all(t in cut for u, t, *_ in a["edges"] if u in cut)
                    )
                if a["consistent"]:
                    pos = {s: i for i, s in enumerate(a["order"])}
                    self.assertTrue(all(pos[s] < pos[t] for s, t, *_ in a["edges"]))
                else:
                    self.assertEqual(a["cycle"][0], a["cycle"][-1])
                    self.assertTrue(
                        all(
                            any(e[0] == s and e[1] == t for e in a["edges"])
                            for s, t in zip(a["cycle"], a["cycle"][1:])
                        )
                    )

    def test_forgery(self):
        a = analyze(request([variable("A"), variable("B", ["A"], [0, 1])]))
        mutations = [
            lambda r: r.update(total_order_count="999"),
            lambda r: r.update(consistent=1),
            lambda r: r.update(dependency_acyclic=1),
            lambda r: r.update(extra=1),
            lambda r: r["edges"].pop(),
            lambda r: r["paths"][0].__setitem__(3, None),
            lambda r: r["reach"][0].clear(),
            lambda r: r["order"].reverse(),
            lambda r: r["query"].update(relation="incomparable"),
            lambda r: r["query"]["order_witnesses"].update(target_above_start=["00"]),
        ]
        for change in mutations:
            r = copy.deepcopy(a)
            change(r)
            self.assertFalse(verify(r))

    def test_bad_inputs(self):
        valid = request([variable("A")])
        cases = [
            None,
            {},
            dict(valid, extra=1),
            request([variable("A", (), [True])]),
            request([variable("A", ["A"], [0, 1])]),
            request([variable("A", ["B"], [0, 1])]),
            request([variable("B"), variable("A")]),
            request([variable("A"), variable("A")]),
            request([variable("A", (), [0, 1])]),
            dict(valid, start="2"),
            dict(valid, start=0),
            dict(valid, target=True),
            request([variable(x) for x in "ABCDE"]),
        ]
        for r in cases:
            with self.assertRaises(ValueError):
                analyze(r)

    def test_generator_disabled(self):
        import cpnetlab.core

        a = analyze(request([variable("A")]))
        old = cpnetlab.core.analyze
        cpnetlab.core.analyze = lambda _: (_ for _ in ()).throw(
            AssertionError("generator called")
        )
        try:
            self.assertTrue(verify(a))
        finally:
            cpnetlab.core.analyze = old


if __name__ == "__main__":
    unittest.main()
