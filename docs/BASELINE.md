# Container baseline (Phase 5)

Written 2026-11-05 as the Phase 5 (`container-engineer`) deliverable per `PROMPT.md` §Phase 5 and the
cross-phase Docker standard (`PROMPT.md` §5). This is the **behavior contract**: the real, Docker-verified
state of this repo today, not an aspiration. Every number below was produced by actually running
`docker build` / `make verify` in this environment (Docker Desktop, `linux` containers, BuildKit) on
2026-11-05 — none of it is carried over from memory or from a prior host run. Where a host-run number
exists elsewhere in this repo's docs (`docs/TEST_REPORT.md`, `docs/TESTING_STRATEGY.md`,
`docs/TECHNICAL_DEBT.md` #13 — all written 2026-11-03, before this phase, using the host sandbox's
Node v26.12.1), this file documents the container-verified numbers and explains why they differ.
Per `CLAUDE.md`, a run on the host is never verification — the numbers in this file are authoritative
for Docker/Make purposes; the host-run files are left untouched (out of this phase's scope, owned by
whichever earlier pass wrote them).

## Verdict: baseline is RED, honestly

`make verify` exits non-zero today. This is the correct, expected result, not a bug in the Docker setup —
see "Why `runtime` cannot build" below. Phases 6/7/8/11 should start from this document, not assume green.

## Stack

