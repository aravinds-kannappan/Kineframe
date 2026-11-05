import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test(
  "workspace API streams authoritative state, rejects invalid actions and isolates sessions",
  { timeout: 15000 },
  async () => {
    const server = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts"],
      {
        env: {
          ...process.env,
          PORT: "3197",
          OPENAI_API_KEY: "",
          APP_ORIGIN: "",
        },
        stdio: "pipe",
      },
    );
    const origin = "http://127.0.0.1:3197";
    const call = (
      url: string,
      body?: unknown,
      method = body ? "POST" : "GET",
    ) =>
      fetch(origin + "/api/workspace" + url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Server startup timed out")),
          4000,
        );
        server.stdout.on("data", (d) => {
          if (d.toString().includes("server: http://")) {
            clearTimeout(timer);
            resolve();
          }
        });
        server.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Server failed"));
        });
      });
      const rejected = await fetch(origin + "/api/workspace/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({ scenario: "pool" }),
      });
      assert.equal(rejected.status, 403);
      assert.equal(
        (await call("/sessions", { scenario: "invalid" })).status,
        400,
      );
      const s = await (await call("/sessions", { scenario: "pool" })).json();
      assert.equal(s.mode, "guided");
      const url = "/sessions/" + s.id;
      assert.equal(
        (await call(url + "/action", { type: "execute", command: "anything" }))
          .status,
        400,
      );
      const ac = new AbortController();
      const stream = await fetch(origin + "/api/workspace" + url + "/events", {
        signal: ac.signal,
      });
      assert.match(stream.headers.get("content-type")!, /text\/event-stream/);
      const reader = stream.body!.getReader();
      const first = await reader.read();
      assert.match(
        new TextDecoder().decode(first.value),
        /Your workspace is ready/,
      );
      ac.abort();
      await reader.cancel().catch(() => {});
      await call(url + "/action", { type: "focus", focus: "database" });
      await call(url + "/action", {
        type: "memory",
        memory: ["Explain evidence first"],
      });
      assert.equal(
        (
          await call(url + "/action", {
            type: "message",
            text: "Investigate the bug",
          })
        ).status,
        202,
      );
      let state = s;
      for (let i = 0; i < 40; i++) {
        state = await (await call(url)).json();
        if (!state.busy) break;
        await new Promise((r) => setTimeout(r, 30));
      }
      assert.equal(state.busy, false);
      assert.equal(state.focus, "database");
      assert.equal(state.evidence.active, 3);
      assert.equal(state.proposal.kind, "release");
      assert.deepEqual(state.memory, ["Explain evidence first"]);
      await call(url + "/action", {
        type: "apply",
        id: state.proposal.id,
        version: 999,
      });
      for (let i = 0; i < 10; i++) {
        state = await (await call(url)).json();
        if (!state.busy) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.equal(state.version, 1);
      assert.match(state.events.at(-1).detail, /stale/);
      assert.equal((await call(url, undefined, "DELETE")).status, 204);
      assert.equal((await call(url)).status, 404);
    } finally {
      server.kill();
    }
  },
);
