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
