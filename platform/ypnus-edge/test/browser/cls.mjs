// Real-browser proof of the zero-CLS and no-console-error requirements.
//   node test/browser/cls.mjs        (needs Chrome: CHROME=/path/to/chrome, defaults to Playwright's)
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const chrome = process.env.CHROME || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) { console.log("SKIP: no Chrome found (set CHROME)"); process.exit(0); }

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>t</title><link rel="stylesheet" href="/assets/ypn-ads.css">
<style>body{font:16px/1.5 sans-serif;margin:0 auto;max-width:900px}p{margin:12px 0}</style>
<script>window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});</script>
<script src="/assets/ypn-ads.js" defer></script></head><body>
<h1>Article</h1><p>Intro text above the first ad.</p>
<div class="ypn-slot" data-ypn-slot="top" data-size="300x250"></div>
<p id="after-top">Text right under the first ad. If the slot resizes, this paragraph moves.</p>
<div style="height:1800px">spacer</div>
<div class="ypn-slot" data-ypn-slot="bottom" data-size="300x250"></div>
<p>Footer text.</p>
</body></html>`;

const mode = { current: "bid" };
const srv = http.createServer((req, res) => {
  if (req.url === "/") return res.setHeader("content-type", "text/html"), res.end(page);
  if (req.url === "/assets/ypn-ads.css") return res.setHeader("content-type", "text/css"), res.end(readFileSync(join(root, "public/ypn-ads.css")));
  if (req.url === "/assets/ypn-ads.js") return res.setHeader("content-type", "text/javascript"), res.end(readFileSync(join(root, "public/ypn-ads.js")));
  if (req.url === "/api/ads/event") return res.statusCode = 204, res.end();
  if (req.url === "/api/ads" && req.method === "POST") {
    const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const slots = Object.fromEntries(body.slots.map((s) => [s.id, mode.current === "bid" ? { type: "bid", w: 300, h: 250, html: '<div style="width:300px;height:250px;background:#fc0">Creative</div><script>window.x=1<\/script>', crid: "c", token: null } : { type: "house", w: 300, h: 250, title: "Own your zip code", body: "Check if it is open.", cta: "Check", href: "/check-zip" }]));
      const send = () => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ v: 1, slots })); };
      if (mode.current === "slow") return setTimeout(send, 900);
      if (mode.current === "error") return res.end(JSON.stringify({ v: 1, reason: "error", slots: {} })); // what the Lambda returns on internal failure
      if (mode.current === "outage") return res.statusCode = 502, res.end("bad gateway"); // CDN/API Gateway down
      if (mode.current === "garbage") return res.end("<<<not json");
      send();
    });
    return;
  }
  res.statusCode = 404; res.end();
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${srv.address().port}/`;


// ---- minimal Chrome DevTools Protocol driver (real time, no virtual-time quirks) ----------
async function launch() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--remote-allow-origins=*", `--user-data-dir=${mkdtempSync(join(tmpdir(), "ypn-chrome-"))}`, "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push("console.error: " + (msg.params.args[0]?.value ?? ""));
    if (msg.method === "Runtime.exceptionThrown") errors.push("exception: " + (msg.params.exceptionDetails?.text ?? ""));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error" && !/favicon/i.test(msg.params.entry.url ?? "")) errors.push("log: " + msg.params.entry.text + " " + (msg.params.entry.url ?? ""));
  };
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  return { send, errors, close: () => { try { ws.close(); } catch {} child.kill("SIGKILL"); } };
}

const evaluate = async (c, expression) => {
  const r = await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text));
  return r.result.result.value;
};

const STEPS = `(async()=>{
 const info=()=>[...document.querySelectorAll('.ypn-slot')].map(e=>({state:e.dataset.state,kind:e.dataset.kind,h:e.offsetHeight,w:e.offsetWidth}));
 const settled=i=>{const s=info()[i];return s&&s.state&&s.state!=='pending'};
 const wait=(fn,max)=>new Promise(r=>{let n=0;const t=setInterval(()=>{if(fn()||++n>max){clearInterval(t);setTimeout(r,500)}},50)});
 await wait(()=>settled(0),80);
 const clsTop=window.__cls, topY=document.getElementById('after-top').getBoundingClientRect().top+scrollY;
 const b=document.querySelector('[data-ypn-slot=bottom]');
 scrollTo(0,b.getBoundingClientRect().top+scrollY-innerHeight-100);
 await wait(()=>settled(1),80);
 return {clsTop,cls:window.__cls,slots:info(),topY,topYAfter:document.getElementById('after-top').getBoundingClientRect().top+scrollY,overflowX:document.documentElement.scrollWidth>innerWidth};
})()`;

let failed = 0;
const rows = [];
const viewports = [{ name: "desktop", width: 1000, height: 800, mobile: false }, { name: "phone", width: 390, height: 780, mobile: true }];
for (const vp of viewports) {
  for (const m of ["bid", "nobid", "slow", "error", "outage", "garbage"]) {
    mode.current = m === "nobid" ? "house" : m;
    const c = await launch();
    try {
      await c.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      await c.send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 400));
      const d = await evaluate(c, STEPS);
      const noShift = d.cls < 0.001 && Math.abs(d.topY - d.topYAfter) < 1;
      const settledAll = d.slots.every((x) => x.state && x.state !== "pending");
      const errs = m === "outage" ? c.errors.filter((e) => !/Failed to load resource/.test(e)) : c.errors;
      const ok = noShift && settledAll && !d.overflowX && errs.length === 0;
      if (!ok) failed++;
      rows.push({ view: vp.name, scenario: m, CLS: Number(d.cls.toFixed(4)), top: `${d.slots[0].state}/${d.slots[0].kind ?? "-"}`, bottom: `${d.slots[1].state}/${d.slots[1].kind ?? "-"}`, slotH: d.slots[0].h, overflowX: d.overflowX, errors: errs.length, pass: ok });
      if (errs.length) console.log(m, errs);
    } catch (e) { failed++; rows.push({ view: vp.name, scenario: m, error: String(e.message).slice(0, 120) }); }
    finally { c.close(); }
  }
}
srv.close();
console.table(rows);
process.exit(failed ? 1 : 0);
