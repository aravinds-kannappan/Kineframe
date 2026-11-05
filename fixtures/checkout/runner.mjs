import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { createCheckout } from "./service.mjs";
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
const module = await import("./service.mjs");
let active = 0;
const pool = {
  acquire() { if (active >= 3) throw new Error("POOL_EXHAUSTED"); active++; return {}; },
  release() { active--; },
};
const charge = async (declined) => {
  if (config.scenario === "timeout") await new Promise(r => setTimeout(r, 65));
  if (declined) throw new Error("PAYMENT_DECLINED");
  return "receipt-demo";
};
const checkout = createCheckout(pool, charge);
const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(module.health ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(module.health ? module.health() : { error: "NOT_FOUND" })); return;
  }
  let timer;
  try {
    const data = await Promise.race([
      checkout(req.url.includes("declined")),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), config.timeoutMs); }),
    ]);
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(data));
  } catch (error) {
    const status = error.message === "PAYMENT_DECLINED" ? 402 : error.message === "UPSTREAM_TIMEOUT" ? 504 : 503;
    res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error.message }));
  } finally { clearTimeout(timer); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const traces = [], tests = [];
async function request(path) {
  const start = performance.now();
  const r = await fetch(origin + path);
  const data = await r.json();
  const ms = Math.round((performance.now() - start) * 10) / 10;
  // Let pending upstream work settle before measuring pool occupancy.
  if (r.status === 504) await new Promise(r => setTimeout(r, 80));
  const trace = { path, status: r.status, ms, error: data.error, active };
  traces.push(trace); console.log(JSON.stringify({ type: "trace", trace })); return trace;
}
try {
  if (config.scenario === "pool") {
    for (let i = 0; i < 3; i++) await request("/checkout?declined=1");
    const success = await request("/checkout");
    tests.push({ name: "Successful order after three declined payments", pass: success.status === 200, detail: `Expected HTTP 200, received ${success.status}` });
    tests.push({ name: "All database connections released", pass: active === 0, detail: `${active} of 3 connections still held` });
  } else {
    const success = await request("/checkout");
    tests.push({ name: "Payment completes within gateway budget", pass: success.status === 200, detail: `Upstream takes 65 ms; budget ${config.timeoutMs} ms; HTTP ${success.status}` });
    tests.push({ name: "Connection returned after request", pass: active === 0, detail: `${active} connections held` });
  }
  const h = await request("/health");
  tests.push({ name: "Health endpoint returns 200", pass: h.status === 200, detail: `GET /health → ${h.status} (feature target)` });
  console.log(JSON.stringify({ type: "complete", tests, traces, active }));
} finally { server.closeAllConnections(); server.close(); }
