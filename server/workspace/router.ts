import { Router } from "express";
import { z } from "zod";
import { WorkspaceEngine } from "./engine.js";
import { agentTurn } from "./agent.js";
export const workspaceRouter = Router();
const sessions = new Map<
  string,
  { engine: WorkspaceEngine; updated: number }
>();
const memories = z.array(z.string().trim().min(1).max(200)).max(8);
workspaceRouter.use((req, res, next) => {
  // A session id is a capability; refuse cross-origin browser access, even without APP_ORIGIN.
  const origin = req.headers.origin;
  if (
    origin &&
    !(process.env.APP_ORIGIN
      ? origin === process.env.APP_ORIGIN
      : [
          `http://${req.headers.host}`,
          `https://${req.headers.host}`,
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ].includes(origin))
  ) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
workspaceRouter.post("/sessions", async (req, res) => {
  const body = z
    .object({
      scenario: z.enum(["pool", "timeout"]),
      memory: memories.optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid workspace request" });
    return;
  }
  if (sessions.size >= 24) {
    res.status(503).json({
      error: "Workspace capacity reached. Close an old session first.",
    });
    return;
  }
  try {
    const engine = await new WorkspaceEngine(
      body.data.scenario,
      body.data.memory,
    ).init();
    sessions.set(engine.state.id, { engine, updated: Date.now() });
    res.status(201).json(engine.state);
  } catch {
    res.status(500).json({ error: "Could not create isolated workspace" });
  }
});
workspaceRouter.use("/sessions/:id", (req, res, next) => {
  const record = sessions.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Session expired. Start a new workspace." });
    return;
  }
  record.updated = Date.now();
  res.locals.engine = record.engine;
  next();
});
workspaceRouter.get("/sessions/:id", (_req, res) =>
  res.json((res.locals.engine as WorkspaceEngine).state),
);
workspaceRouter.get("/sessions/:id/events", (req, res) => {
  const engine = res.locals.engine as WorkspaceEngine;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = () => {
    if (!res.destroyed) res.write(`data: ${JSON.stringify(engine.state)}\n\n`);
  };
  engine.listeners.add(send);
  send();
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
    const record = sessions.get(engine.state.id);
    if (record) record.updated = Date.now();
  }, 20000);
  req.on("close", () => {
    clearInterval(heartbeat);
    engine.listeners.delete(send);
  });
});
workspaceRouter.post("/sessions/:id/action", async (req, res) => {
  const body = z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("message"),
        text: z.string().trim().min(1).max(2000),
      }),
      z.object({
        type: z.literal("focus"),
        focus: z.enum(["gateway", "checkout", "payments", "database"]),
      }),
      z.object({ type: z.literal("memory"), memory: memories }),
      z.object({
        type: z.literal("propose"),
        kind: z.enum(["release", "budget", "health"]),
      }),
      z.object({
        type: z.literal("apply"),
        id: z.string(),
        version: z.number().int().positive(),
      }),
      z.object({ type: z.enum(["verify", "stop", "undo", "reject"]) }),
    ])
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Unsupported workspace action" });
    return;
  }
  const engine = res.locals.engine as WorkspaceEngine,
    a = body.data;
  if (a.type === "stop") {
    engine.stop();
    res.json(engine.state);
    return;
  }
  if (a.type === "focus") {
    engine.state.focus = a.focus;
    engine.publish();
    res.json(engine.state);
    return;
  }
  if (a.type === "memory") {
    engine.state.memory = a.memory;
    engine.event(
      "change",
      "Memory updated by you",
      `${a.memory.length} explicit preferences. You can edit or forget them at any time.`,
    );
    res.json(engine.state);
    return;
  }
  if (engine.state.busy) {
    res.status(409).json({
      error: "Operation in progress. Interrupt before changing direction.",
    });
    return;
  }
  // Mark busy synchronously, then stream real activity through SSE.
  const job = engine.run(async (signal) => {
    if (a.type === "message") await agentTurn(engine, a.text, signal);
    else if (a.type === "verify") await engine.verify(signal);
    else if (a.type === "propose") engine.propose(a.kind);
    else if (a.type === "apply") {
      await engine.apply(a.id, a.version);
      if (!signal.aborted) await engine.verify(signal);
    } else if (a.type === "undo") await engine.undo();
    else if (a.type === "reject") {
      engine.state.proposal = null;
      engine.event(
        "user",
        "Proposal rejected",
        "Source files unchanged. Tell the agent what to try next.",
      );
    }
  });
  res.status(202).json(engine.state);
  void job.catch((error) =>
    engine.event(
      "error",
      "Operation stopped",
      error instanceof Error ? error.message : "Operation failed",
    ),
  );
});
workspaceRouter.delete("/sessions/:id", async (_req, res) => {
  const engine = res.locals.engine as WorkspaceEngine;
  if (engine.state.busy) {
    res
      .status(409)
      .json({ error: "Interrupt and wait before closing this session." });
    return;
  }
  sessions.delete(engine.state.id);
  await engine.dispose();
  res.status(204).end();
});
setInterval(() => {
  for (const [id, record] of sessions)
    if (!record.engine.state.busy && Date.now() - record.updated > 30 * 60000) {
      sessions.delete(id);
      void record.engine.dispose();
    }
}, 60000).unref();
