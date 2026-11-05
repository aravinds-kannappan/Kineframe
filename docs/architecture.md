# Browser first, spatial later

The blueprint's three concepts share one client, one authoritative Node server, one state/action contract, and one tutor adapter. A room has one active concept at a time.

```text
Webcam → local MediaPipe → hand pointer → visible UI actions
                                             ↓
React + Three.js ← authoritative state ← Node + WebSocket room
        ↑                                    ↑
        └─ private tutor HTTP request → AI adapter → validated proposal
```

## Source map

- `shared/simulation.ts`: schema, action validation, deterministic reducer, equations, actual network training, checkpoint format, grounded explanations, local command parser.
- `shared/gestures.ts`: normalized pinch recognition with hysteresis, mirrored pointer mapping, and slider quantization.
- `server/index.ts`: in-memory rooms, presenter capabilities, WebSocket broadcasting, HTTP limits, tutor adapter, production asset serving.
- `src/App.tsx`: lesson navigation, solo/shared state, controls, results, comparisons, checkpoints, room invites, private tutor UI.
- `src/components/Scene.tsx`: disposable Three.js geometries/materials, local orbit camera, scene projections and animated playback.
- `src/components/Hands.tsx`: explicit camera consent, local tracking lifecycle, smoothed pointer, pinch click/drag, two-finger scrolling, shutdown and fallback.
- `tests/`: executable mathematical and multi-client authorization checks.

## Authority and data flow

Solo experiments run the same reducer and tick function locally. Shared clients send actions rather than calculated results. The room server parses actions, checks the presenter's secret capability, computes the next state, and broadcasts it. Views can differ; scene state cannot. Camera orbit and hand landmarks never leave the browser.

The server advances playback every 50 ms. Each network training tick performs 20 real full-batch gradient steps. Graph history keeps 120 samples. Circuit marker speed is illustrative. Projectile timing uses simulation increments, so under heavy load playback can slow rather than skip mathematical steps.

Presenter credentials are cryptographically random, compared in constant time, and sent in the first WebSocket message rather than a URL. They are a lightweight demo capability, not an account-based security model. No webcam, tutor text, or key appears in scene broadcasts. Room endpoints are bounded by payload size, schema limits, connection limits, basic request/message limits, and empty-room expiry.

The tutor endpoint returns an explanation plus an optional action. Ask mode never permits an action. Hosted commands only allow scene selection, supported parameter updates, play/pause, and reset; import is never an AI action. The browser forwards a validated proposal through the normal room channel, where permissions are checked again.

## Extension points

Add a concept by extending the schemas, reducer/tick, tested equations, scene renderer, teaching notes, and UI controls. Keep units and physical assumptions explicit.

To add private student experiments, create a separate state branch with an explicit share-back operation; do not bypass room authority. To add durable progress or lessons, introduce authenticated users and a database with explicit assessment records. To scale rooms, separate simulation scheduling from transport and add shared state/pub-sub with room affinity.

For spatial hardware, consume the same validated scene state through a WebXR or native renderer and device-specific input adapter. Physical alignment, supported hardware, and gesture calibration are separate capabilities. This browser implementation does not claim holographic projection.


## Circuit sandbox extension

The new `/` and `/sandbox` routes use `src/sandbox/CircuitSandbox.tsx`, while `/experience` and `/lab` preserve earlier experiences. `shared/circuitLab.ts` is the schema and solver authority. It collapses wire/closed-switch nodes with union-find, anchors one battery, solves reachable node potentials with pivoted Gaussian elimination, then computes resistive branch currents and power. Disconnected islands remain undefined. Source shorts are a separate status.

`CircuitWorld.tsx` raycasts component bodies and terminal spheres, maps dragging to a horizontal world plane, and retains logical connections while components move. Both browser pointer events and hand events use the same interaction controller. Objects are translucent with wire outlines; animation illustrates branch current and lamp power. There is no fabricated wire current in ideal-wire loops.

`server/circuitAssistant.ts` receives only a schema-valid board, question, mode, and selected object. It returns either an explanation or a validated plan of add/remove/set/toggle/connect/disconnect operations. Every preview is solved by the same local engine. Applying a proposal is guarded by an exact snapshot match to avoid stale actions. The server holds no new sandbox state; this extension is deliberately single-user. The route inherits existing API rate and payload limits.

`handTracking.worker.ts` loads the pinned MediaPipe runtime in a worker. `handTracker.ts` transfers one ImageBitmap at a time and terminates inference when the camera stops. The UI thread handles pointer stabilization and interaction mapping. Tracking frames never enter an HTTP request.

`Voice.tsx` wraps browser speech recognition with opt-in consent, feature detection, errors, cancellation, and unmount cleanup. Browser speech services can process audio remotely; no local-only claim is made. Voice experiment results still require the explicit Run experiment action. Spoken replies use browser speech synthesis only when enabled.
