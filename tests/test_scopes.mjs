import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyzeScopes } from "../docs/scopes-engine.js";
test("all eight row atlases: exact Python parity and independent reconstruction", () => {
  const cs = JSON.parse(
      fs.readFileSync(new URL("../docs/row-controls.json", import.meta.url)),
    ),
    reports = cs.map((c) => analyzeScopes(c.request));
  const py = JSON.parse(
    execFileSync(
      process.env.PYTHON || "python",
      [
        "-c",
        `import json,sys;from cpnetlab import analyze_scopes,verify_scopes;rs=json.load(sys.stdin);assert all(verify_scopes(r) for r in rs);print(json.dumps([analyze_scopes(r['request']) for r in rs]))`,
      ],
      {
        input: JSON.stringify(reports),
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      },
    ),
  );
  assert.deepEqual(reports, py);
  assert.equal(
    reports.reduce((n, r) => n + r.subset_count, 0),
    865,
  );
  console.log(
    JSON.stringify({
      reports: reports.length,
      subsets: 865,
      independent: true,
    }),
  );
});
test("all 576 two-variable query atlases independently accepted, strict limit", () => {
  const opt = (name, other) =>
    [0, 1]
      .map((v) => ({ name, parents: [], preferred: [v] }))
      .concat(
        [0, 1, 2, 3].map((v) => ({
          name,
          parents: [other],
          preferred: [v >> 1, v & 1],
        })),
      );
  const rs = [];
  for (const a of opt("A", "B"))
    for (const b of opt("B", "A"))
      for (const start of ["00", "01", "10", "11"])
        for (const target of ["00", "01", "10", "11"])
          rs.push(analyzeScopes({ variables: [a, b], start, target }));
  const ok = execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      `import json,sys;from cpnetlab import verify_scopes;rs=json.load(sys.stdin);assert all(verify_scopes(r) for r in rs);print(sum(r['subset_count'] for r in rs))`,
    ],
    { input: JSON.stringify(rs), encoding: "utf8" },
  );
  assert.equal(rs.length, 576);
  assert.equal(Number(ok), 6400);
  assert.throws(
    () =>
      analyzeScopes({
        variables: [
          { name: "A", parents: ["B", "C", "D"], preferred: Array(8).fill(0) },
          ...["B", "C", "D"].map((name) => ({
            name,
            parents: [],
            preferred: [1],
          })),
        ],
        start: "0000",
        target: "1111",
      }),
    /at most eight/,
  );
});
