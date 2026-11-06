# Architecture

## Overview

A Node.js/TypeScript/Express backend for a MERN social-network/chat app, built while following a specific paid course. Feature-based layout under `src/features/<feature>/{controllers,models,routes,schemes,interfaces}`, with cross-cutting concerns under `src/shared/` (queues, redis, email, sockets, workers, global helpers). Path aliases (`@auth/*`, `@user/*`, `@global/*`, `@service/*`, `@socket/*`, `@worker/*`, `@mock/*`, `@root/*`) resolve via `tsconfig.json` `paths` + `tsc-alias` at build time, and via `jest.config.ts` `moduleNameMapper` at test time.

Only one feature is actually wired end-to-end: **auth** (signup, signin, signout, password reset, current-user). **user** has a Mongoose schema and TypeScript interface only — no controller, route, or test. No other feature (posts, comments, follows, chat, notifications) exists despite the course/README describing a full social network.

## Request flow (as implemented)

```
app.ts -> setupServer.ts (Express app, Socket.IO, Redis session store, security middleware)
       -> routes.ts -> authRoutes (signup/signin/signout) + currentRoutes (behind authMiddleware)
       -> controllers/*.ts -> validation schemes (Joi) -> @service/db/{auth,user}.service  <-- MISSING
                                                                                    |
                                                                                    v
                                                                            Mongoose models
                                                                            (auth.schema.ts, user.schema.ts)
```

**The database-access layer the controllers call into (`@service/db/auth.service`, `@service/db/user.service`) does not exist.** `src/shared/services/` contains only `emails/`, `queues/`, `redis/`, `workers/` — no `db/` subdirectory. Every controller that needs to read or write a user/auth record is calling an import that fails to resolve, which is why `npm run build` and most of `npm test` currently fail outright (see `TECHNICAL_DEBT.md` #1).

## Supporting infrastructure (implemented, independent of the gap above)

- **Session/auth:** `cookie-session` + JWT (`jsonwebtoken`), bcrypt password hashing.
- **Queues:** Bull + Redis, with a `@bull-board` dashboard mounted at `/queues` (`base.queue.ts`) — used for background email sending (`shared/workers/`, `shared/services/emails/`).
- **Realtime:** Socket.IO configured with a Redis adapter (`@socket.io/redis-adapter`) for multi-instance pub/sub, though no socket event handlers were found wired to a feature yet.
- **Media:** Cloudinary SDK configured (`config.ts`) for future image/video upload, not yet called from any controller.
- **Mail:** Nodemailer + SendGrid both present as options; templates exist for forgot-password/reset-password emails (`shared/services/emails/templates/`).

## Persistence

MongoDB via Mongoose. Two schemas exist: `auth.schema.ts`, `user.schema.ts`. No migration tooling — Mongoose's schema-on-write model, consistent with the rest of this course's scope. Local dev DB runs via `docker-compose.yml` (plain `mongo` image, no replica set, no backup/recovery setup — appropriate for a dev-only compose file, not evaluated for production since none is targeted).

## Deployment topology

**None exists.** The README describes a full AWS/Terraform/CircleCI deployment (VPC, EC2, ALB, autoscaling, Route53, ElastiCache, CodeDeploy) as part of the course curriculum, but no `terraform/`, `.circleci/`, or app `Dockerfile` exist in this repo — that part of the course was never reached. `docker-compose.yml` only provisions local Mongo/Redis dev dependencies; the Node app itself has no container image.

## Phase 8 — Architecture pass (2026-11-06)

Applied **only where a real, present problem justified it**; KISS/YAGNI won every conflict, per `PROMPT.md`'s Phase 8 table. Full evidence: `projects/info/state/handoff/8/be-chatty.md`.

| Principle | Applied? | Why |
|---|---|---|
| DRY | **Yes** (2 cases) | (1) `signin.ts`/`signup.ts` each independently built the identical `{userId, uId, email, username, avatarColor}` JWT payload — extracted into `Helpers.signAuthToken` (ADR 0001). (2) `auth.worker.ts`/`email.worker.ts`/`user.worker.ts` each implemented the identical try/progress/done + catch/log/done job-processing shape — extracted into a `BaseWorker` Template Method (ADR 0002). |
| KISS / YAGNI | Applied by restraint | No new speculative layers introduced this phase (no DDD/EDA/modular-monolith scaffolding added "just in case"). The one unused abstraction this repo had (`typescript-transform-paths`) was already removed in Phase 7 — not re-done here (R1, one agent one phase). `signup.ts`'s one-line `signupToken` wrapper was deleted outright rather than kept as a pass-through once its body moved to `Helpers.signAuthToken` (ADR 0001) — keeping it would have reintroduced a second named thing doing what the helper already does. |
| SOLID | **No** | No class here has "several reasons to change" or concrete coupling that is actually blocking a test — every controller (`SignIn`, `SignUp`, `Password`, `CurrentUser`, `Signout`) is a thin orchestration shim over validation/service/queue/cache calls, and each already has a green or documented-failing mock-based test (no test is blocked by a SOLID violation). Splitting these further would add indirection with no present problem to solve. |
| Clean / Hexagonal | **Documented, not changed** | The port already exists at the right layer: every controller/worker that touches persistence imports from `@service/db/{auth,user}.service`, never a concrete Mongoose model — exactly the boundary Clean/Hexagonal would recommend introducing, if it weren't already there. What's missing is the adapter's *implementation*, which is new business logic (`docs/TECHNICAL_DEBT.md` #1), deliberately out of scope here. ADR 0003 records why this is a "leave it alone" decision, not an oversight. |
| DDD | **No** | Single CRUD-shaped auth/user domain (signup/signin/signout/password-reset, a user profile schema). Joi schemas already encode the few real invariants (username/password length and format); there is no aggregate, bounded context, or value-object complexity here that a model like that would actually solve. |
| EDA | **No** | Bull/Redis queues here are background-job dispatch (offload sending an email or writing a Mongo doc off the request thread) — fire-and-forget infrastructure, not domain events driving a *reaction* in some other module. Socket.IO is configured (Redis adapter, multi-instance pub/sub) but has no event handlers wired to any feature yet. No second module reacts to anything the auth feature does; a direct call is already simpler than modeling these as domain events. |
| Modular monolith | **No** | Only one feature (`auth`) is actually wired end-to-end; `user` is schema/interface-only scaffolding (`docs/TECHNICAL_DEBT.md` #1). A single real feature doesn't need enforced inter-module boundaries — there is no second bounded module yet for a boundary to protect against. |
| GoF patterns | **Yes** (Template Method) | `BaseWorker` (ADR 0002) applies GoF's Template Method to a named, present problem (three duplicated job-processing bodies) — the same way `BaseQueue`/`BaseCache` already apply it elsewhere in this repo. No pattern was introduced for its own sake. |

**Regression contract:** every commit in this phase was re-verified against the exact Phase 7 baseline signature (12 `TS2307` errors/10 files; 9 failed/7 passed/16 total suites; 2 failed/43 passed/45 total tests; `make lint` exit 0) — unchanged throughout. Full before/after detail: `docs/BASELINE.md`'s Phase 8 section.
