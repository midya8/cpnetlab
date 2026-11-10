const eqKeys = (o, ks) =>
  o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...ks].sort());
export function parse(r) {
  if (
    !eqKeys(r, ["variables", "start", "target"]) ||
    !Array.isArray(r.variables) ||
    r.variables.length > 4
  )
    throw Error("Expected variables, start, target; at most four variables");
  const names = r.variables.map((v) => {
    if (
      !eqKeys(v, ["name", "parents", "preferred"]) ||
      typeof v.name !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,7}$/.test(v.name)
    )
      throw Error("Expected name, parents, preferred");
    return v.name;
  });
  if (JSON.stringify(names) !== JSON.stringify([...new Set(names)].sort()))
    throw Error("Names must be unique and sorted");
  const rows = r.variables.map((v) => {
    const p = v.parents,
      t = v.preferred;
    if (
      !Array.isArray(p) ||
      p.some(
        (x) => typeof x !== "string" || !names.includes(x) || x === v.name,
      ) ||
      JSON.stringify(p) !== JSON.stringify([...new Set(p)].sort())
    )
      throw Error("Parents must be known, unique, sorted and not self");
    if (
      !Array.isArray(t) ||
      t.length !== 2 ** p.length ||
      t.some(
        (x) =>
          !Number.isInteger(x) || typeof x !== "number" || (x !== 0 && x !== 1),
      )
    )
      throw Error("One preferred binary value per parent context");
    return [p.map((x) => names.indexOf(x)), t];
  });
  for (const k of ["start", "target"])
    if (
      typeof r[k] !== "string" ||
      r[k].length !== names.length ||
      /[^01]/.test(r[k])
    )
      throw Error("Outcome must be a binary string in variable order");
  return [names, rows];
}
function ranking(states, edges) {
  const n = states.length,
    pre = Array(n).fill(0);
  for (const [a, b] of edges) pre[states.indexOf(b)] |= 1 << states.indexOf(a);
  const full = (1 << n) - 1,
    memo = new Map();
  function count(mask) {
    if (mask === full) return 1n;
    if (memo.has(mask)) return memo.get(mask);
    let total = 0n;
    for (let i = 0; i < n; i++)
      if (!((mask >> i) & 1) && (pre[i] & mask) === pre[i])
        total += count(mask | (1 << i));
    memo.set(mask, total);
    return total;
  }
  const total = count(0);
  if (total === 0n) return ["0", null];
  let mask = 0;
  const order = [];
  while (mask !== full) {
    const i = states.findIndex(
      (_, i) =>
        !((mask >> i) & 1) &&
        (pre[i] & mask) === pre[i] &&
        count(mask | (1 << i)) > 0n,
    );
    order.push(states[i]);
    mask |= 1 << i;
  }
  return [String(total), order];
}
const compare = (a, b) =>
  JSON.stringify(a) < JSON.stringify(b)
    ? -1
    : JSON.stringify(a) > JSON.stringify(b)
      ? 1
      : 0;
export function analyze(request) {
  const [names, rows] = parse(request),
    states = Array.from({ length: 2 ** names.length }, (_, i) =>
      names.length ? i.toString(2).padStart(names.length, "0") : "",
    ),
    edges = [];
  for (const s of states)
    for (let i = 0; i < names.length; i++) {
      const [ps, pref] = rows[i],
        ctx = ps.map((j) => s[j]).join(""),
        want = pref[ctx ? parseInt(ctx, 2) : 0];
      if (Number(s[i]) !== want)
        edges.push([
          s,
          s.slice(0, i) + want + s.slice(i + 1),
          names[i],
          ctx,
          want,
        ]);
    }
  edges.sort(compare);
  const adj = new Map(states.map((s) => [s, []]));
  for (const [s, t] of edges) adj.get(s).push(t);
  const reach = [],
    paths = [];
  for (const s of states) {
    const found = new Map(),
      queue = [[s]];
    for (let k = 0; k < queue.length; k++) {
      const p = queue[k];
      for (const t of adj.get(p.at(-1)))
        if (!found.has(t)) {
          const q = [...p, t];
          found.set(t, q);
          if (t !== s) queue.push(q);
        }
    }
    reach.push(states.filter((t) => found.has(t)));
    paths.push(states.map((t) => found.get(t) ?? null));
  }
  const cycles = paths
      .map((p, i) => p[i])
      .filter(Boolean)
      .sort((a, b) => a.length - b.length || compare(a, b)),
    cycle = cycles[0] ?? null,
    [total_order_count, order] = ranking(states, edges),
    done = new Set();
  while (true) {
    const ready = names.filter(
      (n, i) => !done.has(n) && rows[i][0].every((j) => done.has(names[j])),
    );
    if (!ready.length) break;
    ready.forEach((n) => done.add(n));
  }
  const a = states.indexOf(request.start),
    b = states.indexOf(request.target),
    forward = paths[a][b],
    backward = paths[b][a],
    relation = cycle
      ? "inconsistent"
      : a === b
        ? "same"
        : forward
          ? "target-dominates"
          : backward
            ? "start-dominates"
            : "incomparable",
    w = {};
  for (const [k, edge] of [
    ["target_above_start", [request.start, request.target]],
    ["start_above_target", [request.target, request.start]],
  ])
    w[k] = cycle || a === b ? null : ranking(states, [...edges, edge])[1];
  return {
    schema: "cpnetlab-v1",
    request,
    outcomes: states,
    edges,
    dependency_acyclic: done.size === names.length,
    consistent: cycle === null,
    total_order_count,
    order,
    cycle,
    reach,
    paths,
    violations: states.map((s) => adj.get(s).length),
    sinks: states.filter((s) => !adj.get(s).length),
    query: { relation, forward, backward, order_witnesses: w },
  };
}
