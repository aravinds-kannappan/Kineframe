import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  initialState,
  projectile,
  circuit,
  newNetwork,
  train,
  loss,
  forward,
  samples,
  targets,
  tick,
  checkpoint,
  readCheckpoint,
  parseCommand,
} from "../shared/simulation";
import { sliderValue, gesture, type Landmark } from "../shared/gestures";
test("projectile obeys analytical range, height, and landing equations", () => {
  const p = { speed: 20, angle: 45, gravity: 10 },
    r = projectile(p);
  assert.ok(Math.abs(r.range - 40) < 1e-9);
  assert.ok(Math.abs(r.height - 10) < 1e-9);
  assert.ok(Math.abs(r.vy * r.flight - 0.5 * p.gravity * r.flight ** 2) < 1e-9);
  const complement = projectile({ ...p, angle: 60 });
  assert.ok(
    Math.abs(complement.range - projectile({ ...p, angle: 30 }).range) < 1e-9,
  );
  assert.ok(projectile({ ...p, gravity: 1.62 }).range > r.range);
});
test("series and parallel obey Ohm and Kirchhoff laws", () => {
  for (const parallel of [true, false]) {
    const p = { voltage: 12, r1: 10, r2: 20, parallel },
      r = circuit(p);
    assert.ok(Math.abs(r.power - p.voltage * r.current) < 1e-12);
    if (parallel) {
      assert.equal(r.v1, 12);
      assert.equal(r.v2, 12);
      assert.ok(Math.abs(r.i1 + r.i2 - r.current) < 1e-12);
    } else {
      assert.equal(r.resistance, 30);
      assert.equal(r.current, 0.4);
      assert.equal(r.v1 + r.v2, p.voltage);
    }
  }
});
test("a real 2–4–1 network learns all four XOR cases", () => {
  const n = newNetwork(),
    trained = train(n, 0.8, 12000);
  assert.equal(n.epoch, 0);
  assert.ok(loss(trained) < 0.03);
  samples.forEach((s, i) =>
    assert.equal(Number(forward(trained, s).output >= 0.5), targets[i]),
  );
  assert.ok(trained.gradients.every(Number.isFinite));
});
test("finite difference agrees with backprop output gradient", () => {
  const n = newNetwork(),
    epsilon = 1e-5,
    plus = structuredClone(n),
    minus = structuredClone(n);
  plus.w2[0] += epsilon;
  minus.w2[0] -= epsilon;
  const numerical = (loss(plus) - loss(minus)) / (2 * epsilon);
  assert.ok(Math.abs(numerical - train(n, 0.01, 1).gradients[0]) < 1e-7);
});
test("room actions reject invalid, unrelated, and non-finite parameters", () => {
  const s = initialState();
  for (const value of [-1, 41, NaN, Infinity, "12"])
    assert.throws(() =>
      applyAction(s, { type: "parameter", key: "speed", value }),
    );
  assert.throws(() =>
    applyAction(s, { type: "parameter", key: "voltage", value: 12 }),
  );
  assert.throws(() => applyAction(s, { type: "evil" }));
  assert.equal(s.params.projectile.speed, 18);
});
test("play, pause, landing, replay, and reset have consistent time", () => {
  let s = applyAction(initialState(), { type: "play" });
  s = tick(s, 100);
  assert.equal(s.running, false);
  assert.equal(s.time, projectile(s.params.projectile).flight);
  s = applyAction(s, { type: "play" });
  assert.equal(s.time, 0);
  s = tick(s, 0.1);
  s = applyAction(s, { type: "play" });
  assert.equal(tick(s, 1).time, 0.1);
  s = applyAction(s, { type: "reset" });
  assert.equal(s.time, 0);
  assert.equal(s.running, false);
});
test("checkpoint round trips learned weights and rejects broken imports", () => {
  const s = initialState();
  s.network = train(s.network, 1, 100);
  const restored = readCheckpoint(JSON.parse(JSON.stringify(checkpoint(s))));
  assert.deepEqual(restored, s);
  assert.throws(() =>
    readCheckpoint({ format: "mindscope", version: 2, state: s }),
  );
  assert.throws(() =>
    readCheckpoint({
      format: "mindscope",
      version: 1,
      state: { ...s, network: { ...s.network, w1: [] } },
    }),
  );
});
test("comparison snapshots are stable and capped at three", () => {
  let s = applyAction(initialState(), { type: "compare" });
  s = applyAction(s, { type: "parameter", key: "angle", value: 60 });
  assert.equal(s.comparisons[0].angle, 45);
  for (let i = 0; i < 5; i++) s = applyAction(s, { type: "compare" });
  assert.equal(s.comparisons.length, 3);
});
test("guided commands are explicit and pause is idempotent", () => {
  const s = initialState();
  assert.equal(parseCommand("pause", s), null);
  assert.deepEqual(parseCommand("set angle to 60", s), {
    type: "parameter",
    key: "angle",
    value: 60,
  });
  assert.deepEqual(parseCommand("show circuits", s), {
    type: "select",
    concept: "circuit",
  });
  assert.equal(parseCommand("Why does the angle matter?", s), null);
});
test("hand slider clamps endpoints and quantizes to its step", () => {
  assert.equal(sliderValue(150, 100, 100, 1, 40, 1), 21);
  assert.equal(sliderValue(-1, 100, 100, 1, 40, 1), 1);
  assert.equal(sliderValue(500, 100, 100, 1, 40, 1), 40);
  assert.equal(sliderValue(150, 100, 100, 0.01, 3, 0.01), 1.51);
});
test("pinch hysteresis prevents repeated selection around threshold", () => {
  const h: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  h[0] = { x: 0.5, y: 0.8 };
  h[9] = { x: 0.5, y: 0.6 };
  h[8] = { x: 0.5, y: 0.2 };
  h[4] = { x: 0.565, y: 0.2 };
  assert.equal(gesture(h, false).pinch, false);
  assert.equal(gesture(h, true).pinch, true);
  h[4] = { x: 0.52, y: 0.2 };
  assert.equal(gesture(h, false).pinch, true);
  assert.ok(gesture(h).x >= 0 && gesture(h).x <= 1);
});
