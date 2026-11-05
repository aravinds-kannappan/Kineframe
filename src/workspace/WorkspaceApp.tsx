import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Cpu,
  FileText,
  Glasses,
  GitBranch,
  GitCompareArrows,
  LoaderCircle,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Focus, Scenario, Workspace } from "../../shared/workspace";
import { services } from "../../shared/workspace";
import ServiceMap from "./ServiceMap";
import SpatialRoom from "./SpatialRoom";
import Voice from "./Voice";
import "./workspace.css";
type Panel = "evidence" | "source" | "patch" | "memory";
const memoryKey = "kineframe:memory:v1";
function savedMemory(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(memoryKey) || "[]");
    return Array.isArray(v)
      ? v
          .filter((x) => typeof x === "string")
          .map((x) => x.slice(0, 200))
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export default function WorkspaceApp() {
  const [state, setState] = useState<Workspace | null>(null),
    [panel, setPanel] = useState<Panel>("evidence"),
    [text, setText] = useState(""),
    [notice, setNotice] = useState(""),
    [connecting, setConnecting] = useState(true),
    [online, setOnline] = useState(false),
    [vr, setVR] = useState(false),
    [spoken, setSpoken] = useState(false),
    [memory, setMemory] = useState(""),
    [help, setHelp] = useState(false),
    [sourceFile, setSourceFile] = useState<"source" | "config">("source"),
    [mobileView, setMobileView] = useState("workspace");
  const current = useRef(state);
  current.current = state;
  const generation = useRef(0),
    voice = useRef<HTMLButtonElement | null>(null),
    feed = useRef<HTMLDivElement>(null),
    lastSpoken = useRef(0),
    sending = useRef(false);
  async function request(url: string, method = "GET", body?: unknown) {
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function start(scenario: Scenario, fresh = false) {
    const token = ++generation.current;
    setConnecting(true);
    setNotice("");
    try {
      let next: Workspace | null = null;
      let created = false;
      const prior = !fresh && sessionStorage.getItem("kineframe:session");
      if (prior) {
        try {
          next = await request(`/api/workspace/sessions/${prior}`);
        } catch {}
      }
      if (!next) {
        created = true;
        next = await request("/api/workspace/sessions", "POST", {
          scenario,
          memory: savedMemory(),
        });
      }
      if (token !== generation.current) {
        if (created && next)
          await request(`/api/workspace/sessions/${next.id}`, "DELETE");
        return null;
      }
      sessionStorage.setItem("kineframe:session", next!.id);
      setState(next);
      setPanel("evidence");
      setMemory(next!.memory.join("\n"));
      return next;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not connect");
    } finally {
      if (token === generation.current) setConnecting(false);
    }
  }
  useEffect(() => {
    void start("pool");
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!state?.id) return;
    const events = new EventSource(
      `/api/workspace/sessions/${state.id}/events`,
    );
    events.onopen = () => setOnline(true);
    events.onmessage = (e) => {
      const next = JSON.parse(e.data) as Workspace;
      setState(next);
    };
    events.onerror = () => setOnline(false);
    return () => {
      events.close();
      setOnline(false);
    };
  }, [state?.id]);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [state?.events.length]);
  useEffect(() => {
    const event = state?.events.filter((e) => e.kind === "agent").at(-1);
    if (!event || event.id === lastSpoken.current) return;
    lastSpoken.current = event.id;
    if (spoken && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(event.detail));
    }
  }, [state?.events, spoken]);
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [],
  );
  async function action(body: Record<string, unknown>) {
    const s = current.current;
    if (!s) return;
    setNotice("");
    try {
      await request(`/api/workspace/sessions/${s.id}/action`, "POST", body);
      // SSE is the authoritative state stream. A POST snapshot can arrive after
      // a newer completed-operation event and must never overwrite it.
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    }
  }
  async function send(question: string) {
    if (!question.trim() || sending.current) return;
    sending.current = true;
    setText("");
    setMobileView("agent");
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    try {
      const s = current.current;
      if (!s) return;
      if (s.busy) {
        await request(`/api/workspace/sessions/${s.id}/action`, "POST", {
          type: "stop",
        });
        let stopped = false;
        for (let i = 0; i < 30; i++) {
          const latest = await request(`/api/workspace/sessions/${s.id}`);
          if (!latest.busy) {
            stopped = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!stopped)
          throw new Error(
            "The agent is still stopping. Try again in a moment.",
          );
      }
      await action({ type: "message", text: question });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not send");
    } finally {
      sending.current = false;
    }
  }
  function focus(id: Focus) {
    void action({ type: "focus", focus: id });
    setSourceFile(id === "gateway" ? "config" : "source");
  }
  async function newSession(scenario: Scenario) {
    if (current.current?.busy) return;
    const old = current.current?.id;
    const next = await start(scenario, true);
    if (old && next && next.id !== old)
      void request(`/api/workspace/sessions/${old}`, "DELETE").catch(() => {});
  }
  const currentEvidence =
    state?.evidence?.version === state?.version && !!state?.evidence;
  const incidentPass =
    currentEvidence && state!.evidence!.tests.slice(0, 2).every((t) => t.pass);
  const selected = services.find((s) => s.id === state?.focus);
  const errorCount = state?.evidence?.traces.filter(
    (t) => t.status >= 500,
  ).length;
  const busy = !!state?.busy;
  function exportSession() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            product: "Kineframe",
            exportedAt: new Date().toISOString(),
            ...state,
            id: undefined,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "kineframe-session.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="kf-app">
      <header className="kf-top">
        <a className="kf-brand" href="/" aria-label="Kineframe product home">
          <span className="kf-brand-mark">
            <Box size={23} />
          </span>
          kineframe<span className="kf-alpha">PREVIEW</span>
        </a>
        <div className="kf-project">
          <GitBranch size={14} />
          <span>checkout-lab</span>
          <ChevronRight size={12} />
          <b>Shared workspace</b>
        </div>
        <div className="kf-top-actions">
          <span className={`kf-live ${online ? "connected" : ""}`}>
            <i />
            {online ? "Session live" : "Connecting"}
          </span>
          <button onClick={() => setHelp(true)} title="About this prototype">
            <Settings2 size={17} />
          </button>
          <button
            className="kf-vr-button"
            onClick={() => setVR(true)}
            disabled={!state}
          >
            <Glasses size={16} />
            <span>Spatial room</span>
          </button>
        </div>
      </header>
      <div className="kf-mobile-nav">
        <button
          className={mobileView === "workspace" ? "active" : ""}
          onClick={() => setMobileView("workspace")}
        >
          Workspace
        </button>
        <button
          className={mobileView === "agent" ? "active" : ""}
          onClick={() => setMobileView("agent")}
        >
          Agent {busy ? "• working" : ""}
        </button>
      </div>
      {notice && (
        <div className="kf-notice" role="status">
          {notice}
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className={`kf-layout mobile-${mobileView}`}>
        <aside className="kf-sidebar">
          <div className="kf-side-label">WORKSPACE</div>
          <button
            className="kf-side-active"
            onClick={() => setPanel("evidence")}
          >
            <Activity size={17} />
            Live system<span>4</span>
          </button>
          <button onClick={() => setPanel("source")}>
            <Code2 size={17} />
            Source files<span>2</span>
          </button>
          <button onClick={() => setPanel("patch")}>
            <GitCompareArrows size={17} />
            Changes<span>{state?.proposal ? 1 : 0}</span>
          </button>
          <button
            onClick={() => {
              setMemory(state?.memory.join("\n") || "");
              setPanel("memory");
            }}
          >
            <Cpu size={17} />
            Shared memory<span>{state?.memory.length || 0}</span>
          </button>
          <div className="kf-side-label spaced">INVESTIGATIONS</div>
          <button
            disabled={busy}
            onClick={() => void newSession("pool")}
            className={state?.scenario === "pool" ? "chosen" : ""}
          >
            <span className="kf-small-dot amber" />
            Connection leak
          </button>
          <button
            disabled={busy}
            onClick={() => void newSession("timeout")}
            className={state?.scenario === "timeout" ? "chosen" : ""}
          >
            <span className="kf-small-dot purple" />
            Timeout budget
          </button>
          <div className="kf-side-bottom">
            <div className="kf-local">
              <ShieldCheck size={18} />
              <div>
                Isolated runtime<small>Real code. Local HTTP checks.</small>
              </div>
            </div>
            <a href="/api/brief" target="_blank" rel="noreferrer">
              <FileText size={16} />
              Two-page concept brief
              <ArrowRight size={14} />
            </a>
            <button onClick={exportSession} disabled={!state}>
              <ArrowDownToLine size={16} />
              Export session
            </button>
          </div>
        </aside>
        <main className="kf-main">
          <div className="kf-intro">
            <div>
              <div className="kf-eyebrow">
                BUILD AND DEBUG. TOGETHER IN SPACE.
              </div>
              <h1>One system. Shared understanding.</h1>
              <p>See what your agent sees. Shape what it does next.</p>
            </div>
            <span className="kf-revision">
              rev {String(state?.version || 1).padStart(2, "0")}
            </span>
          </div>
          <div className="kf-session-switch">
            <label>
              Incident{" "}
              <select
                aria-label="Choose incident"
                value={state?.scenario || "pool"}
                disabled={busy || connecting}
                onChange={(e) => void newSession(e.target.value as Scenario)}
              >
                <option value="pool">Connection leak</option>
                <option value="timeout">Timeout budget</option>
              </select>
            </label>
            <button
              disabled={busy || connecting}
              onClick={() => void newSession(state?.scenario || "pool")}
            >
              <RotateCcw size={12} />
              New session
            </button>
          </div>
          <div className="kf-incident">
            <div
              className={`kf-incident-symbol ${incidentPass ? "resolved" : ""}`}
            >
              {incidentPass ? (
                <CheckCircle2 size={21} />
              ) : (
                <Activity size={21} />
              )}
            </div>
            <div>
              <span>
                {incidentPass ? "VERIFIED IN THE DEMO" : "ACTIVE INVESTIGATION"}
              </span>
              <h2>
                {state?.scenario === "timeout"
                  ? "Orders time out before payments complete"
                  : "Checkout fails after declined payments"}
              </h2>
            </div>
            <button
              disabled={busy || !state}
              onClick={() => void action({ type: "verify" })}
            >
              <Play size={13} />
              {busy ? "Running…" : "Run checks"}
            </button>
          </div>
          <div className="kf-metrics">
            <div>
              <span>INCIDENT CHECKS</span>
              <strong>
                {currentEvidence
                  ? `${state!.evidence!.tests.slice(0, 2).filter((t) => t.pass).length}/2`
                  : "—"}
                <small>
                  {currentEvidence
                    ? "verified"
                    : state?.evidence
                      ? "stale"
                      : "not measured"}
                </small>
              </strong>
            </div>
            <div>
              <span>SERVER ERRORS</span>
              <strong>
                {currentEvidence ? errorCount : "—"}
                <small>in latest test run</small>
              </strong>
            </div>
            <div>
              <span>HELD CONNECTIONS</span>
              <strong>
                {currentEvidence ? state!.evidence!.active : "—"}
                <small>of 3 slots</small>
              </strong>
            </div>
            <div>
              <span>AGENT MODE</span>
              <strong className="kf-mode">
                {state?.mode === "hosted" ? "Connected AI" : "Guided"}
                <small>
                  {state?.mode === "hosted"
                    ? "bounded tools"
                    : "built-in playbook"}
                </small>
              </strong>
            </div>
          </div>
          {state ? (
            <ServiceMap state={state} onFocus={focus} />
          ) : (
            <div className="kf-loading">
              <LoaderCircle className="spin" />{" "}
              {connecting
                ? "Preparing your workspace…"
                : "Workspace unavailable"}
              {!connecting && (
                <button onClick={() => void start("pool", true)}>
                  Retry connection
                </button>
              )}
            </div>
          )}
          <section className="kf-detail">
            <div className="kf-tabs">
              {(["evidence", "source", "patch", "memory"] as Panel[]).map(
                (p) => (
                  <button
                    key={p}
                    className={panel === p ? "active" : ""}
                    onClick={() => {
                      setPanel(p);
                      if (p === "memory")
                        setMemory(state?.memory.join("\n") || "");
                    }}
                  >
                    {p === "patch"
                      ? "Changes"
                      : p[0].toUpperCase() + p.slice(1)}
                    {p === "patch" && state?.proposal && <i />}
                  </button>
                ),
              )}
              <span>
                {selected?.name} <ChevronRight size={11} /> rev {state?.version}
              </span>
            </div>
            {panel === "evidence" && (
              <div className="kf-evidence">
                {state?.evidence ? (
                  <>
                    {state.baseline &&
                      state.evidence.version !== state.baseline.version && (
                        <div className="kf-comparison">
                          <span>BASELINE → LATEST RUN</span>
                          <b>
                            {
                              state.baseline.tests
                                .slice(0, 2)
                                .filter((t) => t.pass).length
                            }
                            /2 →{" "}
                            {
                              state.evidence.tests
                                .slice(0, 2)
                                .filter((t) => t.pass).length
                            }
                            /2 incident checks
                          </b>
                          <small>
                            {state.baseline.active} → {state.evidence.active}{" "}
                            held connections
                          </small>
                        </div>
                      )}
                    <div className="kf-evidence-head">
                      <span>
                        HTTP regression run <b>#{state.evidence.version}</b>
                      </span>
                      <span>
                        {currentEvidence
                          ? "Current revision"
                          : "STALE · source has changed"}
                      </span>
                    </div>
                    {state.evidence.tests.map((test, i) => (
                      <div className="kf-test" key={test.name}>
                        <span className={test.pass ? "pass" : "fail"}>
                          {test.pass ? <Check size={14} /> : <X size={14} />}
                        </span>
                        <div>
                          <b>{test.name}</b>
                          <small>{test.detail}</small>
                        </div>
                        <em>{i === 2 ? "FEATURE" : "INCIDENT"}</em>
                      </div>
                    ))}
                    <div className="kf-traces">
                      {state.evidence.traces.map((t, i) => (
                        <div key={i}>
                          <code>{t.status}</code>
                          <span>{t.path}</span>
                          <small>{t.ms} ms</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="kf-empty">
                    <Terminal size={24} />
                    <h3>Evidence starts with a real request.</h3>
                    <p>
                      Run the isolated service to capture HTTP traces and
                      failing checks. Nothing here is a fabricated production
                      metric.
                    </p>
                    <button
                      disabled={busy || !state}
                      className="kf-primary"
                      onClick={() =>
                        void send("Investigate the bug and propose a fix")
                      }
                    >
                      <Play size={14} />
                      Investigate together
                    </button>
                  </div>
                )}
              </div>
            )}
            {panel === "source" && (
              <div className="kf-source">
                <div className="kf-file-switch">
                  <button
                    className={sourceFile === "source" ? "active" : ""}
                    onClick={() => setSourceFile("source")}
                  >
                    service.mjs
                  </button>
                  <button
                    className={sourceFile === "config" ? "active" : ""}
                    onClick={() => setSourceFile("config")}
                  >
                    config.json
                  </button>
                  <span>Isolated working copy</span>
                </div>
                <pre>
                  {(state?.[sourceFile] || "").split("\n").map((line, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <code>{line || " "}</code>
                    </div>
                  ))}
                </pre>
              </div>
            )}
            {panel === "patch" && (
              <div className="kf-patch">
                {state?.proposal ? (
                  <>
                    <div className="kf-patch-head">
                      <div>
                        <span>PROPOSED · {state.proposal.file}</span>
                        <h3>{state.proposal.title}</h3>
                      </div>
                      <span>
                        rev {state.proposal.baseVersion} →{" "}
                        {state.proposal.baseVersion + 1}
                      </span>
                    </div>
                    <p>{state.proposal.reason}</p>
                    <div className="kf-diff">
                      <div>
                        <label>BEFORE</label>
                        <pre>{state.proposal.before}</pre>
                      </div>
                      <div>
                        <label>AFTER</label>
                        <pre>{state.proposal.after}</pre>
                      </div>
                    </div>
                    <div className="kf-patch-actions">
                      <button
                        disabled={busy}
                        onClick={() => void action({ type: "reject" })}
                      >
                        Reject
                      </button>
                      <button
                        disabled={busy}
                        className="kf-primary"
                        onClick={() =>
                          void action({
                            type: "apply",
                            id: state.proposal!.id,
                            version: state.version,
                          })
                        }
                      >
                        <Check size={14} />
                        Apply & verify
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="kf-empty">
                    <GitCompareArrows size={24} />
                    <h3>
                      {state?.fixed
                        ? "Patch applied. Keep building."
                        : "Every change starts with a proposal."}
                    </h3>
                    <p>
                      Review the exact source change before it runs. Build a
                      health endpoint or investigate the incident.
                    </p>
                    <div className="kf-button-row">
                      <button
                        disabled={busy || !state || state.fixed}
                        onClick={() =>
                          void action({
                            type: "propose",
                            kind:
                              state?.scenario === "pool" ? "release" : "budget",
                          })
                        }
                      >
                        Propose incident fix
                      </button>
                      <button
                        disabled={busy || !state || state.health}
                        onClick={() =>
                          void action({ type: "propose", kind: "health" })
                        }
                      >
                        <Plus size={14} />
                        Build health endpoint
                      </button>
                    </div>
                  </div>
                )}
                <button
                  className="kf-rewind"
                  disabled={busy || !state?.canUndo}
                  onClick={() => void action({ type: "undo" })}
                >
                  <RotateCcw size={13} />
                  Rewind last source change
                </button>
              </div>
            )}
            {panel === "memory" && (
              <div className="kf-memory">
                <Cpu size={24} />
                <h3>A working relationship that carries forward.</h3>
                <p>
                  Save up to eight preferences, one per line. They are included
                  in agent context and new sessions on this browser. You control
                  what is remembered.
                </p>
                <textarea
                  aria-label="Agent memory"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder={
                    "Explain the evidence before suggesting a fix.\nPrefer small, reversible patches."
                  }
                />
                <div className="kf-button-row">
                  <button
                    className="kf-primary"
                    onClick={() => {
                      const values = memory
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean);
                      if (
                        values.length > 8 ||
                        values.some((x) => x.length > 200)
                      ) {
                        setNotice(
                          "Use at most 8 preferences, each under 200 characters.",
                        );
                        return;
                      }
                      localStorage.setItem(memoryKey, JSON.stringify(values));
                      void action({ type: "memory", memory: values });
                    }}
                  >
                    Save memory
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem(memoryKey);
                      setMemory("");
                      void action({ type: "memory", memory: [] });
                    }}
                  >
                    <Trash2 size={14} />
                    Forget all
                  </button>
                </div>
                <small>
                  No passive behavioral learning in this prototype. Memory is
                  explicit and editable.
                </small>
              </div>
            )}
          </section>
          <footer className="kf-main-footer">
            <span>
              <ShieldCheck size={12} />
              Demo workspace · no production infrastructure connected
            </span>
            <button onClick={() => setHelp(true)}>
              What works in this preview
              <ArrowRight size={12} />
            </button>
          </footer>
        </main>
        <aside className="kf-agent">
          <div className="kf-agent-title">
            <span className="kf-agent-avatar">
              <Cpu size={20} />
            </span>
            <div>
              <h2>Your engineering partner</h2>
              <span>
                <i className={busy ? "working" : ""} />
                {busy
                  ? "Working in your shared context"
                  : "Ready to investigate together"}
              </span>
            </div>
            <button
              aria-label={spoken ? "Mute agent replies" : "Speak agent replies"}
              onClick={() => {
                if (spoken && "speechSynthesis" in window)
                  speechSynthesis.cancel();
                setSpoken(!spoken);
              }}
            >
              {spoken ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
          <div className="kf-focus-strip">
            <span>SHARED FOCUS</span>
            <b>{selected?.name || "Checkout"}</b>
            <span className="kf-focus-ring" />
          </div>
          <div className="kf-feed" ref={feed} aria-live="polite">
            {state?.events.map((event) => (
              <article className={`kf-event ${event.kind}`} key={event.id}>
                <div className="kf-event-header">
                  <span>
                    {event.kind === "user" ? (
                      <MessageSquare size={13} />
                    ) : event.kind === "agent" ? (
                      <Cpu size={13} />
                    ) : event.kind === "change" ? (
                      <GitCompareArrows size={13} />
                    ) : (
                      <Terminal size={13} />
                    )}
                    <b>{event.title}</b>
                  </span>
                  <time>
                    {new Date(event.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{event.detail}</p>
                {event.title === "Patch ready for your review" &&
                  event.id ===
                    state.events
                      .filter((e) => e.title === "Patch ready for your review")
                      .at(-1)?.id &&
                  state.proposal && (
                    <button
                      onClick={() => {
                        setPanel("patch");
                        setMobileView("workspace");
                      }}
                    >
                      Review proposed change
                      <ArrowRight size={13} />
                    </button>
                  )}
              </article>
            ))}
            {busy && (
              <div className="kf-thinking">
                <span />
                <span />
                <span /> Work is streaming into this room
              </div>
            )}
          </div>
          <div className="kf-composer">
            <div className="kf-prompts">
              <button
                disabled={!state}
                onClick={() =>
                  void send("Investigate the bug and propose a fix")
                }
              >
                Investigate the bug
              </button>
              <button
                disabled={!state}
                onClick={() => void send("Build a health endpoint")}
              >
                Build a feature
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <textarea
                aria-label="Talk to your agent"
                placeholder={
                  busy
                    ? "Interrupt with a new direction…"
                    : "Ask, point, or change direction…"
                }
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
              />
              <div>
                <Voice
                  triggerRef={voice}
                  onQuestion={(q) => void send(q)}
                  onStatus={setNotice}
                  disabled={!state}
                />
                <span>
                  {state?.mode === "hosted"
                    ? "AI + bounded workspace tools"
                    : "Guided playbook · real execution"}
                </span>
                {busy && (
                  <button
                    type="button"
                    aria-label="Interrupt agent"
                    onClick={() => {
                      if ("speechSynthesis" in window) speechSynthesis.cancel();
                      void action({ type: "stop" });
                    }}
                  >
                    <Square size={13} />
                  </button>
                )}
                <button
                  type="submit"
                  className="kf-send"
                  aria-label="Send to agent"
                  disabled={!state || !text.trim()}
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
            <small>Source edits wait for your review. Enter to send.</small>
          </div>
        </aside>
      </div>
      {help && (
        <div className="kf-modal-backdrop">
          <section
            className="kf-modal"
            role="dialog"
            aria-modal="true"
            aria-label="About Kineframe"
          >
            <button
              className="kf-close"
              aria-label="Close workspace guide"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <div className="kf-eyebrow">KINEFRAME / WORKING PROTOTYPE</div>
            <h2>
              Same context.
              <br />
              Better collaboration.
            </h2>
            <p>
              Inspect a service, ask your agent to investigate, review its
              proposed source change, and verify the result together.
            </p>
            <ul>
              <li>
                Real local HTTP requests and regression checks against isolated
                source files.
              </li>
              <li>
                Two incident fixtures and one feature-building task; changes are
                bounded templates.
              </li>
              <li>
                Optional hosted AI through OPENAI_API_KEY. Without a key, the
                interface labels its deterministic playbook.
              </li>
              <li>
                One-question-at-a-time voice input and optional spoken replies.
                This is not full-duplex audio.
              </li>
              <li>
                WebXR spatial room with selectable services, artifact panels and
                action controls. Headset testing is still required.
              </li>
              <li>
                Explicit memory stored in this browser; no passive learning,
                arbitrary-repository access, cloud monitoring or production
                deployments.
              </li>
            </ul>
            <a href="/api/brief" target="_blank" rel="noreferrer">
              Read the two-page concept brief
              <ArrowRight size={15} />
            </a>
            <button className="kf-primary" onClick={() => setHelp(false)}>
              Back to the workspace
            </button>
          </section>
        </div>
      )}
      {vr && state && (
        <SpatialRoom
          state={state}
          onClose={() => setVR(false)}
          onFocus={focus}
          onAction={(body) => void action(body)}
          onVoice={() => voice.current?.click()}
        />
      )}
    </div>
  );
}
