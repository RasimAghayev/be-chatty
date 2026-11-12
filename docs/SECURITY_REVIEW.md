# Security review (Phase 9 hardening)

Date: 2026-11-12  
Scope: `be-chatty` (Node.js/Express 5/TypeScript backend). Review performed as Phase 9
hardening on top of the Phase 8 baseline. This is a code/config review with Docker-verified
regression checks; it is not a penetration test and it does not claim production readiness.

## Summary

- Baseline before P9 changes: `make verify` red (pre-existing, documented) with
  `Test Suites: 11 failed, 7 passed, 18 total` and `Tests: 2 failed, 43 passed, 45 total`;
  build blocked by the long-standing missing `@service/db/{auth,user}.service` gap
  (`docs/TECHNICAL_DEBT.md` #1). Same signature after P9 changes (see handoff evidence).
- P9 applied low-risk, behavior-preserving hardening: explicit liveness/health endpoints,
  safer default cookie/header/error behavior, Express 5-compatible 404 handling, and
  container/compose health probes aligned to `/health/live`.
- No secrets were added, logged, or committed. No dependency versions were changed in P9.

## Controls reviewed (OWASP Top 10 floor)

| Area | Status | Notes |
|---|---|---|
| Injection (SQL/NoSQL/command) | Partial / unverified end-to-end | Request bodies validated via Joi decorators on auth endpoints. Data-access layer (`@service/db/*`) is not implemented (P0 debt), so end-to-end query behavior cannot be fully verified. No raw shell/SQL construction observed in reviewed paths. |
| Broken authentication/session | Improved | JWT-in-session auth middleware present for protected routes; cookie session now sets `httpOnly: true` and `sameSite: 'lax'` in addition to existing `secure` (non-development) and signed keys. Auth endpoints rate-limited (`authLimiter`). Residual: config fallback secrets exist for local/dev convenience (see Residual risks). |
| Sensitive data exposure / secrets | Partial | No real secrets found added in code during this pass. `.env.example` contains placeholders/dev-only defaults; compose includes dev-only credential defaults already documented in baseline/tech debt. Secrets must come from env/secret manager in real deployments. |
| XSS / output handling | N/A (JSON API) / partial | API returns JSON; helmet enabled. No server-rendered untrusted HTML path reviewed as user-content rendering. |
| CSRF | Partial | `sameSite: 'lax'` cookies reduce cross-site risk for state-changing requests; no additional CSRF token mechanism present. CORS restricted to configured `CLIENT_URL` with credentials. |
| Security misconfiguration | Improved | `x-powered-by` disabled; helmet and hpp enabled; CORS not wildcard; generic 500 response for unexpected errors (no stack/error object leakage to clients); Express 5-compatible terminal 404 handler. `/queues` Bull Board remains mounted without app-level auth (rate-limited globally) — operational/admin surface, residual risk. |
| Access control | Partial | `/api/v1/me` guarded by auth middleware chain; signout and auth flows follow existing design. `/queues` has no authentication/authorization gate in app code. |
| Vulnerable/outdated components | Not changed in P9 | Dependency/runtime upgrades are Phase 6 scope (completed earlier with documented blockers). `npm audit`/image scan posture unchanged by this phase. |
| Logging/monitoring | Baseline | Bunyan structured logging in use; error handler logs server-side errors. No secrets intentionally logged by P9 changes. Metrics/tracing not introduced (no stack/infrastructure present). |
| SSRF / file upload / deserialization | Limited exposure | Cloudinary upload helper exists; no new upload validation added in P9 to avoid behavior change. No request-driven outbound fetch paths added/reviewed beyond existing mail/queue integrations. |

## Changes applied in Phase 9

1. **HTTP hardening and error handling** (`src/setupServer.ts`)
   - Disabled `x-powered-by`.
   - Set cookie session flags `httpOnly: true` and `sameSite: 'lax'` (kept existing `secure`
     behavior and key configuration).
   - Replaced `app.all('*', ...)` catch-all with a terminal `app.use(...)` 404 handler for
     Express 5/path-to-regexp v8 compatibility.
   - Returned generic `500 Internal server error` JSON for unexpected non-`CustomError`
     failures (after logging) instead of falling through with no response contract.
2. **Health endpoints and probes** (`src/routes.ts`, `Dockerfile`, `docker-compose.yml`)
   - Added `GET /health`, `/health/live`, `/health/ready` returning 200 JSON status.
   - Switched container and compose app healthchecks from `/api/v1` (404 proxy) to
     `/health/live` for an explicit liveness signal.

## Residual risks / follow-up (not fixed in P9)

- **P0 build/test gap:** missing `@service/db/{auth,user}.service` keeps build/runtime image
  and many suites red (`docs/TECHNICAL_DEBT.md` #1). Not Phase 9 scope (business logic).
- **`/queues` dashboard exposure:** Bull Board mounted at `/queues` without authentication or
  environment gate; protected only by global rate limiting. Restricting access/network or
  adding auth is recommended before any non-local exposure.
- **Default/fallback config values:** `config.ts` and `.env.example`/compose retain local-dev
  defaults (JWT/session/DB/Redis placeholders or dev credentials). Real deployments must
  supply strong secrets via environment/secret manager and must not rely on defaults.
- **Compose dev credentials:** Mongo/Redis defaults in compose are local-dev oriented and were
  pre-existing; treat as non-production values.
- **CSRF tokens:** not implemented for cookie-authenticated state-changing endpoints; reliance
  is on `sameSite` + CORS origin restriction.
- **Observability depth:** no metrics/tracing/alerting stack added; structured logs exist.
- **Dependency vulnerabilities:** not remediated in P9; see Phase 6 notes and repo audit/debt
  records for the last known scan context.

## Verification

- `make lint` (Docker) — exit 0 after P9 code changes.
- `docker build --target test` / `make verify` (Docker) — red, but **same pre-existing
  signature** as baseline (`11 failed, 7 passed, 18 total` suites; `2 failed, 43 passed, 45`
  tests). No regression attributable to P9 changes.
