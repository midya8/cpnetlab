import { analyze } from "./engine.js";
const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  },
  show = (s) => (s === "" ? "∅" : s),
  route = (p) => (p ? p.map(show).join(" → ") : "No improving path."),
  ranking = (o) =>
    o
      ? o.map(show).join(" < ")
      : "No compatible strict ranking in this direction.";
let report = null,
  controls = [];
function clear(message = "") {
  report = null;
  window.cpnetReport = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("status").textContent = message;
}
function render(r) {
  const preset = controls[Number($("control").value)];
  $("experiment-title").textContent =
    preset && JSON.stringify(preset.request) === JSON.stringify(r.request)
      ? preset.title
      : "Custom supplied model or comparison";
  report = r;
  window.cpnetReport = r;
  $("output").hidden = false;
  $("download").disabled = false;
  $("status").textContent = "";
  $("headline").textContent = r.consistent
    ? "All local statements fit a strict ranking."
    : "An improving cycle blocks every strict ranking.";
  $("stats").replaceChildren(
    ...[
      [r.outcomes.length, "Complete outcomes"],
      [r.edges.length, "Legal improving flips"],
      [r.total_order_count, "Compatible strict rankings"],
      [r.dependency_acyclic ? "Acyclic" : "Cyclic", "Parent dependency graph"],
    ].map(([n, label]) => {
      const d = el("div", undefined, "stat");
      d.append(el("strong", n), el("span", label));
      return d;
    }),
  );
  $("warning").className = "warning" + (r.consistent ? "" : " bad");
  $("warning").textContent = r.consistent
    ? `${r.sinks.length} locally unimprovable outcome(s): ${r.sinks.map(show).join(", ")}. One compatible ranking does not make every pairwise comparison mandatory.`
    : `Actual improving cycle: ${route(r.cycle)}. Total-ranking semantics has no model here; reachability remains a graph fact, not a justified strict preference.`;
  const names = r.request.variables.map((v) => v.name);
  $("variable-order").textContent = names.length
    ? names.join(", ")
    : "no variables (∅ is the only outcome)";
  for (const k of ["start", "target"]) {
    $(k).replaceChildren(
      ...r.outcomes.map((s) => {
        const o = el("option", show(s));
        o.value = s;
        return o;
      }),
    );
    $(k).value = r.request[k];
  }
  $("relation").textContent = {
    same: "The same outcome, not a strict comparison.",
    inconsistent: "Inconsistent model: no strict-ranking verdict.",
    "target-dominates": "Every compatible ranking puts target above start.",
    "start-dominates": "Every compatible ranking puts start above target.",
    incomparable:
      "Both ranking directions are compatible. This is not indifference.",
  }[r.query.relation];
  $("forward").textContent = route(r.query.forward);
  $("backward").textContent = route(r.query.backward);
  const i = r.outcomes.indexOf(r.request.start),
    j = r.outcomes.indexOf(r.request.target),
    cut = r.outcomes.filter(
      (s) => s === r.request.start || r.reach[i].includes(s),
    );
  $("cut").textContent =
    r.request.start !== r.request.target && !r.query.forward
      ? `Closed no-path cut: {${cut.map(show).join(", ")}} contains start, excludes target, and no legal flip leaves it.`
      : "A shortest path proves reachability; it does not define a cardinal improvement.";
  $("score").textContent =
    `Violated rows: start ${r.violations[i]}, target ${r.violations[j]}. Counting violations is not the preference semantics.`;
  $("target-order").textContent =
    r.query.relation === "same"
      ? "No strict ordering of an outcome above itself."
      : ranking(r.query.order_witnesses.target_above_start);
  $("start-order").textContent =
    r.query.relation === "same"
      ? "No strict ordering of an outcome above itself."
      : ranking(r.query.order_witnesses.start_above_target);
  $("outcomes").replaceChildren(
    ...r.outcomes.map((s, i) => {
      const d = el("div", undefined, "outcome");
      d.append(
        el("h3", show(s)),
        el("p", `${r.violations[i]} violated row(s)`),
      );
      const edges = r.edges.filter((e) => e[0] === s);
      if (!edges.length) d.append(el("p", "No improving flip", "sink"));
      const ul = el("ul");
      for (const [, t, v, c, w] of edges)
        ul.append(
          el("li", `${v} → ${w} (${c || "unconditional"}): ${show(t)}`),
        );
      d.append(ul);
      return d;
    }),
  );
  $("rows").replaceChildren(
    ...r.request.variables.map((v) => {
      const d = el("div", undefined, "row");
      d.append(el("h3", v.name));
      v.preferred.forEach((want, i) => {
        const ctx = v.parents.length
          ? i.toString(2).padStart(v.parents.length, "0")
          : "";
        d.append(
          el(
            "p",
            `${v.parents.length ? v.parents.map((p, j) => p + "=" + ctx[j]).join(", ") : "Unconditional"}: ${want} preferred to ${1 - want}`,
          ),
        );
      });
      return d;
    }),
  );
}
function run() {
  try {
    render(analyze(JSON.parse($("request").value)));
  } catch (e) {
    clear(e.message);
  }
}
$("request").addEventListener("input", () =>
  clear("Model changed. Rebuild before interpreting or exporting."),
);
$("build").addEventListener("click", run);
for (const k of ["start", "target"])
  $(k).addEventListener("change", () => {
    if (!report) return;
    const request = structuredClone(report.request);
    request.start = $("start").value;
    request.target = $("target").value;
    $("request").value = JSON.stringify(request, null, 2);
    try {
      render(analyze(request));
    } catch (e) {
      clear(e.message);
    }
  });
$("control").addEventListener("change", () => {
  $("request").value = JSON.stringify(
    controls[Number($("control").value)].request,
    null,
    2,
  );
  run();
});
$("download").addEventListener("click", () => {
  if (!report) return;
  const b = new Blob([JSON.stringify(report, null, 2) + "\n"], {
      type: "application/json",
    }),
    u = URL.createObjectURL(b),
    a = el("a");
  a.href = u;
  a.download = "cpnetlab-evidence.json";
  a.click();
  URL.revokeObjectURL(u);
});
try {
  controls = await (await fetch("controls.json")).json();
  $("control").replaceChildren(
    ...controls.map((c, i) => {
      const o = el("option", c.title);
      o.value = String(i);
      return o;
    }),
  );
  $("control").value = "5";
  $("request").value = JSON.stringify(controls[5].request, null, 2);
  run();
} catch (e) {
  clear("Could not load controls: " + e.message);
}
