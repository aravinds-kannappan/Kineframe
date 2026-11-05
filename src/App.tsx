import { describeElement } from "../shared/inspection";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  Copy,
  Expand,
  FlaskConical,
  Focus,
  Lightbulb,
  Link,
  LoaderCircle,
  MessageCircle,
  Minus,
  MousePointer2,
  Network,
  Orbit,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  applyAction,
  checkpoint,
  circuit,
  explain,
  forward,
  initialState,
  loss,
  projectile,
  readCheckpoint,
  samples,
  targets,
  tick,
  type Action,
  type Concept,
  type State,
} from "../shared/simulation";
import Scene, { type ViewControls } from "./components/Scene";
import Hands from "./components/Hands";
const modules: Record<
  Concept,
  {
    name: string;
    category: string;
    description: string;
    icon: typeof Orbit;
    number: string;
  }
> = {
  projectile: {
    name: "Projectile motion",
    category: "PHYSICS",
    description: "A little curiosity. A different trajectory.",
    icon: Orbit,
    number: "01",
  },
  circuit: {
    name: "Electrical circuits",
    category: "ELECTRONICS",
    description: "Make a connection. See what flows.",
    icon: Zap,
    number: "02",
  },
  network: {
    name: "Neural networks",
    category: "MACHINE LEARNING",
    description: "Small network. A whole new way to learn.",
    icon: Network,
    number: "03",
  },
};
type Room = { id: string; token?: string };
type Chat = { role: "user" | "assistant"; text: string; source?: string };
function readRoom(): Room | null {
  const id = new URLSearchParams(location.search).get("room");
  if (!id) return null;
  let token;
  try {
    token = sessionStorage.getItem(`mindscope:${id}`) || undefined;
  } catch {}
  return { id, token };
}
function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export default function App() {
  const [state, setState] = useState(initialState),
    [room, setRoom] = useState<Room | null>(readRoom),
    [connected, setConnected] = useState(false),
    [presenter, setPresenter] = useState(false),
    [participants, setParticipants] = useState(1),
    [presenterOnline, setPresenterOnline] = useState(false),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<"room" | "notes" | null>(null),
    [joinId, setJoinId] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<"controls" | "insights">("controls"),
    [inspected, setInspected] = useState<{
      concept: Concept;
      element: string;
    } | null>(null),
    [chat, setChat] = useState<Chat[]>([]),
    [question, setQuestion] = useState(""),
    [asking, setAsking] = useState(false),
    [mode, setMode] = useState<"ask" | "command">("ask"),
    [tutor, setTutor] = useState("guided"),
    [copied, setCopied] = useState(false);
  const stateRef = useRef(state),
    socket = useRef<WebSocket | null>(null),
    controls = useRef<ViewControls | null>(null),
    file = useRef<HTMLInputElement>(null),
    stage = useRef<HTMLDivElement>(null),
    chatEnd = useRef<HTMLDivElement>(null);
  stateRef.current = state;
  const editable = !room || (connected && presenter),
    current = modules[state.concept],
    Icon = current.icon;
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setTutor(d.tutor))
      .catch(() =>
        setNotice("Room server is offline. Local experiments still work."),
      );
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [chat, asking]);
  useEffect(() => {
    if (room) return;
    const timer = setInterval(() => setState((s) => tick(s, 0.05)), 50);
    return () => clearInterval(timer);
  }, [room]);
  useEffect(() => {
    if (!room) return;
    let stopped = false,
      retry: ReturnType<typeof setTimeout>;
    function connect() {
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      );
      socket.current = ws;
      ws.onopen = () =>
        ws.send(
          JSON.stringify({ type: "join", id: room!.id, token: room!.token }),
        );
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "joined") {
          setConnected(true);
          setPresenter(data.presenter);
        }
        if (data.type === "state") {
          setState(data.state);
          setParticipants(data.participants);
          setPresenterOnline(data.presenterOnline);
        }
        if (data.type === "error") setNotice(data.error);
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (!stopped && e.code !== 1008) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => setConnected(false);
    }
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
      setConnected(false);
      setPresenter(false);
    };
  }, [room]);
  function act(action: Action) {
    if (!editable) {
      setNotice(
        "The presenter controls this lesson. Your viewpoint and tutor are private.",
      );
      return;
    }
    try {
      applyAction(stateRef.current, action);
      if (room) {
        if (socket.current?.readyState !== WebSocket.OPEN)
          throw new Error("Room is reconnecting.");
        socket.current.send(JSON.stringify({ type: "action", action }));
      } else setState((s) => applyAction(s, action));
    } catch {
      setNotice("That value is outside the supported lesson controls.");
    }
  }
  useEffect(() => {
    const handler = (event: Event) => {
      const { key, value } = (event as CustomEvent).detail;
      act({ type: "parameter", key, value });
    };
    document.addEventListener("mindscope:hand-range", handler);
    return () => document.removeEventListener("mindscope:hand-range", handler);
  });
  function select(concept: Concept) {
    act({ type: "select", concept });
    setTab("controls");
  }
  function save() {
    const blob = new Blob([JSON.stringify(checkpoint(state), null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindscope-${state.concept}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Checkpoint saved. Import it to restore this experiment.");
  }
  async function load(f?: File) {
    if (!f) return;
    try {
      if (f.size > 128 * 1024) throw new Error();
      act({
        type: "import",
        state: readCheckpoint(JSON.parse(await f.text())),
      });
      setNotice("Checkpoint restored.");
    } catch {
      setNotice(
        "Invalid checkpoint. Choose a Mindscope version 1 JSON file under 128 KB.",
      );
    }
    if (file.current) file.current.value = "";
  }
  async function createRoom() {
    setBusy(true);
    try {
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      try {
        sessionStorage.setItem(`mindscope:${d.id}`, d.token);
      } catch {}
      history.replaceState(null, "", `?room=${d.id}`);
      setRoom(d);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create room.");
    } finally {
      setBusy(false);
    }
  }
  function join() {
    const id = joinId.trim().toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(id)) {
      setNotice("Enter an 8-character room code.");
      return;
    }
    history.replaceState(null, "", `?room=${id}`);
    setRoom({ id });
    setModal(null);
  }
  function leave() {
    setRoom(null);
    setState((s) => ({ ...s, running: false }));
    history.replaceState(null, "", location.pathname);
    setModal(null);
    setNotice("You are now in a private workspace.");
  }
  async function ask(text = question) {
    if (!text.trim() || asking) return;
    if (mode === "command" && !editable) return;
    const snapshot = stateRef.current;
    setQuestion("");
    setChat((c) => [...c, { role: "user", text }]);
    setAsking(true);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, state: snapshot, mode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (data.action) {
        if (stateRef.current.concept !== snapshot.concept)
          throw new Error(
            "The scene changed while the command was processing. Please try again.",
          );
        act(data.action);
      }
      setChat((c) => [
        ...c,
        { role: "assistant", text: data.answer, source: data.source },
      ]);
    } catch (e) {
      setChat((c) => [
        ...c,
        {
          role: "assistant",
          text: e instanceof Error ? e.message : "Could not reach the tutor.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }
  const p = projectile(state.params.projectile),
    c = circuit(state.params.circuit),
    n = state.network,
    f = forward(n, samples[state.params.network.sample]);
  const metrics =
    state.concept === "projectile"
      ? [
          ["Horizontal range", p.range.toFixed(2), "m"],
          ["Maximum height", p.height.toFixed(2), "m"],
          ["Flight time", p.flight.toFixed(2), "s"],
        ]
      : state.concept === "circuit"
        ? [
            ["Total current", c.current.toFixed(3), "A"],
            ["Equivalent resistance", c.resistance.toFixed(2), "Ω"],
            ["Total power", c.power.toFixed(2), "W"],
          ]
        : [
            ["Training epochs", n.epoch.toLocaleString(), ""],
            ["Cross-entropy loss", loss(n).toFixed(4), ""],
            ["Prediction", f.output.toFixed(3), ""],
          ];
  function slider(
    label: string,
    key:
      "speed" | "angle" | "gravity" | "voltage" | "r1" | "r2" | "learningRate",
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) {
    return (
      <label className="slider-field">
        <span>
          {label}
          <strong>
            {value}
            <small> {unit}</small>
          </strong>
        </span>
        <input
          aria-label={label}
          data-parameter={key}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={!editable}
          style={
            {
              "--progress": `${((value - min) / (max - min)) * 100}%`,
            } as React.CSSProperties
          }
          onChange={(e) =>
            act({ type: "parameter", key, value: Number(e.target.value) })
          }
        />
        <span className="range-label">
          <span>
            {min} {unit}
          </span>
          <span>
            {max} {unit}
          </span>
        </span>
      </label>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Mindscope home">
          <span className="brand-mark">
            <Box size={24} />
          </span>
          mindscope<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          <span className="avatar">M</span>
          <div>
            Learning workspace<small>Your ideas, in motion</small>
          </div>
        </div>
        <p className="eyebrow sidebar-label">WORKSPACE</p>
        <div className="nav-active">
          <FlaskConical size={18} /> Explore lab <span>3</span>
        </div>
        <button className="nav-item" onClick={() => setModal("notes")}>
          <BookOpen size={18} /> Lesson guide <ArrowUpRight size={14} />
        </button>
        <button className="nav-item" onClick={() => setModal("room")}>
          <Users size={18} /> Live classroom
        </button>
        <p className="eyebrow sidebar-label concept-label">CONCEPT LIBRARY</p>
        <div className="concept-nav">
          {(Object.keys(modules) as Concept[]).map((key) => {
            const m = modules[key],
              I = m.icon;
            return (
              <button
                key={key}
                disabled={!editable}
                onClick={() => select(key)}
                className={state.concept === key ? "active" : ""}
              >
                <I size={18} />
                <span>
                  {m.name}
                  <small>{m.category.toLowerCase()}</small>
                </span>
                {state.concept === key && <span className="active-dot" />}
              </button>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <div className="vision-icon">
            <Orbit size={27} />
          </div>
          <p>
            Big ideas.
            <br />
            Hands-on understanding.
          </p>
          <span>
            The future of learning starts
            <br />
            with a little exploration.
          </span>
          <button onClick={() => setModal("notes")}>
            Meet your workspace <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Browser lab <span>v0.1</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <a href="/">The experience</a>
            <ChevronRight size={13} />
            Workspace <ChevronRight size={13} />
            <span>Explore lab</span>
          </div>
          <div className="topbar-actions">
            <span
              className={`room-status ${room && !connected ? "offline" : ""}`}
            >
              {room ? (
                connected ? (
                  <Radio size={13} />
                ) : (
                  <WifiOff size={13} />
                )
              ) : (
                <span className="status-dot" />
              )}
              {room
                ? connected
                  ? `${presenter ? "Presenting" : "Following"} · ${participants} online`
                  : "Room disconnected"
                : "Private workspace"}
            </span>
            <button
              className="button share-button"
              onClick={() => setModal("room")}
            >
              <Users size={16} />
              {room ? "Room details" : "Start a live room"}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="intro">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> THE INTERACTIVE LEARNING LAB
              </div>
              <h1>
                Don’t just learn it. <em>Move it.</em>
              </h1>
              <p>
                Explore an idea. Change a variable. See understanding happen.
              </p>
            </div>
            <button className="text-button" onClick={() => setModal("notes")}>
              <BookOpen size={16} /> How to explore <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="module-cards">
            {(Object.keys(modules) as Concept[]).map((key) => {
              const m = modules[key],
                I = m.icon;
              return (
                <button
                  key={key}
                  disabled={!editable}
                  className={`module-card ${state.concept === key ? "active" : ""}`}
                  onClick={() => select(key)}
                >
                  <span className="module-icon">
                    <I size={21} />
                  </span>
                  <span className="module-text">
                    <span className="eyebrow">{m.category}</span>
                    <strong>{m.name}</strong>
                  </span>
                  <span className="module-number">
                    {state.concept === key ? (
                      <ArrowUpRight size={20} />
                    ) : (
                      m.number
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="lab-layout">
            <section className="experiment">
              <div className="experiment-header">
                <div>
                  <span className="eyebrow">EXPERIMENT {current.number}</span>
                  <h2>{current.name}</h2>
                </div>
                <div className="scene-badge">
                  <span className="status-dot" />{" "}
                  {room ? "Shared scene" : "Live simulation"}
                </div>
              </div>
              <div className="stage" ref={stage}>
                <div className="stage-top">
                  <span>
                    <Box size={13} /> 3D WORKSPACE
                  </span>
                  <span>
                    {state.concept === "projectile"
                      ? "IDEAL CONDITIONS · NO AIR RESISTANCE"
                      : state.concept === "circuit"
                        ? "IDEAL DC · FLOW NOT TO SCALE"
                        : "XOR · BATCH GRADIENT DESCENT"}
                  </span>
                </div>
                <Scene
                  state={state}
                  controlsRef={controls}
                  onInspect={(element) => {
                    setInspected({ concept: state.concept, element });
                    setTab("insights");
                  }}
                />
                <div className="axis-label">
                  <span>Y</span>
                  <i />X <small>Z</small>
                </div>
                <div className="view-toolbar">
                  <IconButton
                    label="Zoom in"
                    onClick={() => controls.current?.zoom(0.85)}
                  >
                    <Plus size={17} />
                  </IconButton>
                  <IconButton
                    label="Zoom out"
                    onClick={() => controls.current?.zoom(1.15)}
                  >
                    <Minus size={17} />
                  </IconButton>
                  <span />
                  <IconButton
                    label="Reset camera"
                    onClick={() => controls.current?.reset()}
                  >
                    <Focus size={17} />
                  </IconButton>
                  <IconButton
                    label="Fullscreen simulation"
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen();
                      else
                        stage.current
                          ?.requestFullscreen()
                          .catch(() =>
                            setNotice(
                              "Fullscreen is unavailable in this browser.",
                            ),
                          );
                    }}
                  >
                    <Expand size={16} />
                  </IconButton>
                </div>
                <div className="stage-hint">
                  <MousePointer2 size={12} /> Drag to orbit <span>·</span>{" "}
                  Scroll to zoom
                </div>
              </div>
              <div className="playback">
                <button
                  className="play-button"
                  disabled={!editable}
                  onClick={() => act({ type: "play" })}
                >
                  {state.running ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                  {state.running
                    ? "Pause"
                    : state.concept === "network"
                      ? "Train network"
                      : state.concept === "circuit"
                        ? "Run circuit"
                        : "Launch"}
                </button>
                <button
                  className="reset-button"
                  disabled={!editable}
                  onClick={() => act({ type: "reset" })}
                >
                  <RotateCcw size={15} /> Reset
                </button>
                <div className="playback-track">
                  <div
                    style={{
                      width: `${state.concept === "projectile" ? (state.time / p.flight) * 100 : state.running ? 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="time-label">
                  {state.concept === "network"
                    ? `${n.epoch} epochs`
                    : `${state.time.toFixed(2)} s`}
                </span>
                <Hands controlsRef={controls} />
              </div>
              <div className="metrics">
                {metrics.map(([label, value, unit]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>
                      {value}
                      <small>{unit}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="experiment-footer">
                <span>
                  <span className="status-dot" />
                  {room
                    ? "Synced scene · your viewpoint is private"
                    : "Computed live, not pre-recorded"}
                </span>
                <span>
                  {state.concept === "projectile"
                    ? "x = v₀ cos(θ)t"
                    : state.concept === "circuit"
                      ? "I = V / R"
                      : "w ← w − η∇L"}
                </span>
              </div>
            </section>
            <aside className="inspector">
              <div className="inspector-tabs">
                <button
                  className={tab === "controls" ? "active" : ""}
                  onClick={() => setTab("controls")}
                >
                  <Settings2 size={15} /> Controls
                </button>
                <button
                  className={tab === "insights" ? "active" : ""}
                  onClick={() => setTab("insights")}
                >
                  <Lightbulb size={15} /> Insights
                </button>
              </div>
              <div className="inspector-body">
                {!editable && (
                  <div className="learner-note">
                    {presenterOnline
                      ? "You’re following the presenter."
                      : "Waiting for the presenter to reconnect."}{" "}
                    Orbit the scene or ask your private tutor.
                  </div>
                )}
                {tab === "controls" ? (
                  <>
                    <div className="section-title">
                      <h3>Make it your experiment</h3>
                      <span>Adjust. Observe. Understand.</span>
                    </div>
                    {state.concept === "projectile" ? (
                      <>
                        {slider(
                          "Launch speed",
                          "speed",
                          state.params.projectile.speed,
                          1,
                          40,
                          1,
                          "m/s",
                        )}
                        {slider(
                          "Launch angle",
                          "angle",
                          state.params.projectile.angle,
                          5,
                          85,
                          1,
                          "°",
                        )}
                        {slider(
                          "Gravity",
                          "gravity",
                          state.params.projectile.gravity,
                          1,
                          25,
                          0.01,
                          "m/s²",
                        )}
                        <div className="planet-presets">
                          {[
                            ["Earth", 9.81],
                            ["Moon", 1.62],
                            ["Mars", 3.71],
                          ].map(([name, value]) => (
                            <button
                              disabled={!editable}
                              key={name}
                              className={
                                state.params.projectile.gravity === value
                                  ? "selected"
                                  : ""
                              }
                              onClick={() =>
                                act({
                                  type: "parameter",
                                  key: "gravity",
                                  value: Number(value),
                                })
                              }
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <div className="compare-box">
                          <span>Try a different trajectory</span>
                          <p>
                            Keep this path, change a variable,
                            <br />
                            and see the difference.
                          </p>
                          <button
                            className="outline-button"
                            disabled={!editable}
                            onClick={() => act({ type: "compare" })}
                          >
                            <Plus size={14} /> Save comparison{" "}
                            <span>{state.comparisons.length}/3</span>
                          </button>
                          {state.comparisons.length > 0 && (
                            <button
                              className="text-button clear"
                              disabled={!editable}
                              onClick={() => act({ type: "clearComparisons" })}
                            >
                              Clear saved paths
                            </button>
                          )}
                        </div>
                      </>
                    ) : state.concept === "circuit" ? (
                      <>
                        <label className="field-label">Circuit topology</label>
                        <div className="segmented">
                          {["Series", "Parallel"].map((label, i) => (
                            <button
                              key={label}
                              disabled={!editable}
                              className={
                                Number(state.params.circuit.parallel) === i
                                  ? "selected"
                                  : ""
                              }
                              onClick={() =>
                                act({
                                  type: "parameter",
                                  key: "parallel",
                                  value: !!i,
                                })
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {slider(
                          "Battery voltage",
                          "voltage",
                          state.params.circuit.voltage,
                          1,
                          24,
                          1,
                          "V",
                        )}
                        {slider(
                          "Resistor R₁",
                          "r1",
                          state.params.circuit.r1,
                          1,
                          100,
                          1,
                          "Ω",
                        )}
                        {slider(
                          "Resistor R₂",
                          "r2",
                          state.params.circuit.r2,
                          1,
                          100,
                          1,
                          "Ω",
                        )}
                        <div className="equation-box">
                          <span>OHM’S LAW</span>
                          <strong>I = V / R</strong>
                          <p>
                            {state.params.circuit.parallel
                              ? "Parallel branches share voltage."
                              : "Series components share current."}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {slider(
                          "Learning rate",
                          "learningRate",
                          state.params.network.learningRate,
                          0.01,
                          3,
                          0.01,
                          "η",
                        )}
                        <label className="field-label">
                          Inspect an input pair
                        </label>
                        <div className="sample-grid">
                          {samples.map((s, i) => (
                            <button
                              key={i}
                              disabled={!editable}
                              className={
                                state.params.network.sample === i
                                  ? "selected"
                                  : ""
                              }
                              onClick={() =>
                                act({
                                  type: "parameter",
                                  key: "sample",
                                  value: i,
                                })
                              }
                            >
                              {s.join(" ⊕ ")} <span>→ {targets[i]}</span>
                            </button>
                          ))}
                        </div>
                        <div className="loss-chart">
                          <span>
                            TRAINING LOSS <strong>{loss(n).toFixed(4)}</strong>
                          </span>
                          <svg
                            viewBox="0 0 240 85"
                            role="img"
                            aria-label="Binary cross-entropy training loss history"
                          >
                            <path
                              d="M0 20H240M0 50H240M0 80H240"
                              stroke="#30392f"
                              strokeDasharray="3 4"
                            />
                            {n.history.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#c8f582"
                                strokeWidth="2"
                                points={n.history
                                  .map(
                                    (v, i) =>
                                      `${(i / (n.history.length - 1)) * 240},${80 - Math.min(v, 1) * 70}`,
                                  )
                                  .join(" ")}
                              />
                            )}
                          </svg>
                          <small>
                            {n.history.length
                              ? "Most recent 120 training batches"
                              : "Press Train network to begin."}
                          </small>
                        </div>
                        <div className="network-key">
                          <span>
                            <i /> Positive weight
                          </span>
                          <span>
                            <i /> Negative weight
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="insight-content">
                    {inspected?.concept === state.concept && (
                      <>
                        <span className="eyebrow">SELECTED ELEMENT</span>
                        <h3>{inspected.element}</h3>
                        <p>{describeElement(state, inspected.element)}</p>
                      </>
                    )}
                    <span className="eyebrow">BEHIND THE SCENE</span>
                    <h3>
                      {state.concept === "projectile"
                        ? "The shape of a throw"
                        : state.concept === "circuit"
                          ? "Follow the energy"
                          : "Learning the exclusive OR"}
                    </h3>
                    <p>{explain(state, "")}</p>
                    {state.concept === "network" && (
                      <>
                        <h4>Output weight gradients</h4>
                        {n.gradients.map((g, i) => (
                          <div className="gradient" key={i}>
                            Hidden {i + 1} → output <code>{g.toFixed(5)}</code>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="checkpoint-actions">
                <button onClick={save}>
                  <ArrowDownToLine size={14} /> Export
                </button>
                <span />
                <button
                  disabled={!editable}
                  onClick={() => file.current?.click()}
                >
                  <ArrowUpFromLine size={14} /> Import
                </button>
                <input
                  ref={file}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => load(e.target.files?.[0])}
                />
              </div>
            </aside>
          </div>
          <section className="tutor-panel">
            <div className="tutor-heading">
              <span className="tutor-icon">
                <Sparkles size={20} />
              </span>
              <div>
                <h3>A little guidance. A lot of discovery.</h3>
                <p>
                  {tutor === "hosted"
                    ? "AI tutor grounded in your current experiment."
                    : "Guided explanations grounded in your current experiment."}{" "}
                  Always private.
                </p>
              </div>
              <span className="tutor-label">
                {tutor === "hosted" ? "AI TUTOR" : "GUIDED TUTOR"}
              </span>
            </div>
            {chat.length > 0 && (
              <div className="chat-log" aria-live="polite">
                {chat.map((m, i) => (
                  <div className={`chat-message ${m.role}`} key={i}>
                    <span>
                      {m.role === "user"
                        ? "YOU"
                        : m.source === "hosted"
                          ? "MINDSCOPE AI"
                          : m.source === "guided"
                            ? "LESSON GUIDE"
                            : "MINDSCOPE"}
                    </span>
                    <p>{m.text}</p>
                  </div>
                ))}
                {asking && (
                  <div className="chat-loading">
                    <LoaderCircle size={14} className="spin" /> Looking at your
                    experiment…
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
            )}
            <form
              className="tutor-input"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <div className="mode-select">
                <button
                  type="button"
                  className={mode === "ask" ? "selected" : ""}
                  onClick={() => setMode("ask")}
                  aria-label="Ask tutor mode"
                >
                  <MessageCircle size={15} />
                  <span>Ask</span>
                </button>
                <button
                  type="button"
                  disabled={!editable}
                  className={mode === "command" ? "selected" : ""}
                  onClick={() => setMode("command")}
                  aria-label="Scene command mode"
                >
                  <Zap size={14} />
                  <span>Change</span>
                </button>
              </div>
              <input
                aria-label="Ask about your experiment"
                value={question}
                maxLength={2000}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  mode === "ask"
                    ? "What are you curious about? Ask about this experiment…"
                    : "Try “set angle to 60” or “show neural networks”…"
                }
              />
              <button
                className="send-button"
                aria-label="Send question"
                disabled={
                  asking ||
                  !question.trim() ||
                  (mode === "command" && !editable)
                }
              >
                {asking ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </form>
            <div className="suggestions">
              <span>TRY ASKING</span>
              {(state.concept === "projectile"
                ? ["Why does 45° go farthest?", "What changes on the Moon?"]
                : state.concept === "circuit"
                  ? ["Why does current change?", "Explain series vs. parallel"]
                  : ["How does XOR work?", "What does the loss mean?"]
              ).map((q) => (
                <button
                  key={q}
                  disabled={asking}
                  onClick={() => {
                    setMode("ask");
                    if (mode === "ask") ask(q);
                    else setQuestion(q);
                  }}
                >
                  {q}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </section>
          <footer className="page-footer">
            <span>
              MINDSCOPE <i /> Ideas you can move.
            </span>
            <span>Built for curiosity. Designed for understanding.</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "room" ? "Live classroom" : "Lesson guide"}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(null);
            }}
          >
            <button
              className="modal-close icon-button"
              autoFocus
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "room" ? (
              <>
                <span className="modal-symbol">
                  <Users size={26} />
                </span>
                <div className="eyebrow">LEARN TOGETHER</div>
                <h2>One room. Shared discovery.</h2>
                <p>
                  You lead the experiment. Learners explore their own viewpoint
                  and ask questions privately.
                </p>
                {room ? (
                  <>
                    <div className="room-code">
                      <span>ROOM CODE</span>
                      <strong>{room.id}</strong>
                      <small>
                        {connected
                          ? `${presenter ? "You are the presenter" : "You are a learner"} · ${participants} connected`
                          : "Connecting to the room…"}
                      </small>
                    </div>
                    <button
                      className="button primary wide"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${location.origin}${location.pathname}?room=${room.id}`,
                          );
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          setNotice(
                            "Copy the room code above to invite learners.",
                          );
                        }
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                      {copied
                        ? "Invite link copied"
                        : "Copy learner invite link"}
                    </button>
                    <button className="text-button leave" onClick={leave}>
                      Leave room and explore privately
                    </button>
                    <p className="fine-print">
                      Keep this tab to retain presenter access. Rooms are in
                      memory; a server restart loses unsaved work. Export a
                      checkpoint to keep it.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      className="button primary wide"
                      disabled={busy}
                      onClick={createRoom}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Radio size={16} />
                      )}
                      Create a room from this experiment
                    </button>
                    <div className="divider">
                      <span>OR JOIN A CLASS</span>
                    </div>
                    <form
                      className="join-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        join();
                      }}
                    >
                      <input
                        aria-label="Room code"
                        placeholder="8-character room code"
                        value={joinId}
                        maxLength={8}
                        onChange={(e) => setJoinId(e.target.value)}
                      />
                      <button className="button" type="submit">
                        <Link size={15} /> Join
                      </button>
                    </form>
                    <p className="fine-print">
                      No account needed. Anyone with the invite can view the
                      lesson. Only the presenter can change it.
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="modal-symbol">
                  <BookOpen size={26} />
                </span>
                <div className="eyebrow">YOUR FIRST EXPERIMENT</div>
                <h2>Understanding starts with doing.</h2>
                <p>
                  Choose a concept, make a prediction, then put it to the test.
                </p>
                <ol className="guide-steps">
                  <li>
                    <strong>Move an idea</strong>
                    <span>
                      Drag to orbit, scroll to zoom, or enable hand controls and
                      pinch to rotate. Webcam frames stay on your device.
                    </span>
                  </li>
                  <li>
                    <strong>Change one thing</strong>
                    <span>
                      Use the sliders, run the simulation, and watch the
                      measured results. Save up to three projectile paths to
                      compare.
                    </span>
                  </li>
                  <li>
                    <strong>Ask why</strong>
                    <span>
                      Your private tutor uses the current experiment’s values.
                      In Change mode, try “set speed to 25” or “show circuits”.
                    </span>
                  </li>
                  <li>
                    <strong>Bring the class along</strong>
                    <span>
                      Start a live room and share the learner link. Export JSON
                      checkpoints to save and restore your work.
                    </span>
                  </li>
                </ol>
                <div className="guide-note">
                  <Lightbulb size={19} />
                  <span>
                    This is the browser foundation for spatial learning. Hand
                    controls move on-screen objects; holographic hardware,
                    student forks, and lesson authoring are future work.
                  </span>
                </div>
                <button
                  className="button primary wide"
                  onClick={() => setModal(null)}
                >
                  Let’s explore <ArrowUpRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
