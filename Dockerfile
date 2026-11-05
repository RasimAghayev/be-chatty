# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Phase 5 container baseline for be-chatty.
#
# IMPORTANT, read before touching the stage graph:
#
# 1) `npm run build` (tsc --project tsconfig.json) currently fails on this
#    repo with 13 pre-existing TypeScript errors across 11 files — all
#    "Cannot find module '@service/db/{auth,user}.service'". Those two
#    modules were never written (documented in docs/TECHNICAL_DEBT.md #1,
#    scoped out by an earlier, explicit decision: writing them is new
#    business logic, not Docker/Make hygiene). Because tsconfig.json sets
#    "noEmitOnError": true, tsc emits ZERO compiled files while any error
#    exists anywhere in the project — so the app genuinely cannot produce a
#    runtime artifact today. This is the real, documented, pre-existing
#    baseline, not something introduced or hidden by this Dockerfile.
#
# 2) `auth.schema.test.ts` uses `mongodb-memory-server`, which does NOT
#    support musl/Alpine at all (verified: running the test suite on
#    node:22-alpine fails every time with "Unknown/unsupported linux
#    'alpine' id_like's: []" — mongodb-memory-server can't pick a mongod
#    binary because MongoDB Inc. ships no official musl build; this is a
#    structural incompatibility, not a slow-download flake). Fix verified
#    here: run ONLY the test stage on a glibc (Debian bookworm-slim) Node
#    image instead of Alpine. `deps`/`build`/`prod-deps`/`runtime` stay on
#    Alpine (smaller, and consistent libc between prod-deps and runtime —
#    no native-addon ABI mismatch risk). The two dependency trees
#    (`deps-test` vs `deps`) are installed independently; `runtime` never
#    copies node_modules from the bookworm `test` stage, only a small JSON
#    coverage artifact, so there is no cross-libc contamination.
#
# Stage graph:
#
#   base (alpine)      -> deps      -> build       -\
#                       -> prod-deps                  -> runtime
#   base-test (bookworm)-> deps-test -> test         -/
#
# `runtime` is FROM a fresh alpine stage and requires, via COPY --from=,
# ALL THREE of: build (compiled JS), prod-deps (production node_modules),
# and test (a coverage artifact that is only produced if `RUN npm test`
# inside the test stage exits 0). That last COPY makes `runtime`
# structurally unreachable unless the test stage's jest run passes — same
# proven gate pattern as the fe-react-personal-portfolio-responsive Phase 5
# pilot, verified below by running the gate mechanism against a
# known-passing subset of suites (see docs/BASELINE.md "Gate mechanism
# proof"). `runtime` is additionally, independently unreachable today
# because `build` fails (point 1 above) — two separate, real, documented
# reasons, not one hiding the other.
# ---------------------------------------------------------------------------

FROM node:26.13.0-alpine3.24@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS base
WORKDIR /app

FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS base-test
WORKDIR /app
# mongodb-memory-server's downloaded mongod binary dynamically links
# libcurl (used internally for FTDC/telemetry HTTP calls); bookworm-slim
# doesn't ship it. Verified: without this, every run fails with
# "Instance failed to start because a library is missing ...: libcurl.so.4"
# regardless of the download succeeding. ca-certificates is needed for the
# HTTPS binary download itself.
RUN apt-get update && apt-get install -y --no-install-recommends libcurl4 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
# Expected to fail today — see header comment point 1. Exit code is the
# real signal; do not "fix" by relaxing tsconfig or stubbing the missing
# modules here.
RUN npm run build

# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Separate, glibc-based dependency tree — see header comment point 2.
FROM base-test AS deps-test
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps-test AS test
COPY . .
ENV MONGOMS_DOWNLOAD_DIR=/root/.cache/mongodb-binaries
# mongodb-memory-server (used by auth.schema.test.ts) downloads a real mongod
# binary on first use; cache it across builds so repeat verification runs
# don't re-pay the download cost. Exit code of `npm test` is the real
# signal; a non-zero exit here is expected given the pre-existing baseline
# (see docs/BASELINE.md) and correctly blocks `runtime` below.
#
# NOTE (Phase 6, docs/TECHNICAL_DEBT.md): a mongoose 8 -> 9 upgrade attempt
# was reverted because it requires a newer bundled MongoDB driver that
# cannot reliably complete its handshake against a mongod in this sandbox
# -- see the technical-debt entry for the full evidence trail (every mongod
# version tried, 7.0.14 through 9.0.4, failed non-deterministically with 3
# different symptoms across repeated identical runs). Not re-attempted here.
RUN --mount=type=cache,target=/root/.cache/mongodb-binaries \
    npm test

# ---------------------------------------------------------------------------
# runtime: fresh, small Alpine stage. Requires build, prod-deps AND test to
# have each independently succeeded (three COPY --from= below) — see header
# comment for why this makes it structurally unreachable right now.
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/build ./build
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=test /app/coverage/coverage-final.json ./.test-gate-marker.json
COPY package.json ./

USER app

EXPOSE 5000

# No /health endpoint exists in this repo yet (adding one is Phase 9's job
# per PROMPT.md Phase 9 item 3 — dual-mode independence / health probes).
# As the most that is available without touching application code (out of
# this phase's Docker/Make-only scope), this HEALTHCHECK treats "the HTTP
# server answers at all" as liveness: GET /api/v1 always 404s through the
# app's own catch-all handler (see src/setupServer.ts globalErrorHandler),
# which still proves the process is up and the event loop is responsive.
# Any response below 500 counts as healthy; a hung/crashed process times out
# or refuses the connection and correctly reports unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.SERVER_PORT||5000,path:'/api/v1'},r=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["node", "build/app.js"]
