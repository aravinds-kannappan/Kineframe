import { z } from "zod";
export const concepts = ["projectile", "circuit", "network"] as const;
export type Concept = (typeof concepts)[number];
export const parameterSchemas = {
  projectile: z
    .object({
      speed: z.number().min(1).max(40),
      angle: z.number().min(5).max(85),
      gravity: z.number().min(1).max(25),
    })
    .strict(),
  circuit: z
    .object({
      voltage: z.number().min(1).max(24),
      r1: z.number().min(1).max(100),
      r2: z.number().min(1).max(100),
      parallel: z.boolean(),
    })
    .strict(),
  network: z
    .object({
      learningRate: z.number().min(0.01).max(3),
      sample: z.number().int().min(0).max(3),
    })
    .strict(),
};
export type Parameters = {
  projectile: z.infer<typeof parameterSchemas.projectile>;
  circuit: z.infer<typeof parameterSchemas.circuit>;
  network: z.infer<typeof parameterSchemas.network>;
};
const finite = z.number().finite().min(-1e6).max(1e6);
export const networkSchema = z
  .object({
    w1: z.array(z.array(finite).length(2)).length(4),
    b1: z.array(finite).length(4),
    w2: z.array(finite).length(4),
    b2: finite,
    epoch: z.number().int().min(0).max(1e9),
    history: z.array(z.number().min(0).max(100)).max(120),
    gradients: z.array(finite).length(4),
  })
  .strict();
export type Network = z.infer<typeof networkSchema>;
export const stateSchema = z
  .object({
    concept: z.enum(concepts),
    params: z.object(parameterSchemas).strict(),
    running: z.boolean(),
    time: z.number().min(0).max(100),
    network: networkSchema,
    comparisons: z.array(parameterSchemas.projectile).max(3),
  })
  .strict();
export type State = z.infer<typeof stateSchema>;
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("select"), concept: z.enum(concepts) }).strict(),
  z
    .object({
      type: z.literal("parameter"),
      key: z.enum([
        "speed",
        "angle",
        "gravity",
        "voltage",
        "r1",
        "r2",
        "parallel",
        "learningRate",
        "sample",
      ]),
      value: z.union([z.number().finite(), z.boolean()]),
    })
    .strict(),
  z.object({ type: z.literal("play") }).strict(),
  z.object({ type: z.literal("reset") }).strict(),
  z.object({ type: z.literal("compare") }).strict(),
  z.object({ type: z.literal("clearComparisons") }).strict(),
  z.object({ type: z.literal("import"), state: stateSchema }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export const samples = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];
