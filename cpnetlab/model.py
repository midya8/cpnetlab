"""Strict binary CP-net input. Bits follow the supplied sorted variable order."""

import re


def parse(request):
    if not isinstance(request, dict) or set(request) != {
        "variables",
        "start",
        "target",
    }:
        raise ValueError("Expected variables, start and target only")
    variables = request["variables"]
    if not isinstance(variables, list) or len(variables) > 4:
        raise ValueError("At most four binary variables")
    names = []
    for v in variables:
        if not isinstance(v, dict) or set(v) != {"name", "parents", "preferred"}:
            raise ValueError("Expected name, parents, preferred")
        name = v["name"]
        if not isinstance(name, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]{0,7}", name):
            raise ValueError("Variable names are short uppercase identifiers")
        names.append(name)
    if names != sorted(set(names)):
        raise ValueError("Variable names must be unique and sorted")
    rows = []
    for v in variables:
        ps = v["parents"]
        vs = v["preferred"]
        if (
            not isinstance(ps, list)
            or any(not isinstance(p, str) for p in ps)
            or ps != sorted(set(ps))
        ):
            raise ValueError("Parents must be unique and sorted")
        if any(p not in names or p == v["name"] for p in ps):
            raise ValueError("Unknown or self parent")
        if (
            not isinstance(vs, list)
            or len(vs) != 2 ** len(ps)
            or any(type(x) is not int or x not in (0, 1) for x in vs)
        ):
            raise ValueError("Exactly one preferred binary value per parent context")
        rows.append(([names.index(p) for p in ps], vs))
    for key in ["start", "target"]:
        s = request[key]
        if (
            not isinstance(s, str)
            or len(s) != len(names)
            or any(b not in "01" for b in s)
        ):
            raise ValueError("Outcome must be a binary string in variable order")
    return names, rows


def outcomes(n):
    return [format(i, f"0{n}b") if n else "" for i in range(2**n)]
