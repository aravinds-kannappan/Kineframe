import {
  gesture,
  stabilizePointer,
  zoomRatio,
  type Landmark,
} from "./gestures";

type Point = { x: number; y: number };
export type HandEvent =
  | { type: "start" | "move"; point: Point }
  | { type: "end"; point: Point; cancelled: boolean }
  | { type: "zoom"; factor: number };
export type HandFrame = {
  point: Point | null;
  held: boolean;
  status: string;
  events: HandEvent[];
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const palm = (h: Landmark[]) => ({
  x: (h[0].x + h[5].x + h[9].x + h[17].x) / 4,
  y: (h[0].y + h[5].y + h[9].y + h[17].y) / 4,
});
const valid = (h: Landmark[]) =>
  h.length >= 21 &&
  h.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

/** Camera gestures behave like touch contacts: acquire, hold, release.
 * No actions from a single frame; hand order and finger closure cannot move a held target.
 * Timestamps are milliseconds; viewport coordinates are CSS pixels.
 */
export class HandInput {
  private wrist: Point | null = null;
  private point: Point | null = null;
  private palmOrigin: Point | null = null;
  private contact: Point | null = null;
  private held = false;
  private moved = false;
  private armed = false;
  private openSince: number | null = null;
  private pressSince: number | null = null;
  private releaseSince: number | null = null;
  private pairSince: number | null = null;
  private zoomDistance: number | null = null;
  private zooming = false;
  private blocked = false;
  private missingSince: number | null = null;
  private lastTime: number | null = null;

  update(
    input: Landmark[][],
    now: number,
    width: number,
    height: number,
  ): HandFrame {
    const events: HandEvent[] = [];
    const dt = this.lastTime === null ? 45 : Math.max(1, now - this.lastTime);
    this.lastTime = now;
    const hands = input.filter(valid);
    const finish = (cancelled: boolean) => {
      if (this.held && this.point)
        events.push({ type: "end", point: this.point, cancelled });
      this.held = false;
      this.moved = false;
      this.pressSince = this.releaseSince = null;
      this.contact = this.palmOrigin = null;
    };
    const result = (status: string, visible = true): HandFrame => ({
      point: visible ? this.point : null,
      held: this.held,
      status,
      events,
    });
    // Both hands must reopen after a zoom or a tracking cancellation.
    if (this.blocked) {
      if (hands.length && hands.every((h) => !gesture(h, true).pinch)) {
        this.openSince ??= now;
        if (now - this.openSince >= 100) {
          this.blocked = false;
          this.armed = true;
          this.wrist = this.point = null;
          this.openSince = null;
        }
      } else this.openSince = null;
      return result("Open your fingers to aim again", false);
    }
    const both =
      hands.length === 2 && hands.every((h) => gesture(h, this.zooming).pinch);
    if (both) {
      this.pairSince ??= now;
      // Freeze the first contact while determining whether this is a two-hand gesture.
      if (now - this.pairSince < 120)
        return result("Hold both pinches to zoom");
      const span = distance(palm(hands[0]), palm(hands[1]));
      if (span < 0.12) return result("Separate your hands a little", false);
      if (!this.zooming) {
        finish(true);
        this.zooming = true;
        this.zoomDistance = span;
      } else if (this.zoomDistance !== null) {
        const delta = Math.abs(Math.log(span / this.zoomDistance));
        if (delta > 0.3) {
          this.zooming = false;
          this.blocked = true;
          this.openSince = null;
          return result("Tracking changed. Open your fingers to resume", false);
        }
        if (delta > 0.012) {
          const next =
            this.zoomDistance +
            (span - this.zoomDistance) *
              (1 - Math.exp(-Math.min(dt, 100) / 110));
          events.push({
            type: "zoom",
            factor: zoomRatio(this.zoomDistance, next),
          });
          this.zoomDistance = next;
        }
      }
      return result("Spread to zoom in · bring together to zoom out", false);
    }
    this.pairSince = null;
    if (this.zooming) {
      this.zooming = false;
      this.zoomDistance = null;
      this.blocked = true;
      this.openSince = null;
      return result("Zoom finished · open both hands to resume", false);
    }
    // Track the same wrist even when MediaPipe reverses its result order.
    const hand = this.wrist
      ? hands
          .filter((h) => distance(h[0], this.wrist!) < 0.18)
          .sort(
            (a, b) => distance(a[0], this.wrist!) - distance(b[0], this.wrist!),
          )[0]
      : hands[0];
    if (!hand) {
      this.missingSince ??= now;
      this.pressSince = null;
      this.openSince = null;
      if (now - this.missingSince >= 180) {
        finish(true);
        this.wrist = this.point = null;
        this.armed = false;
        this.blocked = true;
      }
      return result("Tracking paused · bring your hand into view", false);
    }
    const regained = this.missingSince !== null;
    this.missingSince = null;
    this.wrist = hand[0];
    const g = gesture(hand, this.held || this.pressSince !== null);
    const p = palm(hand);
    const aim = { x: g.x * width, y: g.y * height };
    if (!this.armed) {
      if (!g.pinch) {
        this.openSince ??= now;
        if (now - this.openSince >= 100) this.armed = true;
      } else this.openSince = null;
      this.point = stabilizePointer(this.point, aim, dt);
      return result("Point with an open hand, then pinch");
    }
    if (this.held) {
      if (!g.pinch) {
        this.releaseSince ??= now;
        // Release jitter never drags the object or taps a neighbouring control.
        if (now - this.releaseSince >= 90) finish(false);
        return result(
          this.held ? "Releasing…" : "Released · point to your next target",
        );
      }
      this.releaseSince = null;
      if (regained) {
        this.contact = this.point;
        this.palmOrigin = p;
      }
      const next = {
        x: this.contact!.x - ((p.x - this.palmOrigin!.x) * width) / 0.76,
        y: this.contact!.y + ((p.y - this.palmOrigin!.y) * height) / 0.7,
      };
      next.x = Math.max(0, Math.min(width - 1, next.x));
      next.y = Math.max(0, Math.min(height - 1, next.y));
      this.moved ||= distance(next, this.contact!) > 10;
      if (this.moved) {
        this.point = stabilizePointer(this.point, next, dt);
        events.push({ type: "move", point: this.point });
      }
      return result("Holding · move to drag · open fingers to release");
    }
    if (g.pinch) {
      if (this.pressSince === null) {
        this.pressSince = now;
        // Latch the last open-hand cursor, before closing fingers displaces the fingertip.
        this.point ??= aim;
      }
      if (now - this.pressSince >= 100) {
        this.held = true;
        this.contact = this.point;
        this.palmOrigin = p;
        events.push({ type: "start", point: this.point! });
      }
      return result(this.held ? "Holding · move to drag" : "Pinching…");
    }
    this.pressSince = null;
    this.point = stabilizePointer(this.point, aim, dt);
    return result("Point to aim · pinch and release to tap · hold to drag");
  }
}
