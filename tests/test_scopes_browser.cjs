const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn, execFileSync } = require("node:child_process"),
  { waitForDebugger } = require("./chrome_support.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
test(
  "Chrome complete row-subset atlas, every mask and antichain, exports and recovery",
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
          process.env.CPNETLAB_ROWS_URL ||
          `http://127.0.0.1:${server.address().port}/scopes.html`,
      });
      for (let i = 0; i < 400 && !(await js("Boolean(window.rowAtlas)")); i++)
        await delay(25);
      assert.ok(await js("Boolean(window.rowAtlas)"));
      const cs = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../docs/row-controls.json"),
            "utf8",
          ),
        ),
        reports = [];
      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      const show = (s) => (s === "" ? "∅" : s),
        route = (p) =>
          p ? p.map(show).join(" → ") : "No positive-length improving path.";
      async function shot(name) {
        if (!process.env.CPNETLAB_ROWS_SCREEN_DIR) return;
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
          path.join(process.env.CPNETLAB_ROWS_SCREEN_DIR, name + ".png"),
          Buffer.from(im.data, "base64"),
        );
        fs.writeFileSync(
          path.join(
            process.env.CPNETLAB_ROWS_SCREEN_DIR,
            name + ".layout.json",
          ),
          JSON.stringify(
            await js(
              'Object.fromEntries(["output","row-toggles","forward-supports","conflicts","withdrawals"].map(id=>[id,document.getElementById(id).getBoundingClientRect().top+scrollY]))',
            ),
          ),
        );
      }
      let selected = 0,
        buttons = 0;
      for (const width of [1280, 390, 320]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (let i = 0; i < cs.length; i++) {
          await set("control", i);
          const a = await js("window.rowAtlas");
          assert.deepEqual(a.request, cs[i].request);
          reports.push(a);
          assert.equal(
            await js('document.getElementById("experiment-title").textContent'),
            cs[i].title,
          );
          assert.equal(
            await js('document.querySelectorAll("#subset option").length'),
            a.subset_count,
          );
          assert.equal(
            await js('document.querySelectorAll("#row-toggles input").length'),
            a.rows.length,
          );
          assert.deepEqual(
            await js(
              'Array.from(document.querySelectorAll("#row-toggles label")).map(e=>e.textContent)',
            ),
            a.rows.map((row) => {
              const v = a.request.variables.find(
                  (v) => v.name === row.variable,
                ),
                ctx = v.parents.length
                  ? v.parents.map((p, i) => `${p}=${row.context[i]}`).join(", ")
                  : "unconditional";
              return `R${row.row_id}: ${row.variable} | ${ctx}: ${row.preferred} preferred to ${1 - row.preferred}; ${row.edges.length} flip(s)`;
            }),
          );

          assert.equal(
            await js("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          for (const [id, key] of [
            ["forward-supports", "minimal_forward_supports"],
            ["backward-supports", "minimal_backward_supports"],
            ["conflicts", "minimal_conflicts"],
            ["withdrawals", "minimal_withdrawals"],
          ]) {
            assert.deepEqual(
              await js(
                `Array.from(document.querySelectorAll('#${id} article')).map(e=>Number(e.dataset.mask))`,
              ),
              a[key],
            );
          }
          assert.equal(
            await js(
              'document.querySelectorAll("#withdrawals .minimum").length',
            ),
            a.minimal_withdrawals.filter(
              (m) =>
                m.toString(2).replaceAll("0", "").length ===
                a.minimum_withdrawal_size,
            ).length,
          );
          await shot(`control-${i}-${width}`);
          if (width === 1280) {
            for (const sub of a.subsets) {
              await set("subset", sub.mask);
              selected++;
              const dom = await js(
                '({selected:window.rowSelection,forward:document.getElementById("forward").textContent,backward:document.getElementById("backward").textContent,witness:document.getElementById("witness").textContent,title:document.getElementById("witness-title").textContent,checked:Array.from(document.querySelectorAll("#row-toggles input")).map(e=>e.checked),label:document.getElementById("selected-label").textContent})',
              );
              assert.equal(dom.selected, sub.mask);
              assert.equal(dom.forward, route(sub.forward));
              assert.equal(dom.backward, route(sub.backward));
              assert.equal(
                dom.witness,
                sub.consistent
                  ? sub.order.map(show).join(" < ")
                  : route(sub.cycle),
              );
              assert.equal(
                dom.title,
                sub.consistent
                  ? "An actual compatible ranking, least to most preferred"
                  : "An actual improving cycle",
              );
              assert.deepEqual(
                dom.checked,
                a.rows.map((r) => Boolean(sub.mask & (1 << r.row_id))),
              );
              assert.ok(
                dom.label.includes(`All ${a.outcomes.length} outcomes remain.`),
              );
            }
            for (const [id, key] of [
              ["forward-supports", "minimal_forward_supports"],
              ["backward-supports", "minimal_backward_supports"],
              ["conflicts", "minimal_conflicts"],
              ["withdrawals", "minimal_withdrawals"],
            ]) {
              for (let j = 0; j < a[key].length; j++) {
                await js(
                  `document.querySelectorAll('#${id} button')[${j}].click()`,
                );
                buttons++;
                assert.equal(
                  await js("window.rowSelection"),
                  id === "withdrawals"
                    ? ((1 << a.rows.length) - 1) ^ a[key][j]
                    : a[key][j],
                );
              }
            }
            await set("subset", 0);
            for (let j = 0; j < a.rows.length; j++) {
              await js(
                `document.querySelectorAll('#row-toggles input')[${j}].click()`,
              );
              assert.equal(await js("window.rowSelection"), (1 << (j + 1)) - 1);
            }
            const expected = a;
            await js(
              'window.downloadBody=null;window.downloadName=null;URL.createObjectURL=b=>{window.downloadBody=b.text();return"blob:test"};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download};document.getElementById("download").click()',
            );
            assert.equal(
              await js("window.downloadName"),
              "cpnetlab-row-subsets.json",
            );
            assert.deepEqual(
              JSON.parse(await js("window.downloadBody")),
              expected,
            );
          }
        }
      }
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          `import json,sys;from cpnetlab import verify_scopes;rs=json.load(sys.stdin);assert all(verify_scopes(r) for r in rs)`,
        ],
        {
          input: JSON.stringify(reports),
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
        },
      );
      await call("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await set("control", 5);
      await shot("state-unequal-withdrawals");
      await set("subset", 255 ^ 5);
      assert.equal(
        await js("window.rowAtlas.subsets[window.rowSelection].consistent"),
        true,
      );
      await shot("state-two-row-withdrawal");
      await set("request", "{}", "input");
      assert.equal(await js("window.rowAtlas"), null);
      assert.equal(await js('document.getElementById("output").hidden'), true);
      assert.equal(
        await js('document.getElementById("download").disabled'),
        true,
      );
      await js('document.getElementById("build").click()');
      assert.ok(await js('document.getElementById("status").textContent'));
      await shot("state-invalid");
      await set(
        "request",
        JSON.stringify({
          variables: [
            {
              name: "A",
              parents: ["B", "C", "D"],
              preferred: Array(8).fill(0),
            },
            ...["B", "C", "D"].map((name) => ({
              name,
              parents: [],
              preferred: [1],
            })),
          ],
          start: "0000",
          target: "1111",
        }),
        "input",
      );
      await js('document.getElementById("build").click()');
      assert.ok(
        (await js('document.getElementById("status").textContent')).includes(
          "at most eight",
        ),
      );
      await shot("state-limit");
      await set("control", 0);
      assert.equal(await js("window.rowAtlas.subset_count"), 1);
      assert.equal(
        await js('document.getElementById("witness").textContent'),
        "∅",
      );
      assert.deepEqual(errors, []);
      assert.equal(selected, 865);
      console.log(
        JSON.stringify({
          rowReports: reports.length,
          selectedSubsets: selected,
          antichainButtons: buttons,
          exportControls: 8,
          stale: true,
          invalid: true,
          limit: true,
          emptyRecovery: true,
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
