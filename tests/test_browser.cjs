const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn, execFileSync } = require("node:child_process"),
  { waitForDebugger } = require("./chrome_support.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
test(
  "Chrome all outcomes, full ranking witnesses, exports, invalid and stale recovery",
  { timeout: 180000 },
  async () => {
    const server = require("node:http").createServer((req, res) => {
      try {
        const file = path.join(
          __dirname,
          "../docs",
          req.url === "/" ? "index.html" : req.url,
        );
        res.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
          }[path.extname(file)] || "text/plain",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.statusCode = 404;
        res.end("Not found");
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cpnetlab-")),
      browser = spawn(
        process.env.CHROME_BIN || "google-chrome",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-dev-shm-usage",
          "--remote-debugging-port=0",
          `--user-data-dir=${profile}`,
          "about:blank",
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
    let ws,
      error,
      diagnostics = "";
    browser.on("error", (e) => (error = e));
    browser.stderr.on(
      "data",
      (d) => (diagnostics = (diagnostics + d).slice(-4000)),
    );
    try {
      for (
        let i = 0;
        i < 1200 &&
        !error &&
        browser.exitCode === null &&
        !fs.existsSync(path.join(profile, "DevToolsActivePort"));
        i++
      )
        await delay(25);
      assert.ok(
        fs.existsSync(path.join(profile, "DevToolsActivePort")),
        error?.message || diagnostics,
      );
      const port = fs
          .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0],
        tab = await waitForDebugger(`http://127.0.0.1:${port}/json/list`, {
          alive: () => browser.exitCode === null && !error,
        });
      ws = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((r, j) => {
        ws.onopen = r;
        ws.onerror = j;
      });
      let seq = 0;
      const pending = new Map(),
        errors = [];
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === "Runtime.exceptionThrown") errors.push(m.params);
        if (pending.has(m.id)) {
          const { r, j } = pending.get(m.id);
          pending.delete(m.id);
          m.error ? j(Error(JSON.stringify(m.error))) : r(m.result);
        }
      };
      const call = (method, params = {}) =>
          new Promise((r, j) => {
            const id = ++seq;
            pending.set(id, { r, j });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        js = async (expression) => {
          const r = await call("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
          });
          if (r.exceptionDetails)
            throw Error(JSON.stringify(r.exceptionDetails));
          return r.result.value;
        };
      await call("Runtime.enable");
      await call("Page.enable");
      await call("Page.navigate", {
        url:
          process.env.CPNETLAB_URL ||
          `http://127.0.0.1:${server.address().port}/`,
      });
      for (
        let i = 0;
        i < 400 && !(await js("Boolean(window.cpnetReport)"));
        i++
      )
        await delay(25);
      assert.ok(await js("Boolean(window.cpnetReport)"));
      const cs = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../docs/controls.json"),
            "utf8",
          ),
        ),
        reports = [],
        queries = [];
      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      async function shot(name) {
        if (!process.env.CPNETLAB_SCREEN_DIR) return;
        await delay(120);
        await js(
          "document.activeElement.blur();window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
        );
        const m = await call("Page.getLayoutMetrics"),
          im = await call("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: {
              x: 0,
              y: 0,
              width: m.cssContentSize.width,
              height: m.cssContentSize.height,
              scale: 1,
            },
          });
        fs.writeFileSync(
          path.join(process.env.CPNETLAB_SCREEN_DIR, name + ".png"),
          Buffer.from(im.data, "base64"),
        );
        fs.writeFileSync(
          path.join(process.env.CPNETLAB_SCREEN_DIR, name + ".layout.json"),
          JSON.stringify(
            await js(
              'Object.fromEntries(["output","outcomes","rows"].map(id=>[id,document.getElementById(id).getBoundingClientRect().top+scrollY]))',
            ),
          ),
        );
      }
      for (const width of [1280, 390, 320]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (let i = 0; i < cs.length; i++) {
          await set("control", i);
          const r = await js("window.cpnetReport");
          assert.deepEqual(r.request, cs[i].request);
          assert.equal(
            await js('document.getElementById("experiment-title").textContent'),
            cs[i].title,
          );
          assert.equal(
            await js('document.querySelectorAll(".outcome").length'),
            r.outcomes.length,
          );
          assert.equal(
            await js('document.querySelectorAll(".outcome li").length'),
            r.edges.length,
          );
          assert.equal(
            await js("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          assert.ok(
            (await js('document.getElementById("stats").innerText')).includes(
              r.total_order_count,
            ),
          );
          const rows = await js(
            'Array.from(document.querySelectorAll("#rows .row")).map(e=>({name:e.querySelector("h3").textContent,rows:Array.from(e.querySelectorAll("p")).map(x=>x.textContent)}))',
          );
          assert.deepEqual(
            rows,
            r.request.variables.map((v) => ({
              name: v.name,
              rows: v.preferred.map((want, i) => {
                const ctx = v.parents.length
                  ? i.toString(2).padStart(v.parents.length, "0")
                  : "";
                return `${v.parents.length ? v.parents.map((p, j) => p + "=" + ctx[j]).join(", ") : "Unconditional"}: ${want} preferred to ${1 - want}`;
              }),
            })),
          );
          reports.push(r);
          await shot(`control-${i}-${width}`);
          if (width === 1280)
            for (const s of r.outcomes)
              for (const t of r.outcomes) {
                await set("start", s);
                await set("target", t);
                const q = await js(
                  "({request:window.cpnetReport.request,query:window.cpnetReport.query})",
                );
                queries.push(q);
                const dom = await js(
                  'Object.fromEntries(["relation","forward","backward","target-order","start-order","cut"].map(id=>[id,document.getElementById(id).textContent]))',
                );
                const show = (x) => (x === "" ? "∅" : x);
                const route = (p) =>
                  p ? p.map(show).join(" → ") : "No improving path.";
                const rank = (p) =>
                  p
                    ? p.map(show).join(" < ")
                    : "No compatible strict ranking in this direction.";
                assert.equal(dom.forward, route(q.query.forward));
                assert.equal(dom.backward, route(q.query.backward));
                assert.equal(
                  dom.relation,
                  {
                    same: "The same outcome, not a strict comparison.",
                    inconsistent:
                      "Inconsistent model: no strict-ranking verdict.",
                    "target-dominates":
                      "Every compatible ranking puts target above start.",
                    "start-dominates":
                      "Every compatible ranking puts start above target.",
                    incomparable:
                      "Both ranking directions are compatible. This is not indifference.",
                  }[q.query.relation],
                );
                assert.equal(
                  dom["target-order"],
                  q.query.relation === "same"
                    ? "No strict ordering of an outcome above itself."
                    : rank(q.query.order_witnesses.target_above_start),
                );
                assert.equal(
                  dom["start-order"],
                  q.query.relation === "same"
                    ? "No strict ordering of an outcome above itself."
                    : rank(q.query.order_witnesses.start_above_target),
                );
                if (s !== t && !q.query.forward) {
                  const cut = r.outcomes.filter(
                    (x) =>
                      x === s || r.reach[r.outcomes.indexOf(s)].includes(x),
                  );
                  assert.equal(
                    dom.cut,
                    `Closed no-path cut: {${cut.map(show).join(", ")}} contains start, excludes target, and no legal flip leaves it.`,
                  );
                  assert.ok(cut.includes(s) && !cut.includes(t));
                  assert.ok(
                    r.edges.every(
                      ([a, b]) => !cut.includes(a) || cut.includes(b),
                    ),
                  );
                }
                assert.equal(
                  await js('document.getElementById("start").value'),
                  s,
                );
                assert.equal(
                  await js('document.getElementById("target").value'),
                  t,
                );
                if (
                  s !== t &&
                  !(await js("Boolean(window.cpnetReport.query.forward)"))
                )
                  assert.ok(
                    (
                      await js('document.getElementById("cut").innerText')
                    ).startsWith("Closed no-path cut"),
                  );
              }
        }
      }
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          `import json,sys;from cpnetlab import verify,analyze;d=json.load(sys.stdin);assert all(verify(r) for r in d['reports']);assert all(analyze(r['request'])['query']==r['query'] for r in d['queries'])`,
        ],
        { input: JSON.stringify({ reports, queries }), encoding: "utf8" },
      );
      await call("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await set("control", 5);
      await shot("state-fanout");
      for (let i = 0; i < cs.length; i++) {
        await set("control", i);
        const expected = await js("window.cpnetReport");
        await js(
          'window.downloadBody=null;window.downloadName=null;URL.createObjectURL=b=>{window.downloadBody=b.text();return"blob:test"};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download};document.getElementById("download").click()',
        );
        assert.equal(await js("window.downloadName"), "cpnetlab-evidence.json");
        assert.deepEqual(JSON.parse(await js("window.downloadBody")), expected);
      }
      await set("control", 5);
      await set("request", "{}", "input");
      assert.equal(await js("window.cpnetReport"), null);
      assert.equal(await js('document.getElementById("output").hidden'), true);
      assert.equal(
        await js('document.getElementById("download").disabled'),
        true,
      );
      await js('document.getElementById("build").click()');
      assert.ok(await js('document.getElementById("status").innerText'));
      await shot("state-invalid");
      await set("control", 4);
      assert.equal(await js("window.cpnetReport.consistent"), false);
      assert.ok(
        (await js('document.getElementById("warning").innerText')).includes(
          "Actual improving cycle",
        ),
      );
      await shot("state-cycle");
      await set("control", 3);
      assert.equal(await js("window.cpnetReport.consistent"), true);
      assert.equal(await js("window.cpnetReport.dependency_acyclic"), false);
      await shot("state-consistent-cycle");
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          browserReports: reports.length,
          orderedQueries: queries.length,
          exportControls: cs.length,
          stale: true,
          invalid: true,
          cycleRecovery: true,
        }),
      );
    } finally {
      ws?.close();
      // Await process exit before removing its profile. Chrome subprocesses can
      // briefly finish writes after termination; only local cleanup retries.
      const exited = new Promise((r) => browser.once("close", r));
      browser.kill("SIGKILL");
      if (browser.exitCode === null) await exited;
      await new Promise((r) => server.close(r));
      fs.rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    }
  },
);