export const targets = [0, 1, 1, 0];
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export function newNetwork(): Network {
  return {
    w1: [
      [1.2, -1.3],
      [-1.1, 1.4],
      [1.1, 1.2],
      [-1.3, -1.1],
    ],
    b1: [0.1, -0.2, -0.7, 0.8],
    w2: [0.8, 0.7, -0.8, 0.6],
    b2: -0.2,
    epoch: 0,
    history: [],
    gradients: [0, 0, 0, 0],
  };
}
export function forward(n: Network, input: number[]) {
  const hidden = n.w1.map((w, j) =>
    sigmoid(w[0] * input[0] + w[1] * input[1] + n.b1[j]),
  );
  return {
    hidden,
    output: sigmoid(hidden.reduce((sum, h, j) => sum + h * n.w2[j], n.b2)),
  };
}
export function loss(n: Network) {
  return (
    samples.reduce((sum, x, i) => {
      const p = Math.max(1e-10, Math.min(1 - 1e-10, forward(n, x).output));
      return (
        sum - targets[i] * Math.log(p) - (1 - targets[i]) * Math.log(1 - p)
      );
    }, 0) / 4
  );
}
export function train(n: Network, lr: number, steps = 20): Network {
  const next: Network = structuredClone(n);
  for (let k = 0; k < steps; k++) {
    const dw1 = Array.from({ length: 4 }, () => [0, 0]),
      db1 = [0, 0, 0, 0],
      dw2 = [0, 0, 0, 0];
    let db2 = 0;
    samples.forEach((x, i) => {
      const { hidden, output } = forward(next, x),
        delta = (output - targets[i]) / 4;
      db2 += delta;
      hidden.forEach((h, j) => {
        dw2[j] += delta * h;
        const dh = delta * next.w2[j] * h * (1 - h);
        db1[j] += dh;
        dw1[j][0] += dh * x[0];
        dw1[j][1] += dh * x[1];
      });
    });
    next.w1.forEach((w, j) => {
      w[0] -= lr * dw1[j][0];
      w[1] -= lr * dw1[j][1];
      next.b1[j] -= lr * db1[j];
      next.w2[j] -= lr * dw2[j];
    });
    next.b2 -= lr * db2;
    next.gradients = dw2;
    next.epoch++;
  }
  next.history = [...next.history, loss(next)].slice(-120);
  return next;
}
export function initialState(): State {
  return {
    concept: "projectile",
    params: {
      projectile: { speed: 18, angle: 45, gravity: 9.81 },
      circuit: { voltage: 12, r1: 10, r2: 20, parallel: false },
      network: { learningRate: 0.8, sample: 1 },
    },
    running: false,
    time: 0,
    network: newNetwork(),
    comparisons: [],
  };
}
export function projectile(p: Parameters["projectile"]) {
  const a = (p.angle * Math.PI) / 180,
    vx = p.speed * Math.cos(a),
    vy = p.speed * Math.sin(a),
    flight = (2 * vy) / p.gravity;
  return {
    vx,
    vy,
    flight,
    range: vx * flight,
    height: (vy * vy) / (2 * p.gravity),
  };
}
export function circuit(p: Parameters["circuit"]) {
  const resistance = p.parallel ? 1 / (1 / p.r1 + 1 / p.r2) : p.r1 + p.r2,
    current = p.voltage / resistance;
  return {
    resistance,
    current,
    i1: p.parallel ? p.voltage / p.r1 : current,
    i2: p.parallel ? p.voltage / p.r2 : current,
    v1: p.parallel ? p.voltage : current * p.r1,
    v2: p.parallel ? p.voltage : current * p.r2,
    power: p.voltage * current,
  };
}
export function applyAction(state: State, untrusted: unknown): State {
  const a = actionSchema.parse(untrusted);
  switch (a.type) {
    case "select":
      return { ...state, concept: a.concept, running: false, time: 0 };
    case "parameter": {
      const p = parameterSchemas[state.concept].parse({
        ...state.params[state.concept],
        [a.key]: a.value,
      });
      return {
        ...state,
        params: { ...state.params, [state.concept]: p },
        time: 0,
      };
    }
    case "play":
      return {
        ...state,
        running: !state.running,
        time:
          state.concept === "projectile" &&
          state.time >= projectile(state.params.projectile).flight
            ? 0
            : state.time,
      };
    case "reset":
      return {
        ...state,
        running: false,
        time: 0,
        network: state.concept === "network" ? newNetwork() : state.network,
      };
    case "compare":
      if (state.concept !== "projectile")
        throw new Error("Compare is available in projectile motion.");
      return {
        ...state,
        comparisons: [...state.comparisons, state.params.projectile].slice(-3),
      };
    case "clearComparisons":
      return { ...state, comparisons: [] };
    case "import":
      return { ...a.state, running: false };
  }
}
export function tick(state: State, dt: number): State {
  if (!state.running) return state;
  if (state.concept === "network")
    return {
      ...state,
      network: train(state.network, state.params.network.learningRate),
    };
  if (state.concept === "circuit")
    return { ...state, time: (state.time + dt) % 100 };
  const flight = projectile(state.params.projectile).flight,
    time = Math.min(state.time + dt, flight);
  return { ...state, time, running: time < flight };
}
export function checkpoint(state: State) {
  return {
    format: "mindscope",
    version: 1,
    state: { ...state, running: false },
  };
}
export function readCheckpoint(value: unknown): State {
  return z
    .object({
      format: z.literal("mindscope"),
      version: z.literal(1),
      state: stateSchema,
    })
    .strict()
    .parse(value).state;
}
export function explain(state: State, question: string): string {
  if (state.concept === "projectile") {
    const p = state.params.projectile,
      r = projectile(p);
    return `At ${p.speed} m/s and ${p.angle}°, the launch has horizontal velocity ${r.vx.toFixed(2)} m/s and vertical velocity ${r.vy.toFixed(2)} m/s. Gravity is ${p.gravity} m/s². The predicted range is ${r.range.toFixed(2)} m, peak height ${r.height.toFixed(2)} m, and flight time ${r.flight.toFixed(2)} s.\n\n${/gravity|moon/i.test(question) ? "Reducing gravity increases both flight time and range because the vertical velocity takes longer to reach zero." : /angle/i.test(question) ? "On level ground without drag, 45° gives the longest range at a fixed speed. Complementary angles give the same range but different heights." : "Try saving this trajectory, then change the angle. Compare the height and landing point. What stays the same at 30° and 60°?"}\n\nModel: constant gravity, level ground, no air resistance.`;
  }
  if (state.concept === "circuit") {
    const p = state.params.circuit,
      r = circuit(p);
    return `This ${p.parallel ? "parallel" : "series"} circuit has a ${p.voltage} V supply and ${p.r1} Ω / ${p.r2} Ω resistors. Equivalent resistance is ${r.resistance.toFixed(2)} Ω, so I = V/R = ${r.current.toFixed(3)} A.\n\nR₁: ${r.v1.toFixed(2)} V, ${r.i1.toFixed(3)} A. R₂: ${r.v2.toFixed(2)} V, ${r.i2.toFixed(3)} A. ${p.parallel ? "Each branch sees the same voltage; branch currents add up to the supply current." : "The same current flows through both resistors; the voltage drops add up to the supply voltage."}\n\nTry switching the topology and predict whether the total current will increase. Ideal DC components; electron flow is illustrated, not to scale.`;
  }
  const n = state.network;
  return `The 2 → 4 → 1 network has trained for ${n.epoch} epochs. Its binary cross-entropy loss is ${loss(n).toFixed(4)} at learning rate ${state.params.network.learningRate}.\n\nCurrent XOR predictions: ${samples.map((x, i) => `${x.join(" ⊕ ")} → ${forward(n, x).output.toFixed(3)} (target ${targets[i]})`).join("; ")}.\n\nHidden sigmoid neurons let the network learn XOR’s nonlinear boundary. Backpropagation computes gradients; each weight moves by −learning rate × gradient. Try training, then inspect each input pair to see the activations change.`;
}
export function parseCommand(text: string, state: State): Action | null {
  const t = text.toLowerCase();
  if (/^(show|open|switch to|select)\b/.test(t)) {
    if (/circuit/.test(t)) return { type: "select", concept: "circuit" };
    if (/projectile|motion/.test(t))
      return { type: "select", concept: "projectile" };
    if (/network|xor/.test(t)) return { type: "select", concept: "network" };
  }
  if (/^(play|start|train|pause|stop)(\s|$)/.test(t)) {
    const start = /^(play|start|train)/.test(t);
    return start === state.running ? null : { type: "play" };
  }
  if (/^reset\b/.test(t)) return { type: "reset" };
  if (
    state.concept === "circuit" &&
    /^(switch|set|use)\b/.test(t) &&
    /parallel|series/.test(t)
  )
    return {
      type: "parameter",
      key: "parallel",
      value: t.includes("parallel"),
    };
  const keys: Record<string, string> = {
    speed: "speed",
    angle: "angle",
    gravity: "gravity",
    voltage: "voltage",
    r1: "r1",
    r2: "r2",
    "learning rate": "learningRate",
  };
  const match = t.match(
    /^(?:set|change) (speed|angle|gravity|voltage|r1|r2|learning rate)(?: to| =)?\s+(-?\d+(?:\.\d+)?)/,
  );
  if (match)
    return actionSchema.parse({
      type: "parameter",
      key: keys[match[1]],
      value: Number(match[2]),
    });
  return null;
}
