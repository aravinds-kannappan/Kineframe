# Mindscope

**Ideas you can move.** A browser learning lab where an instructor and learners explore the same live experiment through hand gestures, mouse controls, and a private tutor.

Built from the supplied two-page product blueprint. The browser is the first step toward the spatial teaching vision: it renders interactive 3D scenes, not physical holograms.

## Run locally

Requires Node.js **22.9+** and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The welcome screen offers webcam interaction or mouse/keyboard controls. No AI key or account is required to explore the lab. Vite proxies room and tutor requests to the Node server on port 3001.

For a production build:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. The same server serves the built frontend, HTTP API, and WebSocket rooms. `PORT` is configurable. Both commands load an optional `.env` file.

## Explore with your hands

Select **Enable webcam & explore** and grant the browser camera permission. The first run downloads MediaPipe tracking assets. Good lighting, a stable camera, and one clearly visible hand help.

| Gesture | Interaction |
| --- | --- |
| Point with your index finger | Move the on-screen pointer; movement is mirrored like a selfie camera |
| Pinch thumb and index finger | Select a button, switch concepts, open the lesson guide, launch/pause, export, or open room controls |
| Pinch over a parameter, hold, and move sideways | Adjust its slider |
| Pinch over the 3D scene, hold, and move | Orbit the camera |
| Extend index and middle fingers, fold the others, and move up/down | Scroll the page, dialog, or chat |
| Pinch the on-screen + / − buttons | Zoom |

Release between selections. **Stop camera** immediately stops all video tracks and closes the tracker. **Hand controls** reopens the guide. Frames and landmarks stay on the device; the server receives only validated simulation actions. The initial tracking assets come from Google and jsDelivr. Camera access needs HTTPS or localhost; a plain HTTP LAN address is generally not a secure context.

Mouse, touch, and keyboard controls remain available. Arbitrary tutor text, room-code entry, and operating-system file dialogs still use standard browser input. Learners can join through an invite link without typing a code. Voice input is not implemented. Real camera tracking depends on the device and lighting; the gesture math is unit tested, but live hand accuracy still requires testing on the target classroom hardware.

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

Browser review covered the camera-choice screen, mouse fallback, all concepts, circuit topology changes, training and tutor results, responsive layout, and room creation. A real-camera classroom trial and hosted-AI end-to-end test require the corresponding hardware/credentials.

See [Architecture](docs/architecture.md) for module boundaries and extension points.
