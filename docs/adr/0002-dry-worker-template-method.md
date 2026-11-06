# 0002 — BaseWorker Template Method for Bull job processors (DRY + GoF)

- Status: Accepted
- Date: 2026-11-06
- Phase: 8 (Architecture)

## Context

`src/shared/workers/{auth,email,user}.worker.ts` each implemented the
identical shape:

```ts
try {
  // ...one line of actual work, different per worker...
  job.progress(100);
  done(null, job.data);
} catch (error) {
  log.error(error);
  done(error as Error);
}
```

This is the same concept — "run this job's real work, report success via
`done(null, job.data)`, report failure via logging + `done(error)`" —
repeated three times with only the one real line of work differing
(`authService.createAuthUser`, `mailTransport.sendEmail`,
`userService.addUserData`). Real, present duplication, not a coincidence.

This repo already has a precedent for exactly this shape of problem:
`src/shared/services/queues/base.queue.ts` (`BaseQueue`) and
`src/shared/services/redis/base.cache.ts` (`BaseCache`) are both abstract
base classes that factor out the repeated constructor/connection/logging
boilerplate for, respectively, every `*Queue` and every `*Cache`. Workers
were the one remaining infrastructure category following the ad-hoc
pattern instead of the established one.

## Decision

Add `src/shared/workers/base.worker.ts` (`BaseWorker`), an abstract class
providing a single `protected run(job, done, task)` Template Method
(GoF). Each concrete worker's job-processing method becomes a thin
closure passed into `run`, containing only the one line that differs.

### A non-obvious constraint this decision had to satisfy

Each queue (`auth.queue.ts`, `email.queue.ts`, `user.queue.ts`) registers
its worker's method as a **bare, unbound callback reference** —
`this.processJob('addAuthUserToDB', 5, authWorker.addAuthUserToDB)` — the
same reason the controllers register `SignUp.prototype.create` etc.
directly as Express route handlers (see `authRoutes.ts`): Bull calls the
callback with no `this` context at all. Before this change, that was
safe because the worker methods never referenced `this` — they closed
over module-level `log`/service imports instead.

Moving the shared logic into a base class means the per-worker methods
now need `this.run(...)` — which requires `this` to actually be bound.
Converting them from regular methods to **arrow function class
properties** (`addAuthUserToDB = async (job, done) => {...}`) solves
this: an arrow property closes over the instance's `this` once, at
construction time, so `authWorker.addAuthUserToDB` can still be passed
around unbound and `this` inside it still correctly resolves to the
`authWorker` instance. This is the same trick used for unbound React
class-component event handlers; it was verified, not assumed — all
three workers' Docker-verified behavior was re-checked after the change.

## Why here (not elsewhere, not a bigger refactor)

- Mirrors `BaseQueue`/`BaseCache`'s existing convention instead of
  inventing a new one — consistent with this codebase's own established
  style, not a foreign pattern grafted on (KISS).
- Did **not** also try to fix the controllers' `ClassName.prototype.method`
  registration style (the same underlying "no `this` binding" shape) —
  that pattern works correctly as-is for every controller today (no
  controller method calls another via `this`), nothing is broken, and
  touching every route registration site across every controller to make
  a style change with no functional benefit would be scope creep past
  what this phase's "small refactors" mandate covers (YAGNI).

## Consequences

- One Template Method instead of three copies of the same try/catch/log/
  done shape; adding a fourth worker in the future means writing one
  closure, not re-deriving the boilerplate.
- `auth.worker.ts` and `user.worker.ts` still fail to build for the
  same, already-documented, out-of-scope reason
  (`docs/TECHNICAL_DEBT.md` #1 — `@service/db/{auth,user}.service` don't
  exist) — this refactor does not touch that import, so the TS2307 error
  for each file is unchanged in content, only shifted by one line number.
  Verified identical build/test/lint signature before and after
  (`docs/BASELINE.md`'s Phase 8 section).
