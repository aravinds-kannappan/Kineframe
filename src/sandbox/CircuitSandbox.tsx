import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Box,
  Check,
  ChevronRight,
  Focus,
  HelpCircle,
  Lightbulb,
  Minus,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  applyOperations,
  boardSchema,
  boardExplanation,
  planSchema,
  solveBoard,
  starterBoard,
  type Board,
  type Operation,
  type Part,
  type Plan,
} from "../../shared/circuitLab";
import CircuitWorld from "./CircuitWorld";
import Hands from "../components/Hands";
import type { ViewControls } from "../components/Scene";
import Voice from "./Voice";
import "./sandbox.css";
function restore() {
  try {
    const raw = localStorage.getItem("mindscope:circuit:v1");
    if (raw) return boardSchema.parse(JSON.parse(raw));
  } catch {}
  return starterBoard();
}
export default function CircuitSandbox() {
  const [board, setBoard] = useState<Board>(restore),
    [selected, setSelected] = useState<string | null>("L1"),
    [pending, setPending] = useState<string | null>(null),
    [running, setRunning] = useState(true),
    [notice, setNotice] = useState(""),
    [past, setPast] = useState<Board[]>([]),
    [future, setFuture] = useState<Board[]>([]),
    [baseline, setBaseline] = useState<Board | null>(null),
    [panel, setPanel] = useState<"inspect" | "companion" | null>("inspect"),
    [question, setQuestion] = useState(""),
    [mode, setMode] = useState<"ask" | "experiment">("ask"),
    [busy, setBusy] = useState(false),
    [answer, setAnswer] = useState(""),
    [lastQuestion, setLastQuestion] = useState(""),
    [proposal, setProposal] = useState<{ plan: Plan; base: string } | null>(
      null,
    ),
    [source, setSource] = useState("guided"),
    [speak, setSpeak] = useState(false),
    [help, setHelp] = useState(false);
  const controls = useRef<ViewControls | null>(null),
    boardRef = useRef(board),
    dragBase = useRef<Board | null>(null),
    file = useRef<HTMLInputElement>(null),
    request = useRef(0);
  boardRef.current = board;
  const solution = solveBoard(board),
    part = board.parts.find((p) => p.id === selected),
    reading = part ? solution.readings[part.id] : null,
    previous = baseline ? solveBoard(baseline) : null;
  let preview: ReturnType<typeof solveBoard> | null = null;
  try {
    if (proposal)
      preview = solveBoard(applyOperations(board, proposal.plan.operations));
  } catch {}
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem("mindscope:circuit:v1", JSON.stringify(board));
      } catch {}
    }, 450);
    return () => clearTimeout(t);
  }, [board]);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setSource(d.tutor === "hosted" ? "hosted" : "guided"))
      .catch(() =>
        setNotice("Companion server offline. Circuit editing still works."),
      );
    return () => {
      request.current++;
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  function commit(next: Board) {
    const validated = boardSchema.parse(next);
    const before = dragBase.current ?? boardRef.current;
    setPast((p) => [...p, before].slice(-40));
    dragBase.current = null;
    setFuture([]);
    boardRef.current = validated;
    setBoard(validated);
    setProposal(null);
  }
  function operate(ops: Operation[]) {
    try {
      commit(applyOperations(boardRef.current, ops));
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "That circuit change is not supported.",
      );
    }
  }
  function choose(id: string | null) {
    setSelected(id);
    if (id) setPanel("inspect");
  }
  function move(id: string, x: number, y: number) {
    if (!dragBase.current) dragBase.current = boardRef.current;
    const next = {
      ...boardRef.current,
      parts: boardRef.current.parts.map((p) =>
        p.id === id ? { ...p, x, y } : p,
      ),
    };
    boardRef.current = next;
    setBoard(next);
    setProposal(null);
  }
  function drop() {
    if (dragBase.current) {
      const before = dragBase.current;
      setPast((p) => [...p, before].slice(-40));
      setFuture([]);
      dragBase.current = null;
    }
  }
  function port(t: string) {
    if (!pending) {
      setPending(t);
      setNotice(
        `${t} selected. Choose another component’s terminal to connect.`,
      );
      return;
    }
    if (pending === t) {
      setPending(null);
      return;
    }
    setNotice("");
    operate([{ type: "connect", a: pending, b: t }]);
    setPending(null);
  }
  useEffect(() => {
    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail;
      if (key === "sandbox-value" && part)
        operate([{ type: "set", id: part.id, value }]);
    };
    document.addEventListener("mindscope:hand-range", handler);
    return () => document.removeEventListener("mindscope:hand-range", handler);
  });
  function add(kind: Part["kind"]) {
    const prefix = kind === "resistor" ? "R" : kind === "bulb" ? "L" : "S";
    let i = 1;
    while (board.parts.some((p) => p.id === prefix + i)) i++;
    const p: Part = {
      id: prefix + i,
      kind,
      value: kind === "resistor" ? 20 : kind === "bulb" ? 40 : 1,
      x: -3 + (board.parts.length % 4) * 2,
      y: 4 + (board.parts.length % 2),
      closed: true,
    };
    operate([{ type: "add", part: p }]);
    choose(p.id);
    setNotice(
      `${p.id} placed. Drag to position it, then connect its A and B terminals.`,
    );
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [board, ...f].slice(0, 40));
    setBoard(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setPending(null);
    setProposal(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, board]);
    setBoard(future[0]);
    setFuture((f) => f.slice(1));
    setPending(null);
    setProposal(null);
  }
  async function ask(text = question, requestedMode = mode) {
    if (!text.trim() || busy) return;
    const sequence = ++request.current;
    const snapshot = boardRef.current;
    setLastQuestion(text);
    setQuestion("");
    setBusy(true);
    setPanel("companion");
    setProposal(null);
    setAnswer("");
    try {
      const response = await fetch("/api/circuit-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          board: snapshot,
          selected,
          mode: requestedMode,
        }),
      });
      const result = await response.json();
      if (sequence !== request.current) return;
      if (!response.ok) throw new Error(result.error);
      setAnswer(result.answer);
      setSource(result.source);
      if (result.plan && requestedMode === "experiment") {
        const plan = planSchema.parse(result.plan);
        applyOperations(snapshot, plan.operations);
        if (JSON.stringify(boardRef.current) === JSON.stringify(snapshot))
          setProposal({ plan, base: JSON.stringify(snapshot) });
        else
          setAnswer(
            "The circuit changed while I was preparing that experiment. Ask again using the current circuit.",
          );
      }
      if (speak && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(result.answer);
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      setAnswer(
        e instanceof Error ? e.message : "Could not reach the companion.",
      );
    } finally {
      if (sequence === request.current) setBusy(false);
    }
  }
  function runProposal() {
    if (!proposal) return;
    if (proposal.base !== JSON.stringify(boardRef.current)) {
      setProposal(null);
      setNotice("The circuit has changed. Request a fresh experiment.");
      return;
    }
    try {
      const next = applyOperations(boardRef.current, proposal.plan.operations);
      setBaseline(boardRef.current);
      commit(next);
      setRunning(true);
      setAnswer(
        "Experiment applied. The comparison below uses the actual solver results. Inspect a component or rewind to try a different hypothesis.",
      );
    } catch {
      setNotice("Experiment no longer valid. The circuit is unchanged.");
    }
  }
  function save() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { format: "mindscope-circuit", version: 1, board },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindscope-circuit.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Circuit checkpoint exported.");
  }
  async function load(f?: File) {
    if (!f) return;
    try {
      if (f.size > 128000) throw new Error();
      const data = JSON.parse(await f.text());
      if (data.format !== "mindscope-circuit" || data.version !== 1)
        throw new Error();
      commit(boardSchema.parse(data.board));
      setSelected(null);
      setPending(null);
      setNotice("Circuit restored.");
    } catch {
      setNotice("Choose a valid Mindscope circuit checkpoint under 128 KB.");
    }
    if (file.current) file.current.value = "";
  }
  const fmt = (v: number | null | undefined, unit: string) =>
    v === null || v === undefined ? "—" : `${Math.abs(v).toFixed(3)} ${unit}`;
  return (
    <div className="sandbox">
      <CircuitWorld
        board={board}
        solution={solution}
        selected={selected}
        pending={pending}
        running={running && solution.status === "powered"}
        controlsRef={controls}
        onSelect={choose}
        onMove={move}
        onTerminal={port}
        onDrop={drop}
      />
      <header className="sb-header">
        <a href="/" className="sb-brand">
          <Box size={23} />
          mindscope<span> / CIRCUIT LAB</span>
        </a>
        <div className="sb-session">
          <i /> PERSONAL WORKSPACE <span>LOCAL AUTOSAVE</span>
        </div>
        <nav>
          <a href="/experience">Guided experience</a>
          <a href="/lab">
            Examples <ChevronRight size={13} />
          </a>
          <button aria-label="Workspace help" onClick={() => setHelp(true)}>
            <HelpCircle size={18} />
          </button>
        </nav>
      </header>
      <section className="sb-intro">
        <span className="sb-eyebrow">A WORKSPACE FOR YOUR CURIOSITY</span>
        <h1>
          Make a connection.
          <br />
          <em>See what happens.</em>
        </h1>
        <p>
          Grab a component. Follow the current.
          <br />
          Ask a better question.
        </p>
      </section>
      <div className="sb-readouts">
        <div>
          <small>SUPPLY CURRENT</small>
          <strong>
            {solution.status === "short" ? "—" : solution.current.toFixed(3)}
            <span>A</span>
          </strong>
        </div>
        <div>
          <small>EQUIVALENT R</small>
          <strong>
            {solution.resistance?.toFixed(1) ?? "—"}
            <span>Ω</span>
          </strong>
        </div>
        <div>
          <small>DELIVERED POWER</small>
          <strong>
            {solution.status === "short" ? "—" : solution.power.toFixed(2)}
            <span>W</span>
          </strong>
        </div>
        <span className={`circuit-state ${solution.status}`}>
          <i />
          {solution.status === "powered"
            ? "CIRCUIT LIVE"
            : solution.status === "short"
              ? "SOURCE SHORT"
              : "OPEN CIRCUIT"}
        </span>
      </div>
      <aside className="sb-palette" aria-label="Component palette">
        <span>ADD</span>
        <button
          disabled={board.parts.length >= 12}
          onClick={() => add("resistor")}
          title="Add resistor"
          aria-label="Add resistor"
        >
          <Activity size={22} />
          <small>Resistor</small>
        </button>
        <button
          disabled={board.parts.length >= 12}
          onClick={() => add("bulb")}
          title="Add lamp"
          aria-label="Add lamp"
        >
          <Lightbulb size={22} />
          <small>Lamp</small>
        </button>
        <button
          disabled={board.parts.length >= 12}
          onClick={() => add("switch")}
          title="Add switch"
          aria-label="Add switch"
        >
          <SlidersHorizontal size={22} />
          <small>Switch</small>
        </button>
        <i />
        <button
          aria-label="Undo last change"
          disabled={!past.length}
          onClick={undo}
        >
          <Undo2 size={19} />
          <small>Rewind</small>
        </button>
        <button
          aria-label="Redo change"
          disabled={!future.length}
          onClick={redo}
        >
          <Redo2 size={18} />
          <small>Redo</small>
        </button>
      </aside>
      <div className="sb-view">
        <button
          aria-label="Zoom in"
          onClick={() => controls.current?.zoom(0.85)}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => controls.current?.zoom(1.18)}
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Reset viewpoint"
          onClick={() => controls.current?.reset()}
        >
          <Focus size={18} />
        </button>
        <button
          aria-label={
            running ? "Pause current animation" : "Resume current animation"
          }
          onClick={() => setRunning(!running)}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
      {pending && (
        <div className="sb-wiring" role="status">
          <i /> CONNECTING FROM {pending.toUpperCase()}{" "}
          <span>Select the second terminal</span>
          <button aria-label="Cancel wire" onClick={() => setPending(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {solution.status === "short" && (
        <div className="sb-short" role="alert">
          The battery is shorted. Ideal-source current is undefined. Remove the
          bypass wire or open a switch.
        </div>
      )}
      {panel && (
        <aside className="sb-panel">
          <header>
            <span>
              {panel === "inspect" ? (
                <>
                  <Focus size={15} /> OBJECT INSPECTOR
                </>
              ) : (
                <>
                  <Sparkles size={15} />{" "}
                  {source === "hosted" ? "AI COMPANION" : "GUIDED COMPANION"}
                </>
              )}
            </span>
            <button
              aria-label="Close side panel"
              onClick={() => setPanel(null)}
            >
              <X size={16} />
            </button>
          </header>
          {panel === "inspect" ? (
            part ? (
              <>
                <div className="sb-part-title">
                  <span>{part.id}</span>
                  <div>
                    <h2>
                      {part.kind === "bulb"
                        ? "Resistive lamp"
                        : part.kind === "battery"
                          ? "DC power source"
                          : part.kind === "switch"
                            ? "Circuit switch"
                            : "Resistor"}
                    </h2>
                    <p>
                      {part.kind === "bulb"
                        ? "Light follows dissipated power."
                        : part.kind === "battery"
                          ? "The potential that moves charge."
                          : part.kind === "switch"
                            ? "One small break changes everything."
                            : "Shape the flow of current."}
                    </p>
                  </div>
                </div>
                {part.kind === "switch" ? (
                  <button
                    className="sb-action"
                    onClick={() => operate([{ type: "toggle", id: part.id }])}
                  >
                    {part.closed ? "Open switch" : "Close switch"}
                    <Zap size={14} />
                  </button>
                ) : (
                  <label className="slider-field">
                    <span>
                      {part.kind === "battery" ? "Voltage" : "Resistance"}
                      <strong>
                        {part.value} {part.kind === "battery" ? "V" : "Ω"}
                      </strong>
                    </span>
                    <input
                      aria-label="Selected component value"
                      data-parameter="sandbox-value"
                      type="range"
                      min={1}
                      max={part.kind === "battery" ? 24 : 1000}
                      step={1}
                      value={part.value}
                      onChange={(e) =>
                        operate([
                          {
                            type: "set",
                            id: part.id,
                            value: Number(e.target.value),
                          },
                        ])
                      }
                    />
                  </label>
                )}
                <dl className="sb-part-values">
                  <div>
                    <dt>Voltage drop</dt>
                    <dd>{fmt(reading?.voltage, "V")}</dd>
                  </div>
                  <div>
                    <dt>Current magnitude</dt>
                    <dd>{fmt(reading?.current, "A")}</dd>
                  </div>
                  <div>
                    <dt>
                      {part.kind === "battery"
                        ? "Power supplied"
                        : "Power dissipated"}
                    </dt>
                    <dd>{fmt(reading?.power, "W")}</dd>
                  </div>
                </dl>
                {part.kind === "switch" && part.closed && (
                  <p className="sb-small">
                    Current through ideal switch branches is not uniquely
                    resolved by this solver.
                  </p>
                )}
                <div className="sb-terminals">
                  <span>CONNECT A TERMINAL</span>
                  <div>
                    {["a", "b"].map((side) => (
                      <button
                        className={
                          pending === `${part.id}:${side}` ? "active" : ""
                        }
                        key={side}
                        onClick={() => port(`${part.id}:${side}`)}
                      >
                        <i />
                        {part.id}:{side.toUpperCase()}
                        <small>
                          {fmt(solution.potentials[`${part.id}:${side}`], "V")}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sb-wire-list">
                  <span>CONNECTIONS</span>
                  {board.wires
                    .filter(
                      (w) =>
                        w.a.startsWith(part.id + ":") ||
                        w.b.startsWith(part.id + ":"),
                    )
                    .map((w) => (
                      <div key={w.id}>
                        <span>
                          {w.a} ↔ {w.b}
                        </span>
                        <button
                          aria-label={`Remove wire ${w.id}`}
                          title="Disconnect"
                          onClick={() =>
                            operate([{ type: "disconnect", id: w.id }])
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                </div>
                <button
                  className="sb-deepen"
                  onClick={() =>
                    ask(
                      `Explain ${part.id} and what would happen if I changed it.`,
                      "ask",
                    )
                  }
                >
                  <Sparkles size={15} /> Explain this component{" "}
                  <ArrowRight size={14} />
                </button>
                {part.kind !== "battery" && (
                  <button
                    className="sb-delete"
                    onClick={() => {
                      operate([{ type: "remove", id: part.id }]);
                      setSelected(null);
                    }}
                  >
                    <Trash2 size={12} /> Remove component
                  </button>
                )}
              </>
            ) : (
              <p className="sb-empty">
                Select a component in the scene or the object strip to inspect
                its live values.
              </p>
            )
          ) : (
            <>
              <p className="sb-ai-context">
                {selected ? `Looking at ${selected}. ` : ""}Grounded in this
                circuit’s computed state.
              </p>
              {lastQuestion && (
                <div className="sb-question">{lastQuestion}</div>
              )}
              <div className="sb-answer" role="status">
                {busy
                  ? "Reading your circuit…"
                  : answer ||
                    "Ask about a component, or propose an experiment. I will show you the changes before you run them."}
              </div>
              {proposal && (
                <div className="sb-proposal">
                  <span>EXPERIMENT PREVIEW</span>
                  <h3>{proposal.plan.title}</h3>
                  <p>{proposal.plan.reason}</p>
                  <ul>
                    {proposal.plan.operations.map((op, i) => (
                      <li key={i}>
                        {op.type === "set"
                          ? `Set ${op.id} to ${op.value}`
                          : op.type === "connect"
                            ? `Wire ${op.a} → ${op.b}`
                            : op.type === "add"
                              ? `Add ${op.part.id} (${op.part.kind}, ${op.part.value} Ω)`
                              : `${op.type} ${op.id}`}
                      </li>
                    ))}
                  </ul>
                  <div className="sb-prediction">
                    SOLVER PREDICTION
                    <strong>
                      {preview?.status === "short"
                        ? "Source short — undefined current"
                        : `${solution.current.toFixed(3)} A → ${preview?.current.toFixed(3)} A`}
                    </strong>
                  </div>
                  <button className="sb-action" onClick={runProposal}>
                    Run experiment <Play size={13} />
                  </button>
                  <button
                    className="sb-dismiss"
                    onClick={() => setProposal(null)}
                  >
                    Discard proposal
                  </button>
                </div>
              )}
              <button
                className="sb-speak"
                onClick={() => {
                  if (speak) window.speechSynthesis?.cancel();
                  setSpeak(!speak);
                }}
              >
                {speak ? <Volume2 size={14} /> : <VolumeX size={14} />} Spoken
                replies {speak ? "on" : "off"}
              </button>
            </>
          )}
        </aside>
      )}
      {baseline && previous && (
        <div className="sb-comparison">
          <header>
            <span>BEFORE → AFTER</span>
            <button
              aria-label="Close comparison"
              onClick={() => setBaseline(null)}
            >
              <X size={13} />
            </button>
          </header>
          <div>
            <small>SUPPLY CURRENT</small>
            <strong>
              {previous.status === "short" ? "—" : previous.current.toFixed(3)}{" "}
              <ArrowRight size={13} />{" "}
              {solution.status === "short" ? "—" : solution.current.toFixed(3)}{" "}
              A
            </strong>
          </div>
          <p>
            {previous.status} → {solution.status} · measured by the solver
          </p>
        </div>
      )}
      <section className="sb-dock">
        <div className="sb-objects">
          <span>IN YOUR WORKSPACE</span>
          {board.parts.map((p) => (
            <button
              className={selected === p.id ? "active" : ""}
              key={p.id}
              onClick={() => choose(p.id)}
            >
              {p.kind === "bulb" ? (
                <Lightbulb size={12} />
              ) : p.kind === "battery" ? (
                <Zap size={12} />
              ) : (
                <Activity size={12} />
              )}{" "}
              {p.id}
            </button>
          ))}
          <button
            className="sb-save-baseline"
            onClick={() => {
              setBaseline(structuredClone(board));
              setNotice("Baseline captured. Make a change to compare.");
            }}
          >
            Compare
          </button>
        </div>
        <form
          className="sb-composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <Sparkles size={20} />
          <div className="sb-mode">
            <button
              type="button"
              className={mode === "ask" ? "active" : ""}
              onClick={() => setMode("ask")}
            >
              Ask
            </button>
            <button
              type="button"
              className={mode === "experiment" ? "active" : ""}
              onClick={() => setMode("experiment")}
            >
              Experiment
            </button>
          </div>
          <input
            aria-label="Ask or describe an experiment"
            placeholder={
              mode === "ask"
                ? "“Why is the lamp dim?”"
                : "“Add a resistor in parallel and see what changes.”"
            }
            value={question}
            maxLength={2000}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Voice
            disabled={busy}
            onQuestion={(q) => ask(q)}
            onStatus={setNotice}
          />
          <button
            className="sb-send"
            aria-label="Send to circuit companion"
            disabled={busy || !question.trim()}
          >
            <Send size={17} />
          </button>
        </form>
        <div className="sb-suggestions">
          <span>TRY AN EXPERIMENT</span>
          <button
            disabled={busy}
            onClick={() => ask("Add a parallel resistor", "experiment")}
          >
            Add a parallel path <Plus size={10} />
          </button>
          <button
            disabled={busy}
            onClick={() => ask("Halve the voltage", "experiment")}
          >
            Halve the voltage <ArrowRight size={10} />
          </button>
          <button
            disabled={busy}
            onClick={() => ask("Open the switch", "experiment")}
          >
            Break the circuit <ArrowRight size={10} />
          </button>
        </div>
      </section>
      <footer className="sb-footer">
        <div>
          <Hands controlsRef={controls} mode="circuit" />
          <span>PINCH TO GRAB · SPREAD TO ZOOM</span>
        </div>
        <div>
          <button
            aria-label="Export circuit"
            title="Export checkpoint"
            onClick={save}
          >
            <ArrowDownToLine size={15} />
          </button>
          <button
            aria-label="Import circuit"
            title="Import checkpoint"
            onClick={() => file.current?.click()}
          >
            <ArrowUpFromLine size={15} />
          </button>
          <button
            aria-label="Restore starter circuit"
            title="Restore starter (undoable)"
            onClick={() => {
              commit(starterBoard());
              setPending(null);
              setSelected("L1");
            }}
          >
            <RotateCcw size={15} />
          </button>
          <input
            type="file"
            hidden
            ref={file}
            accept=".json"
            onChange={(e) => load(e.target.files?.[0])}
          />
          <span>IDEAL DC · FLOW ANIMATION NOT TO SCALE</span>
        </div>
      </footer>
      {notice && (
        <div className="sb-toast" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section
            className="modal sb-help"
            role="dialog"
            aria-modal="true"
            aria-label="Circuit workspace guide"
          >
            <button
              className="modal-close"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <span className="sb-eyebrow">IDEAS YOU CAN HOLD</span>
            <h2>Your next discovery starts here.</h2>
            <ol>
              <li>
                <strong>Grab a component.</strong> Drag with your mouse or pinch
                and move your hand. Empty-space dragging orbits the view.
              </li>
              <li>
                <strong>Make a connection.</strong> Select one glowing terminal,
                then another. The inspector’s A/B controls do the same.
              </li>
              <li>
                <strong>Look closer.</strong> Spread two pinched hands to zoom.
                Select a component to change its value and inspect current,
                voltage, and power.
              </li>
              <li>
                <strong>Ask “what if?”</strong> Use the microphone or type.
                Experiment mode previews validated changes; you choose when to
                run them.
              </li>
              <li>
                <strong>Rewind and compare.</strong> Capture a baseline or undo
                a change. Export a checkpoint to save a copy.
              </li>
            </ol>
            <p>
              One ideal DC source, resistors, fixed-resistance lamps, and
              switches. Floating voltages and ideal switch currents may be
              undefined. No physical hardware is controlled.{" "}
              {source === "guided"
                ? "Hosted AI is not configured; guided explanations and experiment templates are available."
                : "Hosted AI receives questions and numerical circuit state, never webcam frames."}
            </p>
            <button className="sb-action" onClick={() => setHelp(false)}>
              Enter the workspace <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
