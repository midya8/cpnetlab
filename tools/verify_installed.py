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
