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
