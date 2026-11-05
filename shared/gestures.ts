/** Coordinates stay on the device. Normalized distances make pinch work at different camera distances. */
export type Landmark = { x: number; y: number; z?: number };
export function gesture(hand: Landmark[], wasPinching = false) {
  const distance = (a: number, b: number) =>
    Math.hypot(hand[a].x - hand[b].x, hand[a].y - hand[b].y);
  const palm = Math.max(0.04, distance(0, 9));
  const pinch = distance(4, 8) / palm < (wasPinching ? 0.42 : 0.28);
  const extended = (tip: number, pip: number) =>
    distance(tip, 0) > distance(pip, 0) * 1.15;
  const scroll =
    !pinch &&
    extended(8, 6) &&
    extended(12, 10) &&
    !extended(16, 14) &&
    !extended(20, 18);
  return {
    pinch,
    scroll,
    x: Math.max(0, Math.min(1, (1 - hand[8].x - 0.12) / 0.76)),
    y: Math.max(0, Math.min(1, (hand[8].y - 0.1) / 0.7)),
  };
}
export function sliderValue(
  x: number,
  left: number,
  width: number,
  min: number,
  max: number,
  step: number,
) {
  const raw = min + Math.max(0, Math.min(1, (x - left) / width)) * (max - min);
  return Math.max(
    min,
    Math.min(
      max,
      Number((min + Math.round((raw - min) / step) * step).toFixed(5)),
    ),
  );
}
