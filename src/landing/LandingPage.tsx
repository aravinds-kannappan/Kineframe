import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Box,
  Check,
  CheckCheck,
  Code2,
  Command,
  Glasses,
  Layers3,
  MoveUpRight,
  X,
} from "lucide-react";
import "./landing.css";
import ScrollStory from "./ScrollStory";
const stages = [
  {
    name: "Inspect",
    verb: "See the failure.",
    quote: "Why is checkout failing after a declined payment?",
    response:
      "The connection stays open when payment throws. Let’s trace that path.",
    badge: "503 · POOL_EXHAUSTED",
    label: "Held connections",
    value: "3 / 3",
    file: "trace / checkout",
    lines: [
      "→ acquire connection",
      "→ charge payment",
      "× PAYMENT_DECLINED",
      "  release never reached",
    ],
  },
  {
    name: "Intervene",
    verb: "Shape the change.",
    quote:
      "Release the connection on every exit path. Show me the change first.",
    response: "Here’s the proposed finally block. You decide when it runs.",
    badge: "PATCH · AWAITING REVIEW",
    label: "Source revision",
    value: "01 → 02",
    file: "diff / service.mjs",
    lines: [
      "  try {",
      "    await charge(payment)",
      "+ } finally {",
      "+   pool.release(connection)",
    ],
  },
  {
    name: "Verify",
    verb: "Close the loop.",
    quote: "Apply it and rerun the failing requests.",
    response: "Both incident checks pass. Held connections return to zero.",
    badge: "200 · CHECKS PASSING",
    label: "Incident checks",
    value: "2 / 2",
    file: "checks / revision 02",
    lines: [
      "✓ checkout returns 200",
      "✓ connections released",
      "  before  3 held",
      "  after   0 held",
    ],
  },
];
const objects = [
  { name: "Gateway", label: "Request entry", x: 118, y: 174 },
  { name: "Checkout", label: "Shared focus", x: 298, y: 248 },
  { name: "Payments", label: "Upstream call", x: 483, y: 147 },
  { name: "Connection pool", label: "Resource lifecycle", x: 485, y: 337 },
];
function WorkspaceLink({
  children = "Enter the workspace",
  className = "",
  small = false,
}: {
  children?: React.ReactNode;
  className?: string;
  small?: boolean;
}) {
  return (
    <a
      className={`lp-cta ${small ? "lp-cta-small" : ""} ${className}`}
      href="/workspace"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${typeof children === "string" ? children : "Enter the workspace"} (opens in a new tab)`}
    >
      {children}
      <ArrowUpRight size={17} />
    </a>
  );
}
function Brand() {
  return (
    <a className="lp-brand" href="/" aria-label="Kineframe home">
      <span>
        <Box size={22} strokeWidth={1.6} />
      </span>
      kineframe
    </a>
  );
}
export default function LandingPage() {
  const [stage, setStage] = useState(0),
    [focus, setFocus] = useState("Checkout"),
    [menu, setMenu] = useState(false);
  const step = stages[stage];
  return (
    <div className="lp">
      <a className="lp-skip" href="#product">
        Skip to product
      </a>
      <header className="lp-header">
        <Brand />
        <nav
          className={menu ? "lp-nav is-open" : "lp-nav"}
          aria-label="Main navigation"
        >
          <a href="#experience" onClick={() => setMenu(false)}>
            The experience
          </a>
          <a href="#who" onClick={() => setMenu(false)}>
            Who it’s for
          </a>
          <a href="#advantage" onClick={() => setMenu(false)}>
            Our thesis
          </a>
        </nav>
        <WorkspaceLink small>Launch environment</WorkspaceLink>
        <button
          className="lp-menu"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
        >
          {menu ? <X size={22} /> : <span>Menu</span>}
        </button>
      </header>
      <main id="product">
        <section className="lp-hero lp-wrap">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">
              <span className="lp-dot" /> HUMAN + AGENT. ONE SHARED FRAME.
            </div>
            <h1>
              Step inside
              <br />
              what you’re
              <br />
              <em>building.</em>
            </h1>
            <p className="lp-intro">
              Build, debug and verify software with your agent. In the same
              shared frame.
            </p>
            <div className="lp-hero-actions">
              <WorkspaceLink />
              <a className="lp-text-link" href="#experience">
                Explore the idea <ArrowDown size={15} />
              </a>
            </div>
            <div className="lp-hero-note">
              <Command size={14} />
              <span>
                Start in your browser. Explore in VR.
                <br />
                <b>No custom hardware required.</b>
              </span>
            </div>
          </div>
          <div className={`lp-scene stage-${stage}`}>
            <div className="lp-scene-top">
              <span>
                <span className="lp-dot" /> SELECT A SERVICE
              </span>
              <span>01 / CHECKOUT</span>
            </div>
            <div className="lp-orbit lp-orbit-one" />
            <div className="lp-orbit lp-orbit-two" />
            <div className="lp-wire-grid" />
            <svg
              className="lp-graph"
              viewBox="0 0 600 455"
              role="group"
              aria-label={`Illustrated service map. ${focus} is the selected shared focus.`}
            >
              <defs>
                <linearGradient id="edge" x1="0" x2="1">
                  <stop stopColor="#afa0ff" />
                  <stop offset="1" stopColor="#617e87" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>
              <g fill="none" stroke="url(#edge)" strokeWidth="1.2">
                <path d="M118 174L298 248L483 147M298 248L485 337" />
                <path className="lp-pulse-path" d="M118 174L298 248L483 147" />
              </g>
              <path
                d="M298 194l47 26v54l-47 27-47-27v-54z"
                fill="#a999ff"
                opacity=".13"
                filter="url(#glow)"
              />
              {objects.map((o, i) => (
                <g
                  key={o.name}
                  className={focus === o.name ? "lp-node selected" : "lp-node"}
                  role="button"
                  tabIndex={0}
                  aria-label={`Focus ${o.name}`}
                  aria-pressed={focus === o.name}
                  onClick={() => setFocus(o.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFocus(o.name);
                    }
                  }}
                >
                  <path d={`M${o.x} ${o.y - 48}l46 26v52l-46 26-46-26v-52z`} />
                  <path
                    className="lp-cube-lines"
                    d={`M${o.x - 46} ${o.y - 22}l46 27 46-27M${o.x} ${o.y + 5}v51`}
                  />
                  <text x={o.x} y={o.y - 11} className="lp-node-index">
                    0{i + 1}
                  </text>
                  <text x={o.x} y={o.y + 82} className="lp-node-name">
                    {o.name}
                  </text>
                  <text x={o.x} y={o.y + 99} className="lp-node-label">
                    {focus === o.name ? "YOU + AGENT" : o.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="lp-floating-code">
              <div>
                <Code2 size={12} />
                <span>{step.file}</span>
                <span className="lp-code-dots">···</span>
              </div>
              <pre>
                {step.lines.map((line, i) => (
                  <span
                    key={i}
                    className={
                      line.startsWith("+") || line.startsWith("✓")
                        ? "positive"
                        : line.startsWith("×")
                          ? "negative"
                          : ""
                    }
                  >
                    {line}
                    {"\n"}
                  </span>
                ))}
              </pre>
            </div>
            <div className="lp-scene-metric">
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <span className="lp-metric-bars">
                {[18, 28, 20, 38, 26, 44, 34, 22].map((h, i) => (
                  <i key={i} style={{ height: stage === 2 ? 8 : h }} />
                ))}
              </span>
            </div>
            <div className="lp-cursor">
              <MoveUpRight size={20} />
              <span>You</span>
            </div>
            <div className="lp-scene-bottom">
              <span>{step.badge}</span>
              <span>INTERACTIVE CONCEPT</span>
            </div>
          </div>
        </section>
        <section
          id="experience"
          className="lp-experience lp-wrap"
          aria-label="Interactive product walkthrough"
        >
          <div className="lp-experience-intro">
            <span className="lp-eyebrow">A DIFFERENT WAY TO WORK</span>
            <h2>
              Less explaining.
              <br />
              <span>More understanding.</span>
            </h2>
            <p>Point to what you mean. Shape what happens next.</p>
          </div>
          <div className="lp-walkthrough">
            <div
              className="lp-stage-tabs"
              role="group"
              aria-label="Choose walkthrough stage"
            >
              {stages.map((s, i) => (
                <button
                  key={s.name}
                  aria-pressed={stage === i}
                  onClick={() => setStage(i)}
                >
                  <span>0{i + 1}</span>
                  {s.name}
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            <div className="lp-dialogue" aria-live="polite">
              <div>
                <span className="lp-speaker human">YOU</span>
                <p>{step.quote}</p>
              </div>
              <div>
                <span className="lp-speaker agent">
                  <Box size={14} />
                  AGENT
                </span>
                <p>{step.response}</p>
              </div>
            </div>
            <div className="lp-focus-picker">
              <span>POINT TO A SERVICE</span>
              {objects.map((o) => (
                <button
                  key={o.name}
                  aria-pressed={focus === o.name}
                  onClick={() => setFocus(o.name)}
                >
                  {o.name}
                </button>
              ))}
            </div>
            <p className="lp-caption">
              Illustrative walkthrough. The{" "}
              <a href="/workspace" target="_blank" rel="noopener noreferrer">
                working environment <ArrowUpRight size={12} />
              </a>{" "}
              executes the requests and patches.
            </p>
          </div>
        </section>
        <section className="lp-spatial" aria-labelledby="spatial-title">
          <div className="lp-wrap lp-spatial-inner">
            <div className="lp-spatial-copy">
              <div className="lp-eyebrow">
                A WORKSPACE WITH ANOTHER DIMENSION
              </div>
              <h2 id="spatial-title">
                Your software.
                <br />
                Within reach.
              </h2>
              <p>
                Your source, services and evidence. One conversation, in any
                dimension.
              </p>
              <div className="lp-spatial-modes">
                <span>
                  <Command size={17} />
                  Desktop workspace
                </span>
                <span>
                  <Glasses size={19} />
                  WebXR room
                </span>
              </div>
              <p className="lp-caption">
                Browser first. Compatible headset for VR. Prototype.
              </p>
            </div>
            <div
              className="lp-room-art"
              role="img"
              aria-label="Conceptual spatial room with source, system, and evidence panels around a shared focus"
            >
              <svg viewBox="0 0 600 410">
                <defs>
                  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#7768ca" stopOpacity=".26" />
                    <stop offset="1" stopColor="#7768ca" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M300 130L590 295 300 460 10 295Z"
                  fill="url(#floor)"
                  stroke="#45415f"
                />
                <g stroke="#39374f" fill="none">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <g key={i}>
                      <path
                        d={`M${10 + i * 48} ${295 - i * 27.5}L${300 + i * 48} ${460 - i * 27.5}`}
                      />
                      <path
                        d={`M${300 + i * 48} ${130 + i * 27.5}L${10 + i * 48} ${295 + i * 27.5}`}
                      />
                    </g>
                  ))}
                </g>
                <ellipse
                  cx="300"
                  cy="290"
                  rx="95"
                  ry="46"
                  fill="none"
                  stroke="#b7a5ff"
                  strokeDasharray="3 8"
                />
                <path
                  d="M300 188l43 24v49l-43 25-43-25v-49z"
                  fill="#493e76"
                  stroke="#b9a4ff"
                />
                <path
                  d="M257 212l43 25 43-25M300 237v49"
                  stroke="#b9a4ff"
                  fill="none"
                />
                <path
                  d="M300 290L90 173M300 290L508 174M300 290V106"
                  stroke="#9d8ad8"
                  strokeDasharray="2 6"
                />
              </svg>
              <div className="lp-room-panel panel-left">
                <span>
                  <Code2 size={12} /> SOURCE
                </span>
                <i />
                <i />
                <i />
                <b>
                  finally &#123;
                  <br />
                  &nbsp; pool.release()
                  <br />
                  &#125;
                </b>
              </div>
              <div className="lp-room-panel panel-top">
                <span>
                  <Layers3 size={12} /> SYSTEM
                </span>
                <div className="lp-mini-nodes">
                  <i />
                  <i />
                  <i />
                </div>
                <small>Shared focus · checkout</small>
              </div>
              <div className="lp-room-panel panel-right">
                <span>
                  <CheckCheck size={13} /> EVIDENCE
                </span>
                <strong>2 / 2</strong>
                <small>Incident checks passing</small>
              </div>
              <div className="lp-room-label">
                <AudioLines size={16} /> “Show me what changed.”
              </div>
            </div>
          </div>
        </section>
        <ScrollStory />
        <section className="lp-start lp-wrap">
          <div className="lp-start-top">
            <span className="lp-eyebrow">
              <span className="lp-dot" /> THE ENVIRONMENT IS OPEN
            </span>
            <span className="lp-start-coordinate">[ HUMAN × AGENT ]</span>
          </div>
          <div className="lp-start-main">
            <h2>
              One bug.
              <br />A new perspective.
            </h2>
            <div>
              <p>
                Reproduce a checkout failure. Review the fix. Watch the checks
                turn green.
              </p>
              <WorkspaceLink>Try the working environment</WorkspaceLink>
              <small>Opens in a new tab · Guided demo · No sign-up</small>
            </div>
          </div>
          <div className="lp-start-bottom">
            <span>
              <Check size={14} /> Real HTTP execution
            </span>
            <span>
              <Check size={14} /> Reviewed source changes
            </span>
            <span>
              <Check size={14} /> Reversible experiments
            </span>
          </div>
        </section>
        <div className="lp-scope lp-wrap">
          <span>
            Working prototype · bounded demo service · optional hosted AI
          </span>
          <a
            href="https://github.com/aravinds-kannappan/Kineframe#design-and-implementation"
            target="_blank"
            rel="noopener noreferrer"
          >
            What works today <ArrowUpRight size={12} />
          </a>
        </div>
      </main>
      <footer className="lp-footer lp-wrap">
        <Brand />
        <span>A shared frame for what comes next.</span>
        <a href="/api/brief" target="_blank" rel="noopener noreferrer">
          Product brief <ArrowUpRight size={13} />
        </a>
        <a
          href="https://github.com/aravinds-kannappan/Kineframe"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub <ArrowUpRight size={13} />
        </a>
        <span className="lp-footer-year">© 2026 Kineframe</span>
      </footer>
    </div>
  );
}
