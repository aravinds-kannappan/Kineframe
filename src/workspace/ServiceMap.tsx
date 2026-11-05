import { useRef, useState } from "react";
import { services, type Focus, type Workspace } from "../../shared/workspace";
export default function ServiceMap({
  state,
  onFocus,
}: {
  state: Workspace;
  onFocus: (id: Focus) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({
    gateway: { x: 100, y: 180 },
    checkout: { x: 350, y: 180 },
    payments: { x: 610, y: 90 },
    database: { x: 610, y: 270 },
  });
  const drag = useRef<{ id: Focus; dx: number; dy: number } | null>(null);
  const current = state.evidence?.version === state.version;
  const resolved =
    current && state.evidence!.tests.slice(0, 2).every((t) => t.pass);
  const suspect = state.scenario === "pool" ? "database" : "payments";
  function coords(x: number, y: number) {
    const matrix = svg.current!.getScreenCTM()!;
    const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  return (
    <div className="kf-map">
      <div className="kf-map-caption">
        <span>
          <i className="kf-dot" /> SHARED ATTENTION
        </span>
        <span>Drag to arrange · select to inspect</span>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 740 365"
        role="group"
        aria-label="Interactive service map"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = coords(e.clientX, e.clientY),
            d = drag.current;
          setPositions((prev) => ({
            ...prev,
            [d.id]: {
              x: Math.max(85, Math.min(655, p.x - d.dx)),
              y: Math.max(60, Math.min(305, p.y - d.dy)),
            },
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="kf-grid"
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="#314058" />
          </pattern>
          <linearGradient id="kf-link">
            <stop stopColor="#4c7a9b" />
            <stop offset="1" stopColor="#69d9df" />
          </linearGradient>
        </defs>
        <rect width="740" height="365" fill="url(#kf-grid)" />
        {(
          [
            ["gateway", "checkout"],
            ["checkout", "payments"],
            ["checkout", "database"],
          ] as const
        ).map(([a, b]) => {
          const from = positions[a],
            to = positions[b];
          return (
            <g key={b}>
              <path
                d={`M${from.x + 65},${from.y} C${from.x + 140},${from.y} ${to.x - 140},${to.y} ${to.x - 65},${to.y}`}
                className={
                  state.busy ? "kf-connection running" : "kf-connection"
                }
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 13}
                className="kf-edge-label"
              >
                {b === "database"
                  ? "acquire / release"
                  : b === "payments"
                    ? "await charge()"
                    : "POST /checkout"}
              </text>
            </g>
          );
        })}
        {services.map((service) => {
          const p = positions[service.id],
            selected = state.focus === service.id,
            bad = current && !resolved && service.id === suspect;
          return (
            <g
              key={service.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${service.name}`}
              aria-pressed={selected}
              transform={`translate(${p.x},${p.y})`}
              className={`kf-service ${selected ? "selected" : ""} ${bad ? "unhealthy" : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocus(service.id);
                }
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                const at = coords(e.clientX, e.clientY);
                drag.current = {
                  id: service.id,
                  dx: at.x - p.x,
                  dy: at.y - p.y,
                };
                onFocus(service.id);
              }}
            >
              {selected && (
                <rect
                  x="-80"
                  y="-48"
                  width="160"
                  height="96"
                  rx="20"
                  className="kf-selection"
                />
              )}
              <rect
                x="-70"
                y="-38"
                width="140"
                height="76"
                rx="13"
                className="kf-node-bg"
              />
              <circle
                cx="-48"
                cy="-18"
                r="3"
                fill={bad ? "#f5ab78" : resolved ? "#7ce5b4" : "#7a9bb9"}
              />
              <text x="0" y="1" className="kf-node-name">
                {service.name}
              </text>
              <text x="0" y="21" className="kf-node-sub">
                {service.subtitle}
              </text>
              {selected && (
                <text y="-59" className="kf-focus-label">
                  YOU + AGENT ARE LOOKING HERE
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="kf-map-footer">
        <span>
          Checkout lab <b>/</b> logical service map
        </span>
        <span>
          {current
            ? resolved
              ? "Incident checks passing"
              : "Failure reproduced"
            : "Run checks to measure this revision"}
        </span>
      </div>
    </div>
  );
}
