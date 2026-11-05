import test from "node:test";
import assert from "node:assert/strict";
import {
  starterBoard,
  solveBoard,
  applyOperations,
  guidedExperiment,
  boardSchema,
  type Board,
} from "../shared/circuitLab";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("starter circuit solves series current and conserves energy", () => {
  const s = solveBoard(starterBoard());
  assert.equal(s.status, "powered");
  close(s.current, 0.2);
  close(s.resistance!, 60);
  close(s.readings.R1.voltage!, 4);
  close(s.readings.L1.voltage!, 8);
  close(s.readings.R1.power! + s.readings.L1.power!, s.power);
});
test("parallel branch changes graph conductance, not a preset formula", () => {
  const board = starterBoard(),
    plan = guidedExperiment(board, "add a parallel resistor", "R1")!;
  const next = applyOperations(board, plan.operations),
    s = solveBoard(next);
  close(s.current, 0.24);
  close(s.resistance!, 50);
  close(s.readings.R1.current!, s.readings.R2.current!);
  close(
    s.readings.R1.current! + s.readings.R2.current!,
    s.readings.L1.current!,
  );
  close(
    s.readings.R1.power! + s.readings.R2.power! + s.readings.L1.power!,
    s.power,
  );
  assert.equal(board.parts.length, 4);
});
test("open switch and disconnected wire interrupt the actual path", () => {
  for (const ops of [
    [{ type: "toggle" as const, id: "S1" }],
    [{ type: "disconnect" as const, id: "w2" }],
  ]) {
    const s = solveBoard(applyOperations(starterBoard(), ops));
    assert.equal(s.status, "open");
    close(s.current, 0);
    close(s.readings.L1.power!, 0);
  }
});
test("source shorts are reported without a fabricated finite current", () => {
  const s = solveBoard(
    applyOperations(starterBoard(), [
      { type: "connect", a: "B1:a", b: "B1:b" },
    ]),
  );
  assert.equal(s.status, "short");
  assert.equal(s.resistance, null);
  assert.equal(s.readings.B1.current, null);
});
test("floating island readings are undefined while grounded dead branches have zero current", () => {
  const b = applyOperations(starterBoard(), [
    {
      type: "add",
      part: {
        id: "R9",
        kind: "resistor",
        value: 100,
        x: 2,
        y: 3,
        closed: true,
      },
    },
  ]);
  let s = solveBoard(b);
  assert.equal(s.readings.R9.current, null);
  assert.equal(s.potentials["R9:a"], null);
  s = solveBoard(
    applyOperations(b, [{ type: "connect", a: "B1:a", b: "R9:a" }]),
  );
  close(s.readings.R9.current!, 0);
  close(s.potentials["R9:b"]!, 12);
});
test("balanced bridge produces zero bridge current", () => {
  const b: Board = {
    parts: [
      { id: "B", kind: "battery", value: 10, x: 0, y: 0, closed: true },
      ...["A", "C", "D", "E", "F"].map((id) => ({
        id,
        kind: "resistor" as const,
        value: 10,
        x: 0,
        y: 0,
        closed: true,
      })),
    ],
    wires: [
      ["B:a", "A:a"],
      ["B:a", "D:a"],
      ["A:b", "C:a"],
      ["D:b", "E:a"],
      ["C:b", "B:b"],
      ["E:b", "B:b"],
      ["F:a", "A:b"],
      ["F:b", "D:b"],
    ].map(([a, b], i) => ({ id: `w${i}`, a, b })),
  };
  const s = solveBoard(b);
  close(s.current, 1);
  close(s.readings.F.current!, 0);
  close(s.power, 10);
});
test("validation rejects unsafe or inconsistent graph edits atomically", () => {
  const b = starterBoard();
  for (const ops of [
    [{ type: "set", id: "B1", value: 50 }],
    [{ type: "connect", a: "missing:a", b: "B1:a" }],
    [{ type: "remove", id: "B1" }],
    [{ type: "toggle", id: "L1" }],
  ])
    assert.throws(() => applyOperations(b, ops as never));
  assert.equal(b.parts[0].value, 12);
  assert.throws(() =>
    boardSchema.parse({ ...b, parts: [...b.parts, b.parts[0]] }),
  );
});
test("remove cleans attached wires; duplicate connections do not multiply conductance", () => {
  let b = applyOperations(starterBoard(), [{ type: "remove", id: "R1" }]);
  assert.equal(b.wires.length, 2);
  assert.equal(solveBoard(b).status, "open");
  b = applyOperations(starterBoard(), [
    { type: "connect", a: "R1:a", b: "B1:a" },
  ]);
  assert.equal(b.wires.length, 4);
});
test("guided proposals target selected components and reject unsupported free-form requests", () => {
  const b = starterBoard();
  const plan = guidedExperiment(b, "double the resistance", "L1")!;
  close(solveBoard(applyOperations(b, plan.operations)).current, 12 / 100);
  assert.equal(guidedExperiment(b, "build a quantum computer"), null);
  assert.ok(guidedExperiment(b, "add a parallel resistor", "B1"));
  assert.equal(
    guidedExperiment(
      applyOperations(b, [{ type: "toggle", id: "S1" }]),
      "open the switch",
    ),
    null,
  );
  const halve = guidedExperiment(b, "halve the voltage")!;
  close(solveBoard(applyOperations(b, halve.operations)).current, 0.1);
});
