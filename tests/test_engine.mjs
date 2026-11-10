import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyze } from "../docs/engine.js";
test("all controls, independent Python acceptance and exact full-report parity", () => {
  const cs = JSON.parse(
    fs.readFileSync(new URL("../docs/controls.json", import.meta.url)),
  );
  const reports = cs.map((c) => analyze(c.request));
  const py = JSON.parse(
    execFileSync(
      process.env.PYTHON || "python",
      [
        "-c",
        `import sys,json;from cpnetlab import analyze,verify;rs=json.load(sys.stdin);assert all(verify(r) for r in rs);print(json.dumps([analyze(r['request']) for r in rs]))`,
      ],
      { input: JSON.stringify(reports), encoding: "utf8" },
    ),
  );
  assert.deepEqual(reports, py);
  console.log(
    JSON.stringify({
      reports: reports.length,
      outcomes: reports.reduce((a, r) => a + r.outcomes.length, 0),
      orderedQueries: reports.reduce((a, r) => a + r.outcomes.length ** 2, 0),
      edges: reports.reduce((a, r) => a + r.edges.length, 0),
    }),
  );
});
test("all two-variable networks all 16 ordered queries", () => {
  const option = (name, other) =>
    [0, 1]
      .map((p) => ({ name, parents: [], preferred: [p] }))
      .concat(
        [0, 1, 2, 3].map((i) => ({
          name,
          parents: [other],
          preferred: [i >> 1, i & 1],
        })),
      );
  const reports = [];
  for (const a of option("A", "B"))
    for (const b of option("B", "A"))
      for (const start of ["00", "01", "10", "11"])
        for (const target of ["00", "01", "10", "11"])
          reports.push(analyze({ variables: [a, b], start, target }));
  const ok = execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      `import sys,json;from cpnetlab import verify;rs=json.load(sys.stdin);assert all(verify(r) for r in rs);print(len(rs))`,
    ],
    { input: JSON.stringify(reports), encoding: "utf8" },
  );
  assert.equal(Number(ok), 576);
});
