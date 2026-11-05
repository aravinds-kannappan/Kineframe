# Kineframe

**A shared workspace for human-agent software engineering.**

[Product website](https://kineframe.onrender.com) · [Open the environment](https://kineframe.onrender.com/workspace) · [Two-page brief](output/pdf/Kineframe_Two_Page_Brief.pdf)

## Purpose

Kineframe brings the developer and their AI agent into the same engineering context. See the system being built, point to the part you mean, discuss the evidence, redirect the investigation, review a change, and verify its result. The interface starts in a browser and extends into a spatial WebXR room.

## Use cases and audience

- **Developers working with coding agents:** understand generated code, investigate failures, review fixes, and check the outcome before proceeding.
- **Platform and infrastructure engineers:** reason about service dependencies, timeouts and resource ownership. Production telemetry integrations are a future capability.
- **Teams exploring spatial development:** inspect source, services and test evidence in a shared human-agent context across desktop and VR views.

The working demo reproduces a checkout connection leak or timeout mismatch. You can apply a reviewed patch, build a health endpoint, run real HTTP checks, interrupt work, and rewind source changes.

## Differentiation

Visual interaction with agents already has strong precedents. Kineframe's proposed focus is the complete **shared build-and-debug session**, connecting selected artifacts, conversation, source changes and revision-linked evidence across desktop and spatial views.

| Related product / research | Existing approach | Kineframe's emphasis |
| --- | --- | --- |
| [Cursor Design Mode](https://cursor.com/blog/design-mode) | Selected UI elements, drawings and voice provide context for agent edits. | Shared system investigation with reviewable patches and measured execution evidence. |
| [Replit Visual Editor](https://docs.replit.com/design/visual-editor) | Direct visual UI edits update source code. | Understanding behavior, dependencies and failures throughout the human-agent debugging loop. |
| [DreamCodeVR](https://ubiq.online/publication/dreamcodevr/) | Research into speech-driven programming of object behavior inside VR. | A desktop-to-spatial engineering session with source review, interruption and verification. |

These are differences in emphasis, not claims that competitors lack debugging or spatial capabilities. A productivity advantage has not yet been demonstrated.

**Moat thesis:** durable project context, reviewed engineering decisions and verified outcomes could make each subsequent investigation more useful. Defensibility would depend on trusted integrations, accumulated context and repeated team use. The current prototype has session history and explicit editable preferences; it has no established data moat or passive behavioral learning.

## Design and implementation

The product homepage at `/` uses responsive React, CSS and SVG for an interactive concept walkthrough. **Launch environment** opens `/workspace` in a separate tab. The workspace is lazy-loaded and combines a service map, source, proposed changes, evidence and agent activity. Three.js/WebXR presents the same session in a spatial room.

A Node/Express backend streams authoritative state through server-sent events. Each session runs a bundled checkout service in a temporary directory; child processes execute real HTTP regression checks. Patches use validated templates, require review and reject stale revisions. Guided mode is deterministic; an optional server-side `OPENAI_API_KEY` enables AI discussion and bounded tool selection. Voice input is turn-based. Preferences are explicit and editable.

This is a scoped prototype: arbitrary repositories, production infrastructure, durable team sessions and full-duplex voice are not connected. Headset behavior needs physical-device testing. The public demo uses ephemeral sessions on Render's free tier and may take about a minute to wake after inactivity.

## Development

Requires Node.js 22.9+.

```sh
npm ci
npm run dev      # http://localhost:5173
npm run check   # tests, TypeScript, production build
```

For production, run `npm run build` and `npm start`. Copy `.env.example` to `.env` to configure optional AI credentials; never commit secrets.

[Implementation details](docs/kineframe-architecture.md) · [Hosting and limitations](docs/deployment.md)
