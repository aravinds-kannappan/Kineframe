> Historical Mindscope documentation. The current root route is Kineframe; use `/sandbox` for the circuit workspace.

# Mindscope

**Ideas you can move.** A browser learning lab where an instructor and learners explore the same live experiment through hand gestures, mouse controls, and a private tutor.

Built from the supplied two-page product blueprint. The browser is the first step toward the spatial teaching vision: it renders interactive 3D scenes, not physical holograms.

## Run locally

Requires Node.js **22.9+** and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173** for the full-screen circuit sandbox, **http://localhost:5173/experience** for the guided story, or **http://localhost:5173/lab** for the original examples and classrooms. The welcome screen offers webcam interaction or mouse/keyboard controls. No AI key or account is required to explore the lab. Vite proxies room and tutor requests to the Node server on port 3001.

For a production build:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. The same server serves the built frontend, HTTP API, and WebSocket rooms. `PORT` is configurable. Both commands load an optional `.env` file.

## Circuit sandbox

The home page is a full-screen spatial workspace. Its translucent components and live measurements are rendered in Three.js. No physical holographic display or hardware connection is implied.

- **Build:** add resistors, lamps, and switches from the floating palette. Drag the components directly, with mouse/touch or a camera pinch. Select any two glowing terminals to wire them. Terminals and all components also have accessible button alternatives in the inspector and object strip.
- **Inspect:** select a component to see its computed voltage, current, and power, adjust its value, toggle a switch, or remove a connection. Floating components display undefined readings rather than made-up zeros. Component positions do not affect electrical resistance.
- **Experiment:** ask the companion to propose a parallel branch, halve the battery voltage, open a switch, or change a component. Every proposal has a validated operation list and solver-computed preview. Only **Run experiment** changes the circuit. Editing the circuit invalidates pending proposals. Hosted AI can propose combinations of the supported operations; without a key, clearly labeled guided templates work.
- **Compare and rewind:** capture a baseline, inspect before/after supply current, undo/redo up to 40 edits, or restore the starter circuit. Dragging is a single undo step. Slider changes are individual steps. The latest board autosaves in this browser; circuit JSON export/import is separate from the original lab checkpoint format.
- **Voice:** microphone permission is explicitly requested. Browser Web Speech recognition sends a final transcript to the selected Ask/Experiment mode; spoken replies are opt-in. Support depends on browser/platform and its speech service. Audio may be processed by the browser's provider; Mindscope does not record or store audio. The transcript and numerical circuit state go to the configured AI service when using hosted AI. Unsupported browsers or denied permission keep a text fallback.

The solver uses nodal analysis for **one ideal DC battery (1–24 V), resistors, constant-resistance lamps, and ideal switches**, with up to 12 components and 30 wires. It supports arbitrary wiring within that scope, including branches and bridge networks. It distinguishes open circuits, floating islands, and source shorts. A shorted ideal voltage source has no finite current solution; the UI reports a short and suspends the flow animation. Currents inside ideal switch networks are not uniquely resolved and are explicitly unavailable. Lamp glow illustrates calculated power; it is not a thermal filament model. Animation pause only pauses the flow markers; steady-state electrical readings remain live. No AC, capacitors, inductors, transistors, or arbitrary code-generated physics.

The new sandbox is a **personal, browser-local workspace**; shared-room support remains in the original `/lab`. It is not silently synchronized to a classroom.

### Try the demo

1. Select **R1** and ask for **Add a parallel path**.
2. Inspect the proposal: supply current is predicted to change from 0.200 A to 0.240 A.
3. Run it; inspect the lamp and compare its increased power.
4. Rewind, then open **S1**. The circuit goes open and the lamp loses power.
5. Add a component yourself, move it, and connect its terminals. Ask the companion about that component.

## Explore with your hands

Select **Enable webcam & explore** and grant the browser camera permission. The first run downloads MediaPipe tracking assets. Good lighting and a stable camera help. Use one hand for pointing, or two for spread-to-zoom. Pointer motion has time-aware smoothing and a resting dead zone. MediaPipe inference runs in a dedicated worker, with one transferred image frame in flight, so it does not block scene rendering. The hand-controls guide includes a no-camera compatibility check using a synthetic blank frame.

| Gesture | Interaction |
| --- | --- |
| Point with your index finger | Move the on-screen pointer; movement is mirrored like a selfie camera |
| Pinch thumb and index finger, then release | Select a button, switch concepts, open the lesson guide, launch/pause, export, or open room controls |
| Pinch over a parameter, hold, and move sideways | Adjust its slider |
| Pinch a sandbox component, hold, and move | Place the component directly; attached wires follow |
| Pinch empty space in the 3D scene, hold, and move | Pan the circuit workspace; orbit other experiments |
| Pinch empty panel space, hold, and drag | Scroll the page, dialog, or chat |
| Pinch with both hands, then spread / bring together | Zoom in / out |
| Pinch the on-screen + / − buttons | Zoom fallback |

Release between selections. **Stop camera** immediately stops all video tracks and closes the tracker. **Hand controls** reopens the guide. Frames and landmarks stay on the device; the server receives only validated simulation actions. The initial tracking assets come from Google and jsDelivr. Camera access needs HTTPS or localhost; a plain HTTP LAN address is generally not a secure context.

