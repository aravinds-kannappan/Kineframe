# Kineframe

**Build and debug, together in space.** A shared engineering workspace where a human and an agent inspect the same system, talk through evidence, review source changes, and verify the result.

Formerly **Mindscope**, this repository is now **Kineframe**. The earlier education prototypes are retained as archived routes.

**Open the hosted workspace: [kineframe.onrender.com](https://kineframe.onrender.com)**

No local installation is needed. The public demo runs on Render's free tier and may take about a minute to wake after inactivity. It uses the labeled **Guided** playbook unless an API key is configured on the server. Sessions reset when the server restarts or sleeps; export an investigation to keep its results. See [hosting details](docs/deployment.md).

[Two-page concept brief](output/pdf/Kineframe_Two_Page_Brief.pdf) · [Architecture](docs/kineframe-architecture.md) · [Original Mindscope documentation](docs/mindscope-legacy.md)

## Run locally

Requires Node.js 22.9+.

```sh
npm install
npm run dev
```

Open **http://localhost:5173/**. Vite proxies the API to the Node server on port 3001. For the production build:

```sh
npm run build
npm start
```

Open **http://localhost:3001/**. The Node server is required: this is not a static-only website. Session state lives in server memory and expires after 30 minutes without activity; source copies live in temporary directories. Export a session to retain an investigation record. A server restart requires a new session.

## Try the complete loop

1. Select **Connection leak**. Choose **Investigate together** or ask “Investigate the bug.”
2. Watch real HTTP requests execute. Three declined payments exhaust a three-slot connection pool; the next order returns 503.
3. Open **Changes** and inspect the before/after source. **Apply & verify** writes `service.mjs` in the isolated workspace and runs the regression checks.
4. Confirm 2/2 incident checks pass and held connections drop from 3 to 0. The health check is a separate feature target.
5. Ask **Build a health endpoint**, review and apply its proposal, then confirm all three checks pass.
6. **Rewind last source change** restores the previous source. Test results are marked stale until rerun.
7. Try **Timeout budget** for an infrastructure configuration example: a real HTTP request fails when a 25 ms timeout is shorter than its 65 ms upstream operation.

Choose a service to set shared focus. Drag nodes to arrange your view. The graph is a declared logical map of the demo service, not discovered production topology. Selecting a node tells the agent what “this” refers to. Source, evidence, proposed changes and activity are visible together on desktop. Smaller screens offer Workspace and Agent tabs.

## AI, conversation and memory

Without credentials, **Guided** mode uses an explicitly labeled built-in playbook. Its executions and test results are real, but its responses and patches are bounded, deterministic recipes.

To enable open-ended discussion and tool selection, create `.env` (gitignored):

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4.1-mini
```

`npm run dev` and `npm start` load `.env`. Hosted AI receives the demo source, selected service, conversation, measured evidence, and saved memory. It can inspect, run checks, and propose one of three supported edits. **It cannot execute arbitrary shell commands, generate arbitrary executable patches, access arbitrary repositories, or deploy to production.** Both modes use the same reviewed patch flow.

Agent activity streams through server-sent events. You can interrupt a running test or hosted request. Sending a new direction stops the previous operation before starting another. Already-written source changes are not automatically undone by interruption; use Rewind.

Voice uses browser SpeechRecognition where supported. It is **turn-based**, not full-duplex realtime audio. Audio may be processed by the browser's recognition provider; the app stores only transcript events. Optional spoken replies use browser speech synthesis. Press Interrupt to stop work and spoken output. Memory is an editable list of up to eight explicit preferences, stored in this browser and supplied to new sessions. There is no passive behavioral learning or model training.

## Spatial / VR room

Select **Spatial room**. The Three.js preview presents the same session's service objects, evidence, conversation and source/patch panels. On desktop, drag to orbit and click panels to act. In a compatible WebXR headset browser, use the **Enter VR** control; controller rays or supported hand select events target the panels. Hold a service node to arrange it. Run checks, propose a fix, apply a reviewed patch, interrupt, and trigger voice from the room.

Enable voice in the main workspace before entering VR. WebXR and microphone access require a secure context: localhost works on the same device; a headset visiting another computer's IP requires properly configured HTTPS. Opening the URL on desktop does not emulate or verify headset tracking. Some browsers do not support WebXR or SpeechRecognition.

The source/patch panel is a summary view, not a full immersive code editor. WebXR implementation is present, but controller/hand tracking, audio permissions, comfort and readability require testing on physical hardware.

## Validation and limitations

```sh
npm run check   # tests, TypeScript and production build
```

Tests exercise analytical simulations retained from Mindscope, noisy hand-input traces, actual checkout HTTP failures, source writes, feature acceptance, timeout configuration, interruption, workspace isolation, stale proposal rejection, SSE and API validation. Browser QA covers the guided build/debug flow, memory editing, source review, and spatial-panel Run checks / Propose fix / Apply patch actions in the desktop 3D preview. Hosted AI and real microphone/headset interaction are not verified without the required credentials/devices.

This is a scoped functional prototype. It does not provide multi-user identity, production observability connectors, arbitrary code editing, agent-driven cloud deployments, or behavioral preference learning. A session id is an unguessable bearer capability; anyone who obtains it can operate that demo session. The public deployment contains only the bundled demonstration. Add authentication before connecting private repositories or infrastructure. `APP_ORIGIN` restricts browser origins, but is not user authentication. The service executes only the bundled fixture and validated patch templates; this isolation is not a sandbox for untrusted code. No custom headset or holographic hardware is needed.

The main bundle currently triggers Vite's large-chunk advisory. This is a performance optimization opportunity rather than a failed build.

## Brief and historical prototypes

The checked-in two-page PDF includes vector diagrams of the shared workspace, debugging loop, and session architecture, plus a clickable hosted-demo URL. It is generated by `scripts/create_kineframe_brief.py` with ReportLab and pypdf. It embeds Arial from macOS; set `KINEFRAME_FONT_DIR` to a directory containing `Arial.ttf` and `Arial Bold.ttf` to regenerate elsewhere. Python is not required to run the app. The current brief is also served at [the hosted PDF endpoint](https://kineframe.onrender.com/api/brief).

Earlier routes remain available: `/sandbox` (circuit sandbox), `/experience` (guided concepts), `/lab` (classroom experiments). The previous hand input now includes debounced contacts, wrist continuity, palm-relative dragging, loss recovery, and two-hand zoom locking; those improvements are covered by trace tests, not a live camera trial.
