import { test } from "node:test";
import assert from "node:assert/strict";
import { HandInput } from "../shared/handInput";
import type { Landmark } from "../shared/gestures";
function hand(closed = false, x = 0.5): Landmark[] {
  const h = Array.from({ length: 21 }, () => ({ x, y: 0.5 }));
  h[0] = { x, y: 0.8 };
  h[9] = { x, y: 0.6 };
  h[5] = { x: x - 0.05, y: 0.6 };
  h[17] = { x: x + 0.05, y: 0.6 };
  h[8] = { x, y: closed ? 0.35 : 0.2 };
  h[4] = { x: x + (closed ? 0.02 : 0.15), y: h[8].y };
  return h;
}
const update = (g: HandInput, h: Landmark[][], t: number) =>
  g.update(h, t, 1000, 800);
function ready() {
  const g = new HandInput();
  update(g, [hand()], 0);
  update(g, [hand()], 110);
  return g;
}
test("debounced pinch captures the aim before finger closure and emits one start", () => {
  const g = ready(),
    aim = update(g, [hand()], 150).point;
  assert.equal(update(g, [hand(true)], 190).events.length, 0);
  assert.equal(update(g, [hand()], 230).events.length, 0);
  update(g, [hand(true)], 270);
  const start = update(g, [hand(true)], 380);
  assert.equal(start.events[0].type, "start");
  assert.deepEqual(start.point, aim);
  assert.equal(update(g, [hand(true)], 420).events.length, 0);
});
test("stable wrist matching survives reversed hand order and release noise", () => {
  const g = ready();
  update(g, [hand(true)], 150);
  update(g, [hand(true)], 260);
  const frame = update(g, [hand(false, 0.8), hand(true, 0.49)], 310);
  assert.equal(frame.held, true);
  assert.ok(frame.point!.x < 550);
  assert.equal(update(g, [hand()], 350).events.length, 0);
  assert.equal(update(g, [hand(true)], 390).held, true);
  update(g, [hand()], 450);
  const release = update(g, [hand()], 550);
  assert.equal(release.events[0].type, "end");
  assert.equal(release.held, false);
});
test("tracking loss freezes a drag, cancels prolonged loss and requires reopening", () => {
  const g = ready();
  update(g, [hand(true)], 150);
  update(g, [hand(true)], 260);
  assert.equal(update(g, [], 300).events.length, 0);
  const cancelled = update(g, [], 510);
  assert.equal(cancelled.events[0].type, "end");
  assert.equal(update(g, [hand(true)], 600).events.length, 0);
  update(g, [hand()], 650);
  update(g, [hand()], 760);
  update(g, [hand(true)], 810);
  assert.equal(update(g, [hand(true)], 920).events[0].type, "start");
});
test("two-handed zoom is stable at rest and cannot fall into a one-handed drag", () => {
  const g = ready();
  update(g, [hand(true, 0.3), hand(true, 0.7)], 150);
  update(g, [hand(true, 0.3), hand(true, 0.7)], 280);
  assert.equal(
    update(g, [hand(true, 0.301), hand(true, 0.699)], 330).events.length,
    0,
  );
  const zoom = update(g, [hand(true, 0.27), hand(true, 0.73)], 380);
  assert.equal(zoom.events[0].type, "zoom");
  assert.ok("factor" in zoom.events[0] && zoom.events[0].factor < 1);
  assert.equal(update(g, [hand(true, 0.27)], 430).events.length, 0);
  assert.equal(update(g, [hand(true, 0.27)], 580).events.length, 0);
});
