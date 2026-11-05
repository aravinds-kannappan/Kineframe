import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { initialState } from "../shared/simulation";
const port = 3199;
function next(ws: WebSocket, match: (d: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", listen);
      reject(new Error("Timed out waiting for room message"));
    }, 5000);
    function listen(raw: Buffer) {
      const d = JSON.parse(raw.toString());
      if (match(d)) {
        clearTimeout(timer);
        ws.off("message", listen);
        resolve(d);
      }
    }
    ws.on("message", listen);
  });
}
async function connect(id: string, token?: string) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`, {
    origin: `http://localhost:${port}`,
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const joined = next(ws, (d) => d.type === "joined"),
    state = next(ws, (d) => d.type === "state");
  ws.send(JSON.stringify({ type: "join", id, token }));
  return { ws, joined: await joined, state: await state };
}
test(
  "rooms enforce presenter control, synchronize learners, and keep tutor private",
  { timeout: 20000 },
  async () => {
    const server = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts"],
      {
        env: {
          ...process.env,
          PORT: String(port),
          OPENAI_API_KEY: "",
          APP_ORIGIN: "",
        },
        stdio: "pipe",
      },
    );
    const sockets: WebSocket[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        server.stdout.on("data", (d) => {
          if (d.toString().includes("server: http://")) resolve();
        });
        server.once("exit", () => reject(new Error("Server exited early")));
      });
      const res = await fetch(`http://localhost:${port}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: initialState() }),
      });
      assert.equal(res.status, 201);
      const { id, token } = await res.json();
      const p = await connect(id, token);
      sockets.push(p.ws);
      assert.equal(p.joined.presenter, true);
      const l = await connect(id, "wrong-token");
      sockets.push(l.ws);
      assert.equal(l.joined.presenter, false);
      assert.equal(l.state.participants, 2);
      assert.equal(JSON.stringify(l.state).includes(token), false);
      const denied = next(l.ws, (d) => d.type === "error");
      l.ws.send(
        JSON.stringify({
          type: "action",
          action: { type: "parameter", key: "speed", value: 30 },
        }),
      );
      assert.match((await denied).error, /Only the presenter/);
      const update = next(
        l.ws,
        (d) => d.type === "state" && d.state.params.projectile.speed === 25,
      );
      p.ws.send(
        JSON.stringify({
          type: "action",
          action: { type: "parameter", key: "speed", value: 25 },
        }),
      );
      await update;
      const invalid = next(p.ws, (d) => d.type === "error");
      p.ws.send(
        JSON.stringify({
          type: "action",
          action: { type: "parameter", key: "gravity", value: 0 },
        }),
      );
      assert.match((await invalid).error, /outside/);
      let broadcastCount = 0;
      const counter = () => broadcastCount++;
      l.ws.on("message", counter);
      const tutor = await fetch(`http://localhost:${port}/api/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Why gravity?",
          mode: "ask",
          state: initialState(),
        }),
      });
      assert.equal(tutor.status, 200);
      assert.equal((await tutor.json()).source, "guided");
      assert.equal(broadcastCount, 0);
      l.ws.off("message", counter);
      const disconnected = next(
        l.ws,
        (d) => d.type === "state" && !d.presenterOnline,
      );
      p.ws.close();
      assert.equal((await disconnected).state.running, false);
      const resumed = await connect(id, token);
      sockets.push(resumed.ws);
      assert.equal(resumed.joined.presenter, true);
      assert.equal(resumed.state.state.params.projectile.speed, 25);
    } finally {
      sockets.forEach((ws) => ws.close());
      server.kill();
    }
  },
);
