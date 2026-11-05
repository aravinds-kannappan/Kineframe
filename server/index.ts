import { workspaceRouter } from "./workspace/router.js";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app = express();
app.disable("x-powered-by");
// Opt in behind Render's trusted reverse proxy so visitors have separate limits.
if (process.env.TRUST_PROXY_HOPS === "1") app.set("trust proxy", 1);
app.use(express.json({ limit: "128kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (
    process.env.APP_ORIGIN &&
    req.headers.origin &&
    req.headers.origin !== process.env.APP_ORIGIN
  ) {
    res.status(403).json({ error: "Origin is not allowed." });
    return;
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    agent: process.env.OPENAI_API_KEY ? "hosted" : "guided",
  }),
);
const requests = new Map<string, { count: number; reset: number }>();
app.use("/api", (req, res, next) => {
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown",
    now = Date.now();
  let record = requests.get(key);
  if (!record || record.reset < now) {
    record = { count: 0, reset: now + 60000 };
    requests.set(key, record);
  }
  if (++record.count > 60) {
    res
      .status(429)
      .json({ error: "Too many requests. Try again in a minute." });
    return;
  }
  next();
});
setInterval(() => {
  for (const [key, record] of requests)
    if (record.reset < Date.now()) requests.delete(key);
}, 60000).unref();
app.use("/api/workspace", workspaceRouter);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.get("/api/brief", (_req, res) =>
  res.sendFile(
    path.resolve(root, "../output/pdf/Kineframe_Two_Page_Brief.pdf"),
  ),
);
// Removed APIs must return JSON 404s, never the frontend shell.
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use(express.static(root));
app.get(["/", "/workspace", "/workspace/"], (_req, res) =>
  res.sendFile(path.join(root, "index.html")),
);
app.use((_req, res) => res.status(404).sendFile(path.join(root, "index.html")));
createServer(app).listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log(`Kineframe server: http://localhost:${process.env.PORT || 3001}`),
);