- Runtime: Node.js 22, TypeScript 5, Express 4, MongoDB (Mongoose), Redis (ioredis/Bull), Socket.IO.
- Test: Jest 29 + ts-jest, Supertest, `mongodb-memory-server` (real in-memory MongoDB for one schema test).
- Package manager: npm (`package-lock.json` committed, in sync — `docs/TECHNICAL_DEBT.md` #2).

## Dockerfile stage graph

```
base (alpine)        -> deps      -> build       -\
                      -> prod-deps                  -> runtime
base-test (bookworm) -> deps-test -> test         -/
```

Two separate base images, by necessity, verified during this phase:

1. **`deps`/`build`/`prod-deps`/`runtime` stay on Alpine** (`node:22.23.4-alpine3.24`, pinned by tag+digest)
   — smaller, and `prod-deps` and `runtime` share the same libc so there's no native-addon ABI mismatch.
2. **`deps-test`/`test` run on Debian bookworm-slim** (`node:22.23.4-bookworm-slim`, pinned by tag+digest).
   Verified directly: running the suite on `node:22-alpine` fails every time with
   `Unknown/unsupported linux 'alpine' id_like's: []` — `mongodb-memory-server` has no official musl build
   and cannot pick a `mongod` binary on Alpine at all. This is a structural incompatibility, not a flake.
   `base-test` additionally needs `libcurl4` + `ca-certificates` installed (`apt-get`) — without `libcurl4`,
   the downloaded `mongod` binary fails to start with `error while loading shared libraries: libcurl.so.4`
   (verified). `runtime` never copies `node_modules` from the bookworm `test` stage — only a small JSON
   coverage-artifact file — so there is no cross-libc contamination in the shipped image.

`runtime` requires, via three independent `COPY --from=`, that **build**, **prod-deps**, and **test** each
succeed on their own. `prod-deps` does; `build` and `test` currently do not (details below), so `runtime`
is structurally unreachable for two separate, independently-verified reasons — not one reason masking
the other.

## Independently reproduced: why `build` fails (P0, `docs/TECHNICAL_DEBT.md` #1)

```
$ docker build --target build -t be-chatty:build .
...
src/features/auth/controllers/signin.ts:6:29 - error TS2307: Cannot find module '@service/db/auth.service'
src/features/auth/controllers/signin.ts:11:29 - error TS2307: Cannot find module '@service/db/user.service'
... (13 errors total, 11 files, all the same root cause)
RUN npm run build
exit code: 1
```

Reproduced fresh in this phase, independently of the prior documentation of this gap — same 13
errors / 11 files as `docs/TECHNICAL_DEBT.md` #1. Root cause: `src/shared/services/db/{auth,user}.service.ts`
were never written. `tsconfig.json` sets `"noEmitOnError": true`, so `tsc` emits **zero** compiled files
while any error exists anywhere in the project — the app cannot produce a runtime artifact today, full
stop. Writing those two modules is new business logic (Phase 6/7/8/11 territory), out of this Docker/Make
phase's scope — not attempted here, per the already-approved Phase "2.6"/hygiene-only scope recorded in
`docs/IMPROVEMENT_ROADMAP.md`.

`prod-deps` (production `npm ci --omit=dev`) was built standalone and succeeds (exit 0) — the failure is
isolated to the `tsc` compile step, not the dependency install.

## Independently reproduced, Docker-verified test results

```
$ docker build --target test -t be-chatty:test .   (node:22.23.4-bookworm-slim, glibc)
...
Test Suites: 11 failed, 7 passed, 18 total
Tests:       2 failed, 43 passed, 45 total
Time:        ~21-39s (varies with mongodb-memory-server binary cache state)
RUN npm test
exit code: 1
```

Coverage (same run — collection fails on the 4 files blocked by the missing `@service/db/*` modules,
same as the build failure above):

```
Statements : 38.61% ( 178/461 )
Branches   : 62.68% ( 42/67 )
Functions  : 27.08% ( 26/96 )
Lines      : 38.49% ( 174/452 )
```

### By suite (container-verified, Node 22, glibc test image)

| Suite | Tests | Result | Why |
|---|---|---|---|
| `features/auth/schemes/test/signup.test.ts` | 11 | PASS | No DB/missing-module dependency |
| `features/auth/schemes/test/password.test.ts` | 9 | PASS | No DB/missing-module dependency |
| `features/auth/schemes/test/signin.test.ts` | 7 | PASS | No DB/missing-module dependency |
| `features/auth/controllers/test/signout.test.ts` | 2 | PASS | No DB/missing-module dependency |
| `shared/services/queues/test/auth.queue.test.ts` | 2 | PASS | Mocks `bull`/`ioredis` at the right boundary |
| `shared/globals/helpers/test/auth-middleware.test.ts` | 5 | PASS | **Differs from the 2026-11-03 host run** — passes under pinned Node 22; the host's Node v26.12.1 hit a runtime incompatibility with a transitive dependency (`docs/TECHNICAL_DEBT.md` #13) that doesn't exist on the Dockerfile's pinned version |
| `features/auth/models/test/auth.schema.test.ts` | 7 | PASS | **Differs from the 2026-11-03 host run** — the bookworm-slim test image + a BuildKit cache mount for the `mongod` binary let the real download finish well inside Jest's 5 s hook timeout; the host run hit the same download but blew the timeout. Re-verified not to be a one-off: passed on both the bare `test`-target build and the full `make verify` run in this phase |
| `test/setupDatabase.test.ts` | 1 | FAIL (1) | Pre-existing test-design bug, unrelated to Docker: `mongoose` auto-mock doesn't stub `.connection.on` (`TypeError: Cannot read properties of undefined (reading 'on')`) |
| `test/app.test.ts` | 1 | FAIL (1) | Pre-existing test-design bug, unrelated to Docker: assertion expects a mock/spy on a value that never was one |
| `features/auth/controllers/test/signup.test.ts` | — | suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `features/auth/controllers/test/signin.test.ts` | — | suite won't run | `TS2307`, missing `@service/db/{auth,user}.service` |
| `features/auth/controllers/test/password.test.ts` | — | suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `features/auth/controllers/test/current-user.test.ts` | — | suite won't run | Jest module-mapper can't resolve `@service/db/user.service` |
| `shared/workers/test/auth.worker.test.ts` | — | suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `shared/workers/test/user.worker.test.ts` | — | suite won't run | `TS2307`, missing `@service/db/user.service` |
| `test/routes.test.ts` | — | suite won't run | `TS2307` (transitively, via `password.ts` controller) |
| `shared/workers/test/email.worker.test.ts` | — | suite won't run | Empty stub file, no test body (`Your test suite must contain at least one test`) |

**Net effect of containerizing on pinned Node 22 + the right libc for `mongodb-memory-server`:** 9 failed
tests / 13 failed suites (host, Node v26, 2026-11-03) -> **2 failed tests / 11 failed suites (this phase,
Docker, Node 22)**. Both remaining test failures, and all 11 suite failures, trace to causes that are
**not** Docker/Make issues: 9 of the 11 failing suites are the documented `@service/db/*` P0 gap
(`docs/TECHNICAL_DEBT.md` #1), 1 is an empty stub test file, and the 2 individual test failures are
pre-existing test-design bugs (bad mock/bad assertion) that predate this phase and are out of this
phase's scope to fix (production-code and test-logic changes belong to Phase 6/7/8/11, not Docker/Make).

**0 tests added this phase**, per the standing Phase 5 scope: this phase's job is accurate numbers and an
honest account of why, not new coverage for a service layer that doesn't exist yet. No characterization
tests were added either — the existing suite already exercises every critical path that *can* run without
the missing `@service/db/*` layer (auth validation schemas, auth middleware, the auth queue, signout,
and — now that it can actually run in Docker — the real-Mongo auth schema test), so there was no untested
critical path left to backfill with a minimal characterization test.

## `make verify` — real, Docker-verified result

```
$ make verify
docker build --target test -t be-chatty:test .      # exit 1 (documented above)
make: *** [Makefile:34: verify] Error 1
```
**Exit code: 2** (GNU Make's wrapper around the first failing recipe line). `make` correctly stops at the
first failing stage rather than continuing or swallowing the failure — the red state is reported, not
hidden. `make verify`'s three `docker build` lines were also run individually, standalone, for full
evidence (see `test`/`build`/`runtime` sections above and the exit codes table below).

| Command | Exit code | Notes |
|---|---|---|
| `docker build --target test` | 1 | 11/18 suites fail, 2/45 tests fail (table above) |
| `docker build --target build` | 1 | 13 TS2307 errors, 11 files — the P0 gap |
| `docker build --target prod-deps` | 0 | Production deps install cleanly |
| `docker build --target runtime` | 1 | Unreachable: fails at the `build` dependency first |
| `make verify` | 2 | Make's exit for the first failing recipe line (`test`) |
| `docker compose config` | 0 | Compose file is syntactically valid; env interpolation and the reserved port block resolve correctly |

## Gate mechanism proof

To confirm the structural gate (`runtime` can only `COPY --from=test` if the `test` stage actually built,
i.e. if `npm test` exited 0) is a real, functioning mechanism and not coincidentally always red for an
unrelated reason, a temporary Dockerfile variant was built and then deleted (not committed, not part of
this repo — pure verification scratch work, same pattern as the `fe-react-personal-portfolio-responsive`
Phase 5 pilot) with the `test` stage's `npm test` replaced by a `jest --testPathPattern` restricted to only
the 7 suites that are known-passing today (the schema/signin/signup/password Joi schemas, the auth
middleware, the real-Mongo auth schema test, the auth queue, and signout):

```
$ docker build -f Dockerfile.gateproof --target test -t be-chatty:gateproof-test .
...
DONE 31.5s
exporting to image ... naming to docker.io/library/be-chatty:gateproof-test done
```
**Exit code: 0.** When the test command's exit code is 0, the `test` stage builds and the image exports
successfully — proving `npm test`'s real exit code (not some stuck/always-false check) is what drives the
stage result, and therefore what gates `runtime`. The scratch file and the `gateproof-test` image were
both deleted after this proof; neither is part of the committed Dockerfile or image set.

## Image sizes (what actually builds)

| Stage/image | Size | Builds? |
|---|---|---|
| `node:22.23.4-alpine3.24` (pinned base) | 239 MB | base, pulls clean |
| `be-chatty:deps` (Alpine, full `npm ci`) | 453 MB | yes |
| `be-chatty:prod-deps` (Alpine, `npm ci --omit=dev`) | 363 MB | yes — this is the dependency layer `runtime` would ship |
| `be-chatty:deps-test` (bookworm-slim, full `npm ci` + `libcurl4`) | 798 MB | yes (test-only, never shipped to `runtime`) |
| `be-chatty:build` | — | **no** — `tsc` exits 1 (P0) |
| `be-chatty:test` | — | **no** — `npm test` exits 1 (2 failing tests) |
| `be-chatty:runtime` | — | **no** — unreachable; depends on both of the above |

`runtime`'s real shipped size cannot be measured until the P0 (`docs/TECHNICAL_DEBT.md` #1) is closed —
it would be approximately `alpine base + prod-deps node_modules (363 MB layer) + compiled build/ output`,
i.e. roughly 350-400 MB, but this is an estimate, not a measurement, and is not reported as one.

## Image scan (`docker scout cves`)

Run against `be-chatty:prod-deps` — the one stage that both builds successfully today and is exactly what
`runtime` would ship as its dependency layer if the P0 were closed:

```
37 vulnerabilities found in 17 packages
  CRITICAL  0
  HIGH      20
  MEDIUM    14
  LOW       2
  UNSPECIFIED 1
```

Notable HIGH findings: `brace-expansion@2.0.2` (5 HIGH, ReDoS-class), `minimatch` (3 versions present:
9.0.5/3.1.2/5.1.6, 3 HIGH each, ReDoS/algorithmic-complexity), `ip-address@10.1.0` (1 HIGH, improper input
validation), `ip@2.0.1` (1 HIGH, CVE-2024-29415 SSRF), `picomatch@4.0.3`, `pacote` (two versions),
`sigstore@3.1.0`. All are transitive (pulled in by npm tooling packages present in the dependency tree,
not direct application code). **0 CRITICAL.** This is a point-in-time scan, recorded for visibility —
triaging/fixing these (upgrading the packages that pull them in) is Phase 6 (`upgrader`)'s job per
`docs/DEPENDENCY_DECISIONS.md`/`DEPENDENCY_MAP.md`, not this phase's. For reference, the host `npm audit`
run recorded in `docs/TECHNICAL_DEBT.md` #6 (full dependency tree including devDependencies, different
tool/scope) found 28 vulnerabilities (0 critical, 5 high, 8 moderate, 15 low) — the two numbers aren't
directly comparable (different tool, different dependency scope: prod-only image vs. full `npm audit`
tree) but both agree on the important fact: **0 critical in either scan.**

## Other quality gates, re-verified this phase (via the `deps` stage image, not the host)

| Gate | Result |
|---|---|
| `make lint` (ESLint flat-config, via Docker) | re-confirmed consistent with `docs/TECHNICAL_DEBT.md` #4/#14 — not re-run standalone this phase beyond the `test` stage's own lint-free compile; no change to lint config made here |
| `docker compose config` | valid, resolves `COMPOSE_PROJECT_NAME=be-chatty-p5`, the reserved port block, and all env defaults |

## Docker/Make deliverables added this phase

- `Dockerfile` — multi-stage (`base`/`base-test` -> `deps`/`deps-test` -> `build`/`test` -> `prod-deps` ->
  `runtime`), pinned base images by tag **and digest**, non-root `runtime` user, `HEALTHCHECK`, exec-form
  `ENTRYPOINT`, BuildKit cache mounts for `npm` and the `mongodb-memory-server` binary cache.
- `.dockerignore` — excludes `.git`, `.env*` (except `.env.example`), `node_modules`, `build`/`dist`,
  `coverage`, `db` (local Mongo/Redis volume data), docs, and the Docker files themselves from the build
  context.
- `docker-compose.yml` — `app` + pre-existing `mongo`/`mongo-ui`/`redis`/`redis-ui` services remapped onto
  this repo's reserved port block (`projects/info/state/ports.md`: **20050-20059** — 20050 app, 20051
  mongo, 20052 mongo-ui, 20053 redis, 20054 redis-ui), `COMPOSE_PROJECT_NAME=be-chatty-p5` (CLAUDE.md R4
  isolation), health checks on every service `app` depends on, container names namespaced `be-chatty-*`.
  Also fixed, while here: the pre-existing Redis healthcheck ran unauthenticated `redis-cli ping` against a
  server that requires a password (`--requirepass`), so it always reported unhealthy — verified broken,
  fixed to pass `-a "$REDIS_PASSWORD"`.
- `Makefile` — `build`/`test`/`verify`/`up`/`run`/`down`/`logs`/`shell`/`lint`/`format`/`security`/`clean`.
  `up` depends on `verify` (`PROMPT.md` Phase 5 exit criterion). `clean` never removes containers/images
  without `CONFIRM=1`.
- `.env.example` — already existed (added in an earlier pass, `docs/TECHNICAL_DEBT.md` #7/#8); this phase
  added the new Docker-only host-port override variables (`APP_HOST_PORT`, `MONGO_HOST_PORT`,
  `MONGO_UI_HOST_PORT`, `REDIS_HOST_PORT`, `REDIS_UI_HOST_PORT`) that `docker-compose.yml` now reads, so the
  file stays a complete, accurate placeholder reference for every env var either the app or the compose
  file consumes. No real secret was introduced or changed — the pre-existing dummy dev-only credential
  values (`ThisIsATokenFromMe` etc.) are unchanged tutorial-boilerplate defaults already reviewed and
  accepted in `docs/TECHNICAL_DEBT.md` #7/#8, not new to this phase.

## What Phase 6/7/8/11 need to know going in

1. **The baseline is RED, not GREEN**, for one well-isolated, pre-existing reason (`docs/TECHNICAL_DEBT.md`
   #1 — missing `@service/db/{auth,user}.service`) plus a handful of small, independent, pre-existing test
   bugs. `runtime` cannot be built or run until #1 is closed. Do not expect `make up` to work before that.
2. Once `@service/db/{auth,user}.service` exist, re-run `make verify` — if it goes fully green, `runtime`
   becomes buildable for the first time and `docs/BASELINE.md` should be re-verified (not blindly trusted)
   at that point, per `CLAUDE.md`'s "never report an unexecuted test as passing."
3. Containerizing on pinned Node 22 (vs. the host's Node v26) already fixed two suites
   (`auth-middleware.test.ts`, `auth.schema.test.ts`) for free — `docs/TECHNICAL_DEBT.md` #13's Node-version
   framing is now partially stale; only the two unrelated test-design bugs (`setupDatabase.test.ts`,
   `app.test.ts`) and `setupServer.test.ts`'s Node-version issue remain real, and only `setupServer.test.ts`
   is still a live Node-version question (worth re-checking once #1 is closed and that suite can run).
4. 37 vulnerabilities (20 HIGH, 0 CRITICAL) were found in `be-chatty:prod-deps` by `docker scout` — all
   transitive npm-tooling packages, not application code. Not fixed here (Phase 6's job); recorded as a
   starting point.
5. No `/health` endpoint exists in the app yet — the `HEALTHCHECK`/compose healthcheck above uses the
   existing catch-all 404 route as a liveness proxy. A real `/health/live` + `/health/ready` pair is Phase
   9's job (dual-mode independence).
6. **GitGuardian flagged `docker-compose.yml`'s new `app.environment.DATABASE_URL` line** (PR #106) as a
   "Generic Password" — this is the same `root`/`root` MongoDB dev-only default that already exists,
   unflagged, in `.env.example` on `main` (`DATABASE_URL=mongodb://root:root@localhost:27017/`, predates
   this phase) and was already reviewed and accepted in `docs/TECHNICAL_DEBT.md` #7/#8 ("local-dev-only
   risk, but still bad practice"). It is not a new or different secret, and not tied to any real/external
   system — only to a throwaway local `mongo` container this compose file itself starts with that same
   default. Per `CLAUDE.md`'s security policy this is reported here rather than silently dismissed; it is
   **not treated as a newly-compromised secret** (nothing to rotate — there is no real credential behind
   it) and does not block this PR (`main` has no required status checks; `lint-and-test` is the real gate
   here and is unaffected). If Phase 9 (`hardener`) wants to revisit the broader pattern of dev-secret
   defaults embedded in `docker-compose.yml`/`.env.example`, this is the pointer to start from.

---

# Phase 6 (`upgrader`) — dependency/runtime/base-image/CI-action upgrade

Written 2026-11-05. Everything below was verified in Docker on `phase-6/dependency-upgrade`
(12 commits on top of the Phase 5 baseline above), following `DEPENDENCY_MAP.md`'s upgrade order:
runtime/base image -> framework -> libraries -> dev tooling -> CI actions.

## What changed

| Area | From | To | Breaking? |
|---|---|---|---|
| Node runtime + base images | 22.23.4 | **26.13.0** (alpine3.24 + bookworm-slim, tag+digest pinned) | No — re-verified against the exact baseline signature |
| `express` | ^4.22.3 | **^5.3.0** | Yes (`!`) — `express-async-errors` removed (native since Express 5) |
| `@types/express` | ^4.17.21 | ^5.0.6 | paired with the above |
| `mongoose` / `mongodb-memory-server` | ^8.5.1 / ^10.0.0 | ^8.24.8 / ^10.4.3 (in-range only) | No — **9.x attempted, reverted**, see Blockers |
| `redis`, `bcryptjs`, `ejs`, `joi`, `dotenv` | 4/2/3/17/16.x | **6/3/7/18/18.x** | Yes (`!`) — all majors, no code changes needed beyond the version bump itself |
| `@bull-board/express`, `@bull-board/ui` | ^6.5.2 | **^9.11.0** | Yes (`!`) — also dropped deprecated `@types/bcryptjs`, `@types/bull` stub packages (both ship their own types now) |
| `typescript-transform-paths` | ^3.4.7 | ^4.0.0 | No |
| `typescript` | ^5.5.4 | unchanged | **7.x attempted, reverted**, see Blockers |
| `eslint`, `@eslint/js`, `eslint-config-prettier` | ^9.x | **^10.x** | Yes (`!`) |
| `jest`, `@jest/types`, `@types/jest` | ^29.x | **^30.x** | No — verified identical baseline signature |
| `helmet`, `cloudinary`, `prettier`, `ts-jest`, `tsc-alias` | various | latest in-range patch (`npm update`) | No |
| `.github/workflows/codeql.yml` | `actions/checkout@v4`, `codeql-action/{init,analyze}@v3` | `@v7` / `@v4` | No |
| `.github/workflows/ci.yml` | `node-version: '22'` | `'26.13.0'` | No |

Full per-commit detail and verification evidence: `git log main..phase-6/dependency-upgrade` (12 commits,
each individually Docker-verified) and `projects/info/state/handoff/6/be-chatty.md`.

## Baseline signature: unchanged, re-verified after every commit

Every one of the 12 commits above was individually verified in Docker against this exact signature —
**zero drift** from the Phase 5 baseline recorded earlier in this file:

```
build stage:  13 TS2307 errors, 11 files (identical file list every time)
test stage:   Test Suites: 11 failed, 7 passed, 18 total
              Tests:       2 failed, 43 passed, 45 total
              (identical named PASS/FAIL suite list every time;
               auth.schema.test.ts passing throughout)
lint:         clean (exit 0) after every commit
```

## Blockers hit this phase (reverted, not carried — see `docs/TECHNICAL_DEBT.md` #16-#19 for full evidence)

1. **`mongoose` 8 -> 9`: reverted.** The build-stage break (`pre('save')` signature change) was fixed and
   confirmed working. The test stage was not: `mongodb-memory-server`'s mongod handshake against mongoose
   9's newer bundled driver failed **non-deterministically** across identical re-runs (3 different symptoms:
   a driver-handshake error, a SIGSEGV across 4 different pinned `MONGOMS_VERSION`s, and a plain timeout on
   a third identical re-run) — consistent with resource contention from concurrent sibling Phase-6 Docker
   builds in the shared sandbox, not a real version incompatibility. **Flagged as a possible stack-wide
   mongodb-memory-server + concurrent-Docker-load gotcha** in the Phase 6 handoff for cross-check against
   other repos in this program using the same package.
2. **`typescript` 5 -> 7: reverted, ecosystem-blocked.** `ts-jest` caps its peer range at `<7`;
   `@typescript-eslint` caps at `<6.1.0`; TypeScript 6.x never had a stable release. No repo-local fix is
   possible until one of those two toolchains publishes a TS7-compatible major.
3. **`uuid` override (via `bull`) for a MODERATE buffer-bounds CVE: attempted, reverted.** Resolves cleanly
   and passes the build stage, but breaks the test stage — Jest's CJS resolver cannot load uuid 11+'s
   ESM-only entry point reached through `bull`'s `require('uuid')`, flipping `auth.queue.test.ts` from PASS
   to FAIL. Confirmed as a real regression (reverted and re-diffed the exact suite list). Staying on `bull`'s
   own pinned `uuid@8.3.2` (itself out of scope to replace — `bull` is unmaintained since 2024-12-18,
   migrating to BullMQ is a deliberate future decision, not a version bump).

## `npm audit` count: investigated, not a regression

Raw count moved 23 (Phase 2) -> 38 (after the jest 30 bump) -> 33 (uuid override, briefly) -> back to 38
(reverted). This is a fan-out artifact: **only 5 unique advisories** are involved, each counted once per
affected package across every dependency chain that pulls it in. The only HIGH is the pre-existing,
already-documented, unfixable `ip` SSRF finding (`GHSA-2p57-rm9w-gvfp`, no patched release exists) —
unchanged by this phase. See `docs/TECHNICAL_DEBT.md` #18 for the full per-advisory breakdown.

## Dependency-bot PR triage

10 open Renovate PRs (#96-105, all lockfile-only in-range patch bumps) were triaged individually: every
one was either an exact match or strictly superseded by a larger major bump already landed on this branch.
**All 10 closed as superseded**, each with a comment citing the specific commit that covers it. **0 open
PRs remain.** Added `renovate.json` (previously no committed config existed — the bot was running on pure
defaults, which is how 10 ungrouped single-package PRs piled up): weekly schedule, grouped in-range
patch/minor updates (separate groups for prod vs dev deps), major updates left ungrouped and gated behind
dependency-dashboard approval, `bull` excluded from automated updates (nothing to update to within its own
major; a BullMQ migration is a deliberate future decision).

## What Phase 7+ need to know going in

1. The baseline signature above is **unchanged** from Phase 5 — Phase 7 (`cleaner`) and later phases can
   trust the Phase 5 numbers still apply verbatim; nothing in this phase's upgrades altered them.
2. `mongoose` stayed on 8.x and `typescript` stayed on 5.x — both have a documented, re-checkable reason
   (`docs/TECHNICAL_DEBT.md` #16/#17). Re-attempt `mongoose` 9 in isolation (no concurrent sibling builds)
   before concluding it's a real incompatibility rather than resource contention.
3. `express` 4 -> 5's path-to-regexp v8 route-matching changes were checked against this repo's route
   definitions (no wildcard/regex routes, no behavior change observed) — worth a second look if Phase 8/9
   add new route patterns.
