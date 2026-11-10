"""Run with an installed wheel outside the checkout."""

import json, pathlib, subprocess, sys, copy
import cpnetlab

controls = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert (
    pathlib.Path(cpnetlab.__file__).resolve().parent
    != pathlib.Path(sys.argv[1]).resolve().parents[1] / "cpnetlab"
)
for i, c in enumerate(controls):
    request = pathlib.Path(f"request-{i}.json")
    evidence = pathlib.Path(f"evidence-{i}.json")
    request.write_text(json.dumps(c["request"]))
    module = json.loads(
        subprocess.check_output(
            [sys.executable, "-m", "cpnetlab", "analyze", str(request)], text=True
        )
    )
    console = json.loads(
        subprocess.check_output(["cpnetlab", "analyze", str(request)], text=True)
    )
    assert module == console == cpnetlab.analyze(c["request"])
    assert cpnetlab.verify(module)
    evidence.write_text(json.dumps(module))
    for command in [[sys.executable, "-m", "cpnetlab"], ["cpnetlab"]]:
        p = subprocess.run(
            command + ["verify", str(evidence)], text=True, capture_output=True
        )
        assert p.returncode == 0 and p.stdout.strip() == "Evidence accepted"
    forged = copy.deepcopy(module)
    forged["total_order_count"] = "999999"
    evidence.write_text(json.dumps(forged))
    for command in [[sys.executable, "-m", "cpnetlab"], ["cpnetlab"]]:
        p = subprocess.run(
            command + ["verify", str(evidence)], text=True, capture_output=True
        )
        assert p.returncode == 2 and "Evidence rejected" in p.stderr
print(
    "Installed wheel outside checkout: eight controls, module/console exact parity, independent acceptance and forged-count rejection"
)

row_controls = json.loads(
    (pathlib.Path(sys.argv[1]).parent / "row-controls.json").read_text()
)
for i, c in enumerate(row_controls):
    request = pathlib.Path(f"rows-request-{i}.json")
    evidence = pathlib.Path(f"rows-evidence-{i}.json")
    request.write_text(json.dumps(c["request"]))
    outputs = [
        json.loads(subprocess.check_output(cmd + ["scopes", str(request)], text=True))
        for cmd in [[sys.executable, "-m", "cpnetlab"], ["cpnetlab"]]
    ]
    assert outputs[0] == outputs[1] == cpnetlab.analyze_scopes(
        c["request"]
    ) and cpnetlab.verify_scopes(outputs[0])
    evidence.write_text(json.dumps(outputs[0]))
    for cmd in [[sys.executable, "-m", "cpnetlab"], ["cpnetlab"]]:
        p = subprocess.run(
            cmd + ["verify-scopes", str(evidence)], text=True, capture_output=True
        )
        assert p.returncode == 0 and p.stdout.strip() == "Evidence accepted"
    forged = copy.deepcopy(outputs[0])
    forged["minimal_withdrawals"] = []
    evidence.write_text(json.dumps(forged))
    for cmd in [[sys.executable, "-m", "cpnetlab"], ["cpnetlab"]]:
        p = subprocess.run(
            cmd + ["verify-scopes", str(evidence)], text=True, capture_output=True
        )
        assert p.returncode == 2 and "Evidence rejected" in p.stderr
print(
    "Installed row atlas: eight controls, both module/console commands, independent verification and forgery rejection"
)
