import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { starterBoard } from "../shared/circuitLab";
test(
  "circuit assistant previews validated changes and rejects invalid inputs",
  { timeout: 15000 },
  async () => {
    const port = 3198,
      server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
        env: {
          ...process.env,
          PORT: String(port),
          OPENAI_API_KEY: "",
          APP_ORIGIN: "",
        },
        stdio: "pipe",
      });
    try {
      await new Promise<void>((resolve, reject) => {
        server.stdout.on("data", (d) => {
          if (d.toString().includes("Mindscope server")) resolve();
        });
        server.once("exit", () => reject(new Error("Server failed")));
      });
      const send = (body: unknown) =>
        fetch(`http://localhost:${port}/api/circuit-assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      const board = starterBoard(),
        body = {
          question: "add a parallel resistor",
          board,
          selected: "R1",
          mode: "experiment",
        };
      const response = await send(body);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.source, "guided");
      assert.equal(result.plan.operations.length, 3);
      assert.ok(Math.abs(result.preview.current - 0.24) < 1e-8);
      assert.equal(board.parts.length, 4);
      const ask = await send({ ...body, mode: "ask" });
      assert.equal((await ask.json()).plan, null);
      const unsupported = await send({
        ...body,
        question: "invent a transistor model",
      });
      assert.equal((await unsupported.json()).plan, null);
      const invalid = await send({
        ...body,
        board: { ...board, wires: [{ id: "bad", a: "missing:a", b: "B1:b" }] },
      });
      assert.equal(invalid.status, 400);
      const outOfBounds = await send({
        ...body,
        question: "set voltage to 100",
      });
      assert.equal(outOfBounds.status, 422);
    } finally {
      server.kill();
    }
  },
);
