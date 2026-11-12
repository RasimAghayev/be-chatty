# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is tracked per upgrade pass rather
than semver releases, since this repo does not currently publish versioned releases.

## Phase 6 — dependency/runtime/base-image/CI-action upgrade (2026-11-05)

Full verification evidence: `projects/info/state/handoff/6/be-chatty.md`. Baseline before/after comparison:
`docs/BASELINE.md` (Phase 6 section). Deferred blockers: `docs/TECHNICAL_DEBT.md` #16-#19.

### Changed

- **Node runtime and Docker base images**: 22.23.4 -> 26.13.0 (both `alpine3.24` and `bookworm-slim`
  variants, tag+digest pinned). `ci.yml` and a new `.nvmrc` updated to match.
- **`express` 4 -> 5** (breaking): removed `express-async-errors` (native async error handling since
  Express 5); `@types/express` bumped to match.
- **`redis` 4 -> 6, `bcryptjs` 2 -> 3, `ejs` 3 -> 7, `joi` 17 -> 18, `dotenv` 16 -> 18** (all breaking
  majors): no application code changes required; all pass the existing test suite unchanged.
- **`@bull-board/express`, `@bull-board/ui` 6 -> 9** (breaking): removed the deprecated stub-types packages
  `@types/bcryptjs` and `@types/bull` (both target packages ship their own types now).
- **`typescript-transform-paths` 3 -> 4**.
- **`eslint`, `@eslint/js`, `eslint-config-prettier` 9 -> 10** (breaking).
- **`jest`, `@jest/types`, `@types/jest` 29 -> 30**; `ts-jest` already peers on jest 30, no major bump
  needed there.
- In-range patch refresh: `helmet`, `cloudinary`, `prettier`, `ts-jest`, `tsc-alias`,
  `mongoose`/`mongodb-memory-server`.
- `.github/workflows/codeql.yml`: `actions/checkout` v4 -> v7, `github/codeql-action/{init,analyze}` v3 -> v4.

### Added

- `renovate.json` — grouped/scheduled/rate-limited Renovate config (weekly schedule, prod/dev in-range
  groups, major updates gated behind dependency-dashboard approval, `bull` excluded from automation).

### Removed

- `express-async-errors` (superseded by Express 5's native async handling).
- `@types/bcryptjs`, `@types/bull` (deprecated stub-types packages; both real packages ship their own types).

### Not changed (attempted, reverted — see `docs/TECHNICAL_DEBT.md`)

- `mongoose` 8 -> 9: build-stage fix confirmed working, but test-stage `mongodb-memory-server` handshake
  failed non-deterministically against mongoose 9's bundled driver (possible resource-contention artifact,
  not necessarily a real incompatibility — flagged for cross-check against sibling repos).
- `typescript` 5 -> 7: ecosystem-blocked (`ts-jest` caps at `<7`, `@typescript-eslint` caps at `<6.1.0`,
  TypeScript 6.x never had a stable release).
- `uuid` override under `bull` (patches a moderate CVE): broke Jest's CJS resolution of uuid 11+'s
  ESM-only build, confirmed as a real test regression, reverted.

### Dependency-bot PRs

Closed 10 open Renovate PRs (#96-105) as superseded by the larger major bumps above; 0 open PRs remain.

## Phase 9 — hardening (2026-11-12)

### Changed

- `src/setupServer.ts`: disabled `x-powered-by`; session cookie hardened with `httpOnly: true` and `sameSite: 'lax'` (existing signed keys and non-development `secure` behavior preserved); Express 5-compatible terminal 404 handler; generic 500 JSON for unexpected non-custom errors (no internal error leakage).
- `src/routes.ts`: added `GET /health`, `/health/live`, `/health/ready`.
- `Dockerfile`, `docker-compose.yml`: container/compose health probes now use `/health/live`.
- `docs/SECURITY_REVIEW.md`: added Phase 9 security/hardening review (OWASP-oriented checklist, controls, residual risks).

### Verification

- `make lint` (Docker): exit 0.
- `make verify` (Docker): exit 2, same pre-existing red signature as Phase 5-8 baseline (`Test Suites: 11 failed, 7 passed, 18 total`; `Tests: 2 failed, 43 passed, 45 total`; build/runtime blocked by missing `@service/db/{auth,user}.service`).
