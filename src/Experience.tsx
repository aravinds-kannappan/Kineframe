import { describeElement } from "../shared/inspection";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  ChevronLeft,
  Focus,
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Scene, { type ViewControls } from "./components/Scene";
import Hands from "./components/Hands";
import {
  applyAction,
  circuit,
  forward,
  initialState,
  loss,
  projectile,
  samples,
  tick,
  type Action,
  type Concept,
} from "../shared/simulation";
import "./experience.css";
const chapters = [
  {
    concept: "projectile" as Concept,
    kicker: "01 / DEFY THE FAMILIAR",
    title: "What if gravity\nlet go a little?",
    body: "You know how a ball falls. But do you know why? Hold a trajectory in your hands. Change its world. See your intuition become an experiment.",
    question:
      "Same throw. A different world. Will the ball travel farther on the Moon?",
    options: [
      "It will travel farther",
      "It will land sooner",
      "The distance stays the same",
    ],
    correct: 0,
    objects: ["projectile", "launch"],
    challenge: "Keep the throw. Change the world.",
    presets: ["Earth", "Moon", "Mars"],
  },
  {
    concept: "circuit" as Concept,
    kicker: "02 / FIND ANOTHER WAY",
    title: "One connection.\nA different outcome.",
    body: "Energy has a path. Now give it a choice. Follow the current, look inside each component, and discover what changes when a circuit branches.",
    question:
      "What happens to total current when these resistors change from series to parallel?",
    options: ["It increases", "It decreases", "It stays the same"],
    correct: 0,
    objects: ["battery", "R₁", "R₂"],
    challenge: "Give the current a second path.",
    presets: ["Series", "Parallel"],
  },
  {
    concept: "network" as Concept,
    kicker: "03 / WATCH AN IDEA LEARN",
    title: "Can you teach\na little network?",
    body: "Four examples. One hidden pattern. Watch a network make mistakes, follow their gradients, and gradually learn something it could not do before.",
    question: "Can a single linear boundary separate the four XOR cases?",
    options: ["Yes, one line is enough", "No, it needs a nonlinear boundary"],
    correct: 1,
    objects: ["input 1", "hidden neuron 1", "output"],
    challenge: "Let mistakes become understanding.",
    presets: ["0 ⊕ 0", "0 ⊕ 1", "1 ⊕ 0", "1 ⊕ 1"],
  },
];
export default function Experience() {
  const [chapter, setChapter] = useState(0),
    [state, setState] = useState(initialState),
    [started, setStarted] = useState(false),
    [prediction, setPrediction] = useState<number | null>(null),
    [experimented, setExperimented] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [assistant, setAssistant] = useState(false),
    [question, setQuestion] = useState(""),
    [reply, setReply] = useState(""),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState("guided"),
    [mode, setMode] = useState<"ask" | "command">("ask");
  const controls = useRef<ViewControls | null>(null),
    stateRef = useRef(state),
    request = useRef(0);
  stateRef.current = state;
  const lesson = chapters[chapter];
  useEffect(() => {
    const id = setInterval(() => setState((s) => tick(s, 0.05)), 50);
    return () => clearInterval(id);
  }, []);
  const act = (a: Action) => {
    try {
      setState((s) => applyAction(s, a));
    } catch {
      setReply("That change is outside this simulation’s supported controls.");
    }
  };
  useEffect(() => {
    const handle = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail;
      act({ type: "parameter", key, value });
      setExperimented(true);
    };
    document.addEventListener("mindscope:hand-range", handle);
    return () => document.removeEventListener("mindscope:hand-range", handle);
  }, []);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setSource(d.tutor === "hosted" ? "hosted" : "guided"))
      .catch(() => {});
  }, []);
  function changeChapter(i: number) {
    request.current++;
    setBusy(false);
    setChapter(i);
    setState({ ...initialState(), concept: chapters[i].concept });
    setPrediction(null);
    setSelected(null);
    setExperimented(false);
    setReply("");
    setStarted(true);
  }
  function preset(i: number) {
    setExperimented(true);
    if (chapter === 0) {
      setState((s) => {
        let next = applyAction(s, { type: "compare" });
        next = applyAction(next, {
          type: "parameter",
          key: "gravity",
          value: [9.81, 1.62, 3.71][i],
        });
        return { ...next, running: true, time: 0 };
      });
    } else if (chapter === 1)
      setState((s) => ({
        ...applyAction(s, { type: "parameter", key: "parallel", value: !!i }),
        running: true,
      }));
    else act({ type: "parameter", key: "sample", value: i });
  }
  async function ask(text = question, requestedMode = mode) {
    if (!text.trim() || busy) return;
    const id = ++request.current;
    const snapshot = stateRef.current;
    setBusy(true);
    setAssistant(true);
    setQuestion("");
    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selected ? `${text}\nSelected element: ${selected}` : text,
          state: snapshot,
          mode: requestedMode,
        }),
      });
      const result = await response.json();
      if (id !== request.current) return;
      if (!response.ok) throw new Error(result.error);
      if (result.action) {
        const next = applyAction(stateRef.current, result.action);
        setState(next);
        const target = chapters.findIndex((c) => c.concept === next.concept);
        if (target !== chapter) {
          setChapter(target);
          setPrediction(null);
          setSelected(null);
        }
        setExperimented(true);
      }
      setReply(result.answer);
      setSource(result.source);
    } catch (e) {
      if (id === request.current)
        setReply(
          e instanceof Error
            ? e.message
            : "The tutor is unavailable. Try the experiment controls.",
        );
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  const p = projectile(state.params.projectile),
    c = circuit(state.params.circuit);
  const measurements =
    chapter === 0
      ? [
          ["Range", p.range.toFixed(2), "m"],
          ["Peak", p.height.toFixed(2), "m"],
          ["Flight", p.flight.toFixed(2), "s"],
        ]
      : chapter === 1
        ? [
            ["Current", c.current.toFixed(3), "A"],
            ["Resistance", c.resistance.toFixed(2), "Ω"],
            ["Power", c.power.toFixed(2), "W"],
          ]
        : [
            ["Epoch", state.network.epoch.toLocaleString(), ""],
            ["Loss", loss(state.network).toFixed(4), ""],
            [
              "Prediction",
              forward(
                state.network,
                samples[state.params.network.sample],
              ).output.toFixed(3),
              "",
            ],
          ];
  const slider =
    chapter === 0
      ? {
          key: "angle",
          label: "Launch angle",
          value: state.params.projectile.angle,
          min: 5,
          max: 85,
          step: 1,
          unit: "°",
        }
      : chapter === 1
        ? {
            key: "voltage",
            label: "Supply voltage",
            value: state.params.circuit.voltage,
            min: 1,
            max: 24,
            step: 1,
            unit: "V",
          }
        : {
            key: "learningRate",
            label: "Learning rate",
            value: state.params.network.learningRate,
            min: 0.01,
            max: 3,
            step: 0.01,
            unit: "η",
          };
  return (
    <div className="journey">
      <nav className="journey-nav">
        <a href="/" className="journey-logo">
          <Box size={25} />
          mindscope<span>.</span>
        </a>
        <div>
          <a className="active" href="/experience">
            The experience
          </a>
          <a href="/lab">
            Examples lab <ArrowUpRight size={13} />
          </a>
        </div>
        <span className="journey-live">
          <i /> LIVE, NOT A VIDEO
        </span>
      </nav>
      <main className="journey-main">
        <div className="journey-copy">
          <span className="eyebrow">
            {started ? lesson.kicker : "A NEW WAY TO UNDERSTAND"}
          </span>
          <h1>
            {started ? (
              lesson.title
            ) : (
              <>
                Don’t just watch.
                <br />
                Step <em>inside.</em>
              </>
            )}
          </h1>
          <p>{lesson.body}</p>
          {!started ? (
            <>
              <button
                className="journey-primary"
                onClick={() => setStarted(true)}
              >
                Begin the experience <ArrowRight size={18} />
              </button>
              <span className="journey-footnote">
                Three discoveries. Your hands. A different way to learn.
              </span>
            </>
          ) : (
            <div className="prediction">
              <span className="eyebrow">
                {prediction === null
                  ? "FIRST, TRUST YOUR INTUITION"
                  : "YOUR PREDICTION IS SET"}
              </span>
              <h3>{lesson.question}</h3>
              <div>
                {lesson.options.map((option, i) => (
                  <button
                    key={option}
                    className={prediction === i ? "chosen" : ""}
                    onClick={() => setPrediction(i)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {prediction !== null && (
                <p>
                  {experimented
                    ? prediction === lesson.correct
                      ? "Your prediction matches the model. Look at the measurements to see why."
                      : "A surprising result? Compare your prediction with the measurements, then ask the guide why."
                    : "Now put it to the test. Change something in the scene."}
                </p>
              )}
            </div>
          )}
          <div className="journey-chapters">
            {chapters.map((item, i) => (
              <button
                key={item.concept}
                onClick={() => changeChapter(i)}
                className={chapter === i ? "active" : ""}
              >
                <span>0{i + 1}</span>
                {["Motion", "Circuits", "Learning"][i]}
                <i />
              </button>
            ))}
          </div>
        </div>
        <section className="world">
          <div className="world-heading">
            <span>
              <i />{" "}
              {
                ["THE GRAVITY ROOM", "THE CIRCUIT ROOM", "THE LEARNING ROOM"][
                  chapter
                ]
              }
            </span>
            <button
              onClick={() => {
                setAssistant(true);
                setReply(
                  "Choose an object to inspect, ask about the live results, or switch to Change and describe a supported experiment.",
                );
              }}
            >
              <Sparkles size={15} />{" "}
              {source === "hosted" ? "AI companion" : "Learning companion"}
            </button>
          </div>
          <div className="world-scene">
            <Scene
              state={state}
              controlsRef={controls}
              onInspect={(element) => {
                setSelected(element);
                setStarted(true);
              }}
            />
            <div className="world-caption">
              {chapter === 0
                ? "One throw. Infinite questions."
                : chapter === 1
                  ? "Trace the path. Change the outcome."
                  : "Every mistake is information."}
            </div>
            <div className="world-tools">
              <button
                aria-label="Zoom in"
                onClick={() => controls.current?.zoom(0.85)}
              >
                <Plus size={19} />
              </button>
              <button
                aria-label="Zoom out"
                onClick={() => controls.current?.zoom(1.18)}
              >
                <Minus size={19} />
              </button>
              <button
                aria-label="Reset viewpoint"
                onClick={() => controls.current?.reset()}
              >
                <Focus size={19} />
              </button>
            </div>
          </div>
          <div className="world-measurements">
            {measurements.map(([label, value, unit]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>
                  {value} <span>{unit}</span>
                </strong>
              </div>
            ))}
          </div>
          <div className="world-controls">
            <div>
              <span className="eyebrow">{lesson.challenge}</span>
              <div className="world-presets">
                {lesson.presets.map((v, i) => (
                  <button
                    key={v}
                    onClick={() => preset(i)}
                    className={
                      (
                        chapter === 0
                          ? state.params.projectile.gravity ===
                            [9.81, 1.62, 3.71][i]
                          : chapter === 1
                            ? Number(state.params.circuit.parallel) === i
                            : state.params.network.sample === i
                      )
                        ? "active"
                        : ""
                    }
                  >
                    {v}
                  </button>
                ))}
                <button
                  className="world-play"
                  onClick={() => {
                    act({ type: "play" });
                    setExperimented(true);
                  }}
                >
                  {state.running ? <Pause size={14} /> : <Play size={14} />}{" "}
                  {state.running ? "Pause" : chapter === 2 ? "Train" : "Run"}
                </button>
              </div>
            </div>
            <label className="slider-field">
              <span>
                {slider.label}
                <strong>
                  {slider.value} {slider.unit}
                </strong>
              </span>
              <input
                aria-label={slider.label}
                data-parameter={slider.key}
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={slider.value}
                onChange={(e) => {
                  act({
                    type: "parameter",
                    key: slider.key as "angle" | "voltage" | "learningRate",
                    value: Number(e.target.value),
                  });
                  setExperimented(true);
                }}
              />
            </label>
          </div>
          <div className="object-strip">
            <span>LOOK CLOSER</span>
            {lesson.objects.map((element) => (
              <button
                className={selected === element ? "active" : ""}
                key={element}
                onClick={() => setSelected(element)}
              >
                {element}
                <Plus size={11} />
              </button>
            ))}
          </div>
          {selected && (
            <div className="object-detail">
              <button
                aria-label="Close object details"
                onClick={() => setSelected(null)}
              >
                <X size={15} />
              </button>
              <span className="eyebrow">INSIDE THE SIMULATION</span>
              <h3>{selected}</h3>
              <p>{describeElement(state, selected)}</p>
              <button
                className="deepen"
                onClick={() =>
                  ask(
                    `Explain what ${selected} does, using the current experiment. Suggest one change I can test.`,
                    "ask",
                  )
                }
              >
                <Sparkles size={14} /> Help me go deeper{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className="journey-bottom">
        <div className="gesture-hint">
          <Hand size={19} />
          <span>
            Pinch to hold. Spread both hands to zoom.
            <small>
              Two fingers over the scene also zoom. Mouse and touch work too.
            </small>
          </span>
          <Hands controlsRef={controls} />
        </div>
        <button
          onClick={() =>
            chapter < 2 ? changeChapter(chapter + 1) : location.assign("/lab")
          }
          className="next-discovery"
        >
          {chapter < 2 ? "Next discovery" : "Open the full examples lab"}
          <ArrowRight size={18} />
        </button>
      </footer>
      {assistant && (
        <aside
          className="companion"
          role="dialog"
          aria-label="Learning companion"
        >
          <header>
            <span>
              <Sparkles size={18} />{" "}
              {source === "hosted" ? "AI companion" : "Guided companion"}
            </span>
            <button
              aria-label="Close companion"
              onClick={() => setAssistant(false)}
            >
              <X size={18} />
            </button>
          </header>
          <p className="companion-context">
            Grounded in your live {lesson.concept} experiment.
            {selected ? ` Inspecting ${selected}.` : ""}
          </p>
          <div className="companion-reply" role="status">
            {busy
              ? "Looking at your experiment…"
              : reply || "What would you like to discover?"}
          </div>
          <div className="companion-suggestions">
            <button
              disabled={busy}
              onClick={() => ask("Explain what changed and why.", "ask")}
            >
              Why did that happen?
            </button>
            <button
              disabled={busy}
              onClick={() =>
                ask(
                  chapter === 0
                    ? "set gravity to 1.62"
                    : chapter === 1
                      ? "use parallel"
                      : "set learning rate to 1.5",
                  "command",
                )
              }
            >
              Try{" "}
              {chapter === 0
                ? "Moon gravity"
                : chapter === 1
                  ? "a parallel circuit"
                  : "faster learning"}
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <div className="segmented">
              <button
                type="button"
                className={mode === "ask" ? "selected" : ""}
                onClick={() => setMode("ask")}
              >
                Ask why
              </button>
              <button
                type="button"
                className={mode === "command" ? "selected" : ""}
                onClick={() => setMode("command")}
              >
                Change experiment
              </button>
            </div>
            <label htmlFor="experiment-question">
              {mode === "ask"
                ? "What are you curious about?"
                : "Describe a change to this simulation"}
            </label>
            <div>
              <input
                id="experiment-question"
                value={question}
                maxLength={2000}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  mode === "ask"
                    ? "What does this element do?"
                    : "e.g. set angle to 60"
                }
              />
              <button
                disabled={busy || !question.trim()}
                aria-label="Send to companion"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <small>
            {source === "hosted"
              ? "AI proposes changes; the simulation validates them."
              : "Guided mode supports explicit scene commands. Connect an AI key for open-ended requests."}{" "}
            New simulation types cannot be generated here yet.
          </small>
        </aside>
      )}
    </div>
  );
}
