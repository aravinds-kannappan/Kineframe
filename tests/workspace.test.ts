import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkspaceEngine } from "../server/workspace/engine.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
test("pool incident executes real HTTP requests, patches source, builds endpoint, and rewinds", async () => {
  const w = await new WorkspaceEngine("pool").init();
  try {
    const before = await w.run((s) => w.verify(s));
    assert.equal(before.active, 3);
    assert.equal(before.passed, 0);
    assert.equal(before.traces[3].status, 503);
    w.propose("release");
    const p = w.state.proposal!;
    assert.match(p.after, /finally/);
    assert.doesNotMatch(w.state.source, /finally/);
    await assert.rejects(w.apply(p.id, 999), /stale/);
    await w.run(async (s) => {
      await w.apply(p.id, p.baseVersion);
      await w.verify(s);
    });
    assert.equal(w.state.evidence!.passed, 2);
    assert.equal(w.state.evidence!.active, 0);
    assert.equal(w.state.baseline!.active, 3);
    assert.equal(
      await readFile(path.join(w.directory, "service.mjs"), "utf8"),
      p.after,
    );
    w.propose("health");
    const h = w.state.proposal!;
    await w.run(async (s) => {
      await w.apply(h.id, h.baseVersion);
      await w.verify(s);
    });
    assert.equal(w.state.evidence!.passed, 3);
    assert.equal(w.state.evidence!.traces.at(-1)!.status, 200);
    await w.run(async () => w.undo());
    assert.equal(w.state.health, false);
    assert.equal(w.state.fixed, true);
    assert.notEqual(w.state.evidence!.version, w.state.version);
    await w.run((s) => w.verify(s));
    assert.equal(w.state.evidence!.passed, 2);
  } finally {
    await w.dispose();
  }
});
test("timeout incident measures a failed deadline then verifies the configuration patch", async () => {
  const w = await new WorkspaceEngine("timeout").init();
  try {
    await w.run((s) => w.verify(s));
    assert.equal(w.state.evidence!.traces[0].status, 504);
    assert.throws(() => w.propose("release"), /does not match/);
    w.propose("budget");
    const p = w.state.proposal!;
    await w.run(async (s) => {
      await w.apply(p.id, p.baseVersion);
      await w.verify(s);
    });
    assert.equal(w.state.evidence!.traces[0].status, 200);
    assert.equal(w.state.evidence!.passed, 2);
    assert.equal(
      JSON.parse(await readFile(path.join(w.directory, "config.json"), "utf8"))
        .timeoutMs,
      250,
    );
  } finally {
    await w.dispose();
  }
});
test("interruption kills a real runner, never records partial results, and permits a new run", async () => {
  const w = await new WorkspaceEngine("timeout").init();
  try {
    const job = w.run((s) => w.verify(s));
    await assert.rejects(
      w.run((s) => w.verify(s)),
      /operation is running/,
    );
    w.stop();
    await assert.rejects(job, /interrupted/);
    assert.equal(w.state.evidence, null);
    assert.equal(w.state.busy, false);
    await w.run((s) => w.verify(s));
    assert.ok(w.state.evidence);
  } finally {
    await w.dispose();
  }
});
test("workspaces isolate source changes and keep preferences explicit", async () => {
  const a = await new WorkspaceEngine("pool", [
      "Explain evidence first",
    ]).init(),
    b = await new WorkspaceEngine("pool").init();
  try {
    a.propose("health");
    await a.apply(a.state.proposal!.id, 1);
    assert.notEqual(a.directory, b.directory);
    assert.equal(b.state.health, false);
    assert.doesNotMatch(b.state.source, /export function health/);
    assert.deepEqual(a.state.memory, ["Explain evidence first"]);
    assert.deepEqual(b.state.memory, []);
    await assert.rejects(a.apply("old-proposal", 1), /stale/);
  } finally {
    await a.dispose();
    await b.dispose();
  }
});
