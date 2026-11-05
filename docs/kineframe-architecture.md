# Kineframe implementation

The root route serves the developer workspace. `src/workspace/WorkspaceApp.tsx` owns the session UI; `ServiceMap.tsx` provides accessible SVG selection and arrangement; `SpatialRoom.tsx` renders the same authoritative state in Three.js/WebXR. Desktop and XR operate on the same session rather than independent simulations. Node positions are view-local arrangements, while focus, evidence, source, proposals and conversation are session state.

## State and execution

`shared/workspace.ts` defines the client/server contract. `server/workspace/router.ts` creates unguessable capability sessions, validates actions with Zod, streams snapshots over SSE, and expires idle sessions. Existing API rate limiting applies. Same-origin checks reject browser requests from unrelated origins. This does not replace identity or authorization for a public deployment.

`WorkspaceEngine` creates a per-session temporary directory and copies the bundled `fixtures/checkout` service and runner. Each verification launches a child Node process with only PATH inherited. The process starts an ephemeral loopback HTTP server, exercises actual requests, measures response time, reports status/pool occupancy, and emits structured regression results. Only bundled code and server-owned templates are executable. Users and models cannot choose command strings, file paths or arbitrary patches. A ten-second watchdog and AbortController cancellation terminate the runner.

The pool fixture omits release on failure; the fix uses try/finally. The timeout fixture has an insufficient deadline; its fix updates the configuration. The health feature adds a static service-health export consumed by the fixture HTTP handler. These are bounded demonstrator tasks, not general-purpose repository editing.

Every proposal contains an id, base revision, exact before/after content, rationale and file. Apply checks the id and base revision, writes source, advances the revision and verifies. Rewind restores the prior source/configuration with a new revision number. Prior evidence remains visible but stale. The first completed run is retained as a comparison baseline. Interrupting verification never produces a completed evidence record. If interruption happens after a source write, that write remains reviewable and reversible.

SSE is the authoritative UI state stream. Mutation response snapshots are deliberately not applied in the client: they can arrive after newer streamed completion events. Concurrent operations are rejected, while focus changes and stop requests remain available during work. A new chat direction first interrupts the active operation and waits for it to stop.

## Agent and memory

`agent.ts` provides a deterministic guided playbook without a key. With OPENAI_API_KEY it calls the Responses API using a strict JSON action schema and server-side validation. The agent may inspect files, run checks, propose one of three edits, or answer. Four tool steps bound each turn. It never applies a patch on its own. Explanatory messages are model output, not independently proven findings; evidence panels report actual runner results.

Conversation and evidence are in-memory session state. Explicit preferences are stored in localStorage and copied to new sessions; clearing memory removes active preferences, not already-created conversation/export records. There is no biometric inference, passive behavioral learning, or fine-tuning. Speech input uses the browser provider and spoken replies use SpeechSynthesis. This implementation is turn-based and does not claim full-duplex audio.

## Spatial adapter

Three.js WebXR uses controller target rays and select events, optional tracked hand models, and select-hold node arrangement. Mesh action panels call the same validated API as the desktop. The source view shows a limited number of lines; full source review remains in the desktop view. Unsupported browsers show the VRButton fallback. XR must be tested on a physical headset; desktop preview validates rendering and click actions only.

## Next integration boundaries

To operate on real repositories, add authenticated workspace provisioning, an execution sandbox for untrusted code, source-to-runtime identity mapping, Git-aware patch transactions, and test/tool adapters. To investigate real infrastructure, add read-only telemetry connectors with provenance and scoped permissions before any mutation capability. To collaborate across people, add membership and roles instead of relying on session capabilities. To learn preferences, retain explicit correction provenance and user controls. The current app does not silently claim any of these capabilities.
