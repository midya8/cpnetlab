import { analyzeScopes } from "./scopes-engine.js";
const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  },
  show = (s) => (s === "" ? "∅" : s),
  route = (p) =>
    p ? p.map(show).join(" → ") : "No positive-length improving path.",
  bits = (m) =>
    atlas.rows.filter((r) => m & (1 << r.row_id)).map((r) => "R" + r.row_id),
  setname = (m) => bits(m).join(", ") || "∅";
let atlas = null,
  controls = [];
function clear(message) {
  atlas = null;
  window.rowAtlas = null;
  window.rowSelection = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("status").textContent = message;
}
function choose(mask) {
  const s = atlas.subsets[mask];
  $("subset").value = String(mask);
  window.rowSelection = mask;
  $("selected-label").textContent =
    `Retained rows: {${setname(mask)}}. Withdrawn rows: {${setname(((1 << atlas.rows.length) - 1) ^ mask)}}. All ${atlas.outcomes.length} outcomes remain.`;
  for (const input of $("row-toggles").querySelectorAll("input")) {
    input.checked = Boolean(mask & (1 << Number(input.value)));
    input.parentElement.dataset.active = String(input.checked);
  }
  $("selected-verdict").className = "warning" + (s.consistent ? "" : " bad");
  $("selected-verdict").textContent = s.consistent
    ? "This retained-row graph admits a strict ranking. The displayed order is one witness, not a count or a unique preference."
    : "This retained-row graph is inconsistent. Its paths are graph facts, not an entailed strict preference.";
  $("forward").textContent = route(s.forward);
  $("backward").textContent = route(s.backward);
  $("witness-title").textContent = s.consistent
    ? "An actual compatible ranking, least to most preferred"
    : "An actual improving cycle";
  $("witness").textContent = s.consistent
    ? s.order.map(show).join(" < ")
    : route(s.cycle);
}
function cards(id, masks, kind) {
  const root = $(id);
  root.replaceChildren();
  if (!masks.length) {
    root.append(
      el(
        "p",
        kind === "conflict"
          ? "No inconsistent row subset."
          : "No row subset supplies a positive-length path in this direction.",
      ),
    );
    return;
  }
  for (const mask of masks) {
    const kept =
        kind === "withdrawal" ? ((1 << atlas.rows.length) - 1) ^ mask : mask,
      s = atlas.subsets[kept],
      card = el("article");
    card.dataset.mask = String(mask);
    card.append(
      el(
        "h4",
        `${kind === "withdrawal" ? "Withdraw" : "Keep"} {${setname(mask)}}`,
      ),
    );
    const size = bits(mask).length;
    card.append(
      el(
        "p",
        `${size} row(s), inclusion-minimal${kind === "withdrawal" && size === atlas.minimum_withdrawal_size ? "; minimum-cardinality withdrawal" : ""}.`,
        kind === "withdrawal" && size === atlas.minimum_withdrawal_size
          ? "minimum"
          : "",
      ),
    );
    card.append(
      el(
        "p",
        kind === "conflict"
          ? route(s.cycle)
          : kind === "withdrawal"
            ? s.order.map(show).join(" < ")
            : route(kind === "forward" ? s.forward : s.backward),
        "path",
      ),
    );
    const button = el("button", "Inspect this exact subset");
    button.type = "button";
    button.addEventListener("click", () => choose(kept));
    card.append(button);
    root.append(card);
  }
}
function render(a) {
  atlas = a;
  window.rowAtlas = a;
  $("output").hidden = false;
  $("download").disabled = false;
  $("status").textContent = "";
  const preset = controls[Number($("control").value)];
  $("experiment-title").textContent =
    preset && JSON.stringify(preset.request) === JSON.stringify(a.request)
      ? preset.title
      : "Custom supplied model or query";
  $("headline").textContent = `${a.subset_count} row subsets. Nothing omitted.`;
  $("stats").replaceChildren(
    ...[
      [a.rows.length, "Whole conditional rows"],
      [a.subset_count, "Complete subset graphs"],
      [a.consistent_subset_count, "Consistent subset graphs"],
      [a.minimum_withdrawal_size, "Smallest withdrawal size"],
    ].map(([n, label]) => {
      const d = el("div", undefined, "stat");
      d.append(el("strong", n), el("span", label));
      return d;
    }),
  );
  $("subset").replaceChildren(
    ...a.subsets.map((s) => {
      const o = el("option", `Mask ${s.mask}: keep {${setname(s.mask)}}`);
      o.value = String(s.mask);
      return o;
    }),
  );
  $("row-toggles").replaceChildren(
    ...a.rows.map((row) => {
      const v = a.request.variables.find((v) => v.name === row.variable),
        ctx = v.parents.length
          ? v.parents.map((p, i) => `${p}=${row.context[i]}`).join(", ")
          : "unconditional";
      const label = el("label"),
        input = el("input");
      input.type = "checkbox";
      input.value = String(row.row_id);
      input.addEventListener("change", () =>
        choose(Number($("subset").value) ^ (1 << row.row_id)),
      );
      label.append(
        input,
        document.createTextNode(
          `R${row.row_id}: ${row.variable} | ${ctx}: ${row.preferred} preferred to ${1 - row.preferred}; ${row.edges.length} flip(s)`,
        ),
      );
      return label;
    }),
  );
  cards("forward-supports", a.minimal_forward_supports, "forward");
  cards("backward-supports", a.minimal_backward_supports, "backward");
  cards("conflicts", a.minimal_conflicts, "conflict");
  cards("withdrawals", a.minimal_withdrawals, "withdrawal");
  choose((1 << a.rows.length) - 1);
}
function run() {
  try {
    render(analyzeScopes(JSON.parse($("request").value)));
  } catch (e) {
    clear(e.message);
  }
}
$("control").addEventListener("change", () => {
  $("request").value = JSON.stringify(
    controls[Number($("control").value)].request,
    null,
    2,
  );
  run();
});
$("subset").addEventListener("change", () => {
  if (atlas) choose(Number($("subset").value));
});
$("build").addEventListener("click", run);
$("request").addEventListener("input", () =>
  clear(
    "Model changed. Rebuild every subset before interpreting or exporting.",
  ),
);
$("download").addEventListener("click", () => {
  if (!atlas) return;
  const b = new Blob([JSON.stringify(atlas, null, 2) + "\n"], {
      type: "application/json",
    }),
    u = URL.createObjectURL(b),
    a = el("a");
  a.href = u;
  a.download = "cpnetlab-row-subsets.json";
  a.click();
  URL.revokeObjectURL(u);
});
try {
  controls = await (await fetch("row-controls.json")).json();
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
  clear("Could not load row controls: " + e.message);
}
