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
