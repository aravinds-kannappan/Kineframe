# Hosted Kineframe

- Product website: https://kineframe.onrender.com
- Workspace: https://kineframe.onrender.com/workspace
- Illustrated two-page brief: https://kineframe.onrender.com/api/brief
- Repository: https://github.com/aravinds-kannappan/Kineframe
- Render service: `srv-dbm9sprbc2fs738ni8e0`
- Dashboard: https://dashboard.render.com/web/srv-dbm9sprbc2fs738ni8e0

## Runtime

The Render Node web service runs `main` in Oregon on the free compute plan. Its build command is `npm ci --include=dev && npm run build`; the start command is `npm start`. Node is pinned to 22.23.2. Auto-deploy is enabled for commits to the connected branch. `render.yaml` records the equivalent configuration for a fresh deployment; the existing service was created directly rather than through a Blueprint sync.

One Node process serves the production frontend, API, PDF and streaming session updates. Checkout tests start an isolated child process and send real HTTP requests to its loopback server. A static-only host cannot run this backend. The Docker image also includes the fixtures and PDF for alternative Node/container hosting.

The deployed environment sets `NODE_ENV=production`, `NODE_VERSION=22.23.2` and `TRUST_PROXY_HOPS=1`. The proxy setting makes Express count visitor addresses for rate limits behind Render's reverse proxy. Leave it unset when serving directly. `/api/health` reports readiness and guided/hosted mode. No AI credential is checked into the repository or required for guided mode. To enable hosted AI, add `OPENAI_API_KEY` in Render's environment settings and redeploy; `OPENAI_MODEL` is configurable.

## Demo expectations

[Render's free tier](https://render.com/docs/free) spins down after 15 minutes without inbound traffic and can take about a minute to wake. The URL is hosted independently of the developer's laptop. Free compute has platform usage limits; this deployment is a prototype, not an always-on production service.

Session state and temporary source copies are ephemeral. Sessions expire after 30 minutes without activity and are lost on sleep, restart or redeploy. Reload the app to create a fresh session after a restart, or choose a new session. Explicit preferences remain in the visitor's browser until forgotten. Use Export to keep an investigation record. The prototype supports up to 24 active sessions per process and requires a single instance; multi-instance hosting needs shared session storage and routing.

Only bounded demonstration code is executed. There is no user authentication or access to private repositories or production cloud infrastructure. The session identifier grants access to its session and should not be shared accidentally. HTTPS enables supported microphone/WebXR APIs, but a real headset and browser permissions are still required for device-level testing.
