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

## Phase 7 — dead code & restructure (2026-11-06)

Full verification evidence: `projects/info/state/handoff/7/be-chatty.md`. Baseline before/after:
`docs/BASELINE.md` (Phase 7 section).

### Removed

- `src/shared/workers/test/email.worker.test.ts`, `.../user.worker.test.ts` — byte-identical
  duplicates of the real production worker files, mistakenly also committed under `test/`;
  contained zero Jest assertions, so they were two of the baseline's documented failing suites,
  not real tests.
- Dead commented-out email-confirmation block in `signin.ts` (duplicated, in an earlier draft
  form, the real working implementation already in `password.ts`), plus leftover commented
  debug-logging cruft in `signup.ts`, `mail.transport.ts`, `password.test.ts`, and a dead
  duplicate `parseJSON` method comment in `helpers.ts`.
- `typescript-transform-paths` dependency and its two tsconfig.json `plugins` entries — confirmed
  inert in both the build pipeline (plain `tsc`, no ts-patch; path aliasing is already handled by
  `tsc-alias`) and the test pipeline (`ts-jest` resolves aliases via `moduleNameMapper`, not this
  plugin).
- `@bull-board/ui` direct dependency — already pulled in transitively by `@bull-board/express` at
  the identical pinned version; no source file imports it directly.
- Dead `**/*.spec.ts` exclude pattern in `tsconfig.json` (project uses `*.test.ts`; zero
  `.spec.ts` files have ever existed in this repo).
- `commands.txt` — a stray, stale shell-history scratch file at the repo root, superseded by
  `package.json`/git history; its now-unnecessary `.dockerignore` entry removed alongside it.

### Kept despite being flagged by tooling (see Phase 7 handoff for full reasoning)

- `src/features/user/models/user.schema.ts`, 7 unused interfaces in `user.interface.ts`, and 4
  unused `user.mock.ts` fixtures — scaffolding for the already-documented, deliberately deferred
  `@service/db/user.service` gap (`docs/TECHNICAL_DEBT.md` #1), not abandoned code.
- 5 unused error classes in `error-handler.ts` (`NotFoundError`, `FileToLargeError`,
  `FileUploadError`, `InternalServerError`, `DatabaseConnectionError`) — genuinely unreferenced,
  kept out of caution rather than deleted on tooling signal alone.
- `ts-node` devDependency — flagged unused by static tooling, but `commands.txt`'s own history
  (before its removal) confirmed it backs `nodemon`'s dynamic `.ts`-file execution in the
  (separately, already broken) `dev`/`dev:mac` scripts, a pathway static tools cannot see.
- 3 commented-out test cases in `setupDatabase.test.ts` covering real, currently-untested,
  already-implemented behavior — flagged for Phase 11, not deleted.

### Baseline impact

Build: 13 TS2307 errors / 11 files -> 12 errors / 10 files. Test: 11 failed/7 passed/18 total
suites -> 9 failed/7 passed/16 total suites; test counts unchanged (2 failed/43 passed/45 total).
Lint: exit 0, unchanged. `make verify` still exits non-zero, for the same already-documented P0
reason (`docs/TECHNICAL_DEBT.md` #1) — unchanged, not a new regression.
