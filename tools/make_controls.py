import json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cpnetlab import analyze

v = lambda n, p=(), q=(1,): dict(name=n, parents=list(p), preferred=list(q))
fixtures = [
    ("empty", "No variables, one outcome", [], "", ""),
    (
        "independent",
        "Independent choices: incomparable is not indifferent",
        [v("A"), v("B")],
        "01",
        "10",
    ),
    (
        "chain",
        "A valid path is not a violation-score drop",
        [v("A"), v("B", ["A"], [0, 1]), v("C", ["B"], [0, 1])],
        "000",
        "100",
    ),
    (
        "consistent-cycle",
        "Cyclic dependencies, consistent preferences",
        [v("A", ["B"], [0, 1]), v("B", ["A"], [0, 1])],
        "01",
        "10",
    ),
    (
        "inconsistent-cycle",
        "Same dependency cycle, inconsistent preferences",
        [v("A", ["B"], [0, 1]), v("B", ["A"], [1, 0])],
        "00",
        "11",
    ),
    (
        "fanout",
        "One improving flip, three violated rows",
        [v("A"), v("B", ["A"], [0, 1]), v("C", ["A"], [0, 1]), v("D", ["A"], [0, 1])],
        "0000",
        "1000",
    ),
    (
        "collider",
        "A conditional row is not an unconditional wish",
        [v("A"), v("B"), v("C", ["A", "B"], [0, 1, 1, 0])],
        "001",
        "110",
    ),
    (
        "two-cycles",
        "Two independent consistent dependency cycles",
        [
            v("A", ["B"], [0, 1]),
            v("B", ["A"], [0, 1]),
            v("C", ["D"], [0, 1]),
            v("D", ["C"], [0, 1]),
        ],
        "0000",
        "1111",
    ),
]
controls = []
for id, title, vs, s, t in fixtures:
    r = dict(variables=vs, start=s, target=t)
    a = analyze(r)
    controls.append(dict(id=id, title=title, request=r))
    print(
        id,
        a["consistent"],
        a["total_order_count"],
        a["query"]["relation"],
        a["violations"][a["outcomes"].index(s)],
        a["violations"][a["outcomes"].index(t)],
    )
pathlib.Path("docs/controls.json").write_text(json.dumps(controls, indent=2) + "\n")