Mouse, touch, and keyboard controls remain available. Arbitrary tutor text, room-code entry, and operating-system file dialogs still use standard browser input. Learners can join through an invite link without typing a code. The circuit sandbox includes optional voice input. Real camera tracking depends on the device and lighting; the gesture math is unit tested, but live hand accuracy still requires testing on the target classroom hardware.

## Guided experience

The guided page at `/experience` is itself a working simulation: **predict → experiment → inspect → ask**. Three chapters explore gravity, circuit topology, and XOR learning. Predictions receive feedback; scenario buttons change real simulation inputs. Click a projectile, launch pad, resistor, battery, or neuron to inspect its live values, or use the named object buttons. The learning companion can explain the selected element or apply validated changes through the existing tutor adapter. Without an API key it clearly identifies guided mode; open-ended AI needs the configured key. Generating new simulation types from prompts is not implemented.

The **Examples lab** navigation opens `/lab`, preserving the complete controls, classrooms, and checkpoints. Object selection there opens the Insights panel. Navigating between these pages stops the camera; use Hand controls to enable it again. Room links continue to work.

## Three real simulations

- **Projectile motion:** launch speed, angle, gravity presets, play/pause/reset, three comparison paths, range, height, and flight time. Constant gravity, level ground, no drag. The viewport auto-fits the trajectories; compare using the numeric scale.
- **Electrical circuits:** series/parallel ideal DC circuits, adjustable voltage and two resistors, equivalent resistance, current, voltage drops, and power. Animated current markers are illustrative and not to physical scale.
- **Neural networks:** an actual 2 → 4 → 1 sigmoid network learning XOR using full-batch backpropagation and binary cross-entropy. Inspect all four inputs, hidden activations, output, output-weight gradients, and recent loss history. Reset restores deterministic initial weights.

All scenes support local camera rotation and zoom. The **Insights** tab explains the current numerical state. JSON checkpoints preserve parameters, weights, training history, simulation time, and saved trajectories. Import validates the entire file and pauses playback.

## Live classroom

1. Choose **Start a live room** to create a room from the current experiment.
2. Share its learner invite link or eight-character room code.
3. The creator controls the room. Learners receive authoritative scene updates while keeping private cameras and tutor conversations.
4. The creator's presenter token is retained only in that browser tab's session storage and is never included in learner links or broadcast state.
5. Disconnecting the last presenter pauses playback. The same tab can reconnect with its token.

Rooms are anonymous, limited to 50 connections each, and live in one server's memory. Anyone who has an invite can view that room. Empty rooms expire after two hours. A server restart loses all rooms; export checkpoints. There is no account system, durable classroom history, student fork workflow, or presenter transfer yet. Do not run multiple independent replicas without adding a shared state/pub-sub layer.

## Tutor and natural-language controls

Without a key, **Guided tutor** produces deterministic teaching explanations from live values, with explicit supported commands. It is not a language model. Examples in **Change** mode:

- `show circuits`, `show neural networks`, `show projectile motion`
- `set speed to 25`, `set angle to 60`, `set gravity to 1.62`
- `set voltage to 9`, `set r1 to 20`, `use parallel`
- `set learning rate to 0.5`, `start`, `pause`, `reset`

For hosted AI, copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and restart. `OPENAI_MODEL` defaults to `gpt-4.1-mini` and can be changed to a model supporting Responses JSON output. The key stays server-side. Questions and the current numerical scene state are sent to OpenAI only when a tutor request is made; webcam frames are never sent. The UI distinguishes hosted AI from guided explanations. The AI proposes supported actions; Zod and the simulation reducer validate them, and the room still checks presenter authority. Learner tutor requests do not broadcast.

The included API rate limit is basic and per socket IP. Before exposing a paid AI key to a broad public audience, add authentication, shared rate limiting, per-user quotas, and billing controls. Set `APP_ORIGIN` to your exact HTTPS origin in production if you want an explicit origin allowlist. The demo has no persistent chat storage.

## Deploy

Use a **single Node web service with WebSocket support**, not a static-only host. A Render Blueprint is included in `render.yaml`; connect this repository on Render, supply optional AI configuration, and deploy. Render supplies HTTPS and `PORT`. Set `APP_ORIGIN` to the final origin. Deploying is a separate step; pushing this repository does not create a public hosted service.

Alternatively:

```sh
docker build -t mindscope .
docker run --rm -p 3001:3001 --env-file .env mindscope
```

Omit `--env-file .env` when you have not created one. Use an HTTPS reverse proxy for remote webcam access and forward WebSocket upgrades. The runtime image uses an unprivileged user. Site hosting was not used because this MVP explicitly uses a persistent Node/WebSocket server.

## Verify

```sh
npm test       # simulation, gradients, checkpoints, gestures, room permissions
npm run build # TypeScript and production bundle
npm run check # both
```

GitHub Actions runs these checks on pushes and pull requests. Tests include analytic physics checks, Kirchhoff/Ohm consistency, XOR convergence, finite-difference gradients, invalid checkpoints/actions, hand pinch hysteresis, slider clamping, multi-client synchronization, presenter denial, reconnect, and tutor privacy.

The production hand-tracking worker was initialized and exercised with a synthetic blank image without opening the camera. Browser review covered the camera-choice screen, mouse fallback, all concepts, circuit topology changes, training and tutor results, responsive layout, room creation, direct component dragging, circuit experiment preview/application, rewind, switch behavior, and voice consent. A real-camera classroom trial and hosted-AI end-to-end test require the corresponding hardware/credentials.

See [Architecture](docs/architecture.md) for module boundaries and extension points.
