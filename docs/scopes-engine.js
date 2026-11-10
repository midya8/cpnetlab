import { analyze } from "./engine.js";
const cmp = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
export function analyzeScopes(request) {
  const base = analyze(request),
    states = base.outcomes,
    rows = [];
  for (const v of request.variables)
    for (let c = 0; c < v.preferred.length; c++) {
      const context = v.parents.length
        ? c.toString(2).padStart(v.parents.length, "0")
        : "";
      rows.push({
        row_id: rows.length,
        variable: v.name,
        context,
        preferred: v.preferred[c],
        edges: base.edges
          .filter((e) => e[2] === v.name && e[3] === context)
          .map((e) => e.slice(0, 2)),
      });
    }
  if (rows.length > 8)
    throw Error(
      "Row-subset atlas supports at most eight complete conditional rows",
    );
  const R = rows.length,
    records = [];
  for (let mask = 0; mask < 1 << R; mask++) {
    const edges = rows
        .filter((r) => mask & (1 << r.row_id))
        .flatMap((r) => r.edges)
        .sort(cmp),
      adj = Object.fromEntries(states.map((s) => [s, []]));
    for (const [s, t] of edges) adj[s].push(t);
    const paths = {};
    for (const source of states) {
      const found = {},
        queue = [[source]];
      for (let h = 0; h < queue.length; h++)
        for (const t of adj[queue[h].at(-1)])
          if (!Object.hasOwn(found, t)) {
            found[t] = [...queue[h], t];
            if (t !== source) queue.push(found[t]);
          }
      paths[source] = found;
    }
    const cycles = states
        .filter((s) => Object.hasOwn(paths[s], s))
        .map((s) => paths[s][s])
        .sort((a, b) => a.length - b.length || cmp(a, b)),
      cycle = cycles[0] || null;
    let order = null;
    if (!cycle) {
      order = [];
      const remaining = new Set(states);
      while (remaining.size) {
        const s = states.find(
          (s) =>
            remaining.has(s) &&
            !edges.some(([a, b]) => b === s && remaining.has(a)),
        );
        order.push(s);
        remaining.delete(s);
      }
    }
    records.push({
      mask,
      consistent: !cycle,
      order,
      cycle,
      forward: paths[request.start][request.target] || null,
      backward: paths[request.target][request.start] || null,
    });
  }
  const minima = (predicate) =>
    records
      .filter(
        (x) =>
          predicate(x) &&
          rows.every(
            (_, i) =>
              !(x.mask & (1 << i)) || !predicate(records[x.mask ^ (1 << i)]),
          ),
      )
      .map((x) => x.mask);
  const full = (1 << R) - 1,
    withdrawals = records
      .filter(
        (x) =>
          x.consistent &&
          rows.every(
            (_, i) =>
              x.mask & (1 << i) || !records[x.mask | (1 << i)].consistent,
          ),
      )
      .map((x) => full ^ x.mask)
      .sort((a, b) => a - b);
  return {
    schema: "cpnetlab-row-subsets-v1",
    request,
    outcomes: states,
    rows,
    subset_count: 1 << R,
    consistent_subset_count: records.filter((x) => x.consistent).length,
    subsets: records,
    minimal_forward_supports: minima((x) => !!x.forward),
    minimal_backward_supports: minima((x) => !!x.backward),
    minimal_conflicts: minima((x) => !x.consistent),
    minimal_withdrawals: withdrawals,
    minimum_withdrawal_size: Math.min(
      ...withdrawals.map((m) => m.toString(2).replaceAll("0", "").length),
    ),
  };
}
