import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  Box,
  Check,
  Code2,
  Fingerprint,
  GitBranch,
  Glasses,
  Layers3,
  MousePointer2,
} from "lucide-react";
import "./scroll-story.css";
const chapters = [
  {
    label: "A closer look",
    title: (
      <>
        See the whole
        <br />
        <em>picture.</em>
      </>
    ),
    copy: "For developers, infrastructure teams, and spatial builders.",
    note: "Follow a failure from symptom to source.",
  },
  {
    label: "Shared context",
    title: (
      <>
        Every decision.
        <br />
        <em>A stronger frame.</em>
      </>
    ),
    copy: "Project context + reviewed decisions + verified outcomes.",
    note: "Our moat thesis. Durable team memory is still ahead.",
  },
  {
    label: "Working together",
    title: (
      <>
        Two minds.
        <br />
        <em>One workspace.</em>
      </>
    ),
    copy: "Point. Discuss. Redirect. Review. Verify.",
    note: "The complete collaboration loop is our focus.",
  },
];
export default function ScrollStory() {
  const section = useRef<HTMLElement>(null),
    [active, setActive] = useState(0),
    [staticView, setStaticView] = useState(false);
  useEffect(() => {
    const media = matchMedia(
      "(prefers-reduced-motion: reduce), (max-height: 600px)",
    );
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const range = Math.max(1, el.offsetHeight - innerHeight);
      const progress = Math.max(
        0,
        Math.min(0.9999, -el.getBoundingClientRect().top / range),
      );
      const chapter = Math.min(2, Math.floor(progress * 3));
      el.style.setProperty("--progress", String(progress));
      el.style.setProperty("--phase", String(progress * 3 - chapter));
      setActive(chapter);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const motion = () => {
      setStaticView(media.matches);
      schedule();
    };
    motion();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", motion);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", motion);
    };
  }, []);
  function jump(index: number) {
    const el = section.current;
    if (!el) return;
    if (staticView) {
      el.querySelector<HTMLElement>(
        `[data-chapter="${index}"]`,
      )?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    const range = el.offsetHeight - innerHeight;
    window.scrollTo({
      top:
        scrollY + el.getBoundingClientRect().top + range * ((index + 0.25) / 3),
      behavior: "auto",
    });
  }
  return (
    <section
      id="who"
      ref={section}
      className={`ss-story ${staticView ? "ss-static" : ""}`}
      aria-label="Explore the product by scrolling"
    >
      <span id="advantage" className="ss-anchor" />
      <div className="ss-sticky lp-wrap">
        <div className="ss-topline">
          <span className="lp-eyebrow">
            A SHARED FRAME CHANGES HOW YOU WORK
          </span>
          <span>
            <ArrowDown size={12} />
            SCROLL TO EXPLORE
          </span>
        </div>
        <div className="ss-chapters">
          {chapters.map((chapter, index) => (
            <article
              key={chapter.label}
              data-chapter={index}
              className={`ss-chapter chapter-${index} ${active === index ? "is-active" : ""}`}
              aria-hidden={staticView ? undefined : active !== index}
            >
              <div className="ss-copy">
                <span className="ss-number">0{index + 1} / 03</span>
                <h2>{chapter.title}</h2>
                <p>{chapter.copy}</p>
                <small>{chapter.note}</small>
                {index === 2 && (
                  <a
                    className="lp-text-link"
                    href="https://github.com/aravinds-kannappan/Kineframe#differentiation"
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={!staticView && active !== index ? -1 : 0}
                  >
                    How we differ <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
              {index === 0 && (
                <div
                  className="ss-art ss-system"
                  role="img"
                  aria-label="A failing request travels through gateway, checkout and payment, exposing a held database connection."
                >
                  <svg viewBox="0 0 620 460" aria-hidden="true">
                    <defs>
                      <radialGradient id="ss-halo">
                        <stop stopColor="#b9a2ed" stopOpacity=".25" />
                        <stop offset="1" stopColor="#b9a2ed" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="310" cy="235" r="205" fill="url(#ss-halo)" />
                    <g fill="none" stroke="#afa4c0">
                      <path d="M100 200L300 280 510 165M300 280L480 355" />
                      <path d="M100 200L300 280 510 165" className="ss-trace" />
                    </g>
                    <g className="ss-focus-ring">
                      <ellipse
                        cx="300"
                        cy="282"
                        rx="88"
                        ry="48"
                        fill="none"
                        stroke="#ad96cf"
                        strokeDasharray="2 7"
                      />
                    </g>
                  </svg>
                  <div className="ss-system-node ss-gateway">
                    <GitBranch />
                    <span>gateway</span>
                  </div>
                  <div className="ss-system-node ss-checkout">
                    <Box />
                    <span>checkout</span>
                  </div>
                  <div className="ss-system-node ss-payment">
                    <Code2 />
                    <span>payment</span>
                  </div>
                  <div className="ss-system-node ss-pool">
                    <Layers3 />
                    <span>connection pool</span>
                  </div>
                  <span className="ss-error">
                    503 <i /> connection still held
                  </span>
                  <div className="ss-people">
                    <span>
                      <Code2 size={15} />
                      Developers
                    </span>
                    <span>
                      <GitBranch size={15} />
                      Infrastructure
                    </span>
                    <span>
                      <Glasses size={16} />
                      Spatial teams
                    </span>
                  </div>
                </div>
              )}
              {index === 1 && (
                <div
                  className="ss-art ss-memory"
                  role="img"
                  aria-label="Project context, reviewed decisions and verified outcomes accumulate in layers around project memory."
                >
                  <div className="ss-memory-orbit" />
                  <div className="ss-memory-layer memory-back">
                    <Layers3 />
                    <span>PROJECT CONTEXT</span>
                    <div className="ss-memory-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="ss-memory-layer memory-mid">
                    <Fingerprint />
                    <span>REVIEWED DECISIONS</span>
                    <div className="ss-decision">
                      <Check size={14} /> release on every exit
                    </div>
                  </div>
                  <div className="ss-memory-layer memory-front">
                    <Check />
                    <span>VERIFIED OUTCOMES</span>
                    <strong>
                      2 / 2 <small>checks passed</small>
                    </strong>
                  </div>
                  <div className="ss-memory-caption">
                    <Box size={18} />A project that carries its context forward.
                  </div>
                </div>
              )}
              {index === 2 && (
                <div
                  className="ss-art ss-together"
                  role="img"
                  aria-label="Human intent and agent action converge on shared source, a reviewed patch and verified checks."
                >
                  <div className="ss-connection-line" />
                  <div className="ss-person">
                    <MousePointer2 />
                    <span>YOU</span>
                    <small>Intent + judgment</small>
                  </div>
                  <div className="ss-agent">
                    <Box />
                    <span>AGENT</span>
                    <small>Action + evidence</small>
                  </div>
                  <div className="ss-shared">
                    <span className="lp-eyebrow">THE SAME LIVE CONTEXT</span>
                    <div>
                      <Code2 size={15} />
                      <span>service.mjs</span>
                      <i>rev 02</i>
                    </div>
                    <div>
                      <Fingerprint size={15} />
                      <span>Patch reviewed</span>
                      <Check size={14} />
                    </div>
                    <div>
                      <Check size={15} />
                      <span>Incident checks</span>
                      <b>2 / 2</b>
                    </div>
                  </div>
                  <div className="ss-conversation">
                    <AudioLines size={17} />
                    “Show me why this works.”
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
        <div
          className="ss-navigation"
          role="group"
          aria-label="Explore product chapters"
        >
          {chapters.map((c, i) => (
            <button
              key={c.label}
              aria-pressed={active === i}
              onClick={() => jump(i)}
            >
              <span>0{i + 1}</span>
              {c.label}
              <i />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
