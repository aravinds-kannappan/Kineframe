import { mkdtemp, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import type {
  Evidence,
  PatchKind,
  Scenario,
  Workspace,
  WorkspaceEvent,
} from "../../shared/workspace.js";
const fixture = fileURLToPath(
  new URL("../../fixtures/checkout/", import.meta.url),
);
const fixedSource = `// Connection ownership ends on both success and failure.\nexport function createCheckout(pool, charge) {\n  return async function checkout(declined) {\n    const connection = pool.acquire();\n    try {\n      const receipt = await charge(declined);\n      return { order: "confirmed", receipt };\n    } finally {\n      pool.release(connection);\n    }\n  };\n}\n`;
const healthSource = `\nexport function health() {\n  return { status: "ok", service: "checkout" };\n}\n`;
export class WorkspaceEngine {
  state: Workspace;
  directory = "";
  controller: AbortController | null = null;
  listeners = new Set<(s: Workspace) => void>();
  private history: {
    source: string;
    config: string;
    health: boolean;
    fixed: boolean;
  }[] = [];
  private sequence = 0;
  constructor(scenario: Scenario, memory: string[] = []) {
    this.state = {
      id: randomBytes(24).toString("hex"),
      scenario,
      version: 1,
      focus: "checkout",
      busy: false,
      mode: process.env.OPENAI_API_KEY ? "hosted" : "guided",
      events: [],
      evidence: null,
      baseline: null,
      proposal: null,
      source: "",
      config:
        JSON.stringify(
          { scenario, timeoutMs: scenario === "pool" ? 250 : 25 },
          null,
          2,
        ) + "\n",
      fixed: false,
      health: false,
      memory,
      canUndo: false,
    };
  }
  async init() {
    this.directory = await mkdtemp(path.join(tmpdir(), "kineframe-"));
    this.state.source = await readFile(
      path.join(fixture, "service.mjs"),
      "utf8",
    );
    await copyFile(
      path.join(fixture, "runner.mjs"),
      path.join(this.directory, "runner.mjs"),
    );
    await this.persist();
    this.event(
      "agent",
      "Your workspace is ready",
      "This is an isolated, executable checkout service. Select a service, reproduce the incident, or ask me to build a health endpoint. Changes wait for your review.",
    );
    return this;
  }
  publish() {
    this.listeners.forEach((fn) => fn(this.state));
  }
  event(kind: WorkspaceEvent["kind"], title: string, detail: string) {
    this.state.events.push({
      id: ++this.sequence,
      time: new Date().toISOString(),
      kind,
      title,
      detail,
    });
    this.state.events = this.state.events.slice(-100);
    this.publish();
  }
  async persist() {
    await writeFile(
      path.join(this.directory, "service.mjs"),
      this.state.source,
    );
    await writeFile(
      path.join(this.directory, "config.json"),
      this.state.config,
    );
  }
  async run<T>(fn: (signal: AbortSignal) => Promise<T>) {
    if (this.state.busy)
      throw new Error("An operation is running. Interrupt it first.");
    this.controller = new AbortController();
    this.state.busy = true;
    this.publish();
    try {
      return await fn(this.controller.signal);
    } finally {
      this.controller = null;
      this.state.busy = false;
      this.publish();
    }
  }
  stop() {
    this.controller?.abort();
  }
  async verify(signal: AbortSignal) {
    signal.throwIfAborted();
    const version = this.state.version;
    this.event(
      "tool",
      "Running real HTTP regression checks",
      `node runner.mjs · isolated service · revision ${version}`,
    );
    const result = await new Promise<
      Omit<Evidence, "version" | "time" | "passed" | "total">
    >((resolve, reject) => {
      const child = spawn(process.execPath, ["runner.mjs"], {
        cwd: this.directory,
        env: { PATH: process.env.PATH },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let buffer = "",
        stderr = "",
        complete: any = null;
      const abort = () => child.kill("SIGKILL");
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 10000);
      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        let i;
        while ((i = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, i);
          buffer = buffer.slice(i + 1);
          try {
            const item = JSON.parse(line);
            if (item.type === "trace")
              this.event(
                "result",
                `HTTP ${item.trace.status} · ${item.trace.path}`,
                `${item.trace.ms} ms · ${item.trace.active} held connections${item.trace.error ? " · " + item.trace.error : ""}`,
              );
            if (item.type === "complete") complete = item;
          } catch {
            /* Only structured runner output is accepted. */
          }
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-2000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (signal.aborted)
          reject(new Error("Operation interrupted. No test result recorded."));
        else if (code !== 0 || !complete)
          reject(new Error(stderr || "Test process ended before completion."));
        else resolve(complete);
      });
    });
    signal.throwIfAborted();
    const evidence: Evidence = {
      version,
      time: new Date().toISOString(),
      traces: result.traces,
      tests: result.tests,
      active: result.active,
      passed: result.tests.filter((t) => t.pass).length,
      total: result.tests.length,
    };
    this.state.evidence = evidence;
    this.state.baseline ??= structuredClone(evidence);
    this.event(
      "result",
      `${evidence.passed}/${evidence.total} checks passed`,
      `Measured against revision ${version}. Includes two incident checks and a separate health-endpoint feature check.`,
    );
    return evidence;
  }
  propose(kind: PatchKind) {
    if (kind === "health" && this.state.health)
      throw new Error("The health endpoint already exists.");
    if (kind !== "health" && this.state.fixed)
      throw new Error(
        "The incident patch is already applied. Verify it or rewind.",
      );
    if (
      (kind === "release" && this.state.scenario !== "pool") ||
      (kind === "budget" && this.state.scenario !== "timeout")
    )
      throw new Error("That patch does not match this incident.");
    const file = kind === "budget" ? "config.json" : "service.mjs";
    const before =
      file === "config.json" ? this.state.config : this.state.source;
    const after =
      kind === "budget"
        ? JSON.stringify({ ...JSON.parse(before), timeoutMs: 250 }, null, 2) +
          "\n"
        : kind === "release"
          ? fixedSource + (this.state.health ? healthSource : "")
          : before + healthSource;
    this.state.proposal = {
      id: randomBytes(8).toString("hex"),
      kind,
      baseVersion: this.state.version,
      file,
      before,
      after,
      title:
        kind === "health"
          ? "Build a health endpoint"
          : kind === "release"
            ? "Release connections in finally"
            : "Align the upstream timeout budget",
      reason:
        kind === "health"
          ? "Add GET /health with a JSON service status. The regression suite already contains its acceptance check."
          : kind === "release"
            ? "A declined payment throws before pool.release(). A finally block releases the connection on every exit path."
            : "The configured 25 ms deadline is shorter than the fixture's 65 ms payment call. Use a 250 ms budget and re-run the request. Production timeout choices would also need real latency and cancellation data.",
    };
    this.event(
      "agent",
      "Patch ready for your review",
      this.state.proposal.reason,
    );
  }
  async apply(id: string, version: number) {
    const p = this.state.proposal;
    if (
      !p ||
      p.id !== id ||
      p.baseVersion !== version ||
      version !== this.state.version
    )
      throw new Error("The proposal is stale. Request a fresh patch.");
    const old = {
      source: this.state.source,
      config: this.state.config,
      health: this.state.health,
      fixed: this.state.fixed,
    };
    if (p.file === "service.mjs") this.state.source = p.after;
    else this.state.config = p.after;
    try {
      await this.persist();
    } catch (error) {
      Object.assign(this.state, old);
      throw error;
    }
    this.history.push(old);
    this.history = this.history.slice(-20);
    this.state.health ||= p.kind === "health";
    this.state.fixed ||= p.kind !== "health";
    this.state.version++;
    this.state.canUndo = true;
    this.state.proposal = null;
    this.event(
      "change",
      `Applied ${p.file} · revision ${this.state.version}`,
      "The isolated source file has changed. Previous test evidence is stale until verification finishes.",
    );
  }
  async undo() {
    const last = this.history.at(-1);
    if (!last) throw new Error("Nothing to rewind.");
    const old = {
      source: this.state.source,
      config: this.state.config,
      health: this.state.health,
      fixed: this.state.fixed,
    };
    Object.assign(this.state, last);
    try {
      await this.persist();
    } catch (error) {
      Object.assign(this.state, old);
      throw error;
    }
    this.history.pop();
    this.state.version++;
    this.state.proposal = null;
    this.state.canUndo = !!this.history.length;
    this.event(
      "change",
      `Rewound source · revision ${this.state.version}`,
      "Files restored. Re-run checks to measure this revision.",
    );
  }
  async dispose() {
    this.stop();
    this.listeners.clear();
    await rm(this.directory, { recursive: true, force: true });
  }
}
