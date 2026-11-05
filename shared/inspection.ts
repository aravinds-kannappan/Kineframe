import {
  projectile,
  circuit,
  forward,
  samples,
  type State,
} from "./simulation";
export function describeElement(state: State, selected: string | null) {
  const chapter =
    state.concept === "projectile" ? 0 : state.concept === "circuit" ? 1 : 2;
  const p = projectile(state.params.projectile),
    c = circuit(state.params.circuit);
  if (chapter === 0)
    return selected === "launch"
      ? `The launch sets the starting conditions: ${state.params.projectile.speed} m/s at ${state.params.projectile.angle}°. Horizontal speed is ${p.vx.toFixed(2)} m/s; vertical speed starts at ${p.vy.toFixed(2)} m/s.`
      : `Gravity bends this projectile’s path downward at ${state.params.projectile.gravity} m/s². The dot is at simulation time ${state.time.toFixed(2)} s. Its predicted landing point is ${p.range.toFixed(2)} m from launch. No air resistance is modeled.`;
  if (chapter === 1)
    return selected === "battery"
      ? `The ideal battery supplies ${state.params.circuit.voltage} V. The complete circuit draws ${c.current.toFixed(3)} A and consumes ${c.power.toFixed(2)} W.`
      : `${selected} resists the flow of charge. It carries ${(selected === "R₁" ? c.i1 : c.i2).toFixed(3)} A with a voltage drop of ${(selected === "R₁" ? c.v1 : c.v2).toFixed(2)} V. ${state.params.circuit.parallel ? "Each branch receives the full supply voltage." : "Both resistors carry the same current."}`;
  const f = forward(state.network, samples[state.params.network.sample]);
  if (selected?.startsWith("hidden")) {
    const i = Number(selected.split(" ").at(-1)) - 1;
    return `Hidden neuron ${i + 1} transforms a weighted sum through a sigmoid. Its activation is ${f.hidden[i].toFixed(4)}. Its outgoing weight is ${state.network.w2[i].toFixed(4)} and that weight’s latest gradient is ${state.network.gradients[i].toFixed(5)}. These nonlinear neurons make XOR learnable.`;
  }
  return selected === "output"
    ? `The output is ${f.output.toFixed(4)} for input ${samples[state.params.network.sample].join(", ")}. Values above 0.5 predict 1; below 0.5 predict 0. Training changes the weights to reduce cross-entropy loss.`
    : `These two inputs are the bits in XOR. The current pair is ${samples[state.params.network.sample].join(", ")}. Exactly one active input should produce 1. Select a different pair to trace its activations.`;
}
