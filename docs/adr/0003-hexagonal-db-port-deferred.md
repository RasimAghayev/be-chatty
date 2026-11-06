# 0003 — The `@service/db/*` import boundary is the right shape; filling it in is deliberately deferred

- Status: Accepted
- Date: 2026-11-06
- Phase: 8 (Architecture)

## Context

Every controller that needs to read or write a user/auth record imports
from `@service/db/auth.service` or `@service/db/user.service` —
`signin.ts`, `signup.ts`, `password.ts`, `current-user.ts`,
`auth.worker.ts`, `user.worker.ts`. None of these controllers import a
Mongoose model directly; they all go through this one named import path.
**The implementation files behind that path do not exist** —
`src/shared/services/` has `emails/`, `queues/`, `redis/`, `workers/`,
but no `db/` — which is why `npm run build` currently fails with 12
`TS2307` errors across 10 files (`docs/TECHNICAL_DEBT.md` #1).

This gap has already been scoped, by an explicit decision recorded
before Phase 3 even started (`docs/IMPROVEMENT_ROADMAP.md`'s "Scope
decision" line): writing `db/auth.service.ts` / `db/user.service.ts` is
new business logic (the actual Mongoose queries, error handling, and
return shapes a real data-access layer needs), not a hygiene, structure,
or architecture fix, and is explicitly out of scope for this program's
non-business-logic phases, including this one.

## Decision

Treat the current state — a consistent, repo-wide import boundary
(`@service/db/*`) with no implementation behind it yet — as the correct
**Clean/Hexagonal port**, already in place at the right layer, and
**do not write the missing adapter implementation this phase.**

This is the one Phase-8 case worth writing down explicitly rather than
leaving as an unstated omission: Clean/Hexagonal's "apply when external
systems need swapping" criterion is actually satisfied here (every
controller already depends on an abstraction, not a concrete Mongoose
model), which could be read as "architecture work to do." It isn't,
because the abstraction already exists at exactly the layer it should —
what's missing is the adapter's body, which is business logic, not
structure.

## Why here

- The *shape* of the boundary (controllers depend on `@service/db/*`,
  never on a Mongoose model directly) is already exactly what
  Clean/Hexagonal would recommend introducing if it didn't already
  exist — there is no refactor to do here, only a decision to leave it
  alone and record why.
- Writing `db/auth.service.ts`/`db/user.service.ts` now, under the
  banner of "completing the hexagonal boundary," would in practice mean
  writing the real `findOne`/`create`/`updateOne` Mongoose calls, the
  error handling around them, and the exact return shapes five different
  call sites expect — i.e., delivering the feature, not refactoring one.
  That is explicitly the thing `docs/TECHNICAL_DEBT.md` #1 and
  `docs/IMPROVEMENT_ROADMAP.md` already decided is out of scope.
- `src/features/user/models/user.schema.ts`, the unused `user.interface.ts`
  interfaces, and the `user.mock.ts` fixtures that Phase 7 deliberately
  kept (not deleted) are the other half of this same story: they are the
  model/DTO/fixture scaffolding the eventual adapter will consume. This
  ADR is the architecture-level record of *why* that scaffolding and this
  import boundary are both being left exactly as they are.

## Consequences

- `make verify` stays red for this one, already-documented, isolated
  reason — unchanged by this phase, and not expected to change until a
  future, explicitly-scoped pass decides to implement the service layer
  as real business logic.
- When that future pass happens, the adapter slots in behind the
  existing `@service/db/auth.service` / `@service/db/user.service`
  import paths with **zero changes needed to any controller or worker**
  — every call site is already written against the port, not a concrete
  implementation. That is the concrete, present benefit of leaving this
  boundary exactly where it already is.
- No code changed under this ADR. It exists purely to make an
  architecture decision that was previously implicit (and easy to
  mistake for an oversight) explicit and traceable.
