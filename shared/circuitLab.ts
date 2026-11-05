import { z } from "zod";
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,32}$/)
  .refine(
    (v) => !["__proto__", "constructor", "prototype"].includes(v),
    "Reserved identifier",
  );
export const partSchema = z
  .object({
    id,
    kind: z.enum(["battery", "resistor", "bulb", "switch"]),
    value: z.number().finite().min(1).max(1000),
    x: z.number().min(-10).max(10),
    y: z.number().min(-7).max(7),
    closed: z.boolean(),
  })
  .strict();
export type Part = z.infer<typeof partSchema>;
export const boardSchema = z
  .object({
    parts: z.array(partSchema).min(1).max(12),
    wires: z
      .array(
        z.object({ id, a: z.string().max(35), b: z.string().max(35) }).strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((b, ctx) => {
    const ids = new Set(b.parts.map((p) => p.id)),
      terminals = new Set(b.parts.flatMap((p) => [p.id + ":a", p.id + ":b"]));
    if (
      ids.size !== b.parts.length ||
      b.parts.filter((p) => p.kind === "battery").length !== 1 ||
      b.parts.some((p) => p.kind === "battery" && p.value > 24) ||
      new Set(b.wires.map((w) => w.id)).size !== b.wires.length ||
      b.wires.some(
        (w) => !terminals.has(w.a) || !terminals.has(w.b) || w.a === w.b,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A circuit needs one 1–24 V battery, unique IDs, and valid terminal connections.",
      });
  });
export type Board = z.infer<typeof boardSchema>;
export type Reading = {
  voltage: number | null;
  current: number | null;
  power: number | null;
};
export type Solution = {
  status: "powered" | "open" | "short";
  current: number;
  power: number;
  resistance: number | null;
  readings: Record<string, Reading>;
  potentials: Record<string, number | null>;
};
export function starterBoard(): Board {
  return {
    parts: [
      { id: "B1", kind: "battery", value: 12, x: -5, y: 0, closed: true },
      { id: "R1", kind: "resistor", value: 20, x: 0, y: -2.3, closed: true },
      { id: "L1", kind: "bulb", value: 40, x: 5, y: 0, closed: true },
      { id: "S1", kind: "switch", value: 1, x: 0, y: 2.3, closed: true },
    ],
    wires: [
      { id: "w1", a: "B1:a", b: "R1:a" },
      { id: "w2", a: "R1:b", b: "L1:a" },
      { id: "w3", a: "L1:b", b: "S1:b" },
      { id: "w4", a: "S1:a", b: "B1:b" },
    ],
  };
}
export function terminal(board: Board, t: string) {
  const [id, side] = t.split(":");
  const p = board.parts.find((p) => p.id === id)!;
  return { x: p.x + (side === "a" ? -1.15 : 1.15), y: p.y };
}
export function solveBoard(input: Board): Solution {
  const b = boardSchema.parse(input),
    parent = new Map<string, string>();
  b.parts.forEach((p) => {
    parent.set(p.id + ":a", p.id + ":a");
    parent.set(p.id + ":b", p.id + ":b");
  });
  const root = (x: string): string => {
    const p = parent.get(x)!;
    if (p !== x) parent.set(x, root(p));
    return parent.get(x)!;
  };
  const union = (a: string, c: string) => parent.set(root(a), root(c));
  b.wires.forEach((w) => union(w.a, w.b));
  b.parts
    .filter((p) => p.kind === "switch" && p.closed)
    .forEach((p) => union(p.id + ":a", p.id + ":b"));
  const battery = b.parts.find((p) => p.kind === "battery")!,
    positive = root(battery.id + ":a"),
    ground = root(battery.id + ":b");
  const readings: Record<string, Reading> = {},
    potentials: Record<string, number | null> = {};
  if (positive === ground) {
    b.parts.forEach(
      (p) => (readings[p.id] = { voltage: null, current: null, power: null }),
    );
    return {
      status: "short",
      current: 0,
      power: 0,
      resistance: null,
      readings,
      potentials,
    };
  }
  const edges = b.parts
    .filter((p) => p.kind === "resistor" || p.kind === "bulb")
    .map((p) => ({ p, a: root(p.id + ":a"), b: root(p.id + ":b") }));
  const reachable = new Set([positive, ground]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges)
      if (reachable.has(e.a) || reachable.has(e.b)) {
        if (!reachable.has(e.a) || !reachable.has(e.b)) changed = true;
        reachable.add(e.a);
        reachable.add(e.b);
      }
  }
  const unknown = [...reachable].filter((n) => n !== positive && n !== ground),
    index = new Map(unknown.map((n, i) => [n, i])),
    matrix = unknown.map(() => Array(unknown.length + 1).fill(0) as number[]);
  for (const e of edges) {
    const g = 1 / e.p.value;
    for (const [a, c] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      const i = index.get(a);
      if (i === undefined || a === c) continue;
      matrix[i][i] += g;
      const j = index.get(c);
      if (j !== undefined) matrix[i][j] -= g;
      else if (c === positive) matrix[i][unknown.length] += g * battery.value;
    }
  }
  for (let k = 0; k < unknown.length; k++) {
    let pivot = k;
    for (let i = k + 1; i < unknown.length; i++)
      if (Math.abs(matrix[i][k]) > Math.abs(matrix[pivot][k])) pivot = i;
    [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
    if (Math.abs(matrix[k][k]) < 1e-12)
      throw new Error("Circuit matrix could not be solved.");
    const d = matrix[k][k];
    for (let j = k; j <= unknown.length; j++) matrix[k][j] /= d;
    for (let i = 0; i < unknown.length; i++)
      if (i !== k) {
        const f = matrix[i][k];
        for (let j = k; j <= unknown.length; j++)
          matrix[i][j] -= f * matrix[k][j];
      }
  }
  const voltages = new Map<string, number>([
    [positive, battery.value],
    [ground, 0],
    ...unknown.map(
      (n, i) => [n, matrix[i][unknown.length]] as [string, number],
    ),
  ]);
  let current = 0;
  edges.forEach((e) => {
    const va = voltages.get(e.a),
      vb = voltages.get(e.b);
    if (va === undefined || vb === undefined) {
      readings[e.p.id] = { voltage: null, current: null, power: null };
      return;
    }
    const v = va - vb,
      i = v / e.p.value;
    readings[e.p.id] = { voltage: v, current: i, power: i * i * e.p.value };
    if (e.a === positive) current += i;
    if (e.b === positive) current -= i;
  });
  current = Math.max(0, current);
  b.parts.forEach((p) => {
    const a = voltages.get(root(p.id + ":a")),
      c = voltages.get(root(p.id + ":b"));
    potentials[p.id + ":a"] = a ?? null;
    potentials[p.id + ":b"] = c ?? null;
    if (p.kind === "switch")
      readings[p.id] = {
        voltage: a !== undefined && c !== undefined ? a - c : null,
        current: p.closed ? null : 0,
        power: 0,
      };
  });
  readings[battery.id] = {
    voltage: battery.value,
    current,
    power: battery.value * current,
  };
  return {
    status: current > 1e-8 ? "powered" : "open",
    current,
    power: battery.value * current,
    resistance: current > 1e-8 ? battery.value / current : null,
    readings,
    potentials,
  };
}
export const operationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("set"),
      id,
      value: z.number().finite().min(1).max(1000),
    })
    .strict(),
  z.object({ type: z.literal("toggle"), id }).strict(),
  z.object({ type: z.literal("add"), part: partSchema }).strict(),
  z.object({ type: z.literal("remove"), id }).strict(),
  z
    .object({
      type: z.literal("connect"),
      a: z.string().max(35),
      b: z.string().max(35),
    })
    .strict(),
  z.object({ type: z.literal("disconnect"), id }).strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
export const planSchema = z
  .object({
    title: z.string().min(1).max(120),
    reason: z.string().max(1200),
    operations: z.array(operationSchema).min(1).max(12),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export function applyOperations(board: Board, operations: Operation[]): Board {
  let next = structuredClone(board);
  for (const raw of operations) {
    const op = operationSchema.parse(raw);
    if (op.type === "add") {
      if (op.part.kind === "battery")
        throw new Error("Only one voltage source is supported.");
      next.parts.push(op.part);
    } else if (op.type === "connect") {
      if (
        !next.wires.some(
          (w) =>
            (w.a === op.a && w.b === op.b) || (w.a === op.b && w.b === op.a),
        )
      ) {
        let i = 1;
        while (next.wires.some((w) => w.id === `wire${i}`)) i++;
        next.wires.push({ id: `wire${i}`, a: op.a, b: op.b });
      }
    } else if (op.type === "disconnect") {
      if (!next.wires.some((w) => w.id === op.id))
        throw new Error("Wire not found.");
      next.wires = next.wires.filter((w) => w.id !== op.id);
    } else {
      const part = next.parts.find((p) => p.id === op.id);
      if (!part) throw new Error("Component not found.");
      if (op.type === "remove") {
        if (part.kind === "battery")
          throw new Error("Keep the source battery.");
        next.parts = next.parts.filter((p) => p.id !== op.id);
        next.wires = next.wires.filter(
          (w) => !w.a.startsWith(op.id + ":") && !w.b.startsWith(op.id + ":"),
        );
      }
      if (op.type === "set") {
        if (!["battery", "resistor", "bulb"].includes(part.kind))
          throw new Error("This component has no adjustable value.");
        part.value = op.value;
      }
      if (op.type === "toggle") {
        if (part.kind !== "switch") throw new Error("Select a switch.");
        part.closed = !part.closed;
      }
    }
    next = boardSchema.parse(next);
  }
  return next;
}
export function guidedExperiment(
  board: Board,
  text: string,
  selected?: string,
): Plan | null {
  const t = text.toLowerCase(),
    battery = board.parts.find((p) => p.kind === "battery")!,
    target =
      board.parts.find(
        (p) =>
          p.id === selected && (p.kind === "resistor" || p.kind === "bulb"),
      ) || board.parts.find((p) => p.kind === "resistor")!;
  if (
    /parallel|another path|second path/.test(t) &&
    target &&
    ["resistor", "bulb"].includes(target.kind)
  ) {
    let i = 1;
    while (board.parts.some((p) => p.id === `R${i}`)) i++;
    const part: Part = {
      id: `R${i}`,
      kind: "resistor",
      value: target.value,
      x: Math.min(8, target.x + 1),
      y: Math.min(6, target.y + 2.6),
      closed: true,
    };
    return {
      title: "Add a parallel branch",
      reason: `Place a ${part.value} Ω resistor across ${target.id}. Predict whether supply current increases.`,
      operations: [
        { type: "add", part },
        { type: "connect", a: `${target.id}:a`, b: `${part.id}:a` },
        { type: "connect", a: `${target.id}:b`, b: `${part.id}:b` },
      ],
    };
  }
  if (/double|halve|half/.test(t)) {
    const p = /volt|battery/.test(t) ? battery : target;
    if (!p) return null;
    return {
      title: `${/double/.test(t) ? "Double" : "Halve"} ${p.id}`,
      reason:
        "Change one value while keeping all connections fixed. Compare the measured current before and after.",
      operations: [
        {
          type: "set",
          id: p.id,
          value: p.value * (/double/.test(t) ? 2 : 0.5),
        },
      ],
    };
  }
  if (/switch|break|open circuit/.test(t)) {
    const p = board.parts.find((p) => p.kind === "switch");
    if (
      p &&
      ((/open|break/.test(t) && !p.closed) || (/close/.test(t) && p.closed))
    )
      return null;
    if (p)
      return {
        title: p.closed ? "Open the switch" : "Close the switch",
        reason:
          "Interrupt or restore the conducting path. Predict what happens to the lamp.",
        operations: [{ type: "toggle", id: p.id }],
      };
  }
  const match = t.match(
    /(?:set|change)\s+(battery|voltage|[brl]\d+)(?:\s+to)?\s+(\d+(?:\.\d+)?)/,
  );
  if (match) {
    const p = ["voltage", "battery"].includes(match[1])
      ? battery
      : board.parts.find((p) => p.id.toLowerCase() === match[1]);
    if (p)
      return {
        title: `Change ${p.id}`,
        reason: "Test a new component value with the same wiring.",
        operations: [{ type: "set", id: p.id, value: Number(match[2]) }],
      };
  }
  return null;
}
export function boardExplanation(board: Board, selected?: string) {
  const s = solveBoard(board);
  if (s.status === "short")
    return "The battery terminals are joined by an ideal conducting path. An ideal source short has no finite current solution. Open a switch or remove the bypass wire; the simulation does not invent a current value.";
  const part = board.parts.find((p) => p.id === selected);
  const r = part ? s.readings[part.id] : null;
  return `${s.status === "open" ? "There is no conducting path between the battery terminals." : "The connected circuit is conducting."} Supply current is ${s.current.toFixed(3)} A and delivered power is ${s.power.toFixed(3)} W. ${s.resistance === null ? "" : `Equivalent resistance is ${s.resistance.toFixed(2)} Ω.`}${part && r ? `\n\n${part.id} is a ${part.kind}${["resistor", "bulb"].includes(part.kind) ? ` modeled as ${part.value} Ω` : ""}. Voltage across it: ${r.voltage === null ? "floating / undefined" : r.voltage.toFixed(3) + " V"}. Current (a → b): ${r.current === null ? "not determined for an ideal switch" : r.current.toFixed(3) + " A"}. Dissipated power: ${r.power === null ? "undefined" : r.power.toFixed(3) + " W"}.` : ""}\n\nThe solver uses Kirchhoff’s current law and Ohm’s law. Bulbs are fixed resistors; glow indicates computed power, not a calibrated brightness model. Try changing only one component and compare before and after.`;
}
